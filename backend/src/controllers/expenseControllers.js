import Expense from '../models/expense.js';
import MonthlyBudget from '../models/budget.js';
import ApiError from '../utils/ApiError.js';
import {
  findBudgetItemById,
  isSpendingCategory,
  monthKeyFromDate,
  recalculateBudgetTotals,
  resolveTimezone,
} from '../utils/budgetHelpers.js';

async function applyBudgetDelta({ userId, monthKey, budgetItemId, delta }) {
  if (!budgetItemId) {
    throw new ApiError(400, 'Budget item is required for this operation');
  }

  const budget = await MonthlyBudget.findOne({ user: userId, monthKey });
  if (!budget) {
    throw new ApiError(400, `No monthly budget found for ${monthKey}`);
  }

  const item = findBudgetItemById(budget, budgetItemId);
  if (!item) {
    throw new ApiError(400, 'Selected budget item does not exist for this month');
  }

  const nextSpent = (Number(item.spent) || 0) + delta;
  const nextRemaining = (Number(item.remaining) || 0) - delta;

  if (delta > 0 && nextRemaining < 0) {
    throw new ApiError(400, `Insufficient balance in budget '${item.name}'`);
  }

  if (nextSpent < 0) {
    throw new ApiError(500, `Budget state is inconsistent for '${item.name}'`);
  }

  item.spent = nextSpent;
  item.remaining = nextRemaining;
  recalculateBudgetTotals(budget);
  await budget.save();

  return { budget, item };
}

async function getExpenses(req, res, next) {
  try {
    const { from, to, category, budgetItemId } = req.query;
    const filter = { user: req.user._id };
    if (from || to) filter.date = {};
    if (from) filter.date.$gte = new Date(from);
    if (to) filter.date.$lte = new Date(to);
    if (category) filter.category = category;
    if (budgetItemId) filter.budgetItemId = budgetItemId;
    const expenses = await Expense.find(filter).sort({ date: -1 });
    res.status(200).json(expenses);
  } catch (error) {
    next(new ApiError(500, "Error fetching expenses"));
  }
}

async function createExpense(req, res, next) {
  try {
    const { amount, category, date, note, budgetItemId, timezone: timezoneInput } = req.body;
    if (!amount || !category || !date) {
      return next(new ApiError(400, "Amount, category, and date are required"));
    }

    const timezone = resolveTimezone(timezoneInput || req.headers['x-timezone']);
    const monthKey = monthKeyFromDate(date, timezone);
    const shouldTrackBudget = Boolean(isSpendingCategory(category) && budgetItemId);

    let budgetItemName = null;
    if (shouldTrackBudget) {
      const { item } = await applyBudgetDelta({
        userId: req.user._id,
        monthKey,
        budgetItemId,
        delta: Number(amount),
      });
      budgetItemName = item.name;
    }

    const newExpense = new Expense({
      user: req.user._id,
      amount,
      category,
      date,
      note,
      budgetItemId: shouldTrackBudget ? budgetItemId : undefined,
      budgetMonth: shouldTrackBudget ? monthKey : undefined,
      budgetTimezone: shouldTrackBudget ? timezone : undefined,
      catBudget: shouldTrackBudget ? budgetItemName : (req.body.catBudget || 'Other'),
    });

    try {
      await newExpense.save();
    } catch (error) {
      if (shouldTrackBudget) {
        await applyBudgetDelta({
          userId: req.user._id,
          monthKey,
          budgetItemId,
          delta: -Number(amount),
        });
      }
      throw error;
    }

    res.status(201).json(newExpense);
  } catch (error) {
    next(error instanceof ApiError ? error : new ApiError(500, "Error creating expense"));
  }
}


async function deleteExpense(req, res, next) {
  try {
    const { id } = req.params;

    const existingExpense = await Expense.findOne({ _id: id, user: req.user._id });
    if (!existingExpense) {
      return next(new ApiError(404, "Expense not found"));
    }

    const wasBudgetTracked = Boolean(
      isSpendingCategory(existingExpense.category) &&
      existingExpense.budgetItemId &&
      existingExpense.budgetMonth
    );

    if (wasBudgetTracked) {
      await applyBudgetDelta({
        userId: req.user._id,
        monthKey: existingExpense.budgetMonth,
        budgetItemId: existingExpense.budgetItemId,
        delta: -Number(existingExpense.amount),
      });
    }

    try {
      await Expense.deleteOne({ _id: id, user: req.user._id });
    } catch (error) {
      if (wasBudgetTracked) {
        await applyBudgetDelta({
          userId: req.user._id,
          monthKey: existingExpense.budgetMonth,
          budgetItemId: existingExpense.budgetItemId,
          delta: Number(existingExpense.amount),
        });
      }
      throw error;
    }

    res.status(200).json({ message: "Expense deleted successfully!" });
  } catch (error) {
    next(error instanceof ApiError ? error : new ApiError(500, "Error deleting expense"));
  }
}

async function updateExpense(req, res, next) {
  try {
    const { id } = req.params;

    const existingExpense = await Expense.findOne({ _id: id, user: req.user._id });
    if (!existingExpense) {
      return next(new ApiError(404, "Expense not found"));
    }

    const mergedAmount = req.body.amount ?? existingExpense.amount;
    const mergedCategory = req.body.category ?? existingExpense.category;
    const mergedDate = req.body.date ?? existingExpense.date;
    const mergedNote = req.body.note ?? existingExpense.note;

    const budgetItemInput = req.body.budgetItemId;
    const nextBudgetItemId = budgetItemInput === undefined
      ? existingExpense.budgetItemId
      : (budgetItemInput || null);
    const nextTimezone = resolveTimezone(req.body.timezone || req.headers['x-timezone'] || existingExpense.budgetTimezone);
    const nextMonthKey = monthKeyFromDate(mergedDate, nextTimezone);
    const nextShouldTrack = Boolean(isSpendingCategory(mergedCategory) && nextBudgetItemId);

    const previousShouldTrack = Boolean(
      isSpendingCategory(existingExpense.category) &&
      existingExpense.budgetItemId &&
      existingExpense.budgetMonth
    );
    const previousBudgetMonth = existingExpense.budgetMonth;
    const previousBudgetItemId = existingExpense.budgetItemId;
    const previousAmount = Number(existingExpense.amount);

    if (previousShouldTrack) {
      await applyBudgetDelta({
        userId: req.user._id,
        monthKey: previousBudgetMonth,
        budgetItemId: previousBudgetItemId,
        delta: -previousAmount,
      });
    }

    let nextBudgetItemName = existingExpense.catBudget;
    try {
      if (nextShouldTrack) {
        const { item } = await applyBudgetDelta({
          userId: req.user._id,
          monthKey: nextMonthKey,
          budgetItemId: nextBudgetItemId,
          delta: Number(mergedAmount),
        });
        nextBudgetItemName = item.name;
      } else {
        nextBudgetItemName = req.body.catBudget || 'Other';
      }
    } catch (error) {
      if (previousShouldTrack) {
        await applyBudgetDelta({
          userId: req.user._id,
          monthKey: previousBudgetMonth,
          budgetItemId: previousBudgetItemId,
          delta: previousAmount,
        });
      }
      throw error;
    }

    existingExpense.amount = mergedAmount;
    existingExpense.category = mergedCategory;
    existingExpense.date = mergedDate;
    existingExpense.note = mergedNote;
    existingExpense.catBudget = nextBudgetItemName;
    existingExpense.budgetItemId = nextShouldTrack ? nextBudgetItemId : undefined;
    existingExpense.budgetMonth = nextShouldTrack ? nextMonthKey : undefined;
    existingExpense.budgetTimezone = nextShouldTrack ? nextTimezone : undefined;

    let updatedExpense;
    try {
      updatedExpense = await existingExpense.save();
    } catch (error) {
      if (nextShouldTrack) {
        await applyBudgetDelta({
          userId: req.user._id,
          monthKey: nextMonthKey,
          budgetItemId: nextBudgetItemId,
          delta: -Number(mergedAmount),
        });
      }
      if (previousShouldTrack) {
        await applyBudgetDelta({
          userId: req.user._id,
          monthKey: previousBudgetMonth,
          budgetItemId: previousBudgetItemId,
          delta: previousAmount,
        });
      }
      throw error;
    }

    if (!updatedExpense) {
      return next(new ApiError(404, "Expense not found"));
    }
    res.status(200).json(updatedExpense);
  } catch (error) {
    next(error instanceof ApiError ? error : new ApiError(500, "Error updating expense"));
  }
}

export { getExpenses, createExpense, deleteExpense, updateExpense };