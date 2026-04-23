const BASE = import.meta.env.VITE_API_URL || "/expenses";

/**
 * Fetch the expense list with optional filters.
 */
export async function getExpenses({ category, sort } = {}) {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (sort) params.set("sort", sort);
  const url = params.size ? `${BASE}?${params}` : BASE;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load expenses: ${res.status}`);
  return res.json();
}

/**
 * Create a new expense.
 *
 * We generate the idempotency key here and store it in sessionStorage so
 * that if the user refreshes mid-submit (or the page crashes), the same key
 * is reused and the server deduplicates.  Once the request succeeds we clear
 * it so the next submission gets a fresh key.
 */
export async function createExpense(data) {
  const STORAGE_KEY = "pending_idempotency_key";

  let idempotencyKey = sessionStorage.getItem(STORAGE_KEY);
  if (!idempotencyKey) {
    idempotencyKey = crypto.randomUUID();
    sessionStorage.setItem(STORAGE_KEY, idempotencyKey);
  }

  const res = await fetch(BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(data),
  });

  const body = await res.json();

  if (!res.ok) {
    // 422 validation errors – surface them to the form
    if (res.status === 422 && body.errors) {
      throw Object.assign(new Error("Validation failed"), { validationErrors: body.errors });
    }
    throw new Error(body.error || `Request failed: ${res.status}`);
  }

  // Success – clear the pending key so the next submission is fresh
  sessionStorage.removeItem(STORAGE_KEY);
  return body;
}

export async function getCategories() {
  const res = await fetch(`${BASE}/categories`);
  if (!res.ok) throw new Error("Could not load categories");
  const body = await res.json();
  return body.categories;
}
