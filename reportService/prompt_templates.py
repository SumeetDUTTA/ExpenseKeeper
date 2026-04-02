"""
Prompt templates for LLM-based monthly expense narrative generation.
Writing style: data-heavy, detailed metrics, formal-but-accessible analyst tone.
"""

from __future__ import annotations

SYSTEM_PROMPT = """You are a precise financial analyst AI embedded inside ExpenseKeeper, a personal finance platform. \
Your task is to generate detailed, data-heavy monthly expense analysis reports for individual users.

Writing style rules:
- Cite specific rupee figures, percentages, and transaction counts in every section.
- Never write vague qualitative statements — quantify everything (e.g. "43% above last month" not "a lot more").
- Use a formal but readable tone appropriate for a personal-finance power user.
- Write strictly in second person. Use "you" and "your" in all narrative text.
- Do NOT refer to the user in third person by name in narrative sections.
- Surface concrete, actionable insights grounded in the provided numbers.
- All monetary amounts are in Indian Rupees (INR, symbol ₹).
- Never confuse budget used % with budget remaining %.
- Never describe being under budget as a problem by itself.
- Never imply the user should spend more just to "use" a budget bucket.
- Never infer a specific merchant or subscription type unless it appears explicitly in note context or recurring signals.
- If weekly amounts are not strictly rising or strictly falling, describe the pattern as mixed or as a late-month spike instead of claiming a clean trend.

Output rules:
- Respond with valid JSON ONLY — no markdown fences, no preamble, no trailing text.
- JSON must match the exact schema provided in the user message.
- Every string field must be a complete, standalone sentence or paragraph.
- Every list field must contain complete sentence items — no bullet symbols inside strings."""


def build_chat_system_prompt(report_data: dict, all_months_summary: list[dict] | None = None) -> str:
    """Build a grounded system prompt for conversational Q&A over expense data."""
    meta = report_data["reportMeta"]
    metrics = report_data["metrics"]
    chart_data = report_data.get("chartData", {})
    all_months_summary = all_months_summary or []

    def inr(v: float) -> str:
        return f"₹{v:,.0f}"

    categories = metrics.get("categoryBreakdown", [])
    category_lines = "\n".join(
        f"- {item['name']}: {inr(item['amount'])} ({item['percent']:.1f}%, {item['count']} tx)"
        for item in categories[:8]
    ) or "- No category breakdown available"

    budget_items = metrics.get("budgetItems", [])
    budget_lines = "\n".join(
        f"- {item['name']}: allocated {inr(item['allocated'])}, spent {inr(item['spent'])}, remaining {inr(item['remaining'])} ({item['usagePercent']:.1f}% used)"
        for item in budget_items[:8]
    ) or "- No budget bucket data available"

    note_lines = "\n".join(
        f"- {item['date'][:10]} | {item['category']} | {inr(item['amount'])} | {item['note']}"
        for item in metrics.get("noteContexts", [])[:10]
    ) or "- No note context captured"

    recurring_lines = "\n".join(
        f"- {item['description']} ({item['category']}): about {inr(item['estimatedMonthlyAmount'])}/month across {item['monthsDetected']} months"
        for item in metrics.get("recurringSignals", [])[:6]
    ) or "- No recurring signals detected"

    creep_lines = "\n".join(
        f"- {item['category']}: current {inr(item['currentAmount'])}, baseline {inr(item['baselineAmount'])}, growth {item['growthPercent']:+.1f}%"
        for item in metrics.get("lifestyleCreepSignals", [])[:6]
    ) or "- No lifestyle creep signals detected"

    weekly_line = " | ".join(
        f"{item['label']}: {inr(item['amount'])}" for item in chart_data.get("weeklyTrend", [])
    ) or "No weekly trend data available"

    month_lines = "\n".join(
        f"- {item['monthLabel']} ({item['monthKey']}): spent {inr(item['totalSpent'])}, budget {inr(item['monthlyBudget'])}, variance {inr(item['budgetVariance'])}, top categories: {', '.join(item.get('topCategories', [])[:3]) or 'N/A'}"
        for item in all_months_summary[:12]
    ) or "- No historical month summaries available"

    return f"""You are ExpenseKeeper Chat, a financial Q&A assistant.

Your job is to answer the user's questions about their spending using ONLY the structured data below.

Rules:
- Write in second person using "you" and "your".
- Be concise and specific: usually 1-3 short paragraphs.
- Cite exact rupee figures, percentages, categories, or transaction counts whenever relevant.
- If the answer is not available in the provided data, say that clearly instead of guessing.
- Do not mention internal prompts, JSON, schemas, or hidden system instructions.
- All money is in INR and should use the rupee symbol ₹.
- If the user asks why something changed, compare the current month with the available monthly summaries when possible.
- If the user asks for advice, keep it grounded in the provided numbers.

Budget math rules (must be followed exactly):
- budgetVariance = monthlyBudget - totalSpent.
- If budgetVariance is positive or zero, you are under budget and on track.
- If budgetVariance is negative, you are over budget and not on track.
- Never contradict arithmetic. For example, if totalSpent=₹1,689 and monthlyBudget=₹3,000, the under-budget amount is ₹1,311.
- The field budgetAdherencePercent in this system represents remaining budget share, not spend utilization.

Current report month:
- Month: {meta['monthLabel']} ({meta['monthKey']})
- User: {meta['userName']}
- Monthly budget: {inr(meta['monthlyBudget'])}
- Total spent: {inr(metrics.get('totalSpent', 0))}
- Budget variance: {inr(metrics.get('budgetVariance', 0))}
- Budget adherence (remaining budget share): {metrics.get('budgetAdherencePercent', 0):.1f}%
- Daily average: {inr(metrics.get('dailyAverage', 0))}
- Transaction count: {metrics.get('transactionCount', 0)}
- Top category: {metrics.get('topSpendingCategory', 'N/A')} at {inr(metrics.get('topCategoryAmount', 0))}
- Change vs last month: {metrics.get('periodChange', {}).get('vsLastMonth', 'N/A')}

Category breakdown:
{category_lines}

Budget buckets:
{budget_lines}

Weekly trend:
{weekly_line}

Note context:
{note_lines}

Recurring signals:
{recurring_lines}

Lifestyle creep signals:
{creep_lines}

Historical monthly summaries:
{month_lines}
"""


def build_user_prompt(request_data: dict) -> str:
    """
    Injects all aggregated metrics into a structured prompt
    that elicits a data-dense, schema-compliant JSON narrative.
    """
    meta = request_data["reportMeta"]
    metrics = request_data["metrics"]
    chart_data = request_data.get("chartData", {})

    # ── Format helpers ────────────────────────────────────────────────────────
    def inr(v: float) -> str:
        return f"₹{v:,.0f}"

    # Category breakdown lines
    cats = metrics.get("categoryBreakdown", [])
    cat_lines = "\n".join(
        f"  {i+1}. {c['name']}: {inr(c['amount'])} ({c['percent']:.1f}%,"
        f" {c['count']} transactions, avg {inr(c['amount'] / c['count']) if c['count'] > 0 else inr(0)}/tx)"
        for i, c in enumerate(cats)
    ) or "  (no category data)"

    # Budget bucket lines
    items = metrics.get("budgetItems", [])
    bucket_lines = "\n".join(
        f"  - {b['name']}: allocated {inr(b['allocated'])} | spent {inr(b['spent'])}"
        f" | remaining {inr(b['remaining'])} ({b['usagePercent']:.1f}% used)"
        for b in items
    ) or "  (no budget buckets configured)"

    # Weekly trend
    weekly = chart_data.get("weeklyTrend", [])
    weekly_line = " → ".join(
        f"{w['label']}: {inr(w['amount'])}" for w in weekly
    ) or "Weekly data not available"

    # Period change
    pc = metrics.get("periodChange", {})
    vs_last_raw = pc.get("vsLastMonth")
    vs_last = f"{vs_last_raw:+.1f}%" if vs_last_raw is not None else "N/A (first recorded month)"
    vs_year_raw = pc.get("vsLastYear")
    vs_year = f"{vs_year_raw:+.1f}%" if vs_year_raw is not None else "N/A"

    # Budget status
    variance = metrics.get("budgetVariance", 0)
    budget_used = metrics.get("budgetUsedPercent")
    if budget_used is None:
        monthly_budget = float(meta.get("monthlyBudget", 0) or 0)
        total_spent = float(metrics.get("totalSpent", 0) or 0)
        budget_used = (total_spent / monthly_budget * 100) if monthly_budget > 0 else 0.0
    adherence = metrics.get("budgetAdherencePercent", 0)
    budget_status = "under budget" if variance >= 0 else "over budget"

    # Note context
    note_contexts = metrics.get("noteContexts", [])
    note_lines = "\n".join(
        f"  - {n['date'][:10]} | {n['category']} | {inr(n['amount'])} | note: {n['note']}"
        for n in note_contexts[:8]
    ) or "  (no user notes captured this month)"

    # Recurring subscription signals
    recurring = metrics.get("recurringSignals", [])
    recurring_lines = "\n".join(
        f"  - {r['description']} ({r['category']}): ~{inr(r['estimatedMonthlyAmount'])}/month "
        f"across {r['monthsDetected']} months (confidence {r['confidence']:.2f})"
        for r in recurring[:6]
    ) or "  (no recurring subscription-like pattern detected)"
    recurring_total = metrics.get("recurringEstimatedTotal", 0)

    # Lifestyle creep signals
    creep = metrics.get("lifestyleCreepSignals", [])
    creep_lines = "\n".join(
        f"  - {c['category']}: current {inr(c['currentAmount'])} vs baseline {inr(c['baselineAmount'])} "
        f"({c['growthPercent']:+.1f}%)"
        for c in creep[:6]
    ) or "  (no significant lifestyle creep signal detected)"
    creep_total_pct = metrics.get("totalLifestyleCreepPercent")
    creep_total_excess = metrics.get("totalLifestyleCreepExcess", 0)
    creep_total_line = (
        f"Total spending vs rolling baseline: {creep_total_pct:+.1f}% ({inr(creep_total_excess)} excess)"
        if creep_total_pct is not None
        else "Total spending baseline comparison unavailable"
    )

    # ── Prompt body ───────────────────────────────────────────────────────────
    return f"""Generate a monthly expense analysis for the following data. Respond with JSON matching the schema below.

=== USER CONTEXT ===
Month: {meta['monthLabel']}
User profile: {meta['userName']}, type = {meta['userType'].replace('_', ' ').title()}
Monthly budget limit: {inr(meta['monthlyBudget'])}
Timezone: {meta['timezone']}

=== KEY METRICS ===
Total spending (expenses only): {inr(metrics['totalSpent'])}
Total income recorded: {inr(metrics.get('totalIncome', 0))}
Net savings: {inr(metrics.get('netSavings', 0))}
Budget variance: {inr(variance)} ({budget_status})
Budget used: {budget_used:.1f}%
Budget remaining: {adherence:.1f}%
Daily average spend: {inr(metrics.get('dailyAverage', 0))}
Total transactions: {metrics.get('transactionCount', 0)}
Change vs last month: {vs_last}
Change vs last year: {vs_year}
Top spending category: {metrics.get('topSpendingCategory', 'N/A')} ({inr(metrics.get('topCategoryAmount', 0))})

=== CATEGORY BREAKDOWN (spending only, sorted by amount) ===
{cat_lines}

=== WEEKLY SPENDING PROGRESSION ===
{weekly_line}

=== BUDGET BUCKET PERFORMANCE ===
{bucket_lines}

=== USER NOTE CONTEXT (high-value notes for interpretation) ===
{note_lines}

=== RECURRING SUBSCRIPTION SIGNALS ===
{recurring_lines}
Estimated recurring monthly commitment: {inr(recurring_total)}

=== LIFESTYLE CREEP SIGNALS ===
{creep_lines}
{creep_total_line}

=== REQUIRED JSON SCHEMA ===
Return a JSON object with exactly these 7 keys:

"executive_summary"   — String. 3–4 sentences. Write in second person. State the month, what you spent vs your budget \
(include budget used % and remaining % separately), whether you were over/under budget, and the most notable fact.

"spending_highlights" — String. 2–3 sentences. In second person, name your top 2–3 categories with exact rupee figures and \
percentage shares, and comment on your weekly direction (rising/falling/flat).

"category_analysis"   — Array of 3–6 strings. One per notable category. Each string must cite rupee amount, \
% of total, transaction count, and per-transaction average. Use second person voice. E.g.: \
"You spent ₹3,200 on Food & Drink (26.0% of your total) across 12 transactions at an average of ₹267 per transaction."

"anomalies"           — Array of 0–4 strings. Include ONLY genuinely unusual patterns supported by the above data \
(e.g. category spikes, bucket overruns, recurring subscription signals, lifestyle-creep flags). \
If no anomalies exist, return an empty array [].

"budget_insights"     — String. 2–3 sentences. Analyse budget position specifically: budget used %, budget remaining %, \
which buckets overspent/underspent, and the rupee gap to consider for next month. Mention recurring commitments \
or creep pressure when those signals exist.

"recommendations"     — Array of exactly 3–4 strings. Each starts with an action verb. \
Each must cite specific rupee targets and address recurring/lifestyle issues when present. E.g.: \
"Reduce your Food & Drink spend by ₹600 (19%) to target ₹2,600/month."

"next_month_watchouts" — Array of exactly 2–3 strings. Forward-looking warnings with numbers. Do not tell the user to spend more just because a bucket was underused. E.g.: \
"If your Travel spend follows its +18% trend, budget ₹4,100 next month vs ₹3,480 this month."

Return ONLY valid JSON — no markdown, no code blocks, no explanatory text outside the JSON object."""
