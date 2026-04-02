"""
Configuration management for the Report Service.
All settings can be overridden via environment variables or a local .env file.
"""

import os
from dotenv import load_dotenv

# Ensure project .env values (for local dev) take precedence over stale shell vars.
load_dotenv(override=True)


class Settings:
    # ── LLM ──────────────────────────────────────────────────────────────────
    # Active provider for narrative generation.
    LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "groq").strip().lower()

    # Provider model ID.
    LLM_MODEL: str = os.getenv("LLM_MODEL", "llama-3.3-70b-versatile")
    CHAT_MODEL: str = os.getenv("CHAT_MODEL", "llama-3.1-8b-instant")

    # Groq/OpenAI-compatible API settings.
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    GROQ_BASE_URL: str = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1")
    GROQ_TIMEOUT_SECONDS: float = float(os.getenv("GROQ_TIMEOUT_SECONDS", "60"))
    GROQ_FALLBACK_MODELS: list[str] = [
        m.strip()
        for m in os.getenv(
            "GROQ_FALLBACK_MODELS",
            "llama-3.1-8b-instant,mixtral-8x7b-32768",
        ).split(",")
        if m.strip()
    ]

    # Optional: path to a fine-tuned LoRA adapter or full checkpoint.
    # Leave empty to use the base prompt-engineered model.
    FINETUNED_MODEL_PATH: str | None = os.getenv("FINETUNED_MODEL_PATH") or None

    # ── Server ────────────────────────────────────────────────────────────────
    PORT: int = int(os.getenv("PORT", "8001"))
    # CORS origins for frontend access (comma-separated).
    CORS_ALLOWED_ORIGINS: list[str] = [
        o.strip()
        for o in os.getenv(
            "CORS_ALLOWED_ORIGINS",
            "http://localhost:3000,http://localhost:5173",
        ).split(",")
        if o.strip()
    ]

    # ── Generation ────────────────────────────────────────────────────────────
    # Maximum tokens the LLM is allowed to produce.
    LLM_MAX_TOKENS: int = int(os.getenv("LLM_MAX_TOKENS", "800"))
    # Sampling temperature — lower = more deterministic / data-accurate.
    LLM_TEMPERATURE: float = float(os.getenv("LLM_TEMPERATURE", "0.25"))
    # Hard stop for generation wall-clock time in seconds.
    LLM_MAX_TIME_SECONDS: float = float(os.getenv("LLM_MAX_TIME_SECONDS", "85"))

    # ── Supported model registry (informational) ──────────────────────────────
    SUPPORTED_MODELS: list[str] = [
        "llama-3.3-70b-versatile",
        "llama-3.1-8b-instant",
        "mixtral-8x7b-32768",
    ]


settings = Settings()
