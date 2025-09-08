import express from 'express';

import auth from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createExpenseSchema, updateExpenseSchema, idParamSchema } from '../validators/expensesValidator.js';
import { getExpenses, deleteExpense, updateExpense, createExpense } from '../controllers/expenseControllers.js';

const router = express.Router();
router.use(auth);

router.get("/", getExpenses);
router.post("/", validate(createExpenseSchema), createExpense);
router.put("/:id", validate(updateExpenseSchema), updateExpense);
router.delete("/:id", validate(idParamSchema), deleteExpense);

export default router;