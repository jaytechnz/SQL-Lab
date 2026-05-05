import {
  getAllStudents,
  getSessions,
  getAllChallengeProgress,
  getAllQuizProgress,
  getClassNames,
  saveClassName,
  assignStudentToClass,
  removeStudentFromClass,
  submitTeacherSQLFeedback,
  getTeacherSQLFeedback
} from './storage.js?v=20260502-1';
import { EXERCISES, CATEGORIES } from './exercises.js?v=20260427-25';
import { QUIZ_QUESTIONS, QUIZ_SECTIONS } from './quiz.js?v=20260502-6';

const TOTAL_CHALLENGES = EXERCISES.length;
const TOTAL_QUIZ_QUESTIONS = QUIZ_QUESTIONS.length;
const QUIZ_TYPES = QUIZ_SECTIONS.filter(section => section.id !== 'all');

let _students = [];
let _sessions = [];
let _allProgress = {};
let _allQuizProgress = {};
let _sqlFeedback = [];
let _classNames = {};
let _container = null;
let _classFilter = '';
let _viewer = {};
let _status = { tone: '', text: '' };

export function refreshDashboard() {
  if (_container && _students) _render(_container);
}

export async function renderDashboard(containerEl, viewer = {}) {
  _container = containerEl;
  _viewer = viewer || {};
  containerEl.innerHTML = '<p class="dash-loading">Loading dashboard…</p>';

  try {
    [_students, _sessions, _allProgress, _allQuizProgress, _sqlFeedback] = await Promise.all([
      getAllStudents(),
      getSessions(),
      getAllChallengeProgress(),
      getAllQuizProgress().catch(() => ({})),
      getTeacherSQLFeedback().catch(() => [])
    ]);
    _classNames = _normalizeClassNames(await getClassNames().catch(() => ({})));
  } catch (e) {
    containerEl.innerHTML = `<p class="dash-error">Failed to load dashboard: ${e.message}</p>`;
    return;
  }

  try {
    _render(containerEl);
  } catch (e) {
    containerEl.innerHTML = `<p class="dash-error">Failed to render dashboard: ${esc(e.message)}</p>`;
  }
}

function _render(container) {
  const classes = _getClasses();
  if (_classFilter && !classes.includes(_classFilter)) _classFilter = '';

  const students = _classFilter
    ? _students.filter(student => _studentClassCode(student) === _classFilter)
    : _students;

  container.innerHTML = `
    <div class="dash-controls dash-card span-4">
      <div class="dash-controls-main">
        <label class="dash-filter-label" for="dash-class-filter">Class</label>
        <select id="dash-class-filter" class="dash-select">
          <option value="">All Classes</option>
          ${classes.map(code => `<option value="${escAttr(code)}" ${_classFilter === code ? 'selected' : ''}>${esc(_classNames[code] || code)}</option>`).join('')}
        </select>
        <span class="dash-filter-summary">${students.length} student${students.length === 1 ? '' : 's'} shown</span>
      </div>
      ${_status.text ? `<p class="dash-status dash-status--${_status.tone || 'info'}">${esc(_status.text)}</p>` : ''}
    </div>
    ${_renderClassManagement(classes)}
    ${_renderOverview(students)}
    ${_renderTeachingInsights(students)}
    ${_renderStudentTable(students)}
    ${_renderQuizInsights(students)}
    ${_renderQuizStudentTable(students)}
    ${_renderCategoryProgress(students)}
    ${_renderQuizSectionProgress(students)}
    ${_renderChallengeHeatmap(students)}
    ${_renderSQLConcepts(students)}
    ${_renderAtRisk(students)}
    ${_renderStudentSQL(students)}
  `;

  container.querySelector('#dash-class-filter')?.addEventListener('change', e => {
    _classFilter = _normalizeClassCode(e.target.value);
    _status = { tone: '', text: '' };
    _render(container);
  });

  container.querySelector('#dash-generate-class')?.addEventListener('click', _handleGenerateClass);
  container.querySelector('#dash-save-class-name')?.addEventListener('click', _handleSaveClassName);
  container.querySelector('#dash-add-student')?.addEventListener('click', _handleAddStudent);
  container.querySelectorAll('[data-remove-student]').forEach(btn => {
    btn.addEventListener('click', () => _handleRemoveStudent(btn.dataset.removeStudent, btn.dataset.studentName));
  });
  container.querySelectorAll('[data-sql-feedback-submit]').forEach(btn => {
    btn.addEventListener('click', () => _handleSQLFeedback(btn));
  });
}

function _renderClassManagement(classes) {
  const selectedCode = _classFilter || '';
  const roster = selectedCode
    ? _students
        .filter(student => _studentClassCode(student) === selectedCode)
        .sort((a, b) => _studentLabel(a).localeCompare(_studentLabel(b)))
    : [];
  const availableStudents = selectedCode
    ? _students
        .filter(student => _studentClassCode(student) !== selectedCode)
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
                ${availableStudents.map(student => `<option value="${escAttr(student.uid)}">${esc(_studentLabel(student))}${_studentClassCode(student) ? ` (${esc(_studentClassCode(student))})` : ' (no class)'}</option>`).join('')}
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
  const avgQuizDone = total
    ? Math.round(students.reduce((sum, student) => {
        return sum + Object.keys(_quizProgressFor(student).completed || {}).length;
      }, 0) / total)
    : 0;
  const activeToday = students.filter(student => {
    const progress = _allProgress[student.uid];
    const ts = Math.max(_timestamp(progress?.updatedAt), _latestChallengeSessionTs(student));
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
        <div class="dash-stat"><div class="dash-stat-val">${avgQuizDone}/${TOTAL_QUIZ_QUESTIONS}</div><div class="dash-stat-label">Average Quiz</div></div>
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
    ? _sessions.filter(session => _normalizeClassCode(session.classCode) === _classFilter)
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
      const attempts = _challengeSessionsForStudent(student);
      const failedAttempts = attempts.filter(session => session.passed === false).length;
      const lastTs = Math.max(_timestamp(progress.updatedAt), _latestChallengeSessionTs(student));
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
          <td class="td-center">${attempts.length}</td>
          <td class="td-center">${failedAttempts}</td>
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
              <th class="td-center">Runs</th>
              <th class="td-center">Unsuccessful</th>
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

function _renderQuizInsights(students) {
  const typeStats = _quizTypeStats(students);
  const attemptedTypes = typeStats.filter(item => item.attempts > 0 || item.done > 0);
  const strongest = [...attemptedTypes].sort((a, b) => b.mastery - a.mastery)[0];
  const weakest = [...attemptedTypes].sort((a, b) => a.mastery - b.mastery)[0];
  const questionGaps = _quizQuestionGaps(students).slice(0, 5);
  const notStarted = students.filter(student => Object.keys(_quizProgressFor(student).completed || {}).length === 0).length;
  const quizSecure = students.filter(student => _quizCompletionPct(student) >= 70).length;

  const lines = [];
  if (!students.length) {
    lines.push('No student data yet. Quiz strengths and weaknesses will appear after students answer questions.');
  } else if (!attemptedTypes.length) {
    lines.push('No quiz attempts have been synced yet. Students need to check answers or mark written questions complete before quiz insights appear.');
  } else {
    lines.push(`Strongest quiz area: ${strongest.label} at ${strongest.mastery}% mastery.`);
    lines.push(`Weakest quiz area: ${weakest.label} at ${weakest.mastery}% mastery.`);
    lines.push(`${quizSecure} students are secure on the quiz bank; ${notStarted} have not started it yet.`);
    if (questionGaps.length) {
      lines.push(`Most useful reteach: Q${questionGaps[0].question.id}, ${questionGaps[0].question.title}`);
    }
  }

  return `
    <div class="dash-card span-4">
      <div class="dash-card-title">Quiz Strengths And Weaknesses</div>
      <div class="dash-insights dash-insights--quiz">
        ${lines.map(line => `<div class="dash-insight">${esc(line)}</div>`).join('')}
      </div>
      ${questionGaps.length ? `
        <div class="quiz-gap-list">
          ${questionGaps.map(item => `
            <div class="quiz-gap-row">
              <span class="quiz-gap-id">Q${item.question.id}</span>
              <span class="quiz-gap-title">${esc(item.question.title)}</span>
              <span class="quiz-gap-type">${esc(_quizTypeLabel(item.question.type))}</span>
              <span class="quiz-gap-score">${item.correct}/${item.attempts} correct</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

function _renderQuizStudentTable(students) {
  if (!students.length) {
    return '<div class="dash-card span-4"><div class="dash-card-title">Quiz Progress</div><p class="dash-empty">No students found for this view.</p></div>';
  }

  const rows = students
    .slice()
    .sort((a, b) => _studentLabel(a).localeCompare(_studentLabel(b)))
    .map(student => {
      const quiz = _quizProgressFor(student);
      const completed = Object.keys(quiz.completed || {});
      const attempts = Object.values(quiz.attempts || {});
      const correct = attempts.reduce((sum, item) => sum + (item.correct || 0), 0);
      const total = attempts.reduce((sum, item) => sum + (item.total || 0), 0);
      const accuracy = total ? Math.round(correct / total * 100) : 0;
      const pct = Math.round(completed.length / TOTAL_QUIZ_QUESTIONS * 100);
      const weakness = _studentQuizWeakness(student);
      const strength = _studentQuizStrength(student);
      const lastTs = _timestamp(quiz.updatedAt) || _latestQuizAttemptTs(quiz);

      return `
        <tr>
          <td>${esc(_studentLabel(student))}</td>
          <td>
            <div class="mini-bar-wrap"><div class="mini-bar mini-bar--quiz" style="width:${pct}%"></div></div>
            <span class="mini-pct">${pct}%</span>
          </td>
          <td class="td-center">${completed.length}/${TOTAL_QUIZ_QUESTIONS}</td>
          <td class="td-center">${total ? `${accuracy}%` : '—'}</td>
          <td>${esc(strength || 'Not enough data')}</td>
          <td>${esc(weakness || 'Not enough data')}</td>
          <td class="td-muted">${lastTs ? _timeAgo(lastTs) : 'Never'}</td>
        </tr>
      `;
    }).join('');

  return `
    <div class="dash-card span-4">
      <div class="dash-card-title">Quiz Progress</div>
      <div class="dash-table-wrap">
        <table class="dash-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Quiz Completion</th>
              <th class="td-center">Questions</th>
              <th class="td-center">Checked Accuracy</th>
              <th>Strength</th>
              <th>Weakness</th>
              <th>Last Quiz Activity</th>
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

function _renderQuizSectionProgress(students) {
  const typeStats = _quizTypeStats(students);

  return `
    <div class="dash-card span-2">
      <div class="dash-card-title">Quiz Section Mastery</div>
      <div class="cat-bars">
        ${typeStats.map(item => `
          <div class="cat-bar-row">
            <span class="cat-bar-label">${esc(item.label)}</span>
            <div class="cat-bar-wrap">
              <div class="cat-bar-fill cat-bar-fill--quiz" style="width:${item.mastery}%"></div>
            </div>
            <span class="cat-bar-pct">${item.mastery}%</span>
          </div>
        `).join('')}
      </div>
      <p class="dash-panel-text dash-quiz-note">Mastery combines checked accuracy with completion for written quiz questions.</p>
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
    ? _sessions.filter(session => _normalizeClassCode(session.classCode) === _classFilter)
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
    const lastTs = Math.max(_timestamp(progress.updatedAt), _latestChallengeSessionTs(student));
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
              const lastTs = Math.max(_timestamp(progress.updatedAt), _latestChallengeSessionTs(student));
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
                  const comments = _feedbackForSQL(student.uid, id);
                  return `
                    <div class="sql-entry">
                      <div class="sql-entry-header">
                        <span class="sql-status ${completed ? 'sql-status--done' : ''}">${completed ? '✓' : '○'}</span>
                        <span class="sql-entry-id">${id}</span>
                        <span class="sql-entry-title">${esc(exercise.title)}</span>
                        <span class="ch-badge-diff badge-${exercise.difficulty}">${exercise.difficulty}</span>
                      </div>
                      <pre class="sql-entry-code">${esc(sql)}</pre>
                      <div class="sql-feedback">
                        ${comments.length ? `
                          <div class="sql-feedback-thread">
                            ${comments.map(comment => `
                              <div class="sql-feedback-comment">
                                <div class="sql-feedback-meta">
                                  <strong>${esc(comment.teacherName || 'Teacher')}</strong>
                                  <span>${esc(_formatDate(comment.createdAt))}</span>
                                </div>
                                <p>${esc(comment.text)}</p>
                              </div>
                            `).join('')}
                          </div>
                        ` : '<p class="sql-feedback-empty">No teacher feedback yet.</p>'}
                        <div class="sql-feedback-form">
                          <textarea class="dash-textarea sql-feedback-input" rows="2" placeholder="Add feedback for this SQL attempt"></textarea>
                          <button
                            class="btn-primary btn-sm"
                            data-sql-feedback-submit
                            data-student-uid="${escAttr(student.uid)}"
                            data-exercise-id="${escAttr(id)}"
                          >Add Feedback</button>
                        </div>
                      </div>
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

async function _handleSQLFeedback(button) {
  const form = button.closest('.sql-feedback-form');
  const input = form?.querySelector('.sql-feedback-input');
  const text = input?.value.trim() || '';
  const studentUid = button.dataset.studentUid || '';
  const exerciseId = button.dataset.exerciseId || '';
  const student = _students.find(item => item.uid === studentUid);

  if (!studentUid || !exerciseId || !text) {
    _status = { tone: 'error', text: 'Write a feedback comment before submitting.' };
    _render(_container);
    return;
  }

  button.disabled = true;
  button.textContent = 'Saving...';

  try {
    await submitTeacherSQLFeedback(
      studentUid,
      _studentLabel(student),
      _studentClassCode(student),
      exerciseId,
      text,
      _viewer
    );
    _sqlFeedback.push({
      uid: studentUid,
      displayName: _studentLabel(student),
      classCode: _studentClassCode(student),
      type: 'teacher_sql_comment',
      text,
      exerciseId,
      teacherUid: _viewer.uid || '',
      teacherName: _viewer.displayName || _viewer.email || 'Teacher',
      createdAt: Date.now()
    });
    _status = { tone: 'success', text: `Feedback added for ${_studentLabel(student)}.` };
    _render(_container);
  } catch (e) {
    _status = { tone: 'error', text: `Could not save feedback: ${e.message}` };
    _render(_container);
  }
}

function _getClasses() {
  const codes = new Set([
    ...Object.keys(_classNames).map(_normalizeClassCode),
    ..._students.map(_studentClassCode).filter(Boolean)
  ]);
  return [...codes].filter(Boolean).sort();
}

function _normalizeClassNames(classNames) {
  const normalized = {};
  Object.entries(classNames || {}).forEach(([rawCode, rawName]) => {
    const code = _normalizeClassCode(rawCode);
    if (!code) return;
    const name = String(rawName || '').trim();
    if (!normalized[code] || name.replace(/\s+/g, '').toUpperCase() === code) {
      normalized[code] = name || code;
    }
  });
  return normalized;
}

function _studentClassCode(student) {
  return _normalizeClassCode(student?.classCode);
}

function _normalizeClassCode(value) {
  return String(value || '').replace(/\s+/g, '').toUpperCase();
}

function _feedbackForSQL(studentUid, exerciseId) {
  return _sqlFeedback
    .filter(item => item.uid === studentUid && item.exerciseId === exerciseId)
    .sort((a, b) => _timestamp(a.createdAt) - _timestamp(b.createdAt));
}

function _quizProgressFor(student) {
  return _normalizeQuizProgress(_allQuizProgress[student.uid] || {});
}

function _normalizeQuizProgress(progress) {
  if (!progress || typeof progress !== 'object') return { completed: {}, attempts: {} };
  if (progress.completed || progress.attempts) {
    return {
      ...progress,
      completed: progress.completed || {},
      attempts: progress.attempts || {}
    };
  }
  return { completed: progress, attempts: {} };
}

function _quizCompletionPct(student) {
  const completed = Object.keys(_quizProgressFor(student).completed || {}).length;
  return Math.round(completed / TOTAL_QUIZ_QUESTIONS * 100);
}

function _quizTypeStats(students) {
  return QUIZ_TYPES.map(type => {
    const questions = QUIZ_QUESTIONS.filter(question => question.type === type.id);
    const totalQuestions = students.length * questions.length || 1;
    let done = 0;
    let correct = 0;
    let attempts = 0;

    students.forEach(student => {
      const progress = _quizProgressFor(student);
      questions.forEach(question => {
        if (progress.completed?.[question.id]) done++;
        const attempt = progress.attempts?.[question.id];
        if (attempt) {
          correct += attempt.correct || 0;
          attempts += attempt.total || 0;
        }
      });
    });

    const completion = Math.round(done / totalQuestions * 100);
    const accuracy = attempts ? Math.round(correct / attempts * 100) : completion;
    const mastery = Math.round((completion + accuracy) / 2);
    return { id: type.id, label: type.label, completion, accuracy, mastery, done, attempts };
  });
}

function _quizQuestionGaps(students) {
  return QUIZ_QUESTIONS.map(question => {
    let correct = 0;
    let attempts = 0;
    let completed = 0;

    students.forEach(student => {
      const progress = _quizProgressFor(student);
      if (progress.completed?.[question.id]) completed++;
      const attempt = progress.attempts?.[question.id];
      if (attempt) {
        correct += attempt.correct || 0;
        attempts += attempt.total || 0;
      }
    });

    const accuracy = attempts ? correct / attempts : 1;
    const completion = students.length ? completed / students.length : 1;
    return { question, correct, attempts, completed, score: (accuracy + completion) / 2 };
  })
    .filter(item => item.attempts > 0 || item.completed > 0)
    .sort((a, b) => a.score - b.score || b.attempts - a.attempts);
}

function _studentQuizStrength(student) {
  const stats = _studentQuizTypeStats(student).filter(item => item.evidence > 0);
  return stats.sort((a, b) => b.mastery - a.mastery)[0]?.label || '';
}

function _studentQuizWeakness(student) {
  const stats = _studentQuizTypeStats(student).filter(item => item.evidence > 0);
  return stats.sort((a, b) => a.mastery - b.mastery)[0]?.label || '';
}

function _studentQuizTypeStats(student) {
  const progress = _quizProgressFor(student);
  return QUIZ_TYPES.map(type => {
    const questions = QUIZ_QUESTIONS.filter(question => question.type === type.id);
    const done = questions.filter(question => progress.completed?.[question.id]).length;
    const typeAttempts = questions
      .map(question => progress.attempts?.[question.id])
      .filter(Boolean);
    const correct = typeAttempts.reduce((sum, item) => sum + (item.correct || 0), 0);
    const total = typeAttempts.reduce((sum, item) => sum + (item.total || 0), 0);
    const completion = Math.round(done / questions.length * 100);
    const accuracy = total ? Math.round(correct / total * 100) : completion;
    return {
      label: type.label,
      mastery: Math.round((completion + accuracy) / 2),
      evidence: done + total
    };
  });
}

function _latestQuizAttemptTs(progress) {
  return Object.values(progress.attempts || {}).reduce((latest, attempt) => {
    return Math.max(latest, _timestamp(attempt.updatedAt));
  }, 0);
}

function _challengeSessionsForStudent(student) {
  if (!student?.uid) return [];
  return _sessions.filter(session => session.uid === student.uid);
}

function _latestChallengeSessionTs(student) {
  return _challengeSessionsForStudent(student).reduce((latest, session) => {
    return Math.max(latest, _timestamp(session.createdAt));
  }, 0);
}

function _quizTypeLabel(type) {
  return QUIZ_TYPES.find(item => item.id === type)?.label || type;
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

function _formatDate(value) {
  const ts = _timestamp(value);
  if (!ts) return 'Just now';
  return new Date(ts).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escAttr(value) {
  return esc(value);
}
