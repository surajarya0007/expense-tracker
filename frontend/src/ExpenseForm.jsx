import { useState } from "react";

const CATEGORIES = [
  "Food", "Transport", "Housing", "Entertainment",
  "Healthcare", "Shopping", "Utilities", "Education", "Other",
];

const today = () => new Date().toISOString().slice(0, 10);

const EMPTY = { amount: "", category: "", description: "", date: today() };

export default function ExpenseForm({ onCreated }) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState(null);

  function set(field) {
    return (e) => {
      setForm((f) => ({ ...f, [field]: e.target.value }));
      setErrors((err) => ({ ...err, [field]: undefined }));
    };
  }

  function validate() {
    const errs = {};
    const amount = parseFloat(form.amount);
    if (!form.amount || isNaN(amount)) errs.amount = "Enter a valid amount";
    else if (amount <= 0) errs.amount = "Amount must be greater than ₹0";
    if (!form.category) errs.category = "Select a category";
    if (!form.date) errs.date = "Date is required";
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setSubmitting(true);
    setServerError(null);
    try {
      const { createExpense } = await import("./api.js");
      const created = await createExpense(form);
      setForm({ ...EMPTY, date: today() });
      onCreated(created);
    } catch (err) {
      if (err.validationErrors) {
        const mapped = {};
        err.validationErrors.forEach((msg) => {
          const field = msg.split(" ")[0];
          mapped[field] = msg;
        });
        setErrors(mapped);
      } else {
        setServerError(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h2>Add expense</h2>

      {serverError && <div className="error-banner">{serverError}</div>}

      <div className="field">
        <label htmlFor="amount">Amount (₹)</label>
        <input
          id="amount"
          type="number"
          step="0.01"
          min="0.01"
          placeholder="0.00"
          value={form.amount}
          onChange={set("amount")}
          aria-invalid={!!errors.amount}
          disabled={submitting}
        />
        {errors.amount && <span className="field-error">{errors.amount}</span>}
      </div>

      <div className="field">
        <label htmlFor="category">Category</label>
        <select
          id="category"
          value={form.category}
          onChange={set("category")}
          aria-invalid={!!errors.category}
          disabled={submitting}
        >
          <option value="">Select…</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        {errors.category && <span className="field-error">{errors.category}</span>}
      </div>

      <div className="field">
        <label htmlFor="description">Description <span className="optional">(optional)</span></label>
        <input
          id="description"
          type="text"
          placeholder="What was it for?"
          value={form.description}
          onChange={set("description")}
          disabled={submitting}
          maxLength={200}
        />
      </div>

      <div className="field">
        <label htmlFor="date">Date</label>
        <input
          id="date"
          type="date"
          value={form.date}
          onChange={set("date")}
          aria-invalid={!!errors.date}
          disabled={submitting}
        />
        {errors.date && <span className="field-error">{errors.date}</span>}
      </div>

      <button type="submit" disabled={submitting} className="btn-primary">
        {submitting ? "Saving…" : "Add expense"}
      </button>
    </form>
  );
}
