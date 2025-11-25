import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Brush, PieChart, Pie, Cell, Legend } from 'recharts'
import { LoaderCircle } from 'lucide-react'
import toast from 'react-hot-toast'

import api from '../lib/api'
import ExpenseForm from '../components/expenseForm'
import '../styles/showExpenses.css'

/* ---------- Helpers (same as ExpenseHistory) ---------- */
function parseDate(s) {
	const d = s ? new Date(s) : new Date()
	if (Number.isNaN(d.getTime())) return null
	return d
}
function formatMonthKey(date) {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}
function formatDayKey(date) {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
function getWeekKey(date) {
	const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
	const dayNum = d.getUTCDay() || 7
	d.setUTCDate(d.getUTCDate() + 4 - dayNum)
	const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
	const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7)
	return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}
function keyToLabel(key, agg) {
	if (!key) return ''
	if (agg === 'monthly') {
		const [y, m] = key.split('-')
		const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
		return `${monthNames[Number(m) - 1]} ${y}`
	}
	if (agg === 'weekly') {
		const [y, w] = key.split('-W')
		return `Week ${w}, ${y}`
	}
	if (agg === 'daily') {
		const date = new Date(key)
		return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
	}
	return key
}

function clampDate(date) {
	const d = new Date(date)
	d.setHours(0, 0, 0, 0)
	return d
}
function subMonths(date, months) {
	const d = new Date(date)
	d.setMonth(d.getMonth() - months)
	return d
}

/* ---------- Component ---------- */
export default function ShowExpenses() {
	// CRUD state
	const [list, setList] = useState([])
	const [loading, setLoading] = useState(false)
	const [editing, setEditing] = useState(null)

	// search/filter state
	const [search, setSearch] = useState('')
	const [categoryFilter, setCategoryFilter] = useState('All')

	// analytics controls
	const [analyticsOpen, setAnalyticsOpen] = useState(false)
	const [preset, setPreset] = useState('3M')
	const [agg, setAgg] = useState('monthly') // daily|weekly|monthly
	const [customStart, setCustomStart] = useState('')
	const [customEnd, setCustomEnd] = useState('')

	const navigate = useNavigate()

	// fetch expenses
	async function fetchExpenses() {
		setLoading(true)
		try {
			const res = await api.get('/api/expenses')
			// handle different backend shapes
			const data = Array.isArray(res.data) ? res.data : (res.data?.expenses && Array.isArray(res.data.expenses) ? res.data.expenses : [])
			setList(data)
		} catch (err) {
			console.error('Failed to fetch expenses', err)
			toast.error?.('Failed to load expenses')
			setList([])
		} finally {
			setLoading(false)
		}
	}

	useEffect(() => { fetchExpenses() }, [])

	/* ---------- CRUD handlers ---------- */

	async function update(id, payload) {
		try {
			await api.patch(`/api/expenses/${id}`, payload)
			toast.success?.('Expense updated')
			setEditing(null)
			fetchExpenses()
		} catch (err) {
			console.error("Update error:", err)
			toast.error?.(err?.response?.data?.message || 'Failed to update')
		}
	}

	async function remove(id) {
		if (!confirm('Delete this expense?')) return
		try {
			await api.delete(`/api/expenses/${id}`)
			toast.success?.('Expense deleted')
			fetchExpenses()
		} catch (err) {
			console.error("Delete error:", err)
			toast.error?.(err?.response?.data?.message || 'Failed to delete')
		}
	}

	/* ---------- Filtering for list display (search + category) ---------- */
	const filteredList = useMemo(() => {
		const base = Array.isArray(list) ? list : []
		return base.filter(it => {
			if (categoryFilter !== 'All' && it.category !== categoryFilter) return false
			if (!search) return true
			const s = search.toLowerCase()
			return (String(it.category || '').toLowerCase().includes(s) ||
				String(it.note || '').toLowerCase().includes(s) ||
				String(it.amount || '').toLowerCase().includes(s))
		})
	}, [list, search, categoryFilter])

	/* ---------- Analytics: compute start/end based on preset/custom ---------- */
	const { startDate, endDate } = useMemo(() => {
		const now = new Date()
		let end = customEnd ? parseDate(customEnd) : now
		if (!end) end = now
		end.setHours(23, 59, 59, 999)

		let start = null
		if (customStart) start = parseDate(customStart)
		else {
			switch (preset) {
				case '1M': start = subMonths(now, 1); break
				case '3M': start = subMonths(now, 3); break
				case '6M': start = subMonths(now, 6); break
				case '1Y': start = subMonths(now, 12); break
				case 'All':
				default:
					{
						const dates = list.map(e => parseDate(e.date)).filter(Boolean)
						start = dates.length ? new Date(Math.min(...dates.map(d => d.getTime()))) : subMonths(now, 12)
					}
			}
		}
		if (!start) start = subMonths(now, 3)
		start = clampDate(start)
		return { startDate: start, endDate: end }
	}, [preset, customStart, customEnd, list])

	/* ---------- Analytics grouping ---------- */
	const grouped = useMemo(() => {
		const base = Array.isArray(list) ? list : []
		const filtered = base
			.map(it => ({ ...it, parsedDate: parseDate(it.date) }))
			.filter(it => it.parsedDate)
			.filter(it => {
				const t = it.parsedDate.getTime()
				return t >= startDate.getTime() && t <= endDate.getTime()
			})

		const map = new Map()
		filtered.forEach(it => {
			const dt = it.parsedDate
			let key
			if (agg === 'monthly') key = formatMonthKey(dt)
			else if (agg === 'weekly') key = getWeekKey(dt)
			else key = formatDayKey(dt)
			const prev = map.get(key) || 0
			map.set(key, prev + (Number(it.amount) || 0))
		})

		const keys = Array.from(map.keys()).sort((a, b) => {
			if (agg === 'monthly') {
				const [ay, am] = a.split('-').map(Number); const [by, bm] = b.split('-').map(Number)
				if (ay !== by) return ay - by; return am - bm
			}
			if (agg === 'weekly') {
				const [ay, aw] = a.split('-W').map(Number); const [by, bw] = b.split('-W').map(Number)
				if (ay !== by) return ay - by; return aw - bw
			}
			return new Date(a) - new Date(b)
		})

		const data = keys.map(k => ({ name: keyToLabel(k, agg), value: map.get(k) || 0, rawKey: k }))
		return { data, filtered }
	}, [list, startDate, endDate, agg])

	const chartData = Array.isArray(grouped.data) ? grouped.data : []
	const totalInRange = chartData.reduce((s, r) => s + (Number(r.value) || 0), 0)
	const periodsCount = chartData.length || 1
	const avgPerPeriod = Math.round(totalInRange / periodsCount || 0)

	/* ---------- Category breakdown for pie chart ---------- */
	const categoryData = useMemo(() => {
		const categoryMap = new Map()
		grouped.filtered.forEach(expense => {
			const cat = expense.category || 'Other'
			categoryMap.set(cat, (categoryMap.get(cat) || 0) + Number(expense.amount || 0))
		})
		return Array.from(categoryMap.entries())
			.map(([name, value]) => ({ name, value: Math.round(value) }))
			.sort((a, b) => b.value - a.value)
	}, [grouped.filtered])

	const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#f97316', '#06b6d4']

	/* ---------- category options for filter dropdown ---------- */
	const categories = useMemo(() => {
		const cats = Array.from(new Set(list.map(i => i.category).filter(Boolean)))
		return ['All', ...cats]
	}, [list])

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

	/* ---------- UI ---------- */
	return (
		<div className="expense-page-container">
			<div className="header">
				<h2 className='page-title'>Expenses</h2>
				<div className="search-category-box" role="search" aria-label="Search expenses">
					<input
						value={search}
						onChange={e => setSearch(e.target.value)} className="search-category-input-box"
						placeholder="Search category, note or amount"
						aria-label="Search category, note or amount"
					/>
					<select
						value={categoryFilter}
						onChange={e => setCategoryFilter(e.target.value)} className="search-category-dropdown"
						aria-label="Filter by category"
					>
						{categories.map(c => <option key={c} value={c}>{c}</option>)}
					</select>
				</div>
			</div>

			{/* Analytics panel (toggleable) */}
			<div className="analytical-card-container">
				<div className="card-body" role="region" aria-label="Analytics">
					<div className="spend-plus">SpendPulse — expense history</div>
					<div className="analyze-spending">Analyze your spending</div>

					<div className="analytics-toggle-button">
						<button onClick={() => setAnalyticsOpen(a => !a)} className="show-analytics-button" aria-expanded={analyticsOpen} aria-controls="analytical-controls-container">
							{analyticsOpen ? 'Hide analytics' : 'Show analytics'}
						</button>
						<div className="range-aggregation-label">Range & aggregation</div>
					</div>

					{analyticsOpen && (
						<div className="analytical-controls-container">
							<div className="preset-button-containers" role="tablist" aria-label="Time presets">
								{['1M', '3M', '6M', '1Y', 'All'].map(p => (
									<button
										key={p}
										onClick={() => { setPreset(p); setCustomStart(''); setCustomEnd('') }}
										className={preset === p ? 'preset-button active' : 'preset-button'}
									>{p}</button>
								))}
							</div>

							<div className="aggregration" style={{ marginBottom: 10 }}>
								<label style={{ marginRight: 8 }}>Aggregation:</label>
								<select value={agg} onChange={e => setAgg(e.target.value)} className="aggregation-dropdown" aria-label="Aggregation">
									<option value="daily">Daily</option>
									<option value="weekly">Weekly</option>
									<option value="monthly">Monthly</option>
								</select>
							</div>

							<div className="custom-date-range" aria-label="Custom date range">
								<label className='custom-range-label'>Custom range:</label>
								<input type="date" value={customStart} onChange={e => { setCustomStart(e.target.value); setPreset('') }} className="custom-start-date" aria-label="Start date" />
								<input type="date" value={customEnd} onChange={e => { setCustomEnd(e.target.value); setPreset('') }} className="custom-end-date" aria-label="End date" />
								<button onClick={() => { setCustomStart(''); setCustomEnd(''); setPreset('3M') }} className="reset-button">Reset</button>
							</div>
							<div className="analytical-chart-summary-container">
								<div className="summary-card-body" aria-hidden={loading}>
									<div className="spent-label">Total spent</div>
									<div className="spent-amount">
										₹{totalInRange.toFixed(2)}
									</div>
									<div className="average-card-body">
										<div className="average-label">
											Avg per {agg === 'daily' ? 'day' : agg === 'weekly' ? 'week' : 'month'}: ₹{avgPerPeriod.toFixed(2)}
										</div>
									</div>

									<div style={{ width: '100%', height: 300 }} className="chart-container" aria-label="Spending chart">
										{loading ? (
											<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
												Loading…
											</div>
										) : chartData.length > 0 ? (
											<ResponsiveContainer width="100%" height="100%">
												<LineChart data={chartData} margin={{ top: 8, right: 24, left: 24, bottom: 12 }}>
													<CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
													<XAxis dataKey="name" stroke="var(--text-secondary)"
														tick={{ fill: "var(--text-secondary)", fontSize: 12 }} />
													<YAxis
														stroke="var(--text-secondary)"
														tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
													/>
													<Tooltip formatter={(v) => `₹${v}`} contentStyle={{ background: "var(--card-bg)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
														labelStyle={{ color: "var(--text-secondary)" }} />
													<Line type="monotone" dataKey="value" stroke="var(--accent-primary)"
														strokeWidth={3}
														dot={{ r: 4 }}
														activeDot={{ r: 6 }} />
													<Brush className='brush' dataKey="name" height={24} width={480} stroke="var(--accent-primary)" />
												</LineChart>
											</ResponsiveContainer>
										) : (
											<div className="no-data">No data for chosen range</div>
										)}
									</div>
								</div>

								<div className="category-pie-chart-container" aria-hidden={loading}>
									<div className="pie-chart-title">Category Distribution</div>
									{categoryData.length === 0 ? (
										<div className="no-data">No data</div>
									) : (
										<div style={{ width: '100%', height: 380 }} className="pie-chart-wrapper">
											<ResponsiveContainer width="100%" height="100%">
												<PieChart margin={{ top: 20, right: 24, left: 24, bottom: 12 }}>
													<Pie
														data={categoryData}
														cx="50%"
														cy={window.innerWidth < 768 ? "45%" : "40%"}
														outerRadius={window.innerWidth < 768 ? 70 : 90}
														labelLine={false}
														label={false}
														fill="var(--accent-primary)"
														dataKey="value"
													>
														{categoryData.map((_entry, index) => (
															<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
														))}
													</Pie>
													<Tooltip
														formatter={(value) => `₹${value}`}
														contentStyle={{ background: "var(--card-bg)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
														labelStyle={{ color: "var(--text-secondary)" }}
													/>
												</PieChart>
											</ResponsiveContainer>
											<div className="pie-legend" role="list" aria-label="Category legend">
												{categoryData.map((entry, index) => (
													<div className="legend-item" key={entry.name} role="listitem">
														<div className="legend-color-box" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
														<div style={{ fontSize: 13, color: 'var(--muted)' }}>{entry.name} • {((entry.value / Math.max(1, totalInRange)) * 100).toFixed(0)}%</div>
													</div>
												))}
											</div>
										</div>
									)}
								</div>

								<div className="period-breakdown-container" aria-hidden={loading}>
									<div className="breakdown-title">Period breakdown</div>
									{chartData.length === 0 ? <div className="no-data">No data</div> : (
										<div className="period-breakdown" style={{ maxHeight: 200, overflow: 'auto' }}>
											<table className="breakdown-table" role="table" aria-label="Period totals">
												<thead className="thead-class"><tr><th className="th">Period</th><th className="th">Total</th></tr></thead>
												<tbody>
													{chartData.map(row => (
														<tr key={row.name} className="table-row">
															<td className="td">{row.name}</td>
															<td className="td">₹{row.value}</td>
														</tr>
													))}
												</tbody>
											</table>
										</div>
									)}
								</div>

								<div className="recent-range" aria-hidden={loading}>
									<div className="recent-range-title">Recent range</div>
									{grouped.filtered.length === 0 ? <div className="no-data">No expenses</div> : (
										<div className="recent-expenses-list" style={{ maxHeight: 200, overflowY: 'auto' }}>
											{grouped.filtered.slice().sort((a, b) => b.parsedDate - a.parsedDate).slice(0, 8).map(it => (
												<div key={it._id || (it.parsedDate && it.parsedDate.getTime())} className="recent-expense-item">
													<div>
														<div className="item-category">{it.category}</div>
														<div className="item-date">{it.parsedDate.toLocaleDateString()} · {it.note}</div>
													</div>
													<div className="item-amount">₹{it.amount}</div>
												</div>
											))}
										</div>
									)}
								</div>
							</div>
						</div>
					)}
				</div>
			</div >

			{/* Expense list */}
			<div className="expense-list-container" aria-label="All expenses">
				<div className="expense-title">All Expenses</div>
				{loading ? <div style={{ padding: 20 }}>Loading…</div> : (
					<>
						{filteredList.length === 0 ? (
							<div className="no-data">No expenses found. Add your first expense.</div>
						) : (
							<div className="expense-table-container" role="table">
								<table className="expense-table" aria-label="Expenses table">
									<thead className="thead-class">
										<tr>
											<th className="th">Date</th>
											<th className="th">Category</th>
											<th className="th">Amount</th>
											<th className="th">Note</th>
											<th className="th">Actions</th>
										</tr>
									</thead>
									<tbody>
										{filteredList.map(item => (
											<tr key={item._id} className="table-row" role="row">
												<td className="td" data-label="Date">{new Date(item.date).toLocaleDateString()}</td>
												<td className="td" data-label="Category">{item.category}</td>
												<td className="td" data-label="Amount">₹{item.amount}</td>
												<td className="td" data-label="Note">{item.note || '-'}</td>
												<td className="td actions-td" data-label="Actions">
													<button onClick={() => setEditing(item)} className="buttons-edit" aria-label={`Edit ${item.category}`}>Edit</button>
													<button onClick={() => remove(item._id)} className="buttons-delete" aria-label={`Delete ${item.category}`}>Delete</button>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}
					</>
				)}
			</div>

			{/* Edit expense modal */}
			{
				editing && (
					<div className="setting-modal-overlay" role="dialog" aria-modal="true" aria-label="Edit expense dialog">
						<div className="editing-overlay" onClick={() => setEditing(null)} />
						<div className="editing-modal-content">
							<div className="editing-modal-header">
								<h3 className="edit-title">Edit expense</h3>
								<button onClick={() => setEditing(null)} className="edit-close-button" aria-label="Close edit">Close</button>
							</div>
							<ExpenseForm initial={editing} onSubmit={(p) => update(editing._id, p)} />
						</div>
					</div>
				)
			}

			<div className="add-expense-button-container">
				<button onClick={() => navigate('/add-expense')} aria-label="Add expense" className="add-expense-button">+</button>
			</div>
		</div >
	)
}