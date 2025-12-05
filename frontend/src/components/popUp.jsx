import React from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import "../styles/popUp.css";

/**
 * Popup component
 *
 * Props:
 * - visible (bool) : show/hide
 * - budget (string) : controlled budget string
 * - userType (string)
 * - saving (bool)
 * - onBudgetChange(fn)
 * - onUserTypeChange(fn)
 * - onSave(fn)
 * - onClose(fn)
 * - onSnooze(fn)
 * - allowedUserTypes (array)
 */
export default function Popup({
  visible,
  budget,
  userType,
  saving,
  onBudgetChange,
  onUserTypeChange,
  onSave,
  onClose,
  onSnooze,
  allowedUserTypes = []
}) {
  const nav = useNavigate();
  if (!visible) return null;

  return (
    <div className="ek-modal-overlay" role="dialog" aria-modal="true" aria-label="Welcome to Expense Keeper">
      <div className="ek-modal-card">
        <div className="ek-modal-header">
          <h3>Welcome! Set your monthly budget & account type</h3>
          <p className="ek-muted">Setting these helps personalize suggestions and track goals.</p>
        </div>

        <form
          className="ek-modal-form"
          onSubmit={(e) => {
            e.preventDefault();
            onSave && onSave();
          }}
        >
          <label className="ek-modal-field">
            <span className="ek-modal-label">Monthly budget (₹)</span>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="e.g. 20000"
              value={budget}
              onChange={(e) => onBudgetChange && onBudgetChange(e.target.value)}
            />
          </label>

          <label className="ek-modal-field">
            <span className="ek-modal-label">Account type</span>
            <select value={userType} onChange={(e) => onUserTypeChange && onUserTypeChange(e.target.value)}>
              <option value="">Select account type</option>
              {allowedUserTypes.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
          </label>

          <div className="ek-modal-actions">
            <button type="submit" className="ek-btn ek-btn-primary" disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </button>

            <button type="button" className="ek-btn ek-btn-ghost" onClick={onClose}>
              Close
            </button>

            <button type="button" className="ek-btn ek-btn-snooze" onClick={onSnooze}>
              Remind me later
            </button>

            <button
              type="button"
              className="ek-btn ek-btn-link"
              onClick={() => {
                onClose && onClose();
                // navigation handled by parent if desired
              }}
            >
              <span onClick={() => nav("/profile")}>Go to Profile</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

Popup.propTypes = {
  visible: PropTypes.bool,
  budget: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  userType: PropTypes.string,
  saving: PropTypes.bool,
  onBudgetChange: PropTypes.func,
  onUserTypeChange: PropTypes.func,
  onSave: PropTypes.func,
  onClose: PropTypes.func,
  onSnooze: PropTypes.func,
  allowedUserTypes: PropTypes.array
};
