"""
FastAPI entry point for the ExpenseKeeper Report Service.
Runs on port 8001 (ML prediction service runs on 8000).

Endpoints:
  GET  /health                 – service health check
  POST /generate-narrative     – returns structured JSON narrative
  POST /generate-pdf           – returns binary PDF (application/pdf)
"""

import logging
from datetime import datetime, timezone

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from config import settings
from llm_adapter import LLMAdapter
from pdf_generator import PDFReportGenerator
from schemas import ChatRequest, ChatResponse, GenerateReportRequest, ModelInfo, NarrativeResponse

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)
logger.info("Starting Report API — model=%s  provider=%s", settings.LLM_MODEL, settings.LLM_PROVIDER)

# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="ExpenseKeeper Report API",
    version="1.0.0",
    description=(
        "Generates AI-powered monthly expense narratives (via pluggable LLM provider) "
        "and downloadable PDF reports with embedded charts."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tightened by the Node backend; fine for internal service
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Singletons ────────────────────────────────────────────────────────────────

llm      = LLMAdapter(model_name=settings.LLM_MODEL)
pdf_gen  = PDFReportGenerator()

# ── Routes ────────────────────────────────────────────────────────────────────


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "report-service",
        "llm_model": settings.LLM_MODEL,
        "llm_provider": settings.LLM_PROVIDER,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.post("/generate-narrative", response_model=NarrativeResponse)
def generate_narrative(request: GenerateReportRequest):
    """
    Generate structured AI narrative sections for the given month's metrics.
    Returns JSON — fast path for rendering the in-app report view.
    """
    logger.info(
        "generate-narrative  month=%s  user=%s",
        request.reportMeta.monthKey,
        request.reportMeta.userName,
    )
    try:
        narrative, model_info = llm.generate_narrative(request.model_dump())
        return NarrativeResponse(
            narrative=narrative,
            modelInfo=ModelInfo(**model_info),
            generatedAt=datetime.now(timezone.utc).isoformat(),
        )
    except Exception as exc:
        logger.exception("Narrative generation failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest):
    """Answer a conversational question grounded in the stored report payload."""
    logger.info(
        "chat  month=%s  question=%s",
        request.reportPayload.reportMeta.monthKey,
        request.message[:120],
    )
    try:
        reply, model_info = llm.generate_chat_response(request.model_dump())
        return ChatResponse(
            reply=reply,
            modelInfo=ModelInfo(**model_info),
            generatedAt=datetime.now(timezone.utc).isoformat(),
        )
    except Exception as exc:
        logger.exception("Chat generation failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/generate-pdf")
def generate_pdf(request: GenerateReportRequest):
    """
    Generate a full A4 PDF report (narrative + charts) for the given month.
    Returns the PDF as a binary download — slower than generate-narrative.
    """
    logger.info(
        "generate-pdf  month=%s  user=%s",
        request.reportMeta.monthKey,
        request.reportMeta.userName,
    )
    try:
        narrative, model_info = llm.generate_narrative(request.model_dump())
        pdf_bytes = pdf_gen.generate(request, narrative, model_info)

        safe_month = request.reportMeta.monthLabel.replace(" ", "_")
        safe_user  = "".join(
            c for c in request.reportMeta.userName if c.isalnum() or c in "-_"
        ) or "User"
        filename = f"ExpenseReport_{safe_month}_{safe_user}.pdf"

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except Exception as exc:
        logger.exception("PDF generation failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ── Dev entry-point ───────────────────────────────────────────────────────────

if __name__ == "__main__":
    uvicorn.run(
        "report_api:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True,
    )
