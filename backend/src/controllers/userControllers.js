import User from "../models/user.js";
import { notFound, errorHandler } from "../middleware/errorHandler.js";

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

        const { name, email, monthlyBudget, userType } = req.body;
        const update = {};

        if (name !== undefined) {
            if (typeof name !== 'string' || name.trim()) {
                return next(new errorHandler(400, 'Name must be a non-empty string'));
            }
            update.name = name.trim();
        }
        if (email !== undefined) {
            const emailStr = String(email).trim().toLowerCase();
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(emailStr)) {
                return next(new errorHandler(400, 'Invalid email format'));
            }
            update.email = emailStr;
        }
        if (monthlyBudget !== undefined) {
            const mb = Number(monthlyBudget);
            if(Number.isNaN(mb) || mb < 0) {
                return next(new errorHandler(400, 'monthlyBudget must be a non-negative number'));
            }
            update.monthlyBudget = mb;
        }
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
            req.user._id, {$set: update}, { new: true }
        ).select('-password');
        if (!updateUser) return next(notFound(404, 'User not found'));
        return res.status(200).json({ success: true, message: 'User updated successfully', user: updateUser });
    } catch (error) {
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