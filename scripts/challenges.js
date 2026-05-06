// ─── Challenge System ─────────────────────────────────────────────────────────
// Manages challenge execution, progress, XP, badges and the sidebar UI.

import { EXERCISES, CATEGORIES } from './exercises.js?v=20260506-1';
import { getDatabaseById } from './databases.js?v=20260427-25';
import { initSQLEngine, createDatabase, executeSQL, getSchema } from './sql-engine.js?v=20260427-25';
import {
  getChallengeProgress,
  getLocalChallengeProgress,
  saveChallengeProgress,
  saveLastSQL,
  getAllChallengeProgress,
  updateLeaderboard,
  getClassLeaderboard,
  getAllLeaderboardEntries,
  getAllStudents,
  getAllTeacherClasses,
  getClassNames,
  logSession
} from './storage.js?v=20260429-7';

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

const SQL_TERMS = new Set([
  'add','alter','and','as','asc','avg','between','boolean','by','case','char','character',
  'check','column','constraint','count','create','cross','database','date','ddl','delete',
  'desc','distinct','dml','drop','else','end','exists','false','foreign','from','full',
  'group','having','if','in','inner','insert','int','integer','intersect','into','is',
  'join','key','left','like','limit','max','min','not','null','numeric','offset','on',
  'or','order','outer','pk','primary','real','references','right','select','set','sum',
  'table','text','then','time','true','union','unique','update','values','varchar','where'
]);

function identifierUsedAsTable(sql, identifier) {
  if (!identifier) return false;
  const quoted = escapeRegExp(identifier);
  const patterns = [
    `\\bFROM\\s+["'\`\\[]?${quoted}["'\`\\]]?\\b`,
    `\\bJOIN\\s+["'\`\\[]?${quoted}["'\`\\]]?\\b`,
    `\\bUPDATE\\s+["'\`\\[]?${quoted}["'\`\\]]?\\b`,
    `\\bINTO\\s+["'\`\\[]?${quoted}["'\`\\]]?\\b`
  ];
  return patterns.some(pattern => new RegExp(pattern, 'i').test(sql));
}

function databaseNameTableMessage(ex, studentSQL, error) {
  if (!ex?.database || !/no such table/i.test(error || '')) return null;

  const dbDef = getDatabaseById(ex.database);
  if (!dbDef) return null;

  const databaseNames = [dbDef.id, dbDef.label].filter(Boolean);
  const usedDatabaseName = databaseNames.some(name => identifierUsedAsTable(studentSQL, name));
  if (!usedDatabaseName) return null;

  const tableList = dbDef.tables.map(t => `\`${t}\``).join(', ');
  if (dbDef.tables.length === 1) {
    const tableName = dbDef.tables[0];
    return `${dbDef.label} is the database already open for this challenge. Query its table instead: \`${tableName}\`. Try \`SELECT * FROM ${tableName};\``;
  }
  return `${dbDef.label} is the database already open for this challenge. Query one of its tables instead: ${tableList}.`;
}

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
    this.role         = 'student';
    this._displayName = '';
    this._leaderboardClassCode = '';
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

  async init(uid, classCode = '', displayName = '', role = 'student') {
    this.uid          = uid;
    this.classCode    = classCode;
    this.role         = role;
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
      section.className = `ch-section ch-section--${cat.id}`;
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
    this._saveCurrentDraftFromEditor();
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
      <div class="ch-desc">${formatInstructionText(ex.description)}</div>
      ${ex.hints.length ? `<details class="ch-hints"><summary>Hints (${ex.hints.length})</summary><ul>${ex.hints.map(h=>`<li>${formatInlineText(h)}</li>`).join('')}</ul></details>` : ''}
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
    this._saveCurrentDraftFromEditor(true);
    this.challengePanel?.classList.add('hidden');
    this.currentEx = null;
    document.querySelectorAll('.ch-item').forEach(el => el.classList.remove('ch-item--active'));
    document.dispatchEvent(new CustomEvent('challenge:close'));
  }

  getCurrentExercise() { return this.currentEx; }

  updateDraft(sql) {
    const ex = this.currentEx;
    if (!ex) return;
    this._lastSQL.set(ex.id, sql);
  }

  _saveCurrentDraftFromEditor(persist = false) {
    const ex = this.currentEx;
    if (!ex) return;
    const editor = document.getElementById('sql-editor');
    if (!editor) return;
    const sql = editor.value ?? '';
    this._lastSQL.set(ex.id, sql);
    if (persist && this.uid) {
      saveLastSQL(this.uid, ex.id, sql).catch(() => {});
    }
  }

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

    const keyRules = validateCreatedTables(studentSQL, db);
    if (keyRules.messages.length) {
      validation = {
        passed: false,
        messages: [...keyRules.messages, ...(validation?.messages || [])]
      };
    }

    // If no SELECT results (DDL/combined), show the schema the student created
    if (!lastResult) {
      this.onSchema?.(getSchema(db));
    }

    db.close();

    const { passed, messages } = validation;

    const sessionData = {
      exerciseId: ex.id,
      category: ex.category,
      difficulty: ex.difficulty,
      passed,
      executionError: error || '',
      sqlLength: studentSQL.length,
      hasJoin: /\bJOIN\b/i.test(studentSQL),
      hasWhere: /\bWHERE\b/i.test(studentSQL),
      hasGroupBy: /\bGROUP\s+BY\b/i.test(studentSQL),
      hasAggregate: /\b(SUM|AVG|COUNT|MAX|MIN)\b/i.test(studentSQL),
      hasDDL: /\b(CREATE|ALTER|DROP)\b/i.test(studentSQL),
      hasDML: /\b(INSERT|UPDATE|DELETE|SELECT)\b/i.test(studentSQL),
    };

    // Log every attempt, including syntax/runtime errors, so teachers can see
    // effort and misconceptions even before a student has a successful run.
    logSession(this.uid, this.classCode, sessionData).catch(() => {});

    // If execution errored and validation also failed, surface the SQL error
    if (error && !passed) {
      const databaseNameMessage = databaseNameTableMessage(ex, studentSQL, error);
      if (databaseNameMessage) {
        this._showTestResults(false, [databaseNameMessage]);
        return;
      }
      this.onError?.(error);
      return;
    }

    // Show in panel
    this._showTestResults(passed, messages);

    // Award XP
    if (passed && !this.progress.completed?.[ex.id]) {
      await this._awardXP(ex);
    }
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
    this.testResults.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
    const modal = $('leaderboard-modal');
    const body  = $('leaderboard-body');
    if (!modal || !body) return;

    modal.classList.remove('hidden');
    body.innerHTML = '<p class="lb-empty">Loading leaderboard...</p>';

    try {
      if (this._isStaff()) {
        const classes = await this._getLeaderboardClasses();
        if (!classes.length) {
          body.innerHTML = '<p class="lb-empty">No classes found yet. Create a class code or add students to a class first.</p>';
          return;
        }

        const selected = classes.some(c => c.code === this._leaderboardClassCode)
          ? this._leaderboardClassCode
          : classes[0].code;
        this._leaderboardClassCode = selected;

        body.innerHTML = `
          <div class="lb-controls">
            <label class="lb-label" for="leaderboard-class-select">Class</label>
            <select id="leaderboard-class-select" class="lb-select">
              ${classes.map(c => `<option value="${escAttr(c.code)}"${c.code === selected ? ' selected' : ''}>${esc(c.label)}</option>`).join('')}
            </select>
          </div>
          <div id="leaderboard-list" class="lb-list">
            <p class="lb-empty">Loading class...</p>
          </div>`;

        $('leaderboard-class-select')?.addEventListener('change', e => {
          this._leaderboardClassCode = e.target.value;
          this._renderLeaderboardList(e.target.value, true);
        });

        await this._renderLeaderboardList(selected, true);
      } else {
        await this._renderLeaderboardList(this.classCode, false);
      }
    } catch (ex) {
      body.innerHTML = `<p class="lb-empty">Could not load leaderboard: ${esc(ex.message || ex)}</p>`;
    }
  }

  _isStaff() {
    return ['teacher', 'superadmin'].includes(this.role);
  }

  async _getLeaderboardClasses() {
    const [codes, rawNames, allEntries] = await Promise.all([
      getAllTeacherClasses(this.uid).catch(() => []),
      getClassNames().catch(() => ({})),
      getAllLeaderboardEntries().catch(() => [])
    ]);
    const names = normalizeClassNames(rawNames);

    const classCodes = new Set([
      ...codes.map(normalizeClassCode),
      ...Object.keys(names).map(normalizeClassCode),
      ...allEntries.map(entry => normalizeClassCode(entry.classCode)).filter(Boolean)
    ]);

    return [...classCodes].sort().map(code => ({
      code,
      label: names[code] ? `${names[code]} (${code})` : code
    }));
  }

  async _renderLeaderboardList(classCode, includeRoster) {
    const target = this._isStaff() ? $('leaderboard-list') : $('leaderboard-body');
    if (!target) return;

    if (!classCode) {
      target.innerHTML = '<p class="lb-empty">No class selected.</p>';
      return;
    }

    target.innerHTML = '<p class="lb-empty">Loading class...</p>';
    const normalizedClassCode = normalizeClassCode(classCode);
    const [rawEntries, rawStudents, allProgress] = await Promise.all([
      includeRoster ? getAllLeaderboardEntries() : getClassLeaderboard(normalizedClassCode),
      includeRoster ? getAllStudents().catch(() => []) : Promise.resolve([]),
      includeRoster ? getAllChallengeProgress().catch(() => ({})) : Promise.resolve({})
    ]);
    const entries = includeRoster
      ? rawEntries.filter(entry => normalizeClassCode(entry.classCode) === normalizedClassCode)
      : rawEntries;
    const students = includeRoster
      ? rawStudents.filter(student => normalizeClassCode(student.classCode) === normalizedClassCode)
      : rawStudents;

    const byUid = new Map();
    entries.forEach(entry => {
      byUid.set(entry.uid, {
        uid: entry.uid,
        displayName: entry.displayName || 'Anonymous',
        totalXP: entry.totalXP || 0
      });
    });
    students.forEach(student => {
      const existing = byUid.get(student.uid);
      const progressXP = allProgress[student.uid]?.totalXP || 0;
      byUid.set(student.uid, {
        uid: student.uid,
        displayName: existing?.displayName || student.displayName || student.email || 'Anonymous',
        totalXP: Math.max(existing?.totalXP || 0, progressXP)
      });
    });

    const rows = [...byUid.values()].sort((a, b) =>
      (b.totalXP || 0) - (a.totalXP || 0) ||
      String(a.displayName || '').localeCompare(String(b.displayName || ''))
    );

    if (!rows.length) {
      target.innerHTML = '<p class="lb-empty">No students found for this class yet.</p>';
      return;
    }

    target.innerHTML = rows.map((e, i) => `
      <div class="lb-row ${e.uid === this.uid ? 'lb-row--me' : ''}">
        <span class="lb-rank">${i + 1}</span>
        <span class="lb-name">${esc(e.displayName || 'Anonymous')}</span>
        <span class="lb-xp">${e.totalXP || 0} XP</span>
      </div>`).join('');
  }
}

function formatInstructionText(text) {
  const lines = String(text || '').trim().split('\n');
  const blocks = [];
  let paragraph = [];
  let listType = '';
  let listItems = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(`<p>${formatInlineText(paragraph.join(' '))}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (!listItems.length) return;
    blocks.push(`<${listType}>${listItems.map(item => `<li>${formatInlineText(item)}</li>`).join('')}</${listType}>`);
    listItems = [];
    listType = '';
  };

  lines.forEach(rawLine => {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
      return;
    }

    const bullet = line.match(/^-\s+(.+)$/);
    const numbered = line.match(/^\d+\.\s+(.+)$/);

    if (bullet) {
      flushParagraph();
      if (listType && listType !== 'ul') flushList();
      listType = 'ul';
      listItems.push(bullet[1]);
      return;
    }

    if (numbered) {
      flushParagraph();
      if (listType && listType !== 'ol') flushList();
      listType = 'ol';
      listItems.push(numbered[1]);
      return;
    }

    flushList();
    paragraph.push(line);
  });

  flushParagraph();
  flushList();

  return blocks.join('');
}

function validateCreatedTables(sql, db) {
  const statements = [...String(sql || '').matchAll(/create\s+table\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([\s\S]*?)\)\s*;?/gi)];
  const messages = [];

  if (/\bCHAR\b(?!ACTER)\b/i.test(String(sql || ''))) {
    messages.push('Use CHARACTER instead of CHAR for this course.');
  }

  statements.forEach(([, tableName, body]) => {
    const info = tableInfoForValidation(db, tableName);
    const pkCols = info.filter(col => col.pk);
    const createSQL = getCreateTableSQL(db, tableName);
    const columnBlock = extractColumnBlock(createSQL) || body;

    if (!pkCols.length) {
      messages.push(`${tableName} must include at least one primary key field.`);
      return;
    }

    pkCols.forEach(col => {
      if (!columnIsDeclaredNotNull(columnBlock, col.name)) {
        messages.push(`${tableName}.${col.name} must be marked NOT NULL as well as PRIMARY KEY.`);
      }
    });
  });

  return { messages };
}

function tableInfoForValidation(db, tableName) {
  try {
    const rows = db.exec(`PRAGMA table_info("${tableName}")`);
    if (!rows.length) return [];
    return rows[0].values.map(row => ({
      name: row[1],
      pk: !!row[5]
    }));
  } catch {
    return [];
  }
}

function columnIsDeclaredNotNull(body, columnName) {
  const escaped = escapeRegExp(columnName);
  const lines = body.split(',');
  const columnDef = lines.find(line => new RegExp(`^\\s*${escaped}\\b`, 'i').test(line.trim()));
  return columnDef ? /\bnot\s+null\b/i.test(columnDef) : false;
}

function getCreateTableSQL(db, tableName) {
  try {
    const rows = db.exec(`SELECT sql FROM sqlite_master WHERE type='table' AND LOWER(name)=LOWER('${tableName}')`);
    return rows.length ? String(rows[0].values[0][0] || '') : '';
  } catch {
    return '';
  }
}

function extractColumnBlock(createSQL) {
  if (!createSQL) return '';
  const start = createSQL.indexOf('(');
  if (start === -1) return '';

  let depth = 0;
  for (let i = start; i < createSQL.length; i++) {
    const ch = createSQL[i];
    if (ch === '(') depth++;
    if (ch === ')') {
      depth--;
      if (depth === 0) {
        return createSQL.slice(start + 1, i);
      }
    }
  }
  return '';
}

function formatInlineText(text) {
  const spans = [];
  let s = redactSQLExamples(String(text ?? '')).replace(/`([^`]+)`/g, (_, content) => {
    spans.push(formatCodeLikeText(content));
    return `\x02${spans.length - 1}\x02`;
  });
  let html = esc(s);
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/&lt;em&gt;(.*?)&lt;\/em&gt;/g, '<em>$1</em>');
  html = html.replace(/\x02(\d+)\x02/g, (_, i) => spans[i]);
  return html;
}

function redactSQLExamples(text) {
  let cleaned = String(text ?? '');
  const replacements = [
    { regex: /\bCREATE\s+DATABASE\s+[A-Za-z_][A-Za-z0-9_]*\b;?/gi, replacement: 'the required create database statement' },
    { regex: /\bCREATE\s+TABLE\s+[A-Za-z_][A-Za-z0-9_]*\s*\([\s\S]*?\)\s*;?/gi, replacement: 'the required create table statement' },
    { regex: /\bALTER\s+TABLE\s+[A-Za-z_][A-Za-z0-9_]*\s+ADD(?:\s+COLUMN)?\s+[A-Za-z_][A-Za-z0-9_]*[\sA-Za-z0-9_(),.]*;?/gi, replacement: 'the required alter table statement' },
    { regex: /\bINSERT\s+INTO\b[\s\S]*?\bVALUES\b[\s\S]*?(?=$|[.;])/gi, replacement: 'the required insert statement' },
    { regex: /\bUPDATE\b[\s\S]*?\bSET\b[\s\S]*?(?=$|[.;])/gi, replacement: 'the required update statement' },
    { regex: /\bDELETE\s+FROM\b[\s\S]*?(?=$|[.;])/gi, replacement: 'the required delete statement' },
    { regex: /\bSELECT\s+(?:\*|[A-Za-z_][A-Za-z0-9_.]*(?:\s*,\s*[A-Za-z_][A-Za-z0-9_.]*)*)\s+FROM\s+[A-Za-z_][A-Za-z0-9_]*(?:\s+(?:WHERE|GROUP\s+BY|ORDER\s+BY|INNER\s+JOIN|JOIN|LIMIT)\b[\s\S]*?)?(?=$|[.;])/gi, replacement: 'the required select query' },
    { regex: /\bINNER\s+JOIN\b[\s\S]*?\bON\b[\s\S]*?(?=$|[.;])/gi, replacement: 'the required inner join using the matching key fields' },
    { regex: /\bFOREIGN\s+KEY\s*\([\s\S]*?\)\s*REFERENCES\s*[A-Za-z_][A-Za-z0-9_]*\s*\([\s\S]*?\)/gi, replacement: 'the required foreign key constraint using the specified linked fields' }
  ];

  replacements.forEach(({ regex, replacement }) => {
    cleaned = cleaned.replace(regex, replacement);
  });

  return cleaned
    .replace(/Syntax:\s*the required/gi, 'Use the required')
    .replace(/Add:\s*the required/gi, 'Add the required')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function formatCodeLikeText(content) {
  const tokens = String(content).match(/[A-Za-z_][A-Za-z0-9_.]*|\d+|[^\s]/g) || [];
  const formatted = tokens.map(token => {
    if (/^[A-Za-z_][A-Za-z0-9_.]*$/.test(token)) {
      return SQL_TERMS.has(token.toLowerCase())
        ? token.toLowerCase()
        : `<span class="ch-ident">${esc(token)}</span>`;
    }
    return esc(token);
  }).join(' ')
    .replace(/\s+([,.;:)])/g, '$1')
    .replace(/([(/])\s+/g, '$1');
  return `<span class="ch-inline-note">${formatted}</span>`;
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escAttr(value) {
  return esc(value).replace(/"/g, '&quot;');
}

function normalizeClassCode(value) {
  return String(value || '').replace(/\s+/g, '').toUpperCase();
}

function normalizeClassNames(classNames) {
  const normalized = {};
  Object.entries(classNames || {}).forEach(([rawCode, rawName]) => {
    const code = normalizeClassCode(rawCode);
    if (!code) return;
    const name = String(rawName || '').trim();
    if (!normalized[code] || name.replace(/\s+/g, '').toUpperCase() === code) {
      normalized[code] = name || code;
    }
  });
  return normalized;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
