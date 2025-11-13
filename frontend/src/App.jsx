import React from "react";
import { Routes, Route, Link, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Expenses from "./pages/Expenses";
import Predict from "./pages/Predict";
import Profile from "./pages/Profile";
import { useAuth } from "./contexts/authContext.jsx";
import NavBar from "./components/navBar.jsx";
import ExpenseHistory from "./pages/expenseHistory.jsx";

function Private({ children }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" />
}

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />

      <main className="max-w-6xl mx-auto p-4">
        <Routes>
          <Route path="/" element={<div className="text-lg">Welcome to ExpenseKeeper — check Expenses to see your data.</div>} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/expenses" element={<Private><Expenses /></Private>} />
          <Route path="/expense-history" element={<Private><ExpenseHistory /></Private>} />
          <Route path="/predict" element={<Private><Predict /></Private>} />
          <Route path="/profile" element={<Private><Profile /></Private>} />
        </Routes>
      </main>
    </div>
  )
}