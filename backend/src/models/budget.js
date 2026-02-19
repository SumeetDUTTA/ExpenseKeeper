import mongoose from "mongoose";

const budgetItemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    allocated: {
      type: Number,
      required: true,
      min: 0,
    },
    spent: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    remaining: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  { _id: true }
);

const monthlyBudgetSchema = new mongoose.Schema(
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
    items: {
      type: [budgetItemSchema],
      default: [],
    },
    totalAllocated: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    totalSpent: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    totalRemaining: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  { timestamps: true }
);

monthlyBudgetSchema.index({ user: 1, monthKey: 1 }, { unique: true });

const MonthlyBudget = mongoose.model("MonthlyBudget", monthlyBudgetSchema);

export default MonthlyBudget;