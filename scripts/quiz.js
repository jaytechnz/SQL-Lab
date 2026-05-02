// SQL Quiz Bank — Cambridge AS Computer Science 9618 style practice

const $ = id => document.getElementById(id);
const STORE_KEY = 'sqllab-quiz-progress-v1';

export const QUIZ_SECTIONS = [
  { id: 'all', label: 'All' },
  { id: 'mcq', label: 'Multiple choice' },
  { id: 'fill', label: 'Fill blanks' },
  { id: 'output', label: 'State output' },
  { id: 'sql', label: 'Write SQL' },
  { id: 'theory', label: 'Explain' },
];

export const QUIZ_QUESTIONS = [
  mcq(1, 'Which command is used to retrieve data from a table?', ['INSERT', 'SELECT', 'UPDATE', 'CREATE'], 1),
  mcq(2, 'Which SQL keyword is used to remove records from a table?', ['DROP', 'ALTER', 'DELETE', 'ADD'], 2),
  mcq(3, 'Which constraint uniquely identifies each record in a table?', ['FOREIGN KEY', 'PRIMARY KEY', 'CHECK', 'DEFAULT'], 1),
  mcq(4, 'Which data type is most suitable for a price such as 12.50?', ['INTEGER', 'REAL', 'BOOLEAN', 'CHARACTER'], 1),
  mcq(5, 'Which clause is used to sort query output?', ['GROUP BY', 'ORDER BY', 'WHERE', 'VALUES'], 1),
  mcq(6, 'Which operator should be used to test for a missing value?', ['= NULL', 'IS NULL', 'LIKE NULL', 'IN NULL'], 1),
  mcq(7, 'Which command changes the structure of an existing table?', ['ALTER TABLE', 'UPDATE TABLE', 'CHANGE TABLE', 'MODIFY DATABASE'], 0),
  mcq(8, 'Which aggregate function returns the number of rows?', ['SUM()', 'MAX()', 'COUNT()', 'AVG()'], 2),
  mcq(9, 'Which clause is normally used with aggregate functions to create groups?', ['ORDER BY', 'GROUP BY', 'WHERE', 'VALUES'], 1),
  mcq(10, 'Which SQL statement adds a new record to a table?', ['INSERT INTO', 'ADD RECORD', 'CREATE ROW', 'UPDATE'], 0),
  mcq(11, 'Which comparison finds names beginning with A?', ["name LIKE 'A%'", "name = 'A%'", "name IN 'A%'", "name LIKE '%A'"], 0),
  mcq(12, 'Which join returns only matching rows from both tables?', ['LEFT JOIN', 'INNER JOIN', 'FULL JOIN', 'CROSS JOIN'], 1),
  mcq(13, 'Which keyword can give a column a temporary display name?', ['AS', 'ON', 'INTO', 'SET'], 0),
  mcq(14, 'Which statement removes an entire table definition?', ['DELETE TABLE Students', 'DROP TABLE Students', 'REMOVE Students', 'CLEAR TABLE Students'], 1),
  mcq(15, 'Which logical operator requires both conditions to be true?', ['OR', 'NOT', 'AND', 'LIKE'], 2),
  mcq(16, 'Which command is part of DDL rather than DML?', ['SELECT', 'INSERT', 'CREATE TABLE', 'UPDATE'], 2),
  mcq(17, 'Which field is commonly stored as BOOLEAN?', ['surname', 'date_of_birth', 'is_enrolled', 'salary'], 2),
  mcq(18, 'In a foreign key relationship, the child table stores a value that references...', ['a primary key in another table', 'any text field', 'a duplicate row', 'an aggregate result'], 0),
  mcq(19, 'Which query condition includes both 10 and 20?', ['x BETWEEN 10 AND 20', 'x > 10 AND x < 20', 'x IN 10 AND 20', 'x LIKE 10,20'], 0),
  mcq(20, 'Which statement is safest when updating one row?', ['UPDATE Students SET grade = 7;', "UPDATE Students SET grade = 7 WHERE student_id = 12;", 'ALTER Students SET grade = 7;', 'INSERT Students grade = 7;'], 1),

  fill(21, 'Complete the statement to select every field from the table Student.\n\n_____ * FROM Student;', 'SELECT'),
  fill(22, "Complete the condition to find rows where city is Auckland.\n\nWHERE city _____ 'Auckland';", '='),
  fill(23, 'Complete the statement to create a table.\n\nCREATE _____ Member (...);', 'TABLE'),
  fill(24, 'Complete the field definition for a unique identifier.\n\nmember_id INTEGER _____ KEY', 'PRIMARY'),
  fill(25, 'Complete the statement to add a field named email.\n\nALTER TABLE Member _____ email VARCHAR(60);', 'ADD'),
  fill(26, 'Complete the statement to insert a row.\n\nINSERT INTO Book (book_id, title) _____ (1, \'Dune\');', 'VALUES'),
  fill(27, 'Complete the statement to change existing rows.\n\n_____ Product SET price = 9.99 WHERE product_id = 4;', 'UPDATE'),
  fill(28, 'Complete the statement to remove selected rows.\n\nDELETE _____ Booking WHERE paid = FALSE;', 'FROM'),
  fill(29, 'Complete the query to sort highest mark first.\n\nORDER BY mark _____;', 'DESC'),
  fill(30, 'Complete the aggregate expression to find the mean salary.\n\n_____(salary)', 'AVG'),
  fill(31, 'Complete the condition for missing email addresses.\n\nWHERE email IS _____;', 'NULL'),
  fill(32, 'Complete the join condition.\n\nINNER JOIN Class ON Student.class_id _____ Class.class_id', '='),
  fill(33, 'Complete the clause to group rows by department.\n\n_____ BY department', 'GROUP'),
  fill(34, 'Complete the data type for text up to 30 characters.\n\nsurname _____(30)', 'VARCHAR'),
  fill(35, 'Complete the statement to delete a table definition.\n\n_____ TABLE TempData;', 'DROP'),
  fill(36, 'Complete the condition to find values 5, 7, or 9.\n\nWHERE score _____ (5, 7, 9);', 'IN'),
  fill(37, 'Complete the query to avoid duplicate cities.\n\nSELECT _____ city FROM Customer;', 'DISTINCT'),
  fill(38, 'Complete the alias.\n\nSELECT COUNT(*) _____ total FROM Orders;', 'AS'),
  fill(39, 'Complete the condition for names ending in son.\n\nWHERE surname LIKE _____;', "'%son'"),
  fill(40, 'Complete the foreign key phrase.\n\nFOREIGN KEY (customer_id) _____ Customer(customer_id)', 'REFERENCES'),

  output(41, 'State the output of this query.', table('Student', ['student_id', 'name', 'mark'], [[1, 'Amira', 76], [2, 'Ben', 48], [3, 'Cara', 91]]) + "\n\nSELECT name FROM Student WHERE mark >= 75 ORDER BY name ASC;", 'Amira\nCara'),
  output(42, 'State the output of this query.', table('Product', ['product_id', 'name', 'price'], [[1, 'Pen', 1.20], [2, 'Folder', 3.50], [3, 'Bag', 28.00]]) + '\n\nSELECT COUNT(*) FROM Product WHERE price < 5;', '2'),
  output(43, 'State the output of this query.', table('Book', ['title', 'genre'], [['Dune', 'Sci-Fi'], ['Emma', 'Classic'], ['It', 'Horror']]) + "\n\nSELECT title FROM Book WHERE genre = 'Classic';", 'Emma'),
  output(44, 'State the output of this query.', table('Sale', ['sale_id', 'amount'], [[1, 10], [2, 15], [3, 5]]) + '\n\nSELECT SUM(amount) AS total FROM Sale;', 'total\n30'),
  output(45, 'State the output of this query.', table('Member', ['member_id', 'name', 'active'], [[1, 'Noah', 'TRUE'], [2, 'Lina', 'FALSE'], [3, 'Mia', 'TRUE']]) + '\n\nSELECT name FROM Member WHERE active = TRUE ORDER BY member_id DESC;', 'Mia\nNoah'),
  output(46, 'State the output of this query.', table('Score', ['student', 'test', 'mark'], [['Ali', 1, 6], ['Ali', 2, 8], ['Bea', 1, 7]]) + "\n\nSELECT AVG(mark) FROM Score WHERE student = 'Ali';", '7'),
  output(47, 'State the output of this query.', table('OrderItem', ['order_id', 'quantity'], [[1, 2], [1, 3], [2, 4]]) + '\n\nSELECT order_id, SUM(quantity) FROM OrderItem GROUP BY order_id ORDER BY order_id;', '1  5\n2  4'),
  output(48, 'State the output of this query.', table('Customer', ['name', 'city'], [['Ava', 'Auckland'], ['Leo', 'Wellington'], ['Ivy', 'Auckland']]) + "\n\nSELECT DISTINCT city FROM Customer ORDER BY city;", 'Auckland\nWellington'),
  output(49, 'State the output of this query.', table('Car', ['reg_no', 'colour'], [['ABC1', 'red'], ['DEF2', 'blue'], ['GHI3', 'red']]) + "\n\nSELECT reg_no FROM Car WHERE colour <> 'red';", 'DEF2'),
  output(50, 'State the output of this query.', table('Employee', ['name', 'salary'], [['Sam', 52000], ['Jo', 61000], ['Ria', 59000]]) + '\n\nSELECT name FROM Employee ORDER BY salary DESC;', 'Jo\nRia\nSam'),
  output(51, 'State the output of this query.', table('Booking', ['room', 'paid'], [['A1', 'TRUE'], ['B2', 'FALSE'], ['C3', 'TRUE']]) + '\n\nSELECT COUNT(*) FROM Booking WHERE paid = FALSE;', '1'),
  output(52, 'State the output of this query.', table('Item', ['name', 'stock'], [['Mouse', 8], ['Keyboard', 0], ['Monitor', 3]]) + '\n\nSELECT name FROM Item WHERE stock BETWEEN 1 AND 8 ORDER BY stock;', 'Monitor\nMouse'),
  output(53, 'State the output of this query.', table('Club', ['name', 'year_group'], [['Ana', 12], ['Bo', 13], ['Cy', 12]]) + '\n\nSELECT year_group, COUNT(*) FROM Club GROUP BY year_group ORDER BY year_group;', '12  2\n13  1'),
  output(54, 'State the output of this query.', table('Pet', ['name', 'species'], [['Pip', 'cat'], ['Patch', 'dog'], ['Milo', 'cat']]) + "\n\nSELECT name FROM Pet WHERE name LIKE 'P%';", 'Pip\nPatch'),
  output(55, 'State the output of this query.', table('Loan', ['loan_id', 'return_date'], [[1, '2026-04-02'], [2, null], [3, null]]) + '\n\nSELECT COUNT(*) FROM Loan WHERE return_date IS NULL;', '2'),
  output(56, 'State the output after the UPDATE and SELECT.', table('Stock', ['item', 'quantity'], [['A', 4], ['B', 9]]) + "\n\nUPDATE Stock SET quantity = quantity + 1 WHERE item = 'A';\nSELECT quantity FROM Stock WHERE item = 'A';", '5'),
  output(57, 'State the output after the DELETE and SELECT.', table('Visit', ['name', 'age'], [['Zoe', 16], ['Yan', 19], ['Pia', 21]]) + '\n\nDELETE FROM Visit WHERE age < 18;\nSELECT COUNT(*) FROM Visit;', '2'),
  output(58, 'State the output of this join query.', table('Class', ['class_id', 'class_name'], [[1, 'CS'], [2, 'Maths']]) + '\n' + table('Student', ['name', 'class_id'], [['Eli', 1], ['Fay', 2]]) + '\n\nSELECT Student.name, Class.class_name FROM Student INNER JOIN Class ON Student.class_id = Class.class_id ORDER BY Student.name;', 'Eli  CS\nFay  Maths'),
  output(59, 'State the output of this query.', table('Result', ['name', 'grade'], [['Kai', 'A'], ['Lou', 'B'], ['Moe', 'A']]) + "\n\nSELECT COUNT(*) AS num_A FROM Result WHERE grade = 'A';", 'num_A\n2'),
  output(60, 'State the output of this query.', table('Parcel', ['parcel_id', 'weight'], [[1, 2.5], [2, 1.0], [3, 4.0]]) + '\n\nSELECT parcel_id FROM Parcel WHERE weight = (SELECT MAX(weight) FROM Parcel);', '3'),

  sql(61, 'Write an SQL statement to create a database called SchoolTrips.', 'CREATE DATABASE SchoolTrips;'),
  sql(62, 'Write an SQL statement to create a table Student with fields student_id INTEGER primary key, name VARCHAR(40), and year_group INTEGER.', 'CREATE TABLE Student (\n  student_id INTEGER PRIMARY KEY,\n  name VARCHAR(40),\n  year_group INTEGER\n);'),
  sql(63, 'Write an SQL statement to add an email field of type VARCHAR(80) to the Student table.', 'ALTER TABLE Student\nADD email VARCHAR(80);'),
  sql(64, 'Write an SQL statement to insert student_id 12, name Rina Patel, and year_group 12 into Student.', "INSERT INTO Student (student_id, name, year_group)\nVALUES (12, 'Rina Patel', 12);"),
  sql(65, 'Write an SQL statement to select all fields from the Book table.', 'SELECT * FROM Book;'),
  sql(66, 'Write an SQL statement to display only title and price from Book.', 'SELECT title, price\nFROM Book;'),
  sql(67, 'Write an SQL statement to display all students in year_group 12.', 'SELECT *\nFROM Student\nWHERE year_group = 12;'),
  sql(68, 'Write an SQL statement to display products with price greater than 20, sorted from highest price to lowest.', 'SELECT *\nFROM Product\nWHERE price > 20\nORDER BY price DESC;'),
  sql(69, 'Write an SQL statement to update the price of product_id 5 to 14.99.', 'UPDATE Product\nSET price = 14.99\nWHERE product_id = 5;'),
  sql(70, 'Write an SQL statement to delete bookings where paid is FALSE.', 'DELETE FROM Booking\nWHERE paid = FALSE;'),
  sql(71, 'Write an SQL statement to count the number of rows in the Member table.', 'SELECT COUNT(*)\nFROM Member;'),
  sql(72, 'Write an SQL statement to find the average salary of employees in the Sales department.', "SELECT AVG(salary)\nFROM Employee\nWHERE department = 'Sales';"),
  sql(73, 'Write an SQL statement to display each department and the number of employees in that department.', 'SELECT department, COUNT(*)\nFROM Employee\nGROUP BY department;'),
  sql(74, 'Write an SQL statement to display customer names without duplicates.', 'SELECT DISTINCT name\nFROM Customer;'),
  sql(75, 'Write an SQL statement to display books where the title starts with The.', "SELECT *\nFROM Book\nWHERE title LIKE 'The%';"),
  sql(76, 'Write an SQL statement to display loans that have not been returned. The field return_date stores NULL if the loan is still open.', 'SELECT *\nFROM Loan\nWHERE return_date IS NULL;'),
  sql(77, 'Write an SQL statement to create table Class with class_id INTEGER primary key and class_name VARCHAR(20).', 'CREATE TABLE Class (\n  class_id INTEGER PRIMARY KEY,\n  class_name VARCHAR(20)\n);'),
  sql(78, 'Write an SQL statement to create table Student with student_id INTEGER primary key, name VARCHAR(40), class_id INTEGER, and class_id as a foreign key referencing Class(class_id).', 'CREATE TABLE Student (\n  student_id INTEGER PRIMARY KEY,\n  name VARCHAR(40),\n  class_id INTEGER,\n  FOREIGN KEY (class_id) REFERENCES Class(class_id)\n);'),
  sql(79, 'Write an SQL statement to display student names and their class names using Student and Class.', 'SELECT Student.name, Class.class_name\nFROM Student\nINNER JOIN Class ON Student.class_id = Class.class_id;'),
  sql(80, 'Write an SQL statement to display orders placed by customer_id 8, sorted by order_date ascending.', 'SELECT *\nFROM Orders\nWHERE customer_id = 8\nORDER BY order_date ASC;'),
  sql(81, 'Write an SQL statement to display the total quantity ordered for each product_id from OrderItem.', 'SELECT product_id, SUM(quantity)\nFROM OrderItem\nGROUP BY product_id;'),
  sql(82, 'Write an SQL statement to display products where stock is 0 or reorder is TRUE.', 'SELECT *\nFROM Product\nWHERE stock = 0 OR reorder = TRUE;'),
  sql(83, 'Write an SQL statement to display members whose surname is Singh and first_name is Asha.', "SELECT *\nFROM Member\nWHERE surname = 'Singh' AND first_name = 'Asha';"),
  sql(84, 'Write an SQL statement to display events with event_date between 2026-05-01 and 2026-05-31 inclusive.', "SELECT *\nFROM Event\nWHERE event_date BETWEEN '2026-05-01' AND '2026-05-31';"),
  sql(85, 'Write an SQL statement to find the largest mark in the Result table.', 'SELECT MAX(mark)\nFROM Result;'),
  sql(86, 'Write an SQL statement to display the names of customers who live in Auckland or Hamilton.', "SELECT name\nFROM Customer\nWHERE city = 'Auckland' OR city = 'Hamilton';"),
  sql(87, 'Write an SQL statement to display all fields from Product where price is at least 10 and less than 50.', 'SELECT *\nFROM Product\nWHERE price >= 10 AND price < 50;'),
  sql(88, 'Write an SQL statement to create table Appointment with appointment_id INTEGER primary key, appointment_date DATE, appointment_time TIME, and attended BOOLEAN.', 'CREATE TABLE Appointment (\n  appointment_id INTEGER PRIMARY KEY,\n  appointment_date DATE,\n  appointment_time TIME,\n  attended BOOLEAN\n);'),
  sql(89, 'Write an SQL statement to change every order with status Pending to status Dispatched.', "UPDATE Orders\nSET status = 'Dispatched'\nWHERE status = 'Pending';"),
  sql(90, 'Write an SQL statement to display each genre and the average price of books in that genre.', 'SELECT genre, AVG(price)\nFROM Book\nGROUP BY genre;'),

  theory(91, 'State one reason a primary key is needed in a database table.', 'It uniquely identifies each record, so each row can be referenced unambiguously.'),
  theory(92, 'Explain why a foreign key is used.', 'A foreign key links one table to another by storing a value that matches the primary key in the referenced table.'),
  theory(93, 'Explain the difference between DELETE and DROP TABLE.', 'DELETE removes selected records from a table. DROP TABLE removes the table definition and its data.'),
  theory(94, 'State why UPDATE and DELETE statements should usually include a WHERE clause.', 'Without a WHERE clause, the statement affects every row in the table.'),
  theory(95, 'Explain why text values in SQL statements are written inside quotes.', 'Quotes show that the value is a string literal rather than a field name, table name, keyword, or number.'),
  theory(96, 'Describe the purpose of GROUP BY in a SELECT query.', 'GROUP BY combines rows with the same value in a field so aggregate functions can be calculated for each group.'),
  theory(97, 'Explain why IS NULL is used instead of = NULL.', 'NULL represents an unknown or missing value, so equality comparison is not used; IS NULL tests for missing values.'),
  theory(98, 'State one advantage of storing customer and order data in separate related tables.', 'It reduces duplication and allows one customer record to be linked to many orders.'),
  theory(99, 'Explain what an INNER JOIN does.', 'It returns rows where the join condition matches records in both tables.'),
  theory(100, 'State what will happen if an INSERT statement omits a required primary key value that has no automatic value.', 'The record will not be inserted because the required primary key value is missing.')
];

let currentSection = 'all';
let currentId = 1;
let selectedOption = null;
let answerVisible = false;
let context = { uid: '', classCode: '', displayName: '' };
let progress = normalizeProgress(loadProgress());
let listenersReady = false;

export function initQuiz(userContext = {}) {
  setQuizContext(userContext);
  progress = normalizeProgress(loadProgress());
  ensureQuizListeners();
  renderSectionTabs();
  renderQuestionList();
  renderQuestion();
  hydrateRemoteProgress().catch(() => {});
}

export function setQuizContext(userContext = {}) {
  context = {
    uid: userContext.uid || context.uid || '',
    classCode: userContext.classCode || context.classCode || '',
    displayName: userContext.displayName || context.displayName || ''
  };
}

function ensureQuizListeners() {
  window.SQLLabQuizOpen = openQuiz;
  if (listenersReady) return;
  $('btn-quiz')?.addEventListener('click', openQuiz);
  $('quiz-close')?.addEventListener('click', closeQuiz);
  $('quiz-reset')?.addEventListener('click', resetProgress);
  listenersReady = true;
}

function openQuiz() {
  const overlay = $('quiz-overlay');
  overlay?.classList.remove('hidden');
  overlay?.style.setProperty('display', 'flex', 'important');
  overlay?.style.setProperty('z-index', '5000', 'important');
  renderAll();
}

function closeQuiz() {
  const overlay = $('quiz-overlay');
  overlay?.classList.add('hidden');
  overlay?.style.removeProperty('display');
  overlay?.style.removeProperty('z-index');
}

function resetProgress() {
  if (!confirm('Reset all quiz progress?')) return;
  progress = { completed: {}, attempts: {} };
  saveProgress();
  renderAll();
}

function renderAll() {
  renderStats();
  renderSectionTabs();
  renderQuestionList();
  renderQuestion();
}

function renderStats() {
  const done = Object.keys(progress.completed || {}).length;
  const pct = Math.round(done / QUIZ_QUESTIONS.length * 100);
  const el = $('quiz-stats');
  if (!el) return;
  el.innerHTML = `
    <div class="quiz-progress-line"><span>${done}/${QUIZ_QUESTIONS.length} complete</span><span>${pct}%</span></div>
    <div class="quiz-progress-track"><div class="quiz-progress-fill" style="width:${pct}%"></div></div>
  `;
}

function renderSectionTabs() {
  const wrap = $('quiz-section-tabs');
  if (!wrap) return;
  wrap.innerHTML = QUIZ_SECTIONS.map(section => `
    <button class="quiz-section-tab${section.id === currentSection ? ' active' : ''}" data-section="${section.id}">
      ${esc(section.label)}
    </button>
  `).join('');
  wrap.querySelectorAll('.quiz-section-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      currentSection = btn.dataset.section;
      const first = filteredQuestions()[0];
      if (first) currentId = first.id;
      selectedOption = null;
      answerVisible = false;
      renderAll();
    });
  });
}

function renderQuestionList() {
  const wrap = $('quiz-question-list');
  if (!wrap) return;
  wrap.innerHTML = filteredQuestions().map(q => `
    <button class="quiz-list-item${q.id === currentId ? ' active' : ''}" data-id="${q.id}">
      <span class="quiz-list-num">${q.id}</span>
      <span class="quiz-list-title">${esc(q.title)}</span>
      <span class="quiz-list-done">${progress.completed?.[q.id] ? '✓' : ''}</span>
    </button>
  `).join('');
  wrap.querySelectorAll('.quiz-list-item').forEach(btn => {
    btn.addEventListener('click', () => {
      currentId = Number(btn.dataset.id);
      selectedOption = null;
      answerVisible = false;
      renderAll();
    });
  });
}

function renderQuestion() {
  const q = QUIZ_QUESTIONS.find(item => item.id === currentId) || QUIZ_QUESTIONS[0];
  const card = $('quiz-card');
  if (!card || !q) return;
  const done = !!progress.completed?.[q.id];
  const typeLabel = typeName(q.type);

  card.innerHTML = `
    <div class="quiz-card-head">
      <div>
        <div class="quiz-card-meta">
          <span class="quiz-chip">Question ${q.id}</span>
          <span class="quiz-chip">${esc(typeLabel)}</span>
          <span class="quiz-chip">${done ? 'Completed' : 'Open'}</span>
        </div>
        <h3 class="quiz-card-title">${esc(q.title)}</h3>
      </div>
    </div>
    <div class="quiz-card-body">
      <div class="quiz-prompt">${esc(q.prompt)}</div>
      ${q.data ? `<div class="quiz-data"><pre>${esc(q.data)}</pre></div>` : ''}
      ${renderResponseControl(q)}
      <div id="quiz-feedback" class="hidden"></div>
      <div class="quiz-actions">
        ${q.type === 'mcq' || q.type === 'fill' || q.type === 'output'
          ? '<button id="quiz-check" class="btn-primary">Check Answer</button>'
          : ''}
        <button id="quiz-reveal" class="btn-ghost">${answerVisible ? 'Hide Model Answer' : 'Reveal Model Answer'}</button>
        <button id="quiz-done" class="btn-accent">${done ? 'Mark Incomplete' : 'Mark Complete'}</button>
      </div>
    </div>
    ${answerVisible ? `<div class="quiz-answer"><div class="quiz-answer-title">Model answer</div><pre>${esc(q.answer)}</pre></div>` : ''}
  `;

  bindQuestionControls(q);
}

function renderResponseControl(q) {
  if (q.type === 'mcq') {
    return `<div class="quiz-options">${q.options.map((option, index) => `
      <button class="quiz-option${selectedOption === index ? ' selected' : ''}" data-option="${index}">
        ${String.fromCharCode(65 + index)}. ${esc(option)}
      </button>
    `).join('')}</div>`;
  }
  return `<textarea id="quiz-response" class="quiz-response" spellcheck="false" placeholder="Write your answer here."></textarea>`;
}

function bindQuestionControls(q) {
  document.querySelectorAll('.quiz-option').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedOption = Number(btn.dataset.option);
      document.querySelectorAll('.quiz-option').forEach(opt => opt.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });
  $('quiz-check')?.addEventListener('click', () => checkAnswer(q));
  $('quiz-reveal')?.addEventListener('click', () => {
    answerVisible = !answerVisible;
    renderQuestion();
  });
  $('quiz-done')?.addEventListener('click', () => {
    progress.completed = progress.completed || {};
    if (progress.completed[q.id]) delete progress.completed[q.id];
    else progress.completed[q.id] = Date.now();
    saveProgress();
    renderAll();
  });
}

function checkAnswer(q) {
  let correct = false;
  if (q.type === 'mcq') {
    correct = selectedOption === q.correct;
  } else {
    const given = $('quiz-response')?.value || '';
    correct = q.acceptable.some(answer => normalize(given) === normalize(answer));
  }

  const feedback = $('quiz-feedback');
  if (!feedback) return;
  feedback.className = `quiz-feedback ${correct ? 'correct' : 'incorrect'}`;
  feedback.textContent = correct ? 'Correct.' : 'Not quite. Compare your answer with the model answer.';
  progress.attempts = progress.attempts || {};
  const current = progress.attempts[q.id] || { type: q.type, correct: 0, incorrect: 0, total: 0 };
  progress.attempts[q.id] = {
    type: q.type,
    correct: (current.correct || 0) + (correct ? 1 : 0),
    incorrect: (current.incorrect || 0) + (correct ? 0 : 1),
    total: (current.total || 0) + 1,
    lastCorrect: correct,
    updatedAt: Date.now()
  };
  if (correct) {
    progress.completed = progress.completed || {};
    progress.completed[q.id] = Date.now();
    saveProgress();
    renderStats();
    renderQuestionList();
  } else {
    saveProgress();
  }
}

function filteredQuestions() {
  return currentSection === 'all'
    ? QUIZ_QUESTIONS
    : QUIZ_QUESTIONS.filter(q => q.type === currentSection);
}

function loadProgress() {
  try {
    const stored = localStorage.getItem(storeKey()) || localStorage.getItem(STORE_KEY) || '{}';
    return JSON.parse(stored) || {};
  } catch {
    return {};
  }
}

function saveProgress() {
  localStorage.setItem(storeKey(), JSON.stringify(progress));
  getQuizStorage()
    .then(storage => storage.saveQuizProgress(context.uid, context.classCode, context.displayName, progress))
    .catch(() => {});
}

async function hydrateRemoteProgress() {
  if (!context.uid) return;
  const storage = await getQuizStorage();
  const remote = normalizeProgress(await storage.getQuizProgress(context.uid));
  progress = mergeProgress(progress, remote);
  localStorage.setItem(storeKey(), JSON.stringify(progress));
  renderAll();
}

async function getQuizStorage() {
  return import('./storage.js?v=20260502-1');
}

function storeKey() {
  return context.uid ? `${STORE_KEY}-${context.uid}` : STORE_KEY;
}

function normalizeProgress(value) {
  if (!value || typeof value !== 'object') return { completed: {}, attempts: {} };
  if (value.completed || value.attempts) {
    return {
      completed: value.completed || {},
      attempts: value.attempts || {}
    };
  }
  return {
    completed: value,
    attempts: {}
  };
}

function mergeProgress(local, remote) {
  return {
    completed: { ...(local.completed || {}), ...(remote.completed || {}) },
    attempts: { ...(local.attempts || {}), ...(remote.attempts || {}) }
  };
}

function typeName(type) {
  return {
    mcq: 'Multiple choice',
    fill: 'Fill in the blank',
    output: 'State the output',
    sql: 'Writing SQL',
    theory: 'Explain'
  }[type] || type;
}

function normalize(value) {
  return String(value || '')
    .trim()
    .replace(/[;]+$/g, '')
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function mcq(id, prompt, options, correct) {
  return {
    id,
    type: 'mcq',
    title: prompt,
    prompt,
    options,
    correct,
    answer: `${String.fromCharCode(65 + correct)}. ${options[correct]}`
  };
}

function fill(id, prompt, answer, extras = []) {
  return {
    id,
    type: 'fill',
    title: prompt.split('\n')[0],
    prompt,
    answer,
    acceptable: [answer, ...extras]
  };
}

function output(id, prompt, data, answer) {
  return {
    id,
    type: 'output',
    title: prompt,
    prompt,
    data,
    answer,
    acceptable: [answer]
  };
}

function sql(id, prompt, answer) {
  return {
    id,
    type: 'sql',
    title: prompt,
    prompt,
    answer
  };
}

function theory(id, prompt, answer) {
  return {
    id,
    type: 'theory',
    title: prompt,
    prompt,
    answer
  };
}

function table(name, headings, rows) {
  const body = rows.map(row => row.map(cell => cell === null ? 'NULL' : cell).join(' | ')).join('\n');
  return `${name}\n${headings.join(' | ')}\n${body}`;
}

ensureQuizListeners();
