import React, { useEffect, useState } from "react";
import "../styles/ExpenseForm.css";

const categories = [
  "Food & Drink", "Travel", "Utilities", "Entertainment",
  "Health & Fitness", "Shopping", "Rent", "Other",
  "Investment", "Clothing", "Education", "Personal Care"
];

export default function ExpenseForm({ onSubmit, initial = {}, submitting = false, budgetOptions = [] }) {
  const [amount, setAmount] = useState(initial.amount !== undefined && initial.amount !== null ? String(initial.amount) : "");
  const [category, setCategory] = useState(initial.category || categories[0]);
  const [date, setDate] = useState(initial.date ? new Date(initial.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState(initial.description || initial.note || "");
  const [budgetItemId, setBudgetItemId] = useState(initial.budgetItemId || "");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    // when editing an existing expense object arrives/changes
    if (initial && initial._id) {
      setAmount(initial.amount !== undefined && initial.amount !== null ? String(initial.amount) : "");
      setCategory(initial.category || categories[0]);
      setDate(initial.date ? new Date(initial.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
      setNote(initial.description || initial.note || "");
      setBudgetItemId(initial.budgetItemId || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial._id]);

  function isValid() {
    const num = parseFloat(String(amount).replace(/,/g, ""));
    return !isNaN(num) && isFinite(num) && num > 0;
  }

  function submit(e) {
    e.preventDefault();
    setTouched(true);
    if (!isValid()) return;
    const numericAmount = parseFloat(String(amount).replace(/,/g, ""));
    onSubmit({
      amount: numericAmount,
      category,
      date,
      note: note.trim(),
      budgetItemId: budgetItemId || undefined,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    });
  }

  // Small helper to format input while typing (not strict formatting)
  function handleAmountChange(value) {
    // allow numbers, dots and commas, strip other chars
    const cleaned = value.replace(/[^\d.,-]/g, "");
    setAmount(cleaned);
  }

  const noteMax = 250;

  return (
    <div className="ef-page">
      <form className="ef-form" onSubmit={submit} noValidate>
        <div className="ef-row">
          <label className="ef-label" htmlFor="ef-amount">Amount (₹)</label>
          <input
            id="ef-amount"
            name="amount"
            className={`ef-input ef-amount ${touched && !isValid() ? 'ef-invalid' : ''}`}
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => handleAmountChange(e.target.value)}
            disabled={submitting}
            aria-label="Amount in rupees"
            aria-invalid={touched && !isValid()}
            required
          />
          {touched && !isValid() && <div className="ef-error">Please enter an amount greater than 0.</div>}
        </div>

        <div className="ef-row ef-grid-2">
          <div>
            <label className="ef-label" htmlFor="ef-category">Category</label>
            <select
              id="ef-category"
              className="ef-input ef-select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={submitting}
              aria-label="Category"
            >
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="ef-label" htmlFor="ef-date">Date</label>
            <input
              id="ef-date"
              className="ef-input ef-date"
              type="date"
              value={date}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDate(e.target.value)}
              disabled={submitting}
              aria-label="Date of expense"
              required
            />
          </div>
        </div>

        <div className="ef-row">
          <label className="ef-label" htmlFor="ef-budget-item">Budget (optional)</label>
          <select
            id="ef-budget-item"
            className="ef-input ef-select"
            value={budgetItemId}
            onChange={(e) => setBudgetItemId(e.target.value)}
            disabled={submitting || budgetOptions.length === 0}
            aria-label="Budget bucket"
          >
            <option value="">No budget bucket</option>
            {budgetOptions.map((item) => (
              <option key={item._id} value={item._id}>
                {item.name} (₹{Number(item.remaining ?? item.allocated ?? 0).toFixed(2)} left)
              </option>
            ))}
          </select>
          {budgetOptions.length === 0 && (
            <small className="ef-muted">Create monthly budget buckets in Profile to track remaining balance.</small>
          )}
        </div>

        <div className="ef-row">
          <label className="ef-label" htmlFor="ef-note">Note (optional)</label>
          <textarea
            id="ef-note"
            className="ef-input ef-textarea"
            placeholder="Add a short note..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={submitting}
            maxLength={noteMax}
            rows={4}
            aria-label="Note"
          />
          <div className="ef-note-meta">
            <small className="ef-muted">{note.length}/{noteMax} chars</small>
          </div>
        </div>

        <div className="ef-row ef-actions">
          <button
            type="submit"
            className="ef-button"
            disabled={!isValid() || submitting}
            aria-disabled={!isValid() || submitting}
          >
            {submitting ? "Saving…" : (initial && initial._id ? "Update Expense" : "Save Expense")}
          </button>
        </div>
      </form>
    </div>
  );
}
