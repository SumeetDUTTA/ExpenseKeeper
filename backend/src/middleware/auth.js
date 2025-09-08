import jwt from 'jsonwebtoken';
import ApiError from '../utils/ApiError.js';
import User from '../models/user.js';

async function auth(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader.startwith('Bearer ') ? authHeader.slice(7): null;
        if (!token) throw new ApiError(401, "Missing authorization token");
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password');
        if (!user) throw new ApiError(401, "User not found");
        req.user = user;
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') return next(new ApiError(401, "Invalid token"));
        if (error.name === 'TokenExpiredError') return next(new ApiError(401, "Token expired"));
        next(error);
    }
}

export default auth;