import MonthlyBudget from "../models/budget.js";
import User from "../models/user.js";
import ApiError from "../utils/ApiError.js";
import {
  monthKeyFromDate,
  normalizeBudgetName,
  recalculateBudgetTotals,
  resolveTimezone,
} from "../utils/budgetHelpers.js";

function deriveRequestMonthAndTimezone(req) {
  const timezone = resolveTimezone(req.query.timezone || req.body.timezone || req.headers["x-timezone"]);
  const month = req.query.month || req.body.month || monthKeyFromDate(new Date(), timezone);
  return { month, timezone };
}

async function getOrCreateMonthBudget(userId, month, timezone) {
  let budget = await MonthlyBudget.findOne({ user: userId, monthKey: month });
  if (budget) return budget;

  const latestBudget = await MonthlyBudget.findOne({ user: userId })
    .sort({ monthKey: -1, updatedAt: -1 });

  const seededItems = latestBudget
    ? latestBudget.items.map((item) => ({
      name: item.name,
      allocated: Number(item.allocated) || 0,
      spent: 0,
      remaining: Number(item.allocated) || 0,
    }))
    : [];

  budget = new MonthlyBudget({
    user: userId,
    monthKey: month,
    timezone,
    items: seededItems,
  });

  recalculateBudgetTotals(budget);
  await budget.save();
  return budget;
}

async function getMonthBudget(req, res, next) {
  try {
    const { month, timezone } = deriveRequestMonthAndTimezone(req);
    const budget = await getOrCreateMonthBudget(req.user._id, month, timezone);

    return res.status(200).json({
      success: true,
      month: budget.monthKey,
      timezone: budget.timezone,
      items: budget.items,
      totals: {
        allocated: budget.totalAllocated,
        spent: budget.totalSpent,
        remaining: budget.totalRemaining,
      },
      updatedAt: budget.updatedAt,
    });
  } catch (error) {
    next(error);
  }
}

async function upsertMonthBudget(req, res, next) {
  try {
    const { month, timezone } = deriveRequestMonthAndTimezone(req);
    const incomingItems = Array.isArray(req.body.items) ? req.body.items : [];

    const normalizedItems = incomingItems.map((item) => ({
      id: item.id,
      name: normalizeBudgetName(item.name),
      allocated: Number(item.allocated) || 0,
    }));

    const names = normalizedItems.map((item) => item.name.toLowerCase());
    if (new Set(names).size !== names.length) {
      return next(new ApiError(400, "Budget names must be unique for a month"));
    }

    let budget = await MonthlyBudget.findOne({ user: req.user._id, monthKey: month });
    if (!budget) {
      budget = new MonthlyBudget({
        user: req.user._id,
        monthKey: month,
        timezone,
        items: [],
      });
    }

    const existingItemById = new Map(
      budget.items.map((item) => [String(item._id), item])
    );
    const incomingIds = new Set(normalizedItems.filter((item) => item.id).map((item) => String(item.id)));

    for (const item of budget.items) {
      const existingId = String(item._id);
      if (!incomingIds.has(existingId) && item.spent > 0) {
        return next(
          new ApiError(
            400,
            `Cannot remove budget '${item.name}' because it has recorded spending this month`
          )
        );
      }
    }

    const nextItems = [];
    for (const incomingItem of normalizedItems) {
      if (incomingItem.id && existingItemById.has(String(incomingItem.id))) {
        const existingItem = existingItemById.get(String(incomingItem.id));
        const spent = Number(existingItem.spent) || 0;
        nextItems.push({
          _id: existingItem._id,
          name: incomingItem.name,
          allocated: incomingItem.allocated,
          spent,
          remaining: incomingItem.allocated - spent,
        });
      } else {
        nextItems.push({
          name: incomingItem.name,
          allocated: incomingItem.allocated,
          spent: 0,
          remaining: incomingItem.allocated,
        });
      }
    }

    // Enforce monthly budget limit
    const user = await User.findById(req.user._id).select("monthlyBudget");
    const monthlyLimit = Number(user?.monthlyBudget || 0);
    if (monthlyLimit > 0) {
      const totalAllocated = nextItems.reduce((sum, item) => sum + Number(item.allocated || 0), 0);
      if (totalAllocated > monthlyLimit) {
        return next(
          new ApiError(
            400,
            `Total allocated (₹${totalAllocated.toFixed(2)}) exceeds your monthly budget limit (₹${monthlyLimit.toFixed(2)})`
          )
        );
      }
    }

    budget.timezone = timezone;
    budget.items = nextItems;
    recalculateBudgetTotals(budget);
    await budget.save();

    return res.status(200).json({
      success: true,
      message: "Monthly budget updated",
      month: budget.monthKey,
      timezone: budget.timezone,
      items: budget.items,
      totals: {
        allocated: budget.totalAllocated,
        spent: budget.totalSpent,
        remaining: budget.totalRemaining,
      },
      updatedAt: budget.updatedAt,
    });
  } catch (error) {
    next(error);
  }
}

async function getBudgetSummary(req, res, next) {
  try {
    const { month, timezone } = deriveRequestMonthAndTimezone(req);
    const budget = await getOrCreateMonthBudget(req.user._id, month, timezone);

    return res.status(200).json({
      success: true,
      month: budget.monthKey,
      timezone: budget.timezone,
      hasBudget: budget.items.length > 0,
      totals: {
        allocated: budget.totalAllocated,
        spent: budget.totalSpent,
        remaining: budget.totalRemaining,
      },
      items: budget.items,
      updatedAt: budget.updatedAt,
    });
  } catch (error) {
    next(error);
  }
}

export { getBudgetSummary, getMonthBudget, upsertMonthBudget };