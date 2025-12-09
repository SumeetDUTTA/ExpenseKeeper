import React, { useState, useEffect } from "react";
import { User, Mail, Wallet, Settings, Save, LoaderCircle } from "lucide-react";
import toast from "react-hot-toast";

import { useAuth } from "../contexts/authContext";
import api from "../lib/api";
import "../styles/Profile.css"

export default function Profile() {
	const { user, logout } = useAuth();
	const [profile, setProfile] = useState(null);
	const [loading, setLoading] = useState(false);
	const [editing, setEditing] = useState(false);
	const [deleting, setDeleting] = useState(false);
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

	async function fetchProfile() {
		setLoading(true);
		try {
			const res = await api.get("/api/user/profile");
			const userData = res.data.user || res.data;
			setProfile(userData);
			setMonthlyBudget(userData.monthlyBudget || "");
			setUserType(userData.userType || "");
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

			const res = await api.patch("/api/user/meta", payload);

			if (res.data.success && res.data.user) {
				toast.success("Profile updated successfully!");
				// Update profile with the returned user data
				setProfile(res.data.user);
				setMonthlyBudget(res.data.user.monthlyBudget || "");
				setUserType(res.data.user.userType || "");
				setEditing(false);
			}
		} catch (error) {
			console.error("Update error:", error);
			toast.error(error.response?.data?.message || "Failed to update profile");
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
				toast.success("Account deleted successfully.");
				// Log out the user after deletion
				logout();
				window.location.href = "/login";
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

				<div style={{ marginLeft: 'auto' }}>
					<button onClick={() => setEditing(!editing)}
						className={`btn ${editing ? 'btn-ghost' : ''}`}>
						<Settings size={20} />
						{editing ? 'Cancel' : 'Edit Settings'}
					</button>
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