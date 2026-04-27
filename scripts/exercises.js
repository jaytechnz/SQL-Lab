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

function actualTableName(db, name) {
  const r = query(db, `SELECT name FROM sqlite_master WHERE type='table' AND LOWER(name)='${name.toLowerCase()}'`);
  return r && r.rows.length ? String(r.rows[0][0]) : null;
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

function exactColumnName(cols, colName) {
  return cols.find(c => c.name === colName) || null;
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

function lastSqlStatement(sql) {
  return String(sql || '')
    .replace(/--.*$/gm, '')
    .split(';')
    .map(statement => statement.trim())
    .filter(Boolean)
    .at(-1) || '';
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
['Use the database creation command from DDL', 'Database names should be descriptive'],
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
`Create a table called \`Continents\` with the following fields:
- \`continent_id\` — INTEGER
- \`continent_name\` — VARCHAR(50)`,
['Define the table name first, then list each field with its data type', 'VARCHAR(n) stores variable-length text up to n characters'],
'',
null, '',
(db, sql) => {
  if (!tableExists(db, 'Continents'))
    return { passed: false, messages: ['Table Continents was not created.'] };
  const cols = tableInfo(db, 'Continents');
  const msgs = [];
  if (!hasColumn(cols,'continent_id','INTEGER'))   msgs.push('Field continent_id with type INTEGER is missing.');
  if (!hasColumn(cols,'continent_name','VARCHAR(50)')) msgs.push('Field continent_name with type VARCHAR(50) is missing.');
  return msgs.length ? { passed: false, messages: msgs } : { passed: true, messages: ['Table Continents created correctly!'] };
});

const ddl03 = ex('ddl-03','ddl','CREATE TABLE — CHARACTER Data Type','easy',
`Create a table called \`GradeRecords\` with these fields:
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
  if (!hasColumn(cols,'record_id','INTEGER')) msgs.push('Field record_id with type INTEGER is missing.');
  if (!hasColumn(cols,'student_name','VARCHAR(50)')) msgs.push('Field student_name with type VARCHAR(50) is missing.');
  const gradeCol = cols.find(c => c.name.toLowerCase() === 'grade');
  if (!gradeCol) msgs.push('Field grade is missing.');
  else if (!hasColumn(cols,'grade','CHARACTER')) msgs.push('Field grade should have type CHARACTER.');
  return msgs.length ? { passed: false, messages: msgs } : { passed: true, messages: ['GradeRecords created with a CHARACTER field!'] };
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
  if (!hasColumn(cols,'setting_id','INTEGER'))   msgs.push('Field setting_id with type INTEGER is missing.');
  if (!hasColumn(cols,'setting_name','VARCHAR(30)')) msgs.push('Field setting_name with type VARCHAR(30) is missing.');
  const boolCol = cols.find(c => c.name.toLowerCase() === 'is_enabled');
  if (!boolCol) msgs.push('Field is_enabled is missing.');
  else if (!hasColumn(cols,'is_enabled','BOOLEAN'))
    msgs.push('Field is_enabled should have type BOOLEAN.');
  return msgs.length ? { passed: false, messages: msgs } : { passed: true, messages: ['SystemSettings created with a BOOLEAN field!'] };
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
  if (!hasColumn(cols,'reading_id','INTEGER'))   msgs.push('Field reading_id with type INTEGER is missing.');
  if (!hasColumn(cols,'sensor_value','REAL')) msgs.push('Field sensor_value with type REAL is missing.');
  if (!hasColumn(cols,'unit','VARCHAR(10)'))         msgs.push('Field unit with type VARCHAR(10) is missing.');
  return msgs.length ? { passed: false, messages: msgs } : { passed: true, messages: ['SensorReadings created with a REAL field!'] };
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
  if (!hasColumn(cols,'holiday_id','INTEGER'))   msgs.push('Field holiday_id with type INTEGER is missing.');
  if (!hasColumn(cols,'holiday_name','VARCHAR(50)')) msgs.push('Field holiday_name with type VARCHAR(50) is missing.');
  const dateCol = cols.find(c => c.name.toLowerCase() === 'holiday_date');
  if (!dateCol) msgs.push('Field holiday_date is missing.');
  else if (!hasColumn(cols,'holiday_date','DATE')) msgs.push('Field holiday_date should have type DATE.');
  return msgs.length ? { passed: false, messages: msgs } : { passed: true, messages: ['PublicHolidays created with a DATE field!'] };
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
  if (!hasColumn(cols,'slot_id','INTEGER'))    msgs.push('Field slot_id with type INTEGER is missing.');
  if (!hasColumn(cols,'subject','VARCHAR(30)'))    msgs.push('Field subject with type VARCHAR(30) is missing.');
  const st = cols.find(c => c.name.toLowerCase() === 'start_time');
  const et = cols.find(c => c.name.toLowerCase() === 'end_time');
  if (!st) msgs.push('Field start_time is missing.');
  else if (!hasColumn(cols,'start_time','TIME')) msgs.push('Field start_time should have type TIME.');
  if (!et) msgs.push('Field end_time is missing.');
  else if (!hasColumn(cols,'end_time','TIME')) msgs.push('Field end_time should have type TIME.');
  return msgs.length ? { passed: false, messages: msgs } : { passed: true, messages: ['ClassSchedule created with TIME fields!'] };
});

const ddl08 = ex('ddl-08','ddl','CREATE TABLE — PRIMARY KEY Inline Syntax','easy',
`Create a table called \`Countries\` with:
- \`country_id\` — INTEGER, and make it the **PRIMARY KEY** field
- \`country_name\` — VARCHAR(50), and make it **NOT NULL**
- \`population\` — INTEGER

A primary key uniquely identifies each row in a table. A non-key field can also be required by marking it NOT NULL.`,
['Mark country_id as the key field', 'Use NOT NULL on country_name'],
'',
null, '',
(db, sql) => {
  if (!tableExists(db, 'Countries'))
    return { passed: false, messages: ['Table Countries was not created.'] };
  const cols = tableInfo(db, 'Countries');
  const msgs = [];
  if (!hasColumn(cols,'country_id','INTEGER'))   msgs.push('Field country_id with type INTEGER is missing.');
  if (!hasColumn(cols,'country_name','VARCHAR(50)')) msgs.push('Field country_name with type VARCHAR(50) is missing.');
  if (!hasColumn(cols,'population','INTEGER'))   msgs.push('Field population with type INTEGER is missing.');
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

Add the primary key using the **constraint syntax** at the end of the field list:
\`PRIMARY KEY (teacher_code)\``,
['Use the table-level primary key constraint for teacher_code',
 'Use NOT NULL on name'],
'',
null, '',
(db, sql) => {
  if (!tableExists(db, 'Teachers'))
    return { passed: false, messages: ['Table Teachers was not created.'] };
  const actualName = actualTableName(db, 'Teachers');
  if (actualName !== 'Teachers')
    return { passed: false, messages: ['The table name must be written exactly as Teachers, with the correct capital letter.'] };
  const cols = tableInfo(db, 'Teachers');
  const pkCol = exactColumnName(cols, 'teacher_code');
  if (!pkCol) return { passed: false, messages: ['Field teacher_code is missing.'] };
  if (!hasColumn(cols,'teacher_code','VARCHAR(10)')) return { passed: false, messages: ['teacher_code should have type VARCHAR(10).'] };
  if (!pkCol.pk) return { passed: false, messages: ['teacher_code must be set as PRIMARY KEY.'] };
  const nameCol = exactColumnName(cols, 'name');
  if (!nameCol) return { passed: false, messages: ['Field name is missing.'] };
  if (!hasColumn(cols,'name','VARCHAR(50)')) return { passed: false, messages: ['name should have type VARCHAR(50).'] };
  if (!nameCol.notNull) return { passed: false, messages: ['name should be marked NOT NULL.'] };
  if (!exactColumnName(cols, 'subject')) return { passed: false, messages: ['Field subject is missing.'] };
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
 'Make product_id the key field'],
'',
null, '',
(db, sql) => {
  if (!tableExists(db, 'Products'))
    return { passed: false, messages: ['Table Products was not created.'] };
  const cols = tableInfo(db, 'Products');
  const msgs = [];
  const pkCol = cols.find(c => c.name.toLowerCase() === 'product_id');
  if (!pkCol) msgs.push('Field product_id (INTEGER PRIMARY KEY) is missing.');
  else if (!pkCol.pk) msgs.push('product_id should be the PRIMARY KEY.');
  if (!hasColumn(cols,'name','VARCHAR(100)'))        msgs.push('Field name (VARCHAR(100)) is missing.');
  const sizeCodeCol = cols.find(c => c.name.toLowerCase() === 'size_code');
  if (!sizeCodeCol) msgs.push('Field size_code (CHARACTER) is missing.');
  else if (!hasColumn(cols,'size_code','CHARACTER')) msgs.push('Field size_code should be type CHARACTER.');
  if (!hasColumn(cols,'in_stock','BOOLEAN'))    msgs.push('Field in_stock (BOOLEAN) is missing.');
  if (!hasColumn(cols,'price','REAL'))msgs.push('Field price (REAL) is missing.');
  const dateCol = cols.find(c => c.name.toLowerCase() === 'added_date');
  if (!dateCol) msgs.push('Field added_date (DATE) is missing.');
  else if (!hasColumn(cols,'added_date','DATE')) msgs.push('Field added_date should be type DATE.');
  return msgs.length ? { passed: false, messages: msgs } : { passed: true, messages: ['All six Cambridge data types used correctly!'] };
});

const ddl11 = ex('ddl-11','ddl','ALTER TABLE — Add Column','easy',
`A \`Students\` table already exists with fields: \`student_id\`, \`name\`, \`year_group\`.

Use \`ALTER TABLE\` to **add** a new field:
- \`email\` — VARCHAR(100)`,
['Use the table alteration command to add the new field',
 'Add the field without recreating the table'],
'',
null,
`CREATE TABLE Students (
  student_id INTEGER PRIMARY KEY,
  name       VARCHAR(50),
  year_group INTEGER
);`,
(db, sql) => {
  if (!tableExists(db, 'Students'))
    return { passed: false, messages: ['The Students table was removed — only use ALTER TABLE to add the field.'] };
  const cols = tableInfo(db, 'Students');
  const emailCol = cols.find(c => c.name.toLowerCase() === 'email');
  if (!emailCol)
    return { passed: false, messages: ['Field email was not added. Use ALTER TABLE Students ADD email VARCHAR(100);'] };
  if (!hasColumn(cols,'email','VARCHAR(100)'))
    return { passed: false, messages: ['Field email should be VARCHAR(100).'] };
  return { passed: true, messages: ['email VARCHAR(100) field added successfully!'] };
});

const ddl12 = ex('ddl-12','ddl','ALTER TABLE — Add Multiple Columns','medium',
`A \`Books\` table exists with: \`book_id\`, \`title\`, \`author\`.

Add **two** new fields using ALTER TABLE:
1. \`isbn\` — VARCHAR(20)
2. \`publish_year\` — INTEGER`,
['You will need two separate table alteration statements — one for each column',
 'Add each new field to the existing Books table'],
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
  if (!isbn) msgs.push('Field isbn was not added.');
  else if (!hasColumn(cols,'isbn','VARCHAR(20)')) msgs.push('Field isbn should be VARCHAR(20).');
  if (!yr)   msgs.push('Field publish_year was not added.');
  else if (!hasColumn(cols,'publish_year','INTEGER')) msgs.push('Field publish_year should be INTEGER.');
  return msgs.length ? { passed: false, messages: msgs } : { passed: true, messages: ['Both fields added with ALTER TABLE!'] };
});

const ddl13 = ex('ddl-13','ddl','FOREIGN KEY Reference','medium',
`Two tables exist: \`Departments\` and \`Staff\`.

Departments has been created for you. Create the \`Staff\` table with:
- \`staff_id\` — INTEGER, PRIMARY KEY
- \`name\` — VARCHAR(50)
- \`dept_id\` — INTEGER
- A **FOREIGN KEY** on \`dept_id\` that references \`Departments(dept_id)\`

Syntax: \`FOREIGN KEY (field) REFERENCES Table (Field)\``,
['Add the foreign key as a table constraint linked to Departments(dept_id)',
 'The foreign key field and referenced field must be compatible types'],
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

1. Create a table called \`Authors\`.
- \`author_id\` — INTEGER, PRIMARY KEY
- \`name\` — VARCHAR(80)

2. Create a table called \`Books\`.
- \`book_id\` — INTEGER, PRIMARY KEY
- \`title\` — VARCHAR(100)
- \`genre\` — VARCHAR(30)
- \`price\` — REAL
- \`author_id\` — INTEGER
- Foreign key: \`author_id\` references \`Authors(author_id)\``,
['Create Authors first because Books references it',
 'Add a foreign key from Books.author_id to Authors.author_id'],
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
  if (!hasColumn(bCols,'title','VARCHAR(100)'))    msgs.push('Books is missing the title field with type VARCHAR(100).');
  if (!hasColumn(bCols,'author_id','INTEGER'))msgs.push('Books is missing the author_id field with type INTEGER.');
  if (!hasColumn(bCols,'genre','VARCHAR(30)')) msgs.push('Books is missing the genre field with type VARCHAR(30).');
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
  if (!dateC) msgs.push('Field appt_date (DATE) is missing.');
  else if (!hasColumn(cols,'appt_date','DATE')) msgs.push('appt_date should be type DATE.');
  if (!timeC) msgs.push('Field appt_time (TIME) is missing.');
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
['Run three separate table alteration commands',
 'Check each field name is spelled exactly as specified'],
'',
null,
`CREATE TABLE Vehicles (
  vehicle_id INTEGER PRIMARY KEY,
  make       VARCHAR(30)
);`,
(db, sql) => {
  const cols = tableInfo(db, 'Vehicles');
  const msgs = [];
  if (!hasColumn(cols,'model','VARCHAR(50)'))       msgs.push('Field model with type VARCHAR(50) is missing.');
  if (!hasColumn(cols,'year','INTEGER'))        msgs.push('Field year with type INTEGER is missing.');
  if (!hasColumn(cols,'price','REAL'))       msgs.push('Field price with type REAL is missing.');
  if (!hasColumn(cols,'vehicle_id','INTEGER'))  msgs.push('vehicle_id should still exist with type INTEGER.');
  if (!hasColumn(cols,'make','VARCHAR(30)')) msgs.push('make should still exist with type VARCHAR(30).');
  return msgs.length ? { passed: false, messages: msgs }
    : { passed: true, messages: ['Vehicles table extended with 3 new fields!'] };
});

const ddl17 = ex('ddl-17','ddl','Three-Table Hospital Schema','hard',
`First, create a database called \`Hospital\`.

Then create these three linked tables for that hospital database:

1. Create a table called \`Doctors\`.
\`doctor_id\` is the primary key field and must use INTEGER.
Also include \`name\` as VARCHAR(50) and \`speciality\` as VARCHAR(50).

2. Create a table called \`Patients\`.
\`patient_id\` is the primary key field and must use INTEGER.
Also include \`name\` as VARCHAR(50), \`dob\` as DATE, and \`blood_type\` as CHARACTER.

3. Create a table called \`Appointments\`.
\`appt_id\` is the primary key field and must use INTEGER.
Also include \`doctor_id\` as INTEGER, \`patient_id\` as INTEGER, \`appt_date\` as DATE, and \`appt_time\` as TIME.

In \`Appointments\`, add a foreign key from \`doctor_id\` to \`Doctors.doctor_id\`, and a foreign key from \`patient_id\` to \`Patients.patient_id\`.`,
['Create the database before creating its tables',
 'Create Doctors and Patients first, then Appointments',
 'Appointments needs two relationship constraints'],
'',
null, '',
(db, sql) => {
  const msgs = [];
  if (!/\bCREATE\s+DATABASE\s+Hospital\b/i.test(sql)) {
    msgs.push('You must include CREATE DATABASE Hospital.');
  }
  ['Doctors','Patients','Appointments'].forEach(t => {
    if (!tableExists(db, t)) msgs.push(`Table ${t} is missing.`);
  });
  if (msgs.length) return { passed: false, messages: msgs };
  const dCols = tableInfo(db, 'Doctors');
  if (!hasColumn(dCols,'doctor_id','INTEGER')) msgs.push('Doctors is missing doctor_id with type INTEGER.');
  if (!hasColumn(dCols,'name','VARCHAR(50)')) msgs.push('Doctors is missing name with type VARCHAR(50).');
  if (!hasColumn(dCols,'speciality','VARCHAR(50)')) msgs.push('Doctors is missing the speciality field with type VARCHAR(50).');
  const pCols = tableInfo(db, 'Patients');
  if (!hasColumn(pCols,'patient_id','INTEGER')) msgs.push('Patients is missing patient_id with type INTEGER.');
  if (!hasColumn(pCols,'name','VARCHAR(50)')) msgs.push('Patients is missing name with type VARCHAR(50).');
  const dobC = pCols.find(c => c.name.toLowerCase() === 'dob');
  if (!dobC) msgs.push('Patients is missing the dob field.');
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

1. Create a table called \`Customers\`.
- \`customer_id\` — INTEGER, PRIMARY KEY
- \`name\` — VARCHAR(50)
- \`email\` — VARCHAR(80)
- \`country\` — VARCHAR(30)

2. Create a table called \`Orders\`.
- \`order_id\` — INTEGER, PRIMARY KEY
- \`order_date\` — DATE
- \`total_amount\` — REAL
- \`customer_id\` — INTEGER
- Foreign key: \`customer_id\` references \`Customers(customer_id)\``,
['Create Customers first, since Orders references it',
 'Link Orders.customer_id to Customers.customer_id'],
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

Table 1: Create a table called \`Authors\`.
- \`author_id\` — INTEGER, PRIMARY KEY
- \`pen_name\` — VARCHAR(50)
- \`join_date\` — DATE

Table 2: Create a table called \`Articles\`.
- \`article_id\` — INTEGER, PRIMARY KEY
- \`title\` — VARCHAR(200)
- \`published\` — DATE
- \`is_published\` — BOOLEAN
- \`author_id\` — INTEGER
- Foreign key: \`author_id\` references \`Authors(author_id)\`

Table 3: Create a table called \`Comments\`.
- \`comment_id\` — INTEGER, PRIMARY KEY
- \`commenter_name\` — VARCHAR(50)
- \`posted_at\` — DATE
- \`content\` — VARCHAR(500)
- \`article_id\` — INTEGER
- Foreign key: \`article_id\` references \`Articles(article_id)\``,
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

Table 1: Create a table called \`Teachers\`.
- \`teacher_id\` — INTEGER, PRIMARY KEY
- \`name\` — VARCHAR(50)
- \`subject\` — VARCHAR(40)

Table 2: Create a table called \`Classrooms\`.
- \`room_id\` — INTEGER, PRIMARY KEY
- \`room_name\` — VARCHAR(10)
- \`capacity\` — INTEGER

Table 3: Create a table called \`Timetable\`.
- \`lesson_id\` — INTEGER, PRIMARY KEY
- \`day\` — VARCHAR(10)
- \`period\` — INTEGER
- \`start_time\` — TIME
- \`teacher_id\` — INTEGER
- \`room_id\` — INTEGER
- Foreign key: \`teacher_id\` references \`Teachers(teacher_id)\`
- Foreign key: \`room_id\` references \`Classrooms(room_id)\`

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
`Using the **Bookshop** database, write a query to retrieve **all fields and all rows** from the \`books\` table.`,
['Bookshop is the database name; `books` is the table name.',
 'Retrieve every field from the table',
 'Use the all-fields wildcard'],
'',
'bookshop', '',
(db, sql) => {
  const r = query(db, sql);
  if (!r) return { passed: false, messages: ['Your SQL produced an error. Check syntax.'] };
  if (r.rows.length !== 10)
    return { passed: false, messages: [`Expected 10 rows but got ${r.rows.length}. Select from the books table.`] };
  if (r.columns.length < 5)
    return { passed: false, messages: ['Use SELECT * to retrieve all fields.'] };
  return { passed: true, messages: ['All 10 books retrieved!'] };
});

const dml02 = ex('dml-02','dml','SELECT — Specific Columns','easy',
`From the **Bookshop** database, retrieve only the \`title\`, \`author\` and \`price\` fields from the \`books\` table.`,
['List only the required field names',
 'Separate selected field names with commas'],
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
['Filter on the genre field', 'String values in SQL use single quotes'],
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
['Sort by the salary field from low to high',
 'The sorting clause comes after the table and filter clauses'],
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
['Sort by the price field from high to low', 'DESC means descending (highest to lowest)'],
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
['Use two conditions joined by AND',
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
['Use two genre conditions joined by OR',
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
['Use the row-count aggregate',
 'Give the result column a clear alias'],
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
['Use the total aggregate to add up values',
 'Filter before aggregating'],
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
['The average aggregate calculates the mean of a numeric column',
 'Average all rows; no filtering is needed'],
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
['Group rows that have the same genre',
 'Count how many rows are in each group',
 'Return the genre and its count'],
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
['Group first, then sort the grouped results',
 'You can sort using the alias for the average salary',
 'Sort from the highest average salary to the lowest'],
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
`From the **School** database, join the \`enrolments\` and \`students\` tables to get the **name of each student and the subject_id they are enrolled in**.

Return: \`students.name\`, \`enrolments.subject_id\`

Start from the \`enrolments\` table, then use \`INNER JOIN students ON enrolments.student_id = students.student_id\`.`,
['INNER JOIN returns rows that have matching values in both tables',
 'Join the matching student_id fields'],
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
['IS NULL checks for missing values',
 'Join loans to members using member_id'],
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
['Join orders to customers using customer_id',
 'Group by each customer',
 'Count the orders for each customer'],
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
`The **Bookshop** database is open. Insert this tuple into the \`books\` table:
- (11, 'The Martian', 'Andy Weir', 'Sci-Fi', 11.49, 6)

The fields are: \`book_id\`, \`title\`, \`author\`, \`genre\`, \`price\`, \`stock\`.`,
['List the target fields and matching values in the same order',
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
["Change only the rows that match the HR department",
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
`In the **Library** database, delete all loans from the \`loans\` table where the \`return_date\` is **earlier than** \`#01/02/2024#\`.

Use the CIE-style date format \`#dd/mm/yyyy#\` in your query.`,
["Delete only the rows that match the date condition",
 "Compare the return date with the start of February 2024",
 "CIE-style date literals use # symbols around the date"],
'',
'library', '',
(db, sql) => {
  const r = query(db, "SELECT COUNT(*) FROM loans");
  if (!r) return { passed: false, messages: ['SQL error.'] };
  const count = Number(r.rows[0][0]);
  // Originally 9 loans; loans before 01/02/2024 have return_date 25/01/2024 (loan 1) — 1 row deleted
  if (count !== 8)
    return { passed: false, messages: [`Expected 8 remaining loans but found ${count}. Delete where return_date < #01/02/2024#.`] };
  return { passed: true, messages: ['1 old loan deleted — 8 loans remain!'] };
});

const dml19 = ex('dml-19','dml','GROUP BY with Multiple Aggregates','hard',
`From the **Bookshop** database, for each \`genre\` calculate:
- \`num_books\` — count of books
- \`avg_price\` — average price
- \`total_stock\` — sum of stock

Order by \`num_books\` descending.`,
['Use multiple aggregate functions in one query',
 'Group by genre and return count, average price, and total stock'],
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

Join \`orders_products\` with \`products\`. Return \`products.name\`, \`total_qty\` (SUM of quantity).
Group by product. Order by total_qty DESC.`,
['Join orders_products to products using product_id',
 'Total the quantity values for each product',
 'Group by each product'],
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

Then insert these tuples:
- (1, 'Red')
- (2, 'Green')
- (3, 'Blue')
- (4, 'Yellow')
- (5, 'Purple')

Finally, write a \`SELECT *\` to retrieve all rows.`,
['Create the table before adding rows, then query the completed table',
 'Separate statements with semicolons'],
'',
null, '',
(db, sql) => {
  if (!tableExists(db, 'Colours'))
    return { passed: false, messages: ['Table Colours was not created.'] };
  const finalStatement = lastSqlStatement(sql);
  if (!/^\s*SELECT\b/i.test(finalStatement) || !/\bFROM\s+["'`\[]?Colours["'`\]]?\b/i.test(finalStatement)) {
    return { passed: false, messages: ['The final statement must retrieve rows from the Colours table.'] };
  }
  const finalResult = query(db, finalStatement);
  if (!finalResult)
    return { passed: false, messages: ['The final statement could not be run. Check the query at the end.'] };
  if (finalResult.rows.length !== 5 || finalResult.columns.length < 2)
    return { passed: false, messages: ['The final statement must retrieve all fields and all 5 rows from Colours.'] };
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

Insert these tuples:
- (1, 'Luna', 'Cat', 3)
- (2, 'Milo', 'Dog', 5)
- (3, 'Nala', 'Cat', 2)
- (4, 'Buddy', 'Dog', 4)

Then select all animals of one species using WHERE.`,
['Filter using the species field',
 'Make sure at least 2 rows match your chosen species'],
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
- \`city\` VARCHAR(30) PRIMARY KEY NOT NULL
- \`temp_c\` REAL
- \`recorded\` DATE

Insert these tuples:
- ('Auckland', 21.5, #12/03/2024#)
- ('Wellington', 17.8, #12/03/2024#)
- ('Christchurch', 15.2, #12/03/2024#)
- ('Dunedin', 13.9, #12/03/2024#)
- ('Hamilton', 22.1, #12/03/2024#)

Select all records **ordered by temp_c descending**.`,
['REAL is the correct type for decimal temperatures',
 'DATE stores dates as dd/mm/yyyy',
 'Sort by temperature from highest to lowest'],
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

Insert these tuples:
- (1, 'Ava Patel', 'Chess', #05/02/2024#)
- (2, 'Noah Chen', 'Robotics', #07/02/2024#)
- (3, 'Mia Thompson', 'Drama', #09/02/2024#)
- (4, 'Leo Williams', 'Chess', #12/02/2024#)
- (5, 'Sofia Garcia', 'Debate', #15/02/2024#)

Then UPDATE the \`club_name\` for one specific member. Finally SELECT all.`,
['Choose one member by their ID and change that member\'s club name',
 'Make sure the updated row appears in your final results'],
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

Insert these tuples:
- (1, 'Notebook', 40, 4.50)
- (2, 'USB Cable', 18, 9.99)
- (3, 'Headphones', 12, 24.99)
- (4, 'Water Bottle', 25, 12.50)
- (5, 'Backpack', 8, 39.95)
- (6, 'Pen Set', 60, 3.75)

Then SELECT items where \`unit_price < 20.00\`, ordered by \`unit_price\` ascending.`,
['Insert a variety of prices so some are below 20 and some are above',
 'Filter by the price limit, then sort prices from lowest to highest'],
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

Insert these tuples:
- (1, 'Revise SQL joins', 'Study', FALSE, #18/03/2024#)
- (2, 'Submit project plan', 'Study', TRUE, #14/03/2024#)
- (3, 'Football training', 'Sport', FALSE, #19/03/2024#)
- (4, 'Buy groceries', 'Home', TRUE, #16/03/2024#)
- (5, 'Clean desk', 'Home', FALSE, #20/03/2024#)
- (6, 'Maths homework', 'Study', FALSE, #21/03/2024#)
- (7, 'Netball match', 'Sport', TRUE, #17/03/2024#)
- (8, 'Water plants', 'Home', FALSE, #22/03/2024#)

Then write a query to count tasks per category using \`GROUP BY category\`.`,
['Count the rows in each category group',
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
2. Insert these tuples:
- (1, 'Grace Lee', 52000, 'Admin')
- (2, 'Omar Khan', 61000, 'IT')
- (3, 'Ella Brown', 48000, 'Admin')
- (4, 'Jack Wilson', 57000, 'Finance')
- (5, 'Ivy Martin', 64000, 'IT')
3. SELECT staff from one specific department using WHERE`,
['Alter the table before inserting data',
 'Include the new department value when adding each staff member',
 'Filter staff by one chosen department'],
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

Insert these tuples:
- (1, 'Login', #01/03/2024#, 1)
- (2, 'Password Reset', #02/03/2024#, 2)
- (3, 'Payment Failed', #03/03/2024#, 4)
- (4, 'Server Warning', #04/03/2024#, 3)
- (5, 'Data Export', #05/03/2024#, 5)
- (6, 'Profile Update', #06/03/2024#, 2)

Then DELETE all entries where \`severity < 3\`. Finally SELECT the remaining entries.`,
['Remove only the low-severity entries',
 'Show the remaining rows after deleting'],
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

1. Create a table called \`Genres\`.
- \`genre_id\` — INTEGER, PRIMARY KEY
- \`genre_name\` — VARCHAR(30)

2. Create a table called \`Films\`.
- \`film_id\` — INTEGER, PRIMARY KEY
- \`title\` — VARCHAR(100)
- \`year\` — INTEGER
- \`rating\` — REAL
- \`genre_id\` — INTEGER
- Foreign key: \`genre_id\` references \`Genres(genre_id)\`

Insert these \`Genres\` tuples:
- (1, 'Comedy')
- (2, 'Action')
- (3, 'Animation')

Insert these \`Films\` tuples:
- (1, 'The Grand Mix-Up', 2021, 7.4, 1)
- (2, 'High Speed Chase', 2022, 6.9, 2)
- (3, 'Sky Robots', 2020, 8.1, 3)
- (4, 'Late Homework', 2019, 7.0, 1)
- (5, 'Mountain Rescue', 2023, 7.8, 2)
- (6, 'Ocean Friends', 2021, 8.3, 3)

Then write an INNER JOIN query to show each film's title alongside its genre_name.`,
['Create the parent table before the child table',
 'Match films to genres using the shared genre ID',
 'Show each film title beside its genre name'],
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

Insert these tuples:
- (1, 'Laptop Stand', 'North', 45.00, #01/03/2024#)
- (2, 'Keyboard', 'South', 79.99, #02/03/2024#)
- (3, 'Mouse', 'East', 24.50, #02/03/2024#)
- (4, 'Monitor', 'North', 199.00, #03/03/2024#)
- (5, 'Webcam', 'West', 59.95, #04/03/2024#)
- (6, 'Desk Lamp', 'South', 32.00, #05/03/2024#)
- (7, 'Chair Mat', 'East', 41.25, #06/03/2024#)
- (8, 'USB Hub', 'North', 28.75, #07/03/2024#)
- (9, 'Notebook', 'West', 6.50, #08/03/2024#)
- (10, 'Headset', 'South', 89.00, #09/03/2024#)

Write a query to find the **total amount per region** using SUM and GROUP BY, ordered highest first.`,
['Group sales by region, total each group, then sort the largest totals first'],
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

1. Create a table called \`Pupils\`.
- \`pupil_id\` — INTEGER, PRIMARY KEY
- \`name\` — VARCHAR(50)
- \`year_group\` — INTEGER

2. Create a table called \`Reports\`.
- \`report_id\` — INTEGER, PRIMARY KEY
- \`subject\` — VARCHAR(40)
- \`score\` — INTEGER
- \`report_date\` — DATE
- \`pupil_id\` — INTEGER
- Foreign key: \`pupil_id\` references \`Pupils(pupil_id)\`

Insert these \`Pupils\` tuples:
- (1, 'Amelia Stone', 12)
- (2, 'Ben Carter', 12)
- (3, 'Chloe Singh', 13)
- (4, 'Daniel Young', 13)

Insert these \`Reports\` tuples:
- (1, 'Computer Science', 82, #10/03/2024#, 1)
- (2, 'Mathematics', 78, #11/03/2024#, 1)
- (3, 'Computer Science', 69, #10/03/2024#, 2)
- (4, 'Mathematics', 74, #11/03/2024#, 2)
- (5, 'Computer Science', 91, #10/03/2024#, 3)
- (6, 'Mathematics', 88, #11/03/2024#, 3)
- (7, 'Computer Science', 76, #10/03/2024#, 4)
- (8, 'Mathematics', 81, #11/03/2024#, 4)

Then write a query to find each pupil's **average score**, showing pupil name and avg_score, ordered by avg_score DESC.`,
['Match reports to pupils using the shared pupil ID',
 'Calculate the average score for each pupil',
 'Sort the averages from highest to lowest'],
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
2. **INSERT** these tuples:
- (1, 'Hana Roberts', '021-555-1001', 'hana@example.com', TRUE)
- (2, 'Isaac Miller', '021-555-1002', 'isaac@example.com', TRUE)
- (3, 'Lily Ahmed', '021-555-1003', 'lily@example.com', FALSE)
- (4, 'Max Taylor', '021-555-1004', 'max@example.com', TRUE)
- (5, 'Nora Kim', '021-555-1005', 'nora@example.com', TRUE)
3. **UPDATE** one contact's phone number
4. **DELETE** one contact (use WHERE active = 0, or set one to inactive first)
5. **SELECT** all remaining contacts`,
['Run the steps in the same order as the task list',
 'Make sure the final result has 4 rows'],
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

1. Create a table called \`Airlines\`.
- \`airline_id\` — INTEGER, PRIMARY KEY
- \`airline_name\` — VARCHAR(50)
- \`country\` — VARCHAR(30)

2. Create a table called \`Flights\`.
- \`flight_id\` — INTEGER, PRIMARY KEY
- \`destination\` — VARCHAR(50)
- \`departure_date\` — DATE
- \`price\` — REAL
- \`airline_id\` — INTEGER
- Foreign key: \`airline_id\` references \`Airlines(airline_id)\`

Insert these \`Airlines\` tuples:
- (1, 'Southern Air', 'New Zealand')
- (2, 'Pacific Link', 'Australia')
- (3, 'SkyBridge', 'Singapore')

Insert these \`Flights\` tuples:
- (1, 'Sydney', #15/04/2024#, 280.00, 2)
- (2, 'Wellington', #16/04/2024#, 95.00, 1)
- (3, 'Singapore', #17/04/2024#, 720.00, 3)
- (4, 'Melbourne', #18/04/2024#, 340.00, 2)
- (5, 'Queenstown', #19/04/2024#, 180.00, 1)
- (6, 'Brisbane', #20/04/2024#, 410.00, 2)
- (7, 'Christchurch', #21/04/2024#, 130.00, 1)
- (8, 'Tokyo', #22/04/2024#, 890.00, 3)

Find all flights with price between £100 and £500, showing flight_id, destination, airline_name and price, ordered by price.`,
['Keep only flights inside the requested price range',
 'Match each flight to its airline',
 'Sort prices from lowest to highest'],
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

1. Create a table called \`Subjects\`.
- \`subject_id\` — INTEGER, PRIMARY KEY
- \`subject_name\` — VARCHAR(40)
- \`max_marks\` — INTEGER

2. Create a table called \`Results\`.
- \`result_id\` — INTEGER, PRIMARY KEY
- \`student_name\` — VARCHAR(50)
- \`marks\` — INTEGER
- \`exam_date\` — DATE
- \`subject_id\` — INTEGER
- Foreign key: \`subject_id\` references \`Subjects(subject_id)\`

Insert these \`Subjects\` tuples:
- (1, 'Computer Science', 100)
- (2, 'Mathematics', 100)
- (3, 'Physics', 100)

Insert these \`Results\` tuples:
- (1, 'Ava Patel', 84, #12/03/2024#, 1)
- (2, 'Noah Chen', 79, #12/03/2024#, 1)
- (3, 'Mia Thompson', 91, #12/03/2024#, 1)
- (4, 'Leo Williams', 76, #13/03/2024#, 2)
- (5, 'Sofia Garcia', 88, #13/03/2024#, 2)
- (6, 'Omar Khan', 73, #13/03/2024#, 2)
- (7, 'Ella Brown', 69, #14/03/2024#, 3)
- (8, 'Jack Wilson', 82, #14/03/2024#, 3)
- (9, 'Ivy Martin', 77, #14/03/2024#, 3)

Write a query that shows subject_name, COUNT(*) AS num_results, AVG(marks) AS avg_marks, ordered by avg_marks DESC.`,
['Match results to subjects using the shared subject ID',
 'Count results and calculate average marks for each subject',
 'Sort the subject averages from highest to lowest'],
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

1. Create a table called \`LibAuthors\`.
- \`author_id\` — INTEGER, PRIMARY KEY
- \`author_name\` — VARCHAR(80)
- \`nationality\` — VARCHAR(30)

2. Create a table called \`LibCatalogue\`.
- \`catalogue_id\` — INTEGER, PRIMARY KEY
- \`book_title\` — VARCHAR(150)
- \`genre\` — VARCHAR(30)
- \`year\` — INTEGER
- \`copies_available\` — INTEGER
- \`author_id\` — INTEGER
- Foreign key: \`author_id\` references \`LibAuthors(author_id)\`

Insert these \`LibAuthors\` tuples:
- (1, 'Ursula Le Guin', 'American')
- (2, 'Malorie Blackman', 'British')
- (3, 'Witi Ihimaera', 'New Zealand')
- (4, 'Andy Weir', 'American')

Insert these \`LibCatalogue\` tuples:
- (1, 'A Wizard of Earthsea', 'Fantasy', 1968, 3, 1)
- (2, 'The Left Hand of Darkness', 'Sci-Fi', 1969, 1, 1)
- (3, 'Noughts and Crosses', 'Fiction', 2001, 4, 2)
- (4, 'Pig-Heart Boy', 'Fiction', 1997, 0, 2)
- (5, 'The Whale Rider', 'Fiction', 1987, 2, 3)
- (6, 'Bulibasha', 'Fiction', 1994, 1, 3)
- (7, 'The Martian', 'Sci-Fi', 2011, 5, 4)
- (8, 'Project Hail Mary', 'Sci-Fi', 2021, 0, 4)

Then:
- SELECT all available books (copies_available > 0) with author name, title and genre
- Order by author_name`,
['Match catalogue rows to their authors',
 'Keep only books with at least one copy available',
 'Sort by author name'],
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

1. Create a table called \`Classes\`.
- \`class_id\` — INTEGER, PRIMARY KEY
- \`class_name\` — VARCHAR(30)
- \`teacher\` — VARCHAR(50)

2. Create a table called \`Attendance\`.
- \`att_id\` — INTEGER, PRIMARY KEY
- \`student_name\` — VARCHAR(50)
- \`att_date\` — DATE
- \`present\` — BOOLEAN
- \`class_id\` — INTEGER
- Foreign key: \`class_id\` references \`Classes(class_id)\`

Insert these \`Classes\` tuples:
- (1, 'AS Computer Science', 'Ms Smith')
- (2, 'AS Mathematics', 'Mr Patel')
- (3, 'AS Physics', 'Dr Lee')

Insert these \`Attendance\` tuples:
- (1, 'Ava Patel', #04/03/2024#, TRUE, 1)
- (2, 'Noah Chen', #04/03/2024#, TRUE, 1)
- (3, 'Mia Thompson', #04/03/2024#, FALSE, 1)
- (4, 'Leo Williams', #04/03/2024#, TRUE, 1)
- (5, 'Sofia Garcia', #04/03/2024#, TRUE, 2)
- (6, 'Omar Khan', #04/03/2024#, FALSE, 2)
- (7, 'Ella Brown', #04/03/2024#, TRUE, 2)
- (8, 'Jack Wilson', #04/03/2024#, TRUE, 2)
- (9, 'Ivy Martin', #04/03/2024#, TRUE, 3)
- (10, 'Grace Lee', #04/03/2024#, TRUE, 3)
- (11, 'Ben Carter', #04/03/2024#, FALSE, 3)
- (12, 'Chloe Singh', #04/03/2024#, TRUE, 3)

Then find the **attendance count per class** for records where present is true, showing class_name and present_count. Order by present_count DESC.`,
['Keep only rows where the student was present',
 'Count present records within each class group'],
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

Insert these tuples:
- (1, 'Bright Start', 'Nova Lane', 'Pop', 212, #01/03/2024#)
- (2, 'Late Night Code', 'Byte Club', 'Electronic', 245, #02/03/2024#)
- (3, 'Ocean Road', 'The Signals', 'Indie', 198, #03/03/2024#)
- (4, 'Static Dreams', 'Byte Club', 'Electronic', 231, #04/03/2024#)
- (5, 'Golden Hour', 'Nova Lane', 'Pop', 205, #05/03/2024#)
- (6, 'City Lights', 'The Signals', 'Indie', 224, #06/03/2024#)
- (7, 'Pulse Runner', 'Byte Club', 'Electronic', 256, #07/03/2024#)
- (8, 'Paper Planes', 'Maya North', 'Pop', 219, #08/03/2024#)
- (9, 'Rain Check', 'The Signals', 'Indie', 207, #09/03/2024#)
- (10, 'Solar Flare', 'Byte Club', 'Electronic', 263, #10/03/2024#)

Then:
1. Find the total duration per genre (SUM + GROUP BY)
2. Show genres with more than 2 tracks using having-style filtering`,
['Group tracks by genre',
 'Count tracks and total the duration for each genre',
 'Keep only genres with more than 2 tracks'],
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

1. Create a table called \`Teams\`.
- \`team_id\` — INTEGER, PRIMARY KEY
- \`team_name\` — VARCHAR(50)
- \`home_city\` — VARCHAR(30)
- \`founded_year\` — INTEGER

2. Create a table called \`Matches\`.
- \`match_id\` — INTEGER, PRIMARY KEY
- \`match_date\` — DATE
- \`home_score\` — INTEGER
- \`away_score\` — INTEGER
- \`home_team_id\` — INTEGER
- \`away_team_id\` — INTEGER
- Foreign key: \`home_team_id\` references \`Teams(team_id)\`
- Foreign key: \`away_team_id\` references \`Teams(team_id)\`

Insert these \`Teams\` tuples:
- (1, 'Auckland Aces', 'Auckland', 1997)
- (2, 'Wellington Waves', 'Wellington', 2001)
- (3, 'Christchurch Comets', 'Christchurch', 1995)
- (4, 'Dunedin Dynamos', 'Dunedin', 2004)

Insert these \`Matches\` tuples:
- (1, #01/04/2024#, 3, 1, 1, 2)
- (2, #03/04/2024#, 2, 2, 3, 4)
- (3, #05/04/2024#, 0, 1, 2, 3)
- (4, #07/04/2024#, 4, 2, 4, 1)
- (5, #09/04/2024#, 1, 3, 1, 3)
- (6, #11/04/2024#, 2, 0, 2, 4)

Write a query to show all matches with the home team name and away team name (two JOINs to the same table using aliases).`,
['Use the teams table twice, once for the home team and once for the away team',
 'Give each copy of the teams table a short alias',
 'Show the two team names beside the match scores'],
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

1. Create a table called \`Rooms\`.
- \`room_id\` — INTEGER, PRIMARY KEY
- \`room_number\` — VARCHAR(5)
- \`room_type\` — VARCHAR(20)
- \`price_per_night\` — REAL

2. Create a table called \`Bookings\`.
- \`booking_id\` — INTEGER, PRIMARY KEY
- \`guest_name\` — VARCHAR(50)
- \`check_in\` — DATE
- \`check_out\` — DATE
- \`total_cost\` — REAL
- \`room_id\` — INTEGER
- Foreign key: \`room_id\` references \`Rooms(room_id)\`

Insert these \`Rooms\` tuples:
- (1, '101', 'Single', 120.00)
- (2, '102', 'Single', 120.00)
- (3, '201', 'Double', 180.00)
- (4, '202', 'Double', 180.00)
- (5, '301', 'Suite', 320.00)

Insert these \`Bookings\` tuples:
- (1, 'Ava Patel', #01/05/2024#, #03/05/2024#, 240.00, 1)
- (2, 'Noah Chen', #02/05/2024#, #05/05/2024#, 540.00, 3)
- (3, 'Mia Thompson', #04/05/2024#, #06/05/2024#, 640.00, 5)
- (4, 'Leo Williams', #06/05/2024#, #07/05/2024#, 120.00, 2)
- (5, 'Sofia Garcia', #07/05/2024#, #10/05/2024#, 540.00, 4)
- (6, 'Omar Khan', #10/05/2024#, #12/05/2024#, 360.00, 3)
- (7, 'Ella Brown', #12/05/2024#, #15/05/2024#, 960.00, 5)
- (8, 'Jack Wilson', #14/05/2024#, #16/05/2024#, 240.00, 1)

Then:
- Find the average total_cost per room_type using INNER JOIN, GROUP BY and AVG
- Order by average cost DESC`,
['Match each booking to its room',
 'Group bookings by room type',
 'Calculate the average booking cost for each room type'],
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

If you do not want to invent your own data, use this starter idea:
- \`Customers\`: (1, 'Ava Patel', 'ava@example.com', TRUE, #01/02/2024#), (2, 'Noah Chen', 'noah@example.com', TRUE, #03/02/2024#), (3, 'Mia Thompson', 'mia@example.com', FALSE, #05/02/2024#), (4, 'Leo Williams', 'leo@example.com', TRUE, #07/02/2024#), (5, 'Sofia Garcia', 'sofia@example.com', TRUE, #09/02/2024#)
- \`Products\`: (1, 'Notebook', 'Stationery', 4.50, 80), (2, 'Pen Set', 'Stationery', 3.75, 120), (3, 'USB Cable', 'Electronics', 9.99, 35), (4, 'Headphones', 'Electronics', 24.99, 18), (5, 'Water Bottle', 'Accessories', 12.50, 45)
- \`Orders\`: (1, 1, 1, #10/02/2024#, 9.00), (2, 2, 3, #11/02/2024#, 19.98), (3, 4, 4, #12/02/2024#, 24.99), (4, 5, 5, #13/02/2024#, 25.00), (5, 1, 2, #14/02/2024#, 7.50)

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
