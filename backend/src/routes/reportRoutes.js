import express from "express";

import auth from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  clearChatHistory,
  getChatHistory,
  sendChatMessage,
} from "../controllers/chatControllers.js";
import { generateReportSchema, monthKeyParamSchema } from "../validators/reportValidator.js";
import { chatMessageSchema } from "../validators/chatValidator.js";
import {
  generateReport,
  listReports,
  getReport,
  downloadReport,
} from "../controllers/reportControllers.js";

const router = express.Router();
router.use(auth);

// Generate / regenerate a monthly report on demand
router.post("/generate", validate(generateReportSchema), generateReport);

// List all reports for the authenticated user
router.get("/", listReports);

// Get full report JSON for a specific month
router.get("/:monthKey", validate(monthKeyParamSchema), getReport);

// Conversational chat against a ready report
router.get("/:monthKey/chat", validate(monthKeyParamSchema), getChatHistory);
router.post("/:monthKey/chat", validate(chatMessageSchema), sendChatMessage);
router.delete("/:monthKey/chat", validate(monthKeyParamSchema), clearChatHistory);

// Download PDF for a specific month
router.get("/:monthKey/download", validate(monthKeyParamSchema), downloadReport);

export default router;
