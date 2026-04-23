const VALID_DATE = /^\d{4}-\d{2}-\d{2}$/;

const CATEGORIES = [
  "Food",
  "Transport",
  "Housing",
  "Entertainment",
  "Healthcare",
  "Shopping",
  "Utilities",
  "Education",
  "Other",
];

/**
 * Validates and normalises an incoming expense payload.
 * Returns { data } on success or { errors: string[] } on failure.
 *
 * Money is stored as integer paise (1/100th of a rupee) to avoid
 * floating-point rounding errors.  Clients send a decimal string
 * like "149.99"; we multiply by 100 and round.
 */
function validateExpense(body) {
  const errors = [];

  // --- amount ---
  const rawAmount = body.amount;
  if (rawAmount === undefined || rawAmount === null || rawAmount === "") {
    errors.push("amount is required");
  } else {
    const num = Number(rawAmount);
    if (!Number.isFinite(num)) {
      errors.push("amount must be a number");
    } else if (num <= 0) {
      errors.push("amount must be greater than zero");
    } else if (num > 10_000_000) {
      errors.push("amount seems unreasonably large (max ₹1,00,00,000)");
    }
  }

  // --- category ---
  if (!body.category || typeof body.category !== "string" || !body.category.trim()) {
    errors.push("category is required");
  } else if (!CATEGORIES.includes(body.category.trim())) {
    errors.push(`category must be one of: ${CATEGORIES.join(", ")}`);
  }

  // --- description (optional but must be string if present) ---
  if (body.description !== undefined && typeof body.description !== "string") {
    errors.push("description must be a string");
  }

  // --- date ---
  if (!body.date || typeof body.date !== "string") {
    errors.push("date is required");
  } else if (!VALID_DATE.test(body.date.trim())) {
    errors.push("date must be in YYYY-MM-DD format");
  } else {
    const d = new Date(body.date.trim());
    if (isNaN(d.getTime())) errors.push("date is not a valid calendar date");
  }

  if (errors.length) return { errors };

  const amountPaise = Math.round(Number(rawAmount) * 100);
  return {
    data: {
      category: body.category.trim(),
      description: (body.description || "").trim(),
      date: body.date.trim(),
      amount_paise: amountPaise,
    },
  };
}

module.exports = { validateExpense, CATEGORIES };
