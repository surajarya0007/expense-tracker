const db = require("./src/db");
async function test() {
  await db.init();
  const id = "test-id-" + Date.now();
  console.log("Inserting...");
  db.transaction(() => {
    db.prepare("INSERT INTO expenses (id, amount_paise, category, description, date) VALUES (?, ?, ?, ?, ?)")
      .run([id, 100, "Food", "Test", "2024-01-01"]);
  })();
  console.log("Inserted.");
  const expenses = db.prepare("SELECT * FROM expenses WHERE id = ?").get(id);
  console.log("Verified:", expenses);
  process.exit(0);
}
test().catch(e => { console.error(e); process.exit(1); });
