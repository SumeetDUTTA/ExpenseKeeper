import User from '../models/user.js';
import jwt from 'jsonwebtoken';

import ApiError from '../utils/ApiError.js';

function signToken(userID) {
    return jwt.sign({ id: userID }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });
}

async function register(req, res, next) {
    try {
        const { name, email, password } = req.body;
        const exists = await User.findOne({ email });
        if (exists) throw new ApiError(400, 'Email already registered');
        const user = await User.create({ name, email, password });
        const token = signToken(user._id);
        res.status(201).json({ 
            success: true,
            user: { id: user._id, name: user.name, email: user.email },
            token,
        });
    } catch (error) {
        next(error);
    }
}

async function login(req, res, next) {
    try {
        const {email, password} = req.body;
        const user = await User.findOne({ email });
        if (!user) throw new ApiError(401, 'Invalid email or password');
        const isMatch = await user.comparePassword(password);
        if (!isMatch) throw new ApiError(401, 'Invalid email or password');
        const token = signToken(user._id);
        res.status(200).json({
            success: true,
            user: { id: user._id, name: user.name, email: user.email },
            token,
        });
    } catch (error) {
        next(error);
    }
}

export { register, login };


