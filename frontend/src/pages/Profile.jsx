import React, { useState, useEffect, useMemo } from "react";
import { User, Mail, Wallet, Settings, Save, LoaderCircle, Check, Eye, EyeOff } from "lucide-react";
import toast from "react-hot-toast";

import { useAuth } from "../contexts/authContext";
import api from "../lib/api";
import "../styles/Profile.css"

export default function Profile() {
	const { user, logout, updateProfile } = useAuth();
	const [profile, setProfile] = useState(null);
	const [loading, setLoading] = useState(false);
	const [editing, setEditing] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const [showCurrentPassword, setShowCurrentPassword] = useState(false);
	const [showNewPassword, setShowNewPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);
	const [editingBasicInfo, setEditingBasicInfo] = useState(false);
	const [editingPassword, setEditingPassword] = useState(false);
	const [name, setName] = useState(user?.name || "");
	const [email, setEmail] = useState(user?.email || "");
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [monthlyBudget, setMonthlyBudget] = useState("");
	const [userType, setUserType] = useState("");

	const allowedUserTypes = [
		{ value: 'college_student', label: 'College Student' },
		{ value: 'young_professional', label: 'Young Professional' },
		{ value: 'family_moderate', label: 'Family (Moderate)' },
		{ value: 'family_high', label: 'Family (High Income)' },
		{ value: 'luxury_lifestyle', label: 'Luxury Lifestyle' },
		{ value: 'senior_retired', label: 'Senior/Retired' }
	];

	// Password validation checks
	const passwordValidations = useMemo(() => {
		const BACKEND_PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,}$/;
		const hasMinLen = newPassword.length >= 6;
		const hasUpper = /[A-Z]/.test(newPassword);
		const hasDigit = /\d/.test(newPassword);
		const hasSpecial = /[@$!%*?&]/.test(newPassword);
		const matchesBackend = BACKEND_PASSWORD_REGEX.test(newPassword);
		return { hasMinLen, hasUpper, hasDigit, hasSpecial, matchesBackend };
	}, [newPassword]);

	async function fetchProfile() {
		setLoading(true);
		try {
			const res = await api.get("/api/user/profile");
			const userData = res.data.user || res.data;
			setProfile(userData);
			setMonthlyBudget(userData.monthlyBudget || "");
			setUserType(userData.userType || "");
			setName(userData.name || "");
			setEmail(userData.email || "");
		} catch (error) {
			console.error("Fetch profile error:", error);
			toast.error(error.response?.data?.message || "Failed to fetch profile");
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		// Fetch profile on mount or when user changes
		if (user) {
			fetchProfile();
		}
	}, [user]);

	async function updateBasicInfo(e) {
		e.preventDefault();
		const updates = {};
		if (name && name !== profile?.name) updates.name = name;
		if (email && email !== profile?.email) updates.email = email;

		if (!Object.keys(updates).length) {
			toast.error("No changes to update");
			return;
		}
		try {
			await updateProfile(updates);
			await fetchProfile();
			setEditingBasicInfo(false);
		} catch (error) {
			console.error("Basic info update error:", error);
		}
	}

	async function handlePasswordUpdate(e) {
		e.preventDefault();

		if (!currentPassword || !newPassword || !confirmPassword) {
			toast.error("Please fill in all password fields");
			return;
		}

		if (newPassword !== confirmPassword) {
			toast.error("New passwords do not match");
			return;
		}

		if (!passwordValidations.matchesBackend) {
			toast.error("Password does not meet requirements. See the checklist.");
			return;
		}

		try {
			await updateProfile({
				currentPassword,
				password: newPassword
			});
			setCurrentPassword("");
			setNewPassword("");
			setConfirmPassword("");
			setEditingPassword(false);
		} catch (error) {
			console.error("Password update error:", error);
		}
	}

	async function updateBudget(e) {
		e.preventDefault();
		try {
			const payload = {};

			if (monthlyBudget !== "") {
				payload.monthlyBudget = Number(monthlyBudget);
			}

			if (userType !== "") {
				payload.userType = userType;
			}

			if (Object.keys(payload).length === 0) {
				toast.error("Please enter a budget or select a user type");
				return;
			}

			await updateProfile(payload);
			// Refresh profile data
			await fetchProfile();
			setEditing(false);
		} catch (error) {
			console.error("Update error:", error);
		}
	}

	async function deleteAccount(e) {
		if (e) e.preventDefault();
		if (deleting) return;
		const confirmDelete = window.confirm(
			"This will permanently delete your account and data. Are you sure?"
		);
		if (!confirmDelete) return;
		setDeleting(true);
		try {
			const res = await api.delete("/api/user/profile/delete");
			if (res.data.success) {
				// Log out the user after deletion
				logout();
				window.location.href = "/login";
				if (location.pathname === "/login") {
					toast.success("Account deleted successfully.");
				}
			}
		} catch (error) {
			console.error("Delete account error:", error);
			toast.error(error.response?.data?.message || "Failed to delete account");
		} finally {
			setDeleting(false);
		}
	}

	if (loading && !profile) {
		return (
			<div className="loader-screen" role="status" aria-live="polite">
				<div style={{ textAlign: 'center' }}>
					<LoaderCircle size={48} className="animate-spin" />
					<div style={{ marginTop: 8, color: 'var(--muted)' }}>Loading...</div>
				</div>
			</div>
		);
	}

	return (
		<div className="profile-page-container">
			<div className="profile-header-card">
				<div>
					<h2 className="profile-header-title">Profile</h2>
					<p className="profile-header-subtitle">Manage your account and preferences</p>
				</div>
			</div>

			{/* Profile Card */}
			<div className="profile-main-card">
				<div className="card-body">
					<div className="profile-overview">
						<div className="profile-avatar">
							<div className="avatar-placeholder">
								<span className="profile-avatar-initial">{profile?.name?.charAt(0).toUpperCase() || 'U'}</span>
							</div>
						</div>
					</div>

					<div className="profile-divider"></div>

					<div className="profile-details-grid">
						<div className="profile-detail-item">
							<div className="profile-detail-icon">
								<User className="user-icon" size={24} />
							</div>
							<div className="profile-detail-text">
								<p className="profile-detail-label">Full Name</p>
								<p className="profile-detail-value">{profile?.name || '—'}</p>
							</div>
						</div>

						<div className="profile-detail-item">
							<div className="profile-detail-icon">
								<Mail className="user-icon" size={24} />
							</div>
							<div className="profile-detail-text">
								<p className="profile-detail-label">Email</p>
								<p className="profile-detail-value">{profile?.email || '—'}</p>
							</div>
						</div>

						<div className="profile-detail-item">
							<div className="profile-detail-icon">
								<Wallet className="user-icon" size={24} />
							</div>
							<div className="profile-detail-text">
								<p className="profile-detail-label">Account Type</p>
								<p className="profile-detail-value">
									{allowedUserTypes.find(t => t.value === profile?.userType)?.label || 'Not Set'}
								</p>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Basic Information Edit Card */}
			<div className="budget-settings-card">
				<div className="card-body">
					<h3 className="budget-settings-title">
						<User size={28} className="user-icon" />
						Basic Information
					</h3>
					<p className="budget-settings-subtitle">
						Update your name and email address
					</p>

					{editingBasicInfo ? (
						<form onSubmit={updateBasicInfo} className="budget-form">
							<div className="monthly-budget-field">
								<label className="monthly-budget-label">
									Full Name
								</label>
								<input
									type="text"
									placeholder="Enter your full name"
									value={name}
									onChange={(e) => setName(e.target.value)}
									className="monthly-budget-input"
									required
								/>
							</div>

							<div className="monthly-budget-field">
								<label className="monthly-budget-label">
									Email Address
								</label>
								<input
									type="email"
									placeholder="Enter your email"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									className="monthly-budget-input"
									required
								/>
							</div>

							<div className="budget-form-actions">
								<button type="submit" className="budget-form-submit">
									<Save size={20} />
									Save Changes
								</button>
								<button
									type="button"
									onClick={() => {
										setEditingBasicInfo(false);
										setName(profile?.name || "");
										setEmail(profile?.email || "");
									}}
									className="budget-form-cancel"
								>
									Cancel
								</button>
							</div>
						</form>
					) : (
						<div className="budget-display-grid">
							<div className="budget-display-card">
								<div className="budget-display-content">
									<div>
										<p className="budget-display-label">Name</p>
										<h3 className="budget-display-value" style={{ fontSize: '18px' }}>
											{profile?.name || 'Not Set'}
										</h3>
									</div>
								</div>
							</div>
							<div className="budget-display-card">
								<div className="budget-display-content">
									<div>
										<p className="budget-display-label">Email</p>
										<h3 className="budget-display-value" style={{ fontSize: '16px', wordBreak: 'break-word' }}>
											{profile?.email || 'Not Set'}
										</h3>
									</div>
								</div>
							</div>
							<button
								onClick={() => setEditingBasicInfo(true)}
								className="budget-form-submit"
								style={{ gridColumn: '1 / -1', marginTop: '12px' }}
							>
								<Settings size={20} />
								Edit Information
							</button>
						</div>
					)}
				</div>
			</div>

			{/* Password Update Card - Only for local auth users */}
			{profile?.authProvider === 'local' && (
				<div className="budget-settings-card">
					<div className="card-body">
						<h3 className="budget-settings-title">
							<Settings size={28} className="user-icon" />
							Change Password
						</h3>
						<p className="budget-settings-subtitle">
							Update your account password for better security
						</p>

						{editingPassword ? (
							<form onSubmit={handlePasswordUpdate} className="budget-form">
								<div className="monthly-budget-field">
									<label className="monthly-budget-label">
										Current Password
									</label>
									<div className="password-input-wrapper">
										<input
											type={showCurrentPassword ? "text" : "password"}
											placeholder="Enter current password"
											value={currentPassword}
											onChange={(e) => setCurrentPassword(e.target.value)}
											className="monthly-budget-input"
											required
										/>
										<button
											type="button"
											className="password-toggle-btn"
											onClick={() => setShowCurrentPassword((v) => !v)}
											aria-label={showCurrentPassword ? "Hide password" : "Show password"}
										>
											{showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
										</button>
									</div>
								</div>					<div className="monthly-budget-field">
									<label className="monthly-budget-label">
										New Password
									</label>
									<div className="password-input-wrapper">
										<input
											type={showNewPassword ? "text" : "password"}
											placeholder="Enter new password (min 6 characters)"
											value={newPassword}
											onChange={(e) => setNewPassword(e.target.value)}
											className="monthly-budget-input"
											required
											minLength={6}
										/>
										<button
											type="button"
											className="password-toggle-btn"
											onClick={() => setShowNewPassword((v) => !v)}
											aria-label={showNewPassword ? "Hide password" : "Show password"}
										>
											{showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
										</button>
									</div>									{/* Password requirements checklist */}
									<div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
										<div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
											<input
												type="checkbox"
												checked={passwordValidations.matchesBackend}
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
											<SmallChecklistItem ok={passwordValidations.hasMinLen} text="Min 6 characters" />
											<SmallChecklistItem ok={passwordValidations.hasUpper} text="Uppercase letter (A-Z)" />
											<SmallChecklistItem ok={passwordValidations.hasDigit} text="Number (0-9)" />
											<SmallChecklistItem ok={passwordValidations.hasSpecial} text="Special char (@$!%*?&)" />
										</div>
									</div>
								</div>

								<div className="monthly-budget-field">
									<label className="monthly-budget-label">
										Confirm New Password
									</label>
									<div className="password-input-wrapper">
										<input
											type={showConfirmPassword ? "text" : "password"}
											placeholder="Confirm new password"
											value={confirmPassword}
											onChange={(e) => setConfirmPassword(e.target.value)}
											className="monthly-budget-input"
											required
											minLength={6}
										/>
										<button
											type="button"
											className="password-toggle-btn"
											onClick={() => setShowConfirmPassword((v) => !v)}
											aria-label={showConfirmPassword ? "Hide password" : "Show password"}
										>
											{showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
										</button>
									</div>
								</div>
								<div className="budget-form-actions">
									<button type="submit" className="budget-form-submit">
										<Save size={20} />
										Update Password
									</button>
									<button
										type="button"
										onClick={() => {
											setEditingPassword(false);
											setCurrentPassword("");
											setNewPassword("");
											setConfirmPassword("");
										}}
										className="budget-form-cancel"
									>
										Cancel
									</button>
								</div>
							</form>
						) : (
							<button
								onClick={() => setEditingPassword(true)}
								className="budget-form-submit"
								style={{ marginTop: '12px' }}
							>
								<Settings size={20} />
								Change Password
							</button>
						)}
					</div>
				</div>
			)}

			{/* Budget Settings */}
			<div className="budget-settings-card">
				<div className="card-body">
					<h3 className="budget-settings-title">
						<Wallet size={28} className="user-icon" />
						Budget & Settings
					</h3>
					<p className="budget-settings-subtitle">
						Set your monthly spending limit and account type to personalize your experience
					</p>

					<div style={{ marginLeft: 'auto' }}>
					</div>

					{editing ? (
						<form onSubmit={updateBudget} className="budget-form">
							{/* Monthly Budget */}
							<div className="monthly-budget-field">
								<label className="monthly-budget-label">
									Monthly Budget (₹)
								</label>
								<div className="monthly-budget-input-wrapper">
									<span className="monthly-budget-currency">₹</span>
									<input
										type="number"
										step="0.01"
										min="0"
										placeholder="Enter your monthly budget"
										value={monthlyBudget}
										onChange={(e) => setMonthlyBudget(e.target.value)}
										className="monthly-budget-input"
									/>
								</div>
								<p className="monthly-budget-helptext">
									This helps you monitor your spending habits
								</p>
							</div>

							{/* User Type */}
							<div className="user-type-field">
								<label className="user-type-label">
									Account Type
								</label>
								<select
									value={userType}
									onChange={(e) => setUserType(e.target.value)}
									className="user-type-select"
								>
									<option value="">Select Account Type</option>
									{allowedUserTypes.map((type) => (
										<option key={type.value} value={type.value}>
											{type.label}
										</option>
									))}
								</select>
								<p className="user-type-helptext">
									Select the type that best describes your spending profile
								</p>
							</div>

							<div className="budget-form-actions">
								<button type="submit" className="budget-form-submit">
									<Save size={20} />
									Save Changes
								</button>
								<button
									type="button"
									onClick={() => setEditing(false)}
									className="budget-form-cancel"
								>
									Cancel
								</button>
							</div>
						</form>
					) : (
						<div className="budget-display-grid">
							{/* Budget Display */}
							<div className="budget-display-card">
								<div className="budget-display-content">
									<div>
										<p className="budget-display-label">Current Monthly Budget</p>
										<h2 className="budget-display-value">
											₹{profile?.monthlyBudget ? Number(profile.monthlyBudget).toFixed(2) : '0.00'}
										</h2>
										<p className="budget-display-helptext">
											{profile?.monthlyBudget ? '✓ Active budget limit' : '⚠ No budget set yet'}
										</p>
									</div>
									<div className="budget-display-icon">
										<Wallet size={48} />
									</div>
								</div>
							</div>

							{/* User Type Display */}
							<div className="budget-display-card">
								<div className="budget-display-content">
									<div className="budget-display-icon">
										<User size={32} />
									</div>
									<div className="budget-display-label">Account Type</div>
									<div className="budget-display-value">
										{allowedUserTypes.find(t => t.value === profile?.userType)?.label || 'Not Set'}
									</div>
									<div className="budget-display-helptext">Your spending profile category</div>
								</div>
							</div>
							<button onClick={() => setEditing(!editing)}
								className="budget-form-submit"
								style={{ gridColumn: '1 / -1', marginTop: '12px' }}
							>
								<Settings size={20} />
								{editing ? 'Cancel' : 'Edit Settings'}
							</button>
						</div>
					)}
				</div>
			</div>

			{/* Account Stats */}
			<div className="account-stats-card">
				<div className="card-body">
					<h3 className="account-stats-title">Account Information</h3>
					<div className="account-stats-grid">
						<div className="account-stats-item">
							<div className="account-stats-content">
								<div className="account-stats-figure">
									<User size={32} />
								</div>
								<div className="account-stats-label">Member Since</div>
								<div className="account-stats-value">
									{profile?.createdAt
										? new Date(profile.createdAt).toLocaleDateString('en-US', {
											month: 'short',
											day: 'numeric',
											year: 'numeric'
										})
										: 'N/A'}
								</div>
								<div className="account-stats-helptext">Account creation date</div>
							</div>
						</div>
						<div className="account-stats-item">
							<div className="account-stats-content">
								<div className="account-stats-figure">
									<Settings size={32} />
								</div>
								<div className="account-stats-label">Last Updated</div>
								<div className="account-stats-value">
									{profile?.updatedAt
										? new Date(profile.updatedAt).toLocaleDateString('en-US', {
											month: 'short',
											day: 'numeric',
											year: 'numeric'
										})
										: 'N/A'}
								</div>
								<div className="account-stats-helptext">Profile last modified</div>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Danger Zone */}
			<div className="danger-card">
				<div>
					<h3 className="danger-title">Danger Zone</h3>
					<p className="danger-text">Permanently delete your account and all associated data.</p>
				</div>
				<button
					onClick={deleteAccount}
					disabled={deleting}
					className="danger-button"
				>
					{deleting ? (
						<>
							<LoaderCircle size={18} className="spinner" />
							Deleting...
						</>
					) : (
						"Delete Account"
					)}
				</button>
			</div>
		</div>
	);
}

/* Small helper component for checklist UI */
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