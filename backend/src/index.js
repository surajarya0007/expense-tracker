const express = require("express");
const cors = require("cors");
const db = require("./db");
const expensesRouter = require("./routes/expenses");

const app = express();

app.use(cors());
app.use(express.json());

if (process.env.NODE_ENV !== "test") {
  app.use((req, _res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

app.use("/expenses", expensesRouter);
app.get("/health", (_req, res) => res.json({ ok: true }));
app.use((_req, res) => res.status(404).json({ error: "Not found" }));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 3001;

async function start() {
  await db.init();
  if (require.main === module) {
    app.listen(PORT, () => {
      console.log(`Expense Tracker API → http://localhost:${PORT}`);
    });
  }
}

start().catch((err) => {
  console.error("Startup failed:", err);
  process.exit(1);
});

module.exports = { app, ready: db.init() };
