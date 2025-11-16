/* dashboard.jsx — lazy-build charts on scroll (mobile only) */
import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
	TrendingUp, TrendingDown, Wallet, Calendar, ArrowRight,
	PieChart as PieIcon, DollarSign, Target, LoaderIcon, Plus
} from "lucide-react";

import {
	PieChart as RechartsPieChart, Pie, Cell,
	ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip
} from "recharts";

import toast from "react-hot-toast";
import api from "../lib/api";
import "../styles/Dashboard.css";

export default function Dashboard() {
	const [stats, setStats] = useState({
		thisMonth: 0, lastMonth: 0, total: 0, recentExpenses: [],
		categoryBreakdown: {}, last6Months: [], dailyAverage: 0, transactionCount: 0
	});
	const [loading, setLoading] = useState(true);

	// --- Lazy build flags & refs
	const trendRef = useRef(null);
	const pieRef = useRef(null);
	const topCategoriesRef = useRef(null);

	const [buildTrend, setBuildTrend] = useState(false);
	const [buildPie, setBuildPie] = useState(false);
	const [buildProgress, setBuildProgress] = useState(false);

	const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth <= 520 : false);

	useEffect(() => {
		const onResize = () => setIsMobile(window.innerWidth <= 520);
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	}, []);

	// If not mobile, build everything immediately
	useEffect(() => {
		if (!isMobile) {
			setBuildTrend(true);
			setBuildPie(true);
			setBuildProgress(true);
		}
	}, [isMobile]);

	useEffect(() => { fetchDashboardData(); }, []);

	async function fetchDashboardData() {
		setLoading(true);
		try {
			const res = await api.get("/expenses");
			const expenses = res.data || [];

			const now = new Date();
			const thisMonth = now.getMonth();
			const thisYear = now.getFullYear();
			const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
			const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;

			const thisMonthExpenses = expenses.filter(e => {
				const d = new Date(e.date);
				return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
			});
			const lastMonthExpenses = expenses.filter(e => {
				const d = new Date(e.date);
				return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
			});

			const thisMonthTotal = thisMonthExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
			const lastMonthTotal = lastMonthExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
			const total = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

			// Category breakdown for this month
			const categoryMap = {};
			thisMonthExpenses.forEach(e => {
				categoryMap[e.category] = (categoryMap[e.category] || 0) + (Number(e.amount) || 0);
			});

			// Last 6 months trend
			const last6Months = [];
			for (let i = 5; i >= 0; i--) {
				const monthDate = new Date(thisYear, thisMonth - i, 1);
				const monthName = monthDate.toLocaleDateString('en-US', { month: 'short' });
				const monthExpenses = expenses.filter(e => {
					const d = new Date(e.date);
					return d.getMonth() === monthDate.getMonth() && d.getFullYear() === monthDate.getFullYear();
				});
				const monthTotal = monthExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
				last6Months.push({ month: monthName, amount: monthTotal });
			}

			const daysThisMonth = new Date(thisYear, thisMonth + 1, 0).getDate();
			const dailyAverage = daysThisMonth ? thisMonthTotal / daysThisMonth : 0;

			setStats({
				thisMonth: thisMonthTotal,
				lastMonth: lastMonthTotal,
				total,
				recentExpenses: expenses.slice().sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6),
				categoryBreakdown: categoryMap,
				last6Months,
				dailyAverage,
				transactionCount: thisMonthExpenses.length
			});
		} catch (error) {
			console.error(error);
			toast.error("Failed to load dashboard data");
		} finally {
			setLoading(false);
		}
	}

	// IntersectionObserver to lazy-build when visible (only on mobile)
	useEffect(() => {
		if (!isMobile) return undefined; // only observe on mobile

		// more lenient: trigger when small part is visible; rootMargin pulls trigger earlier
		const opts = { root: null, rootMargin: "0px 0px -120px 0px", threshold: [0, 0.05, 0.2] };

		const obs = new IntersectionObserver((entries) => {
			entries.forEach(entry => {
				// debug logs help root-cause why nothing builds
				console.log("[IO] entry:", entry.target && entry.target.dataset && entry.target.dataset.key, entry.isIntersecting, entry.intersectionRatio);

				if (entry.isIntersecting && entry.intersectionRatio > 0) {
					const el = entry.target;
					if (el === trendRef.current && !buildTrend) {
						setBuildTrend(true);
						// guaranteed fallback: if for some reason rendering lags, ensure build completes
						setTimeout(() => setBuildTrend(true), 600);
					}
					if (el === pieRef.current && !buildPie) {
						setBuildPie(true);
						setTimeout(() => setBuildPie(true), 600);
					}
					if (el === topCategoriesRef.current && !buildProgress) {
						setBuildProgress(true);
						setTimeout(() => setBuildProgress(true), 600);
					}
					// unobserve once built to avoid repeated triggers
					obs.unobserve(entry.target);
				}
			});
		}, opts);

		// attach dataset keys so logs are readable
		if (trendRef.current) {
			trendRef.current.dataset.key = "trend";
			obs.observe(trendRef.current);
		}
		if (pieRef.current) {
			pieRef.current.dataset.key = "pie";
			obs.observe(pieRef.current);
		}
		if (topCategoriesRef.current) {
			topCategoriesRef.current.dataset.key = "topCategories";
			obs.observe(topCategoriesRef.current);
		}

		return () => obs.disconnect();
	}, [isMobile, buildTrend, buildPie, buildProgress]);

	const fmt = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(v || 0);
	const percentChange = stats.lastMonth === 0 ? 0 : ((stats.thisMonth - stats.lastMonth) / Math.abs(stats.lastMonth)) * 100;
	const isIncrease = percentChange >= 0;

	const topCategories = Object.entries(stats.categoryBreakdown)
		.sort(([, a], [, b]) => b - a)
		.slice(0, 6);

	const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444'];
	const pieChartData = topCategories.map(([name, value]) => ({ name, value }));

	if (loading) {
		return (
			<div className="loader-screen" role="status" aria-live="polite">
				<div style={{ textAlign: 'center' }}>
					<LoaderIcon size={48} className="animate-spin" />
					<div style={{ marginTop: 8, color: 'var(--muted)' }}>Loading dashboard…</div>
				</div>
			</div>
		);
	}

	return (
		<div className="page-container" aria-live="polite">
			<div className="header-row">
				<div>
					<h1 className="page-title">Dashboard</h1>
					<div className="header-meta">Welcome back — here’s a quick snapshot of your spending</div>
				</div>
				<div className="header-actions">
					<Link to="/add-expense" className="action-item" style={{ display: 'inline-flex', padding: 10 }}>
						<Plus size={18} /> <span style={{ marginLeft: 8 }}>Add</span>
					</Link>
				</div>
			</div>

			{/* Stats Cards */}
			<div className="stats-grid" role="list">
				<div className="card-body stat" role="listitem" aria-label="This month">
					<div>
						<div className="label"><Calendar size={16} /> This Month</div>
						<div className="amount">{fmt(stats.thisMonth)}</div>
						<div className={`change ${isIncrease ? 'increase' : 'decrease'}`}>
							{isIncrease ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
							<span>{Math.abs(percentChange).toFixed(1)}% vs last month</span>
						</div>
					</div>
					<div className="muted">Transactions: {stats.transactionCount}</div>
				</div>

				<div className="card-body stat" role="listitem" aria-label="Daily average">
					<div>
						<div className="label"><Wallet size={16} /> Daily Average</div>
						<div className="amount">{fmt(stats.dailyAverage)}</div>
						<div className="muted">{stats.transactionCount} transactions this month</div>
					</div>
				</div>

				<div className="card-body stat" role="listitem" aria-label="Last month">
					<div>
						<div className="label"><Calendar size={16} /> Last Month</div>
						<div className="amount">{fmt(stats.lastMonth)}</div>
						<div className="muted">Compared to current month</div>
					</div>
				</div>

				<div className="card-body stat" role="listitem" aria-label="Total spending">
					<div>
						<div className="label"><DollarSign size={16} /> Total Spending</div>
						<div className="amount">{fmt(stats.total)}</div>
						<div className="muted">All time</div>
					</div>
				</div>
			</div>

			{/* Charts */}
			<div className="charts-sections">
				<div ref={trendRef} className="chart-card card-body">
					<div className="card-title">6-Month Trend</div>

					{/* render LineChart only when buildTrend is true */}
					{buildTrend ? (
						stats.last6Months && stats.last6Months.length > 0 ? (
							<ResponsiveContainer width="100%" height={300}>
								<LineChart data={stats.last6Months} margin={{ top: 8, right: 12, left: -8, bottom: 8 }}>
									<CartesianGrid strokeDasharray="3 3" stroke="#e8eefc" />
									<XAxis dataKey="month" stroke="#6b7280" fontSize={12} />
									<YAxis stroke="#6b7280" fontSize={12} />
									<Tooltip formatter={(value) => [`${fmt(value)}`, 'Amount']} />
									<Line
										type="monotone"
										dataKey="amount"
										stroke="#6366f1"
										strokeWidth={3}
										dot={{ r: 4 }}
										activeDot={{ r: 6 }}
									/>
								</LineChart>
							</ResponsiveContainer>
						) : <p className="no-data">No trend data</p>
					) : (
						<div style={{ height: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
							<div style={{ color: 'var(--muted)' }}>Scroll to build chart</div>
							<button
								onClick={() => setBuildTrend(true)}
								className="build-button"
								aria-label="Build trend chart"
							>
								Tap to build
							</button>
						</div>
					)}
				</div>

				<div ref={pieRef} className="chart-card card-body">
					<div className="card-title"><PieIcon size={18} /> Category Distribution</div>

					{/* render Pie only when buildPie is true */}
					{buildPie ? (
						pieChartData.length > 0 ? (
							<div className="pie-chart-container">
								<ResponsiveContainer width="100%" height={260}>
									<RechartsPieChart>
										<Pie
											data={pieChartData}
											dataKey="value"
											nameKey="name"
											cx="50%"
											cy="50%"
											outerRadius={80}
											innerRadius={28}
											paddingAngle={3}
											label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
										>
											{pieChartData.map((entry, index) => (
												<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
											))}
										</Pie>
									</RechartsPieChart>
								</ResponsiveContainer>

								<div className="pie-legend" role="list" aria-label="Category legend">
									{pieChartData.map((entry, index) => (
										<div className="legend-item" key={entry.name} role="listitem">
											<div className="legend-color-box" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
											<div style={{ fontSize: 13, color: 'var(--muted)' }}>{entry.name} • {((entry.value / Math.max(1, stats.thisMonth)) * 100).toFixed(0)}%</div>
										</div>
									))}
								</div>
							</div>
						) : <p className="no-data">No spending data this month</p>
					) : (
						<div style={{ height: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
							<div style={{ color: 'var(--muted)' }}>Scroll to build chart</div>
							<button
								onClick={() => setBuildTrend(true)}
								className="build-button"
								aria-label="Build trend chart"
							>
								Tap to build
							</button>
						</div>
					)}
				</div>
			</div>

			{/* Recent & Top */}
			<div ref={topCategoriesRef} className="recent-expenses-top-categories-card">
				<div className="card-body">
					<h2 className="card-title">Recent Expenses</h2>
					<Link to="/expenses" className="view-all-link" aria-label="View all expenses">View All <ArrowRight size={16} /></Link>

					{stats.recentExpenses.length === 0 ? (
						<p className="no-data">No expenses yet</p>
					) : (
						stats.recentExpenses.map((expense) => (
							<div key={expense._id || `${expense.date}-${expense.amount}`} className="expense-item">
								<div className="expense-info">
									<Wallet size={18} />
									<div>
										<p className="expense-category">{expense.category}</p>
										<p className="expense-date-note">{new Date(expense.date).toLocaleDateString()} • {expense.note || 'No note'}</p>
									</div>
								</div>
								<div className="expense-amount">{fmt(Number(expense.amount) || 0)}</div>
							</div>
						))
					)}
				</div>

				<div className="card-body">
					<h2 className="card-title"><Target size={18} /> Top Categories</h2>
					<div className="top-categories-list">
						{topCategories.length === 0 ? (
							<p className="no-data">No spending data this month</p>
						) : topCategories.map(([category, amount], index) => {
							const percentage = stats.thisMonth ? (amount / stats.thisMonth) * 100 : 0;
							// if not yet requested to build progress, keep width 0; otherwise set percentage
							const fillValue = buildProgress ? percentage : 0;
							return (
								<div key={category} className="expense-category-item" aria-label={`Category ${category}`}>
									<div className="category-header">
										<div className="expense-info">
											<div className="expense-category-indicator" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
											<span className="expense-category-name">{category}</span>
										</div>
										<span className="expense-category-amount">{fmt(amount)}</span>
									</div>
									<div className="category-progress-bar" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
										{/* custom progress bar so we can animate width */}
										<div className="progress-track" aria-hidden="true">
											<div
												className="progress-fill"
												style={{ width: `${Math.min(100, fillValue)}%` }}
												data-percent={fillValue.toFixed(1)}
											/>
										</div>
										<span className="percentage-text" style={{ minWidth: 54, textAlign: 'right', color: 'var(--muted)' }}>
											{buildProgress ? `${percentage.toFixed(1)}%` : `0%`}
										</span>
									</div>
								</div>
							);
						})}
					</div>

					<Link to="/expenses" className="view-all-link" aria-label="View detailed analytics">View Detailed Analytics <ArrowRight size={16} /></Link>
				</div>
			</div>

			{/* Quick actions */}
			<div className="quick-action-card">
				<div className="card-body">
					<h2 className="card-title">Quick Actions</h2>
					<div className="action-grid">
						<Link to="/add-expense" className="action-item" aria-label="Add expense">
							<Plus size={24} /> <span>Add Expense</span>
						</Link>
						<Link to="/expenses" className="action-item" aria-label="View history">
							<ArrowRight size={24} /> <span>View History</span>
						</Link>
						<Link to="/predict" className="action-item" aria-label="Predict expenses">
							<TrendingUp size={24} /> <span>Predict</span>
						</Link>
						<Link to="/profile" className="action-item" aria-label="Profile settings">
							<PieIcon size={24} /> <span>Profile</span>
						</Link>
					</div>
				</div>
			</div>
		</div>
	);
}
