import Expense from '../models/expense.js';
import ApiError from '../utils/ApiError.js';

async function getExpenses(req, res, next) {
  try {
    const { from, to, category } = req.query;
    const filter = { user: req.user._id };
    if (from || to) filter.date = {};
    if (from) filter.date.$gte = new Date(from);
    if (to) filter.date.$lte = new Date(to);
    if (category) filter.category = category;
    const expenses = await Expense.find(filter).sort({ date: -1 });
    res.status(200).json(expenses);
  } catch (error) {
    next(new ApiError(500, "Error fetching expenses"));
  }
}

async function createExpense(req, res, next) {
  try {
    const { amount, category, date, note } = req.body;
    if (!amount || !category || !date) {
      return next(new ApiError(400, "Amount, category, and date are required"));
    }
    const newExpense = new Expense({
      user: req.user._id,
      amount, category, date, note 
    });
    await newExpense.save();
    res.status(201).json(newExpense);
  } catch (error) {
    next(new ApiError(500, "Error creating expense"));
  }
}


async function deleteExpense(req, res, next) {
  try {
    const { id } = req.params;
    const result = await Expense.findOneAndDelete({ _id: id, user: req.user._id });
    if (!result) {
      return next(new ApiError(404, "Expense not found"));
    }
    res.status(200).json({ message: "Expense deleted successfully!" });
  } catch (error) {
    next(new ApiError(500, "Error deleting expense"));
  }
}

async function updateExpense(req, res, next) {
  try {
    const { id } = req.params;
    const update = req.body;
    const updatedExpense = await Expense.findByIdAndUpdate(
      {_id: id, user: req.user._id},
      update,
      { new: true }
    );
    if (!updatedExpense) {
      return next(new ApiError(404, "Expense not found"));
    }
    res.status(200).json(updatedExpense);
  } catch (error) {
    next(new ApiError(500, "Error updating expense"));
  }
}

export { getExpenses, createExpense, deleteExpense, updateExpense };