import {
  getAllStudents,
  getSessions,
  getAllChallengeProgress,
  getClassNames,
  saveClassName,
  assignStudentToClass,
  removeStudentFromClass
} from './storage.js?v=20260427-2';
import { EXERCISES, CATEGORIES } from './exercises.js?v=20260427-2';

const TOTAL_CHALLENGES = EXERCISES.length;

let _students = [];
let _sessions = [];
let _allProgress = {};
let _classNames = {};
let _container = null;
let _classFilter = '';
let _status = { tone: '', text: '' };

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
  const classes = _getClasses();
  if (_classFilter && !classes.includes(_classFilter)) _classFilter = '';

  const students = _classFilter
    ? _students.filter(student => student.classCode === _classFilter)
    : _students;

  container.innerHTML = `
    <div class="dash-controls dash-card span-4">
      <div class="dash-controls-main">
        <label class="dash-filter-label" for="dash-class-filter">Class</label>
        <select id="dash-class-filter" class="dash-select">
          <option value="">All Classes</option>
          ${classes.map(code => `<option value="${code}" ${_classFilter === code ? 'selected' : ''}>${esc(_classNames[code] || code)}</option>`).join('')}
        </select>
        <span class="dash-filter-summary">${students.length} student${students.length === 1 ? '' : 's'} shown</span>
      </div>
      ${_status.text ? `<p class="dash-status dash-status--${_status.tone || 'info'}">${esc(_status.text)}</p>` : ''}
    </div>
    ${_renderClassManagement(classes)}
    ${_renderOverview(students)}
    ${_renderTeachingInsights(students)}
    ${_renderStudentTable(students)}
    ${_renderCategoryProgress(students)}
    ${_renderChallengeHeatmap(students)}
    ${_renderSQLConcepts(students)}
    ${_renderAtRisk(students)}
    ${_renderStudentSQL(students)}
  `;

  container.querySelector('#dash-class-filter')?.addEventListener('change', e => {
    _classFilter = e.target.value;
    _status = { tone: '', text: '' };
    _render(container);
  });

  container.querySelector('#dash-generate-class')?.addEventListener('click', _handleGenerateClass);
  container.querySelector('#dash-save-class-name')?.addEventListener('click', _handleSaveClassName);
  container.querySelector('#dash-add-student')?.addEventListener('click', _handleAddStudent);
  container.querySelectorAll('[data-remove-student]').forEach(btn => {
    btn.addEventListener('click', () => _handleRemoveStudent(btn.dataset.removeStudent, btn.dataset.studentName));
  });
}

function _renderClassManagement(classes) {
  const selectedCode = _classFilter || '';
  const roster = selectedCode
    ? _students
        .filter(student => student.classCode === selectedCode)
        .sort((a, b) => _studentLabel(a).localeCompare(_studentLabel(b)))
    : [];
  const availableStudents = selectedCode
    ? _students
        .filter(student => student.classCode !== selectedCode)
        .sort((a, b) => _studentLabel(a).localeCompare(_studentLabel(b)))
    : [];
  const classLabel = selectedCode ? (_classNames[selectedCode] || selectedCode) : '';

  return `
    <div class="dash-card span-4">
      <div class="dash-card-title">Class Management</div>
      <div class="dash-manage-grid">
        <section class="dash-panel">
          <h3 class="dash-panel-title">Create Class Code</h3>
          <p class="dash-panel-text">Generate a new class code for your Cambridge AS SQL group, then share it with students when they register.</p>
          <div class="dash-inline-form">
            <input id="dash-new-class-name" class="dash-input" type="text" placeholder="Optional class name, e.g. AS SQL Period 3">
            <button id="dash-generate-class" class="btn-primary btn-sm">Generate Code</button>
          </div>
        </section>
        <section class="dash-panel">
          <h3 class="dash-panel-title">Selected Class</h3>
          ${selectedCode ? `
            <div class="dash-class-code-row">
              <span class="dash-class-pill">${esc(selectedCode)}</span>
              <span class="dash-class-caption">${esc(classLabel)}</span>
            </div>
            <div class="dash-inline-form">
              <input id="dash-class-name" class="dash-input" type="text" value="${esc(classLabel)}" placeholder="Class display name">
              <button id="dash-save-class-name" class="btn-ghost btn-sm">Save Name</button>
            </div>
            <p class="dash-panel-text">Students can join with this code. You can also reassign registered students below.</p>
          ` : `
            <p class="dash-empty">Select a class to rename it, add students, or remove students.</p>
          `}
        </section>
      </div>
      <div class="dash-manage-grid dash-manage-grid--students">
        <section class="dash-panel">
          <h3 class="dash-panel-title">Add Student To Class</h3>
          ${selectedCode ? `
            <p class="dash-panel-text">Students must already have registered an account. This lets you move them into <strong>${esc(selectedCode)}</strong>.</p>
            <div class="dash-inline-form">
              <select id="dash-student-select" class="dash-select">
                <option value="">Choose a student</option>
                ${availableStudents.map(student => `<option value="${student.uid}">${esc(_studentLabel(student))}${student.classCode ? ` (${esc(student.classCode)})` : ' (no class)'}</option>`).join('')}
              </select>
              <button id="dash-add-student" class="btn-primary btn-sm" ${availableStudents.length ? '' : 'disabled'}>Add Student</button>
            </div>
          ` : `
            <p class="dash-empty">Choose a class first so we know where to place the student.</p>
          `}
        </section>
        <section class="dash-panel">
          <h3 class="dash-panel-title">Class Roster</h3>
          ${selectedCode ? _renderRoster(roster) : '<p class="dash-empty">No class selected.</p>'}
        </section>
      </div>
    </div>
  `;
}

function _renderRoster(roster) {
  if (!roster.length) return '<p class="dash-empty">No students are currently assigned to this class.</p>';

  return `
    <div class="dash-roster">
      ${roster.map(student => `
        <div class="dash-roster-row">
          <div>
            <div class="dash-roster-name">${esc(_studentLabel(student))}</div>
            <div class="dash-roster-meta">${esc(student.email || '')}</div>
          </div>
          <button
            class="btn-ghost btn-sm dash-remove-btn"
            data-remove-student="${student.uid}"
            data-student-name="${esc(_studentLabel(student))}"
          >Remove</button>
        </div>
      `).join('')}
    </div>
  `;
}

function _renderOverview(students) {
  const total = students.length;
  const avgXP = total
    ? Math.round(students.reduce((sum, student) => sum + (_allProgress[student.uid]?.totalXP || 0), 0) / total)
    : 0;
  const avgDone = total
    ? Math.round(students.reduce((sum, student) => {
        return sum + Object.keys(_allProgress[student.uid]?.completed || {}).length;
      }, 0) / total)
    : 0;
  const activeToday = students.filter(student => {
    const progress = _allProgress[student.uid];
    const ts = _timestamp(progress?.updatedAt);
    return ts && Date.now() - ts < 86400000;
  }).length;
  const secure = students.filter(student => _completionPct(student) >= 70).length;

  return `
    <div class="dash-card span-4">
      <div class="dash-card-title">Class Overview</div>
      <div class="dash-stats-row">
        <div class="dash-stat"><div class="dash-stat-val">${total}</div><div class="dash-stat-label">Students</div></div>
        <div class="dash-stat"><div class="dash-stat-val">${avgXP}</div><div class="dash-stat-label">Average XP</div></div>
        <div class="dash-stat"><div class="dash-stat-val">${avgDone}/${TOTAL_CHALLENGES}</div><div class="dash-stat-label">Average Challenges</div></div>
        <div class="dash-stat"><div class="dash-stat-val">${activeToday}</div><div class="dash-stat-label">Active Today</div></div>
        <div class="dash-stat"><div class="dash-stat-val">${secure}</div><div class="dash-stat-label">On Track</div></div>
      </div>
    </div>
  `;
}

function _renderTeachingInsights(students) {
  const categoryStats = CATEGORIES.map(category => {
    const categoryExercises = EXERCISES.filter(exercise => exercise.category === category.id);
    const possible = students.length * categoryExercises.length || 1;
    const done = students.reduce((sum, student) => {
      const completed = Object.keys(_allProgress[student.uid]?.completed || {});
      return sum + completed.filter(id => categoryExercises.some(exercise => exercise.id === id)).length;
    }, 0);
    const pct = Math.round(done / possible * 100);
    return { category, pct };
  });

  const strongest = [...categoryStats].sort((a, b) => b.pct - a.pct)[0];
  const weakest = [...categoryStats].sort((a, b) => a.pct - b.pct)[0];
  const secure = students.filter(student => _completionPct(student) >= 70).length;
  const developing = students.filter(student => {
    const pct = _completionPct(student);
    return pct >= 30 && pct < 70;
  }).length;
  const emerging = students.filter(student => _completionPct(student) < 30).length;

  const classSessions = _classFilter
    ? _sessions.filter(session => session.classCode === _classFilter)
    : _sessions;
  const failedSessions = classSessions.filter(session => session.passed === false);
  const failedByCategory = CATEGORIES.map(category => ({
    label: category.label,
    count: failedSessions.filter(session => session.category === category.id).length
  })).sort((a, b) => b.count - a.count);
  const mainMisconception = failedByCategory[0];

  const insightLines = [];

  if (students.length) {
    insightLines.push(`Strongest area: ${strongest.category.label} at ${strongest.pct}% completion.`);
    insightLines.push(`Next teaching focus: ${weakest.category.label} at ${weakest.pct}% completion.`);
    insightLines.push(`${secure} students are securely on track, ${developing} are developing, and ${emerging} need close support.`);
  } else {
    insightLines.push('No student data yet. Once students start work, this panel will highlight strengths and gaps.');
  }

  if (mainMisconception?.count) {
    insightLines.push(`Most failed attempts are currently in ${mainMisconception.label}, so that is the best place for a short reteach or worked example.`);
  } else if (students.length) {
    insightLines.push('There are not enough failed attempts yet to identify a clear misconception pattern.');
  }

  return `
    <div class="dash-card span-4">
      <div class="dash-card-title">Teaching Insights</div>
      <div class="dash-insights">
        ${insightLines.map(line => `<div class="dash-insight">${esc(line)}</div>`).join('')}
      </div>
    </div>
  `;
}

function _renderStudentTable(students) {
  if (!students.length) {
    return '<div class="dash-card span-4"><div class="dash-card-title">Student Progress</div><p class="dash-empty">No students found for this view.</p></div>';
  }

  const rows = students
    .slice()
    .sort((a, b) => _studentLabel(a).localeCompare(_studentLabel(b)))
    .map(student => {
      const progress = _allProgress[student.uid] || {};
      const completed = Object.keys(progress.completed || {});
      const ddlDone = completed.filter(id => id.startsWith('ddl')).length;
      const dmlDone = completed.filter(id => id.startsWith('dml')).length;
      const comboDone = completed.filter(id => id.startsWith('combo')).length;
      const xp = progress.totalXP || 0;
      const lastTs = _timestamp(progress.updatedAt);
      const lastStr = lastTs ? _timeAgo(lastTs) : 'Never';
      const pct = Math.round(completed.length / TOTAL_CHALLENGES * 100);
      const status = pct >= 70 ? 'Secure' : pct >= 30 ? 'Developing' : 'Needs Support';

      return `
        <tr>
          <td>${esc(_studentLabel(student))}</td>
          <td class="td-center">${ddlDone}/20</td>
          <td class="td-center">${dmlDone}/20</td>
          <td class="td-center">${comboDone}/20</td>
          <td class="td-center">${xp}</td>
          <td>
            <div class="mini-bar-wrap"><div class="mini-bar" style="width:${pct}%"></div></div>
            <span class="mini-pct">${pct}%</span>
          </td>
          <td>${status}</td>
          <td class="td-muted">${lastStr}</td>
        </tr>
      `;
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
              <th>Stage</th>
              <th>Last Active</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
}

function _renderCategoryProgress(students) {
  const categoryStats = CATEGORIES.map(category => {
    const categoryExercises = EXERCISES.filter(exercise => exercise.category === category.id);
    const total = students.length * categoryExercises.length || 1;
    const done = students.reduce((sum, student) => {
      const completed = Object.keys(_allProgress[student.uid]?.completed || {});
      return sum + completed.filter(id => categoryExercises.some(exercise => exercise.id === id)).length;
    }, 0);
    const pct = Math.round(done / total * 100);
    return { category, pct };
  });

  return `
    <div class="dash-card span-2">
      <div class="dash-card-title">Category Completion</div>
      <div class="cat-bars">
        ${categoryStats.map(({ category, pct }) => `
          <div class="cat-bar-row">
            <span class="cat-bar-label">${category.icon} ${category.label}</span>
            <div class="cat-bar-wrap">
              <div class="cat-bar-fill" style="width:${pct}%"></div>
            </div>
            <span class="cat-bar-pct">${pct}%</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function _renderChallengeHeatmap(students) {
  const challengeStats = EXERCISES.map(exercise => {
    const done = students.filter(student => !!_allProgress[student.uid]?.completed?.[exercise.id]).length;
    const pct = students.length ? Math.round(done / students.length * 100) : 0;
    return { exercise, done, pct };
  });

  const attempted = challengeStats.filter(item => item.done > 0);
  const hardest = [...attempted].sort((a, b) => a.pct - b.pct).slice(0, 8);

  return `
    <div class="dash-card span-2">
      <div class="dash-card-title">Hardest Challenges</div>
      <div class="heat-list">
        ${hardest.length ? hardest.map(item => {
          const tone = item.pct >= 70 ? 'var(--success)' : item.pct >= 40 ? 'var(--warning)' : 'var(--error)';
          return `
            <div class="heat-row">
              <span class="heat-id">${item.exercise.id}</span>
              <span class="heat-title">${esc(item.exercise.title)}</span>
              <div class="heat-bar-wrap"><div class="heat-bar" style="width:${item.pct}%;background:${tone}"></div></div>
              <span class="heat-pct" style="color:${tone}">${item.pct}%</span>
            </div>
          `;
        }).join('') : '<p class="dash-empty">No challenge data yet.</p>'}
      </div>
    </div>
  `;
}

function _renderSQLConcepts(students) {
  const studentIds = new Set(students.map(student => student.uid));
  const sessions = (_classFilter
    ? _sessions.filter(session => session.classCode === _classFilter)
    : _sessions.filter(session => studentIds.has(session.uid)));

  const concepts = [
    { label: 'SELECT', key: 'hasDML' },
    { label: 'WHERE', key: 'hasWhere' },
    { label: 'GROUP BY', key: 'hasGroupBy' },
    { label: 'JOIN', key: 'hasJoin' },
    { label: 'Aggregates', key: 'hasAggregate' },
    { label: 'DDL', key: 'hasDDL' }
  ];

  const total = sessions.length || 1;

  return `
    <div class="dash-card span-2">
      <div class="dash-card-title">SQL Concept Usage</div>
      <div class="cat-bars">
        ${concepts.map(({ label, key }) => {
          const count = sessions.filter(session => session[key]).length;
          const pct = Math.round(count / total * 100);
          return `
            <div class="cat-bar-row">
              <span class="cat-bar-label">${label}</span>
              <div class="cat-bar-wrap"><div class="cat-bar-fill cat-bar-fill--teal" style="width:${pct}%"></div></div>
              <span class="cat-bar-pct">${pct}%</span>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function _renderAtRisk(students) {
  const atRisk = students.filter(student => {
    const progress = _allProgress[student.uid] || {};
    const done = Object.keys(progress.completed || {}).length;
    const lastTs = _timestamp(progress.updatedAt);
    const daysSince = lastTs ? (Date.now() - lastTs) / 86400000 : Infinity;
    return done < 5 || daysSince > 7;
  });

  if (!atRisk.length) {
    return `
      <div class="dash-card span-2">
        <div class="dash-card-title">Students Needing Support</div>
        <p class="dash-empty dash-empty--success">Everyone in this view is making steady progress.</p>
      </div>
    `;
  }

  return `
    <div class="dash-card span-2">
      <div class="dash-card-title">Students Needing Support</div>
      <div class="dash-table-wrap">
        <table class="dash-table">
          <thead><tr><th>Student</th><th>Done</th><th>Last Active</th><th>Flags</th></tr></thead>
          <tbody>
            ${atRisk.map(student => {
              const progress = _allProgress[student.uid] || {};
              const done = Object.keys(progress.completed || {}).length;
              const lastTs = _timestamp(progress.updatedAt);
              const flags = [];
              if (done < 5) flags.push('Low completion');
              if (!lastTs || (Date.now() - lastTs) > 7 * 86400000) flags.push('Inactive');
              return `
                <tr>
                  <td>${esc(_studentLabel(student))}</td>
                  <td class="td-center">${done}/${TOTAL_CHALLENGES}</td>
                  <td class="td-muted">${lastTs ? _timeAgo(lastTs) : 'Never'}</td>
                  <td>${flags.map(flag => `<span class="risk-flag">${flag}</span>`).join(' ')}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function _renderStudentSQL(students) {
  const withSQL = students.filter(student => {
    const lastSQL = _allProgress[student.uid]?.lastSQL;
    return lastSQL && Object.keys(lastSQL).length > 0;
  });

  if (!withSQL.length) {
    return `
      <div class="dash-card span-4">
        <div class="dash-card-title">Recent Student SQL</div>
        <p class="dash-empty">No SQL attempts recorded yet.</p>
      </div>
    `;
  }

  const exerciseMap = Object.fromEntries(EXERCISES.map(exercise => [exercise.id, exercise]));

  return `
    <div class="dash-card span-4">
      <div class="dash-card-title">Recent Student SQL</div>
      <div class="sql-student-list">
        ${withSQL.map(student => {
          const progress = _allProgress[student.uid] || {};
          const lastSQL = progress.lastSQL || {};
          const entries = Object.entries(lastSQL)
            .filter(([id]) => exerciseMap[id])
            .sort(([a], [b]) => a.localeCompare(b));

          return `
            <details class="sql-student">
              <summary class="sql-student-summary">
                <span class="sql-student-name">${esc(_studentLabel(student))}</span>
                <span class="sql-student-count">${entries.length} exercise${entries.length === 1 ? '' : 's'}</span>
              </summary>
              <div class="sql-entries">
                ${entries.map(([id, sql]) => {
                  const exercise = exerciseMap[id];
                  const completed = !!progress.completed?.[id];
                  return `
                    <div class="sql-entry">
                      <div class="sql-entry-header">
                        <span class="sql-status ${completed ? 'sql-status--done' : ''}">${completed ? '✓' : '○'}</span>
                        <span class="sql-entry-id">${id}</span>
                        <span class="sql-entry-title">${esc(exercise.title)}</span>
                        <span class="ch-badge-diff badge-${exercise.difficulty}">${exercise.difficulty}</span>
                      </div>
                      <pre class="sql-entry-code">${esc(sql)}</pre>
                    </div>
                  `;
                }).join('')}
              </div>
            </details>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

async function _handleGenerateClass() {
  const name = _container.querySelector('#dash-new-class-name')?.value.trim() || '';
  const code = _generateClassCode();

  try {
    await saveClassName(code, name || code);
    _classNames[code] = name || code;
    _classFilter = code;
    _status = { tone: 'success', text: `Created class code ${code}. Share it with students when they join.` };
    _render(_container);
  } catch (e) {
    _status = { tone: 'error', text: `Could not create class code: ${e.message}` };
    _render(_container);
  }
}

async function _handleSaveClassName() {
  if (!_classFilter) return;

  const input = _container.querySelector('#dash-class-name');
  const name = input?.value.trim() || _classFilter;

  try {
    await saveClassName(_classFilter, name);
    _classNames[_classFilter] = name;
    _status = { tone: 'success', text: `Saved class name for ${_classFilter}.` };
    _render(_container);
  } catch (e) {
    _status = { tone: 'error', text: `Could not save class name: ${e.message}` };
    _render(_container);
  }
}

async function _handleAddStudent() {
  const select = _container.querySelector('#dash-student-select');
  const studentUid = select?.value || '';

  if (!_classFilter || !studentUid) {
    _status = { tone: 'error', text: 'Choose both a class and a student before adding them.' };
    _render(_container);
    return;
  }

  const student = _students.find(item => item.uid === studentUid);

  try {
    await assignStudentToClass(studentUid, _classFilter);
    if (student) student.classCode = _classFilter;
    _status = { tone: 'success', text: `${_studentLabel(student)} moved into ${_classFilter}.` };
    _render(_container);
  } catch (e) {
    _status = { tone: 'error', text: `Could not add student: ${e.message}` };
    _render(_container);
  }
}

async function _handleRemoveStudent(studentUid, studentName) {
  try {
    await removeStudentFromClass(studentUid);
    const student = _students.find(item => item.uid === studentUid);
    if (student) student.classCode = '';
    _status = { tone: 'success', text: `${studentName} removed from ${_classFilter}.` };
    _render(_container);
  } catch (e) {
    _status = { tone: 'error', text: `Could not remove student: ${e.message}` };
    _render(_container);
  }
}

function _getClasses() {
  const codes = new Set([
    ...Object.keys(_classNames),
    ..._students.map(student => student.classCode).filter(Boolean)
  ]);
  return [...codes].sort();
}

function _studentLabel(student) {
  return student?.displayName || student?.email || 'Unnamed student';
}

function _timestamp(value) {
  return value?.toMillis?.() ?? value ?? 0;
}

function _completionPct(student) {
  const completed = Object.keys(_allProgress[student.uid]?.completed || {}).length;
  return Math.round(completed / TOTAL_CHALLENGES * 100);
}

function _generateClassCode() {
  const year = new Date().getFullYear();
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `SQL9618-${year}-${suffix}`;
}

function _timeAgo(ts) {
  const secs = Math.floor((Date.now() - ts) / 1000);
  if (secs < 60) return 'Just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
