const fmt = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
});

export default function CategorySummary({ expenses }) {
  if (!expenses.length) return null;

  const totals = {};
  expenses.forEach((e) => {
    totals[e.category] = (totals[e.category] || 0) + parseFloat(e.amount);
  });

  const sorted = Object.entries(totals).sort(([, a], [, b]) => b - a);
  const max = sorted[0][1];

  return (
    <section className="summary-section">
      <h2>By category</h2>
      <ul className="category-bars">
        {sorted.map(([cat, amount]) => (
          <li key={cat}>
            <span className="cat-name">{cat}</span>
            <div className="bar-track">
              <div
                className={`bar-fill cat-${cat.toLowerCase()}`}
                style={{ width: `${(amount / max) * 100}%` }}
              />
            </div>
            <span className="cat-amount">{fmt.format(amount)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
