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
  const [monthlyBudgetLimit, setMonthlyBudgetLimit] = useState(0);

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
    // Check total allocated vs monthly budget limit
    if (monthlyBudgetLimit > 0) {
      const newAllocated = Number(editingAllocated || 0);
      const otherAllocated = budgetItems
        .filter((i) => i._id !== selectedBucket._id)
        .reduce((sum, i) => sum + Number(i.allocated || 0), 0);
      if (otherAllocated + newAllocated > monthlyBudgetLimit) {
        toast.error(`Total allocated (₹${(otherAllocated + newAllocated).toFixed(2)}) would exceed your monthly budget (₹${monthlyBudgetLimit.toFixed(2)})`);
        return;
      }
    }
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
    // Fetch user's monthly budget limit
    api.get("/api/user/profile").then((res) => {
      setMonthlyBudgetLimit(Number(res.data?.monthlyBudget || 0));
    }).catch(() => { });
  }, [budgetMonth]);

  function addBudgetRow() {
    setBudgetItems((prev) => [...prev, { _id: `tmp-${Date.now()}`, name: "", allocated: 0, spent: 0, remaining: 0 }]);
  }

  function removeBudgetRow(id) {
    const item = budgetItems.find((i) => i._id === id);

    // Temporary (unsaved) bucket — just remove from state
    if (String(id).startsWith("tmp-")) {
      setBudgetItems((prev) => prev.filter((i) => i._id !== id));
      return;
    }

    // Persisted bucket — call API to delete it
    const remaining = budgetItems.filter((i) => i._id !== id);
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const payloadItems = remaining
      .filter((i) => !String(i._id).startsWith("tmp-") && String(i.name || "").trim().length > 0)
      .map((i) => ({
        id: i._id,
        name: String(i.name).trim(),
        allocated: Number(i.allocated || 0),
      }));

    api.put("/api/budgets/month", { month: budgetMonth, timezone, items: payloadItems })
      .then((res) => {
        setBudgetItems(Array.isArray(res.data?.items) ? res.data.items : []);
        setBudgetTotals(res.data?.totals || { allocated: 0, spent: 0, remaining: 0 });
        toast.success(`Removed "${item?.name || "bucket"}"`);
      })
      .catch((err) => {
        console.error("Remove bucket error:", err);
        toast.error(err.response?.data?.message || "Failed to remove bucket");
      });
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

      if (payloadItems.length === 0) {
        toast.error("No buckets to save");
        setSaving(false);
        return;
      }

      // Check total allocated vs monthly budget limit
      if (monthlyBudgetLimit > 0) {
        const totalAllocated = payloadItems.reduce((sum, item) => sum + Number(item.allocated || 0), 0);
        if (totalAllocated > monthlyBudgetLimit) {
          toast.error(`Total allocated (₹${totalAllocated.toFixed(2)}) exceeds your monthly budget (₹${monthlyBudgetLimit.toFixed(2)})`);
          setSaving(false);
          return;
        }
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
          <p className="budget-settings-subtitle">
            Buckets carry forward to future months until you remove them.
          </p>
          <form onSubmit={saveMonthlyBuckets} className="budget-form">
            <div className="monthly-budget-field select-month-year">
              <div style={{ minWidth: 150 }}>
                <label className="monthly-budget-label">Month</label>
                <select
                  value={budgetMonth.split("-")[1]}
                  onChange={(e) => setBudgetMonth(`${budgetMonth.split("-")[0]}-${e.target.value}`)}
                  className="monthly-budget-input"
                  required
                >
                  {["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"].map((m, i) => (
                    <option key={m} value={m}>
                      {new Date(2000, i).toLocaleString("default", { month: "long" })}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ minWidth: 100 }}>
                <label className="monthly-budget-label">Year</label>
                <select
                  value={budgetMonth.split("-")[0]}
                  onChange={(e) => setBudgetMonth(`${e.target.value}-${budgetMonth.split("-")[1]}`)}
                  className="monthly-budget-input"
                  required
                >
                  {Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - 3 + i).map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
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
                  <p className="budget-display-label">Savings</p>
                  <div className="budget-display-value" style={{ fontSize: 18 }}>₹{Number(budgetTotals.remaining || 0).toFixed(2)}</div>
                </div>
              </div>
            </div>

            <h3 className="budget-settings-title">
              <Wallet size={28} className="user-icon" />
              Budget Buckets
            </h3>

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