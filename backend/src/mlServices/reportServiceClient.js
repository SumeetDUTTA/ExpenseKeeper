/**
 * HTTP client for the Python Report Service (port 8001).
 * Mirrors the pattern used in mlService.js for the ML prediction service.
 */

import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const base = process.env.REPORT_API_URL || "http://localhost:8001";

const reportClient = axios.create({
  baseURL: base.replace(/\/$/, ""),
  headers: { "Content-Type": "application/json" },
});

/**
 * Call the Python service to generate a JSON narrative.
 * @param {object} payload  Full GenerateReportRequest payload
 * @returns {Promise<{ narrative, modelInfo, generatedAt }>}
 */
export async function generateNarrative(payload) {
  try {
    const { data } = await reportClient.post("/generate-narrative", payload, {
      timeout: 90_000,   // Hosted provider path should return faster than local CPU inference
    });
    return { success: true, data };
  } catch (err) {
    console.error("❌ Report narrative service error:", err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Call the Python service to generate a PDF and return the raw binary.
 * @param {object} payload  Full GenerateReportRequest payload
 * @returns {Promise<{ success, pdfBuffer, error }>}
 */
export async function generatePDF(payload) {
  try {
    const { data } = await reportClient.post("/generate-pdf", payload, {
      timeout: 180_000,   // 3 min — PDF rendering + LLM
      responseType: "arraybuffer",
    });
    return { success: true, pdfBuffer: Buffer.from(data) };
  } catch (err) {
    console.error("❌ Report PDF service error:", err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Call the Python service to answer a chat question using report context.
 * @param {object} payload
 * @returns {Promise<{ success, data, error }>}
 */
export async function callChatService(payload) {
  try {
    const { data } = await reportClient.post("/chat", payload, {
      timeout: 45_000,
    });
    return { success: true, data };
  } catch (err) {
    console.error("❌ Report chat service error:", err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Health-check against the Python report service.
 * @returns {Promise<boolean>}
 */
export async function pingReportService() {
  try {
    const { data } = await reportClient.get("/health", { timeout: 5000 });
    return data?.status === "ok";
  } catch {
    return false;
  }
}
