import User from "../models/user.js";
import { notFound, errorHandler } from "../middleware/errorHandler.js";
import { success } from "zod";

async function updateUserMeta(req, res, next) {
	try {
		const userId = req.user && req.user._id;
		if (!userId) return next(new errorHandler(401, 'Unauthorized'));

		const { monthlyBudget, userType } = req.body;

		const update = {};
		if (monthlyBudget !== undefined) {
			const mb = Number(monthlyBudget);
			if (Number.isNaN(mb) || mb < 0) {
				return next(new errorHandler(400, 'monthlyBudget must be a non-negative number'));
			}
			update.monthlyBudget = Math.round(mb);
		}

		const allowedUserTypes = [
			'college_student',
			'young_professional',
			'family_moderate',
			'family_high',
			'luxury_lifestyle',
			'senior_retired'
		];

		if (userType !== undefined) {
			if (!allowedUserTypes.includes(userType)) {
				return next (new errorHandler(400, `userType must be one of: ${allowedUserTypes.join(', ')}`));
			}
			update.userType = userType;
		}

		if (Object.keys(update).length === 0) {
			return next(new errorHandler(400, 'No valid fields to update'));
		}

		const updateUser = await User.findByIdAndUpdate(
			userId, {$set: update}, { new: true }
		).select('-password');
		
		if (!updateUser) return next(notFound(404, 'User not found'));
		return res.status(200).json({ success: true, message: 'User updated successfully', user: updateUser });

	} catch (error) {
		return next(new errorHandler(500, 'Internal Server Error'));
	}
}

export { updateUserMeta };