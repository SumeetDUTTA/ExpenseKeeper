/**
 * Report controllers — aggregate monthly metrics from MongoDB,
 * call the Python report service, persist results, and serve them.
 *
 * Routes handled:
 *   POST /api/reports/generate          – on-demand generation / regeneration
 *   GET  /api/reports                   – list all report stubs for the user
 *   GET  /api/reports/:monthKey         – full report JSON for one month
 *   GET  /api/reports/:monthKey/download – stream PDF to the client
 */

import Expense from "../models/expense.js";
import MonthlyBudget from "../models/budget.js";
import User from "../models/user.js";
import MonthlyReport from "../models/report.js";
import ApiError from "../utils/ApiError.js";
import { isSpendingCategory, resolveTimezone } from "../utils/budgetHelpers.js";
import { generateNarrative, generatePDF } from "../mlServices/reportServiceClient.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

const NON_SPENDING = new Set(["Salary", "Investment"]);

const RECURRING_MIN_AMOUNT = 100;
const RECURRING_MAX_VARIANCE = 0.25;
const LIFESTYLE_CREEP_MIN_GROWTH_PCT = 15;
const LIFESTYLE_CREEP_MIN_EXCESS = 150;

function round2(v) {
  return parseFloat(Number(v || 0).toFixed(2));
}

function monthKeyFromDate(date) {
  const d = new Date(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function sanitizeNote(note) {
  if (typeof note !== "string") return "";
  return note.replace(/\s+/g, " ").trim().slice(0, 120);
}

function normalizeNote(note) {
  return sanitizeNote(note)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function monthLabel(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function previousMonthKey(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthRange(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  return {
    start: new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0)),
    end:   new Date(Date.UTC(year, month,     0, 23, 59, 59, 999)),
  };
}

/**
 * Build the full normalised GenerateReportRequest payload consumed by the
 * Python report service.  This is also stored in the DB so the PDF can be
 * re-generated without hitting MongoDB again.
 */
async function buildReportPayload(userId, monthKey, timezone) {
  const user = await User.findById(userId).select("name userType monthlyBudget").lean();
  if (!user) throw new ApiError(404, "User not found");

  const { start, end } = monthRange(monthKey);
  const expenses = await Expense.find({
    user: userId,
    date: { $gte: start, $lte: end },
  }).lean();

  const spending = expenses.filter((e) => isSpendingCategory(e.category));
  const income   = expenses.filter((e) => NON_SPENDING.has(e.category));

  const totalSpent  = spending.reduce((s, e) => s + e.amount, 0);
  const totalIncome = income.reduce((s, e)   => s + e.amount, 0);
  const netSavings  = totalIncome - totalSpent;

  // ── Category breakdown ──────────────────────────────────────────────────
  const catMap = new Map();
  for (const e of spending) {
    const cur = catMap.get(e.category) || { amount: 0, count: 0 };
    catMap.set(e.category, { amount: cur.amount + e.amount, count: cur.count + 1 });
  }
  const categoryBreakdown = [...catMap.entries()]
    .map(([name, d]) => ({
      name,
      amount:  Math.round(d.amount),
      percent: totalSpent > 0 ? parseFloat(((d.amount / totalSpent) * 100).toFixed(2)) : 0,
      count:   d.count,
    }))
    .sort((a, b) => b.amount - a.amount);

  const topCat = categoryBreakdown[0] || null;

  // ── Budget data ─────────────────────────────────────────────────────────
  const budgetDoc = await MonthlyBudget.findOne({ user: userId, monthKey }).lean();
  const budgetItems = (budgetDoc?.items || []).map((item) => ({
    name:        item.name,
    allocated:   item.allocated || 0,
    spent:       item.spent     || 0,
    remaining:   item.remaining || 0,
    usagePercent:
      item.allocated > 0
        ? parseFloat(((item.spent / item.allocated) * 100).toFixed(1))
        : 0,
  }));

  // ── Period change (vs last month) ───────────────────────────────────────
  const { start: ps, end: pe } = monthRange(previousMonthKey(monthKey));
  const prevAgg = await Expense.aggregate([
    {
      $match: {
        user:     userId,
        date:     { $gte: ps, $lte: pe },
        category: { $nin: ["Salary", "Investment"] },
      },
    },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  const prevTotal   = prevAgg.length > 0 ? prevAgg[0].total : null;
  const vsLastMonth =
    prevTotal != null && prevTotal > 0
      ? parseFloat((((totalSpent - prevTotal) / prevTotal) * 100).toFixed(2))
      : null;

  // ── Daily average & adherence ───────────────────────────────────────────
  const [year, month] = monthKey.split("-").map(Number);
  const daysInMonth   = new Date(year, month, 0).getDate();
  const dailyAverage  = daysInMonth > 0 ? parseFloat((totalSpent / daysInMonth).toFixed(2)) : 0;

  const budget           = user.monthlyBudget || 0;
  const budgetVariance   = parseFloat((budget - totalSpent).toFixed(2));
  const budgetUsedPercent =
    budget > 0
      ? parseFloat((((totalSpent / budget) * 100)).toFixed(1))
      : 0;
  const budgetAdherence  =
    budget > 0
      ? parseFloat((Math.max(0, Math.min(100, (1 - totalSpent / budget) * 100)).toFixed(1)))
      : 0;

  // ── Weekly trend ────────────────────────────────────────────────────────
  const weekMap = new Map();
  for (const e of spending) {
    const day  = new Date(e.date).getUTCDate();
    const week = `Week ${Math.ceil(day / 7)}`;
    weekMap.set(week, (weekMap.get(week) || 0) + e.amount);
  }
  const weeklyTrend = [...weekMap.entries()]
    .sort((a, b) => +a[0].split(" ")[1] - +b[0].split(" ")[1])
    .map(([label, amount]) => ({ label, amount: Math.round(amount) }));

  // ── Note context + behavior signals (recurring, lifestyle creep) ───────
  const noteContexts = spending
    .filter((e) => sanitizeNote(e.note).length > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 12)
    .map((e) => ({
      date: new Date(e.date).toISOString(),
      category: e.category,
      amount: round2(e.amount),
      note: sanitizeNote(e.note),
    }));

  const historyStart = new Date(Date.UTC(year, month - 6, 1, 0, 0, 0, 0));
  const historyExpenses = await Expense.find({
    user: userId,
    date: { $gte: historyStart, $lte: end },
    category: { $nin: [...NON_SPENDING] },
  })
    .select("amount category note date")
    .lean();

  const recurringGroups = new Map();
  const monthTotals = new Map();
  const monthCategoryTotals = new Map();

  for (const e of historyExpenses) {
    const mk = monthKeyFromDate(e.date);
    const amount = Number(e.amount) || 0;

    monthTotals.set(mk, (monthTotals.get(mk) || 0) + amount);
    if (!monthCategoryTotals.has(mk)) monthCategoryTotals.set(mk, new Map());
    const catMapForMonth = monthCategoryTotals.get(mk);
    catMapForMonth.set(e.category, (catMapForMonth.get(e.category) || 0) + amount);

    const noteNorm = normalizeNote(e.note || "");
    const amountBucket = Math.round(amount / 50) * 50;
    const key =
      noteNorm.length >= 4
        ? `${e.category}|note:${noteNorm}`
        : `${e.category}|amt:${amountBucket}`;

    if (!recurringGroups.has(key)) {
      recurringGroups.set(key, {
        category: e.category,
        description: sanitizeNote(e.note) || `${e.category} recurring charge`,
        amounts: [],
        months: new Set(),
        currentMonthHits: 0,
      });
    }

    const group = recurringGroups.get(key);
    group.amounts.push(amount);
    group.months.add(mk);
    if (mk === monthKey) group.currentMonthHits += 1;
  }

  const recurringSignals = [];
  for (const g of recurringGroups.values()) {
    if (g.months.size < 2 || g.currentMonthHits < 1) continue;

    const avg = g.amounts.reduce((s, v) => s + v, 0) / g.amounts.length;
    if (avg < RECURRING_MIN_AMOUNT) continue;

    const maxDev = Math.max(...g.amounts.map((v) => Math.abs(v - avg))) / Math.max(1, avg);
    if (maxDev > RECURRING_MAX_VARIANCE) continue;

    const confidence = Math.min(0.95, 0.45 + g.months.size * 0.1 + Math.max(0, 0.25 - maxDev));
    recurringSignals.push({
      description: g.description,
      category: g.category,
      estimatedMonthlyAmount: round2(avg),
      monthsDetected: g.months.size,
      confidence: round2(confidence),
    });
  }

  recurringSignals.sort((a, b) => b.estimatedMonthlyAmount - a.estimatedMonthlyAmount);
  const topRecurringSignals = recurringSignals.slice(0, 5);
  const recurringEstimatedTotal = round2(
    topRecurringSignals.reduce((s, r) => s + r.estimatedMonthlyAmount, 0)
  );

  const historyMonthKeys = [...monthTotals.keys()]
    .filter((mk) => mk !== monthKey)
    .sort();

  const currentCategoryMap = new Map(categoryBreakdown.map((c) => [c.name, c.amount]));
  const lifestyleCreepSignals = [];

  for (const [category, currentAmount] of currentCategoryMap.entries()) {
    const prevValues = historyMonthKeys
      .map((mk) => monthCategoryTotals.get(mk)?.get(category) || 0)
      .filter((v) => v > 0);

    if (prevValues.length < 2) continue;

    const baseline = prevValues.reduce((s, v) => s + v, 0) / prevValues.length;
    const growth = baseline > 0 ? ((currentAmount - baseline) / baseline) * 100 : 0;
    const excess = currentAmount - baseline;

    if (growth >= LIFESTYLE_CREEP_MIN_GROWTH_PCT && excess >= LIFESTYLE_CREEP_MIN_EXCESS) {
      lifestyleCreepSignals.push({
        category,
        currentAmount: round2(currentAmount),
        baselineAmount: round2(baseline),
        growthPercent: round2(growth),
      });
    }
  }

  lifestyleCreepSignals.sort((a, b) => b.growthPercent - a.growthPercent);

  const prevTotalValues = historyMonthKeys
    .map((mk) => monthTotals.get(mk) || 0)
    .filter((v) => v > 0);
  const totalBaseline =
    prevTotalValues.length > 0
      ? prevTotalValues.reduce((s, v) => s + v, 0) / prevTotalValues.length
      : 0;
  const totalLifestyleCreepPercent =
    totalBaseline > 0 ? round2(((totalSpent - totalBaseline) / totalBaseline) * 100) : null;
  const totalLifestyleCreepExcess = totalBaseline > 0 ? round2(Math.max(0, totalSpent - totalBaseline)) : 0;

  // ── Assemble payload ────────────────────────────────────────────────────
  const metricsSnapshot = {
    totalSpent:             parseFloat(totalSpent.toFixed(2)),
    totalIncome:            parseFloat(totalIncome.toFixed(2)),
    netSavings:             parseFloat(netSavings.toFixed(2)),
    budgetVariance,
    budgetUsedPercent,
    budgetAdherencePercent: budgetAdherence,
    periodChange:           { vsLastMonth, vsLastYear: null },
    dailyAverage,
    transactionCount:       expenses.length,
    categoryBreakdown,
    topSpendingCategory:    topCat?.name  || "",
    topCategoryAmount:      topCat?.amount || 0,
    budgetItems,
    noteContexts,
    recurringSignals: topRecurringSignals,
    recurringEstimatedTotal,
    lifestyleCreepSignals,
    totalLifestyleCreepPercent,
    totalLifestyleCreepExcess,
  };

  return {
    payload: {
      reportMeta: {
        monthKey,
        monthLabel:    monthLabel(monthKey),
        userType:      user.userType      || "young_professional",
        userName:      user.name          || "User",
        monthlyBudget: budget,
        timezone:      resolveTimezone(timezone),
        generatedAt:   new Date().toISOString(),
      },
      metrics:   metricsSnapshot,
      chartData: { weeklyTrend, dailyTrend: [] },
    },
    metricsSnapshot,
  };
}

// ── Controllers ───────────────────────────────────────────────────────────────

/**
 * POST /api/reports/generate
 * Aggregates metrics, calls Python service, upserts MonthlyReport document.
 */
export async function generateReport(req, res, next) {
  try {
    const { monthKey, timezone: tzInput } = req.body;
    const timezone = resolveTimezone(tzInput || "UTC");
    const userId   = req.user._id;

    // Prevent duplicate concurrent generation
    const existing = await MonthlyReport.findOne({ user: userId, monthKey });
    if (existing?.status === "processing") {
      return res.status(409).json({
        success: false,
        message: "Report is already being generated for this month.",
        status:  "processing",
      });
    }

    // Mark as processing (upsert)
    const reportDoc = await MonthlyReport.findOneAndUpdate(
      { user: userId, monthKey },
      {
        $set: {
          status:         "processing",
          timezone,
          generationMode: "on_demand",
          errorMessage:   null,
        },
      },
      { upsert: true, new: true }
    );

    // Build payload (aggregation)
    let payload, metricsSnapshot;
    try {
      ({ payload, metricsSnapshot } = await buildReportPayload(userId, monthKey, timezone));
    } catch (err) {
      await MonthlyReport.findByIdAndUpdate(reportDoc._id, {
        $set: { status: "failed", errorMessage: err.message },
      });
      throw err;
    }

    // Call Python report service
    const result = await generateNarrative(payload);

    if (!result.success) {
      await MonthlyReport.findByIdAndUpdate(reportDoc._id, {
        $set: {
          status:       "failed",
          errorMessage: result.error || "Report service unavailable",
        },
      });
      throw new ApiError(503, "Report generation service is unavailable. Please try again later.");
    }

    // Persist
    const saved = await MonthlyReport.findByIdAndUpdate(
      reportDoc._id,
      {
        $set: {
          status:          "ready",
          narrative:       result.data.narrative,
          modelInfo:       result.data.modelInfo,
          reportPayload:   payload,
          metricsSnapshot,
          lastGeneratedAt: new Date(),
          errorMessage:    null,
        },
      },
      { new: true }
    );

    return res.status(200).json({
      success:   true,
      monthKey,
      status:    "ready",
      narrative: saved.narrative,
      modelInfo: saved.modelInfo,
      metrics:   metricsSnapshot,
      generatedAt: saved.lastGeneratedAt,
    });
  } catch (err) {
    next(err instanceof ApiError ? err : new ApiError(500, "Failed to generate report"));
  }
}

/**
 * GET /api/reports
 * Returns a list of all report stubs (status + monthKey) for the user.
 */
export async function listReports(req, res, next) {
  try {
    const reports = await MonthlyReport.find({ user: req.user._id })
      .select("monthKey status generationMode lastGeneratedAt metricsSnapshot modelInfo")
      .sort({ monthKey: -1 })
      .lean();

    return res.status(200).json({ success: true, reports });
  } catch (err) {
    next(new ApiError(500, "Failed to fetch reports"));
  }
}

/**
 * GET /api/reports/:monthKey
 * Returns the full report JSON for a single month.
 */
export async function getReport(req, res, next) {
  try {
    const { monthKey } = req.params;
    const report = await MonthlyReport.findOne({
      user:     req.user._id,
      monthKey,
    }).lean();

    if (!report) {
      throw new ApiError(404, `No report found for ${monthKey}. Generate one first.`);
    }

    return res.status(200).json({ success: true, report });
  } catch (err) {
    next(err instanceof ApiError ? err : new ApiError(500, "Failed to fetch report"));
  }
}

/**
 * GET /api/reports/:monthKey/download
 * Calls the Python service to generate a PDF and streams it to the client.
 * Uses the stored reportPayload so no re-aggregation is needed.
 */
export async function downloadReport(req, res, next) {
  try {
    const { monthKey } = req.params;
    const report = await MonthlyReport.findOne({
      user:     req.user._id,
      monthKey,
      status:   "ready",
    }).lean();

    if (!report) {
      throw new ApiError(
        404,
        `No ready report found for ${monthKey}. Generate the report first.`
      );
    }

    if (!report.reportPayload) {
      throw new ApiError(500, "Report payload missing — please regenerate the report.");
    }

    const { success, pdfBuffer, error } = await generatePDF(report.reportPayload);
    if (!success || !pdfBuffer) {
      throw new ApiError(503, `PDF generation failed: ${error || "unknown error"}`);
    }

    const safeMonth = monthKey.replace("-", "_");
    const fileName  = `ExpenseReport_${safeMonth}.pdf`;

    res.set({
      "Content-Type":        "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Length":      pdfBuffer.length,
    });
    return res.send(pdfBuffer);
  } catch (err) {
    next(err instanceof ApiError ? err : new ApiError(500, "Failed to generate PDF"));
  }
}
