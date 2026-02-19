/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState } from "react";
import { Wallet, LoaderCircle, X } from "lucide-react";
import toast from "react-hot-toast";

import api from "../lib/api";
import "../styles/BudgetBucket.css";

export default function BudgetBuckets() {
  const [budgetMonth, setBudgetMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [budgetItems, setBudgetItems] = useState([]);
  const [budgetTotals, setBudgetTotals] = useState({ allocated: 0, spent: 0, remaining: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedBucket, setSelectedBucket] = useState(null);
  const [bucketExpenses, setBucketExpenses] = useState([]);
  const [expensesLoading, setExpensesLoading] = useState(false);
  const [editingAllocated, setEditingAllocated] = useState(null);

  function toMoney(value) {
    const num = Number(value || 0);
    return Number.isFinite(num) ? num.toFixed(2) : "0.00";
  }

  async function fetchBudgetForMonth(month = budgetMonth) {
    setLoading(true);
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await api.get(`/api/budgets/month?month=${month}&timezone=${encodeURIComponent(timezone)}`);
      setBudgetItems(Array.isArray(res.data?.items) ? res.data.items : []);
      setBudgetTotals(res.data?.totals || { allocated: 0, spent: 0, remaining: 0 });
    } catch (error) {
      console.error("Fetch budget error:", error);
      toast.error(error.response?.data?.message || "Failed to fetch monthly budget");
      setBudgetItems([]);
      setBudgetTotals({ allocated: 0, spent: 0, remaining: 0 });
    } finally {
      setLoading(false);
    }
  }

  async function fetchBucketExpenses(bucketId) {
    setExpensesLoading(true);
    try {
      const res = await api.get(`/api/expenses?budgetItemId=${bucketId}`);
      const expenses = Array.isArray(res.data) ? res.data : (res.data?.data && Array.isArray(res.data.data) ? res.data.data : []);
      setBucketExpenses(expenses);
    } catch (error) {
      console.error("Fetch bucket expenses error:", error);
      toast.error(error.response?.data?.message || "Failed to fetch expenses");
      setBucketExpenses([]);
    } finally {
      setExpensesLoading(false);
    }
  }

  function openBucketDetails(bucket) {
    setSelectedBucket(bucket);
    setEditingAllocated(String(bucket.allocated));
    fetchBucketExpenses(bucket._id);
  }

  function closeBucketDetails() {
    setSelectedBucket(null);
    setBucketExpenses([]);
    setEditingAllocated(null);
  }

  async function updateBucketAllocated() {
    if (!selectedBucket) return;
    setSaving(true);
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const payloadItems = budgetItems.map((item) => ({
        id: String(item._id || "").startsWith("tmp-") ? undefined : item._id,
        name: item.name,
        allocated: item._id === selectedBucket._id ? Number(editingAllocated || 0) : item.allocated,
      }));

      const res = await api.put("/api/budgets/month", {
        month: budgetMonth,
        timezone,
        items: payloadItems,
      });

      const updatedItems = Array.isArray(res.data?.items) ? res.data.items : [];
      setBudgetItems(updatedItems);
      setBudgetTotals(res.data?.totals || { allocated: 0, spent: 0, remaining: 0 });
      const updatedBucket = updatedItems.find((item) => item._id === selectedBucket._id);
      if (updatedBucket) {
        setSelectedBucket(updatedBucket);
      }
      toast.success("Budget bucket updated");
    } catch (error) {
      console.error("Update budget error:", error);
      toast.error(error.response?.data?.message || "Failed to update budget bucket");
      setEditingAllocated(String(selectedBucket.allocated));
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    fetchBudgetForMonth(budgetMonth);
  }, [budgetMonth]);

  function addBudgetRow() {
    setBudgetItems((prev) => [...prev, { _id: `tmp-${Date.now()}`, name: "", allocated: 0, spent: 0, remaining: 0 }]);
  }

  function removeBudgetRow(id) {
    setBudgetItems((prev) => prev.filter((item) => item._id !== id));
  }

  function updateBudgetRow(id, field, value) {
    setBudgetItems((prev) => prev.map((item) => {
      if (item._id !== id) return item;
      if (field === "allocated") {
        return { ...item, allocated: value };
      }
      return { ...item, [field]: value };
    }));
  }

  async function saveMonthlyBuckets(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const payloadItems = budgetItems
        .map((item) => ({
          id: String(item._id || "").startsWith("tmp-") ? undefined : item._id,
          name: String(item.name || "").trim(),
          allocated: Number(item.allocated || 0),
        }))
        .filter((item) => item.name.length > 0);

      const hasNewBucket = payloadItems.some((item) => !item.id);
      if (!hasNewBucket) {
        toast.error("No buckets to add");
        setSaving(false);
        return;
      }

      const res = await api.put("/api/budgets/month", {
        month: budgetMonth,
        timezone,
        items: payloadItems,
      });

      setBudgetItems(Array.isArray(res.data?.items) ? res.data.items : []);
      setBudgetTotals(res.data?.totals || { allocated: 0, spent: 0, remaining: 0 });
      toast.success("Monthly budget buckets saved");
    } catch (error) {
      console.error("Save budget buckets error:", error);
      toast.error(error.response?.data?.message || "Failed to save budget buckets");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="loader-screen" role="status" aria-live="polite">
        <div style={{ textAlign: "center" }}>
          <LoaderCircle size={48} className="animate-spin" />
          <div style={{ marginTop: 8, color: "var(--muted)" }}>Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page-container">
      <div className="profile-header-card">
        <div>
          <h2 className="profile-header-title">Monthly Budget Buckets</h2>
          <p className="profile-header-subtitle">Manage user-defined buckets (Grocery, Clothing, etc.) on a dedicated page.</p>
        </div>
      </div>

      <div className="budget-settings-card">
        <div className="card-body">
          <h3 className="budget-settings-title">
            <Wallet size={28} className="user-icon" />
            Budget Buckets
          </h3>
          <p className="budget-settings-subtitle">
            Buckets carry forward to future months until you remove them.
          </p>

          <form onSubmit={saveMonthlyBuckets} className="budget-form">
            <div className="monthly-budget-field">
              <label className="monthly-budget-label">Month</label>
              <input
                type="month"
                value={budgetMonth}
                onChange={(e) => setBudgetMonth(e.target.value)}
                className="monthly-budget-input"
                required
              />
            </div>

            <div className="budget-display-grid totals-grid">
              <div className="budget-display-card">
                <div>
                  <p className="budget-display-label">Allocated</p>
                  <div className="budget-display-value" style={{ fontSize: 18 }}>₹{Number(budgetTotals.allocated || 0).toFixed(2)}</div>
                </div>
              </div>
              <div className="budget-display-card">
                <div>
                  <p className="budget-display-label">Spent</p>
                  <div className="budget-display-value" style={{ fontSize: 18 }}>₹{Number(budgetTotals.spent || 0).toFixed(2)}</div>
                </div>
              </div>
              <div className="budget-display-card">
                <div>
                  <p className="budget-display-label">Remaining</p>
                  <div className="budget-display-value" style={{ fontSize: 18 }}>₹{Number(budgetTotals.remaining || 0).toFixed(2)}</div>
                </div>
              </div>
            </div>

            {budgetItems.length === 0 && (
              <p className="monthly-budget-helptext">No budget buckets for this month yet. Add one below.</p>
            )}

            <div className="budget-display-grid buckets-grid">
              {budgetItems.map((item) => (
                <div
                  key={item._id}
                  className="budget-display-card budget-card"
                  onClick={() => openBucketDetails(item)}
                >
                  <div className="monthly-budget-field">
                    <label className="monthly-budget-label">Bucket Name</label>
                    <input
                      type="text"
                      placeholder="Budget name (e.g. Grocery)"
                      className="monthly-budget-input"
                      value={item.name || ""}
                      onChange={(e) => {
                        e.stopPropagation();
                        updateBudgetRow(item._id, "name", e.target.value);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      required
                    />
                  </div>

                  <div className="monthly-budget-field">
                    <label className="monthly-budget-label">Allocated (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Amount"
                      className="monthly-budget-input"
                      value={item.allocated}
                      onChange={(e) => {
                        e.stopPropagation();
                        updateBudgetRow(item._id, "allocated", e.target.value);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      required
                    />
                  </div>

                  <div className="budget-display-grid bucket-metrics-grid">
                    <div className="budget-display-card metric-card">
                      <p className="budget-display-label">Allocated</p>
                      <div className="budget-display-value" style={{ fontSize: 15 }}>₹{toMoney(item.allocated)}</div>
                    </div>
                    <div className="budget-display-card metric-card">
                      <p className="budget-display-label">Spent</p>
                      <div className="budget-display-value" style={{ fontSize: 15 }}>₹{toMoney(item.spent)}</div>
                    </div>
                    <div className="budget-display-card metric-card">
                      <p className="budget-display-label">Remaining</p>
                      <div className="budget-display-value" style={{ fontSize: 15 }}>
                        ₹{toMoney(Number(item.allocated || 0) - Number(item.spent || 0))}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeBudgetRow(item._id);
                    }}
                    className="budget-form-cancel"
                    disabled={Number(item.spent || 0) > 0}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <div className="budget-form-actions">
              <button type="submit" className="budget-form-submit" disabled={saving}>
                {saving ? "Saving..." : "Save Monthly Buckets"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Bucket Details Modal */}
      {selectedBucket && (
        <div
          className="modal-overlay"
          onClick={closeBucketDetails}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 className="modal-title">
                {selectedBucket.name}
              </h2>
              <button
                onClick={closeBucketDetails}
                className="modal-close-btn"
              >
                <X size={24} />
              </button>
            </div>

            {/* Bucket Stats */}
            <div className="budget-display-grid modal-stats-grid">
              <div className="budget-display-card">
                <p className="budget-display-label">Allocated</p>
                <div className="budget-display-value">₹{toMoney(selectedBucket.allocated)}</div>
              </div>
              <div className="budget-display-card">
                <p className="budget-display-label">Spent</p>
                <div className="budget-display-value">₹{toMoney(selectedBucket.spent)}</div>
              </div>
              <div className="budget-display-card">
                <p className="budget-display-label">Remaining</p>
                <div className={`budget-display-value ${Number(selectedBucket.allocated || 0) - Number(selectedBucket.spent || 0) < 0 ? "remaining-negative" : "remaining-positive"}`}>
                  ₹{toMoney(Number(selectedBucket.allocated || 0) - Number(selectedBucket.spent || 0))}
                </div>
              </div>
            </div>

            {/* Edit Allocated Amount */}
            <div className="modal-section">
              <label className="monthly-budget-label">Edit Allocated Amount (₹)</label>
              <div className="edit-allocated-container">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Amount"
                  className="monthly-budget-input edit-allocated-input"
                  value={editingAllocated}
                  onChange={(e) => setEditingAllocated(e.target.value)}
                />
                <button
                  onClick={updateBucketAllocated}
                  disabled={saving || editingAllocated === String(selectedBucket.allocated)}
                  className="modal-update-btn"
                >
                  {saving ? "Updating..." : "Update"}
                </button>
              </div>
            </div>

            {/* Expenses Section */}
            <div className="modal-section">
              <h3 className="modal-section-title">
                Expenses in this Bucket ({bucketExpenses.length})
              </h3>

              {expensesLoading ? (
                <div className="expenses-loading">
                  <LoaderCircle size={32} className="animate-spin expenses-loading-spinner" />
                  <p className="expenses-loading-text">Loading expenses...</p>
                </div>
              ) : bucketExpenses.length === 0 ? (
                <p className="expenses-empty">
                  No expenses in this bucket yet.
                </p>
              ) : (
                <div className="expenses-list">
                  {bucketExpenses.map((expense) => (
                    <div
                      key={expense._id}
                      className="expense-item"
                    >
                      <div className="expense-info">
                        <p className="expense-title">{expense.category}</p>
                        <p className="expense-details">
                          {expense.note} • {new Date(expense.date).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="expense-amount-container">
                        <p className="expense-amount">
                          ₹{toMoney(expense.amount)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="add-expense-button-container">
        <button type="button" aria-label="Add expense" className="add-expense-button" onClick={addBudgetRow}>+</button>
      </div>
    </div>
  );
}