const db = require("./src/db");
async function check() {
  await db.init();
  const expenses = db.prepare("SELECT * FROM expenses").all();
  const keys = db.prepare("SELECT * FROM idempotency_keys").all();
  console.log("Expenses:", expenses);
  console.log("Keys:", keys);
  process.exit(0);
}
check();
