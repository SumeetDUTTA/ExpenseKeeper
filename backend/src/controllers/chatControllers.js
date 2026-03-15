import ApiError from "../utils/ApiError.js";
import MonthlyReport from "../models/report.js";
import { callChatService } from "../mlServices/reportServiceClient.js";

const MAX_STORED_MESSAGES = 100;
const MAX_HISTORY_TO_MODEL = 30;
const MAX_MONTH_SUMMARIES = 12;

function buildMonthSummary(report) {
  const payload = report.reportPayload || {};
  const meta = payload.reportMeta || {};
  const metrics = report.metricsSnapshot || payload.metrics || {};
  const topCategories = (metrics.categoryBreakdown || [])
    .slice(0, 3)
    .map((item) => item.name)
    .filter(Boolean);

  return {
    monthKey: report.monthKey,
    monthLabel: meta.monthLabel || report.monthKey,
    totalSpent: Number(metrics.totalSpent) || 0,
    monthlyBudget: Number(meta.monthlyBudget) || 0,
    budgetVariance: Number(metrics.budgetVariance) || 0,
    topCategories,
  };
}

async function findReadyReport(userId, monthKey) {
  const report = await MonthlyReport.findOne({
    user: userId,
    monthKey,
    status: "ready",
  });

  if (!report) {
    throw new ApiError(404, `No ready report found for ${monthKey}. Generate the report first.`);
  }
  if (!report.reportPayload) {
    throw new ApiError(500, "Stored report payload is missing. Please regenerate the report.");
  }

  return report;
}

export async function getChatHistory(req, res, next) {
  try {
    const report = await findReadyReport(req.user._id, req.params.monthKey);
    return res.status(200).json({
      success: true,
      messages: report.chatHistory || [],
    });
  } catch (err) {
    next(err instanceof ApiError ? err : new ApiError(500, "Failed to fetch chat history"));
  }
}

export async function clearChatHistory(req, res, next) {
  try {
    const report = await findReadyReport(req.user._id, req.params.monthKey);
    report.chatHistory = [];
    await report.save();

    return res.status(200).json({
      success: true,
      message: "Chat history cleared.",
    });
  } catch (err) {
    next(err instanceof ApiError ? err : new ApiError(500, "Failed to clear chat history"));
  }
}

export async function sendChatMessage(req, res, next) {
  try {
    const { monthKey } = req.params;
    const { message } = req.body;
    const report = await findReadyReport(req.user._id, monthKey);

    const readyReports = await MonthlyReport.find({
      user: req.user._id,
      status: "ready",
    })
      .select("monthKey reportPayload metricsSnapshot")
      .sort({ monthKey: -1 })
      .limit(MAX_MONTH_SUMMARIES)
      .lean();

    const history = (report.chatHistory || [])
      .slice(-MAX_HISTORY_TO_MODEL)
      .map((item) => ({
        role: item.role,
        content: item.content,
      }));

    const payload = {
      reportPayload: report.reportPayload,
      history,
      message,
      allMonthsSummary: readyReports.map(buildMonthSummary),
    };

    const result = await callChatService(payload);
    if (!result.success || !result.data?.reply) {
      throw new ApiError(503, "Chat service is unavailable. Please try again later.");
    }

    const nextHistory = [
      ...(report.chatHistory || []),
      { role: "user", content: message, timestamp: new Date() },
      { role: "assistant", content: result.data.reply, timestamp: new Date() },
    ].slice(-MAX_STORED_MESSAGES);

    report.chatHistory = nextHistory;
    await report.save();

    return res.status(200).json({
      success: true,
      reply: result.data.reply,
      modelInfo: result.data.modelInfo,
      messages: report.chatHistory,
    });
  } catch (err) {
    next(err instanceof ApiError ? err : new ApiError(500, "Failed to send chat message"));
  }
}