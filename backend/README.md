# ExpenseKeeper Backend API

RESTful API server for the ExpenseKeeper application, providing authentication, expense management, user profiles, and ML prediction integration.

## 📝 Description

The ExpenseKeeper backend is a robust Node.js/Express API that handles all server-side operations for the expense tracking application. It provides secure authentication with JWT tokens, comprehensive CRUD operations for expense management, user profile management, and integration with the Python ML service for predictive analytics. The API features Redis-based rate limiting, MongoDB for data persistence, request validation with Zod schemas, and comprehensive error handling.

## ✨ Features

-   **JWT Authentication:** Secure token-based authentication with bcrypt password hashing and 7-day token expiry
-   **User Management:** Registration, login, profile retrieval, budget configuration, and account statistics
-   **Expense CRUD:** Full expense lifecycle with search, filtering, pagination, and category-based analytics
-   **Data Aggregation:** Monthly summaries, category-wise totals, spending trends, and budget tracking
-   **ML Integration:** Proxy endpoints to Python ML API for expense predictions with error handling
-   **Rate Limiting:** Redis-backed rate limiting (50 requests/min general, 5 requests/min auth) with Upstash Redis
-   **Request Validation:** Zod schema validation for all inputs with detailed error messages
-   **Security:** Helmet.js security headers, CORS configuration, input sanitization, and error obfuscation
-   **Middleware Chain:** Authentication middleware, validation middleware, and error handling middleware
-   **Database:** MongoDB with Mongoose ODM, indexed queries, and schema validation
-   **Logging:** Morgan HTTP request logging with environment-aware formats
-   **Error Handling:** Centralized error handling with custom ApiError class and detailed error responses

## 🛠️ Technologies Used

-   **Runtime:** Node.js (ES Modules)
-   **Framework:** Express.js 5.x
-   **Database:** MongoDB with Mongoose 8.x ODM
-   **Authentication:** JWT (jsonwebtoken) with bcryptjs for password hashing
-   **Validation:** Zod 4.x for schema-based request validation
-   **Caching/Rate Limiting:** Redis with @upstash/redis and rate-limit-redis
-   **Security:** Helmet.js for security headers, express-rate-limit
-   **HTTP Client:** Axios for ML API communication
-   **Logging:** Morgan for HTTP request logging
-   **Environment:** dotenv for configuration management
-   **Dev Tools:** Nodemon for hot-reload during development

## 📂 Project Structure

```
backend/
├── src/
│   ├── config/
│   │   └── db.js                       # MongoDB connection configuration
│   ├── controllers/
│   │   ├── authControllers.js          # Login, register, token validation
│   │   ├── expenseControllers.js       # CRUD operations for expenses
│   │   ├── predictControllers.js       # ML prediction proxy endpoints
│   │   ├── userControllers.js          # User profile and preferences
│   │   └── userMetaController.js       # User statistics and metadata
│   ├── middleware/
│   │   ├── auth.js                     # JWT authentication middleware
│   │   ├── errorHandler.js             # Global error handling
│   │   └── validate.js                 # Zod schema validation middleware
│   ├── mlServices/
│   │   └── mlService.js                # ML API client with error handling
│   ├── models/
│   │   ├── expense.js                  # Mongoose expense schema
│   │   └── user.js                     # Mongoose user schema
│   ├── routes/
│   │   ├── authRoutes.js               # Authentication endpoints
│   │   ├── expenseRoutes.js            # Expense management endpoints
│   │   ├── predictRoutes.js            # ML prediction endpoints
│   │   └── userRoutes.js               # User profile endpoints
│   ├── utils/
│   │   ├── ApiError.js                 # Custom error class
│   │   └── redisClient.js              # Redis client configuration
│   ├── validators/
│   │   ├── authValidator.js            # Auth request schemas
│   │   ├── expensesValidator.js        # Expense request schemas
│   │   ├── predictValidator.js         # Prediction request schemas
│   │   └── userValidator.js            # User request schemas
│   └── server.js                       # Application entry point
├── .gitignore
├── package.json
└── README.md
```

## 🚀 Getting Started

### Prerequisites

-   Node.js (v16 or later)
-   MongoDB (local or Atlas cluster)
-   Redis (Upstash or local instance)
-   npm or yarn

### Installation

1.  Clone the repository:
    ```sh
    git clone https://github.com/SumeetDUTTA/ExpenseKeeper.git
    ```
2.  Navigate to the backend directory:
    ```sh
    cd backend
    ```
3.  Install dependencies:
    ```sh
    npm install
    ```

### Environment Configuration

Create a `.env` file in the backend directory with the following variables:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb://localhost:27017/expense-tracker
# OR for MongoDB Atlas:
# MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/expense-tracker

# JWT Authentication
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRE=7d

# Redis (Upstash)
UPSTASH_REDIS_REST_URL=https://your-upstash-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_upstash_token

# CORS
CORS_ORIGIN=http://localhost:5173

# ML API
ML_API_URL=http://127.0.0.1:8000
```

### Running the Application

**Development mode with hot-reload:**
```sh
npm run dev
```

**Production mode:**
```sh
npm start
```

The API server will be available at `http://localhost:5000`.

## 📜 Available Scripts

-   `npm run dev`: Starts the server with nodemon for automatic restarts on file changes
-   `npm start`: Starts the server in production mode (no hot-reload)

## 🔐 Authentication Flow

1.  **Registration** (`POST /api/auth/register`):
    -   User submits name, email, password, monthlyBudget
    -   Password hashed with bcrypt (10 salt rounds)
    -   User document created in MongoDB
    -   JWT token generated and returned with user info
    -   User automatically logged in after registration

2.  **Login** (`POST /api/auth/login`):
    -   User submits email and password
    -   Password verified with bcrypt.compare()
    -   JWT token generated with 7-day expiry
    -   Returns token and user info

3.  **Protected Routes**:
    -   Client sends `Authorization: Bearer <token>` header
    -   Auth middleware verifies token with JWT_SECRET
    -   Decoded user info attached to `req.user`
    -   Invalid/expired tokens return 401 Unauthorized

## 📡 API Endpoints

### Authentication Routes (`/api/auth`)

| Method | Endpoint   | Description          | Auth Required |
|--------|------------|----------------------|---------------|
| POST   | `/register` | Create new user account | No |
| POST   | `/login`    | Login and get JWT token | No |

### User Routes (`/api/users`)

| Method | Endpoint   | Description                         | Auth Required |
|--------|------------|-------------------------------------|---------------|
| GET    | `/profile` | Get current user profile            | Yes |
| PATCH  | `/profile` | Update user profile                 | Yes |
| PATCH  | `/meta`    | Update user metadata (budget, type) | Yes |

### Expense Routes (`/api/expenses`)

| Method | Endpoint      | Description                      | Auth Required |
|--------|---------------|----------------------------------|---------------|
| GET    | `/`           | Get all expenses (paginated)     | Yes |
| POST   | `/`           | Create new expense               | Yes |
| PATCH  | `/:id`        | Update expense by ID             | Yes |
| DELETE | `/:id`        | Delete expense by ID             | Yes |

**Query Parameters for GET /api/expenses:**
-   `search` - Search in description
-   `category` - Filter by category
-   `startDate` - Filter expenses after date (ISO 8601)
-   `endDate` - Filter expenses before date (ISO 8601)

### Prediction Routes (`/api/predict`)

| Method | Endpoint   | Description                       | Auth Required |
|--------|------------|-----------------------------------|---------------|
| POST   | `/`        | Get ML-powered expense prediction | Yes |

**Request Body:**
```json
{
  "horizonDates": 3,
  "user_total_budget": 50000,
  "user_type": "young_professional"
}
```

**Parameters:**
-   `horizonDates` (number, 1-12, default: 1) - Number of months ahead to predict
-   `user_total_budget` (number, optional, default: user's monthlyBudget) - Monthly budget amount
-   `user_type` (string, optional, default: 'college_student') - User archetype for prediction

**Available User Types:**
-   `college_student`
-   `young_professional`
-   `family_moderate`
-   `family_high`
-   `luxury_lifestyle`
-   `senior_retired`

**Response:**
Returns category-wise expense predictions for the specified time horizon based on user's historical data and ML model forecasting.

## 🗄️ Database Schema

### User Model
```javascript
{
  name: String (required, trimmed),
  email: String (required, unique, lowercase),
  password: String (required, hashed, minlength: 6),
  monthlyBudget: Number (default: 0),
  userType: String (enum: ['college_student', 'young_professional', 'family_moderate', 
                           'family_high', 'luxury_lifestyle', 'senior_retired'], 
                   default: 'college_student'),
  createdAt: Date (auto),
  updatedAt: Date (auto)
}
```

**Methods:**
-   `comparePassword(candidatePassword)` - Compares plain text password with hashed password

### Expense Model
```javascript
{
  user: ObjectId (ref: 'User', required, indexed),
  amount: Number (required, min: 0),
  category: String (required, enum: [
    'Food & Drink', 'Travel', 'Utilities', 'Entertainment', 
    'Health & Fitness', 'Shopping', 'Rent', 'Other',
    'Salary', 'Investment', 'Clothing', 'Education', 'Personal Care'
  ], default: 'Other'),
  date: Date (required, default: Date.now),
  note: String (optional, trimmed, default: ''),
  createdAt: Date (auto),
  updatedAt: Date (auto)
}
```

**Indexes:**
-   Compound index on `user` and `date` for efficient queries

## 🛡️ Security Features

-   **Helmet.js:** Sets security-related HTTP headers (XSS protection, content security policy, etc.)
-   **Rate Limiting:** Redis-backed rate limiting to prevent brute force and DoS attacks
-   **Input Validation:** Zod schemas validate all incoming requests before processing
-   **Password Hashing:** bcrypt with 10 salt rounds for secure password storage
-   **JWT Tokens:** Signed tokens with expiry, verified on each protected route
-   **CORS:** Configured whitelist of allowed origins
-   **Error Obfuscation:** Production mode hides stack traces from API responses
-   **NoSQL Injection Prevention:** Mongoose sanitizes queries automatically

## 🔧 Middleware Pipeline

1.  **helmet()** → Security headers
2.  **express.json()** → Parse JSON bodies (1MB limit)
3.  **express.urlencoded()** → Parse URL-encoded bodies
4.  **morgan()** → HTTP request logging
5.  **cors()** → CORS policy enforcement
6.  **rateLimiter** → Redis-backed rate limiting (global and auth-specific)
7.  **validate()** → Zod schema validation (route-specific)
8.  **auth()** → JWT verification (protected routes only)
9.  **Controller** → Business logic execution
10. **errorHandler()** → Centralized error response formatting

## 🧪 Error Handling

All errors are handled by the global error handler middleware:

**Custom ApiError Format:**
```javascript
class ApiError extends Error {
  constructor(statusCode, message, extra = {}) {
    super(message);
    this.name = this.constructor.name;
    this.status = statusCode;           // used by error handler
    this.statusCode = statusCode;       // used elsewhere
    this.extra = extra;                 // optional payload
    Error.captureStackTrace(this, this.constructor);
  }
}
```

**Error Response Format:**
```json
{
  "success": false,
  "message": "Error message here",
  "details": "Additional error details (dev mode only, ZodError includes validation issues)"
}
```

**Example Validation Error (ZodError):**
```json
{
  "success": false,
  "message": "Validation Error",
  "details": [
    {
      "code": "invalid_type",
      "expected": "string",
      "received": "number",
      "path": ["email"],
      "message": "Expected string, received number"
    }
  ]
}
```

**Common Error Codes:**
-   `400` - Bad Request (validation failed)
-   `401` - Unauthorized (no/invalid token)
-   `404` - Not Found (resource doesn't exist)
-   `429` - Too Many Requests (rate limit exceeded)
-   `500` - Internal Server Error (unexpected errors)

## 🔗 ML API Integration

The backend acts as a proxy to the Python ML API with enhanced error handling:

-   **Endpoint:** `POST /api/predict`
-   **Caching:** Redis-backed response caching (production only) to reduce ML API load and improve response times
-   **Error Handling:** Catches ML API failures, returns user-friendly errors
-   **Fallback Logic:** Uses simple averaging when insufficient data for ML predictions (< 3 months)
-   **Authentication:** User must be authenticated; user_id injected from JWT token
-   **Validation:** Request body validated with Zod schema before forwarding
-   **Smart Guardrails:** ML predictions include 15% max change constraints for fixed-cost categories (Rent, Personal Care)

## 🧑‍💻 Author

-   **Sumeet Dutta** - Backend Developer
-   GitHub: [@SumeetDUTTA](https://github.com/SumeetDUTTA)
-   Project: [ExpenseKeeper](https://github.com/SumeetDUTTA/ExpenseKeeper)

## 📄 License

This project is licensed under the ISC License.
