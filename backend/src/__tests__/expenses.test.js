const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const supertest = require("supertest");
const { randomUUID } = require("crypto");
const path = require("path");
const fs = require("fs");

const TEST_DB = path.join(__dirname, "..", "..", "test.db");
process.env.DB_PATH = TEST_DB;
process.env.NODE_ENV = "test";

// Clean up any leftover DB from a previous failed run
for (const f of [TEST_DB, TEST_DB + "-wal", TEST_DB + "-shm"]) {
  try { fs.unlinkSync(f); } catch {}
}

const { app, ready } = require("../index");

const VALID = {
  amount: "150.50",
  category: "Food",
  description: "Lunch",
  date: "2024-06-15",
};

let request;

before(async () => {
  await ready;
  request = supertest(app);
});

describe("POST /expenses", () => {
  it("creates expense → 201", async () => {
    const res = await request
      .post("/expenses")
      .set("Idempotency-Key", randomUUID())
      .send(VALID);
    assert.equal(res.status, 201);
    assert.equal(res.body.amount, "150.50");
    assert.equal(res.body.category, "Food");
    assert.ok(res.body.id);
    assert.ok(res.body.created_at);
  });

  it("idempotent → same id on retry", async () => {
    const key = randomUUID();
    const r1 = await request.post("/expenses").set("Idempotency-Key", key).send(VALID);
    const r2 = await request.post("/expenses").set("Idempotency-Key", key).send(VALID);
    assert.equal(r2.status, 200);
    assert.equal(r2.body.id, r1.body.id);
  });

  it("different keys → different expenses", async () => {
    const r1 = await request.post("/expenses").set("Idempotency-Key", randomUUID()).send(VALID);
    const r2 = await request.post("/expenses").set("Idempotency-Key", randomUUID()).send(VALID);
    assert.notEqual(r1.body.id, r2.body.id);
  });

  it("missing Idempotency-Key → 400", async () => {
    const res = await request.post("/expenses").send(VALID);
    assert.equal(res.status, 400);
  });

  it("negative amount → 422", async () => {
    const res = await request
      .post("/expenses")
      .set("Idempotency-Key", randomUUID())
      .send({ ...VALID, amount: "-5" });
    assert.equal(res.status, 422);
    assert.ok(res.body.errors.length > 0);
  });

  it("zero amount → 422", async () => {
    const res = await request
      .post("/expenses")
      .set("Idempotency-Key", randomUUID())
      .send({ ...VALID, amount: "0" });
    assert.equal(res.status, 422);
  });

  it("missing date → 422", async () => {
    const { date, ...noDate } = VALID;
    const res = await request
      .post("/expenses")
      .set("Idempotency-Key", randomUUID())
      .send(noDate);
    assert.equal(res.status, 422);
  });

  it("bad date format → 422", async () => {
    const res = await request
      .post("/expenses")
      .set("Idempotency-Key", randomUUID())
      .send({ ...VALID, date: "15-06-2024" });
    assert.equal(res.status, 422);
  });

  it("invalid category → 422", async () => {
    const res = await request
      .post("/expenses")
      .set("Idempotency-Key", randomUUID())
      .send({ ...VALID, category: "Unicorns" });
    assert.equal(res.status, 422);
  });

  it("amount stored without float error (₹0.1 + ₹0.2)", async () => {
    const r1 = await request
      .post("/expenses")
      .set("Idempotency-Key", randomUUID())
      .send({ ...VALID, amount: "0.10" });
    const r2 = await request
      .post("/expenses")
      .set("Idempotency-Key", randomUUID())
      .send({ ...VALID, amount: "0.20" });
    assert.equal(r1.body.amount, "0.10");
    assert.equal(r2.body.amount, "0.20");
  });
});

describe("GET /expenses", () => {
  it("returns expenses array + total", async () => {
    const res = await request.get("/expenses");
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.expenses));
    assert.equal(typeof res.body.total, "string");
    assert.ok(/^\d+\.\d{2}$/.test(res.body.total));
  });

  it("total equals sum of amounts", async () => {
    const res = await request.get("/expenses");
    const computed = res.body.expenses
      .reduce((s, e) => s + parseFloat(e.amount), 0)
      .toFixed(2);
    assert.equal(res.body.total, computed);
  });

  it("category filter returns only matching rows", async () => {
    await request
      .post("/expenses")
      .set("Idempotency-Key", randomUUID())
      .send({ ...VALID, category: "Transport", description: "Bus" });

    const res = await request.get("/expenses?category=Transport");
    assert.equal(res.status, 200);
    assert.ok(res.body.expenses.length >= 1);
    assert.ok(res.body.expenses.every((e) => e.category === "Transport"));
  });

  it("unknown category filter → 400", async () => {
    const res = await request.get("/expenses?category=Unicorns");
    assert.equal(res.status, 400);
  });

  it("sort=date_asc returns oldest first", async () => {
    const res = await request.get("/expenses?sort=date_asc");
    const dates = res.body.expenses.map((e) => e.date);
    const sorted = [...dates].sort();
    assert.deepEqual(dates, sorted);
  });

  it("default sort is newest first", async () => {
    const res = await request.get("/expenses");
    const dates = res.body.expenses.map((e) => e.date);
    const sorted = [...dates].sort().reverse();
    assert.deepEqual(dates, sorted);
  });
});

after(() => {
  for (const f of [TEST_DB, TEST_DB + "-wal", TEST_DB + "-shm"]) {
    try { fs.unlinkSync(f); } catch {}
  }
});
