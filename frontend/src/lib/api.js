import axios from "axios";

const BASE = import.meta.env.VITE_API_TARGET || "http://localhost:5000"

const api = axios.create({
    baseURL: BASE,
    withCredentials: false,
    headers: {
    "Content-Type": "application/json",
  },
    timeout: 30000,
});

api.interceptors.request.use((config) => {
    try {
        const token = localStorage.getItem("token");
        if (token) {
            config.headers = config.headers || {};
            config.headers.Authorization = `Bearer ${token}`;
        }
    } catch (error) {
        console.error("Error attaching token to request:", error);
    }
    return config;
})

export default api;

// ── Report API helpers ────────────────────────────────────────────────────────

/** Generate (or regenerate) a monthly report on demand. */
export const generateReport = (monthKey, timezone) =>
    api.post("/api/reports/generate", { monthKey, timezone }, {
        timeout: 120_000,
    });

/** Fetch the full JSON report for a specific YYYY-MM month. */
export const getReport = (monthKey) =>
    api.get(`/api/reports/${monthKey}`);

/** List all report stubs for the authenticated user. */
export const listReports = () =>
    api.get("/api/reports");

/**
 * Trigger PDF generation and save the file to disk via browser download,
 * without storing a blob URL longer than necessary.
 */
export const downloadReportPDF = async (monthKey) => {
    const response = await api.get(`/api/reports/${monthKey}/download`, {
        responseType: "blob",
        timeout: 200_000,   // PDF gen can be slow on first LLM call
    });
    const url = window.URL.createObjectURL(
        new Blob([response.data], { type: "application/pdf" })
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `ExpenseReport_${monthKey}.pdf`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
};

export const getChatHistory = (monthKey) =>
    api.get(`/api/reports/${monthKey}/chat`);

export const sendChatMessage = (monthKey, message) =>
    api.post(`/api/reports/${monthKey}/chat`, { message }, {
        timeout: 60000,
    });

export const clearChatHistory = (monthKey) =>
    api.delete(`/api/reports/${monthKey}/chat`);
