// ─── SQL Challenges ───────────────────────────────────────────────────────────
// 20 DDL + 20 DML + 20 Combined = 60 challenges
// Cambridge AS Computer Science 9618 — Section 8.3 SQL
//
// Each exercise:
// {
//   id, category, title, difficulty, xp, description, hints, starterCode,
//   database,        — id of built-in DB to load (null for DDL/combined)
//   setupSQL,        — extra SQL run before student code (for ALTER TABLE tasks)
//   validate(db, studentSQL) → { passed, messages }
// }

// ── Helpers ────────────────────────────────────────────────────────────────────

const XP = { easy: 10, medium: 25, hard: 50 };

function ex(id, cat, title, diff, desc, hints, starter, database, setupSQL, validate) {
  return { id, category: cat, title, difficulty: diff, xp: XP[diff],
           description: desc, hints, starterCode: starter ?? '',
           database: database ?? null, setupSQL: setupSQL ?? '', validate };
}

// Run SQL on a db and return first result set, or null on error.
function query(db, sql) {
  try {
    const r = db.exec(sql);
    return r.length ? { columns: r[0].columns, rows: r[0].values } : { columns: [], rows: [] };
  } catch (e) {
    return null;
  }
}

// Check whether a table exists in the database.
function tableExists(db, name) {
  const r = query(db, `SELECT 1 FROM sqlite_master WHERE type='table' AND LOWER(name)='${name.toLowerCase()}'`);
  return r && r.rows.length > 0;
}

// Get column info array for a table: [{name, type, pk}]
function tableInfo(db, name) {
  const r = query(db, `PRAGMA table_info("${name}")`);
  if (!r) return [];
  return r.rows.map(row => ({
    cid: row[0], name: row[1], type: (row[2] || '').toUpperCase(),
    notNull: !!row[3], dflt: row[4], pk: !!row[5]
  }));
}

// Get foreign key list for a table.
function foreignKeys(db, name) {
  const r = query(db, `PRAGMA foreign_key_list("${name}")`);
  if (!r) return [];
  return r.rows.map(row => ({
    id: row[0], seq: row[1], table: row[2], from: row[3], to: row[4]
  }));
}

function normType(type) {
  return String(type || '').replace(/\s+/g, '').toUpperCase();
}

// Check column exists (case-insensitive) and optionally type matches exactly.
function hasColumn(cols, colName, expectedType) {
  const col = cols.find(c => c.name.toLowerCase() === colName.toLowerCase());
  if (!col) return false;
  if (expectedType) return normType(col.type) === normType(expectedType);
  return true;
}

// Normalise a value for comparison.
function norm(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return v;
  const s = String(v).trim();
  const n = Number(s);
  return isNaN(n) ? s.toLowerCase() : n;
}

// Sort rows for order-independent comparison.
function sortRows(rows) {
  return [...rows].sort((a, b) => JSON.stringify(a.map(norm)).localeCompare(JSON.stringify(b.map(norm))));
}

function rowsEq(actual, expected) {
  if (actual.length !== expected.length) return false;
  const a = sortRows(actual);
  const e = sortRows(expected);
  return a.every((row, i) => row.length === e[i].length && row.every((v, j) => norm(v) === norm(e[i][j])));
}

function rowsEqOrdered(actual, expected) {
  if (actual.length !== expected.length) return false;
  return actual.every((row, i) =>
    row.length === expected[i].length && row.every((v, j) => norm(v) === norm(expected[i][j])));
}

// Check student SQL contains ALL given keywords (case-insensitive).
function hasKeyword(sql, ...kws) {
  return kws.every(k => new RegExp(k.replace(/\s+/g,'\\s+'), 'i').test(sql));
}
// Check student SQL contains ANY of the given keywords.
function hasAnyKeyword(sql, ...kws) {
  return kws.some(k => new RegExp(k.replace(/\s+/g,'\\s+'), 'i').test(sql));
}

// ══════════════════════════════════════════════════════════════════════════════
// CATEGORY METADATA
// ══════════════════════════════════════════════════════════════════════════════

export const CATEGORIES = [
  { id: 'ddl',      label: 'DDL — Data Definition',    icon: '🏗️', count: 20 },
  { id: 'dml',      label: 'DML — Data Manipulation',  icon: '🔍', count: 20 },
  { id: 'combined', label: 'DDL + DML Combined',        icon: '⚡', count: 20 },
];

// ══════════════════════════════════════════════════════════════════════════════
// DDL CHALLENGES  (ddl-01 … ddl-20)
// ══════════════════════════════════════════════════════════════════════════════

const ddl01 = ex('ddl-01','ddl','CREATE DATABASE Statement','easy',
`Write a \`CREATE DATABASE\` statement to create a database called \`SchoolDB\`.

This is the standard SQL DDL statement used to create a new database. The DBMS carries out all creation and modification of the database structure using DDL.

`,
['The syntax is: CREATE DATABASE database_name;', 'Database names should be descriptive'],
'',
null, '',
(db, sql) => {
  if (/\bCREATE\s+DATABASE\s+SchoolDB\b/i.test(sql))
    return { passed: true, messages: ['Correct! CREATE DATABASE SchoolDB; is valid DDL syntax.'] };
  if (/\bCREATE\s+DATABASE\b/i.test(sql))
    return { passed: false, messages: ['You used CREATE DATABASE, but the database name should be SchoolDB.'] };
  return { passed: false, messages: ['Your statement must include CREATE DATABASE SchoolDB.'] };
});

const ddl02 = ex('ddl-02','ddl','CREATE TABLE — INTEGER and VARCHAR','easy',
`Create a table called \`Continents\` with the following columns:
- \`continent_id\` — INTEGER
- \`continent_name\` — VARCHAR(50)`,
['Syntax: CREATE TABLE name (col1 TYPE, col2 TYPE);', 'VARCHAR(n) stores variable-length text up to n characters'],
'',
null, '',
(db, sql) => {
  if (!tableExists(db, 'Continents'))
    return { passed: false, messages: ['Table Continents was not created.'] };
  const cols = tableInfo(db, 'Continents');
  const msgs = [];
  if (!hasColumn(cols,'continent_id','INTEGER'))   msgs.push('Column continent_id with type INTEGER is missing.');
  if (!hasColumn(cols,'continent_name','VARCHAR(50)')) msgs.push('Column continent_name with type VARCHAR(50) is missing.');
  return msgs.length ? { passed: false, messages: msgs } : { passed: true, messages: ['Table Continents created correctly!'] };
});

const ddl03 = ex('ddl-03','ddl','CREATE TABLE — CHARACTER Data Type','easy',
`Create a table called \`GradeRecords\` with these columns:
- \`record_id\` — INTEGER
- \`student_name\` — VARCHAR(50)
- \`grade\` — CHARACTER

CHARACTER stores a single character, e.g. a grade letter 'A', 'B', 'C'.`,
['Use CHARACTER for a single character value', 'A single character is different from a string'],
'',
null, '',
(db, sql) => {
  if (!tableExists(db, 'GradeRecords'))
    return { passed: false, messages: ['Table GradeRecords was not created.'] };
  const cols = tableInfo(db, 'GradeRecords');
  const msgs = [];
  if (!hasColumn(cols,'record_id','INTEGER')) msgs.push('Column record_id with type INTEGER is missing.');
  if (!hasColumn(cols,'student_name','VARCHAR(50)')) msgs.push('Column student_name with type VARCHAR(50) is missing.');
  const gradeCol = cols.find(c => c.name.toLowerCase() === 'grade');
  if (!gradeCol) msgs.push('Column grade is missing.');
  else if (!hasColumn(cols,'grade','CHARACTER')) msgs.push('Column grade should have type CHARACTER.');
  return msgs.length ? { passed: false, messages: msgs } : { passed: true, messages: ['GradeRecords created with a CHARACTER column!'] };
});

const ddl04 = ex('ddl-04','ddl','CREATE TABLE — BOOLEAN Data Type','easy',
`Create a table called \`SystemSettings\` with:
- \`setting_id\` — INTEGER
- \`setting_name\` — VARCHAR(30)
- \`is_enabled\` — BOOLEAN

BOOLEAN stores TRUE or FALSE values.`,
['BOOLEAN is used for true/false values', 'Use TRUE or FALSE for boolean values'],
'',
null, '',
(db, sql) => {
  if (!tableExists(db, 'SystemSettings'))
    return { passed: false, messages: ['Table SystemSettings was not created.'] };
  const cols = tableInfo(db, 'SystemSettings');
  const msgs = [];
  if (!hasColumn(cols,'setting_id','INTEGER'))   msgs.push('Column setting_id with type INTEGER is missing.');
  if (!hasColumn(cols,'setting_name','VARCHAR(30)')) msgs.push('Column setting_name with type VARCHAR(30) is missing.');
  const boolCol = cols.find(c => c.name.toLowerCase() === 'is_enabled');
  if (!boolCol) msgs.push('Column is_enabled is missing.');
  else if (!hasColumn(cols,'is_enabled','BOOLEAN'))
    msgs.push('Column is_enabled should have type BOOLEAN.');
  return msgs.length ? { passed: false, messages: msgs } : { passed: true, messages: ['SystemSettings created with a BOOLEAN column!'] };
});

const ddl05 = ex('ddl-05','ddl','CREATE TABLE — REAL Data Type','easy',
`Create a table called \`SensorReadings\` with:
- \`reading_id\` — INTEGER
- \`sensor_value\` — REAL
- \`unit\` — VARCHAR(10)

REAL stores decimal (floating-point) numbers, e.g. 3.14, -0.5, 273.15.`,
['REAL is used for decimal numbers', 'Examples: temperature, price, distance'],
'',
null, '',
(db, sql) => {
  if (!tableExists(db, 'SensorReadings'))
    return { passed: false, messages: ['Table SensorReadings was not created.'] };
  const cols = tableInfo(db, 'SensorReadings');
  const msgs = [];
  if (!hasColumn(cols,'reading_id','INTEGER'))   msgs.push('Column reading_id with type INTEGER is missing.');
  if (!hasColumn(cols,'sensor_value','REAL')) msgs.push('Column sensor_value with type REAL is missing.');
  if (!hasColumn(cols,'unit','VARCHAR(10)'))         msgs.push('Column unit with type VARCHAR(10) is missing.');
  return msgs.length ? { passed: false, messages: msgs } : { passed: true, messages: ['SensorReadings created with a REAL column!'] };
});

const ddl06 = ex('ddl-06','ddl','CREATE TABLE — DATE Data Type','easy',
`Create a table called \`PublicHolidays\` with:
- \`holiday_id\` — INTEGER
- \`holiday_name\` — VARCHAR(50)
- \`holiday_date\` — DATE

DATE stores calendar dates in dd/mm/yyyy format, e.g. '25/12/2026'.`,
['DATE is used for calendar dates', "Use the format 'dd/mm/yyyy'"],
'',
null, '',
(db, sql) => {
  if (!tableExists(db, 'PublicHolidays'))
    return { passed: false, messages: ['Table PublicHolidays was not created.'] };
  const cols = tableInfo(db, 'PublicHolidays');
  const msgs = [];
  if (!hasColumn(cols,'holiday_id','INTEGER'))   msgs.push('Column holiday_id with type INTEGER is missing.');
  if (!hasColumn(cols,'holiday_name','VARCHAR(50)')) msgs.push('Column holiday_name with type VARCHAR(50) is missing.');
  const dateCol = cols.find(c => c.name.toLowerCase() === 'holiday_date');
  if (!dateCol) msgs.push('Column holiday_date is missing.');
  else if (!hasColumn(cols,'holiday_date','DATE')) msgs.push('Column holiday_date should have type DATE.');
  return msgs.length ? { passed: false, messages: msgs } : { passed: true, messages: ['PublicHolidays created with a DATE column!'] };
});

const ddl07 = ex('ddl-07','ddl','CREATE TABLE — TIME Data Type','easy',
`Create a table called \`ClassSchedule\` with:
- \`slot_id\` — INTEGER
- \`subject\` — VARCHAR(30)
- \`start_time\` — TIME
- \`end_time\` — TIME

TIME stores a time of day in HH:MM:SS format, e.g. '09:00:00'.`,
['TIME is used for times of day', "Use the format 'HH:MM:SS'"],
'',
null, '',
(db, sql) => {
  if (!tableExists(db, 'ClassSchedule'))
    return { passed: false, messages: ['Table ClassSchedule was not created.'] };
  const cols = tableInfo(db, 'ClassSchedule');
  const msgs = [];
  if (!hasColumn(cols,'slot_id','INTEGER'))    msgs.push('Column slot_id with type INTEGER is missing.');
  if (!hasColumn(cols,'subject','VARCHAR(30)'))    msgs.push('Column subject with type VARCHAR(30) is missing.');
  const st = cols.find(c => c.name.toLowerCase() === 'start_time');
  const et = cols.find(c => c.name.toLowerCase() === 'end_time');
  if (!st) msgs.push('Column start_time is missing.');
  else if (!hasColumn(cols,'start_time','TIME')) msgs.push('Column start_time should have type TIME.');
  if (!et) msgs.push('Column end_time is missing.');
  else if (!hasColumn(cols,'end_time','TIME')) msgs.push('Column end_time should have type TIME.');
  return msgs.length ? { passed: false, messages: msgs } : { passed: true, messages: ['ClassSchedule created with TIME columns!'] };
});

const ddl08 = ex('ddl-08','ddl','CREATE TABLE — PRIMARY KEY Inline Syntax','easy',
`Create a table called \`Countries\` with:
- \`country_id\` — INTEGER, and make it the **PRIMARY KEY** field
- \`country_name\` — VARCHAR(50), and make it **NOT NULL**
- \`population\` — INTEGER

A primary key uniquely identifies each row in a table. A non-key field can also be required by marking it NOT NULL.`,
['Add PRIMARY KEY after the data type: country_id INTEGER PRIMARY KEY', 'Use NOT NULL on country_name'],
'',
null, '',
(db, sql) => {
  if (!tableExists(db, 'Countries'))
    return { passed: false, messages: ['Table Countries was not created.'] };
  const cols = tableInfo(db, 'Countries');
  const msgs = [];
  if (!hasColumn(cols,'country_id','INTEGER'))   msgs.push('Column country_id with type INTEGER is missing.');
  if (!hasColumn(cols,'country_name','VARCHAR(50)')) msgs.push('Column country_name with type VARCHAR(50) is missing.');
  if (!hasColumn(cols,'population','INTEGER'))   msgs.push('Column population with type INTEGER is missing.');
  const pkCol = cols.find(c => c.name.toLowerCase() === 'country_id');
  if (pkCol && !pkCol.pk) msgs.push('country_id should be the PRIMARY KEY.');
  const nameCol = cols.find(c => c.name.toLowerCase() === 'country_name');
  if (nameCol && !nameCol.notNull) msgs.push('country_name should be marked NOT NULL.');
  return msgs.length ? { passed: false, messages: msgs } : { passed: true, messages: ['Countries created with a PRIMARY KEY on country_id!'] };
});

const ddl09 = ex('ddl-09','ddl','CREATE TABLE — PRIMARY KEY Constraint Syntax','easy',
`Create a table called \`Teachers\` with:
- \`teacher_code\` — VARCHAR(10), and make it the **PRIMARY KEY** field
- \`name\` — VARCHAR(50), and make it **NOT NULL**
- \`subject\` — VARCHAR(30)

Add the primary key using the **constraint syntax** at the end of the column list:
\`PRIMARY KEY (teacher_code)\``,
['Place PRIMARY KEY (field) as the last item in the column list, after a comma',
 'Use NOT NULL on name'],
'',
null, '',
(db, sql) => {
  if (!tableExists(db, 'Teachers'))
    return { passed: false, messages: ['Table Teachers was not created.'] };
  const cols = tableInfo(db, 'Teachers');
  const pkCol = cols.find(c => c.name.toLowerCase() === 'teacher_code');
  if (!pkCol) return { passed: false, messages: ['Column teacher_code is missing.'] };
  if (!hasColumn(cols,'teacher_code','VARCHAR(10)')) return { passed: false, messages: ['teacher_code should have type VARCHAR(10).'] };
  if (!pkCol.pk) return { passed: false, messages: ['teacher_code must be set as PRIMARY KEY.'] };
  const nameCol = cols.find(c => c.name.toLowerCase() === 'name');
  if (!nameCol) return { passed: false, messages: ['Column name is missing.'] };
  if (!hasColumn(cols,'name','VARCHAR(50)')) return { passed: false, messages: ['name should have type VARCHAR(50).'] };
  if (!nameCol.notNull) return { passed: false, messages: ['name should be marked NOT NULL.'] };
  if (!hasColumn(cols,'subject','VARCHAR(30)')) return { passed: false, messages: ['subject should have type VARCHAR(30).'] };
  return { passed: true, messages: ['Teachers created with PRIMARY KEY (teacher_code) constraint syntax!'] };
});

const ddl10 = ex('ddl-10','ddl','All Cambridge Data Types','medium',
`Create a table called \`Products\` that uses **all six Cambridge AS data types**:
- \`product_id\` — INTEGER, PRIMARY KEY
- \`name\` — VARCHAR(100)
- \`size_code\` — CHARACTER
- \`in_stock\` — BOOLEAN
- \`price\` — REAL
- \`added_date\` — DATE

This exercise covers every data type in the 9618 syllabus.`,
['Use all six types: INTEGER, VARCHAR, CHARACTER, BOOLEAN, REAL, DATE',
 'Add PRIMARY KEY to product_id'],
'',
null, '',
(db, sql) => {
  if (!tableExists(db, 'Products'))
    return { passed: false, messages: ['Table Products was not created.'] };
  const cols = tableInfo(db, 'Products');
  const msgs = [];
  const pkCol = cols.find(c => c.name.toLowerCase() === 'product_id');
  if (!pkCol) msgs.push('Column product_id (INTEGER PRIMARY KEY) is missing.');
  else if (!pkCol.pk) msgs.push('product_id should be the PRIMARY KEY.');
  if (!hasColumn(cols,'name','VARCHAR(100)'))        msgs.push('Column name (VARCHAR(100)) is missing.');
  const sizeCodeCol = cols.find(c => c.name.toLowerCase() === 'size_code');
  if (!sizeCodeCol) msgs.push('Column size_code (CHARACTER) is missing.');
  else if (!hasColumn(cols,'size_code','CHARACTER')) msgs.push('Column size_code should be type CHARACTER.');
  if (!hasColumn(cols,'in_stock','BOOLEAN'))    msgs.push('Column in_stock (BOOLEAN) is missing.');
  if (!hasColumn(cols,'price','REAL'))msgs.push('Column price (REAL) is missing.');
  const dateCol = cols.find(c => c.name.toLowerCase() === 'added_date');
  if (!dateCol) msgs.push('Column added_date (DATE) is missing.');
  else if (!hasColumn(cols,'added_date','DATE')) msgs.push('Column added_date should be type DATE.');
  return msgs.length ? { passed: false, messages: msgs } : { passed: true, messages: ['All six Cambridge data types used correctly!'] };
});

const ddl11 = ex('ddl-11','ddl','ALTER TABLE — Add Column','easy',
`A \`Students\` table already exists with columns: \`student_id\`, \`name\`, \`year_group\`.

Use \`ALTER TABLE\` to **add** a new column:
- \`email\` — VARCHAR(100)`,
['Syntax: ALTER TABLE table_name ADD COLUMN col_name TYPE;',
 'Or just: ALTER TABLE table_name ADD col_name TYPE;'],
'',
null,
`CREATE TABLE Students (
  student_id INTEGER PRIMARY KEY,
  name       VARCHAR(50),
  year_group INTEGER
);`,
(db, sql) => {
  if (!tableExists(db, 'Students'))
    return { passed: false, messages: ['The Students table was removed — only use ALTER TABLE to add the column.'] };
  const cols = tableInfo(db, 'Students');
  const emailCol = cols.find(c => c.name.toLowerCase() === 'email');
  if (!emailCol)
    return { passed: false, messages: ['Column email was not added. Use ALTER TABLE Students ADD email VARCHAR(100);'] };
  if (!hasColumn(cols,'email','VARCHAR(100)'))
    return { passed: false, messages: ['Column email should be VARCHAR(100).'] };
  return { passed: true, messages: ['email VARCHAR(100) column added successfully!'] };
});

const ddl12 = ex('ddl-12','ddl','ALTER TABLE — Add Multiple Columns','medium',
`A \`Books\` table exists with: \`book_id\`, \`title\`, \`author\`.

Add **two** new columns using ALTER TABLE:
1. \`isbn\` — VARCHAR(20)
2. \`publish_year\` — INTEGER`,
['You will need two separate ALTER TABLE statements — one for each column',
 'ALTER TABLE Books ADD isbn VARCHAR(20);'],
'',
null,
`CREATE TABLE Books (
  book_id INTEGER PRIMARY KEY,
  title   VARCHAR(100),
  author  VARCHAR(80)
);`,
(db, sql) => {
  if (!tableExists(db, 'Books'))
    return { passed: false, messages: ['The Books table should not be dropped.'] };
  const cols = tableInfo(db, 'Books');
  const msgs = [];
  const isbn = cols.find(c => c.name.toLowerCase() === 'isbn');
  const yr   = cols.find(c => c.name.toLowerCase() === 'publish_year');
  if (!isbn) msgs.push('Column isbn was not added.');
  else if (!hasColumn(cols,'isbn','VARCHAR(20)')) msgs.push('Column isbn should be VARCHAR(20).');
  if (!yr)   msgs.push('Column publish_year was not added.');
  else if (!hasColumn(cols,'publish_year','INTEGER')) msgs.push('Column publish_year should be INTEGER.');
  return msgs.length ? { passed: false, messages: msgs } : { passed: true, messages: ['Both columns added with ALTER TABLE!'] };
});

const ddl13 = ex('ddl-13','ddl','FOREIGN KEY Reference','medium',
`Two tables exist: \`Departments\` and \`Staff\`.

Departments has been created for you. Create the \`Staff\` table with:
- \`staff_id\` — INTEGER, PRIMARY KEY
- \`name\` — VARCHAR(50)
- \`dept_id\` — INTEGER
- A **FOREIGN KEY** on \`dept_id\` that references \`Departments(dept_id)\`

Syntax: \`FOREIGN KEY (field) REFERENCES Table (Field)\``,
['Add the foreign key as a table constraint: FOREIGN KEY (dept_id) REFERENCES Departments(dept_id)',
 'The foreign key column and referenced column must be compatible types'],
'',
null,
`CREATE TABLE Departments (
  dept_id   INTEGER PRIMARY KEY,
  dept_name VARCHAR(30)
);`,
(db, sql) => {
  if (!tableExists(db, 'Staff'))
    return { passed: false, messages: ['Table Staff was not created.'] };
  const cols = tableInfo(db, 'Staff');
  const msgs = [];
  if (!hasColumn(cols,'staff_id','INTEGER')) msgs.push('staff_id should have type INTEGER.');
  if (!hasColumn(cols,'name','VARCHAR(50)')) msgs.push('name should have type VARCHAR(50).');
  if (!hasColumn(cols,'dept_id','INTEGER')) msgs.push('dept_id should have type INTEGER.');
  const fks = foreignKeys(db, 'Staff');
  if (!fks.length)
    return { passed: false, messages: ['No FOREIGN KEY found on the Staff table.',
      'Add: FOREIGN KEY (dept_id) REFERENCES Departments(dept_id)'] };
  const fk = fks.find(f => f.from.toLowerCase() === 'dept_id' &&
                            f.table.toLowerCase() === 'departments');
  if (!fk)
    msgs.push('The FOREIGN KEY should reference Departments(dept_id).');
  return msgs.length ? { passed: false, messages: msgs } : { passed: true, messages: ['FOREIGN KEY correctly references Departments!'] };
});

const ddl14 = ex('ddl-14','ddl','Relational Schema — Authors and Books','medium',
`Design a small relational database by creating **two linked tables**:

1. \`Authors\` — author_id INTEGER PRIMARY KEY, name VARCHAR(80)
2. \`Books\` — book_id INTEGER PRIMARY KEY, title VARCHAR(100), author_id INTEGER, genre VARCHAR(30), price REAL
   — with a FOREIGN KEY on author_id referencing Authors(author_id)`,
['Create Authors first (it is referenced by Books)',
 'Add FOREIGN KEY (author_id) REFERENCES Authors(author_id) inside the Books column list'],
'',
null, '',
(db, sql) => {
  const msgs = [];
  if (!tableExists(db, 'Authors')) msgs.push('Table Authors was not created.');
  if (!tableExists(db, 'Books'))   msgs.push('Table Books was not created.');
  if (msgs.length) return { passed: false, messages: msgs };
  const bCols = tableInfo(db, 'Books');
  const aCols = tableInfo(db, 'Authors');
  if (!hasColumn(aCols,'author_id','INTEGER')) msgs.push('Authors is missing author_id with type INTEGER.');
  if (!hasColumn(aCols,'name','VARCHAR(80)')) msgs.push('Authors is missing name with type VARCHAR(80).');
  if (!hasColumn(bCols,'book_id','INTEGER')) msgs.push('Books is missing book_id with type INTEGER.');
  if (!hasColumn(bCols,'title','VARCHAR(100)'))    msgs.push('Books is missing the title column with type VARCHAR(100).');
  if (!hasColumn(bCols,'author_id','INTEGER'))msgs.push('Books is missing the author_id column with type INTEGER.');
  if (!hasColumn(bCols,'genre','VARCHAR(30)')) msgs.push('Books is missing the genre column with type VARCHAR(30).');
  if (!hasColumn(bCols,'price','REAL')) msgs.push('Books is missing the price REAL column.');
  const fks = foreignKeys(db, 'Books');
  const fk = fks.find(f => f.from.toLowerCase() === 'author_id' &&
                            f.table.toLowerCase() === 'authors');
  if (!fk) msgs.push('Books is missing FOREIGN KEY (author_id) REFERENCES Authors(author_id).');
  return msgs.length ? { passed: false, messages: msgs }
    : { passed: true, messages: ['Two-table relational schema created with foreign key!'] };
});

const ddl15 = ex('ddl-15','ddl','Table with TIME Column','easy',
`Create a table called \`Appointments\` with:
- \`appt_id\` — INTEGER, PRIMARY KEY
- \`patient_name\` — VARCHAR(50)
- \`appt_date\` — DATE
- \`appt_time\` — TIME
- \`confirmed\` — BOOLEAN`,
['DATE and TIME are separate data types',
 'Use both in the same table for date-time information'],
'',
null, '',
(db, sql) => {
  if (!tableExists(db, 'Appointments'))
    return { passed: false, messages: ['Table Appointments was not created.'] };
  const cols = tableInfo(db, 'Appointments');
  const msgs = [];
  if (!cols.find(c => c.name.toLowerCase() === 'appt_id' && c.pk))
    msgs.push('appt_id should be INTEGER PRIMARY KEY.');
  if (!hasColumn(cols,'patient_name','VARCHAR(50)')) msgs.push('patient_name should be type VARCHAR(50).');
  const dateC = cols.find(c => c.name.toLowerCase() === 'appt_date');
  const timeC = cols.find(c => c.name.toLowerCase() === 'appt_time');
  if (!dateC) msgs.push('Column appt_date (DATE) is missing.');
  else if (!hasColumn(cols,'appt_date','DATE')) msgs.push('appt_date should be type DATE.');
  if (!timeC) msgs.push('Column appt_time (TIME) is missing.');
  else if (!hasColumn(cols,'appt_time','TIME')) msgs.push('appt_time should be type TIME.');
  if (!hasColumn(cols,'confirmed','BOOLEAN')) msgs.push('confirmed should be type BOOLEAN.');
  return msgs.length ? { passed: false, messages: msgs }
    : { passed: true, messages: ['Appointments table created with DATE and TIME columns!'] };
});

const ddl16 = ex('ddl-16','ddl','ALTER TABLE — Extend a Schema','medium',
`A \`Vehicles\` table exists with only \`vehicle_id\` and \`make\`.

Extend it using ALTER TABLE to add:
1. \`model\` — VARCHAR(50)
2. \`year\` — INTEGER
3. \`price\` — REAL`,
['Run three separate ALTER TABLE ... ADD statements',
 'Check each column name is spelled exactly as specified'],
'',
null,
`CREATE TABLE Vehicles (
  vehicle_id INTEGER PRIMARY KEY,
  make       VARCHAR(30)
);`,
(db, sql) => {
  const cols = tableInfo(db, 'Vehicles');
  const msgs = [];
  if (!hasColumn(cols,'model','VARCHAR(50)'))       msgs.push('Column model with type VARCHAR(50) is missing.');
  if (!hasColumn(cols,'year','INTEGER'))        msgs.push('Column year with type INTEGER is missing.');
  if (!hasColumn(cols,'price','REAL'))       msgs.push('Column price with type REAL is missing.');
  if (!hasColumn(cols,'vehicle_id','INTEGER'))  msgs.push('vehicle_id should still exist with type INTEGER.');
  if (!hasColumn(cols,'make','VARCHAR(30)')) msgs.push('make should still exist with type VARCHAR(30).');
  return msgs.length ? { passed: false, messages: msgs }
    : { passed: true, messages: ['Vehicles table extended with 3 new columns!'] };
});

const ddl17 = ex('ddl-17','ddl','Three-Table Hospital Schema','hard',
`Create a 3-table hospital database:

1. \`Doctors\` — doctor_id INTEGER PK, name VARCHAR(50), speciality VARCHAR(50)
2. \`Patients\` — patient_id INTEGER PK, name VARCHAR(50), dob DATE, blood_type CHARACTER
3. \`Appointments\` — appt_id INTEGER PK, doctor_id INTEGER FK→Doctors, patient_id INTEGER FK→Patients, appt_date DATE, appt_time TIME`,
['Create Doctors and Patients first, then Appointments',
 'Appointments needs two FOREIGN KEY constraints',
 'FOREIGN KEY (doctor_id) REFERENCES Doctors(doctor_id)'],
'',
null, '',
(db, sql) => {
  const msgs = [];
  ['Doctors','Patients','Appointments'].forEach(t => {
    if (!tableExists(db, t)) msgs.push(`Table ${t} is missing.`);
  });
  if (msgs.length) return { passed: false, messages: msgs };
  const dCols = tableInfo(db, 'Doctors');
  if (!hasColumn(dCols,'doctor_id','INTEGER')) msgs.push('Doctors is missing doctor_id with type INTEGER.');
  if (!hasColumn(dCols,'name','VARCHAR(50)')) msgs.push('Doctors is missing name with type VARCHAR(50).');
  if (!hasColumn(dCols,'speciality','VARCHAR(50)')) msgs.push('Doctors is missing the speciality column with type VARCHAR(50).');
  const pCols = tableInfo(db, 'Patients');
  if (!hasColumn(pCols,'patient_id','INTEGER')) msgs.push('Patients is missing patient_id with type INTEGER.');
  if (!hasColumn(pCols,'name','VARCHAR(50)')) msgs.push('Patients is missing name with type VARCHAR(50).');
  const dobC = pCols.find(c => c.name.toLowerCase() === 'dob');
  if (!dobC) msgs.push('Patients is missing the dob column.');
  else if (!hasColumn(pCols,'dob','DATE')) msgs.push('dob should be type DATE.');
  const btC = pCols.find(c => c.name.toLowerCase() === 'blood_type');
  if (!btC) msgs.push('Patients is missing blood_type.');
  else if (!hasColumn(pCols,'blood_type','CHARACTER')) msgs.push('blood_type should be type CHARACTER.');
  const aCols = tableInfo(db, 'Appointments');
  if (!hasColumn(aCols,'appt_id','INTEGER')) msgs.push('Appointments is missing appt_id with type INTEGER.');
  if (!hasColumn(aCols,'doctor_id','INTEGER')) msgs.push('Appointments is missing doctor_id with type INTEGER.');
  if (!hasColumn(aCols,'patient_id','INTEGER')) msgs.push('Appointments is missing patient_id with type INTEGER.');
  if (!hasColumn(aCols,'appt_date','DATE')) msgs.push('Appointments is missing appt_date with type DATE.');
  if (!hasColumn(aCols,'appt_time','TIME')) msgs.push('Appointments is missing appt_time with type TIME.');
  const fks = foreignKeys(db, 'Appointments');
  if (!fks.find(f => f.from.toLowerCase() === 'doctor_id'))
    msgs.push('Appointments is missing FK on doctor_id.');
  if (!fks.find(f => f.from.toLowerCase() === 'patient_id'))
    msgs.push('Appointments is missing FK on patient_id.');
  return msgs.length ? { passed: false, messages: msgs }
    : { passed: true, messages: ['3-table hospital schema with foreign keys created!'] };
});

const ddl18 = ex('ddl-18','ddl','E-commerce — Products and Orders','hard',
`Create a 2-table e-commerce schema:

1. \`Customers\` — customer_id INTEGER PK, name VARCHAR(50), email VARCHAR(80), country VARCHAR(30)
2. \`Orders\` — order_id INTEGER PK, customer_id INTEGER FK→Customers, order_date DATE, total_amount REAL`,
['Create Customers first, since Orders references it',
 'Use FOREIGN KEY (customer_id) REFERENCES Customers(customer_id)'],
'',
null, '',
(db, sql) => {
  const msgs = [];
  if (!tableExists(db, 'Customers')) msgs.push('Table Customers is missing.');
  if (!tableExists(db, 'Orders'))    msgs.push('Table Orders is missing.');
  if (msgs.length) return { passed: false, messages: msgs };
  const cCols = tableInfo(db, 'Customers');
  if (!hasColumn(cCols,'customer_id','INTEGER')) msgs.push('Customers is missing customer_id with type INTEGER.');
  if (!hasColumn(cCols,'name','VARCHAR(50)')) msgs.push('Customers is missing name with type VARCHAR(50).');
  if (!hasColumn(cCols,'email','VARCHAR(80)')) msgs.push('Customers is missing email with type VARCHAR(80).');
  if (!hasColumn(cCols,'country','VARCHAR(30)')) msgs.push('Customers is missing country with type VARCHAR(30).');
  const oCols = tableInfo(db, 'Orders');
  if (!hasColumn(oCols,'order_id','INTEGER')) msgs.push('Orders is missing order_id with type INTEGER.');
  if (!hasColumn(oCols,'customer_id','INTEGER')) msgs.push('Orders is missing customer_id with type INTEGER.');
  if (!hasColumn(oCols,'order_date','DATE')) msgs.push('Orders is missing order_date (DATE).');
  if (!hasColumn(oCols,'total_amount','REAL')) msgs.push('Orders is missing total_amount (REAL).');
  const fks = foreignKeys(db, 'Orders');
  if (!fks.find(f => f.from.toLowerCase() === 'customer_id'))
    msgs.push('Orders is missing FOREIGN KEY on customer_id.');
  return msgs.length ? { passed: false, messages: msgs }
    : { passed: true, messages: ['E-commerce schema with Customers and Orders created!'] };
});

const ddl19 = ex('ddl-19','ddl','Content Management System','hard',
`Create a 3-table CMS schema:

1. \`Authors\` — author_id INTEGER PK, pen_name VARCHAR(50), join_date DATE
2. \`Articles\` — article_id INTEGER PK, title VARCHAR(200), author_id INTEGER FK→Authors, published DATE, is_published BOOLEAN
3. \`Comments\` — comment_id INTEGER PK, article_id INTEGER FK→Articles, commenter_name VARCHAR(50), posted_at DATE, content VARCHAR(500)`,
['Build in order: Authors → Articles → Comments',
 'Articles and Comments each need one foreign key'],
'',
null, '',
(db, sql) => {
  const msgs = [];
  ['Authors','Articles','Comments'].forEach(t => {
    if (!tableExists(db, t)) msgs.push(`Table ${t} is missing.`);
  });
  if (msgs.length) return { passed: false, messages: msgs };
  const authCols = tableInfo(db, 'Authors');
  if (!hasColumn(authCols,'author_id','INTEGER')) msgs.push('Authors is missing author_id with type INTEGER.');
  if (!hasColumn(authCols,'pen_name','VARCHAR(50)')) msgs.push('Authors is missing pen_name with type VARCHAR(50).');
  if (!hasColumn(authCols,'join_date','DATE')) msgs.push('Authors is missing join_date with type DATE.');
  const artCols = tableInfo(db, 'Articles');
  if (!hasColumn(artCols,'article_id','INTEGER')) msgs.push('Articles is missing article_id with type INTEGER.');
  if (!hasColumn(artCols,'title','VARCHAR(200)')) msgs.push('Articles is missing title with type VARCHAR(200).');
  if (!hasColumn(artCols,'author_id','INTEGER')) msgs.push('Articles is missing author_id with type INTEGER.');
  if (!hasColumn(artCols,'published','DATE')) msgs.push('Articles is missing published with type DATE.');
  const pubC = artCols.find(c => c.name.toLowerCase() === 'is_published');
  if (!pubC) msgs.push('Articles is missing is_published (BOOLEAN).');
  else if (!hasColumn(artCols,'is_published','BOOLEAN')) msgs.push('Articles is missing is_published with type BOOLEAN.');
  const comCols = tableInfo(db, 'Comments');
  if (!hasColumn(comCols,'comment_id','INTEGER')) msgs.push('Comments is missing comment_id with type INTEGER.');
  if (!hasColumn(comCols,'article_id','INTEGER')) msgs.push('Comments is missing article_id with type INTEGER.');
  if (!hasColumn(comCols,'commenter_name','VARCHAR(50)')) msgs.push('Comments is missing commenter_name with type VARCHAR(50).');
  if (!hasColumn(comCols,'posted_at','DATE')) msgs.push('Comments is missing posted_at with type DATE.');
  if (!hasColumn(comCols,'content','VARCHAR(500)')) msgs.push('Comments is missing content with type VARCHAR(500).');
  const artFKs = foreignKeys(db, 'Articles');
  if (!artFKs.find(f => f.from.toLowerCase() === 'author_id'))
    msgs.push('Articles is missing FK on author_id.');
  const comFKs = foreignKeys(db, 'Comments');
  if (!comFKs.find(f => f.from.toLowerCase() === 'article_id'))
    msgs.push('Comments is missing FK on article_id.');
  return msgs.length ? { passed: false, messages: msgs }
    : { passed: true, messages: ['Full CMS schema with 3 tables and foreign keys created!'] };
});

const ddl20 = ex('ddl-20','ddl','School Timetable Schema','hard',
`Design a complete school timetable database with 3 tables:

1. \`Teachers\` — teacher_id INTEGER PK, name VARCHAR(50), subject VARCHAR(40)
2. \`Classrooms\` — room_id INTEGER PK, room_name VARCHAR(10), capacity INTEGER
3. \`Timetable\` — lesson_id INTEGER PK, teacher_id INTEGER FK→Teachers, room_id INTEGER FK→Classrooms, day VARCHAR(10), period INTEGER, start_time TIME

Make sure all relationships are correct.`,
['Create Teachers and Classrooms first, then Timetable',
 'Timetable requires two foreign keys',
 'Use TIME for start_time'],
'',
null, '',
(db, sql) => {
  const msgs = [];
  ['Teachers','Classrooms','Timetable'].forEach(t => {
    if (!tableExists(db, t)) msgs.push(`Table ${t} is missing.`);
  });
  if (msgs.length) return { passed: false, messages: msgs };
  const tCols = tableInfo(db, 'Teachers');
  if (!hasColumn(tCols,'teacher_id','INTEGER')) msgs.push('Teachers is missing teacher_id with type INTEGER.');
  if (!hasColumn(tCols,'name','VARCHAR(50)')) msgs.push('Teachers is missing name with type VARCHAR(50).');
  if (!hasColumn(tCols,'subject','VARCHAR(40)')) msgs.push('Teachers is missing subject with type VARCHAR(40).');
  const cCols = tableInfo(db, 'Classrooms');
  if (!hasColumn(cCols,'room_id','INTEGER')) msgs.push('Classrooms is missing room_id with type INTEGER.');
  if (!hasColumn(cCols,'room_name','VARCHAR(10)')) msgs.push('Classrooms is missing room_name with type VARCHAR(10).');
  if (!hasColumn(cCols,'capacity','INTEGER')) msgs.push('Classrooms is missing capacity with type INTEGER.');
  const ttCols = tableInfo(db, 'Timetable');
  if (!hasColumn(ttCols,'lesson_id','INTEGER')) msgs.push('Timetable is missing lesson_id with type INTEGER.');
  if (!hasColumn(ttCols,'teacher_id','INTEGER')) msgs.push('Timetable is missing teacher_id with type INTEGER.');
  if (!hasColumn(ttCols,'room_id','INTEGER')) msgs.push('Timetable is missing room_id with type INTEGER.');
  if (!hasColumn(ttCols,'day','VARCHAR(10)')) msgs.push('Timetable is missing day with type VARCHAR(10).');
  if (!hasColumn(ttCols,'period','INTEGER')) msgs.push('Timetable is missing period with type INTEGER.');
  const stC = ttCols.find(c => c.name.toLowerCase() === 'start_time');
  if (!stC) msgs.push('Timetable is missing start_time (TIME).');
  else if (!hasColumn(ttCols,'start_time','TIME')) msgs.push('start_time should be type TIME.');
  const fks = foreignKeys(db, 'Timetable');
  if (!fks.find(f => f.from.toLowerCase() === 'teacher_id'))
    msgs.push('Timetable is missing FK on teacher_id.');
  if (!fks.find(f => f.from.toLowerCase() === 'room_id'))
    msgs.push('Timetable is missing FK on room_id.');
  return msgs.length ? { passed: false, messages: msgs }
    : { passed: true, messages: ['Complete timetable schema with 3 tables and 2 foreign keys!'] };
});

// ══════════════════════════════════════════════════════════════════════════════
// DML CHALLENGES  (dml-01 … dml-20)
// ══════════════════════════════════════════════════════════════════════════════

const dml01 = ex('dml-01','dml','SELECT — All Columns','easy',
`Using the **Bookshop** database, write a query to retrieve **all columns and all rows** from the \`books\` table.`,
['Use SELECT * to retrieve all columns', 'SELECT * FROM table_name;'],
'',
'bookshop', '',
(db, sql) => {
  const r = query(db, sql);
  if (!r) return { passed: false, messages: ['Your SQL produced an error. Check syntax.'] };
  if (r.rows.length !== 10)
    return { passed: false, messages: [`Expected 10 rows but got ${r.rows.length}. Select from the books table.`] };
  if (r.columns.length < 5)
    return { passed: false, messages: ['Use SELECT * to retrieve all columns.'] };
  return { passed: true, messages: ['All 10 books retrieved!'] };
});

const dml02 = ex('dml-02','dml','SELECT — Specific Columns','easy',
`From the **Bookshop** database, retrieve only the \`title\`, \`author\` and \`price\` columns from the \`books\` table.`,
['List column names separated by commas after SELECT',
 'SELECT col1, col2 FROM table_name;'],
'',
'bookshop', '',
(db, sql) => {
  const r = query(db, sql);
  if (!r) return { passed: false, messages: ['SQL error. Check your syntax.'] };
  if (r.rows.length !== 10)
    return { passed: false, messages: [`Expected 10 rows but got ${r.rows.length}.`] };
  const cols = r.columns.map(c => c.toLowerCase());
  const msgs = [];
  ['title','author','price'].forEach(c => {
    if (!cols.includes(c)) msgs.push(`Column "${c}" is missing from your results.`);
  });
  if (r.columns.length > 3) msgs.push('Select only title, author and price — you have extra columns.');
  return msgs.length ? { passed: false, messages: msgs }
    : { passed: true, messages: ['Correct — three columns retrieved!'] };
});

const dml03 = ex('dml-03','dml','SELECT with WHERE','easy',
`From the **Bookshop** database, retrieve all columns from \`books\` where the \`genre\` is \`'Fiction'\`.`,
['Use WHERE genre = \'Fiction\'', 'String values in SQL use single quotes'],
'',
'bookshop', '',
(db, sql) => {
  const r = query(db, sql);
  if (!r) return { passed: false, messages: ['SQL error. Check your syntax.'] };
  const actual = r.rows;
  if (actual.length !== 4)
    return { passed: false, messages: [`Expected 4 Fiction books but got ${actual.length}.`] };
  return { passed: true, messages: ['Correct — 4 Fiction books found!'] };
});

const dml04 = ex('dml-04','dml','SELECT with ORDER BY ASC','easy',
`From the **Employees** database, retrieve the \`name\` and \`salary\` columns from \`employees\`, **ordered by salary from lowest to highest**.`,
['Use ORDER BY column ASC (ASC is optional — it is the default)',
 'ORDER BY comes after FROM and WHERE clauses'],
'',
'employees', '',
(db, sql) => {
  const r = query(db, sql);
  if (!r) return { passed: false, messages: ['SQL error.'] };
  const expected = [[38000],[40000],[42000],[45000],[48000],[55000],[62000],[71000]];
  const salaries = r.rows.map(row => {
    const idx = r.columns.findIndex(c => c.toLowerCase() === 'salary');
    return [row[idx]];
  });
  if (!rowsEqOrdered(salaries, expected))
    return { passed: false, messages: ['Salaries are not sorted low to high. Use ORDER BY salary ASC.'] };
  return { passed: true, messages: ['Employees ordered by salary ascending!'] };
});

const dml05 = ex('dml-05','dml','SELECT with ORDER BY DESC','easy',
`From the **Bookshop** database, retrieve \`title\` and \`price\` from \`books\`, **ordered by price highest first**.`,
['Use ORDER BY price DESC', 'DESC means descending (highest to lowest)'],
'',
'bookshop', '',
(db, sql) => {
  const r = query(db, sql);
  if (!r) return { passed: false, messages: ['SQL error.'] };
  const expected = [[16.99],[15.99],[14.99],[13.99],[12.99],[12.49],[11.99],[10.99],[9.99],[8.99]];
  const prices = r.rows.map(row => {
    const idx = r.columns.findIndex(c => c.toLowerCase() === 'price');
    return [row[idx]];
  });
  if (!rowsEqOrdered(prices, expected))
    return { passed: false, messages: ['Prices are not sorted highest to lowest. Use ORDER BY price DESC.'] };
  return { passed: true, messages: ['Books ordered by price descending!'] };
});

const dml06 = ex('dml-06','dml','SELECT with AND','medium',
`From the **Employees** database, retrieve all columns where the \`department\` is \`'Engineering'\` **AND** the \`salary\` is greater than \`60000\`.`,
['Use WHERE condition1 AND condition2',
 'String comparison uses = and single quotes; numeric comparison uses >, <, etc.'],
'',
'employees', '',
(db, sql) => {
  const r = query(db, sql);
  if (!r) return { passed: false, messages: ['SQL error.'] };
  if (r.rows.length !== 2)
    return { passed: false, messages: [`Expected 2 rows (Carol White and Frank Wilson) but got ${r.rows.length}.`] };
  return { passed: true, messages: ['Correct — 2 Engineering employees with salary > 60000!'] };
});

const dml07 = ex('dml-07','dml','SELECT with OR','easy',
`From the **Bookshop** database, retrieve all columns from books where the genre is \`'Fiction'\` **OR** \`'Sci-Fi'\`.`,
['Use WHERE genre = \'Fiction\' OR genre = \'Sci-Fi\'',
 'Each side of OR is a full condition'],
'',
'bookshop', '',
(db, sql) => {
  const r = query(db, sql);
  if (!r) return { passed: false, messages: ['SQL error.'] };
  if (r.rows.length !== 6)
    return { passed: false, messages: [`Expected 6 rows (Fiction + Sci-Fi) but got ${r.rows.length}.`] };
  return { passed: true, messages: ['Correct — 6 Fiction and Sci-Fi books!'] };
});

const dml08 = ex('dml-08','dml','COUNT — Total Rows','easy',
`From the **Bookshop** database, use the \`COUNT\` function to find the **total number of books** in the \`books\` table.

Give the result an alias: \`total_books\`.`,
['Use COUNT(*) to count all rows',
 'Use AS to give a column an alias: COUNT(*) AS total_books'],
'',
'bookshop', '',
(db, sql) => {
  const r = query(db, sql);
  if (!r) return { passed: false, messages: ['SQL error.'] };
  if (!r.rows.length) return { passed: false, messages: ['No result returned.'] };
  const val = r.rows[0][0];
  if (Number(val) !== 10)
    return { passed: false, messages: [`Expected COUNT = 10 but got ${val}.`] };
  return { passed: true, messages: ['COUNT(*) = 10 — all books counted!'] };
});

const dml09 = ex('dml-09','dml','SUM — Total Salary by Department','medium',
`From the **Employees** database, find the **total salary** of all employees in the \`'Marketing'\` department.

Use \`SUM(salary)\` and give it the alias \`total_salary\`.`,
['Use SUM(column) to add up values',
 'Combine with WHERE to filter before aggregating'],
'',
'employees', '',
(db, sql) => {
  const r = query(db, sql);
  if (!r) return { passed: false, messages: ['SQL error.'] };
  if (!r.rows.length) return { passed: false, messages: ['No result returned.'] };
  const val = Number(r.rows[0][0]);
  if (Math.abs(val - 135000) > 0.01)
    return { passed: false, messages: [`Expected SUM = 135000 but got ${val}. Filter by department = 'Marketing'.`] };
  return { passed: true, messages: ['SUM(salary) for Marketing = 135000!'] };
});

const dml10 = ex('dml-10','dml','AVG — Average Salary','easy',
`From the **Employees** database, calculate the **average salary** across all employees.

Give the result the alias \`avg_salary\`.`,
['AVG(column) calculates the mean of a numeric column',
 'No WHERE clause needed — average all rows'],
'',
'employees', '',
(db, sql) => {
  const r = query(db, sql);
  if (!r) return { passed: false, messages: ['SQL error.'] };
  if (!r.rows.length) return { passed: false, messages: ['No result returned.'] };
  const val = Number(r.rows[0][0]);
  const expected = (55000+42000+62000+38000+45000+71000+40000+48000)/8;
  if (Math.abs(val - expected) > 1)
    return { passed: false, messages: [`Expected AVG ≈ ${expected.toFixed(2)} but got ${val.toFixed(2)}.`] };
  return { passed: true, messages: [`AVG(salary) = ${val.toFixed(2)}!`] };
});

const dml11 = ex('dml-11','dml','GROUP BY — Books by Genre','medium',
`From the **Bookshop** database, count how many books are in each genre.

Return: \`genre\`, \`num_books\` (using COUNT).
Group the results by \`genre\`.`,
['GROUP BY groups rows with the same value together',
 'Use COUNT(*) AS num_books to count each group',
 'SELECT genre, COUNT(*) AS num_books FROM books GROUP BY genre'],
'',
'bookshop', '',
(db, sql) => {
  const r = query(db, sql);
  if (!r) return { passed: false, messages: ['SQL error.'] };
  if (r.rows.length !== 4)
    return { passed: false, messages: [`Expected 4 genre groups but got ${r.rows.length}. Check GROUP BY genre.`] };
  const total = r.rows.reduce((s, row) => {
    const idx = r.columns.findIndex(c => c.toLowerCase().includes('count') || c.toLowerCase() === 'num_books');
    return s + Number(row[idx >= 0 ? idx : 1]);
  }, 0);
  if (total !== 10) return { passed: false, messages: [`Counts don't add up to 10 (got ${total}).`] };
  return { passed: true, messages: ['GROUP BY genre — 4 genre groups found!'] };
});

const dml12 = ex('dml-12','dml','GROUP BY + ORDER BY','medium',
`From the **Employees** database, find the **average salary per department**, and order the results by average salary **from highest to lowest**.

Return: \`department\`, \`avg_salary\`.`,
['Combine GROUP BY with ORDER BY',
 'You can ORDER BY an alias: ORDER BY avg_salary DESC',
 'Or use the expression: ORDER BY AVG(salary) DESC'],
'',
'employees', '',
(db, sql) => {
  const r = query(db, sql);
  if (!r) return { passed: false, messages: ['SQL error.'] };
  if (r.rows.length !== 3)
    return { passed: false, messages: [`Expected 3 departments but got ${r.rows.length}.`] };
  const avgIdx = r.columns.findIndex(c => c.toLowerCase().includes('avg') || c.toLowerCase() === 'avg_salary');
  const avgs = r.rows.map(row => Number(row[avgIdx >= 0 ? avgIdx : 1]));
  const isSorted = avgs.every((v, i) => i === 0 || v <= avgs[i-1]);
  if (!isSorted)
    return { passed: false, messages: ['Results are not ordered by avg_salary DESC. Add ORDER BY avg_salary DESC.'] };
  return { passed: true, messages: ['Department averages ordered highest to lowest!'] };
});

const dml13 = ex('dml-13','dml','INNER JOIN — Students and Subjects','medium',
`From the **School** database, join the \`enrollments\` and \`students\` tables to get the **name of each student and the subject_id they are enrolled in**.

Return: \`students.name\`, \`enrollments.subject_id\`

Use \`INNER JOIN students ON enrollments.student_id = students.student_id\`.`,
['INNER JOIN returns rows that have matching values in both tables',
 'Syntax: FROM table1 INNER JOIN table2 ON table1.id = table2.id',
 'Start FROM enrollments, then INNER JOIN students'],
'',
'school', '',
(db, sql) => {
  const r = query(db, sql);
  if (!r) return { passed: false, messages: ['SQL error — check your INNER JOIN syntax.'] };
  if (r.rows.length !== 24)
    return { passed: false, messages: [`Expected 24 enrolment rows but got ${r.rows.length}.`] };
  const cols = r.columns.map(c => c.toLowerCase());
  if (!cols.some(c => c.includes('name')))
    return { passed: false, messages: ['Column name from students is missing.'] };
  return { passed: true, messages: ['INNER JOIN successful — 24 student enrolments!'] };
});

const dml14 = ex('dml-14','dml','INNER JOIN with WHERE','medium',
`From the **Library** database, find all **current loans** (where \`return_date\` is NULL).

Join \`loans\` with \`members\` to return: \`members.name\`, \`loans.loan_date\`

Filter using \`WHERE loans.return_date IS NULL\`.`,
['IS NULL checks for missing values — not = NULL',
 'INNER JOIN members ON loans.member_id = members.member_id'],
'',
'library', '',
(db, sql) => {
  const r = query(db, sql);
  if (!r) return { passed: false, messages: ['SQL error.'] };
  if (r.rows.length !== 5)
    return { passed: false, messages: [`Expected 5 outstanding loans but got ${r.rows.length}. Use WHERE return_date IS NULL.`] };
  return { passed: true, messages: ['5 outstanding loans found with INNER JOIN and WHERE!'] };
});

const dml15 = ex('dml-15','dml','INNER JOIN + GROUP BY','hard',
`From the **Online Store** database, find the **number of orders placed by each customer**.

Join \`orders\` and \`customers\`. Return: \`customers.name\`, \`order_count\` (COUNT of orders).
Group by customer. Order by \`order_count\` DESC.`,
['Join orders to customers on customer_id',
 'GROUP BY customers.customer_id (or customers.name)',
 'Use COUNT(orders.order_id) AS order_count'],
'',
'store', '',
(db, sql) => {
  const r = query(db, sql);
  if (!r) return { passed: false, messages: ['SQL error.'] };
  if (r.rows.length !== 5 && r.rows.length !== 4)
    return { passed: false, messages: [`Expected 4-5 customer rows but got ${r.rows.length}.`] };
  const cntIdx = r.columns.findIndex(c => c.toLowerCase().includes('count') || c.toLowerCase() === 'order_count');
  const counts = r.rows.map(row => Number(row[cntIdx >= 0 ? cntIdx : 1]));
  const isSorted = counts.every((v, i) => i === 0 || v <= counts[i-1]);
  if (!isSorted)
    return { passed: false, messages: ['Order counts are not sorted DESC.'] };
  return { passed: true, messages: ['INNER JOIN + GROUP BY + ORDER BY — customer order counts!'] };
});

const dml16 = ex('dml-16','dml','INSERT INTO','easy',
`The **Bookshop** database is open. Insert a **new book** into the \`books\` table:
- book_id: \`11\`
- title: \`'The Martian'\`
- author: \`'Andy Weir'\`
- genre: \`'Sci-Fi'\`
- price: \`11.49\`
- stock: \`6\``,
['INSERT INTO table (col1, col2, ...) VALUES (val1, val2, ...);',
 'String values use single quotes; numbers do not'],
'',
'bookshop', '',
(db, sql) => {
  const r = query(db, "SELECT * FROM books WHERE book_id=11");
  if (!r || !r.rows.length)
    return { passed: false, messages: ['Book with book_id=11 was not inserted. Check your VALUES clause.'] };
  const row = r.rows[0];
  const colIdx = name => r.columns.findIndex(c => c.toLowerCase() === name);
  if (norm(row[colIdx('title')]) !== 'the martian')
    return { passed: false, messages: [`title should be 'The Martian'.`] };
  if (Math.abs(Number(row[colIdx('price')]) - 11.49) > 0.001)
    return { passed: false, messages: [`price should be 11.49.`] };
  return { passed: true, messages: ["'The Martian' inserted successfully!"] };
});

const dml17 = ex('dml-17','dml','UPDATE with WHERE','medium',
`In the **Employees** database, give all employees in the \`'HR'\` department a **10% pay rise**.

Update \`salary = salary * 1.1\` where \`department = 'HR'\`.`,
["UPDATE table SET column = expression WHERE condition;",
 "Salary * 1.1 increases it by 10%"],
'',
'employees', '',
(db, sql) => {
  const r = query(db, "SELECT name, salary FROM employees WHERE department='HR' ORDER BY employee_id");
  if (!r) return { passed: false, messages: ['SQL error.'] };
  const expected = [[38000*1.1],[40000*1.1]];
  const salaries = r.rows.map(row => [Number(row[1])]);
  if (!rowsEqOrdered(salaries, expected))
    return { passed: false, messages: ['HR salaries do not reflect a 10% increase. Check your UPDATE statement.'] };
  return { passed: true, messages: ['HR salaries updated by 10%!'] };
});

const dml18 = ex('dml-18','dml','DELETE FROM with WHERE','medium',
`In the **Library** database, delete all loans from the \`loans\` table where the \`return_date\` is **earlier than** \`'2024-02-01'\`.`,
["DELETE FROM table WHERE condition;",
 "Use < '2024-02-01' to find dates before February 2024",
 "Use the dd/mm/yyyy format consistently when storing dates"],
'',
'library', '',
(db, sql) => {
  const r = query(db, "SELECT COUNT(*) FROM loans");
  if (!r) return { passed: false, messages: ['SQL error.'] };
  const count = Number(r.rows[0][0]);
  // Originally 9 loans; loans before 2024-02-01 have return_date '2024-01-25' (loan 1) — 1 row deleted
  if (count !== 8)
    return { passed: false, messages: [`Expected 8 remaining loans but found ${count}. Delete where return_date < '2024-02-01'.`] };
  return { passed: true, messages: ['1 old loan deleted — 8 loans remain!'] };
});

const dml19 = ex('dml-19','dml','GROUP BY with Multiple Aggregates','hard',
`From the **Bookshop** database, for each \`genre\` calculate:
- \`num_books\` — count of books
- \`avg_price\` — average price
- \`total_stock\` — sum of stock

Order by \`num_books\` descending.`,
['You can use multiple aggregate functions in one SELECT',
 'SELECT genre, COUNT(*) AS num_books, AVG(price) AS avg_price, SUM(stock) AS total_stock'],
'',
'bookshop', '',
(db, sql) => {
  const r = query(db, sql);
  if (!r) return { passed: false, messages: ['SQL error.'] };
  if (r.rows.length !== 4)
    return { passed: false, messages: [`Expected 4 genre rows but got ${r.rows.length}.`] };
  const cols = r.columns.map(c => c.toLowerCase());
  const msgs = [];
  if (!cols.some(c => c.includes('count') || c === 'num_books')) msgs.push('COUNT(*) / num_books is missing.');
  if (!cols.some(c => c.includes('avg')   || c === 'avg_price'))  msgs.push('AVG(price) / avg_price is missing.');
  if (!cols.some(c => c.includes('sum')   || c === 'total_stock'))msgs.push('SUM(stock) / total_stock is missing.');
  if (msgs.length) return { passed: false, messages: msgs };
  return { passed: true, messages: ['Multiple aggregates with GROUP BY — excellent!'] };
});

const dml20 = ex('dml-20','dml','INNER JOIN with SUM','hard',
`From the **Online Store** database, find the **total quantity ordered for each product**.

Join \`order_items\` with \`products\`. Return \`products.name\`, \`total_qty\` (SUM of quantity).
Group by product. Order by total_qty DESC.`,
['JOIN order_items to products ON order_items.product_id = products.product_id',
 'SUM(order_items.quantity) AS total_qty',
 'GROUP BY products.product_id'],
'',
'store', '',
(db, sql) => {
  const r = query(db, sql);
  if (!r) return { passed: false, messages: ['SQL error.'] };
  if (r.rows.length < 6)
    return { passed: false, messages: [`Expected at least 6 product rows but got ${r.rows.length}.`] };
  const qIdx = r.columns.findIndex(c => c.toLowerCase().includes('qty') || c.toLowerCase().includes('sum'));
  const quantities = r.rows.map(row => Number(row[qIdx >= 0 ? qIdx : 1]));
  const isSorted = quantities.every((v, i) => i === 0 || v <= quantities[i-1]);
  if (!isSorted)
    return { passed: false, messages: ['Results are not ordered by total_qty DESC.'] };
  return { passed: true, messages: ['Product quantities totalled and sorted with INNER JOIN!'] };
});

// ══════════════════════════════════════════════════════════════════════════════
// COMBINED DDL + DML  (combo-01 … combo-20)
// ══════════════════════════════════════════════════════════════════════════════

const combo01 = ex('combo-01','combined','Create, Insert and Select','easy',
`Create a table called \`Colours\` with:
- \`colour_id\` INTEGER PRIMARY KEY
- \`colour_name\` VARCHAR(20)

Then insert these 5 rows: Red, Green, Blue, Yellow, Purple (ids 1–5).
Finally, write a \`SELECT *\` to retrieve all rows.`,
['Write CREATE TABLE first, then INSERT INTO, then SELECT',
 'Separate statements with semicolons'],
'',
null, '',
(db, sql) => {
  if (!tableExists(db, 'Colours'))
    return { passed: false, messages: ['Table Colours was not created.'] };
  const r = query(db, 'SELECT * FROM Colours ORDER BY colour_id');
  if (!r) return { passed: false, messages: ['Error querying Colours.'] };
  if (r.rows.length !== 5)
    return { passed: false, messages: [`Expected 5 rows but found ${r.rows.length}. Insert all 5 colours.`] };
  return { passed: true, messages: ['Colours table created with 5 rows!'] };
});

const combo02 = ex('combo-02','combined','Animals Database','easy',
`Create a table called \`Animals\` with:
- \`animal_id\` INTEGER PRIMARY KEY
- \`name\` VARCHAR(30)
- \`species\` VARCHAR(30)
- \`age\` INTEGER

Insert at least 4 animals (at least 2 different species). Then select all animals of one species using WHERE.`,
['Use WHERE species = \'...\' to filter by species',
 'Make sure at least 2 rows match your WHERE condition'],
'',
null, '',
(db, sql) => {
  if (!tableExists(db, 'Animals'))
    return { passed: false, messages: ['Table Animals was not created.'] };
  const r = query(db, 'SELECT * FROM Animals');
  if (!r || r.rows.length < 4)
    return { passed: false, messages: [`Insert at least 4 animals (found ${r ? r.rows.length : 0}).`] };
  if (!hasKeyword(sql,'WHERE'))
    return { passed: false, messages: ["Include a SELECT ... WHERE species = '...' query."] };
  return { passed: true, messages: ['Animals table created, populated and queried!'] };
});

const combo03 = ex('combo-03','combined','Temperature Records','easy',
`Create a table called \`Temperatures\` with:
- \`city\` VARCHAR(30)
- \`temp_c\` REAL
- \`recorded\` DATE

Insert at least 5 rows with different cities and temperatures. Select all records **ordered by temp_c descending**.`,
['REAL is the correct type for decimal temperatures',
 'DATE stores dates as dd/mm/yyyy',
 'ORDER BY temp_c DESC'],
'',
null, '',
(db, sql) => {
  if (!tableExists(db, 'Temperatures'))
    return { passed: false, messages: ['Table Temperatures was not created.'] };
  const r = query(db, 'SELECT * FROM Temperatures');
  if (!r || r.rows.length < 5)
    return { passed: false, messages: [`Insert at least 5 temperature records (found ${r ? r.rows.length : 0}).`] };
  if (!hasKeyword(sql,'ORDER BY'))
    return { passed: false, messages: ['Include an ORDER BY temp_c DESC in your SELECT.'] };
  const cols = tableInfo(db, 'Temperatures');
  const tempC = cols.find(c => c.name.toLowerCase() === 'temp_c');
  if (!tempC || !tempC.type.includes('REAL'))
    return { passed: false, messages: ['temp_c should be type REAL.'] };
  return { passed: true, messages: ['Temperature records created and sorted!'] };
});

const combo04 = ex('combo-04','combined','Student Clubs with UPDATE','medium',
`Create a table called \`ClubMembers\` with:
- \`member_id\` INTEGER PRIMARY KEY
- \`student_name\` VARCHAR(50)
- \`club_name\` VARCHAR(30)
- \`joined_date\` DATE

Insert 5 members. Then UPDATE the \`club_name\` for one specific member. Finally SELECT all.`,
['UPDATE ClubMembers SET club_name = \'...\' WHERE member_id = X',
 'Make sure the updated row appears in your SELECT results'],
'',
null, '',
(db, sql) => {
  if (!tableExists(db, 'ClubMembers'))
    return { passed: false, messages: ['Table ClubMembers was not created.'] };
  const r = query(db, 'SELECT * FROM ClubMembers');
  if (!r || r.rows.length < 5)
    return { passed: false, messages: [`Insert at least 5 members (found ${r ? r.rows.length : 0}).`] };
  if (!hasKeyword(sql,'UPDATE'))
    return { passed: false, messages: ['Include an UPDATE statement to change one club name.'] };
  if (!hasKeyword(sql,'SELECT'))
    return { passed: false, messages: ['Include a final SELECT to show the results.'] };
  return { passed: true, messages: ['ClubMembers created, populated, updated and selected!'] };
});

const combo05 = ex('combo-05','combined','Product Inventory Query','medium',
`Create a table called \`Inventory\` with:
- \`item_id\` INTEGER PRIMARY KEY
- \`item_name\` VARCHAR(50)
- \`quantity\` INTEGER
- \`unit_price\` REAL

Insert 6 items. Then SELECT items where \`unit_price < 20.00\`, ordered by \`unit_price\` ascending.`,
['Insert a variety of prices so some are below 20 and some are above',
 'WHERE unit_price < 20.00 ORDER BY unit_price ASC'],
'',
null, '',
(db, sql) => {
  if (!tableExists(db, 'Inventory'))
    return { passed: false, messages: ['Table Inventory was not created.'] };
  const r = query(db, 'SELECT * FROM Inventory');
  if (!r || r.rows.length < 6)
    return { passed: false, messages: [`Insert at least 6 items (found ${r ? r.rows.length : 0}).`] };
  if (!hasKeyword(sql,'WHERE'))
    return { passed: false, messages: ['Add a WHERE unit_price < 20.00 condition.'] };
  if (!hasKeyword(sql,'ORDER BY'))
    return { passed: false, messages: ['Add ORDER BY unit_price ASC.'] };
  return { passed: true, messages: ['Inventory created and queried with WHERE and ORDER BY!'] };
});

const combo06 = ex('combo-06','combined','COUNT by Category','medium',
`Create a table called \`Tasks\` with:
- \`task_id\` INTEGER PRIMARY KEY
- \`title\` VARCHAR(100)
- \`category\` VARCHAR(20)
- \`completed\` BOOLEAN
- \`due_date\` DATE

Insert 8 tasks (at least 3 different categories). Then write a query to count tasks per category using \`GROUP BY category\`.`,
['Use COUNT(*) AS task_count with GROUP BY category',
 'BOOLEAN is used for true/false values'],
'',
null, '',
(db, sql) => {
  if (!tableExists(db, 'Tasks'))
    return { passed: false, messages: ['Table Tasks was not created.'] };
  const r = query(db, 'SELECT * FROM Tasks');
  if (!r || r.rows.length < 8)
    return { passed: false, messages: [`Insert at least 8 tasks (found ${r ? r.rows.length : 0}).`] };
  if (!hasKeyword(sql,'GROUP BY'))
    return { passed: false, messages: ['Use GROUP BY category to count tasks per category.'] };
  if (!hasKeyword(sql,'COUNT'))
    return { passed: false, messages: ['Use COUNT(*) to count tasks in each group.'] };
  return { passed: true, messages: ['Tasks created and grouped by category!'] };
});

const combo07 = ex('combo-07','combined','ALTER TABLE then Query','medium',
`A table called \`Staff\` has been created with: \`staff_id\`, \`name\`, \`salary\`.

1. Use \`ALTER TABLE\` to add a \`department\` column (VARCHAR(30))
2. Insert 5 staff members (including their department)
3. SELECT staff from one specific department using WHERE`,
['Alter the table before inserting data',
 'INSERT INTO Staff (staff_id, name, salary, department) VALUES (...)',
 'WHERE department = \'...\''],
'',
null,
`CREATE TABLE Staff (
  staff_id INTEGER PRIMARY KEY,
  name     VARCHAR(50),
  salary   REAL
);`,
(db, sql) => {
  const cols = tableInfo(db, 'Staff');
  if (!cols.find(c => c.name.toLowerCase() === 'department'))
    return { passed: false, messages: ['The department column has not been added. Use ALTER TABLE Staff ADD department VARCHAR(30).'] };
  const r = query(db, 'SELECT * FROM Staff');
  if (!r || r.rows.length < 5)
    return { passed: false, messages: [`Insert at least 5 staff members (found ${r ? r.rows.length : 0}).`] };
  if (!hasKeyword(sql,'WHERE'))
    return { passed: false, messages: ["Include a SELECT ... WHERE department = '...' query."] };
  return { passed: true, messages: ['Staff table altered, populated and queried!'] };
});

const combo08 = ex('combo-08','combined','INSERT then DELETE','medium',
`Create a table called \`EventLog\` with:
- \`log_id\` INTEGER PRIMARY KEY
- \`event_type\` VARCHAR(30)
- \`event_date\` DATE
- \`severity\` INTEGER

Insert 6 log entries (mix of severities 1–5). Then DELETE all entries where \`severity < 3\`. Finally SELECT the remaining entries.`,
['DELETE FROM EventLog WHERE severity < 3',
 'Use SELECT * after deleting to show what remains'],
'',
null, '',
(db, sql) => {
  if (!tableExists(db, 'EventLog'))
    return { passed: false, messages: ['Table EventLog was not created.'] };
  if (!hasKeyword(sql,'DELETE'))
    return { passed: false, messages: ['Include a DELETE FROM statement.'] };
  const r = query(db, 'SELECT * FROM EventLog WHERE severity < 3');
  if (r && r.rows.length > 0)
    return { passed: false, messages: ['Some rows with severity < 3 were not deleted.'] };
  const remaining = query(db, 'SELECT * FROM EventLog');
  if (!remaining || remaining.rows.length === 0)
    return { passed: false, messages: ['All rows were deleted — there should be some remaining with severity >= 3.'] };
  return { passed: true, messages: ['Log entries inserted, low-severity ones deleted!'] };
});

const combo09 = ex('combo-09','combined','Relational Tables with INNER JOIN','hard',
`Create two related tables:

1. \`Genres\` — genre_id INTEGER PK, genre_name VARCHAR(30)
2. \`Films\` — film_id INTEGER PK, title VARCHAR(100), genre_id INTEGER FK→Genres, year INTEGER, rating REAL

Insert 3 genres and 6 films. Then write an INNER JOIN query to show each film's title alongside its genre_name.`,
['Create Genres first, then Films with a FOREIGN KEY',
 'INNER JOIN Films ON Genres.genre_id = Films.genre_id',
 'SELECT Films.title, Genres.genre_name FROM Films INNER JOIN Genres ON ...'],
'',
null, '',
(db, sql) => {
  if (!tableExists(db, 'Genres')) return { passed: false, messages: ['Table Genres is missing.'] };
  if (!tableExists(db, 'Films'))  return { passed: false, messages: ['Table Films is missing.'] };
  const g = query(db, 'SELECT COUNT(*) FROM Genres');
  const f = query(db, 'SELECT COUNT(*) FROM Films');
  if (!g || Number(g.rows[0][0]) < 3)
    return { passed: false, messages: ['Insert at least 3 genres.'] };
  if (!f || Number(f.rows[0][0]) < 6)
    return { passed: false, messages: ['Insert at least 6 films.'] };
  if (!hasAnyKeyword(sql,'INNER JOIN','JOIN'))
    return { passed: false, messages: ['Include an INNER JOIN between Films and Genres.'] };
  return { passed: true, messages: ['Two-table film database with INNER JOIN!'] };
});

const combo10 = ex('combo-10','combined','Aggregate on Created Data','medium',
`Create a table called \`Sales\` with:
- \`sale_id\` INTEGER PK
- \`product\` VARCHAR(50)
- \`region\` VARCHAR(20)
- \`amount\` REAL
- \`sale_date\` DATE

Insert 10 sales across at least 3 regions. Write a query to find the **total amount per region** using SUM and GROUP BY, ordered highest first.`,
['SUM(amount) AS total_amount GROUP BY region ORDER BY total_amount DESC'],
'',
null, '',
(db, sql) => {
  if (!tableExists(db, 'Sales')) return { passed: false, messages: ['Table Sales is missing.'] };
  const r = query(db, 'SELECT * FROM Sales');
  if (!r || r.rows.length < 10)
    return { passed: false, messages: [`Insert at least 10 sales (found ${r ? r.rows.length : 0}).`] };
  if (!hasKeyword(sql,'GROUP BY'))
    return { passed: false, messages: ['Use GROUP BY region.'] };
  if (!hasKeyword(sql,'SUM'))
    return { passed: false, messages: ['Use SUM(amount) to total each region.'] };
  return { passed: true, messages: ['Sales totalled by region!'] };
});

const combo11 = ex('combo-11','combined','School Report System','hard',
`Design and populate a mini school report system:

1. Create \`Pupils\` — pupil_id PK, name VARCHAR(50), year_group INTEGER
2. Create \`Reports\` — report_id PK, pupil_id FK, subject VARCHAR(40), score INTEGER, report_date DATE

Insert 4 pupils and 8 reports. Then write a query to find each pupil's **average score**, showing pupil name and avg_score, ordered by avg_score DESC.`,
['Join Reports to Pupils on pupil_id',
 'SELECT Pupils.name, AVG(Reports.score) AS avg_score',
 'GROUP BY Pupils.pupil_id ORDER BY avg_score DESC'],
'',
null, '',
(db, sql) => {
  if (!tableExists(db, 'Pupils'))  return { passed: false, messages: ['Table Pupils is missing.'] };
  if (!tableExists(db, 'Reports')) return { passed: false, messages: ['Table Reports is missing.'] };
  const p = query(db, 'SELECT COUNT(*) FROM Pupils');
  const r = query(db, 'SELECT COUNT(*) FROM Reports');
  if (!p || Number(p.rows[0][0]) < 4) return { passed: false, messages: ['Insert at least 4 pupils.'] };
  if (!r || Number(r.rows[0][0]) < 8) return { passed: false, messages: ['Insert at least 8 reports.'] };
  if (!hasAnyKeyword(sql,'INNER JOIN','JOIN'))
    return { passed: false, messages: ['Use an INNER JOIN between Pupils and Reports.'] };
  if (!hasKeyword(sql,'AVG'))
    return { passed: false, messages: ['Use AVG(score) to calculate average scores.'] };
  return { passed: true, messages: ['School report system built and queried!'] };
});

const combo12 = ex('combo-12','combined','Full CRUD Sequence','hard',
`Demonstrate a complete CRUD (Create, Read, Update, Delete) cycle:

1. **CREATE** a table called \`Contacts\` — contact_id PK, name VARCHAR(50), phone VARCHAR(20), email VARCHAR(80), active BOOLEAN
2. **INSERT** 5 contacts
3. **UPDATE** one contact's phone number
4. **DELETE** one contact (use WHERE active = 0, or set one to inactive first)
5. **SELECT** all remaining contacts`,
['Statements execute in order — CREATE, then INSERT, then UPDATE, then DELETE, then SELECT',
 'Make sure your final SELECT returns 4 rows'],
'',
null, '',
(db, sql) => {
  if (!tableExists(db, 'Contacts')) return { passed: false, messages: ['Table Contacts is missing.'] };
  if (!hasKeyword(sql,'UPDATE'))    return { passed: false, messages: ['Include an UPDATE statement.'] };
  if (!hasKeyword(sql,'DELETE'))    return { passed: false, messages: ['Include a DELETE statement.'] };
  const r = query(db, 'SELECT * FROM Contacts');
  if (!r) return { passed: false, messages: ['SQL error reading Contacts.'] };
  if (r.rows.length !== 4)
    return { passed: false, messages: [`After INSERT 5 + DELETE 1, expect 4 contacts (found ${r.rows.length}).`] };
  return { passed: true, messages: ['Full CRUD cycle completed — 4 contacts remain!'] };
});

const combo13 = ex('combo-13','combined','Flights Database','hard',
`Create a 2-table flights database:

1. \`Airlines\` — airline_id PK, airline_name VARCHAR(50), country VARCHAR(30)
2. \`Flights\` — flight_id PK, airline_id FK, destination VARCHAR(50), departure_date DATE, price REAL

Insert 3 airlines and 8 flights. Find all flights with price between £100 and £500, showing flight_id, destination, airline_name and price, ordered by price.`,
['Use BETWEEN 100 AND 500, or WHERE price >= 100 AND price <= 500',
 'INNER JOIN Flights to Airlines',
 'ORDER BY price ASC'],
'',
null, '',
(db, sql) => {
  if (!tableExists(db, 'Airlines')) return { passed: false, messages: ['Table Airlines is missing.'] };
  if (!tableExists(db, 'Flights'))  return { passed: false, messages: ['Table Flights is missing.'] };
  const f = query(db, 'SELECT COUNT(*) FROM Flights');
  if (!f || Number(f.rows[0][0]) < 8) return { passed: false, messages: ['Insert at least 8 flights.'] };
  if (!hasKeyword(sql,'JOIN'))
    return { passed: false, messages: ['Use INNER JOIN to connect Flights and Airlines.'] };
  if (!hasKeyword(sql,'ORDER BY'))
    return { passed: false, messages: ['Order the results by price.'] };
  return { passed: true, messages: ['Flight search with INNER JOIN and price filter!'] };
});

const combo14 = ex('combo-14','combined','Exam Results Tracker','hard',
`Build an exam results tracker:

1. Create \`Subjects\` — subject_id PK, subject_name VARCHAR(40), max_marks INTEGER
2. Create \`Results\` — result_id PK, student_name VARCHAR(50), subject_id FK, marks INTEGER, exam_date DATE

Insert 3 subjects and 9 results. Write a query that shows subject_name, COUNT(*) AS num_results, AVG(marks) AS avg_marks, ordered by avg_marks DESC.`,
['Join Results to Subjects',
 'SELECT Subjects.subject_name, COUNT(*) AS num_results, AVG(Results.marks) AS avg_marks',
 'GROUP BY Subjects.subject_id ORDER BY avg_marks DESC'],
'',
null, '',
(db, sql) => {
  if (!tableExists(db, 'Subjects')) return { passed: false, messages: ['Table Subjects is missing.'] };
  if (!tableExists(db, 'Results'))  return { passed: false, messages: ['Table Results is missing.'] };
  const r = query(db, 'SELECT COUNT(*) FROM Results');
  if (!r || Number(r.rows[0][0]) < 9) return { passed: false, messages: ['Insert at least 9 results.'] };
  if (!hasKeyword(sql,'JOIN'))  return { passed: false, messages: ['Use INNER JOIN between Results and Subjects.'] };
  if (!hasKeyword(sql,'AVG'))   return { passed: false, messages: ['Use AVG(marks) in your query.'] };
  if (!hasKeyword(sql,'GROUP BY')) return { passed: false, messages: ['Use GROUP BY subject.'] };
  return { passed: true, messages: ['Exam results tracker built and analysed!'] };
});

const combo15 = ex('combo-15','combined','Library Catalogue','hard',
`Create a mini library catalogue:

1. \`LibAuthors\` — author_id PK, author_name VARCHAR(80), nationality VARCHAR(30)
2. \`LibCatalogue\` — catalogue_id PK, author_id FK, book_title VARCHAR(150), genre VARCHAR(30), year INTEGER, copies_available INTEGER

Insert 4 authors and 8 books. Then:
- SELECT all available books (copies_available > 0) with author name, title and genre
- Order by author_name`,
['JOIN LibCatalogue to LibAuthors',
 'WHERE copies_available > 0',
 'ORDER BY LibAuthors.author_name'],
'',
null, '',
(db, sql) => {
  if (!tableExists(db, 'LibAuthors'))    return { passed: false, messages: ['Table LibAuthors is missing.'] };
  if (!tableExists(db, 'LibCatalogue'))  return { passed: false, messages: ['Table LibCatalogue is missing.'] };
  const b = query(db, 'SELECT COUNT(*) FROM LibCatalogue');
  if (!b || Number(b.rows[0][0]) < 8) return { passed: false, messages: ['Insert at least 8 books.'] };
  if (!hasKeyword(sql,'JOIN')) return { passed: false, messages: ['Use INNER JOIN to connect books with authors.'] };
  if (!hasKeyword(sql,'WHERE')) return { passed: false, messages: ['Filter using WHERE copies_available > 0.'] };
  return { passed: true, messages: ['Library catalogue with availability filter!'] };
});

const combo16 = ex('combo-16','combined','Student Attendance','hard',
`Create an attendance system:

1. \`Classes\` — class_id PK, class_name VARCHAR(30), teacher VARCHAR(50)
2. \`Attendance\` — att_id PK, class_id FK, student_name VARCHAR(50), att_date DATE, present BOOLEAN

Insert 3 classes and 12 attendance records. Then find the **attendance count per class** for records where present is true, showing class_name and present_count. Order by present_count DESC.`,
['Use a condition that keeps only rows where present is true',
 'GROUP BY class_id with COUNT(*) or COUNT(CASE WHEN present = TRUE THEN 1 END)'],
'',
null, '',
(db, sql) => {
  if (!tableExists(db, 'Classes'))     return { passed: false, messages: ['Table Classes is missing.'] };
  if (!tableExists(db, 'Attendance'))  return { passed: false, messages: ['Table Attendance is missing.'] };
  const a = query(db, 'SELECT COUNT(*) FROM Attendance');
  if (!a || Number(a.rows[0][0]) < 12) return { passed: false, messages: ['Insert at least 12 attendance records.'] };
  if (!hasKeyword(sql,'JOIN'))       return { passed: false, messages: ['JOIN Attendance to Classes.'] };
  if (!hasKeyword(sql,'GROUP BY'))   return { passed: false, messages: ['GROUP BY class to count attendance.'] };
  return { passed: true, messages: ['Attendance system built and summarised!'] };
});

const combo17 = ex('combo-17','combined','Music Playlist App','medium',
`Create a \`Playlist\` table with:
- \`track_id\` INTEGER PK
- \`title\` VARCHAR(100)
- \`artist\` VARCHAR(80)
- \`genre\` VARCHAR(30)
- \`duration_secs\` INTEGER
- \`added_date\` DATE

Insert 10 tracks. Then:
1. Find the total duration per genre (SUM + GROUP BY)
2. Show genres with more than 2 tracks using having-style filtering`,
['You can combine WHERE with GROUP BY',
 'Or use a subquery in WHERE (advanced)',
 'At minimum: SELECT genre, COUNT(*), SUM(duration_secs) FROM Playlist GROUP BY genre'],
'',
null, '',
(db, sql) => {
  if (!tableExists(db, 'Playlist')) return { passed: false, messages: ['Table Playlist is missing.'] };
  const r = query(db, 'SELECT COUNT(*) FROM Playlist');
  if (!r || Number(r.rows[0][0]) < 10) return { passed: false, messages: ['Insert at least 10 tracks.'] };
  if (!hasKeyword(sql,'SUM') && !hasKeyword(sql,'COUNT'))
    return { passed: false, messages: ['Use SUM or COUNT in your query.'] };
  if (!hasKeyword(sql,'GROUP BY')) return { passed: false, messages: ['Use GROUP BY genre.'] };
  return { passed: true, messages: ['Playlist analysed by genre!'] };
});

const combo18 = ex('combo-18','combined','Sports League','hard',
`Design a sports league database:

1. \`Teams\` — team_id PK, team_name VARCHAR(50), home_city VARCHAR(30), founded_year INTEGER
2. \`Matches\` — match_id PK, home_team_id FK→Teams, away_team_id FK→Teams, match_date DATE, home_score INTEGER, away_score INTEGER

Insert 4 teams and 6 matches. Write a query to show all matches with the home team name and away team name (two JOINs to the same table using aliases).`,
['Alias the Teams table twice: JOIN Teams AS h ON match.home_team_id = h.team_id',
 'Then JOIN Teams AS a ON match.away_team_id = a.team_id',
 'SELECT h.team_name AS home, a.team_name AS away, home_score, away_score'],
'',
null, '',
(db, sql) => {
  if (!tableExists(db, 'Teams'))   return { passed: false, messages: ['Table Teams is missing.'] };
  if (!tableExists(db, 'Matches')) return { passed: false, messages: ['Table Matches is missing.'] };
  const m = query(db, 'SELECT COUNT(*) FROM Matches');
  if (!m || Number(m.rows[0][0]) < 6) return { passed: false, messages: ['Insert at least 6 matches.'] };
  const fks = foreignKeys(db,'Matches');
  if (fks.length < 2)
    return { passed: false, messages: ['Matches should have two foreign keys (home_team_id and away_team_id).'] };
  if (!hasKeyword(sql,'JOIN'))
    return { passed: false, messages: ['Use JOIN(s) to get team names for each match.'] };
  return { passed: true, messages: ['Sports league with self-join to Teams!'] };
});

const combo19 = ex('combo-19','combined','Hotel Booking System','hard',
`Create a hotel booking system:

1. \`Rooms\` — room_id PK, room_number VARCHAR(5), room_type VARCHAR(20), price_per_night REAL
2. \`Bookings\` — booking_id PK, room_id FK, guest_name VARCHAR(50), check_in DATE, check_out DATE, total_cost REAL

Insert 5 rooms and 8 bookings. Then:
- Find the average total_cost per room_type using INNER JOIN, GROUP BY and AVG
- Order by average cost DESC`,
['JOIN Bookings to Rooms on room_id',
 'GROUP BY Rooms.room_type',
 'AVG(Bookings.total_cost) AS avg_cost'],
'',
null, '',
(db, sql) => {
  if (!tableExists(db, 'Rooms'))    return { passed: false, messages: ['Table Rooms is missing.'] };
  if (!tableExists(db, 'Bookings')) return { passed: false, messages: ['Table Bookings is missing.'] };
  const b = query(db, 'SELECT COUNT(*) FROM Bookings');
  if (!b || Number(b.rows[0][0]) < 8) return { passed: false, messages: ['Insert at least 8 bookings.'] };
  if (!hasKeyword(sql,'JOIN'))     return { passed: false, messages: ['JOIN Bookings to Rooms.'] };
  if (!hasKeyword(sql,'AVG'))      return { passed: false, messages: ['Use AVG(total_cost).'] };
  if (!hasKeyword(sql,'GROUP BY')) return { passed: false, messages: ['GROUP BY room_type.'] };
  return { passed: true, messages: ['Hotel bookings grouped by room type!'] };
});

const combo20 = ex('combo-20','combined','Complete Database Design','hard',
`Design a **complete database** of your choice with:

Requirements:
- At least **3 tables**
- At least **2 FOREIGN KEY** relationships
- Use at least **4 different data types** (INTEGER, VARCHAR, REAL, DATE or TIME or BOOLEAN or CHARACTER)
- Insert at least **5 rows per table**
- Write at least **3 different queries**: one with WHERE, one with GROUP BY, one with INNER JOIN

This is your capstone challenge — demonstrate everything you have learned about SQL DDL and DML.`,
['Plan your tables first — what are the entities and their relationships?',
 'Create parent tables (no FKs) before child tables',
 'Test each query after writing it'],
'',
null, '',
(db, sql) => {
  const tables = query(db, `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`);
  if (!tables || tables.rows.length < 3)
    return { passed: false, messages: [`Need at least 3 tables (found ${tables ? tables.rows.length : 0}).`] };
  const tableNames = tables.rows.map(r => r[0]);
  let totalFKs = 0;
  tableNames.forEach(t => { totalFKs += foreignKeys(db, t).length; });
  if (totalFKs < 2)
    return { passed: false, messages: ['Need at least 2 FOREIGN KEY relationships.'] };
  let anyTableUnder5 = false;
  tableNames.forEach(t => {
    const r = query(db, `SELECT COUNT(*) FROM "${t}"`);
    const count = r ? Number(r.rows[0][0]) : 0;
    if (count < 5) anyTableUnder5 = true;
  });
  if (anyTableUnder5)
    return { passed: false, messages: ['Each table needs at least 5 rows.'] };
  if (!hasKeyword(sql,'WHERE'))
    return { passed: false, messages: ['Include at least one SELECT with a WHERE clause.'] };
  if (!hasKeyword(sql,'GROUP BY'))
    return { passed: false, messages: ['Include at least one SELECT with GROUP BY.'] };
  if (!hasKeyword(sql,'JOIN'))
    return { passed: false, messages: ['Include at least one INNER JOIN query.'] };
  return { passed: true, messages: [`Complete database design — ${tableNames.length} tables, ${totalFKs} foreign keys!`] };
});

// ══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ══════════════════════════════════════════════════════════════════════════════

export const EXERCISES = [
  // DDL
  ddl01,ddl02,ddl03,ddl04,ddl05,ddl06,ddl07,ddl08,ddl09,ddl10,
  ddl11,ddl12,ddl13,ddl14,ddl15,ddl16,ddl17,ddl18,ddl19,ddl20,
  // DML
  dml01,dml02,dml03,dml04,dml05,dml06,dml07,dml08,dml09,dml10,
  dml11,dml12,dml13,dml14,dml15,dml16,dml17,dml18,dml19,dml20,
  // Combined
  combo01,combo02,combo03,combo04,combo05,combo06,combo07,combo08,combo09,combo10,
  combo11,combo12,combo13,combo14,combo15,combo16,combo17,combo18,combo19,combo20,
];
