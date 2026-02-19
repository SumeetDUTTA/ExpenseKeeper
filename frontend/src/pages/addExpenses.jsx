/* eslint-disable react-hooks/exhaustive-deps */
// src/pages/addExpenses.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { ArrowLeftIcon, LoaderCircle, } from "lucide-react";

import api from "../lib/api";
import ExpenseForm from "../components/expenseForm";
import "../styles/AddExpense.css";

export default function AddExpense() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [budgetOptions, setBudgetOptions] = useState([]);

  function currentMonthKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }

  async function fetchMonthlyBudgets() {
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const month = currentMonthKey();
      const res = await api.get(`/api/budgets/month?month=${month}&timezone=${encodeURIComponent(timezone)}`);
      const items = Array.isArray(res.data?.items) ? res.data.items : [];
      setBudgetOptions(items);
    } catch (error) {
      console.error("Failed to load budget buckets", error);
      setBudgetOptions([]);
    }
  }

  useEffect(() => {
    fetchMonthlyBudgets();
  }, []);

  async function handleCreate(payload) {
    setSubmitting(true);
    setLoading(true);
    try {
      await api.post("/api/expenses", payload);
      toast.success?.("Expense added");
      navigate("/expenses");
    } catch (err) {
      console.error("Failed to add expense", err);
      toast.error?.(err?.response?.data?.message || "Failed to add expense");
    } finally {
      setSubmitting(false);
      setLoading(false);
    }
  }

  if (loading) {
		return (
			<div className="loader-screen" role="status" aria-live="polite">
				<div style={{ textAlign: 'center' }}>
					<LoaderCircle size={48} className="animate-spin" />
					<div style={{ marginTop: 8, color: 'var(--muted)' }}>Loading...</div>
				</div>
			</div>
		);
	}

  return (
    <div className="add-expense-page" aria-live="polite">
      <div className="add-expense-hero">
        <div className="hero-left">
          <h2 className="page-title">Add Expense</h2>
          <p className="page-description">
            Add a new expense — it will appear in your list and analytics.
          </p>
        </div>

        <div className="hero-actions">
          <button
            className="back-to-expense"
            onClick={() => navigate("/expenses")}
            aria-label="Back to expenses"
          >
            <ArrowLeftIcon size={16} /> Back to Expenses
          </button>
        </div>
      </div>

      <div className="expense-card-body">
        <div className="card">
          {/* ExpenseForm handles the inputs — keep its API the same */}
          <ExpenseForm onSubmit={handleCreate} submitting={submitting} budgetOptions={budgetOptions} />
        </div>

        {/* subtle submitting overlay so user knows request is in-flight */}
        {submitting && (
          <div className="submitting-overlay" role="status" aria-live="assertive">
            <div className="submitting-box">
              <svg className="spinner" viewBox="0 0 50 50" aria-hidden="true">
                <circle className="path" cx="25" cy="25" r="20" fill="none" strokeWidth="4"></circle>
              </svg>
              <div>Saving…</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
