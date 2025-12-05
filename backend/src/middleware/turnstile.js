import axios from 'axios';

import ApiError from '../utils/ApiError.js';

export async function verifyTurnstile(req, res, next) {
  const { turnstileToken } = req.body;
  
  if (!turnstileToken) {
    console.log('No Turnstile token provided');
    throw new ApiError(400, 'Turnstile verification required');
  }
  
  try {
    const response = await axios.post('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      secret: process.env.TURNSTILE_SECRET_KEY,
      response: turnstileToken,
      remoteip: req.ip || req.connection.remoteAddress,
    });
    
    if (!response.data.success) {
      throw new ApiError(400, 'Turnstile verification failed');
    }
    
    next();
  } catch (error) {
    throw new ApiError(400, 'Invalid Turnstile token');
  }
}
