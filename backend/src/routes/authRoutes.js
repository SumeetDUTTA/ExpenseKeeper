import express from 'express';
import axios from 'axios';

import { verifyTurnstile } from '../middleware/turnstile.js';
import { validate } from '../middleware/validate.js';
import { registerSchema, loginSchema, googleAuthSchema, discordAuthSchema } from '../validators/authValidator.js';
import {register, login, googleAuth, discordAuth, discordCallback} from '../controllers/authControllers.js';

const router = express.Router();

router.post('/register', validate(registerSchema), verifyTurnstile, register);
router.post('/login', validate(loginSchema), verifyTurnstile, login);
router.post('/google', validate(googleAuthSchema), googleAuth);
router.post('/discord', validate(discordAuthSchema), discordAuth);
router.get('/discord/callback', discordCallback);

export default router;

