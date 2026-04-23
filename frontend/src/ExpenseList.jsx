const CATEGORIES = [
  "Food", "Transport", "Housing", "Entertainment",
  "Healthcare", "Shopping", "Utilities", "Education", "Other",
];

const fmt = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
});

const fmtDate = (iso) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });

export default function ExpenseList({
  expenses,
  total,
  loading,
  error,
  filter,
  sort,
  onFilterChange,
  onSortChange,
}) {
  return (
    <section>
      <div className="list-controls">
        <div className="field inline">
          <label htmlFor="filter-cat">Category</label>
          <select
            id="filter-cat"
            value={filter}
            onChange={(e) => onFilterChange(e.target.value)}
          >
            <option value="">All categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="field inline">
          <label htmlFor="sort-order">Sort</label>
          <select
            id="sort-order"
            value={sort}
            onChange={(e) => onSortChange(e.target.value)}
          >
            <option value="date_desc">Newest first</option>
            <option value="date_asc">Oldest first</option>
          </select>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <p className="status-msg">Loading…</p>
      ) : expenses.length === 0 ? (
        <p className="status-msg empty">
          {filter ? `No expenses in "${filter}".` : "No expenses yet. Add one above."}
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Category</th>
              <th>Description</th>
              <th className="amount-col">Amount</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id}>
                <td className="date-cell">{fmtDate(e.date)}</td>
                <td><span className={`badge cat-${e.category.toLowerCase()}`}>{e.category}</span></td>
                <td className="desc-cell">{e.description || <span className="muted">—</span>}</td>
                <td className="amount-col">{fmt.format(e.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan="3" className="total-label">
                Total ({expenses.length} {expenses.length === 1 ? "item" : "items"})
              </td>
              <td className="amount-col total-value">{fmt.format(total)}</td>
            </tr>
          </tfoot>
        </table>
      )}
    </section>
  );
}
