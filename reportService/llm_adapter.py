"""
LLM adapter for narrative generation.
Uses Groq (OpenAI-compatible API) first; falls back to a deterministic
template narrative built purely from the metrics payload.
"""

from __future__ import annotations

import json
import logging
import re
import importlib

from config import settings

from schemas import NarrativeOutput
from prompt_templates import SYSTEM_PROMPT, build_chat_system_prompt, build_user_prompt

logger = logging.getLogger(__name__)


def normalize_model_name(model_name: str) -> str:
    """Map common aliases to provider model IDs."""
    raw = (model_name or "").strip()
    key = raw.lower().replace(" ", "")

    alias_map = {
        "llama-3.3-70b": "llama-3.3-70b-versatile",
        "llama-3.3-70b-versatile": "llama-3.3-70b-versatile",
        "llama3.3-70b-versatile": "llama-3.3-70b-versatile",
        "llama-3.1-8b": "llama-3.1-8b-instant",
        "llama-3.1-8b-instant": "llama-3.1-8b-instant",
    }
    return alias_map.get(key, raw)

# ── Optional OpenAI-compatible client import (used for Groq) ────────────────
try:
    OpenAI = importlib.import_module("openai").OpenAI
    OPENAI_CLIENT_AVAILABLE = True
except Exception:
    OpenAI = None
    OPENAI_CLIENT_AVAILABLE = False
    logger.warning("openai client not installed — only template fallback available.")


class LLMAdapter:
    """
    Pluggable LLM adapter using Groq as the primary provider.
    Falls back to a deterministic template narrative on any provider failure,
    so report generation always returns a valid schema-compliant response.
    """

    def __init__(self, model_name: str = "llama-3.3-70b-versatile"):
        self.provider = (settings.LLM_PROVIDER or "groq").strip().lower()
        self.model_name = normalize_model_name(model_name)
        self.fallback_models = [
            normalize_model_name(m)
            for m in settings.GROQ_FALLBACK_MODELS
            if normalize_model_name(m) != self.model_name
        ]
        self._blocked_models: set[str] = set()
        self._client = None

        if self.provider == "groq":
            if not OPENAI_CLIENT_AVAILABLE:
                logger.warning("Groq provider selected but openai client is unavailable.")
                return

            if not settings.GROQ_API_KEY:
                logger.warning("Groq provider selected but GROQ_API_KEY is missing.")
                return

            try:
                self._client = OpenAI(
                    api_key=settings.GROQ_API_KEY,
                    base_url=settings.GROQ_BASE_URL,
                    timeout=settings.GROQ_TIMEOUT_SECONDS,
                )
                logger.info(
                    "Groq client initialized — model=%s fallback_models=%s base_url=%s timeout=%ss",
                    self.model_name,
                    self.fallback_models,
                    settings.GROQ_BASE_URL,
                    settings.GROQ_TIMEOUT_SECONDS,
                )
            except Exception as exc:
                logger.warning("Could not initialize Groq client: %s", exc)
        else:
            logger.warning(
                "Unsupported LLM_PROVIDER='%s'. Service will use template fallback.",
                self.provider,
            )

    # ── Public API ────────────────────────────────────────────────────────────

    def generate_narrative(self, request_data: dict) -> tuple[NarrativeOutput, dict]:
        """
        Returns (NarrativeOutput, model_info dict).
        Tries provider path first; falls back to deterministic template on any failure.
        """
        if self.provider == "groq" and self._client is not None:
            try:
                return self._generate_with_groq(request_data)
            except Exception as exc:
                logger.warning("Groq generation failed (%s) — using template fallback.", exc)

        return self._template_fallback(request_data)

    def generate_chat_response(self, request_data: dict) -> tuple[str, dict]:
        """Generate a conversational answer for a user's chat question."""
        user_message = (request_data.get("message") or "").strip()
        report_payload = request_data["reportPayload"]

        if self.provider == "groq" and self._client is not None:
            try:
                return self._generate_chat_with_groq(request_data)
            except Exception as exc:
                logger.warning("Groq chat generation failed (%s) — using static fallback.", exc)

        intent = self._detect_chat_intent(user_message)
        handler = self._deterministic_handlers().get(intent)
        if handler is not None:
            logger.info("Using deterministic chat fallback for intent=%s", intent)
            return handler(report_payload, user_message)

        return self._chat_fallback()

    # ── Groq path ─────────────────────────────────────────────────────────────

    def _generate_with_groq(self, request_data: dict) -> tuple[NarrativeOutput, dict]:
        user_prompt = build_user_prompt(request_data)
        candidates = [
            m for m in [self.model_name, *self.fallback_models]
            if m not in self._blocked_models
        ]
        if not candidates:
            raise RuntimeError("All configured Groq models are blocked or unavailable")

        attempts: list[str] = []

        for model_name in candidates:
            try:
                response = self._client.chat.completions.create(
                    model=model_name,
                    messages=[
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": user_prompt},
                    ],
                    temperature=settings.LLM_TEMPERATURE,
                    max_tokens=settings.LLM_MAX_TOKENS,
                    response_format={"type": "json_object"},
                )

                raw_content = (response.choices[0].message.content or "").strip()
                if not raw_content:
                    raise ValueError("Groq response was empty")

                narrative = self._parse_and_validate(raw_content)
                narrative = self._stabilize_narrative(request_data, narrative)

                model_info = {
                    "modelName": model_name,
                    "provider": "groq",
                    "usedFallback": False,
                }
                return narrative, model_info
            except Exception as exc:
                if self._is_model_permission_blocked(exc):
                    self._blocked_models.add(model_name)
                    logger.warning(
                        "Groq model is blocked at project level — model=%s. "
                        "Will skip this model for subsequent requests until restart.",
                        model_name,
                    )
                attempts.append(f"{model_name}: {exc}")
                logger.warning("Groq model attempt failed — model=%s error=%s", model_name, exc)

        raise RuntimeError("All Groq model attempts failed: " + " | ".join(attempts))

    def _generate_chat_with_groq(self, request_data: dict) -> tuple[str, dict]:
        report_payload = request_data["reportPayload"]
        history = request_data.get("history", [])[-30:]
        user_message = (request_data.get("message") or "").strip()
        if not user_message:
            raise ValueError("Chat message is empty")

        chat_model = normalize_model_name(settings.CHAT_MODEL)
        if chat_model != "llama-3.1-8b-instant":
            logger.warning(
                "CHAT_MODEL=%s was requested, but chat is pinned to llama-3.1-8b-instant for cost control.",
                chat_model,
            )
            chat_model = "llama-3.1-8b-instant"

        system_prompt = build_chat_system_prompt(
            report_payload,
            request_data.get("allMonthsSummary", []),
        )
        messages = [{"role": "system", "content": system_prompt}]
        for item in history:
            role = item.get("role")
            content = (item.get("content") or "").strip()
            if role in {"user", "assistant"} and content:
                messages.append({"role": role, "content": content})
        messages.append({"role": "user", "content": user_message})

        response = self._client.chat.completions.create(
            model=chat_model,
            messages=messages,
            temperature=0.7,
            max_tokens=min(settings.LLM_MAX_TOKENS, 800),
        )

        reply = (response.choices[0].message.content or "").strip()
        if not reply:
            raise ValueError("Groq chat response was empty")

        return reply, {
            "modelName": chat_model,
            "provider": "groq",
            "usedFallback": False,
        }

    @staticmethod
    def _is_model_permission_blocked(exc: Exception) -> bool:
        msg = str(exc)
        return "model_permission_blocked_project" in msg

    @staticmethod
    def _chat_fallback() -> tuple[str, dict]:
        return (
            "I'm sorry, I'm having trouble connecting right now. Please try again in a moment.",
            {
                "modelName": "chat_static_fallback",
                "provider": "template_fallback",
                "usedFallback": True,
            },
        )

    @staticmethod
    def _deterministic_handlers():
        return {
            "budget_tracking": LLMAdapter._budget_tracking_answer,
            "top_spending": LLMAdapter._top_spending_answer,
            "cost_cut": LLMAdapter._cost_cut_answer,
        }

    @staticmethod
    def _detect_chat_intent(message: str) -> str:
        text = (message or "").lower().strip()
        if not text:
            return "generic"

        # Priority matters when a question matches multiple domains.
        if LLMAdapter._is_budget_tracking_question(text):
            return "budget_tracking"
        if LLMAdapter._is_top_spending_question(text):
            return "top_spending"
        if LLMAdapter._is_cost_cut_question(text):
            return "cost_cut"
        return "generic"

    @staticmethod
    def _is_budget_tracking_question(message: str) -> bool:
        text = (message or "").lower()
        if not text:
            return False
        keywords = (
            "budget",
            "on track",
            "off track",
            "track",
            "overspend",
            "overspent",
            "under budget",
            "over budget",
            "adherence",
        )
        return any(k in text for k in keywords)

    @staticmethod
    def _budget_tracking_answer(report_payload: dict, _message: str = "") -> tuple[str, dict]:
        meta = report_payload.get("reportMeta", {})
        metrics = report_payload.get("metrics", {})

        spent = float(metrics.get("totalSpent") or 0)
        budget = float(meta.get("monthlyBudget") or 0)
        variance = float(metrics.get("budgetVariance") or (budget - spent))

        if budget <= 0:
            return (
                "I cannot determine whether you are on track because your monthly budget is ₹0. Set a budget first, and I can compare your spend against it accurately.",
                {
                    "modelName": "deterministic_budget_guardrail",
                    "provider": "rule_based",
                    "usedFallback": True,
                },
            )

        spent_utilization = (spent / budget) * 100
        remaining_share = max(0.0, (variance / budget) * 100)

        if variance >= 0:
            reply = (
                f"You are on track with your budget. You have spent ₹{spent:,.0f} out of ₹{budget:,.0f}, "
                f"so you are under budget by ₹{variance:,.0f}. "
                f"That means you have used {spent_utilization:.1f}% of your budget and still have {remaining_share:.1f}% remaining."
            )
        else:
            over_by = abs(variance)
            reply = (
                f"You are not on track with your budget. You have spent ₹{spent:,.0f} against ₹{budget:,.0f}, "
                f"so you are over budget by ₹{over_by:,.0f}. "
                f"That means you have used {spent_utilization:.1f}% of your budget."
            )

        return (
            reply,
            {
                "modelName": "deterministic_budget_guardrail",
                "provider": "rule_based",
                "usedFallback": True,
            },
        )

    @staticmethod
    def _is_top_spending_question(message: str) -> bool:
        text = (message or "").lower().strip()
        if not text:
            return False
        patterns = (
            "top spending",
            "top spendings",
            "highest spending",
            "highest spend",
            "top 10",
            "biggest spending",
            "largest spending",
        )
        return any(p in text for p in patterns)

    @staticmethod
    def _extract_requested_top_n(message: str, default_n: int = 10) -> int:
        text = (message or "").lower()
        match = re.search(r"\btop\s+(\d{1,2})\b", text)
        if not match:
            return default_n
        try:
            n = int(match.group(1))
        except ValueError:
            return default_n
        return max(1, min(20, n))

    @staticmethod
    def _top_spending_answer(report_payload: dict, message: str = "") -> tuple[str, dict]:
        metrics = report_payload.get("metrics", {})
        categories = list(metrics.get("categoryBreakdown", []) or [])
        categories.sort(key=lambda item: float(item.get("amount") or 0), reverse=True)

        if not categories:
            return (
                "I do not have category spending data for this month yet, so I cannot rank your top spendings.",
                {
                    "modelName": "deterministic_top_spending_guardrail",
                    "provider": "rule_based",
                    "usedFallback": True,
                },
            )

        requested_n = LLMAdapter._extract_requested_top_n(message, default_n=10)
        top_n = min(requested_n, len(categories))
        lines = []
        for i, item in enumerate(categories[:top_n], 1):
            lines.append(
                f"{i}. {item.get('name', 'Unknown')}: ₹{float(item.get('amount') or 0):,.0f} "
                f"({float(item.get('percent') or 0):.1f}% of total, {int(item.get('count') or 0)} transactions)"
            )

        reply = (
            f"Here are your top {top_n} spending categories for this month, ranked by amount:\n\n"
            + "\n".join(lines)
            + "\n\nI currently rank spendings at category level from your report metrics, not as a full per-transaction ledger."
        )

        return (
            reply,
            {
                "modelName": "deterministic_top_spending_guardrail",
                "provider": "rule_based",
                "usedFallback": True,
            },
        )

    @staticmethod
    def _is_cost_cut_question(message: str) -> bool:
        text = (message or "").lower().strip()
        if not text:
            return False
        patterns = (
            "what should i cut",
            "what to cut",
            "where should i cut",
            "reduce my expenditure",
            "reduce my spending",
            "spend less",
            "save more",
            "cut down",
        )
        return any(p in text for p in patterns)

    @staticmethod
    def _cost_cut_answer(report_payload: dict, _message: str = "") -> tuple[str, dict]:
        metrics = report_payload.get("metrics", {})
        categories = list(metrics.get("categoryBreakdown", []) or [])
        categories.sort(key=lambda item: float(item.get("amount") or 0), reverse=True)
        recurring = list(metrics.get("recurringSignals", []) or [])
        recurring.sort(key=lambda item: float(item.get("estimatedMonthlyAmount") or 0), reverse=True)

        if not categories:
            return (
                "I do not have enough category data to suggest specific cuts yet. Please generate the month report first.",
                {
                    "modelName": "deterministic_cost_cut_guardrail",
                    "provider": "rule_based",
                    "usedFallback": True,
                },
            )

        top = categories[:3]
        suggestions = []

        for item in top:
            amt = float(item.get("amount") or 0)
            if amt <= 0:
                continue
            target_cut = max(100.0, round(amt * 0.15, 0))
            suggestions.append(
                f"- Cut {item.get('name', 'this category')} by about ₹{target_cut:,.0f} (15% of ₹{amt:,.0f})."
            )

        if recurring:
            r = recurring[0]
            r_amt = float(r.get("estimatedMonthlyAmount") or 0)
            if r_amt > 0:
                suggestions.append(
                    f"- Review recurring charge '{r.get('description', 'subscription')}' (~₹{r_amt:,.0f}/month) and try reducing at least ₹{max(100.0, round(r_amt * 0.2, 0)):,.0f}."
                )

        total_suggested = 0.0
        for s in suggestions:
            m = re.search(r"₹([0-9,]+)", s)
            if m:
                total_suggested += float(m.group(1).replace(",", ""))

        reply = (
            "To reduce your expenditure, start with your highest-spend areas rather than underused buckets:\n"
            + "\n".join(suggestions[:4])
            + f"\n\nThese changes can reduce around ₹{total_suggested:,.0f} this month if you hit the targets."
        )

        return (
            reply,
            {
                "modelName": "deterministic_cost_cut_guardrail",
                "provider": "rule_based",
                "usedFallback": True,
            },
        )

    def _parse_and_validate(self, raw: str) -> NarrativeOutput:
        """
        Parse raw LLM output as JSON and validate against NarrativeOutput schema.
        Falls back to extracting the first JSON object found in the string if
        the model produces surrounding prose. If the model returns partial JSON,
        normalize it into the required schema shape.
        """
        text = raw.strip()

        # Sometimes models wrap in markdown code fences despite instructions
        if text.startswith("```"):
            text = re.sub(r"^```[a-zA-Z]*\n?", "", text)
            text = re.sub(r"\n?```$", "", text.strip())

        try:
            return NarrativeOutput.model_validate_json(text)
        except Exception:
            json_candidate = self._extract_first_json_object(text)
            if not json_candidate:
                raise

            payload = self._load_json_with_repairs(json_candidate)
            return self._normalize_narrative_payload(payload)

    def _extract_first_json_object(self, text: str) -> str | None:
        """
        Extract the first balanced JSON object from mixed model output.
        Handles quoted strings safely so braces inside text are ignored.
        """
        start = text.find("{")
        if start == -1:
            return None

        depth = 0
        in_string = False
        escaped = False

        for idx in range(start, len(text)):
            ch = text[idx]

            if escaped:
                escaped = False
                continue

            if ch == "\\":
                escaped = True
                continue

            if ch == '"':
                in_string = not in_string
                continue

            if in_string:
                continue

            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    return text[start : idx + 1]

        return None

    def _load_json_with_repairs(self, json_text: str) -> dict:
        """
        Parse model JSON with minimal safe repairs for common issues:
        trailing commas and typographic quotes.
        """
        try:
            return json.loads(json_text)
        except json.JSONDecodeError:
            repaired = json_text

            # Normalize smart quotes often produced by smaller models.
            repaired = repaired.replace("\u201c", '"').replace("\u201d", '"')
            repaired = repaired.replace("\u2018", "'").replace("\u2019", "'")

            # Remove trailing commas before object/array closure.
            repaired = re.sub(r",\s*([}\]])", r"\1", repaired)

            return json.loads(repaired)

    def _normalize_narrative_payload(self, payload: dict) -> NarrativeOutput:
        """Convert variant/partial model outputs into a valid NarrativeOutput."""

        def as_str(value, default=""):
            if value is None:
                return default
            return value if isinstance(value, str) else str(value)

        def as_list(value):
            if value is None:
                return []
            if isinstance(value, list):
                return [as_str(v).strip() for v in value if as_str(v).strip()]
            text_value = as_str(value).strip()
            return [text_value] if text_value else []

        # Accept common key variants from smaller models
        recommendations = (
            payload.get("recommendations")
            if "recommendations" in payload
            else payload.get("recommendation")
        )
        watchouts = (
            payload.get("next_month_watchouts")
            if "next_month_watchouts" in payload
            else payload.get("next_month_watchout")
        )

        normalized = {
            "executive_summary": as_str(payload.get("executive_summary"), "Summary unavailable."),
            "spending_highlights": as_str(payload.get("spending_highlights"), "Highlights unavailable."),
            "category_analysis": as_list(payload.get("category_analysis")),
            "anomalies": as_list(payload.get("anomalies")),
            "budget_insights": as_str(payload.get("budget_insights"), "Budget insights unavailable."),
            "recommendations": as_list(recommendations),
            "next_month_watchouts": as_list(watchouts),
        }

        return NarrativeOutput.model_validate(normalized)

    def _stabilize_narrative(self, request_data: dict, narrative: NarrativeOutput) -> NarrativeOutput:
        """Lock fact-sensitive sections to deterministic text and replace unsupported sections."""
        deterministic, _ = self._template_fallback(request_data)

        recommendations = narrative.recommendations
        watchouts = narrative.next_month_watchouts
        anomalies = narrative.anomalies

        if self._contains_unsupported_guidance(" ".join(recommendations)):
            recommendations = deterministic.recommendations
        if self._contains_unsupported_guidance(" ".join(watchouts)):
            watchouts = deterministic.next_month_watchouts
        if self._contains_unsupported_guidance(" ".join(anomalies)):
            anomalies = deterministic.anomalies

        return NarrativeOutput(
            executive_summary=deterministic.executive_summary,
            spending_highlights=deterministic.spending_highlights,
            category_analysis=deterministic.category_analysis,
            anomalies=anomalies,
            budget_insights=deterministic.budget_insights,
            recommendations=recommendations,
            next_month_watchouts=watchouts,
        )

    @staticmethod
    def _contains_unsupported_guidance(text: str) -> bool:
        lowered = (text or "").lower()
        banned_phrases = (
            "gym membership",
            "significant under-spending",
            "utilizing your allocated funds effectively",
            "utilising your allocated funds effectively",
            "underutilized",
            "underutilised",
            "allocate a larger portion of your budget",
            "use your allocated funds",
        )
        return any(phrase in lowered for phrase in banned_phrases)

    # ── Template fallback ─────────────────────────────────────────────────────

    def _template_fallback(self, request_data: dict) -> tuple[NarrativeOutput, dict]:
        """
        Deterministic, metrics-driven narrative.
        Every sentence cites exact numbers from the payload — no hallucination risk.
        """
        meta = request_data["reportMeta"]
        metrics = request_data["metrics"]
        chart_data = request_data.get("chartData", {})

        total = metrics["totalSpent"]
        budget = meta["monthlyBudget"]
        variance = metrics.get("budgetVariance", budget - total)
        budget_used_pct = metrics.get("budgetUsedPercent")
        adherence = metrics.get("budgetAdherencePercent", 0)
        daily_avg = metrics.get("dailyAverage", 0)
        tx_count = metrics.get("transactionCount", 0)
        top_cat = metrics.get("topSpendingCategory", "N/A")
        top_amt = metrics.get("topCategoryAmount", 0)
        income = metrics.get("totalIncome", 0)
        savings = metrics.get("netSavings", 0)
        cats = metrics.get("categoryBreakdown", [])
        items = metrics.get("budgetItems", [])
        pc = metrics.get("periodChange", {})
        vs_last = pc.get("vsLastMonth")
        note_contexts = metrics.get("noteContexts", [])
        recurring_signals = metrics.get("recurringSignals", [])
        recurring_total = metrics.get("recurringEstimatedTotal", 0)
        creep_signals = metrics.get("lifestyleCreepSignals", [])
        total_creep_pct = metrics.get("totalLifestyleCreepPercent")
        total_creep_excess = metrics.get("totalLifestyleCreepExcess", 0)

        budget_status = "under budget" if variance >= 0 else "over budget"
        trend_stmt = (
            f"Your spending is {abs(vs_last):.1f}% "
            f"{'lower' if vs_last <= 0 else 'higher'} than last month."
            if vs_last is not None
            else "You do not have enough prior-month data for a reliable period comparison yet."
        )

        if budget > 0 and budget_used_pct is None:
            budget_used_pct = round((total / budget) * 100, 1)
        elif budget_used_pct is None:
            budget_used_pct = 0

        # Top 3 categories for highlights
        top3 = cats[:3]
        top3_text = ", ".join(
            f"{c['name']} (₹{c['amount']:,.0f}, {c['percent']:.1f}%)" for c in top3
        )
        top3_pct = sum(c["percent"] for c in top3)

        # Category analysis — one sentence per category
        category_analysis = []
        for c in cats[:6]:
            avg_tx = c["amount"] / c["count"] if c["count"] > 0 else 0
            category_analysis.append(
                f"You spent ₹{c['amount']:,.0f} on {c['name']} ({c['percent']:.1f}% of your total) "
                f"across {c['count']} transactions at an average of ₹{avg_tx:,.0f} per transaction."
            )
        if not category_analysis:
            category_analysis = ["You have no category data available for this period."]

        # Anomalies: flag any bucket overrun
        anomalies = []
        overrun = [i for i in items if i["spent"] > i["allocated"] and i["allocated"] > 0]
        for i in overrun:
            pct_over = ((i["spent"] - i["allocated"]) / i["allocated"]) * 100
            anomalies.append(
                f"Your '{i['name']}' budget is overrun by ₹{i['spent'] - i['allocated']:,.0f} "
                f"({pct_over:.1f}% above your ₹{i['allocated']:,.0f} allocation)."
            )

        for r in recurring_signals[:2]:
            anomalies.append(
                f"You appear to have a recurring payment for '{r['description']}' at about ₹{r['estimatedMonthlyAmount']:,.0f} per month "
                f"({r['monthsDetected']} months, confidence {r['confidence']:.2f})."
            )

        for c in creep_signals[:2]:
            anomalies.append(
                f"Your {c['category']} spending is showing lifestyle creep: ₹{c['currentAmount']:,.0f} now versus ₹{c['baselineAmount']:,.0f} baseline ({c['growthPercent']:+.1f}%)."
            )

        anomalies = anomalies[:4]

        # Budget insights
        within = [i for i in items if i["spent"] <= i["allocated"]]
        utilisation = (total / budget * 100) if budget > 0 else 0
        budget_insights = (
            f"Your overall budget utilisation is {utilisation:.1f}% of your ₹{budget:,.0f} monthly limit, "
            f"leaving ₹{variance:,.0f} {'unspent' if variance >= 0 else 'over the limit'}. "
        )
        if overrun:
            budget_insights += (
                f"Your buckets exceeding allocation: {', '.join(i['name'] for i in overrun)}. "
            )
        if within:
            budget_insights += (
                f"Your buckets within budget: {', '.join(i['name'] for i in within[:4])}. "
            )
        if recurring_signals:
            budget_insights += (
                f"Your detected recurring commitments are approximately ₹{recurring_total:,.0f} per month, which should be treated as fixed baseline spend. "
            )
        if total_creep_pct is not None and total_creep_pct > 0:
            budget_insights += (
                f"Your total spending is {total_creep_pct:.1f}% above your recent baseline (about ₹{total_creep_excess:,.0f} extra), indicating lifestyle creep pressure."
            )

        # Recommendations
        recs = [
            f"Reduce your {top_cat} spending by at least ₹{max(100, top_amt * 0.15):,.0f} since it is your largest cost centre at ₹{top_amt:,.0f}.",
            f"Cap your daily average near ₹{daily_avg * 0.9:,.0f} (a 10% cut from your current ₹{daily_avg:,.0f}) to improve next-month adherence.",
        ]
        if overrun:
            recs.append(
                f"Contain your '{overrun[0]['name']}' overrun by enforcing a hard cap of ₹{overrun[0]['allocated']:,.0f} and reviewing that bucket weekly."
            )
        else:
            second_cat = cats[1]["name"] if len(cats) > 1 else "discretionary categories"
            recs.append(
                f"Monitor your {second_cat} spend weekly to keep your total outflow within the ₹{budget:,.0f} budget."
            )
        if recurring_signals:
            recs.append(
                f"Audit your recurring payments and target at least ₹{max(100, recurring_total * 0.1):,.0f} in monthly subscription savings by cancelling or downgrading low-value services."
            )
        elif creep_signals:
            recs.append(
                f"Reverse lifestyle creep by trimming your fastest-growing category and cutting at least ₹{max(150, total_creep_excess * 0.25):,.0f} from discretionary spend next month."
            )
        recs.append(
            f"Log all income entries so your savings dashboard reflects your actual ₹{savings:,.0f} net position."
        )

        # Next month watchouts
        watchouts = [
            f"If your {top_cat} spending remains near ₹{top_amt:,.0f}, assign a dedicated bucket at or above that amount next month.",
            f"Given your current total of ₹{total:,.0f}, set your next-month plan using at least this figure as the baseline.",
        ]
        if vs_last is not None and vs_last > 10:
            watchouts.append(
                f"Your {vs_last:.1f}% month-over-month growth signals upward drift, so tighten discretionary spending early next month."
            )
        if recurring_signals:
            watchouts.append(
                f"Your recurring commitments already consume about ₹{recurring_total:,.0f}; any new subscription could crowd out flexible spending room."
            )
        if total_creep_pct is not None and total_creep_pct > 0:
            watchouts.append(
                f"If your current lifestyle-creep pace continues ({total_creep_pct:.1f}% above baseline), your monthly spend may rise by another ₹{max(100, total_creep_excess * 0.5):,.0f}."
            )

        watchouts = watchouts[:3]

        # Weekly highlights for spending_highlights
        weekly = chart_data.get("weeklyTrend", [])
        weekly_text = ""
        if weekly:
            amounts = [w["amount"] for w in weekly]
            peak_week = weekly[amounts.index(max(amounts))]["label"]
            increasing = all(b > a for a, b in zip(amounts, amounts[1:]))
            decreasing = all(b < a for a, b in zip(amounts, amounts[1:]))
            if increasing:
                weekly_text = f" Your spending increased week by week and peaked during {peak_week} at ₹{max(amounts):,.0f}."
            elif decreasing:
                weekly_text = f" Your spending trended down through the month, though it still peaked during {peak_week} at ₹{max(amounts):,.0f}."
            else:
                weekly_text = f" Your weekly pattern was mixed, with the highest spend in {peak_week} at ₹{max(amounts):,.0f}."

        note_hint = ""
        if note_contexts:
            note_hint = f" Your notes highlight items such as '{note_contexts[0]['note']}'."

        narrative = NarrativeOutput(
            executive_summary=(
                f"In {meta['monthLabel']}, you spent ₹{total:,.0f} against your monthly budget of ₹{budget:,.0f}, "
                f"putting you {budget_status} by ₹{abs(variance):,.0f}. "
                f"You used {budget_used_pct:.1f}% of your budget and still had {adherence:.1f}% remaining. "
                f"You recorded {tx_count} transactions with a daily average of ₹{daily_avg:,.0f}. "
                f"{trend_stmt}"
            ),
            spending_highlights=(
                f"Your top spending categories were {top3_text}, together accounting for {top3_pct:.1f}% of your total spend."
                f"{weekly_text}{note_hint} "
                f"You recorded income of ₹{income:,.0f}, leaving your net savings at ₹{savings:,.0f}."
            ),
            category_analysis=category_analysis,
            anomalies=anomalies,
            budget_insights=budget_insights,
            recommendations=recs[:4],
            next_month_watchouts=watchouts[:3],
        )

        model_info = {
            "modelName": "template_v1",
            "provider": "template_fallback",
            "usedFallback": True,
        }
        return narrative, model_info
