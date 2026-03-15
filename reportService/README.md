# ExpenseKeeper — Report Service

A Python FastAPI microservice that generates **AI-powered monthly expense reports** with downloadable PDF output. It is a sibling service to `mlModel/` and runs on **port 8001**.

## What it does

| Endpoint | Method | Returns |
|---|---|---|
| `/health` | GET | Service + model status |
| `/generate-narrative` | POST | Structured JSON narrative (in-app view) |
| `/generate-pdf` | POST | Binary PDF download with embedded charts |

The service receives a pre-aggregated monthly metrics payload from the Node backend, calls a hosted LLM provider (**Groq**) to produce a data-heavy analyst narrative, and embeds the narrative + three charts (pie, bar, trend) into a styled A4 PDF.

If the provider is unavailable the service **automatically falls back** to a deterministic template narrative built directly from the supplied metrics — the endpoints always return a valid response.

---

## Tech stack

- **FastAPI** + Uvicorn — API framework
- **OpenAI-compatible Python client** — Groq inference API integration
- **ReportLab** — PDF generation
- **Matplotlib** — chart image generation (pie, bar, trend, budget adherence)
- **Pydantic v2** — request/response schema validation

---

## Setup

### 1 — Create a Groq API key

Create an API key in the Groq console:

- [https://console.groq.com/keys](https://console.groq.com/keys)

### 2 — Create a virtual environment and install dependencies

```bash
cd reportService
python -m venv .venv

# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
```

### 3 — Configure environment

```bash
cp .env.example .env
# Edit .env — set GROQ_API_KEY and keep LLM_MODEL=llama-3.3-70b-versatile
```

### 4 — Start the service

```bash
python report_api.py

# Or via uvicorn directly:
uvicorn report_api:app --host 0.0.0.0 --port 8001 --reload
```

The API will be available at `http://localhost:8001`.  
Interactive docs: `http://localhost:8001/docs`

---

## Using Docker

```bash
docker build -t expensekeeper-report-service .
docker run -p 8001:8001 \
  -e LLM_PROVIDER=groq \
  -e LLM_MODEL=llama-3.3-70b-versatile \
  -e GROQ_API_KEY=your_groq_key \
  expensekeeper-report-service
```

---

## API contract

### POST `/generate-narrative` and POST `/generate-pdf`

Both endpoints accept the same JSON body.

```jsonc
{
  "reportMeta": {
    "monthKey":      "2026-02",
    "monthLabel":    "February 2026",
    "userType":      "young_professional",
    "userName":      "Alice",
    "monthlyBudget": 15000.0,
    "timezone":      "Asia/Kolkata"
  },
  "metrics": {
    "totalSpent":              12300.0,
    "totalIncome":             50000.0,
    "netSavings":              37700.0,
    "budgetVariance":          2700.0,
    "budgetAdherencePercent":  82.0,
    "periodChange": { "vsLastMonth": -5.2, "vsLastYear": 12.1 },
    "dailyAverage":            439.3,
    "transactionCount":        45,
    "categoryBreakdown": [
      { "name": "Food & Drink", "amount": 3200.0, "percent": 26.0, "count": 12 }
    ],
    "topSpendingCategory":  "Food & Drink",
    "topCategoryAmount":    3200.0,
    "budgetItems": [
      { "name": "Groceries", "allocated": 4000.0, "spent": 3200.0,
        "remaining": 800.0, "usagePercent": 80.0 }
    ]
  },
  "chartData": {
    "weeklyTrend": [
      { "label": "Week 1", "amount": 2800.0 },
      { "label": "Week 2", "amount": 3100.0 }
    ]
  }
}
```

`/generate-narrative` response:

```jsonc
{
  "narrative": {
    "executive_summary":    "...",
    "spending_highlights":  "...",
    "category_analysis":    ["..."],
    "anomalies":            [],
    "budget_insights":      "...",
    "recommendations":      ["..."],
    "next_month_watchouts": ["..."]
  },
  "modelInfo": { "modelName": "llama-3.3-70b-versatile", "provider": "groq", "usedFallback": false },
  "generatedAt": "2026-03-01T10:00:00+00:00"
}
```

`/generate-pdf` returns `application/pdf` binary with `Content-Disposition: attachment; filename="ExpenseReport_February_2026_Alice.pdf"`.

---

## Fine-tuning (future)

The service is scaffolded for a LoRA fine-tuning upgrade:

1. Collect `(request_payload → validated_narrative)` training pairs from production (the Node backend logs these when `CAPTURE_TRAINING_DATA=true`).
2. Fine-tune a LoRA adapter on `llama3.2` or `qwen2.5` using the collected pairs.
3. Serve the adapter via a PEFT-compatible runtime or hosted inference endpoint.
4. Set `FINETUNED_MODEL_PATH=...` in `.env` and restart — the adapter will be loaded automatically.

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `LLM_PROVIDER` | `groq` | Active provider (`groq` or `template`) |
| `LLM_MODEL` | `llama-3.3-70b-versatile` | Provider model ID |
| `GROQ_API_KEY` | *(empty)* | Groq API key |
| `GROQ_BASE_URL` | `https://api.groq.com/openai/v1` | Groq OpenAI-compatible base URL |
| `GROQ_TIMEOUT_SECONDS` | `60` | Groq request timeout in seconds |
| `LLM_TEMPERATURE` | `0.25` | Sampling temperature (lower = more deterministic) |
| `LLM_MAX_TOKENS` | `800` | Max tokens the LLM may produce |
| `LLM_MAX_TIME_SECONDS` | `85` | Hard generation budget in seconds |
| `FINETUNED_MODEL_PATH` | *(empty)* | Optional fine-tuned checkpoint path |
| `PORT` | `8001` | Port to listen on |
