// src/pages/addExpenses.jsx
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeftIcon } from 'lucide-react'

import api from '../lib/api'
import ExpenseForm from '../components/expenseForm'
import "../styles/AddExpense.css"

export default function AddExpense() {
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)

  async function handleCreate(payload) {
    setSubmitting(true)
    try {
      await api.post('/expenses', payload)
      toast.success?.('Expense added')
      // return to list (you can also route to newly created item's detail if you have one)
      navigate('/expenses')
    } catch (err) {
      console.error('Failed to add expense', err)
      toast.error?.(err?.response?.data?.message || 'Failed to add expense')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="add-expense-page">
      <div className="header">
        <h2 className="page-title">Add Expense</h2>
        <p className="page-discreption">Add a new expense — it will appear in your list and analytics.</p>
        <button className="back-to-expense" onClick={() => navigate('/expenses')}><ArrowLeftIcon /> Back to Expenses</button>
      </div>
      <div className="expense-card-body">
        <div className="card">
          <ExpenseForm onSubmit={handleCreate} submitting={submitting} />
        </div>
      </div>
    </div>
  )
}
