const express = require("express");
const { randomUUID } = require("crypto");
const db = require("../db");
const { validateExpense, CATEGORIES } = require("../validation");

const router = express.Router();

function serialise(row) {
  return {
    id: row.id,
    amount: (row.amount_paise / 100).toFixed(2),
    category: row.category,
    description: row.description,
    date: row.date,
    created_at: row.created_at,
  };
}

// ── POST /expenses ────────────────────────────────────────────────────────────
router.post("/", (req, res) => {
  const idempotencyKey = req.headers["idempotency-key"];
  if (!idempotencyKey || typeof idempotencyKey !== "string" || !idempotencyKey.trim()) {
    return res.status(400).json({
      error: "Idempotency-Key header is required.",
    });
  }
  const key = idempotencyKey.trim();

  const existing = db.prepare("SELECT expense_id FROM idempotency_keys WHERE key = ?").get(key);
  if (existing) {
    const expense = db.prepare("SELECT * FROM expenses WHERE id = ?").get(existing.expense_id);
    return res.status(200).json(serialise(expense));
  }

  const { data, errors } = validateExpense(req.body);
  if (errors) return res.status(422).json({ errors });

  const id = randomUUID();
  const now = new Date().toISOString();

  db.transaction(() => {
    db.prepare(
      `INSERT INTO expenses (id, amount_paise, category, description, date, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run([id, data.amount_paise, data.category, data.description, data.date, now]);

    db.prepare(
      `INSERT INTO idempotency_keys (key, expense_id, created_at) VALUES (?, ?, ?)`
    ).run([key, id, now]);
  })();

  const created = db.prepare("SELECT * FROM expenses WHERE id = ?").get(id);
  return res.status(201).json(serialise(created));
});

// ── GET /expenses ─────────────────────────────────────────────────────────────
router.get("/", (req, res) => {
  const { category, sort } = req.query;

  if (category && !CATEGORIES.includes(category)) {
    return res.status(400).json({
      error: `Unknown category. Valid values: ${CATEGORIES.join(", ")}`,
    });
  }

  const direction = sort === "date_asc" ? "ASC" : "DESC";
  let query = "SELECT * FROM expenses";
  const params = [];
  if (category) {
    query += " WHERE category = ?";
    params.push(category);
  }
  query += ` ORDER BY date ${direction}, created_at ${direction}`;

  const rows = db.prepare(query).all(...params);
  const expenses = rows.map(serialise);
  const totalPaise = rows.reduce((acc, r) => acc + r.amount_paise, 0);

  return res.json({
    expenses,
    total: (totalPaise / 100).toFixed(2),
    count: expenses.length,
  });
});

// ── GET /expenses/categories ──────────────────────────────────────────────────
router.get("/categories", (_req, res) => {
  res.json({ categories: CATEGORIES });
});

module.exports = router;
