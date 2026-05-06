// ─── SQL Engine ───────────────────────────────────────────────────────────────
// Wraps sql.js (WebAssembly SQLite) to provide in-browser SQL execution.
// sql.js is loaded from CDN via a <script> tag in index.html.

const SQL_JS_CDN = 'https://cdn.jsdelivr.net/npm/sql.js@1.10.2/dist/';

let _SQL = null;  // cached sql.js module

// ── Initialise sql.js once ────────────────────────────────────────────────────

export async function initSQLEngine() {
  if (_SQL) return _SQL;
  _SQL = await window.initSqlJs({
    locateFile: file => SQL_JS_CDN + file
  });
  return _SQL;
}

// ── Execute SQL against an in-memory database ─────────────────────────────────
// Returns: { results: [{columns, rows}], error: string|null, db }
// Caller is responsible for calling db.close() when done.

export function createDatabase(SQL, setupSQL = '') {
  const db = new SQL.Database();
  if (setupSQL.trim()) {
    try {
      db.run(setupSQL);
    } catch (e) {
      db.close();
      throw new Error('Database setup failed: ' + e.message);
    }
  }
  return db;
}

// Execute one or more SQL statements and collect results.
// Returns: { results: [{columns, rows, type}], error: string|null, rowsAffected: number }
export function executeSQL(db, sql) {
  const stmts = normalizeDateLiterals(stripUnsupportedStatements(sql)).trim();
  if (!stmts) return { results: [], error: null, rowsAffected: 0 };

  try {
    const rawResults = db.exec(stmts);
    const results = rawResults.map(r => ({
      columns: r.columns,
      rows: r.values,
      type: 'select'
    }));

    // For DML statements that produce no result set, report changes
    const rowsAffected = db.getRowsModified();

    return { results, error: null, rowsAffected };
  } catch (e) {
    return { results: [], error: e.message, rowsAffected: 0 };
  }
}

function stripUnsupportedStatements(sql) {
  return String(sql || '')
    .replace(/^\s*CREATE\s+DATABASE\s+[A-Za-z_][A-Za-z0-9_]*\s*;?\s*/gim, '')
    .replace(/CREATE\s+DATABASE\s+[A-Za-z_][A-Za-z0-9_]*\s*;?/gi, '');
}

function normalizeDateLiterals(sql) {
  return String(sql || '').replace(/#(\d{1,2})\/(\d{1,2})\/(\d{4})#/g, (_match, day, month, year) => {
    const dd = String(day).padStart(2, '0');
    const mm = String(month).padStart(2, '0');
    return `'${year}-${mm}-${dd}'`;
  });
}

// ── Schema introspection ──────────────────────────────────────────────────────

export function getSchema(db) {
  try {
    const tables = db.exec(
      `SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
    );
    if (!tables.length) return [];

    return tables[0].values.map(([name, sql]) => {
      const cols = getTableColumns(db, name);
      const fks  = getForeignKeys(db, name);
      const pk   = getPrimaryKey(db, name);
      return { name, sql, columns: cols, foreignKeys: fks, primaryKey: pk };
    });
  } catch {
    return [];
  }
}

export function getTableColumns(db, tableName) {
  try {
    const res = db.exec(`PRAGMA table_info("${tableName}")`);
    if (!res.length) return [];
    return res[0].values.map(([cid, name, type, notnull, dflt, pk]) => ({
      cid, name, type: type || '', notNull: !!notnull, defaultValue: dflt, primaryKey: !!pk
    }));
  } catch {
    return [];
  }
}

export function getForeignKeys(db, tableName) {
  try {
    const res = db.exec(`PRAGMA foreign_key_list("${tableName}")`);
    if (!res.length) return [];
    return res[0].values.map(([id, seq, table, from, to]) => ({
      id, seq, referencedTable: table, fromColumn: from, toColumn: to
    }));
  } catch {
    return [];
  }
}

function getPrimaryKey(db, tableName) {
  const cols = getTableColumns(db, tableName);
  return cols.filter(c => c.primaryKey).map(c => c.name);
}

export function previewTable(db, tableName, limit = 20) {
  try {
    const res = db.exec(`SELECT * FROM "${tableName}" LIMIT ${limit}`);
    if (!res.length) return { columns: [], rows: [] };
    return { columns: res[0].columns, rows: res[0].values };
  } catch (e) {
    return { columns: [], rows: [], error: e.message };
  }
}

export function getDMLTargetTables(sql) {
  const cleaned = String(sql || '')
    .replace(/'([^']|'')*'/g, "''")
    .replace(/--[^\n]*/g, '');
  const tableName = String.raw`(?:"([^"]+)"|\[([^\]]+)\]|` + '`([^`]+)`' + String.raw`|([A-Za-z_][A-Za-z0-9_]*))`;
  const patterns = [
    new RegExp(String.raw`\bINSERT\s+INTO\s+${tableName}`, 'gi'),
    new RegExp(String.raw`\bUPDATE\s+${tableName}`, 'gi'),
    new RegExp(String.raw`\bDELETE\s+FROM\s+${tableName}`, 'gi')
  ];
  const tables = [];

  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(cleaned))) {
      const name = match.slice(1).find(Boolean);
      if (name && !tables.some(existing => existing.toLowerCase() === name.toLowerCase())) {
        tables.push(name);
      }
    }
  });

  return tables;
}

export function tableRowCount(db, tableName) {
  try {
    const res = db.exec(`SELECT COUNT(*) FROM "${tableName}"`);
    return res.length ? res[0].values[0][0] : 0;
  } catch {
    return 0;
  }
}

// ── Result comparison helpers ─────────────────────────────────────────────────

// Normalise a value for comparison: trim strings, lowercase, coerce numbers.
function normalise(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return v;
  const s = String(v).trim();
  const n = Number(s);
  return isNaN(n) ? s.toLowerCase() : n;
}

// Compare two result row arrays regardless of row order.
export function rowsMatch(actual, expected) {
  if (actual.length !== expected.length) return false;
  const sortKey = rows => JSON.stringify(
    rows.map(r => r.map(normalise)).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  );
  return sortKey(actual) === sortKey(expected);
}

// Compare two result row arrays respecting row order (for ORDER BY challenges).
export function rowsMatchOrdered(actual, expected) {
  if (actual.length !== expected.length) return false;
  return actual.every((row, i) =>
    row.length === expected[i].length &&
    row.every((v, j) => normalise(v) === normalise(expected[i][j]))
  );
}

// Check if actual columns contain all expected column names (case-insensitive).
export function columnsMatch(actual, expected) {
  const a = actual.map(c => c.toLowerCase());
  return expected.every(e => a.includes(e.toLowerCase()));
}
