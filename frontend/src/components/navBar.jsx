import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/authContext.jsx";

export default function NavBar() {
	const { user, logout } = useAuth();

	return (
		<header className="bg-white/60 backdrop-blur sticky top-0 z-30 shadow-sm">
			<div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
				<div className="flex items-center gap-3">
					<Link to="/" className="inline-flex items-center gap-2">
						<div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white font-bold shadow">
							EK
						</div>
						<div>
							<div className="text-lg font-semibold">ExpenseKeeper</div>
							<div className="text-xs text-gray-500">Smart spending, simple UI</div>
						</div>
					</Link>
				</div>

				<nav className="flex items-center gap-4">
					<Link to="/" className="text-sm text-gray-600 hover:text-gray-900">Home</Link>
					<Link to="/expenses" className="text-sm text-gray-600 hover:text-gray-900">Expenses</Link>
					<Link to="/expense-history" className="text-sm text-gray-600 hover:text-gray-900">SpendPulse</Link>
					<Link to="/predict" className="text-sm text-gray-600 hover:text-gray-900">Predict</Link>

					{user ? (
						<>
							<Link to="/profile" className="text-sm px-3 py-1 rounded-md bg-indigo-50 text-indigo-700 hover:bg-indigo-100">Hi, {user.name?.split(' ')[0] || 'User'}</Link>
							<button onClick={logout} className="text-sm px-3 py-1 rounded-md bg-red-50 text-red-600 hover:bg-red-100">Logout</button>
						</>
					) : (
						<>
							<Link to="/login" className="text-sm px-3 py-1 rounded-md border border-gray-200 hover:bg-gray-50">Login</Link>
							<Link to="/register" className="text-sm px-3 py-1 rounded-md bg-indigo-600 text-white hover:brightness-95">Register</Link>
						</>
					)}
				</nav>
			</div>
		</header>
	)
}