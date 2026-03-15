import React, { useState, useEffect, useCallback } from "react";
import { toast } from "react-hot-toast";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line, Area, AreaChart,
} from "recharts";
import { FileText, Download, RefreshCw, AlertCircle, CheckCircle, Clock } from "lucide-react";

import {
  generateReport,
  getReport,
  listReports,
  downloadReportPDF,
} from "../lib/api";
import ChatPanel from "../components/ChatPanel";
import "../styles/MonthlyReport.css";

// ── Constants ─────────────────────────────────────────────────────────────────
const CHART_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b",
  "#10b981", "#3b82f6", "#f97316", "#06b6d4",
  "#84cc16", "#a8a29e",
];

const INR = (v) =>
  "₹" + Number(v).toLocaleString("en-IN", { maximumFractionDigits: 0 });

// ── Helper: build the last 12 YYYY-MM options ─────────────────────────────────
function buildMonthOptions() {
  const opts = [];
  const now  = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i - 1, 1);
    const key   = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("en-US", { month: "long", year: "numeric" });
    opts.push({ key, label });
  }
  return opts;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBanner({ status, message }) {
  if (!status) return null;
  const cfg = {
    processing: { icon: <Clock size={16} />, label: message || "Generating report…", cls: "processing" },
    ready:      { icon: <CheckCircle size={16} />, label: message || "Report ready", cls: "ready" },
    failed:     { icon: <AlertCircle size={16} />, label: message || "Generation failed", cls: "failed" },
  };
  const c = cfg[status];
  if (!c) return null;
  return (
    <div className={`report-status-banner ${c.cls}`}>
      {c.icon}
      <span>{c.label}</span>
    </div>
  );
}

function KPICard({ label, value, sub, colorClass }) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value ${colorClass || ""}`}>{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

function NarrativeSection({ title, content, variant }) {
  if (!content) return null;

  // List variants
  if (variant === "list" || variant === "anomaly" || variant === "recs" || variant === "watchouts") {
    const items = Array.isArray(content) ? content : [content];
    if (items.length === 0) return null;
    return (
      <div className="narrative-section">
        <h4>{title}</h4>
        <ul className={`narrative-list ${variant === "list" ? "" : variant}`}>
          {items.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
      </div>
    );
  }

  return (
    <div className="narrative-section">
      <h4>{title}</h4>
      <p>{content}</p>
    </div>
  );
}

const MONTH_OPTIONS = buildMonthOptions();

// ── Main component ────────────────────────────────────────────────────────────

export default function MonthlyReport() {
  const monthOptions = MONTH_OPTIONS;

  const [selectedMonth, setSelectedMonth] = useState(monthOptions[1].key); // default: last month
  const [report, setReport]               = useState(null);
  const [historyList, setHistoryList]     = useState([]);
  const [generating, setGenerating]       = useState(false);
  const [downloading, setDownloading]     = useState(false);
  const [loading, setLoading]             = useState(false);

  // ── Load existing report when month changes ─────────────────────────────
  const loadReport = useCallback(async (mk) => {
    setLoading(true);
    setReport(null);
    try {
      const { data } = await getReport(mk);
      setReport(data.report);
    } catch (err) {
      if (err?.response?.status !== 404) {
        toast.error("Could not load report.");
      }
      // 404 = no report yet → report stays null
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const { data } = await listReports();
      setHistoryList(data.reports || []);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    loadReport(selectedMonth);
  }, [selectedMonth, loadReport]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // ── Generate / regenerate ───────────────────────────────────────────────
  const handleGenerate = async () => {
    setGenerating(true);
    const toastId = toast.loading("Generating report…");
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const { data } = await generateReport(selectedMonth, timezone);
      setReport({ ...data, monthKey: selectedMonth });
      toast.success("Report generated!", { id: toastId });
      loadHistory();
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        "Generation failed. Is the report service running?";
      toast.error(msg, { id: toastId });
    } finally {
      setGenerating(false);
    }
  };

  // ── PDF download ────────────────────────────────────────────────────────
  const handleDownload = async () => {
    if (!report) return;
    setDownloading(true);
    const toastId = toast.loading("Building PDF…");
    try {
      await downloadReportPDF(selectedMonth);
      toast.success("PDF downloaded!", { id: toastId });
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        "PDF generation failed. Ensure the report service is online.";
      toast.error(msg, { id: toastId });
    } finally {
      setDownloading(false);
    }
  };

  // ── Derived display data ────────────────────────────────────────────────
  const metrics   = report?.metrics   || report?.metricsSnapshot || null;
  const narrative = report?.narrative || null;
  const modelInfo = report?.modelInfo || null;
  const isReady   = report?.status    === "ready";

  const variantClass = (v) => {
    if (v == null) return "";
    return v >= 0 ? "positive" : "negative";
  };

  const selectedLabel = monthOptions.find((o) => o.key === selectedMonth)?.label || selectedMonth;

  // ── History chip status lookup ──────────────────────────────────────────
  const historyStatus = useCallback(
    (mk) => historyList.find((r) => r.monthKey === mk)?.status || "pending",
    [historyList]
  );

  return (
    <div className="report-page">
      <div className="report-container">

        {/* Header */}
        <div className="report-header">
          <h1>
            <FileText size={22} style={{ display: "inline", marginRight: 8, verticalAlign: "middle" }} />
            Monthly Expense Report
          </h1>

          <div className="report-controls">
            <select
              className="report-month-select"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              {monthOptions.map((o) => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>

            <button
              className="btn-generate"
              onClick={handleGenerate}
              disabled={generating || downloading}
            >
              <RefreshCw size={15} className={generating ? "animate-spin" : ""} />
              {generating ? "Generating…" : isReady ? "Regenerate" : "Generate Report"}
            </button>

            {isReady && (
              <button
                className="btn-download"
                onClick={handleDownload}
                disabled={downloading || generating}
              >
                <Download size={15} />
                {downloading ? "Building PDF…" : "Download PDF"}
              </button>
            )}
          </div>
        </div>

        {/* Status banner */}
        {generating && <StatusBanner status="processing" />}
        {!generating && report?.status && (
          <StatusBanner
            status={report.status}
            message={
              report.status === "failed"
                ? report.errorMessage || "Generation failed."
                : null
            }
          />
        )}

        {/* Report history */}
        {historyList.length > 0 && (
          <div className="report-history">
            <h3>Previous Reports</h3>
            <div className="history-list">
              {historyList.map((r) => (
                <button
                  key={r.monthKey}
                  className={`history-chip ${historyStatus(r.monthKey)} ${r.monthKey === selectedMonth ? "active" : ""}`}
                  onClick={() => setSelectedMonth(r.monthKey)}
                >
                  {r.monthKey}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading spinner */}
        {loading && (
          <div className="report-spinner">
            <div className="spinner-ring" />
            <span>Loading report…</span>
          </div>
        )}

        {/* Empty state */}
        {!loading && !generating && !isReady && (
          <div className="report-empty">
            <FileText size={52} />
            <p>No report for <strong>{selectedLabel}</strong> yet.</p>
            <p>Click <em>Generate Report</em> to create one.</p>
          </div>
        )}

        {/* ── Report content ─────────────────────────────────────────────── */}
        {!loading && isReady && metrics && (
          <>
            {/* KPI cards */}
            <div className="report-kpis">
              <KPICard
                label="Total Spent"
                value={INR(metrics.totalSpent)}
                sub={`${metrics.transactionCount} transactions`}
              />
              <KPICard
                label="Monthly Budget"
                value={INR(report.reportPayload?.reportMeta?.monthlyBudget ?? 0)}
                sub={`${metrics.budgetAdherencePercent?.toFixed(1)}% adherence`}
                colorClass="primary"
              />
              <KPICard
                label="Budget Variance"
                value={`${metrics.budgetVariance >= 0 ? "+" : "-"}${INR(Math.abs(metrics.budgetVariance))}`}
                sub={metrics.budgetVariance >= 0 ? "under budget" : "over budget"}
                colorClass={variantClass(metrics.budgetVariance)}
              />
              <KPICard
                label="vs Last Month"
                value={
                  metrics.periodChange?.vsLastMonth != null
                    ? `${metrics.periodChange.vsLastMonth >= 0 ? "+" : ""}${metrics.periodChange.vsLastMonth.toFixed(1)}%`
                    : "N/A"
                }
                sub={`₹${metrics.dailyAverage?.toFixed(0)} / day avg`}
                colorClass={variantClass(metrics.periodChange?.vsLastMonth != null ? -metrics.periodChange.vsLastMonth : null)}
              />
            </div>

            {/* Charts row */}
            <div className="report-charts-grid">
              {/* Pie chart */}
              <div className="report-chart-card">
                <h3>Category Distribution</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={metrics.categoryBreakdown}
                      dataKey="amount"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, percent }) =>
                        `${name.split(" ")[0]} ${(percent).toFixed(2)}%`
                      }
                      labelLine={false}
                    >
                      {metrics.categoryBreakdown.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => [INR(v), "Amount"]} contentStyle={{ background: "var(--card-bg)", borderColor: "var(--border-color)", color: "var(--text-primary)" }} labelStyle={{ color: "var(--text-secondary)" }} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Compact legend */}
                <div className="pie-legend">
                  {metrics.categoryBreakdown.slice(0, 6).map((c, i) => (
                    <div key={c.name} className="pie-legend-item">
                      <span
                        className="pie-legend-dot"
                        style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                      />
                      <span>{c.name} — {INR(c.amount)} ({c.percent.toFixed(1)}%)</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bar chart */}
              <div className="report-chart-card">
                <h3>Spending by Category</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={metrics.categoryBreakdown.slice(0, 8)}
                    margin={{ top: 10, right: 10, left: 0, bottom: 40 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 12, fill: "var(--text-secondary)" }}
                      angle={-25}
                      textAnchor="end"
                      interval={0}
                      stroke="var(--text-secondary)"
                    />
                    <YAxis
                      tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                      tick={{ fontSize: 12, fill: "var(--text-secondary)" }}
                      stroke="var(--text-secondary)"
                    />
                    <Tooltip formatter={(v) => [INR(v), "Amount"]} contentStyle={{ background: "var(--card-bg)", borderColor: "var(--border-color)", color: "var(--text-primary)" }} labelStyle={{ color: "var(--text-secondary)" }} />
                    <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                      {metrics.categoryBreakdown.slice(0, 8).map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Weekly trend */}
            {report.reportPayload?.chartData?.weeklyTrend?.length > 1 && (
              <div className="report-chart-full">
                <h3>Weekly Spending Trend</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart
                    data={report.reportPayload.chartData.weeklyTrend}
                    margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.18} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--text-secondary)" }} />
                    <YAxis
                      tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                      tick={{ fontSize: 12, fill: "var(--text-secondary)" }}
                    />
                    <Tooltip formatter={(v) => [INR(v), "Spent"]} contentStyle={{ background: "var(--card-bg)", borderColor: "var(--border-color)", color: "var(--text-primary)" }} labelStyle={{ color: "var(--text-secondary)" }} />
                    <Area
                      type="monotone"
                      dataKey="amount"
                      stroke="#6366f1"
                      strokeWidth={2.5}
                      fill="url(#trendGrad)"
                      dot={{ r: 5, fill: "#fff", stroke: "#6366f1", strokeWidth: 2 }}
                      activeDot={{ r: 7 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Budget adherence */}
            {metrics.budgetItems?.length > 0 && (
              <div className="report-chart-full">
                <h3>Budget Bucket Adherence</h3>
                <div className="budget-adherence-list">
                  {metrics.budgetItems.map((item) => {
                    const pct     = Math.min(100, item.usagePercent);
                    const overrun = item.spent > item.allocated;
                    return (
                      <div key={item.name} className="bucket-row">
                        <div className="bucket-row-header">
                          <span>{item.name}</span>
                          <span style={{ color: overrun ? "#ef4444" : "#10b981" }}>
                            {INR(item.spent)} / {INR(item.allocated)}
                          </span>
                        </div>
                        <div className="bucket-row-meta">
                          {item.usagePercent.toFixed(1)}% used &nbsp;·&nbsp; {INR(item.remaining)} remaining
                        </div>
                        <div className="bucket-bar-track">
                          <div
                            className={`bucket-bar-fill ${overrun ? "overrun" : "ok"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* AI Narrative */}
            {narrative && (
              <div className="report-narrative">
                <div className="narrative-header">
                  <h2>AI-Generated Insights</h2>
                  {modelInfo && (
                    <span className={`model-badge ${modelInfo.usedFallback ? "fallback" : ""}`}>
                      {modelInfo.usedFallback
                        ? "Template mode (Model unavailable)"
                        : `LLM: ${modelInfo.modelName}`}
                    </span>
                  )}
                </div>

                <NarrativeSection title="Executive Summary"   content={narrative.executive_summary} />
                <NarrativeSection title="Spending Highlights" content={narrative.spending_highlights} />
                <NarrativeSection title="Budget Insights"     content={narrative.budget_insights} />
                <NarrativeSection title="Category Analysis"   content={narrative.category_analysis}   variant="list" />
                {narrative.anomalies?.length > 0 && (
                  <NarrativeSection title="Anomalies Detected" content={narrative.anomalies} variant="anomaly" />
                )}
                <NarrativeSection title="Recommendations"     content={narrative.recommendations}      variant="recs" />
                <NarrativeSection title="Next Month Watchouts" content={narrative.next_month_watchouts} variant="watchouts" />
              </div>
            )}

            <ChatPanel monthKey={selectedMonth} isReady={isReady} />
          </>
        )}

      </div>
    </div>
  );
}
