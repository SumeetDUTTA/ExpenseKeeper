/* eslint-disable no-unused-vars */
import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
	UserPlus, Mail, Lock, User, LogIn, Eye, EyeOff,
	LoaderCircle, Check
} from "lucide-react";
import toast from "react-hot-toast";

import { useAuth } from "../contexts/authContext";
import "../styles/LoginSignup.css";

/**
 * Frontend password validation uses the exact same rule as backend:
 *   - min 6 chars (backend uses .min(6))
 *   - at least 1 uppercase letter
 *   - at least 1 digit
 *   - at least 1 special char from @$!%*?&
 *
 * Regex mirror (from backend authValidator.js):
 * /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,}$/
 */

const BACKEND_PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,}$/;

export default function Login() {
	const { login, register } = useAuth();
	const nav = useNavigate();

	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [mode, setMode] = useState("signup");
	const [showPassword, setShowPassword] = useState(false);
	const [remember, setRemember] = useState(false);
	const [serverChecking, setServerChecking] = useState(true);
	const [serverAwake, setServerAwake] = useState(false);
	const [mlServerChecking, setMlServerChecking] = useState(true)
	const [mlServerAwake, setMlServerAwake] = useState(false)

	// Check if backend server is awake on component mount
	React.useEffect(() => {
		async function checkMLServerHealth() {
			try {
				const controller = new AbortController();
				const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout for ML server

				const mlApiUrl = import.meta.env.VITE_ML_API_URL || "http://localhost:8000";
				const response = await fetch(`${mlApiUrl}/docs`, {
					method: 'GET',
					signal: controller.signal
				});

				clearTimeout(timeoutId);

				if (response.ok) {
					setMlServerAwake(true);
				} else {
					throw new Error('ML server not responding');
				}
			} catch (err) {
				// ML server is sleeping or unreachable
				setMlServerAwake(false);
				toast.loading(
					'ML prediction server is starting up. This may take 40-60 seconds. Please wait...',
					{
						duration: 50000,
						icon: '🤖',
						id: 'ml-server-wake-toast'
					}
				);

				// Retry after 45 seconds
				setTimeout(async () => {
					try {
						const mlApiUrl = import.meta.env.VITE_ML_API_URL || "http://localhost:8000";
						const retryResponse = await fetch(`${mlApiUrl}/docs`);
						if (retryResponse.ok) {
							setMlServerAwake(true);
							toast.dismiss('ml-server-wake-toast');
							toast.success('ML server is ready! You can now generate predictions.');
						} else {
							toast.dismiss('ml-server-wake-toast');
							toast.error('ML server is still starting. Please wait a bit longer and refresh.');
						}
					} catch {
						toast.dismiss('ml-server-wake-toast');
						toast.error('Unable to reach ML server. Please check your connection or try again later.');
					}
				}, 45000);
			} finally {
				setMlServerChecking(false);
			}
		}

		checkMLServerHealth();
	}, []);

	React.useEffect(() => {

		async function checkServerHealth() {
			try {
				const controller = new AbortController();
				const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

				const response = await fetch(`${import.meta.env.VITE_API_TARGET || "http://localhost:5000"}/health`, {
					method: 'GET',
					signal: controller.signal
				});

				clearTimeout(timeoutId);

				if (response.ok) {
					setServerAwake(true);
				} else {
					throw new Error('Server not responding');
				}
			} catch (error) {
				// Server is sleeping or unreachable
				setServerAwake(false);
				toast.loading(
					'Backend server is starting up. Please wait 30-45 seconds...',
					{
						duration: 35000,
						icon: '⏳',
						id: 'server-wake-toast'
					}
				);

				// Retry after 30 seconds
				setTimeout(async () => {
					try {
						const retryResponse = await fetch(`${import.meta.env.VITE_API_TARGET || "http://localhost:5000"}/health`);
						if (retryResponse.ok) {
							setServerAwake(true);
							toast.dismiss('server-wake-toast');
							toast.success('Server is ready! You can now login or signup.');
						} else {
							toast.dismiss('server-wake-toast');
							toast.error('Server is still waking up. Please try again in a moment.');
						}
					} catch {
						toast.dismiss('server-wake-toast');
						toast.error('Unable to reach server. Please check your connection.');
					}
				}, 30000);
			} finally {
				setServerChecking(false);
			}
		}

		checkServerHealth();
	}, []);

	// Derived validation flags (displayed live)
	const validations = useMemo(() => {
		const hasMinLen = password.length >= 6;
		const hasUpper = /[A-Z]/.test(password);
		const hasDigit = /\d/.test(password);
		const hasSpecial = /[@$!%*?&]/.test(password);
		const matchesBackend = BACKEND_PASSWORD_REGEX.test(password);
		return { hasMinLen, hasUpper, hasDigit, hasSpecial, matchesBackend };
	}, [password]);

	const isValid = () => {
		if (!email || !password) return false;
		if (mode === "signup") {
			if (!name) return false;
			// For signup require password to match backend rules
			if (!validations.matchesBackend) return false;
		}
		return true;
	};

	async function submit(event) {
		event.preventDefault();
		if (!isValid()) {
			// show appropriate helpful message
			if (mode === "signup" && !validations.matchesBackend) {
				toast.error("Password does not meet requirements. See the checklist.");
				return;
			}
			toast.error("Please fill required fields");
			return;
		}

		// Check if ML server is awake before attempting prediction
		if (!mlServerAwake) {
			toast.error("ML server is still starting up. Please wait a moment and try again.", {
				duration: 5000,
				icon: '⏳'
			});
			return;
		}

		// Check if server is awake before attempting login/signup
		if (!serverAwake) {
			toast.error("Backend server is still starting. Please wait a moment and try again.", {
				duration: 5000
			});
			return;
		}

		setLoading(true);
		try {
			if (mode === "signup") {
				const res = await register({ name, email, password });
				// server may return structured validation error - show it
				if (res?.data?.success === false && res?.data?.errors) {
					const serverMsg = res.data.errors.map(e => e.message).join(" ");
					console.error(serverMsg);
					toast.error("Server validation error. Please check your input.");
					setLoading(false);
					return;
				}
				toast.success("Account created!");
			} else {
				const res = await login({ email, password, remember });
				// login() handles toasts for network errors; but show success
				if (res?.data?.token) toast.success("Welcome back!");
			}
			nav("/dashboard");
		} catch (err) {
			// handle axios structured errors gracefully
			const serverMessage = err?.response?.data?.message;
			const fieldErrors = err?.response?.data?.errors;
			if (fieldErrors && Array.isArray(fieldErrors)) {
				const serverMsg = fieldErrors.map(e => e.message).join(" ");
				console.error("Field errors:", serverMsg);
				toast.error("Server validation error. Please check your input.");
			} else if (serverMessage) {
				console.error("Server error:", serverMessage);
				toast.error("Server validation error. Please check your input.");
			} else {
				toast.error("Something went wrong");
			}
		} finally {
			setLoading(false);
		}
	}

	if (loading || serverChecking || mlServerChecking) {
		return (
			<div className="loader-screen" role="status" aria-live="polite">
				<div style={{ textAlign: 'center' }}>
					<LoaderCircle size={48} className="animate-spin" />
					<div style={{ marginTop: 8, color: 'var(--muted)' }}>
						{serverChecking ? 'Checking server status...' : 'Loading Dashboard...'}
					</div>
				</div>
			</div>
		);
	}

	return (
		<main className="screen">
			<div className="container">

				<header className="header">
					<div className="title-wrapper">
						<h1 className="text">
							{mode === "signup" ? "Create Account" : "Welcome Back"}
						</h1>
						<div className="underline" />
					</div>
					<p className="subtitle">
						{mode === "signup"
							? "Track your spending smarter in just a minute."
							: "Sign in to access your dashboard."}
					</p>
				</header>

				<section className="card">

					{/* TABS */}
					<div className="tabs">
						<button
							className={`tab ${mode === "signup" ? "active" : ""}`}
							onClick={() => setMode("signup")}
							type="button"
						>
							<UserPlus size={16} /> Sign up
						</button>

						<button
							className={`tab ${mode === "login" ? "active" : ""}`}
							onClick={() => setMode("login")}
							type="button"
						>
							<LogIn size={16} /> Login
						</button>
					</div>

					<form onSubmit={submit} className="form">

						{mode === "signup" && (
							<label className="input">
								<User className="icon" />
								<input
									type="text"
									placeholder="Full name"
									value={name}
									onChange={(e) => setName(e.target.value)}
								/>
							</label>
						)}

						<label className="input">
							<Mail className="icon" />
							<input
								type="email"
								placeholder="Email address"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
							/>
						</label>

						<label className="input input-with-action" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
							<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
								<Lock className="icon" />
								<input
									type={showPassword ? "text" : "password"}
									placeholder="Password"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									style={{ flex: 1 }}
								/>
								<button
									type="button"
									className="icon-action"
									onClick={() => setShowPassword((v) => !v)}
									aria-label={showPassword ? "Hide password" : "Show password"}
								>
									{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
								</button>
							</div>

							{/* Password requirements checklist (visible for signup) */}
							{mode === "signup" && (
								<div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
									<div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
										<input
											type="checkbox"
											checked={validations.matchesBackend}
											readOnly
											disabled
											aria-label="Password meets backend standards"
										/>
										<span style={{ fontSize: 13 }}>
											Password meets backend standards
										</span>
									</div>

									{/* Detailed small checklist */}
									<div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
										<SmallChecklistItem ok={validations.hasMinLen} text="Min 6 characters" />
										<SmallChecklistItem ok={validations.hasUpper} text="Uppercase letter (A-Z)" />
										<SmallChecklistItem ok={validations.hasDigit} text="Number (0-9)" />
										<SmallChecklistItem ok={validations.hasSpecial} text="Special char (@$!%*?&)" />
									</div>
								</div>
							)}
						</label>

						{/* Remember me visible only on login */}
						{mode === "login" && (
							<label className="checkbox-label">
								<input
									type="checkbox"
									checked={remember}
									onChange={(e) => setRemember(e.target.checked)}
								/>
								Remember me
							</label>
						)}

						{/* Show helpful prompt */}
						{!isValid() && (
							<div className="error-text">
								{mode === "signup" ? "Please fill required fields and ensure password meets requirements." : "Please fill required fields."}
							</div>
						)}

						<button
							className="submit"
							type="submit"
							disabled={!isValid() || !serverAwake}
						>
							{mode === "signup" ? "Create account" : "Login"}
						</button>

						{/* Server status indicator */}
						{!serverAwake && !serverChecking && (
							<div style={{
								padding: '12px',
								borderRadius: '8px',
								background: 'rgba(251, 191, 36, 0.1)',
								border: '1px solid rgba(251, 191, 36, 0.3)',
								fontSize: '14px',
								color: 'var(--text-primary)',
								textAlign: 'center'
							}}>
								⏳ Server is waking up. Please wait...
							</div>
						)}
					</form>

				</section>

				<footer className="small-footer">
					<span>Made with ❤️</span>
					<span className="version">v1.0</span>
				</footer>

			</div>
		</main>
	);
}

/* small helper component inside same file for checklist UI */
function SmallChecklistItem({ ok, text }) {
	return (
		<div style={{
			display: 'inline-flex',
			alignItems: 'center',
			gap: 6,
			fontSize: 13,
			color: ok ? 'var(--text-primary)' : 'var(--text-muted)',
			padding: '6px 8px',
			borderRadius: 8,
			border: `1px solid ${ok ? 'transparent' : 'var(--border-color)'}`,
			background: ok ? 'rgba(34,197,94,0.06)' : 'transparent',
			minWidth: 140
		}}>
			{ok ? <Check size={14} /> : <span style={{ width: 14, height: 14 }} />}
			<span>{text}</span>
		</div>
	);
}
