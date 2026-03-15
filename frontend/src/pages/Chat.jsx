import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MessageSquare } from "lucide-react";

import ChatPanel from "../components/ChatPanel";
import { listReports } from "../lib/api";
import "../styles/Chat.css";

function buildMonthOptions() {
  const options = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i - 1, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const label = date.toLocaleString("en-US", { month: "long", year: "numeric" });
    options.push({ key, label });
  }
  return options;
}

const MONTH_OPTIONS = buildMonthOptions();

export default function Chat() {
  const [selectedMonth, setSelectedMonth] = useState(MONTH_OPTIONS[1]?.key || MONTH_OPTIONS[0]?.key);
  const [reports, setReports] = useState([]);
  const monthOptions = useMemo(() => MONTH_OPTIONS, []);

  useEffect(() => {
    let cancelled = false;
    async function loadReports() {
      try {
        const { data } = await listReports();
        if (!cancelled) setReports(data.reports || []);
      } catch {
        if (!cancelled) setReports([]);
      }
    }
    loadReports();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedReport = reports.find((report) => report.monthKey === selectedMonth);
  const isReady = selectedReport?.status === "ready";

  return (
    <div className="chat-page">
      <div className="chat-page-shell">
        <div className="chat-page-header">
          <div>
            <h1>
              <MessageSquare size={22} style={{ display: "inline", marginRight: 8, verticalAlign: "middle" }} />
              Expense Chat
            </h1>
            <p>Ask follow-up questions about any generated monthly report.</p>
          </div>

          <div className="chat-page-controls">
            <label htmlFor="chat-month-select">Chatting about</label>
            <select
              id="chat-month-select"
              className="chat-month-select"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              {monthOptions.map((option) => (
                <option key={option.key} value={option.key}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>

        {!isReady && (
          <div className="chat-page-banner">
            <p>No ready report exists for {selectedMonth}. Generate that month first so the chatbot has context.</p>
            <Link to="/reports" className="chat-link-btn">Open Reports</Link>
          </div>
        )}

        <ChatPanel monthKey={selectedMonth} isReady={isReady} defaultOpen />
      </div>
    </div>
  );
}