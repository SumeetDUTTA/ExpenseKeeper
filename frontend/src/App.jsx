import "./App.css";

import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";

import Login from "./pages/Login";
import ShowExpenses from "./pages/showExpenses.jsx";
import Predict from "./pages/Predict";
import Profile from "./pages/Profile";
import Dashboard from "./pages/dashboard";
import { useAuth } from "./contexts/authContext";
import NavBar from "./components/navBar";
import AddExpense from "./pages/addExpenses";
import ErrorBoundary from "./components/ErrorBoundary";

function Private({ children }) {
  const { token } = useAuth()
  return token ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <ErrorBoundary>
      <div className="relative">
        {/* Background gradient */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#363636',
              color: '#fff',
              borderRadius: '12px',
              boxShadow: '0 8px 16px rgba(0, 0, 0, 0.15)',
            },
            success: {
              duration: 3000,
              iconTheme: {
                primary: '#10b981',
                secondary: '#fff',
              },
            },
            error: {
              duration: 4000,
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />

        <NavBar />
        <Routes>
          <Route path="/" element={<Private><Dashboard /></Private>} />
          <Route path="/login" element={<Login />} />
          <Route path="/expenses" element={<Private><ShowExpenses /></Private>} />
          <Route path="/add-expense" element={<Private><AddExpense /></Private>} />
          <Route path="/predict" element={<Private><Predict /></Private>} />
          <Route path="/profile" element={<Private><Profile /></Private>} />
        </Routes>
      </div>
    </ErrorBoundary>
  )
}