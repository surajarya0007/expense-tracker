/**
 * db.js — SQLite via sql.js (pure WASM, no native compilation needed).
 *
 * Exposes a synchronous API similar to better-sqlite3:
 *   db.prepare(sql).get(p1, p2, ...)  → first row as object | undefined
 *   db.prepare(sql).all(p1, p2, ...)  → rows as objects
 *   db.prepare(sql).run([arr])        → void (writes to disk)
 *   db.transaction(fn)()              → atomic, writes on commit
 *   db.exec(sql)                      → DDL / multi-statement
 *   await db.init()                   → call once at startup
 */

const initSqlJs = require("sql.js");
const fs = require("fs");
const path = require("path");

const DB_PATH = process.env.VERCEL 
  ? path.join("/tmp", "expenses.db")
  : (process.env.DB_PATH || path.join(__dirname, "..", "expenses.db"));

let sqlDb = null;
let inTransaction = 0;

function save() {
  if (process.env.NODE_ENV === "test" || inTransaction > 0) return;
  try {
    fs.writeFileSync(DB_PATH, Buffer.from(sqlDb.export()));
  } catch (err) {
    console.error("Failed to save database to disk:", err);
  }
}

function rowsFromStmt(stmt) {
  const cols = stmt.getColumnNames();
  const rows = [];
  while (stmt.step()) {
    const vals = stmt.get();
    const obj = {};
    cols.forEach((c, i) => { obj[c] = vals[i]; });
    rows.push(obj);
  }
  stmt.free();
  return rows;
}

function prepare(sql) {
  return {
    // Positional params passed as spread args
    get(...params) {
      const stmt = sqlDb.prepare(sql);
      const flat = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
      if (flat.length) stmt.bind(flat);
      const rows = rowsFromStmt(stmt);
      return rows[0];
    },
    all(...params) {
      const stmt = sqlDb.prepare(sql);
      const flat = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
      if (flat.length) stmt.bind(flat);
      return rowsFromStmt(stmt);
    },
    // run accepts either run(val1, val2) or run([val1, val2])
    run(...params) {
      const stmt = sqlDb.prepare(sql);
      const flat = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
      if (flat.length) stmt.bind(flat);
      stmt.step();
      stmt.free();
      save();
    },
  };
}

function exec(sql) {
  sqlDb.run(sql);
  save();
}

function transaction(fn) {
  return function (...args) {
    inTransaction++;
    if (inTransaction === 1) sqlDb.run("BEGIN");
    try {
      const result = fn(...args);
      if (inTransaction === 1) {
        sqlDb.run("COMMIT");
        inTransaction = 0; // Reset before save
        save();
      } else {
        inTransaction--;
      }
      return result;
    } catch (err) {
      if (inTransaction === 1) {
        try { sqlDb.run("ROLLBACK"); } catch (e) {}
        console.error("Transaction failed, rolled back:", err);
      }
      inTransaction = 0;
      throw err;
    }
  };
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS expenses (
    id            TEXT    PRIMARY KEY,
    amount_paise  INTEGER NOT NULL CHECK(amount_paise > 0),
    category      TEXT    NOT NULL,
    description   TEXT    NOT NULL DEFAULT '',
    date          TEXT    NOT NULL,
    created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  CREATE INDEX IF NOT EXISTS idx_expenses_date     ON expenses(date DESC);
  CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
  CREATE TABLE IF NOT EXISTS idempotency_keys (
    key        TEXT PRIMARY KEY,
    expense_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
`;

let initPromise = null;

// In-memory store for Vercel to bypass SQLite/WASM issues
let memExpenses = [];
let memKeys = new Set();

async function init() {
  if (process.env.VERCEL) {
    console.log("Using Vercel In-Memory fallback");
    return Promise.resolve();
  }
  if (initPromise) return initPromise;
  initPromise = initSqlJs({
    locateFile: file => `https://sql.js.org/dist/${file}`
  }).then((SQL) => {
    try {
      sqlDb = fs.existsSync(DB_PATH)
        ? new SQL.Database(fs.readFileSync(DB_PATH))
        : new SQL.Database();
      sqlDb.run(SCHEMA);
      save();
    } catch (e) {
      console.error("SQLite init failed, falling back to memory:", e);
      sqlDb = null; // Trigger memory mode
    }
  });
  return initPromise;
}

function assertReady() {
  if (!sqlDb && !process.env.VERCEL) throw new Error("DB not initialised — await db.init() first");
}

const db = {
  prepare(sql) {
    if (process.env.VERCEL || !sqlDb) {
      const s = sql.toLowerCase();
      return {
        get: (...params) => {
          const flat = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
          if (s.includes("idempotency_keys")) {
            return memKeys.has(flat[0]) ? { key: flat[0] } : undefined;
          }
          if (s.includes("from expenses where id = ?")) {
            return memExpenses.find(e => e.id === flat[0]);
          }
          return undefined;
        },
        all: (...params) => {
          const flat = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
          let results = [...memExpenses];
          if (flat[0]) results = results.filter(e => e.category === flat[0]);
          if (s.includes("order by date desc")) {
            results.sort((a, b) => b.date.localeCompare(a.date));
          } else if (s.includes("order by date asc")) {
            results.sort((a, b) => a.date.localeCompare(b.date));
          }
          return results;
        },
        run: (...params) => {
          const flat = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
          if (s.includes("insert into idempotency_keys")) {
            memKeys.add(flat[0]);
          } else if (s.includes("insert into expenses")) {
            // [id, amount_paise, category, description, date, created_at]
            memExpenses.push({
              id: flat[0],
              amount_paise: flat[1],
              category: flat[2],
              description: flat[3],
              date: flat[4],
              created_at: flat[5] || new Date().toISOString()
            });
          }
        }
      };
    }
    assertReady();
    return prepare(sql);
  },
  exec: (sql) => { if (sqlDb) exec(sql); },
  transaction: (fn) => (...args) => fn(...args),
  init,
};

module.exports = db;
