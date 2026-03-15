import mongoose from "mongoose";

const narrativeSchema = new mongoose.Schema(
  {
    executive_summary: { type: String, default: "" },
    spending_highlights: { type: String, default: "" },
    category_analysis: [{ type: String }],
    anomalies: [{ type: String }],
    budget_insights: { type: String, default: "" },
    recommendations: [{ type: String }],
    next_month_watchouts: [{ type: String }],
  },
  { _id: false }
);

const modelInfoSchema = new mongoose.Schema(
  {
    modelName: { type: String, default: "unknown" },
    provider: { type: String, default: "unknown" },
    usedFallback: { type: Boolean, default: false },
  },
  { _id: false }
);

const chatMessageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const monthlyReportSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    monthKey: {
      type: String,
      required: true,
      match: /^\d{4}-(0[1-9]|1[0-2])$/,
    },
    timezone: {
      type: String,
      required: true,
      default: "UTC",
      trim: true,
    },
    /** pending → processing → ready | failed */
    status: {
      type: String,
      enum: ["pending", "processing", "ready", "failed"],
      default: "pending",
    },
    generationMode: {
      type: String,
      enum: ["on_demand", "scheduled"],
      default: "on_demand",
    },
    narrative: {
      type: narrativeSchema,
      default: null,
    },
    modelInfo: {
      type: modelInfoSchema,
      default: null,
    },
    chatHistory: {
      type: [chatMessageSchema],
      default: [],
    },
    /**
     * Full normalised payload sent to the Python report service.
     * Stored so the PDF can be reproduced without re-aggregating DB data.
     */
    reportPayload: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    /** Snapshot of computed KPI metrics for quick dashboard reads. */
    metricsSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    errorMessage: {
      type: String,
      default: null,
    },
    lastGeneratedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Enforce one report per user per monthKey
monthlyReportSchema.index({ user: 1, monthKey: 1 }, { unique: true });

const MonthlyReport = mongoose.model("MonthlyReport", monthlyReportSchema);
export default MonthlyReport;
