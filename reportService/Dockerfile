FROM python:3.11-slim

WORKDIR /app

# Build dependencies for matplotlib / reportlab
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libfreetype6-dev \
    libpng-dev \
    pkg-config \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8001

CMD ["uvicorn", "report_api:app", "--host", "0.0.0.0", "--port", "8001"]
