import User from "../models/user.js";
import { notFound, errorHandler } from "../middleware/errorHandler.js";
import bcrypt from "bcryptjs";
import ApiError from "../utils/ApiError.js";

async function getProfile(req, res, next) {
	try {
		if (!req.user || !req.user._id) {
			return next(new errorHandler(401, 'Unauthorized'));
		}
		// Always fetch fresh user data from database
		const user = await User.findById(req.user._id).select('-password');
		if (!user) {
			return next(new errorHandler(404, 'User not found'));
		}
		return res.status(200).json({ success: true, user });
	} catch (error) {
		return next(new errorHandler(500, 'Internal Server Error'));
	}
}

async function updateProfile(req, res, next) {
	try {
		const userId = req.user?._id;
		if (!req.user || !req.user._id) {
			return next(new errorHandler(401, 'Unauthorized'));
		}
		const allowedUserTypes = [
			'college_student',
			'young_professional',
			'family_moderate',
			'family_high',
			'luxury_lifestyle',
			'senior_retired'
		];

		const { name, email, currentPassword, password, monthlyBudget, userType } = req.body;

		console.log(currentPassword, password);

		const user = await User.findById(userId).select('+password');
		if (!user) throw new ApiError(404, 'User not found');

		if (name) {
			user.name = name;
		}

		if (email && email !== user.email) {
			const exists = await User.findOne({ email });
			if (exists) throw new ApiError(400, 'Email already in use');
			user.email = email;
		}

		if (password) {
			if (user.authProvider !== 'local') {
				throw new ApiError(400, 'Cannot change password for OAuth accounts');
			}
			if (!currentPassword) {
				throw new ApiError(400, 'Current password is required to set a new password');
			}
			if (!user.password) {
				throw new ApiError(400, 'No password set for this account');
			}
			const ok = await bcrypt.compare(currentPassword, user.password);
			if (!ok) {
				throw new ApiError(400, 'Current password is incorrect');
			}
			// Set the plain password - the pre-save hook will hash it
			user.password = password;
		}

		if (monthlyBudget !== undefined) {
			const mb = Number(monthlyBudget);
			if (Number.isNaN(mb) || mb < 0) {
				return next(new errorHandler(400, 'monthlyBudget must be a non-negative number'));
			}
			user.monthlyBudget = mb;
		}
		if (userType !== undefined) {
			if (!allowedUserTypes.includes(userType)) {
				return next(new errorHandler(400, `userType must be one of: ${allowedUserTypes.join(', ')}`));
			}
			user.userType = userType;
		}

		const updatedUser = await user.save();

		return res.status(200).json({
			success: true,
			message: 'User updated successfully',
			user: {
				id: updatedUser._id,
				name: updatedUser.name,
				email: updatedUser.email,
				monthlyBudget: updatedUser.monthlyBudget,
				userType: updatedUser.userType,
				authProvider: updatedUser.authProvider,
				createdAt: updatedUser.createdAt,
				updatedAt: updatedUser.updatedAt
			}
		});
	} catch (error) {
		console.error(error);
		if (error.code === 11000 && error.keyPattern && error.keyPattern.email) {
			return next(new errorHandler(400, 'Email already in use'));
		}
		return next(new errorHandler(500, 'Internal Server Error'));
	}
}

async function deleteUser(req, res, next) {
	try {
		if (!req.user || !req.user._id) {
			return next(new errorHandler(401, 'Unauthorized'));
		}
		const deletedUser = await User.findByIdAndDelete(req.user._id);
		if (!deletedUser) {
			return next(new errorHandler(404, 'User not found'));
		}
		return res.status(200).json({ success: true, message: 'User deleted successfully' });
	} catch (error) {
		return next(new errorHandler(500, 'Internal Server Error'));
	}
}

export { getProfile, updateProfile, deleteUser };