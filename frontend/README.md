# ExpenseKeeper Frontend

React-based web application for tracking expenses with real-time analytics and machine learning-powered predictions.

## 📝 Description

The ExpenseKeeper frontend is a modern, responsive single-page application that provides users with an intuitive interface to manage their personal finances. Built with React and Vite, it features a comprehensive dashboard with interactive charts, expense management tools, and predictive analytics powered by a machine learning backend. The application uses a custom design system with light/dark theme support, ensuring a consistent and accessible user experience across all devices.

## ✨ Features

-   **Landing Page:** Modern, informative home page for new users with project overview, features showcase, and step-by-step guide
-   **User Authentication:** JWT-based secure login and registration with persistent session management via Context API and localStorage
-   **Server Health Checks:** Automatic backend and ML server health checks with user-friendly toast notifications (30s backend, 45s ML server) to handle Render's auto-sleep behavior
-   **Responsive Design:** Mobile-first design using TailwindCSS and DaisyUI, fully responsive across desktop (1920px+), tablet (768px-1024px), and mobile (320px-768px) viewports
-   **Component-Based Architecture:** Modular React components with clear separation of concerns (pages, components, contexts, utilities)
-   **State Management:** React Context API for global auth state; local state management with hooks for component-specific data
-   **Client-Side Routing:** React Router v6 with protected routes, dynamic navigation, and programmatic redirects
-   **CRUD Operations:** Full expense lifecycle management—create, read, update, delete with instant UI feedback
-   **API Integration:** Axios-based HTTP client with request/response interceptors for auth tokens and error handling
-   **Form Handling & Validation:** Custom controlled forms with real-time validation, character limits, and user-friendly error messages
-   **Data Visualization:** Interactive charts using Recharts (line charts, pie charts, bar charts) with responsive containers and tooltips
-   **Predictive Analytics UI:** Multi-month expense forecasting with category breakdowns, confidence indicators, and budget comparison
-   **Theme System:** Light/dark mode toggle with CSS custom properties (design tokens) for consistent theming across all components
-   **Accessibility:** ARIA labels, keyboard navigation, screen reader support, and semantic HTML throughout
-   **Toast Notifications:** React Hot Toast for success/error feedback with custom styling
-   **Lazy Loading:** Intersection Observer for on-demand chart rendering on mobile devices to optimize performance

## 🛠️ Technologies Used

-   **Framework:** React 18.x with hooks (useState, useEffect, useMemo, useRef, useContext)
-   **Build Tool:** Vite 5.x for fast dev server and optimized production builds
-   **State Management:** React Context API for authentication, local state for UI
-   **Routing:** React Router v6 with NavLink, useNavigate, useLocation
-   **Styling:** TailwindCSS 3.x + DaisyUI for utility-first styling and component themes
-   **Charts:** Recharts for responsive, declarative data visualization
-   **Icons:** Lucide React for consistent, customizable SVG icons
-   **API Client:** Axios with interceptors for centralized request/response handling
-   **Notifications:** React Hot Toast for user feedback
-   **Package Manager:** npm

## 📂 Project Structure

```
frontend/
├── public/                  # Static assets served at root
├── src/
│   ├── assets/              # Images, icons, and media files
│   ├── components/          # Reusable UI components
│   │   ├── ErrorBoundary.jsx       # Error boundary for graceful failure handling
│   │   ├── expenseForm.jsx         # Form component for adding/editing expenses
│   │   ├── ExpenseNotFound.jsx     # 404 component for missing expenses
│   │   ├── navBar.jsx              # Navigation bar with theme toggle
│   │   ├── rateLimitedUI.jsx       # Rate limit feedback component
│   │   ├── popUp.jsx               # To change user budget and user type
│   │   └── ThemeSwitcher.jsx       # Theme toggle switch component
│   ├── contexts/            # React Context providers
│   │   └── authContext.jsx         # Authentication state management
│   ├── lib/                 # Shared utilities and configurations
│   │   └── api.js                  # Axios instance with interceptors
│   ├── pages/               # Page-level components
│   │   ├── addExpenses.jsx         # Add new expense page
│   │   ├── dashboard.jsx           # Main analytics dashboard
│   │   ├── HomePage.jsx            # Landing page for new users
│   │   ├── Login.jsx               # Login/Signup page
│   │   ├── Predict.jsx             # ML prediction interface
│   │   ├── Profile.jsx             # User profile and settings
│   │   └── showExpenses.jsx        # Expense list and analytics
│   ├── styles/              # Component-specific CSS modules
│   │   ├── AddExpense.css          # Add expense page styles
│   │   ├── Dashboard.css           # Dashboard page styles
│   │   ├── ExpenseForm.css         # Expense form component styles
│   │   ├── homePage.css            # Landing page styles
│   │   ├── LoginSignup.css         # Login/signup page styles
│   │   ├── NavBar.css              # Navigation bar styles
│   │   ├── popUp.css               # Modal/popup styles
│   │   ├── Predict.css             # Prediction page styles
│   │   ├── Profile.css             # Profile page styles
│   │   ├── showExpenses.css        # Expenses list page styles
│   │   ├── theme.css               # Theme-specific styles
│   │   └── ThemeSwitcher.css       # Theme toggle component styles
│   ├── App.jsx              # Main app component with routes
│   ├── App.css              # Global application styles
│   ├── index.css            # CSS reset, design tokens, base styles
│   └── main.jsx             # Application entry point
├── .gitignore               # Git ignore file
├── eslint.config.js         # ESLint configuration
├── index.html               # HTML template
├── package.json             # Dependencies and scripts
├── postcss.config.js        # PostCSS configuration
├── tailwind.config.js       # TailwindCSS configuration
├── vercel.json              # Vercel Configuration
├── vite.config.js           # Vite build configuration
└── README.md


```

## 🚀 Getting Started

Follow these instructions to get the frontend running locally.

### Prerequisites

-   Node.js (v16 or later)
-   npm or yarn
-   Backend API running on `http://localhost:5000` (see backend README)
-   ML API running on `http://127.0.0.1:8000` (see mlModel README)

### Installation

1.  Clone the repository:
    ```sh
    git clone https://github.com/SumeetDUTTA/ExepnseKeeper.git
    ```
2.  Navigate to the frontend directory:
    ```sh
    cd frontend
    ```
3.  Install dependencies:
    ```sh
    npm install
    ```

### Configuration

Create a `.env` file in the frontend directory (optional):
```env
VITE_API_TARGET=http://localhost:5000
VITE_ML_API_URL=http://127.0.0.1:8000
```

If no `.env` file is provided, the app defaults to `http://localhost:5000` for the backend API and `http://127.0.0.1:8000` for the ML API.

API configuration is handled in `src/lib/api.js` using the `VITE_API_TARGET` environment variable.

### Running the Application

Start the Vite development server:
```sh
npm run dev
```
The application will be available at `http://localhost:5173`.

## 📜 Available Scripts

-   `npm run dev`: Starts Vite dev server with hot module replacement on port 5173
-   `npm run build`: Builds production-optimized bundle to `dist/` folder
-   `npm run preview`: Previews production build locally
-   `npm run lint`: Runs ESLint to check code quality

## 🎨 Theme System

The application uses CSS custom properties (design tokens) for theming. All colors, shadows, and spacing are defined in `src/index.css`:

**Design Tokens:**
-   `--bg-primary`, `--bg-secondary`: Background colors
-   `--text-primary`, `--text-secondary`, `--text-muted`: Text colors
-   `--accent-primary`, `--accent-secondary`: Accent colors
-   `--card-bg`, `--panel`, `--glass`: Surface colors
-   `--border-color`: Border and divider colors
-   `--shadow-sm`, `--shadow-md`, `--shadow-lg`: Shadow levels

**Theme Toggle:**
Users can switch between light and dark themes using the sun/moon icon in the navbar. Theme preference is persisted to localStorage.

## 🔒 Authentication Flow

1.  New user visits `/` → Sees landing page with project overview and features
2.  User clicks "Get Started" or "Login" → Redirected to `/login`
3.  Login page checks backend health (`/health`) → Shows 35-second wait toast if server sleeping → Auto-retries after 30 seconds
4.  User registers or logs in → Backend validates → Returns JWT token
5.  Token stored in localStorage and AuthContext
6.  User auto-redirected to `/dashboard` after successful login
7.  Protected routes check auth status → Redirect to `/login` if unauthenticated
8.  All API requests include `Authorization: Bearer <token>` header
9.  Token refresh handled by backend (7-day expiry)
10. Logout clears localStorage and redirects to login
11. Authenticated users trying to access `/` are auto-redirected to `/dashboard`

## 📊 Key Pages

### Home Page (`/`)
-   Landing page for new/non-authenticated users
-   Hero section with project overview and value proposition
-   Feature showcase: Expense Tracking, AI Predictions, Visual Analytics, Budget Planning
-   Step-by-step guide: Sign Up → Track Expenses → Get AI Insights
-   Detailed feature breakdown showing what users will experience
-   Technology stack showcase (React, Node.js, MongoDB, XGBoost)
-   Call-to-action sections for user registration
-   Responsive design with purple gradient theme
-   Auto-redirects authenticated users to dashboard

### Dashboard (`/dashboard`)
-   Overview cards: Total Expenses, Budget Status, Expense Distribution
-   Monthly trend line chart with category breakdown
-   Category-wise expense pie chart
-   Top 5 recent expenses table

### Add Expense (`/add-expense`)
-   Expense form with amount, category, description, date
-   Client-side validation with character limits
-   Budget warning if exceeding monthly limit
-   Success toast with redirect to expenses list

### Show Expenses (`/expenses`)
-   Searchable, filterable expense table with pagination
-   Monthly expense line chart with interactive brush
-   Category distribution pie chart with percentages and color-coded segments
-   Period breakdown table showing spending by time interval
-   Edit/delete actions with confirmation dialogs

### Predict (`/predict`)
-   ML server health check on page load with 50-second wait toast if server sleeping
-   Automatic retry after 45 seconds with success notification
-   Full-screen loading overlay during ML server initialization
-   ML-powered expense forecasting for 1-3 months ahead
-   User budget and profile configuration with popup modal
-   Category-wise prediction breakdown with visual progress bars
-   Monthly predictions showing expected spending per category
-   Total predicted expense summary with comparison to budget
-   Smart guardrails ensure realistic predictions (15% max change for fixed costs)
-   Predict button disabled until ML server is ready

### Profile (`/profile`)
-   User info display (name, email, account creation date)
-   Monthly budget configuration
-   Theme toggle and preferences
-   Expense statistics (total count, average, highest/lowest)

## 🧑‍💻 Author

-   **Sumeet Dutta** - Full-Stack Developer
-   GitHub: [@SumeetDUTTA](https://github.com/SumeetDUTTA)
-   Project: [ExpenseKeeper](https://github.com/SumeetDUTTA/ExpenseKeeper)