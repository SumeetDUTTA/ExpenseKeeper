# ExpenseKeeper

A full-stack personal finance platform for tracking expenses, planning monthly budgets, visualizing spending trends, and forecasting future expenses with machine learning.

ExpenseKeeper combines a React frontend, an Express + MongoDB backend, and a Python FastAPI ML service to deliver end-to-end expense management with predictive analytics.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Core Features](#core-features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Run the Application](#run-the-application)
- [API Overview](#api-overview)
- [Machine Learning Summary](#machine-learning-summary)
- [Development Notes](#development-notes)
- [Scripts](#scripts)
- [Author](#author)

## Overview

ExpenseKeeper is built as a production-style academic project focused on practical personal finance workflows:

- Secure authentication (JWT + OAuth + CAPTCHA)
- Expense CRUD with category/date filtering and analytics
- Monthly budget bucket planning with allocation/spending tracking
- Dashboard and chart-based insights
- ML-powered multi-month category predictions

## Architecture

The application is split into three services:

1. **Frontend (`frontend/`)**
   - React + Vite single-page application
   - Routing, auth context, charts, forms, and responsive UI

2. **Backend (`backend/`)**
   - Express 5 API with MongoDB (Mongoose)
   - JWT auth, Google/Discord OAuth, Turnstile verification, validation, rate limiting, and ML proxy

3. **ML Service (`mlModel/`)**
   - FastAPI-based inference service with XGBoost model
   - Category-level future expense forecasting with guardrails

## Core Features

### Authentication & Security
- JWT login/registration with bcrypt password hashing
- OAuth 2.0 (Google and Discord)
- Cloudflare Turnstile CAPTCHA on login/register
- Redis-backed rate limiting (general + auth-specific)
- Helmet security headers + CORS controls

### User & Profile Management
- Profile fetch/update endpoints (`name`, `email`, `password`, `monthlyBudget`, `userType`)
- Separate user metadata endpoint for onboarding flows
- OAuth users handled safely for password management

### Expense Management
- Create, list, update, delete expenses
- Category/date/search filtering
- Visual analytics and period summaries

### Budget Buckets
- Monthly bucket allocation workflow
- Budget month summary (allocated, spent, remaining)
- Allocation validation against configured monthly budget limits

### Predictive Analytics
- 1-12 month forecasting via XGBoost
- Category-wise prediction outputs
- Budget-aware and user-type-aware modeling
- Smart guardrails for realistic projections

## Tech Stack

- **Frontend:** React, Vite, React Router, Recharts, TailwindCSS, DaisyUI, Axios, React Hot Toast, Lucide
- **Backend:** Node.js, Express 5, MongoDB, Mongoose, JWT, bcrypt, Zod, Axios, Helmet, Morgan
- **Security:** Cloudflare Turnstile, CORS, Redis + rate-limit middleware
- **ML:** Python, FastAPI, XGBoost, scikit-learn, pandas, numpy, Optuna

## Project Structure

```text
ExpenseKeeper/
├── backend/                    # Express API server
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── mlServices/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── utils/
│   │   ├── validators/
│   │   └── server.js
│   └── package.json
├── frontend/                   # React + Vite application
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── contexts/
│   │   ├── lib/
│   │   ├── pages/
│   │   ├── styles/
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── package.json
├── mlModel/                    # FastAPI + XGBoost service
│   ├── ml_api.py
│   ├── predict_expense.py
│   ├── train_model.py
│   ├── requirements.txt
│   └── expense_forecast_model.json
├── SECURITY.md
└── README.md
```

## Getting Started

### Prerequisites

- Node.js v16+
- Python v3.9+
- MongoDB (local or Atlas)
- Redis/Upstash Redis (recommended for production-like setup)

### 1) Backend Setup

```bash
cd backend
npm install
```

Create `backend/.env` (see full variables below).

### 2) Frontend Setup

```bash
cd frontend
npm install
```

Create `frontend/.env` (see full variables below).

### 3) ML Service Setup

```bash
cd mlModel
python -m venv venv
# Windows
venv\Scripts\activate
# macOS/Linux
# source venv/bin/activate

pip install -r requirements.txt
```

## Environment Variables

### Backend (`backend/.env`)

```env
NODE_ENV=development
PORT=5000
MONGODB_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
JWT_EXPIRE=7d

ML_API_URL=http://127.0.0.1:8000
CORS_ORIGIN=http://localhost:5173

UPSTASH_REDIS_REST_URL=your_upstash_redis_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_token

GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret
DISCORD_REDIRECT_URI=http://localhost:5000/api/auth/discord/callback

TURNSTILE_SECRET_KEY=your_turnstile_secret_key
```

### Frontend (`frontend/.env`)

```env
VITE_API_TARGET=http://localhost:5000
VITE_ML_API_URL=http://127.0.0.1:8000

VITE_GOOGLE_CLIENT_ID=your_google_client_id
VITE_DISCORD_CLIENT_ID=your_discord_client_id
VITE_DISCORD_REDIRECT_URI=http://localhost:5173/discord/callback

VITE_TURNSTILE_SITE_KEY=your_turnstile_site_key
```

## Run the Application

Run all three services in separate terminals.

### Backend
```bash
cd backend
npm run dev
```

### Frontend
```bash
cd frontend
npm run dev
```

### ML API
```bash
cd mlModel
uvicorn ml_api:app --reload --host 0.0.0.0 --port 8000
```

### Local URLs
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5000`
- ML API: `http://127.0.0.1:8000`

## API Overview

### Health
- `GET /health` - backend service health check

### Auth (`/api/auth`)
- `POST /register`
- `POST /login`
- `POST /google`
- `POST /discord`
- `GET /discord/callback`

### User (`/api/user`)
- `GET /profile`
- `PATCH /profile`
- `DELETE /profile/delete`
- `PATCH /meta`

### Expenses (`/api/expenses`)
- `GET /`
- `POST /`
- `PATCH /:id`
- `DELETE /:id`

### Budgets (`/api/budgets`)
- `GET /month`
- `PUT /month`
- `GET /summary`

### Predictions (`/api/predict`)
- `POST /`

## Machine Learning Summary

- Universal XGBoost regressor trained on multi-profile spending behavior
- Forecast horizon supports multiple future months
- Features include lags, rolling statistics, trend indicators, seasonality, budget context, and user-type signals
- Guardrails cap unrealistic swings for fixed-cost categories and bound variable categories

For model internals and training details, see `mlModel/README.md`.

## Development Notes

- In development, Redis caching for prediction responses is typically disabled to speed iteration.
- Frontend includes backend/ML health checks to handle sleeping deployments with user-facing wait/retry flows.
- Validation is handled with Zod schemas on backend routes.

## Scripts

### Backend (`backend/package.json`)
- `npm run dev` - run with nodemon
- `npm start` - run with Node.js

### Frontend (`frontend/package.json`)
- `npm run dev` - start Vite dev server
- `npm run build` - production build
- `npm run preview` - preview production build
- `npm run lint` - run ESLint

## Author

- **Sumeet Dutta** (with project collaborator Sahil Kumar)
- Repository: [ExpenseKeeper](https://github.com/SumeetDUTTA/ExpenseKeeper)
- Live App: https://expense-keeper-two.vercel.app/

---

For deeper implementation details, refer to:

- `backend/README.md`
- `frontend/README.md`
- `mlModel/README.md`