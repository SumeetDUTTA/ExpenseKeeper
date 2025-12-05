import dotenv from 'dotenv';
dotenv.config();
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import axios from 'axios';

import ApiError from '../utils/ApiError.js';
import User from '../models/user.js';

async function wakeMlServer() {
	const WAKE_URL = `${process.env.ML_API_URL || 'http://localhost:8000'}/docs`;
	console.log('Waking ML server:', WAKE_URL);

	axios.get(WAKE_URL, { timeout: 60000 }) // 60 seconds for cold start
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
		const user = await User.create({
			name, email,
			password, authProvider: 'local'
		});
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

		if (user.authProvider !== 'local') {
			throw new ApiError(400, `Please log in using ${user.authProvider}`);
		}

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

async function googleAuth(req, res, next) {
	try {
		const { idToken } = req.body;
		if (!idToken) {
			throw new ApiError(400, 'Missing Google ID token');
		}
		const googleRes = await axios.get(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);

		const { email, name, sub: googleId } = googleRes.data;
		if (!email || !googleId) {
			throw new ApiError(400, 'Google ID token is missing email or Google ID');
		}

		let user = await User.findOne({ email });
		if (!user) {
			user = await User.create({
				name,
				email,
				authProvider: 'google',
				googleId,
			});
		} else {
			if (user.authProvider !== 'google') {
				throw new ApiError(400, `Please log in using ${user.authProvider}`);
			}
			if (!user.googleId) {
				user.googleId = googleId;
				await user.save();
			}
		}
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

async function discordAuth(req, res, next) {
	try {
		const { code } = req.body;
		if (!code) {
			throw new ApiError(400, 'Missing Discord authorization code');
		}
		const discordRes = await axios.post(
			'https://discord.com/api/oauth2/token',
			new URLSearchParams({
				client_id: process.env.DISCORD_CLIENT_ID,
				client_secret: process.env.DISCORD_CLIENT_SECRET,
				grant_type: 'authorization_code',
				code: code,
				redirect_uri: process.env.DISCORD_REDIRECT_URI,
			}),
			{
				headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			}
		)

		const accessToken = discordRes.data.access_token;

		const userRes = await axios.get('https://discord.com/api/users/@me', {
			headers: { Authorization: `Bearer ${accessToken}` },
		});

		const { id: discordId, username, email } = userRes.data;

		if (!email || !discordId) {
			throw new ApiError(400, 'Discord user data is missing email or Discord ID');
		}

		let user = await User.findOne({ email });

		if (!user) {
			user = await User.create({
				name: username || 'Discord User',
				email,
				authProvider: 'discord',
				discordId,
			});
		} else {
			if (user.authProvider !== 'discord') {
			throw new ApiError(400, `Please log in using ${user.authProvider}`);
		}
		if (!user.discordId) {
			user.discordId = discordId;
			await user.save();
		}
	}
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

async function discordCallback(req, res, next) {
	try {
		const { code } = req.query;
		if (!code) {
			return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=no_code`);
		}

		// Exchange code for access token
		const tokenRes = await axios.post(
			'https://discord.com/api/oauth2/token',
			new URLSearchParams({
				client_id: process.env.DISCORD_CLIENT_ID,
				client_secret: process.env.DISCORD_CLIENT_SECRET,
				grant_type: 'authorization_code',
				code: code,
				redirect_uri: process.env.DISCORD_REDIRECT_URI,
			}),
			{
				headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			}
		);

		const accessToken = tokenRes.data.access_token;

		// Get user info from Discord
		const userRes = await axios.get('https://discord.com/api/users/@me', {
			headers: { Authorization: `Bearer ${accessToken}` },
		});

		const { id: discordId, username, email } = userRes.data;

		if (!email || !discordId) {
			return res.redirect(`${process.env.CORS_ORIGIN || 'http://localhost:5173'}/login?error=missing_data`);
		}

		let user = await User.findOne({ email });

		if (!user) {
			user = await User.create({
				name: username || 'Discord User',
				email,
				authProvider: 'discord',
				discordId,
			});
		} else {
			if (user.authProvider !== 'discord') {
				return res.redirect(`${process.env.CORS_ORIGIN || 'http://localhost:5173'}/login?error=wrong_provider&provider=${user.authProvider}`);
			}
			if (!user.discordId) {
				user.discordId = discordId;
				await user.save();
			}
		}

		const token = signToken(user._id);
		
		// Redirect to frontend with token and user info
		const frontendUrl = process.env.CORS_ORIGIN || 'http://localhost:5173';
		const redirectUrl = `${frontendUrl}/auth/discord/callback?token=${token}&user=${encodeURIComponent(JSON.stringify({ id: user._id, name: user.name, email: user.email }))}`;
		
		res.redirect(redirectUrl);
		wakeMlServer();
	} catch (error) {
		console.error('Discord callback error:', error.response?.data || error.message);
		const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
		res.redirect(`${frontendUrl}/login?error=auth_failed`);
	}
}

export { register, login, googleAuth, discordAuth, discordCallback };