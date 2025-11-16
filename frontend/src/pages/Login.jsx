import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { UserPlus, Mail, Lock, User, LoaderIcon, LogIn } from "lucide-react";
import toast from "react-hot-toast";

import { useAuth } from "../contexts/authContext";
import "../styles/LoginSignup.css";

export default function Login() {
	const { login, register } = useAuth();
	const nav = useNavigate();
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [action, setAction] = useState("Sign Up");


	async function submit(event) {
		event.preventDefault();
		setLoading(true);

		if (action === "Sign Up") {
			try {
				await register({ name, email, password });
				toast.success("Account created successfully!");
				nav("/");
			} catch (error) {
				console.error('Registration error:', error);
				toast.error(error.response?.data?.message || "Registration failed");
			} finally {
				setLoading(false);
			}
		} else if (action === "Login") {
			try {
				await login({ email, password });
				toast.success("Welcome back!");
				nav("/");
			} catch (error) {
				console.error('Login error:', error);
				toast.error(error.response?.data?.message || "Login failed");
			} finally {
				setLoading(false);
			}
		} else {
			setLoading(false);
		}
	}

	if (loading) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-base-200">
				<LoaderIcon size={44} className="animate-spin" />
			</div>
		);
	}
	return (
		<div className="container">
			<div className="header">
				<div className="text">{action}</div>
				<div className="underline"></div>
			</div>
			<form onSubmit={submit} className="form">
				<div className="inputs">
					{action === "Login" ? <div></div> :
						<div className="input">
							<User className="icon" />
							<input
								type="text"
								value={name}
								onChange={(e) => setName(e.target.value)}
								required
								placeholder="User Name" />
						</div>
					}
					<div className="input">
						<Mail className="icon" />
						<input
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							required
							placeholder="Email" />
					</div>
					<div className="input">
						<Lock className="icon" />
						<input
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							required
							placeholder="Password" />
					</div>
				</div>
				{action === "Login" && <div className="forgot-password">Lost password? <span>Click Here</span></div>}
				<div className="submit-container">
					<div className={action === "Sign Up" ? "submit gray" : "submit"} onClick={() => {
						setAction("Sign Up");
					}}><button className="button" type="submit"><UserPlus className="icon" />Sign Up</button></div>

					<div className={action === "Login" ? "submit gray" : "submit"} onClick={() => {
						setAction("Login");
					}}><button className="button" type="submit"><LogIn className="icon" />Login</button></div>
				</div>
			</form>
		</div>
	);
}