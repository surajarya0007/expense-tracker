import { useState, useEffect, useCallback } from "react";
import ExpenseForm from "./ExpenseForm.jsx";
import ExpenseList from "./ExpenseList.jsx";
import CategorySummary from "./CategorySummary.jsx";
import { getExpenses } from "./api.js";

export default function App() {
  const [expenses, setExpenses] = useState([]);
  const [total, setTotal] = useState("0.00");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState("date_desc");
  const [showSummary, setShowSummary] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getExpenses({ category: filter || undefined, sort });
      setExpenses(data.expenses);
      setTotal(data.total);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filter, sort]);

  useEffect(() => { load(); }, [load]);

  function handleCreated(newExpense) {
    // Optimistically add the new expense to the top if sort is date_desc
    // and no category filter is active (or it matches).
    const matchesFilter = !filter || newExpense.category === filter;
    if (matchesFilter) {
      setExpenses((prev) => {
        const updated = sort === "date_desc"
          ? [newExpense, ...prev]
          : [...prev, newExpense];
        return updated;
      });
      setTotal((prev) => (parseFloat(prev) + parseFloat(newExpense.amount)).toFixed(2));
    }
    // Always do a background refresh so list is authoritative
    load();
  }

  return (
    <div className="app">
      <header>
        <h1>Expense Tracker</h1>
      </header>

      <main>
        <div className="layout">
          <div className="form-col">
            <ExpenseForm onCreated={handleCreated} />
          </div>

          <div className="list-col">
            <div className="list-header">
              <h2>Expenses</h2>
              <button
                className="btn-ghost"
                onClick={() => setShowSummary((s) => !s)}
              >
                {showSummary ? "Hide summary" : "Show summary"}
              </button>
            </div>

            {showSummary && <CategorySummary expenses={expenses} />}

            <ExpenseList
              expenses={expenses}
              total={total}
              loading={loading}
              error={error}
              filter={filter}
              sort={sort}
              onFilterChange={setFilter}
              onSortChange={setSort}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
