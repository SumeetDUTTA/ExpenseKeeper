import ApiError from "./ApiError.js";

const NON_SPENDING_CATEGORIES = new Set(["Salary", "Investment"]);

function isValidTimezone(timezone) {
  if (!timezone || typeof timezone !== "string") return false;
  try {
    Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function resolveTimezone(inputTimezone) {
  if (isValidTimezone(inputTimezone)) return inputTimezone;
  return "UTC";
}

function monthKeyFromDate(dateInput, timezone = "UTC") {
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, "Invalid expense date");
  }

  const resolvedTimezone = resolveTimezone(timezone);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: resolvedTimezone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;

  if (!year || !month) {
    throw new ApiError(500, "Unable to derive month key from date");
  }

  return `${year}-${month}`;
}

function isSpendingCategory(category) {
  return !NON_SPENDING_CATEGORIES.has(category);
}

function recalculateBudgetTotals(budgetDoc) {
  let totalAllocated = 0;
  let totalSpent = 0;

  for (const item of budgetDoc.items) {
    const allocated = Number(item.allocated) || 0;
    const spent = Number(item.spent) || 0;

    item.allocated = allocated;
    item.spent = spent;
    item.remaining = allocated - spent;

    totalAllocated += allocated;
    totalSpent += spent;
  }

  budgetDoc.totalAllocated = totalAllocated;
  budgetDoc.totalSpent = totalSpent;
  budgetDoc.totalRemaining = totalAllocated - totalSpent;
}

function normalizeBudgetName(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function findBudgetItemById(budgetDoc, budgetItemId) {
  return budgetDoc.items.find((item) => String(item._id) === String(budgetItemId));
}

export {
  findBudgetItemById,
  isSpendingCategory,
  isValidTimezone,
  monthKeyFromDate,
  normalizeBudgetName,
  recalculateBudgetTotals,
  resolveTimezone,
};