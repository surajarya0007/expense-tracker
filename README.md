# Expense Tracker — Full Stack Assignment

A production-quality personal expense tracking tool with a Node.js/Express backend and a React frontend.

---

## Project Structure

```
expense-tracker/
├── backend/                  Node.js + Express API
│   ├── src/
│   │   ├── index.js          App entry point + server startup
│   │   ├── db.js             SQLite database layer (sql.js — pure WASM)
│   │   ├── validation.js     Input validation + money parsing
│   │   └── routes/
│   │       └── expenses.js   POST /expenses, GET /expenses
│   └── src/__tests__/
│       └── expenses.test.js  16 integration tests (Node built-in runner)
├── frontend/                 React + Vite UI
│   ├── index.html
│   └── src/
│       ├── main.jsx          React entry point
│       ├── App.jsx           Root component — state, data fetching
│       ├── ExpenseForm.jsx   Add-expense form with validation
│       ├── ExpenseList.jsx   Table with filter, sort, total
│       ├── CategorySummary.jsx  Per-category bar chart
│       ├── api.js            HTTP client with idempotency key management
│       └── index.css         Styles (light + dark mode)
└── README.md                 This file
```

---

## Prerequisites

- **Node.js 18 or later** — https://nodejs.org/
- **npm** (comes with Node.js)

Check your versions:
```bash
node --version   # should be v18+
npm --version
```

---

## Running Locally

### Step 1 — Install backend dependencies

```bash
cd backend
npm install
```

### Step 2 — Start the backend API

```bash
npm run dev
```

You should see:
```
Expense Tracker API → http://localhost:3001
```

The API is now running on **port 3001**. Leave this terminal open.

### Step 3 — Install frontend dependencies (new terminal)

```bash
cd frontend
npm install
```

### Step 4 — Start the frontend

```bash
npm run dev
```

You should see:
```
VITE ready in ...ms
➜  Local:   http://localhost:5173/
```

Open **http://localhost:5173** in your browser.

---

## Running Tests

```bash
cd backend
npm test
```

Expected output: **16 tests pass, 0 fail**

```
# tests 16
# suites 2
# pass 16
# fail 0
```

Tests use Node's built-in test runner (no extra dependencies) and an isolated in-memory database so they never touch your real data.

---

## API Reference

### `POST /expenses`

Create a new expense.

**Required header:**
```
Idempotency-Key: <uuid>
```

**Request body (JSON):**
```json
{
  "amount": "149.99",
  "category": "Food",
  "description": "Lunch at office",
  "date": "2024-06-15"
}
```

**Valid categories:** Food, Transport, Housing, Entertainment, Healthcare, Shopping, Utilities, Education, Other

**Responses:**
- `201 Created` — new expense created
- `200 OK` — duplicate request (same Idempotency-Key), returns existing expense
- `400 Bad Request` — missing Idempotency-Key header
- `422 Unprocessable Entity` — validation errors

**Response body:**
```json
{
  "id": "a1b2c3d4-...",
  "amount": "149.99",
  "category": "Food",
  "description": "Lunch at office",
  "date": "2024-06-15",
  "created_at": "2024-06-15T08:30:00.000Z"
}
```

---

### `GET /expenses`

Retrieve expenses with optional filtering and sorting.

**Query parameters:**
| Parameter | Description | Example |
|-----------|-------------|---------|
| `category` | Filter by category | `?category=Food` |
| `sort` | Sort order | `?sort=date_desc` (default) or `?sort=date_asc` |

**Response body:**
```json
{
  "expenses": [ ... ],
  "total": "1234.50",
  "count": 7
}
```

---

### `GET /expenses/categories`

Returns the list of valid category values.

---

## Key Design Decisions

### 1. Money as integers (paise)

Amounts are stored as `INTEGER` paise in the database (₹1.50 → `150`). This avoids all floating-point rounding errors that occur when using `FLOAT` for currency.

- The API accepts decimal strings (`"149.99"`) and converts to paise on write
- The API returns decimal strings (`"149.99"`) on read
- Clients never deal with raw paise
- `0.10 + 0.20 = 0.30` exactly — no IEEE 754 surprises

### 2. Idempotent POST via client-generated UUID

The main reliability concern for a POST endpoint is double-submission:
- User double-clicks submit
- Network times out and the browser retries
- Page reloads mid-submit

**Solution:** The client generates a UUID _before_ the first request attempt and stores it in `sessionStorage` as `pending_idempotency_key`. It sends this UUID in an `Idempotency-Key` header on every attempt. If the page crashes or the user refreshes, the same key is reused.

On the server:
1. Check `idempotency_keys` table for the key
2. If found → return the previously created expense with `200` (no duplicate write)
3. If not found → write the expense **and** the key in a single atomic transaction
4. On client success → clear the key from `sessionStorage` so the next submission gets a fresh UUID

This makes retries and double-clicks completely safe regardless of where the failure occurs.

### 3. SQLite via sql.js (pure WASM)

SQLite was chosen for simplicity — no external database server to set up. `sql.js` is the WASM build of SQLite that requires no native compilation, so it works in any Node environment including CI without build tools.

**Tradeoff vs better-sqlite3:** `better-sqlite3` is faster and has a nicer API, but requires compiling native bindings. For a production deployment on a real server, swap `sql.js` for `better-sqlite3` — the `db.js` wrapper keeps the same interface so nothing else changes.

**Tradeoff vs Postgres:** SQLite doesn't scale horizontally. For multi-server deployments, replace SQLite with Postgres. The query layer is standard SQL and would need minimal changes.

### 4. Optimistic UI updates

When a new expense is added, it appears in the list immediately while the server confirms in the background. A background `GET /expenses` refresh follows to ensure the list is authoritative.

### 5. Validation at both layers

Client-side validation (React) gives immediate feedback without a round-trip. Server-side validation (Express) is the source of truth and cannot be bypassed. Both validate the same rules: positive non-zero amount, valid category from the allowed list, required YYYY-MM-DD date.

---

## Trade-offs Made for the Timebox

| Area | Decision | Why |
|------|----------|-----|
| Authentication | Not included | Out of scope; would be the first production addition |
| Pagination | Not included | Personal tool with ~hundreds of rows; `LIMIT/OFFSET` trivial to add |
| Edit / Delete | Not included | Not in acceptance criteria |
| E2E tests | Not included | Backend integration tests cover correctness; Playwright would cover the full flow |
| Rate limiting | Not included | Would add `express-rate-limit` in production |
| Docker | Not included | Adds complexity without demonstrating something new here |

---

## What I Intentionally Did Not Do

- **ORM** — raw SQL is more transparent for a small schema; an ORM adds abstraction without benefit here
- **Soft delete / audit log** — useful in production, out of scope here
- **Multiple currencies** — INR only, matching the assignment context
- **CSV export** — nice-to-have, not in acceptance criteria
- **localStorage for state** — all state is derived from the API; no stale client-side cache

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Backend server port |
| `DB_PATH` | `backend/expenses.db` | SQLite database file path |
| `VITE_API_URL` | `/expenses` | API base URL for the frontend (set for production deployments) |

Example for production:
```bash
# backend
PORT=8080 node src/index.js

# frontend build (points at deployed API)
VITE_API_URL=https://your-api.example.com/expenses npm run build
```
