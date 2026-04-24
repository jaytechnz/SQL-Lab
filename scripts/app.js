// ─── Main Application ─────────────────────────────────────────────────────────
// SQL Lab — Cambridge AS Computer Science 9618

import { onAuth, signIn, registerUser, signOutUser, resetPassword, updateUserClassCode } from './auth.js';
import { ChallengeManager } from './challenges.js';
import { renderDashboard, refreshDashboard } from './dashboard.js';
import { initSQLEngine, createDatabase, executeSQL, getSchema, previewTable } from './sql-engine.js';
import { DATABASES, DATABASE_LIST, getDatabaseById } from './databases.js';
import { EXERCISES, CATEGORIES } from './exercises.js';
import { submitFeedback, getMyFeedback, getAllFeedback } from './storage.js';

const $ = id => document.getElementById(id);

// ── State ─────────────────────────────────────────────────────────────────────

let _SQL           = null;
let _user          = null;
let _profile       = null;
let _challengeMgr  = null;
let _activeDatabaseId = 'bookshop';  // currently selected built-in database
let _sandboxDb     = null;           // persistent sandbox database instance
let _queryHistory  = [];

// ── DOM refs ───────────────────────────────────────────────────────────────────

const loginPage     = $('login-page');
const appEl         = $('app');
const editor        = $('sql-editor');
const btnRun        = $('btn-run');
const btnClear      = $('btn-clear');
const resultsTable  = $('results-table-wrap');
const messagesPanel = $('messages-panel');
const historyPanel  = $('history-panel');
const schemaPanel   = $('schema-panel');
const erPanel       = $('er-panel');

// ══════════════════════════════════════════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════════════════════════════════════════

onAuth(async (user, profile) => {
  if (!user || !profile) {
    showLogin(); return;
  }
  _user    = user;
  _profile = profile;
  await showApp();
});

function showLogin() {
  loginPage?.classList.remove('hidden');
  appEl?.classList.add('hidden');
}

function setBusyButton(btn, busy, busyLabel, idleLabel) {
  if (!btn) return;
  btn.disabled = busy;
  btn.classList.toggle('is-loading', busy);
  btn.textContent = busy ? busyLabel : idleLabel;
}

function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.querySelectorAll('.auth-form').forEach(form => {
    form.classList.toggle('active', form.id === `${tab}-form`);
  });
}

async function showApp() {
  loginPage?.classList.add('hidden');
  appEl?.classList.remove('hidden');

  $('user-name-display').textContent  = _profile.displayName || _user.email;
  $('user-role-badge').textContent    = { superadmin: 'Superadmin', teacher: 'Teacher', student: 'Student' }[_profile.role] ?? 'Student';
  $('user-role-badge').className      = `role-badge role-${_profile.role}`;
  $('status-class-code').textContent  = _profile.classCode || '—';

  const isTeacher = ['teacher','superadmin'].includes(_profile.role);
  document.querySelectorAll('.teacher-only').forEach(el => el.classList.toggle('hidden', !isTeacher));
  document.querySelectorAll('.student-only').forEach(el => el.classList.toggle('hidden', isTeacher));

  // Init challenge manager — renders from localStorage immediately, loads
  // Firestore progress and SQL engine concurrently inside init()
  _challengeMgr = new ChallengeManager({
    onXpChange: (xp, level) => {
      $('ch-xp-display').textContent    = `${xp} XP`;
      $('ch-level-display').textContent = `Level ${level}`;
    },
    onMessage: (msgs, passed) => showMessages(msgs, passed),
    onResults: (result) => renderResultTable(result.columns, result.rows),
    onSchema:  (schema) => renderSchemaResult(schema),
    onError:   (err)    => showError(err)
  });
  await _challengeMgr.init(_user.uid, _profile.classCode || '', _profile.displayName || '');

  // SQL engine is now cached by init(); grab the reference for sandbox/schema use
  _SQL = await initSQLEngine();

  // Load initial database and create persistent sandbox
  setActiveDatabase('bookshop');
  resetSandboxDB();
}

// ── Login form handlers ────────────────────────────────────────────────────────

$('signin-form')?.addEventListener('submit', async e => {
  e.preventDefault();
  const email = $('signin-email').value.trim();
  const pw    = $('signin-password').value;
  const btn   = $('signin-btn');
  const err   = $('signin-error');
  err.classList.add('hidden');
  setBusyButton(btn, true, 'Signing In...', 'Sign In');
  try {
    await signIn(email, pw);
  } catch (ex) {
    err.textContent = ex.message;
    err.classList.remove('hidden');
  } finally {
    setBusyButton(btn, false, 'Signing In...', 'Sign In');
  }
});

$('signup-form')?.addEventListener('submit', async e => {
  e.preventDefault();
  const name  = $('signup-name').value.trim();
  const email = $('signup-email').value.trim();
  const code  = $('signup-classcode').value.trim();
  const pw    = $('signup-password').value;
  const btn   = $('signup-btn');
  const err   = $('signup-error');
  err.classList.add('hidden');
  setBusyButton(btn, true, 'Creating Account...', 'Create Account');
  try {
    await registerUser(email, pw, name, code);
    $('signup-form')?.reset();
    $('signup-error')?.classList.add('hidden');
    switchAuthTab('signin');
    $('signin-email').value = email;
    $('signin-password').value = '';
  } catch (ex) {
    err.textContent = ex.message;
    err.classList.remove('hidden');
  } finally {
    setBusyButton(btn, false, 'Creating Account...', 'Create Account');
  }
});

// Auth tabs
document.querySelectorAll('.auth-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    switchAuthTab(btn.dataset.tab);
  });
});

$('forgot-password-btn')?.addEventListener('click', () => {
  $('reset-panel')?.classList.remove('hidden');
});
$('reset-cancel-btn')?.addEventListener('click', () => {
  $('reset-panel')?.classList.add('hidden');
});
$('reset-submit-btn')?.addEventListener('click', async () => {
  const email = $('reset-email').value.trim();
  const err   = $('reset-error');
  err.classList.add('hidden');
  try {
    await resetPassword(email);
    $('reset-panel').classList.add('hidden');
    alert('Password reset email sent. Check your inbox.');
  } catch (ex) {
    err.textContent = ex.message;
    err.classList.remove('hidden');
  }
});

// Password visibility toggle
document.querySelectorAll('.pw-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const inp = $(btn.dataset.target);
    if (!inp) return;
    const show = inp.type === 'text';
    inp.type = show ? 'text' : 'text'; // always text to preserve value
    inp.classList.toggle('pw-masked', show);
    btn.querySelector('.pw-eye')?.classList.toggle('hidden', !show);
    btn.querySelector('.pw-eye-off')?.classList.toggle('hidden', show);
  });
});

$('btn-logout')?.addEventListener('click', async () => {
  await signOutUser();
  window.location.reload();
});

// ── Class code modal ───────────────────────────────────────────────────────────

$('btn-class-code')?.addEventListener('click', () => {
  $('class-input').value = _profile.classCode || '';
  $('class-modal')?.classList.remove('hidden');
});
$('class-cancel')?.addEventListener('click', () => $('class-modal')?.classList.add('hidden'));
$('class-confirm')?.addEventListener('click', async () => {
  const code = $('class-input').value.trim().toUpperCase();
  await updateUserClassCode(_user.uid, code);
  _profile.classCode = code;
  $('status-class-code').textContent = code || '—';
  $('class-modal')?.classList.add('hidden');
});

// ══════════════════════════════════════════════════════════════════════════════
// SQL EDITOR
// ══════════════════════════════════════════════════════════════════════════════

// SQL keywords — shared between auto-uppercase and syntax highlighting
const SQL_KEYWORDS_RE = /\b(SELECT|FROM|WHERE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|DATABASE|ALTER|ADD|DROP|COLUMN|PRIMARY|KEY|FOREIGN|REFERENCES|INNER|LEFT|RIGHT|OUTER|FULL|CROSS|JOIN|ON|ORDER|BY|GROUP|HAVING|DISTINCT|AS|AND|OR|NOT|NULL|IS|IN|BETWEEN|LIKE|COUNT|SUM|AVG|MAX|MIN|ASC|DESC|LIMIT|OFFSET|UNION|ALL|EXCEPT|INTERSECT|CASE|WHEN|THEN|ELSE|END|IF|EXISTS|UNIQUE|CHECK|DEFAULT|CONSTRAINT|INTEGER|VARCHAR|CHARACTER|BOOLEAN|REAL|DATE|TIME|INT|TEXT|NUMERIC)\b/gi;

function autoUppercaseKeywords() {
  if (!editor) return;
  const start  = editor.selectionStart;
  const end    = editor.selectionEnd;
  const newVal = editor.value.replace(SQL_KEYWORDS_RE, m => m.toUpperCase());
  if (newVal !== editor.value) {
    editor.value = newVal;
    editor.setSelectionRange(start, end);
  }
}

// SQL keyword syntax highlighting (simple overlay approach)
function highlightSQL(code) {
  const keywords = SQL_KEYWORDS_RE;
  const strings  = /'[^']*'/g;
  const comments = /--[^\n]*/g;
  const numbers  = /\b\d+(\.\d+)?\b/g;

  return code
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(comments, m => `<span class="syn-cmt">${m}</span>`)
    .replace(strings,  m => `<span class="syn-str">${m}</span>`)
    .replace(keywords, m => `<span class="syn-kw">${m}</span>`)
    .replace(numbers,  m => `<span class="syn-num">${m}</span>`);
}

editor?.addEventListener('input', e => {
  // Auto-uppercase on paste; word-by-word uppercasing is handled in keyup
  if (e.inputType === 'insertFromPaste') autoUppercaseKeywords();
  updateHighlight();
  updateLineNumbers();
});

// Uppercase completed keywords when the user finishes a word
const WORD_ENDERS = new Set([' ', ';', '(', ')', ',', 'Enter']);
editor?.addEventListener('keyup', e => {
  if (WORD_ENDERS.has(e.key)) {
    autoUppercaseKeywords();
    updateHighlight();
  }
});

editor?.addEventListener('scroll', () => {
  const hl = $('editor-highlight');
  const gutter = $('editor-gutter');
  if (hl) { hl.scrollTop = editor.scrollTop; hl.scrollLeft = editor.scrollLeft; }
  if (gutter) gutter.scrollTop = editor.scrollTop;
});
editor?.addEventListener('keydown', e => {
  // Tab inserts 4 spaces
  if (e.key === 'Tab') {
    e.preventDefault();
    const start = editor.selectionStart;
    const end   = editor.selectionEnd;
    editor.value = editor.value.slice(0, start) + '    ' + editor.value.slice(end);
    editor.selectionStart = editor.selectionEnd = start + 4;
    updateHighlight();
    updateLineNumbers();
  }
  // Ctrl/Cmd + Enter = Run (must come before plain Enter handler)
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    executeQuery();
    return;
  }
  // Enter: auto-indent to match current line; extra indent after (
  if (e.key === 'Enter') {
    e.preventDefault();
    const pos       = editor.selectionStart;
    const text      = editor.value;
    const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
    const curLine   = text.slice(lineStart, pos);
    const indent    = curLine.match(/^(\s*)/)[1];
    const extra     = curLine.trimEnd().endsWith('(') ? '    ' : '';
    const insertion = '\n' + indent + extra;
    editor.value = text.slice(0, pos) + insertion + text.slice(editor.selectionEnd);
    editor.selectionStart = editor.selectionEnd = pos + insertion.length;
    updateHighlight();
    updateLineNumbers();
  }
  // ) dedents by one level when it is the first non-whitespace on the line
  if (e.key === ')') {
    const pos       = editor.selectionStart;
    const text      = editor.value;
    const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
    const before    = text.slice(lineStart, pos);
    if (before.length > 0 && /^\s+$/.test(before)) {
      e.preventDefault();
      const remove  = Math.min(4, before.length);
      editor.value  = text.slice(0, lineStart) + before.slice(remove) + ')' + text.slice(pos);
      editor.selectionStart = editor.selectionEnd = lineStart + before.length - remove + 1;
      updateHighlight();
      updateLineNumbers();
    }
  }
  // Ctrl/Cmd + L = clear
  if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
    e.preventDefault();
    editor.value = '';
    updateHighlight();
    updateLineNumbers();
  }
});

function updateHighlight() {
  const hl = $('editor-highlight');
  if (hl) hl.innerHTML = highlightSQL(editor.value) + '\n';
}

function updateLineNumbers() {
  const gutter = $('editor-gutter');
  if (!gutter) return;
  const lines = (editor.value.match(/\n/g) || []).length + 1;
  gutter.innerHTML = Array.from({length: lines}, (_, i) => `<div>${i+1}</div>`).join('');
}

// ── Run button ─────────────────────────────────────────────────────────────────

btnRun?.addEventListener('click', executeQuery);
btnClear?.addEventListener('click', () => {
  clearResults();
  messagesPanel.innerHTML = '';
});
$('btn-new-query')?.addEventListener('click', () => {
  editor.value = '';
  updateHighlight();
  updateLineNumbers();
  clearResults();
});

async function executeQuery() {
  const sql = editor.value.trim();
  if (!sql) return;

  // If a challenge is active, run in challenge mode
  if (_challengeMgr?.getCurrentExercise()) {
    btnRun.disabled = true;
    btnRun.textContent = 'Running…';
    try {
      await _challengeMgr.runChallenge(sql);
    } finally {
      btnRun.disabled = false;
      btnRun.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Run SQL';
    }
    addToHistory(sql, true);
    return;
  }

  // Sandbox mode — runs against the persistent _sandboxDb so CREATE TABLE persists
  btnRun.disabled = true;
  btnRun.innerHTML = '<span>Running…</span>';
  try {
    if (!_sandboxDb) resetSandboxDB();
    if (!_sandboxDb) { showError('SQL engine not ready — please wait a moment and try again.'); return; }

    const { results, error, rowsAffected } = executeSQL(_sandboxDb, sql);
    if (error) {
      showError(error);
    } else {
      clearResults();
      const selectResults = results.filter(r => r.columns.length);
      if (selectResults.length) {
        selectResults.forEach(r => renderResultTable(r.columns, r.rows));
      } else {
        showMessages([`OK — ${rowsAffected ?? 0} row${rowsAffected === 1 ? '' : 's'} affected.`], true);
      }
    }
    addToHistory(sql, !error);
  } finally {
    btnRun.disabled = false;
    btnRun.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Run SQL';
  }
}

// ── Results panel ──────────────────────────────────────────────────────────────

function renderResultTable(columns, rows) {
  const wrap = $('results-table-wrap');
  if (!wrap) return;
  wrap.classList.remove('hidden');
  $('results-placeholder')?.classList.add('hidden');

  const thead = `<thead><tr>${columns.map(c => `<th>${esc(String(c))}</th>`).join('')}</tr></thead>`;
  const tbody = `<tbody>${rows.map(row =>
    `<tr>${row.map(cell => `<td>${esc(cell === null ? '<em>NULL</em>' : String(cell))}</td>`).join('')}</tr>`
  ).join('')}</tbody>`;

  const table = document.createElement('table');
  table.className = 'result-table';
  table.innerHTML = thead + tbody;

  const info = document.createElement('div');
  info.className = 'result-info';
  info.textContent = `${rows.length} row${rows.length !== 1 ? 's' : ''}`;

  wrap.innerHTML = '';
  wrap.appendChild(info);
  wrap.appendChild(table);

  // Switch to results tab
  switchOutputTab('results');
  revealOutputFeedback();
}

function showMessages(msgs, passed) {
  const panel = $('messages-panel');
  if (!panel) return;
  const icon = passed ? '✓' : '✗';
  const cls  = passed ? 'msg-pass' : 'msg-fail';
  panel.innerHTML = `<div class="msg-block ${cls}">
    <span class="msg-icon">${icon}</span>
    <div>${msgs.map(m => `<div class="msg-line">${m}</div>`).join('')}</div>
  </div>`;
  switchOutputTab('messages');
  revealOutputFeedback();
}

function showError(err) {
  const panel = $('messages-panel');
  if (!panel) return;
  panel.innerHTML = `<div class="msg-block msg-error">
    <span class="msg-icon">!</span>
    <div class="msg-line"><strong>SQL Error:</strong> ${esc(err)}</div>
  </div>`;
  switchOutputTab('messages');
  revealOutputFeedback();
}

function clearResults() {
  const wrap = $('results-table-wrap');
  if (wrap) { wrap.innerHTML = ''; wrap.classList.add('hidden'); }
  $('results-placeholder')?.classList.remove('hidden');
}

function renderSchemaResult(schema) {
  const wrap = $('results-table-wrap');
  if (!wrap) return;
  $('results-placeholder')?.classList.add('hidden');
  wrap.classList.remove('hidden');

  if (!schema || !schema.length) {
    wrap.innerHTML = '<p class="output-empty">No tables found yet. Check your table-building work for errors.</p>';
    renderERDiagramPanel([]);
    switchOutputTab('results');
    revealOutputFeedback();
    return;
  }

  wrap.innerHTML = schema.map(t => `
    <div class="schema-result-section">
      <div class="schema-result-header">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
        <strong>TABLE: ${esc(t.name)}</strong>
      </div>
      <table class="result-table">
        <thead><tr><th>Field</th><th>Type</th><th>Constraints</th></tr></thead>
        <tbody>
          ${t.columns.map(c => {
            const fk = t.foreignKeys.find(f => f.fromColumn === c.name);
            const badges = [
              c.primaryKey ? '<span class="key-badge key-pk">PRIMARY KEY</span>' : '',
              c.notNull && !c.primaryKey ? 'NOT NULL' : '',
              fk ? `<span class="key-badge key-fk">FK → ${esc(fk.referencedTable)}.${esc(fk.toColumn)}</span>` : ''
            ].filter(Boolean).join(' ');
            return `<tr>
              <td>${esc(c.name)}</td>
              <td class="col-type">${esc(c.type)}</td>
              <td>${badges || '—'}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`).join('');

  // Mirror into schema tab so the student can reference it while editing
  const schemaPanel = $('schema-panel');
  if (schemaPanel) {
    schemaPanel.innerHTML = schema.map(t => `
      <div class="schema-table">
        <div class="schema-table-header">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
          <strong>${esc(t.name)}</strong>
        </div>
        <table class="schema-cols">
          <thead><tr><th>Field</th><th>Type</th><th>Key</th></tr></thead>
          <tbody>
            ${t.columns.map(c => `<tr>
              <td>${esc(c.name)}</td>
              <td class="col-type">${esc(c.type)}</td>
              <td>${c.primaryKey ? '<span class="key-badge key-pk">PK</span>' : ''}${t.foreignKeys.some(f => f.fromColumn === c.name) ? '<span class="key-badge key-fk">FK</span>' : ''}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`).join('');
  }

  renderERDiagramPanel(schema);

  switchOutputTab('results');
  revealOutputFeedback();
}

function buildRelationshipSummary(schema) {
  return schema.flatMap(table =>
    (table.foreignKeys || []).map(fk => {
      const referencedTable = schema.find(candidate => candidate.name === fk.referencedTable);
      const sourceColumn = table.columns.find(column => column.name === fk.fromColumn);
      const targetColumn = referencedTable?.columns.find(column => column.name === fk.toColumn);
      const sourceIsUnique = Boolean(sourceColumn?.primaryKey);
      const targetIsUnique = Boolean(targetColumn?.primaryKey);
      const relationship = sourceIsUnique && targetIsUnique ? 'one-to-one' : 'one-to-many';

      return `
        <div class="er-relationship">
          <strong>${esc(fk.referencedTable)}</strong>.${esc(fk.toColumn)}
          ${relationship}
          <strong>${esc(table.name)}</strong>.${esc(fk.fromColumn)}
        </div>`;
    })
  );
}

function buildERDiagramHTML(schema, emptyMessage = 'Run your work to generate an E-R diagram for linked tables.') {
  const relationships = buildRelationshipSummary(schema);
  const hasLinkedTables = schema.length >= 2 && relationships.length > 0;

  if (!hasLinkedTables) {
    return `
      <div class="er-panel-wrap">
        <p class="output-empty">${esc(emptyMessage)}</p>
      </div>`;
  }

  const tablesHtml = schema.map(table => `
    <div class="er-table">
      <div class="er-table-name">${esc(table.name)}</div>
      ${(table.columns || []).map(column => {
        const foreignKey = (table.foreignKeys || []).find(fk => fk.fromColumn === column.name);
        const isPrimaryKey = Boolean(column.primaryKey);
        const isForeignKey = Boolean(foreignKey);
        const keyIcon = isPrimaryKey ? 'PK' : isForeignKey ? 'FK' : '';

        return `<div class="er-col ${isPrimaryKey ? 'er-pk' : ''} ${isForeignKey ? 'er-fk' : ''}">
          <span class="er-key-icon">${keyIcon}</span>
          <span class="er-col-name">${esc(column.name)}</span>
          <span class="er-col-type">${esc(column.type)}</span>
          ${foreignKey ? `<span class="er-fk-ref">→ ${esc(foreignKey.referencedTable)}.${esc(foreignKey.toColumn)}</span>` : ''}
        </div>`;
      }).join('')}
    </div>`).join('');

  return `
    <div class="er-panel-wrap">
      <p class="er-panel-note">The diagram below is generated from your current tables and foreign key fields.</p>
      <div class="er-diagram">${tablesHtml}</div>
      <div class="er-relationships">${relationships.join('')}</div>
    </div>`;
}

function renderERDiagramPanel(schema, emptyMessage) {
  if (!erPanel) return;
  erPanel.innerHTML = buildERDiagramHTML(schema || [], emptyMessage);
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Output tabs ────────────────────────────────────────────────────────────────

document.querySelectorAll('.output-tab').forEach(btn => {
  btn.addEventListener('click', () => switchOutputTab(btn.dataset.tab));
});

function switchOutputTab(tab) {
  document.querySelectorAll('.output-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.output-pane').forEach(p => p.classList.toggle('hidden', p.id !== `output-${tab}`));
}

function revealOutputFeedback() {
  const panel = $('output-panel');
  if (!panel) return;
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── Query history ──────────────────────────────────────────────────────────────

function addToHistory(sql, success) {
  _queryHistory.unshift({ sql, success, time: new Date().toLocaleTimeString() });
  if (_queryHistory.length > 50) _queryHistory.pop();
  renderHistory();
}

function renderHistory() {
  const panel = $('history-panel');
  if (!panel) return;
  if (!_queryHistory.length) {
    panel.innerHTML = '<p class="output-empty">No queries yet.</p>';
    return;
  }
  panel.innerHTML = _queryHistory.map((h, i) => `
    <div class="history-item ${h.success ? 'history-ok' : 'history-err'}" data-idx="${i}">
      <span class="history-time">${h.time}</span>
      <code class="history-sql">${esc(h.sql.slice(0, 80))}${h.sql.length > 80 ? '…' : ''}</code>
    </div>`).join('');

  panel.querySelectorAll('.history-item').forEach(item => {
    item.addEventListener('click', () => {
      const h = _queryHistory[item.dataset.idx];
      if (h) {
        editor.value = h.sql;
        updateHighlight();
        updateLineNumbers();
      }
    });
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// DATABASE SELECTOR & SCHEMA VIEWER
// ══════════════════════════════════════════════════════════════════════════════

function setActiveDatabase(id) {
  _activeDatabaseId = id;
  const db = getDatabaseById(id);
  if (!db) return;
  $('active-db-label').textContent = `${db.icon} ${db.label}`;
  renderSchemaForDatabase(id);
}

function renderSchemaForDatabase(dbId) {
  const panel = $('schema-panel');
  if (!panel) return;
  const dbDef = getDatabaseById(dbId);
  if (!dbDef || !_SQL) return;

  let dbInst;
  try {
    dbInst = createDatabase(_SQL, dbDef.setupSQL);
  } catch { return; }

  const schema = getSchema(dbInst);
  dbInst.close();

  panel.innerHTML = schema.map(t => `
    <div class="schema-table">
      <div class="schema-table-header">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
        <strong>${t.name}</strong>
        <span class="schema-row-count">(${countRows(dbId, t.name)} rows)</span>
      </div>
      <table class="schema-cols">
        <thead><tr><th>Field</th><th>Type</th><th>Key</th></tr></thead>
        <tbody>
          ${t.columns.map(c => `<tr>
            <td>${c.name}</td>
            <td class="col-type">${c.type}</td>
            <td>${c.primaryKey ? '<span class="key-badge key-pk">PK</span>' : ''}${t.foreignKeys.some(f=>f.fromColumn===c.name) ? '<span class="key-badge key-fk">FK</span>' : ''}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`).join('');

  renderERDiagramPanel(schema, 'No linked tables found in this database.');
}

function countRows(dbId, tableName) {
  if (!_SQL) return '?';
  const dbDef = getDatabaseById(dbId);
  if (!dbDef) return '?';
  try {
    const db = createDatabase(_SQL, dbDef.setupSQL);
    const r  = db.exec(`SELECT COUNT(*) FROM "${tableName}"`);
    db.close();
    return r.length ? r[0].values[0][0] : 0;
  } catch { return '?'; }
}

function resetSandboxDB() {
  if (_sandboxDb) { try { _sandboxDb.close(); } catch {} _sandboxDb = null; }
  if (!_SQL) return;
  const dbDef = getDatabaseById(_activeDatabaseId);
  try {
    _sandboxDb = createDatabase(_SQL, dbDef ? dbDef.setupSQL : '');
  } catch (e) {
    console.error('Sandbox DB init failed:', e.message);
  }
}

// Database selector dropdown
$('db-select')?.addEventListener('change', e => {
  setActiveDatabase(e.target.value);
  resetSandboxDB();
});

// Schema browser button
$('btn-schema')?.addEventListener('click', () => switchOutputTab('schema'));

// Database viewer modal
$('btn-db-viewer')?.addEventListener('click', () => openDBViewer());
$('btn-close-db-viewer')?.addEventListener('click', () => $('db-viewer-modal')?.classList.add('hidden'));

function openDBViewer() {
  const modal = $('db-viewer-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  renderDBViewer();
}

function renderDBViewer() {
  const tabs  = $('db-viewer-tabs');
  const body  = $('db-viewer-body');
  if (!tabs || !body) return;

  tabs.innerHTML = DATABASE_LIST.map(db =>
    `<button class="db-viewer-tab" data-id="${db.id}">${db.icon} ${db.label}</button>`
  ).join('');

  const firstTab = tabs.querySelector('.db-viewer-tab');
  if (firstTab) {
    firstTab.classList.add('active');
    renderDBViewerContent(firstTab.dataset.id, body);
  }

  tabs.querySelectorAll('.db-viewer-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      tabs.querySelectorAll('.db-viewer-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderDBViewerContent(btn.dataset.id, body);
    });
  });
}

function renderDBViewerContent(dbId, body) {
  if (!_SQL) { body.innerHTML = '<p>SQL engine loading…</p>'; return; }
  const dbDef = getDatabaseById(dbId);
  if (!dbDef) return;

  let dbInst;
  try { dbInst = createDatabase(_SQL, dbDef.setupSQL); } catch { return; }
  const schema = getSchema(dbInst);
  const erHtml = buildERDiagramHTML(schema, 'No linked tables found in this database.');

  // Table previews
  let previewHtml = '<div class="db-previews">';
  schema.forEach(t => {
    const preview = previewTable(dbInst, t.name, 5);
    previewHtml += `<details class="db-preview-section">
      <summary>${t.name} <span class="preview-count">(first ${Math.min(5, preview.rows.length)} rows)</span></summary>
      <div class="preview-scroll">
        <table class="preview-table">
          <thead><tr>${preview.columns.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead>
          <tbody>${preview.rows.map(row=>`<tr>${row.map(v=>`<td>${esc(v===null?'NULL':String(v))}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
      </div>
    </details>`;
  });
  previewHtml += '</div>';

  dbInst.close();

  body.innerHTML = `
    <div class="db-viewer-info">
      <strong>${dbDef.icon} ${dbDef.label}</strong> — ${dbDef.description}
    </div>
    ${erHtml}
    ${previewHtml}`;
}

// ══════════════════════════════════════════════════════════════════════════════
// SIDEBAR TABS
// ══════════════════════════════════════════════════════════════════════════════

document.querySelectorAll('.sidebar-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    const view = btn.dataset.view;
    document.querySelectorAll('.sidebar-tab').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    $('sidebar-challenges-view')?.classList.toggle('hidden', view !== 'challenges');
    $('sidebar-ref-view')?.classList.toggle('hidden', view !== 'reference');
  });
});

// Explorer / Reference panel toggles
$('btn-close-explorer')?.addEventListener('click', () => {
  $('sidebar')?.classList.add('sidebar--collapsed');
  $('btn-explorer')?.classList.remove('active');
});
$('btn-explorer')?.addEventListener('click', () => {
  $('sidebar')?.classList.toggle('sidebar--collapsed');
  $('btn-explorer')?.classList.toggle('active');
});
$('btn-ref-panel')?.addEventListener('click', () => {
  $('ref-panel')?.classList.toggle('ref-panel--open');
});
$('btn-close-ref')?.addEventListener('click', () => {
  $('ref-panel')?.classList.remove('ref-panel--open');
});

// ══════════════════════════════════════════════════════════════════════════════
// CHALLENGE EVENTS
// ══════════════════════════════════════════════════════════════════════════════

document.addEventListener('challenge:open', e => {
  const ex = e.detail;

  // Load last-run SQL if available, otherwise starter code
  editor.value = ex.savedSQL || ex.starterCode || '';
  updateHighlight();
  updateLineNumbers();

  const dbSelect = $('db-select');
  const dbLabel  = $('active-db-label');

  if (ex.database) {
    // DML challenge — lock selector to the pre-built database
    _activeDatabaseId = ex.database;
    if (dbSelect) { dbSelect.value = ex.database; dbSelect.disabled = true; }
    const dbDef = getDatabaseById(ex.database);
    if (dbLabel) dbLabel.textContent = `${dbDef?.icon || '🗄️'} ${dbDef?.label || ex.database}`;
    renderSchemaForDatabase(ex.database);
  } else {
    // DDL / combined — student creates their own schema; disable selector
    if (dbSelect) dbSelect.disabled = true;
    if (dbLabel) dbLabel.textContent = '🗄️ Empty Sandbox';
    const schemaPanel = $('schema-panel');
    if (schemaPanel) schemaPanel.innerHTML = '<p class="output-empty">Run your work to see the structure you create.</p>';
    renderERDiagramPanel([], 'Run your work to generate an E-R diagram for linked tables.');
  }

  clearResults();
  $('messages-panel').innerHTML = '';

  // Switch sidebar to challenges view
  const chTab = document.querySelector('.sidebar-tab[data-view="challenges"]');
  chTab?.click();
});

document.addEventListener('challenge:close', () => {
  const dbSelect = $('db-select');
  if (dbSelect) { dbSelect.disabled = false; dbSelect.value = _activeDatabaseId; }
  const dbDef = getDatabaseById(_activeDatabaseId);
  const dbLabel = $('active-db-label');
  if (dbLabel) dbLabel.textContent = `${dbDef?.icon || '🗄️'} ${dbDef?.label || _activeDatabaseId}`;
  renderSchemaForDatabase(_activeDatabaseId);
  resetSandboxDB();
});

// ══════════════════════════════════════════════════════════════════════════════
// TEACHER DASHBOARD
// ══════════════════════════════════════════════════════════════════════════════

$('btn-dashboard')?.addEventListener('click', () => {
  const overlay = $('teacher-dashboard');
  overlay?.classList.remove('hidden');
  renderDashboard($('dashboard-grid'));
});

$('btn-close-dashboard')?.addEventListener('click', () => {
  $('teacher-dashboard')?.classList.add('hidden');
});

// ══════════════════════════════════════════════════════════════════════════════
// LEADERBOARD
// ══════════════════════════════════════════════════════════════════════════════

$('btn-leaderboard')?.addEventListener('click', () => _challengeMgr?.showLeaderboard());
$('btn-close-leaderboard')?.addEventListener('click', () => $('leaderboard-modal')?.classList.add('hidden'));

// ══════════════════════════════════════════════════════════════════════════════
// THEME + FONT
// ══════════════════════════════════════════════════════════════════════════════

$('btn-theme')?.addEventListener('click', () => {
  const html  = document.documentElement;
  const isDark = html.dataset.theme === 'dark';
  html.dataset.theme = isDark ? 'light' : 'dark';
  $('theme-label').textContent = isDark ? 'Dark' : 'Light';
  $('theme-icon-dark')?.classList.toggle('hidden', isDark);
  $('theme-icon-light')?.classList.toggle('hidden', !isDark);
  localStorage.setItem('sql-theme', html.dataset.theme);
});

$('btn-font')?.addEventListener('click', () => {
  document.body.classList.toggle('dyslexic-font');
  localStorage.setItem('sql-dyslexic', document.body.classList.contains('dyslexic-font') ? '1' : '0');
});

// Restore preferences
const savedTheme = localStorage.getItem('sql-theme');
if (savedTheme) {
  document.documentElement.dataset.theme = savedTheme;
  $('theme-label').textContent = savedTheme === 'dark' ? 'Light' : 'Dark';
  $('theme-icon-dark')?.classList.toggle('hidden', savedTheme === 'dark');
  $('theme-icon-light')?.classList.toggle('hidden', savedTheme === 'light');
}
if (localStorage.getItem('sql-dyslexic') === '1') document.body.classList.add('dyslexic-font');

// ══════════════════════════════════════════════════════════════════════════════
// FEEDBACK / SUGGESTIONS
// ══════════════════════════════════════════════════════════════════════════════

$('btn-suggestions')?.addEventListener('click', () => {
  $('sg-dropdown')?.classList.toggle('hidden');
});
document.addEventListener('click', e => {
  if (!e.target.closest('#sg-wrap')) $('sg-dropdown')?.classList.add('hidden');
});

$('btn-sg-request')?.addEventListener('click', () => {
  $('sg-dropdown')?.classList.add('hidden');
  $('sg-modal-request')?.classList.remove('hidden');
});
$('btn-sg-error')?.addEventListener('click', () => {
  $('sg-dropdown')?.classList.add('hidden');
  $('sg-modal-error')?.classList.remove('hidden');
});
$('sg-req-cancel')?.addEventListener('click', () => $('sg-modal-request')?.classList.add('hidden'));
$('sg-req-cancel-2')?.addEventListener('click', () => $('sg-modal-request')?.classList.add('hidden'));
$('sg-err-cancel')?.addEventListener('click', () => $('sg-modal-error')?.classList.add('hidden'));
$('sg-err-cancel-2')?.addEventListener('click', () => $('sg-modal-error')?.classList.add('hidden'));

$('sg-req-submit')?.addEventListener('click', async () => {
  const text = $('sg-req-text').value.trim();
  if (!text) return;
  await submitFeedback(_user.uid, _profile.displayName, _profile.classCode, 'request', text, null);
  $('sg-req-text').value = '';
  $('sg-modal-request')?.classList.add('hidden');
});
$('sg-err-submit')?.addEventListener('click', async () => {
  const text = $('sg-err-text').value.trim();
  if (!text) return;
  const exId = $('sg-exercise-sel')?.value || null;
  await submitFeedback(_user.uid, _profile.displayName, _profile.classCode, 'error', text, exId);
  $('sg-err-text').value = '';
  $('sg-modal-error')?.classList.add('hidden');
});

// Populate exercise dropdown in error report
function populateFeedbackExercises() {
  const sel = $('sg-exercise-sel');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Select challenge (optional) —</option>' +
    EXERCISES.map(e => `<option value="${e.id}">[${e.id}] ${e.title}</option>`).join('');
}
populateFeedbackExercises();

// ══════════════════════════════════════════════════════════════════════════════
// RESIZE HANDLE (output panel)
// ══════════════════════════════════════════════════════════════════════════════

const resizeHandle = $('output-resize-handle');
if (resizeHandle) {
  let startY, startH;
  resizeHandle.addEventListener('mousedown', e => {
    startY = e.clientY;
    startH = $('output-panel')?.offsetHeight || 220;
    document.addEventListener('mousemove', onResizeMove);
    document.addEventListener('mouseup', () => document.removeEventListener('mousemove', onResizeMove), { once: true });
  });
  function onResizeMove(e) {
    const delta = startY - e.clientY;
    const newH  = Math.max(80, Math.min(startH + delta, window.innerHeight * 0.6));
    document.documentElement.style.setProperty('--output-h', newH + 'px');
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// STATUS BAR — cursor position
// ══════════════════════════════════════════════════════════════════════════════

editor?.addEventListener('keyup', updateCursorPos);
editor?.addEventListener('click', updateCursorPos);

function updateCursorPos() {
  const text = editor.value.slice(0, editor.selectionStart);
  const lines = text.split('\n');
  const line  = lines.length;
  const col   = lines[lines.length - 1].length + 1;
  $('status-line-col').textContent = `Ln ${line}, Col ${col}`;
}

// ══════════════════════════════════════════════════════════════════════════════
// INITIAL RENDER
// ══════════════════════════════════════════════════════════════════════════════

updateLineNumbers();
updateHighlight();
