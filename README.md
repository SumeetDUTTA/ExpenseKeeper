# ExpenseKeeper

A full-stack personal finance application that helps users track expenses, visualize spending patterns, and leverage machine learning to predict future monthly expenses across categories. Built with React, Node.js, MongoDB, and XGBoost.

## Overview

ExpenseKeeper combines traditional expense management with predictive analytics to provide users with actionable insights about their spending behavior. The platform automatically categorizes transactions, generates visual analytics, and uses a universal XGBoost model to forecast future spending based on historical patterns, budget context, and user profile.

## Screenshots

### Dashboard
![Dashboard Overview](https://github.com/SumeetDUTTA/ExpenseKeeper/blob/main/images/Dashbord_1.png), 
![Dashboard Analytics](https://github.com/SumeetDUTTA/ExpenseKeeper/blob/main/images/Dashboard_2.png)
*Main dashboard showing monthly spending trends, category distribution, and analytics*

### Expense Management
![Expense List](https://github.com/SumeetDUTTA/ExpenseKeeper/blob/main/images/Expenses_2.png), 
![Expense Analytics](https://github.com/SumeetDUTTA/ExpenseKeeper/blob/main/images/Expenses_1.png), 
![Add Expense](https://github.com/SumeetDUTTA/ExpenseKeeper/blob/main/images/Add_Expenses.png)
*Comprehensive expense tracking with search, filter, and analytics features*

### AI Predictions
![Prediction Interface](https://github.com/SumeetDUTTA/ExpenseKeeper/blob/main/images/Predict_1.png), 
![By Category Predictions](https://github.com/SumeetDUTTA/ExpenseKeeper/blob/main/images/Predict_2.png)
*ML-powered expense forecasting with category-wise breakdown*

### Profile Management
![Profile Settings](https://github.com/SumeetDUTTA/ExpenseKeeper/blob/main/images/Profile.png)
*User profile customization with budget and preferences*

## Technologies Used

- **Frontend:** React (Vite), React Router, Recharts, Lucide Icons, React Hot Toast, TailwindCSS, DaisyUI
- **Backend:** Node.js, Express.js 5.x, JWT authentication, Zod 4.x validation, bcrypt
- **Database:** MongoDB with Mongoose 8.x ODM
- **Rate Limiting:** Redis (Upstash) - 50 req/min general, 5 req/min auth
- **Machine Learning:** Python, XGBoost, FastAPI, Optuna (hyperparameter tuning), scikit-learn, pandas, numpy
- **Development:** Nodemon (backend), Vite dev server (frontend), Uvicorn (ML API)

## Project Structure

```
├── backend/           # Express API server
│   ├── src/
|   |   ├── config/
│   │   ├── controllers/
|   |   ├── middleware/
|   |   ├── mlService/
│   │   ├── models/
│   │   ├── routes/
|   |   ├── utils/
|   |   ├── validators/
│   │   └── server.js
│   └── package.json
├── frontend/          # React + Vite application
│   ├── src/
│   │   ├── components/
│   │   ├── contexts/
│   │   ├── lib/
│   │   ├── pages/
│   │   ├── styles/
│   │   ├── App.css
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   └── package.json
├── mlModel/           # Python ML service
│   ├── ml_api.py
│   ├── train_model.py
│   ├── predict_expense.py
│   ├── training_data.csv
│   └── requirements.txt
└── README.md
```

## Getting Started

### Prerequisites

- Node.js (v16+)
- Python (v3.9+)
- MongoDB (local or Atlas)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/SumeetDUTTA/ExpenseKeeper.git
   cd ExpenseKeeper
   ```

2. **Backend Setup:**
   ```bash
   cd backend
   npm install
   ```
   Create a `.env` file in `backend/` with:
   ```
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret_key
   PORT=5000
   ML_API_URL=http://127.0.0.1:8000
   UPSTASH_REDIS_REST_URL=your_upstash_redis_url
   UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_token
   ```

3. **Frontend Setup:**
   ```bash
   cd frontend
   npm install
   ```
   Create a `.env` file in `frontend/` with:
   ```
   VITE_API_TARGET=http://localhost:5000
   VITE_ML_API_URL=http://127.0.0.1:8000
   ```

4. **ML Model Setup:**
   ```bash
   cd mlModel
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

### Running the Application

Start all three services in separate terminals:

1. **Backend:**
   ```bash
   cd backend
   npm run dev  # Development mode with hot-reload
   # OR
   npm start    # Production mode
   ```

2. **Frontend:**
   ```bash
   cd frontend
   npm run dev
   ```

3. **ML API:**
   ```bash
   cd mlModel
   uvicorn ml_api:app --reload --host 0.0.0.0 --port 8000
   ```

The application will be available at:
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:5000`
- ML API: `http://127.0.0.1:8000`

## Core Features

### Landing & Authentication
- **Marketing Home Page:** Dedicated landing page for new visitors explaining features, workflow, and technology stack
- **Auto-redirect:** Authenticated users automatically redirected to dashboard
- **Secure Authentication:** JWT-based signup/login with bcrypt password hashing
- **Server Health Checks:** Automatic health checks for backend and ML server with user-friendly wait notifications (30s backend, 45s ML server) to handle Render's auto-sleep behavior

### User Management
- **User Profiles:** Customizable profiles with monthly budget settings and user type selection (college student, young professional, family moderate/high, luxury lifestyle, senior retired)
- **Theme Support:** Light and dark mode with persistent preferences

### Expense Management
- **CRUD Operations:** Add, view, edit, and delete expenses with amount, category, date, and notes
- **Category Organization:** 13 pre-defined categories (Food & Drink, Travel, Utilities, Entertainment, Health & Fitness, Shopping, Rent, Personal Care, Education, Investments, Groceries, Miscellaneous, Transportation)
- **Search & Filter:** Real-time search and category-based filtering
- **Responsive Design:** Mobile-first UI with adaptive layouts

### Data Visualization
- **Dashboard Analytics:**
  - Monthly spending overview with vs. previous month comparison
  - Daily average spending calculation
  - Category distribution pie chart
  - 6-month spending trend line chart
  - Top spending categories with progress bars
- **Expense History:**
  - Time-series line chart with interactive brush/zoom
  - Aggregation modes: daily, weekly, monthly
  - Custom date range selection
  - Period breakdown tables

### Predictive Analytics
- **Expense Forecasting:** Multi-month predictions (1-12 months) using XGBoost regression
- **Category-Level Predictions:** Individual forecasts per expense category
- **Budget-Aware Models:** Predictions adapt to user's monthly budget and spending profile
- **User Archetypes:** Model trained on 6 user types (college student, young professional, family moderate/high, luxury lifestyle, senior retired)
- **Smart Guardrails:** 15% maximum month-over-month change constraint for fixed-cost categories (Rent, Personal Care) to ensure realistic predictions
- **Production Caching:** Redis-backed response caching in production (disabled in development) for improved performance

## Machine Learning Details

The prediction engine uses a universal XGBoost model trained on synthetic transaction data covering multiple user profiles and budget ranges (₹3,000 - ₹60,000/month).

**Features (36 total):**
- Time-series signals: 1/2/3/12-month lags, 3/6/12-month rolling averages, Rolling3_Median, Volatility_6
- Trend indicators: 3-month trend, percentage change
- Calendar features: month number, sine/cosine seasonality, is_festival_season
- Budget context: log budget, budget category buckets, spend-to-budget ratio, category_ratio
- Behavioral mix: category one-hot encodings, user type encodings, category share of total spend

**Performance:**
- MAE (rupees): ₹863.13 - Average absolute rupee error per month
- RMSE (rupees): ₹1,771.70 - Root mean squared error
- Model Accuracy: ~89-92% across different user types and budget ranges
- Handles diverse spending patterns from ₹3,000 to ₹60,000 monthly budgets
- Optimized with Optuna (513 trees, depth 12, learning rate 0.0551)

**Smart Guardrails:**
- **Fixed-Cost Categories (Rent, Personal Care):** Maximum 15% month-over-month change to prevent unrealistic predictions
- **Variable Categories (Food & Drink, Entertainment, Travel, etc.):** Outlier prevention with 0.3x to 2x recent average bounds
- **Zero-value Handling:** Model predictions trusted when previous month is ₹0

See `mlModel/README.md` for detailed ML documentation.

## API Endpoints

### Backend (Express)
- `POST /api/auth/signup` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/health` - Backend health check endpoint
- `GET /api/expenses` - Get all user expenses (with optional filters)
- `POST /api/expenses` - Create new expense
- `PATCH /api/expenses/:id` - Update expense
- `DELETE /api/expenses/:id` - Delete expense
- `GET /api/user/profile` - Get user profile
- `PATCH /api/user/profile` - Update user profile
- `PATCH /api/user/meta` - Update user metadata (budget, user type)
- `POST /api/predict` - ML prediction proxy with Redis caching (production only)

### ML API (FastAPI)
- `GET /docs` - Defauld FastAPI endpoint
- `POST /predict` - Get expense predictions with smart guardrails for multiple months and categories

## Development

### Code Quality
- Frontend: ESLint
- Backend: Zod schema validation, error middleware
- Consistent design tokens across CSS modules
- Accessible UI with ARIA labels

### Environment Variables

**Backend (.env):**
```env
NODE_ENV=development           # Set to 'production' to enable Redis caching
PORT=5000
MONGODB_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
ML_API_URL=http://127.0.0.1:8000
UPSTASH_REDIS_REST_URL=your_redis_url
UPSTASH_REDIS_REST_TOKEN=your_redis_token
CORS_ORIGIN=http://localhost:5173
```

**Frontend (.env):**
```env
VITE_API_TARGET=http://localhost:5000      # Backend API URL
VITE_ML_API_URL=http://127.0.0.1:8000      # ML API URL (optional, falls back to localhost:8000)
```

**ML Model:**
- No environment variables required for local development
- Uses port 8000 by default

### Testing
Run frontend dev server with hot reload:
```bash
cd frontend
npm run dev
```

Build for production:
```bash
npm run build
```

### Development Notes
- Redis caching is **disabled** in development (`NODE_ENV !== 'production'`) for faster iteration
- Health checks automatically handle Render's server sleep with 30-45 second wait notifications
- ML server health checks have longer timeouts (8s vs 5s) due to model loading overhead

## Contributing

This is a completed academic project. For any questions or issues, please contact the repository owner.

## License

This project is for educational purposes. All rights reserved.

## Acknowledgments

- Built as a 5th semester project
- ML model inspired by time-series forecasting best practices
- UI/UX design follows modern dashboard patterns

---

**Author:** Sumeet Dutta and Sahil Kumar
**Repository:** [ExpenseKeeper](https://github.com/SumeetDUTTA/ExpenseKeeper)
**Website:** https://expense-keeper-two.vercel.app/

