// ─── Teacher Dashboard ────────────────────────────────────────────────────────
// Analytics for SQL Lab:
//   1. Class Overview — students, challenge completion, XP totals
//   2. Student Progress Table — per-student completion by category
//   3. SQL Concept Adoption — which commands students are using
//   4. Challenge Difficulty Heat-map — pass rates per challenge
//   5. Common Error Patterns — DDL vs DML failure breakdown
//   6. At-Risk Students — low engagement flags

import {
  getAllStudents,
  getSessions,
  getAllChallengeProgress,
  getClassNames,
  saveClassName
} from './storage.js';
import { EXERCISES, CATEGORIES } from './exercises.js';

const PALETTE = {
  blue:    '#2563EB',
  green:   '#16A34A',
  gold:    '#D97706',
  red:     '#DC2626',
  purple:  '#7C3AED',
  teal:    '#0891B2',
  bg:      '#0D1B3E',
  surface: '#112240',
  text:    '#E8F4FF',
  muted:   '#6B8FB8'
};

let _students    = null;
let _sessions    = null;
let _allProgress = null;
let _classNames  = {};
let _container   = null;
let _classFilter = '';

export function refreshDashboard() {
  if (_container && _students) _render(_container);
}

export async function renderDashboard(containerEl) {
  _container = containerEl;
  containerEl.innerHTML = '<p class="dash-loading">Loading dashboard…</p>';
  try {
    [_students, _sessions, _allProgress] = await Promise.all([
      getAllStudents(),
      getSessions(),
      getAllChallengeProgress()
    ]);
    _classNames = await getClassNames().catch(() => ({}));
  } catch (e) {
    containerEl.innerHTML = `<p class="dash-error">Failed to load dashboard: ${e.message}</p>`;
    return;
  }
  _render(containerEl);
}

function _render(container) {
  const classes = [...new Set(_students.map(s => s.classCode).filter(Boolean))].sort();
  const students = _classFilter
    ? _students.filter(s => s.classCode === _classFilter)
    : _students;

  container.innerHTML = `
    <div class="dash-controls">
      <label class="dash-filter-label">Filter by class:
        <select id="dash-class-filter" class="dash-select">
          <option value="">All Classes</option>
          ${classes.map(c => `<option value="${c}" ${_classFilter===c?'selected':''}>${_classNames[c]||c}</option>`).join('')}
        </select>
      </label>
    </div>
    ${_renderOverview(students)}
    ${_renderStudentTable(students)}
    ${_renderCategoryProgress(students)}
    ${_renderChallengeHeatmap(students)}
    ${_renderSQLConcepts(students)}
    ${_renderAtRisk(students)}
    ${_renderStudentSQL(students)}
  `;

  container.querySelector('#dash-class-filter')?.addEventListener('change', e => {
    _classFilter = e.target.value;
    _render(container);
  });
}

// ── Overview stats ─────────────────────────────────────────────────────────────

function _renderOverview(students) {
  const total = students.length;
  const avgXP = total
    ? Math.round(students.reduce((s, st) => s + (_allProgress[st.uid]?.totalXP || 0), 0) / total)
    : 0;
  const avgDone = total
    ? Math.round(students.reduce((s, st) => {
        return s + Object.keys(_allProgress[st.uid]?.completed || {}).length;
      }, 0) / total)
    : 0;
  const activeToday = students.filter(st => {
    const p = _allProgress[st.uid];
    if (!p?.updatedAt) return false;
    const ts = p.updatedAt?.toMillis?.() ?? p.updatedAt ?? 0;
    return Date.now() - ts < 86400000;
  }).length;

  return `
  <div class="dash-card span-4">
    <div class="dash-card-title">Class Overview</div>
    <div class="dash-stats-row">
      <div class="dash-stat"><div class="dash-stat-val">${total}</div><div class="dash-stat-label">Students</div></div>
      <div class="dash-stat"><div class="dash-stat-val">${avgXP}</div><div class="dash-stat-label">Avg XP</div></div>
      <div class="dash-stat"><div class="dash-stat-val">${avgDone}/60</div><div class="dash-stat-label">Avg Challenges</div></div>
      <div class="dash-stat"><div class="dash-stat-val">${activeToday}</div><div class="dash-stat-label">Active Today</div></div>
    </div>
  </div>`;
}

// ── Student table ──────────────────────────────────────────────────────────────

function _renderStudentTable(students) {
  if (!students.length) return '<div class="dash-card span-4"><div class="dash-card-title">Students</div><p class="dash-empty">No students found.</p></div>';

  const rows = students.map(st => {
    const prog = _allProgress[st.uid] || {};
    const completed = Object.keys(prog.completed || {});
    const ddlDone   = completed.filter(id => id.startsWith('ddl')).length;
    const dmlDone   = completed.filter(id => id.startsWith('dml')).length;
    const cboDone   = completed.filter(id => id.startsWith('combo')).length;
    const xp        = prog.totalXP || 0;
    const lastTs    = prog.updatedAt?.toMillis?.() ?? prog.updatedAt ?? 0;
    const lastStr   = lastTs ? _timeAgo(lastTs) : 'Never';
    const pct       = Math.round(completed.length / 60 * 100);

    return `<tr>
      <td>${st.displayName || st.email}</td>
      <td class="td-center">${ddlDone}/20</td>
      <td class="td-center">${dmlDone}/20</td>
      <td class="td-center">${cboDone}/20</td>
      <td class="td-center">${xp}</td>
      <td>
        <div class="mini-bar-wrap"><div class="mini-bar" style="width:${pct}%"></div></div>
        <span class="mini-pct">${pct}%</span>
      </td>
      <td class="td-muted">${lastStr}</td>
    </tr>`;
  }).join('');

  return `
  <div class="dash-card span-4">
    <div class="dash-card-title">Student Progress</div>
    <div class="dash-table-wrap">
      <table class="dash-table">
        <thead>
          <tr>
            <th>Student</th>
            <th class="td-center">DDL</th>
            <th class="td-center">DML</th>
            <th class="td-center">Combined</th>
            <th class="td-center">XP</th>
            <th>Overall</th>
            <th>Last Active</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>`;
}

// ── Category progress ──────────────────────────────────────────────────────────

function _renderCategoryProgress(students) {
  const catStats = CATEGORIES.map(cat => {
    const catExs = EXERCISES.filter(e => e.category === cat.id);
    const total  = students.length * catExs.length || 1;
    const done   = students.reduce((s, st) => {
      const completed = Object.keys(_allProgress[st.uid]?.completed || {});
      return s + completed.filter(id => catExs.some(e => e.id === id)).length;
    }, 0);
    const pct = Math.round(done / total * 100);
    return { cat, pct, done, total };
  });

  const bars = catStats.map(({ cat, pct }) => `
    <div class="cat-bar-row">
      <span class="cat-bar-label">${cat.icon} ${cat.label}</span>
      <div class="cat-bar-wrap">
        <div class="cat-bar-fill" style="width:${pct}%"></div>
      </div>
      <span class="cat-bar-pct">${pct}%</span>
    </div>`).join('');

  return `
  <div class="dash-card span-2">
    <div class="dash-card-title">Category Completion (Class Average)</div>
    <div class="cat-bars">${bars}</div>
  </div>`;
}

// ── Challenge heat-map ─────────────────────────────────────────────────────────

function _renderChallengeHeatmap(students) {
  const challengeStats = EXERCISES.map(ex => {
    const done = students.filter(st => !!_allProgress[st.uid]?.completed?.[ex.id]).length;
    const pct  = students.length ? Math.round(done / students.length * 100) : 0;
    return { ex, done, pct };
  });

  // Show top 10 hardest (lowest pass rate, attempted by at least 1 student)
  const attempted = challengeStats.filter(s => s.done > 0);
  const hardest   = [...attempted].sort((a, b) => a.pct - b.pct).slice(0, 10);
  const easiest   = [...attempted].sort((a, b) => b.pct - a.pct).slice(0, 5);

  const heatRow = s => {
    const color = s.pct >= 70 ? PALETTE.green : s.pct >= 40 ? PALETTE.gold : PALETTE.red;
    return `<div class="heat-row">
      <span class="heat-id">${s.ex.id}</span>
      <span class="heat-title">${s.ex.title}</span>
      <div class="heat-bar-wrap"><div class="heat-bar" style="width:${s.pct}%;background:${color}"></div></div>
      <span class="heat-pct" style="color:${color}">${s.pct}%</span>
    </div>`;
  };

  return `
  <div class="dash-card span-2">
    <div class="dash-card-title">Hardest Challenges (Lowest Pass Rate)</div>
    <div class="heat-list">${hardest.length ? hardest.map(heatRow).join('') : '<p class="dash-empty">No data yet.</p>'}</div>
  </div>`;
}

// ── SQL concept adoption ───────────────────────────────────────────────────────

function _renderSQLConcepts(students) {
  const sessions = _sessions.filter(s =>
    !_classFilter || s.classCode === _classFilter
  );

  const concepts = [
    { label: 'SELECT',       key: 'hasDML',      sessions },
    { label: 'WHERE',        key: 'hasWhere',     sessions },
    { label: 'GROUP BY',     key: 'hasGroupBy',   sessions },
    { label: 'INNER JOIN',   key: 'hasJoin',      sessions },
    { label: 'Aggregates',   key: 'hasAggregate', sessions },
    { label: 'DDL (CREATE)', key: 'hasDDL',       sessions },
  ];

  const total = sessions.length || 1;
  const bars = concepts.map(({ label, key }) => {
    const count = sessions.filter(s => s[key]).length;
    const pct   = Math.round(count / total * 100);
    return `<div class="cat-bar-row">
      <span class="cat-bar-label">${label}</span>
      <div class="cat-bar-wrap"><div class="cat-bar-fill" style="width:${pct}%;background:${PALETTE.teal}"></div></div>
      <span class="cat-bar-pct">${pct}%</span>
    </div>`;
  }).join('');

  return `
  <div class="dash-card span-2">
    <div class="dash-card-title">SQL Concept Usage (% of executions)</div>
    <div class="cat-bars">${bars}</div>
  </div>`;
}

// ── At-risk students ───────────────────────────────────────────────────────────

function _renderAtRisk(students) {
  const atRisk = students.filter(st => {
    const prog = _allProgress[st.uid] || {};
    const done = Object.keys(prog.completed || {}).length;
    const lastTs = prog.updatedAt?.toMillis?.() ?? prog.updatedAt ?? 0;
    const daysSince = (Date.now() - lastTs) / 86400000;
    return done < 5 || daysSince > 7;
  });

  if (!atRisk.length) return `
  <div class="dash-card span-2">
    <div class="dash-card-title">At-Risk Students</div>
    <p class="dash-empty" style="color:${PALETTE.green}">All students are making good progress.</p>
  </div>`;

  const rows = atRisk.map(st => {
    const prog = _allProgress[st.uid] || {};
    const done = Object.keys(prog.completed || {}).length;
    const lastTs = prog.updatedAt?.toMillis?.() ?? prog.updatedAt ?? 0;
    const lastStr = lastTs ? _timeAgo(lastTs) : 'Never';
    const flags = [];
    if (done < 5) flags.push('< 5 challenges done');
    if ((Date.now() - lastTs) > 7 * 86400000) flags.push('Inactive > 7 days');
    return `<tr>
      <td>${st.displayName || st.email}</td>
      <td class="td-center">${done}/60</td>
      <td class="td-muted">${lastStr}</td>
      <td>${flags.map(f => `<span class="risk-flag">${f}</span>`).join(' ')}</td>
    </tr>`;
  }).join('');

  return `
  <div class="dash-card span-2">
    <div class="dash-card-title">At-Risk Students (${atRisk.length})</div>
    <div class="dash-table-wrap">
      <table class="dash-table">
        <thead><tr><th>Student</th><th>Done</th><th>Last Active</th><th>Flags</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>`;
}

// ── Student SQL work viewer ────────────────────────────────────────────────────

function _renderStudentSQL(students) {
  const withSQL = students.filter(st => {
    const lastSQL = _allProgress[st.uid]?.lastSQL;
    return lastSQL && Object.keys(lastSQL).length > 0;
  });

  if (!withSQL.length) return `
  <div class="dash-card span-4">
    <div class="dash-card-title">Student SQL Work</div>
    <p class="dash-empty">No SQL attempts recorded yet.</p>
  </div>`;

  const exMap = Object.fromEntries(EXERCISES.map(e => [e.id, e]));

  const studentBlocks = withSQL.map(st => {
    const prog    = _allProgress[st.uid] || {};
    const lastSQL = prog.lastSQL || {};
    const entries = Object.entries(lastSQL)
      .filter(([id]) => exMap[id])
      .sort(([a], [b]) => a.localeCompare(b));

    const rows = entries.map(([id, sql]) => {
      const ex        = exMap[id];
      const completed = !!prog.completed?.[id];
      const status    = completed ? '<span class="sql-status sql-status--done">✓</span>' : '<span class="sql-status">○</span>';
      return `
        <div class="sql-entry">
          <div class="sql-entry-header">
            ${status}
            <span class="sql-entry-id">${id}</span>
            <span class="sql-entry-title">${ex.title}</span>
            <span class="ch-badge-diff badge-${ex.difficulty}">${ex.difficulty}</span>
          </div>
          <pre class="sql-entry-code">${esc(sql)}</pre>
        </div>`;
    }).join('');

    return `
      <details class="sql-student">
        <summary class="sql-student-summary">
          <span class="sql-student-name">${st.displayName || st.email}</span>
          <span class="sql-student-count">${entries.length} exercise${entries.length !== 1 ? 's' : ''}</span>
        </summary>
        <div class="sql-entries">${rows}</div>
      </details>`;
  }).join('');

  return `
  <div class="dash-card span-4">
    <div class="dash-card-title">Student SQL Work</div>
    <div class="sql-student-list">${studentBlocks}</div>
  </div>`;
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Helper: relative time ──────────────────────────────────────────────────────

function _timeAgo(ts) {
  const secs = Math.floor((Date.now() - ts) / 1000);
  if (secs < 60)   return 'Just now';
  if (secs < 3600) return `${Math.floor(secs/60)}m ago`;
  if (secs < 86400)return `${Math.floor(secs/3600)}h ago`;
  return `${Math.floor(secs/86400)}d ago`;
}
