// ─── Challenge System ─────────────────────────────────────────────────────────
// Manages challenge execution, progress, XP, badges and the sidebar UI.

import { EXERCISES, CATEGORIES } from './exercises.js';
import { getDatabaseById } from './databases.js';
import { initSQLEngine, createDatabase, executeSQL, getSchema } from './sql-engine.js';
import {
  getChallengeProgress,
  getLocalChallengeProgress,
  saveChallengeProgress,
  saveLastSQL,
  updateLeaderboard,
  getClassLeaderboard,
  logSession
} from './storage.js';

const $ = id => document.getElementById(id);

// ── Badge definitions ──────────────────────────────────────────────────────────

const BADGES = [
  { id: 'first_query',  label: 'First Query',      desc: 'Complete your first challenge',  threshold: 1,   type: 'total' },
  { id: 'ten_done',     label: 'Getting Started',   desc: 'Complete 10 challenges',         threshold: 10,  type: 'total' },
  { id: 'halfway',      label: 'Halfway There',     desc: 'Complete 30 challenges',         threshold: 30,  type: 'total' },
  { id: 'sql_master',   label: 'SQL Master',        desc: 'Complete all 60 challenges',     threshold: 60,  type: 'total' },
  { id: 'ddl_done',     label: 'Schema Builder',    desc: 'Complete all DDL challenges',    category: 'ddl' },
  { id: 'dml_done',     label: 'Data Wrangler',     desc: 'Complete all DML challenges',    category: 'dml' },
  { id: 'combo_done',   label: 'Full-Stack SQL',    desc: 'Complete all Combined challenges',category: 'combined' },
  { id: 'xp_200',       label: 'XP 200',            desc: 'Earn 200 XP',                    threshold: 200, type: 'xp' },
  { id: 'xp_500',       label: 'XP 500',            desc: 'Earn 500 XP',                    threshold: 500, type: 'xp' },
  { id: 'xp_1000',      label: 'XP 1000',           desc: 'Earn 1000 XP',                   threshold:1000, type: 'xp' },
];

// ══════════════════════════════════════════════════════════════════════════════
// CHALLENGE MANAGER
// ══════════════════════════════════════════════════════════════════════════════

export class ChallengeManager {
  constructor({ onXpChange, onMessage, onResults, onSchema, onError }) {
    this.onXpChange  = onXpChange;  // (totalXP, level) => void
    this.onMessage   = onMessage;   // (msgs, passed) => void
    this.onResults   = onResults;   // ({columns, rows}) => void
    this.onSchema    = onSchema;    // (schema[]) => void — called for DDL with no SELECT output
    this.onError     = onError;     // (errMsg) => void

    this.uid          = null;
    this.classCode    = '';
    this._displayName = '';
    this.progress     = { completed: {}, totalXP: 0, badges: [], submissions: {} };
    this.currentEx    = null;
    this._SQL         = null;
    this._lastSQL     = new Map(); // remembers last-run SQL per exercise this session

    this.challengeList  = $('challenge-list');
    this.challengePanel = $('challenge-panel');
    this.panelTitle     = $('ch-panel-title');
    this.panelBody      = $('ch-panel-body');
    this.panelBadge     = $('ch-panel-badge');
    this.testResults    = $('ch-test-results');
    this.xpDisplay      = $('ch-xp-display');
    this.levelDisplay   = $('ch-level-display');
    this.badgeToast     = $('badge-toast');

    $('btn-close-challenge')?.addEventListener('click', () => this._closePanel());
  }

  // ── Init ──────────────────────────────────────────────────────────────────

  async init(uid, classCode = '', displayName = '') {
    this.uid          = uid;
    this.classCode    = classCode;
    this._displayName = displayName;

    // Render immediately from localStorage — no async wait
    const cached = getLocalChallengeProgress(uid);
    if (cached) {
      this.progress = cached;
      this._renderSidebar();
      this._updateXpDisplay();
      Object.entries(cached.lastSQL || {}).forEach(([id, s]) => this._lastSQL.set(id, s));
    }

    // Load Firestore progress and SQL engine concurrently
    const [progress, sql] = await Promise.all([
      getChallengeProgress(uid),
      initSQLEngine()
    ]);
    this._SQL     = sql;
    this.progress = progress;
    // Firestore lastSQL is authoritative — overwrite anything from cache
    Object.entries(progress.lastSQL || {}).forEach(([id, s]) => this._lastSQL.set(id, s));
    this._renderSidebar();
    this._updateXpDisplay();
  }

  // ── Sidebar rendering ──────────────────────────────────────────────────────

  _renderSidebar() {
    if (!this.challengeList) return;
    this.challengeList.innerHTML = '';

    CATEGORIES.forEach(cat => {
      const catExs = EXERCISES.filter(e => e.category === cat.id);
      const done   = catExs.filter(e => this.progress.completed?.[e.id]).length;
      const pct    = Math.round(done / catExs.length * 100);

      const section = document.createElement('div');
      section.className = 'ch-section';
      section.innerHTML = `
        <div class="ch-section-header" data-cat="${cat.id}">
          <span class="ch-section-icon">${cat.icon}</span>
          <span class="ch-section-label">${cat.label}</span>
          <span class="ch-section-count">${done}/${catExs.length}</span>
          <svg class="ch-section-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div class="ch-section-progress">
          <div class="ch-section-bar" style="width:${pct}%"></div>
        </div>
        <div class="ch-section-items" id="cat-items-${cat.id}"></div>`;

      const header = section.querySelector('.ch-section-header');
      header.addEventListener('click', () => section.classList.toggle('collapsed'));

      const items = section.querySelector(`#cat-items-${cat.id}`);
      catExs.forEach(ex => {
        const done = !!this.progress.completed?.[ex.id];
        const item = document.createElement('button');
        item.className = `ch-item${done ? ' ch-item--done' : ''}`;
        item.dataset.id = ex.id;
        item.innerHTML = `
          <span class="ch-item-status">${done ? '✓' : '○'}</span>
          <span class="ch-item-title">${ex.title}</span>
          <span class="ch-badge-diff badge-${ex.difficulty}">${ex.difficulty}</span>`;
        item.addEventListener('click', () => this._openChallenge(ex));
        items.appendChild(item);
      });

      this.challengeList.appendChild(section);
    });
  }

  _updateXpDisplay() {
    const xp    = this.progress.totalXP || 0;
    const level = Math.floor(xp / 100) + 1;
    const pct   = (xp % 100);
    if (this.xpDisplay)   this.xpDisplay.textContent   = `${xp} XP`;
    if (this.levelDisplay)this.levelDisplay.textContent = `Level ${level}`;
    const bar = $('ch-xp-bar-fill');
    if (bar) bar.style.width = `${pct}%`;
    this.onXpChange?.(xp, level);
  }

  // ── Open / close challenge panel ───────────────────────────────────────────

  _openChallenge(ex) {
    this.currentEx = ex;

    // Highlight sidebar item
    document.querySelectorAll('.ch-item').forEach(el => {
      el.classList.toggle('ch-item--active', el.dataset.id === ex.id);
    });

    // Populate panel
    this.panelTitle.textContent = ex.title;
    this.panelBadge.textContent = ex.difficulty;
    this.panelBadge.className   = `ch-difficulty-badge badge-${ex.difficulty}`;

    // Description
    const doneOnce = !!this.progress.completed?.[ex.id];
    this.panelBody.innerHTML = `
      <div class="ch-desc">${ex.description}</div>
      ${ex.hints.length ? `<details class="ch-hints"><summary>Hints (${ex.hints.length})</summary><ul>${ex.hints.map(h=>`<li>${h}</li>`).join('')}</ul></details>` : ''}
      ${doneOnce ? '<div class="ch-done-badge">✓ Completed</div>' : ''}
      <div class="ch-xp-reward">+${ex.xp} XP on completion</div>`;

    this.testResults.innerHTML = '';
    this.challengePanel.classList.remove('hidden');

    // Notify app to load code (last run, or starter) and set active database
    document.dispatchEvent(new CustomEvent('challenge:open', {
      detail: { ...ex, savedSQL: this._lastSQL.get(ex.id) || '' }
    }));
  }

  _closePanel() {
    this.challengePanel?.classList.add('hidden');
    this.currentEx = null;
    document.querySelectorAll('.ch-item').forEach(el => el.classList.remove('ch-item--active'));
    document.dispatchEvent(new CustomEvent('challenge:close'));
  }

  getCurrentExercise() { return this.currentEx; }

  // ── Run challenge ──────────────────────────────────────────────────────────
  // studentSQL is the full editor content.
  // Returns { passed, messages, resultTable? }

  async runChallenge(studentSQL) {
    const ex = this.currentEx;
    if (!ex) return;

    // Remember what the student typed so we can restore it if they navigate away
    this._lastSQL.set(ex.id, studentSQL);
    saveLastSQL(this.uid, ex.id, studentSQL).catch(() => {});

    const SQL = this._SQL;
    if (!SQL) {
      this.onError?.('SQL engine not ready. Please wait.');
      return;
    }

    // Build fresh database
    let setupSQL = '';
    if (ex.database) {
      const dbDef = getDatabaseById(ex.database);
      if (dbDef) setupSQL = dbDef.setupSQL;
    }
    if (ex.setupSQL) setupSQL = (setupSQL || '') + '\n' + ex.setupSQL;

    let db;
    try {
      db = createDatabase(SQL, setupSQL);
    } catch (e) {
      this.onError?.(e.message);
      return;
    }

    // Run student SQL and capture results for display
    // Don't bail on execution error — some exercises (e.g. CREATE DATABASE) validate
    // by regex only and can't be executed in SQLite.
    const { results, error } = executeSQL(db, studentSQL);

    // Show any SELECT results in the results panel
    const lastResult = [...results].reverse().find(r => r.columns.length) ?? null;
    if (lastResult) {
      this.onResults?.(lastResult);
    }

    // Validate — always run, even if execution errored
    let validation;
    try {
      validation = ex.validate(db, studentSQL);
    } catch (e) {
      db.close();
      this.onError?.('Validation error: ' + e.message);
      return;
    }

    // If no SELECT results (DDL/combined), show the schema the student created
    if (!lastResult) {
      this.onSchema?.(getSchema(db));
    }

    db.close();

    const { passed, messages } = validation;

    // If execution errored and validation also failed, surface the SQL error
    if (error && !passed) {
      this.onError?.(error);
      return;
    }

    // Show in panel
    this._showTestResults(passed, messages);

    // Award XP
    if (passed && !this.progress.completed?.[ex.id]) {
      await this._awardXP(ex);
    }

    // Log session
    logSession(this.uid, this.classCode, {
      exerciseId: ex.id,
      category: ex.category,
      difficulty: ex.difficulty,
      passed,
      sqlLength: studentSQL.length,
      hasJoin: /\bJOIN\b/i.test(studentSQL),
      hasWhere: /\bWHERE\b/i.test(studentSQL),
      hasGroupBy: /\bGROUP\s+BY\b/i.test(studentSQL),
      hasAggregate: /\b(SUM|AVG|COUNT|MAX|MIN)\b/i.test(studentSQL),
      hasDDL: /\b(CREATE|ALTER|DROP)\b/i.test(studentSQL),
      hasDML: /\b(INSERT|UPDATE|DELETE|SELECT)\b/i.test(studentSQL),
    }).catch(() => {});
  }

  _showTestResults(passed, messages) {
    if (!this.testResults) return;
    const icon = passed ? '✓' : '✗';
    const cls  = passed ? 'test-pass' : 'test-fail';
    this.testResults.innerHTML = `
      <div class="test-result ${cls}">
        <span class="test-icon">${icon}</span>
        <div class="test-messages">
          ${messages.map(m => `<div>${m}</div>`).join('')}
        </div>
      </div>`;
  }

  // ── XP + badges ────────────────────────────────────────────────────────────

  async _awardXP(ex) {
    this.progress.completed = this.progress.completed || {};
    this.progress.completed[ex.id] = { completedAt: Date.now(), xp: ex.xp };
    this.progress.totalXP = (this.progress.totalXP || 0) + ex.xp;

    const newBadges = this._checkBadges();
    if (newBadges.length) {
      this.progress.badges = [...(this.progress.badges || []), ...newBadges.map(b => b.id)];
      newBadges.forEach(b => this._showBadgeToast(b));
    }

    this._updateXpDisplay();
    this._renderSidebar();

    try {
      await saveChallengeProgress(this.uid, this.progress);
      await updateLeaderboard(this.uid, this.classCode, this._displayName, this.progress.totalXP);
    } catch (e) {
      console.error('Progress save failed:', e);
      this.onError?.('Progress could not be saved: ' + e.message + ' — check your Firestore rules.');
      return;
    }

    this._showXpToast(ex.xp);
  }

  _checkBadges() {
    const earned = new Set(this.progress.badges || []);
    const newBadges = [];
    const totalDone = Object.keys(this.progress.completed || {}).length;
    const xp = this.progress.totalXP || 0;

    BADGES.forEach(b => {
      if (earned.has(b.id)) return;
      let qualify = false;
      if (b.type === 'total') qualify = totalDone >= b.threshold;
      else if (b.type === 'xp') qualify = xp >= b.threshold;
      else if (b.category) {
        const catExs = EXERCISES.filter(e => e.category === b.category);
        qualify = catExs.every(e => !!this.progress.completed?.[e.id]);
      }
      if (qualify) newBadges.push(b);
    });
    return newBadges;
  }

  _showXpToast(xp) {
    const toast = $('xp-toast');
    if (!toast) return;
    toast.textContent = `+${xp} XP`;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 2500);
  }

  _showBadgeToast(badge) {
    const toast = $('badge-toast');
    if (!toast) return;
    toast.innerHTML = `<strong>Badge Unlocked!</strong><br>${badge.label} — ${badge.desc}`;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 4000);
  }

  // ── Leaderboard ────────────────────────────────────────────────────────────

  async showLeaderboard() {
    const entries = await getClassLeaderboard(this.classCode);
    const modal = $('leaderboard-modal');
    const body  = $('leaderboard-body');
    if (!modal || !body) return;

    if (!entries.length) {
      body.innerHTML = '<p class="lb-empty">No entries yet. Complete challenges to appear on the leaderboard!</p>';
    } else {
      body.innerHTML = entries.map((e, i) => `
        <div class="lb-row ${e.uid === this.uid ? 'lb-row--me' : ''}">
          <span class="lb-rank">${i + 1}</span>
          <span class="lb-name">${e.displayName || 'Anonymous'}</span>
          <span class="lb-xp">${e.totalXP || 0} XP</span>
        </div>`).join('');
    }
    modal.classList.remove('hidden');
  }
}

// ── Sandbox execution (free-play, not challenge) ───────────────────────────────
// Returns { results, error } — does NOT affect challenge progress.

export async function runSandboxSQL(SQL, databaseId, customSetupSQL, studentSQL) {
  if (!SQL) return { results: [], error: 'SQL engine not ready.' };

  let setupSQL = customSetupSQL || '';
  if (databaseId) {
    const dbDef = getDatabaseById(databaseId);
    if (dbDef) setupSQL = dbDef.setupSQL + '\n' + setupSQL;
  }

  let dbInst;
  try {
    dbInst = createDatabase(SQL, setupSQL);
  } catch (e) {
    return { results: [], error: e.message };
  }

  const { results, error, rowsAffected } = executeSQL(dbInst, studentSQL);
  dbInst.close();
  return { results, error, rowsAffected };
}
