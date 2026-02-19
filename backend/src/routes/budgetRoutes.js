import express from "express";

import auth from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  getBudgetSummary,
  getMonthBudget,
  upsertMonthBudget,
} from "../controllers/budgetControllers.js";
import {
  monthQuerySchema,
  upsertMonthBudgetSchema,
} from "../validators/budgetValidator.js";

const router = express.Router();
router.use(auth);

router.get("/month", validate(monthQuerySchema), getMonthBudget);
router.put("/month", validate(upsertMonthBudgetSchema), upsertMonthBudget);
router.get("/summary", validate(monthQuerySchema), getBudgetSummary);

export default router;