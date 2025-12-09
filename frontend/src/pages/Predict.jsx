/* eslint-disable no-unused-vars */
import React, { useState } from "react";
import { TrendingUp, Calendar, DollarSign, BarChart3, Eye, EyeOff, Sparkles, LoaderCircle } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";
import toast from "react-hot-toast";

import api from "../lib/api";
import "../styles/Predict.css";

function normalizeTotalPrediction(tp) {
	try {
		if (Array.isArray(tp)) return tp
		if (typeof tp === 'number') return [tp]
		if (tp && typeof tp === 'object') {
			const keys = Object.keys(tp)
			const numericKeys = keys.every(k => !Number.isNaN(Date.parse(k)) || !isNaN(Number(k)))
			if (numericKeys) {
				return keys
					.slice()
					.sort((a, b) => {
						const da = Date.parse(a)
						const db = Date.parse(b)
						if (!Number.isNaN(da) && !Number.isNaN(db)) return da - db
						return (Number(a) || 0) - (Number(b) || 0)
					})
					.map(k => tp[k])
			}
			return Object.values(tp)
		}
	} catch (err) {
		console.error('normalizeTotalPrediction error:', err, tp)
	}
	return []
}

export default function Predict() {
	const [horizon, setHorizon] = useState(3)
	const [result, setResult] = useState(null)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState(null)
	const [showBreakdown, setShowBreakdown] = useState(false)
	const [mlServerChecking, setMlServerChecking] = useState(true)
	const [mlServerAwake, setMlServerAwake] = useState(false)

	// Check if ML server is awake on component mount
	React.useEffect(() => {
		async function checkMLServerHealth() {
			try {
				const controller = new AbortController();
				const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout for ML server

				const mlApiUrl = import.meta.env.VITE_ML_API_URL || "http://localhost:8000";
				const response = await fetch(`${mlApiUrl}/docs`, {
					method: 'GET',
					signal: controller.signal
				});

				clearTimeout(timeoutId);

				if (response.ok) {
					setMlServerAwake(true);
					toast.success('ML server is ready! You can now generate predictions.');
				} else {
					toast.error('ML server not responding. Please try again later.');
					throw new Error('ML server not responding');
				}
			} catch (err) {
				// ML server is sleeping or unreachable
				setMlServerAwake(false);
				toast.loading(
					'ML prediction server is starting up. This may take 40-60 seconds. Please wait...',
					{
						duration: 50000,
						icon: '🤖',
						id: 'ml-server-wake-toast'
					}
				);

				// Retry after 45 seconds
				setTimeout(async () => {
					try {
						const mlApiUrl = import.meta.env.VITE_ML_API_URL || "http://localhost:8000";
						const retryResponse = await fetch(`${mlApiUrl}/docs`);
						if (retryResponse.ok) {
							setMlServerAwake(true);
							toast.dismiss('ml-server-wake-toast');
							toast.success('ML server is ready! You can now generate predictions.');
						} else {
							toast.dismiss('ml-server-wake-toast');
							toast.error('ML server is still starting. Please wait a bit longer and refresh.');
						}
					} catch {
						toast.dismiss('ml-server-wake-toast');
						toast.error('Unable to reach ML server. Please check your connection or try again later.');
					}
				}, 45000);
			} finally {
				setMlServerChecking(false);
			}
		}

		checkMLServerHealth();
	}, []);

	async function submit(e) {
		e && e.preventDefault()

		// Check if ML server is awake before attempting prediction
		if (!mlServerAwake) {
			toast.error("ML server is still starting up. Please wait a moment and try again.", {
				duration: 5000,
				icon: '⏳'
			});
			return;
		}

		setLoading(true)
		setError(null)
		try {
			const res = await api.post('/api/predict', { horizonDates: Number(horizon) })
			setResult(res.data)
			setShowBreakdown(false)
			// console.log('Prediction result:', res.data)
			toast.success('Prediction generated successfully!')
		} catch (e) {
			const errorMsg = e.response?.data?.message || e.message
			setError(errorMsg)
			setResult(null)
			console.error('Prediction error:',errorMsg)
			toast.error("Prediction failed. Please try again.")
		} finally {
			setLoading(false)
		}
	}

	const totalPredRaw = result?.total_prediction
	let totalPredArray = []
	try {
		totalPredArray = normalizeTotalPrediction(totalPredRaw) || []
		// console.log('Normalized total_prediction:', totalPredArray)
	} catch (err) {
		console.error('Error normalizing total_prediction:', err, totalPredRaw)
		totalPredArray = []
	}

	const totalDisplay = (Array.isArray(totalPredArray) && totalPredArray.length > 0)
		? totalPredArray.reduce((s, x) => s + (Number(x) || 0), 0)
		: (typeof totalPredRaw === 'number' ? totalPredRaw : null)

	const byCategory = result?.prediction_by_category || {}

	const horizonCount = Math.max(1, Number(horizon || 1));

	// Always create labelDates sized to horizonCount (T+1 => next calendar month)
	const labelDates = Array.from({ length: horizonCount }).map((_, i) => {
		const d = new Date();
		d.setMonth(d.getMonth() + (i + 1)); // T+1 = next calendar month
		return {
			monthName: new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric' }).format(d),
			monthLabel: `Month ${i + 1}`
		};
	});
	let chartData = [];

	if (Array.isArray(totalPredArray) && totalPredArray.length >= horizonCount) {
		chartData = totalPredArray.slice(0, horizonCount).map((v, i) => ({
			name: labelDates[i].monthName,
			value: Number(v) || 0
		}));
	} else {
		const cats = Object.values(byCategory || {}).filter(Array.isArray);
		if (cats.length > 0) {
			chartData = Array.from({ length: horizonCount }).map((_, idx) => {
				const sum = cats.reduce((s, arr) => s + (Number(arr[idx]) || 0), 0);
				return { name: labelDates[idx].monthName, value: sum };
			});
		} else if (Array.isArray(totalPredArray) && totalPredArray.length > 0) {
			chartData = Array.from({ length: horizonCount }).map((_, idx) => ({
				name: labelDates[idx].monthName,
				value: Number(totalPredArray[idx] || 0)
			}));
		} else if (typeof totalPredRaw === 'number') {
			chartData = Array.from({ length: horizonCount }).map((_, idx) => ({
				name: labelDates[idx].monthName,
				value: idx === 0 ? Number(totalPredRaw) || 0 : 0
			}));
		} else {
			chartData = [];
		}
	}

	return (
		<div className="predict-page-container">
			{/* Loading overlay while checking ML server */}
			{mlServerChecking && (
				<div style={{
					position: 'fixed',
					top: 0,
					left: 0,
					right: 0,
					bottom: 0,
					background: 'rgba(0, 0, 0, 0.5)',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					zIndex: 9999
				}}>
					<div style={{
						background: 'var(--card-bg)',
						padding: '32px',
						borderRadius: '12px',
						textAlign: 'center',
						boxShadow: 'var(--shadow-lg)'
					}}>
						<LoaderCircle size={48} className="animate-spin" style={{ margin: '0 auto' }} />
						<div style={{ marginTop: '16px', color: 'var(--text-primary)' }}>
							Checking ML server status...
						</div>
					</div>
				</div>
			)}

			{/* Header */}
			<header className="predict-page-header card-surface">
				<div className="header-left">
					<div className="title-wrap">
						<h1 className="page-title">Expense Prediction</h1>
						<p className="page-description">AI-powered forecast based on your historic expenses</p>
					</div>
				</div>
				<div className="header-actions">
					<button className="btn ghost" onClick={() => { setResult(null); setError(null); }} title="Clear results">Clear</button>
				</div>
			</header>

			{/* Form + CTA */}
			<section className="form-grid page-card-container">
				<form onSubmit={submit} className="card-body form-card">
					<div className="form-row">
						<label className="label" htmlFor="horizon">
							<Calendar size={16} />
							<span>Forecast Horizon</span>
						</label>
						<div className="range-wrap">
							<input
								id="horizon"
								type="range"
								min="1"
								max="12"
								value={horizon}
								onChange={(e) => setHorizon(Number(e.target.value))}
								className="input-range"
								step="1"
							/>
							<div className="horizon-display">
								<strong>{horizon}</strong>
								<span>months</span>
							</div>
						</div>
						<div className="horizon-labels small">
							<span>1</span>
							<span>6</span>
							<span>12</span>
						</div>
					</div>

					<button type="submit" className="page-button primary" disabled={loading || !mlServerAwake}>
						{loading ? (
							<div className="btn-loader">
								<LoaderCircle size={18} className="animate-spin" />
								<span>Generating…</span>
							</div>
						) : (
							<>
								<TrendingUp size={18} />
								<span>Generate Prediction</span>
							</>
						)}
					</button>

					{/* ML Server status indicator */}
					{!mlServerAwake && !mlServerChecking && (
						<div style={{
							padding: '12px',
							borderRadius: '8px',
							background: 'rgba(251, 191, 36, 0.1)',
							border: '1px solid rgba(251, 191, 36, 0.3)',
							fontSize: '14px',
							color: 'var(--text-primary)',
							textAlign: 'center',
							marginTop: '12px'
						}}>
							🤖 ML server is starting up. Please wait...
						</div>
					)}
				</form>

				{/* Quick stats card (skeleton if loading) */}
				<div className="card-body stats-card">
					{loading ? (
						<div className="skeleton-block">
							<div className="skeleton-title" />
							<div className="skeleton-value" />
						</div>
					) : (
						<>
							<p className="card-text small muted">
								Total Predicted
							</p>
							<h2 className="stats-value">₹{Number(totalDisplay || 0).toFixed(0)}</h2>
							<p className="card-text small muted">For the next {horizon} {horizon === 1 ? 'month' : 'months'}</p>
						</>
					)}
				</div>
			</section>

			{/* Error */}
			{error && (
				<div className="page-card-container error-card">
					<div className="card-body error-body">
						<strong>Error</strong>
						<p className="muted">{error}</p>
					</div>
				</div>
			)}

			{/* Results */}
			{result && (
				<section className="page-card-container predict-results-container">
					<div className="grid-2 responsive-grid">
						{/* Summary */}
						<div className="card-body predict-summary-card">
							<div className="predict-summary-content">
								<div>
									<p className="predict-summary-title">Projected Value</p>
									<h3 className="predict-summary-value">{totalDisplay != null ? `₹${Number(totalPredArray[0]).toFixed(0)}` : '—'}</h3>
									<p className="card-text small muted"> For next month</p>
								</div>
								<div className="predict-summary-icon">
									<TrendingUp size={44} />
								</div>
							</div>
						</div>

						{/* Chart */}
						<div className="card-body predict-chart-card">
							<h3 className="predict-chart-title"><BarChart3 size={18} /> Prediction Trend</h3>
							{chartData.length > 0 ? (
								<ResponsiveContainer width="100%" height={260}>
									<BarChart data={chartData}>
										<CartesianGrid strokeDasharray="3 3" stroke="#eef2ff" />
										<XAxis dataKey="name" />
										<YAxis />
										<Tooltip formatter={(value) => [`₹${Number(value).toFixed(2)}`, 'Predicted']} />
										<Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={36} />
									</BarChart>
								</ResponsiveContainer>
							) : (
								<p className="muted">No time-series available for chart</p>
							)}

						</div>
					</div>

					{/* Category Breakdown */}
					<div className="card-body">
						<div className="breakdown-header">
							<h3 className="predict-chart-title"><BarChart3 size={16} /> Category Breakdown</h3>
							<button className="btn small ghost" onClick={() => setShowBreakdown(s => !s)}>
								{showBreakdown ? <><EyeOff size={14} /> Hide</> : <><Eye size={14} /> Show</>}
							</button>
						</div>
						{showBreakdown && (
							<div className="table-responsive">
								{Object.keys(byCategory).length === 0 ? (
									<div className="no-predictions">No category predictions available</div>
								) : (
									<table className="predict-category-table">
										<thead>
											<tr>
												<th>Category</th>
												{(labelDates && labelDates.length > 0 ? labelDates : [{ monthLabel: 'Month 1' }]).map(c => (
													<th key={c.monthLabel}>{c.monthLabel}</th>
												))}
											</tr>
										</thead>
										<tbody>
											{Object.entries(byCategory).map(([cat, arr]) => (
												<tr key={cat}>
													<td className="category-label">{cat}</td>
													{Array.isArray(arr) ? arr.map((v, i) => (
														<td key={i}>₹{Number(v).toFixed(0)}</td>
													)) : (
														<td>{String(arr)}</td>
													)}
												</tr>
											))}
										</tbody>
									</table>
								)}
							</div>
						)}
					</div>

					{/* Insights */}
					<div className="card-body predict-tips-card">
						<div className="tips-inner">
							<div className="tips-icon-wrap">?	</div>
							<div>
								<h4 className="tips-title">Prediction Insights</h4>
								<p className="tips-text muted">Predictions rely on historical patterns. Use them as a guide — review categories and adjust your budget if seasonal or one-off events occurred.</p>
							</div>
						</div>
					</div>
				</section>
			)}

			{/* Centered loader overlay (global) */}
			{loading && (
				<div className="loader-overlay" aria-hidden={!loading}>
					<div className="loader-card card-surface">
						<LoaderCircle size={42} className="animate-spin" />
						<p className="muted">Generating prediction… this usually takes a few seconds</p>
					</div>
				</div>
			)}
		</div>
	)
}
