import dotenv from 'dotenv';
dotenv.config();
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import axios from 'axios';

import ApiError from '../utils/ApiError.js';
import User from '../models/user.js';

async function wakeMlServer() {
  const WAKE_URL = `${process.env.ML_API_URL}/docs` || 'https:localhost:8000/docs';

  axios.get(WAKE_URL, { timeout: 3000 })
    .then(() => console.log('ML server wake ping sent OK'))
    .catch(err => console.debug('ML wake ping failed (ignored):', err.message));
}

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
        wakeMlServer();
    } catch (error) {
        next(error);
    }
}

async function login(req, res, next) {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email }).select('+password');
        if (!user) throw new ApiError(401, 'Invalid email or password');
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) throw new ApiError(401, 'Invalid email or password');
        const token = signToken(user._id);
        res.status(200).json({
            success: true,
            user: { id: user._id, name: user.name, email: user.email },
            token,
        });
        wakeMlServer();
    } catch (error) {
        next(error);
    }
}

export { register, login };


