import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';

import expenseRoutes from './routes/expenseRoutes.js';
import authRoutes from './routes/authRoutes.js';
import predictRoutes from './routes/predictRoutes.js';
import userRoutes from './routes/userRoutes.js';
import redisClient from './utils/redisClient.js';
import { connectDB } from './config/db.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';


const app = express();

app.use(helmet());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined': 'dev' ));

// CORS configuration - restrict to frontend origin only
const allowedOrigins = [
  process.env.CORS_ORIGIN || 'http://localhost:5173',
  'http://localhost:5173',
  'http://localhost:5000', // for development
];

app.use(cors({ 
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

const limiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
  }),
  windowMs: 60 * 1000, // 1 minutes
  max: 50,               // max 50 requests per IP per 1 minutes
  message: {
    success: false,
    error: 'Too many requests. Please try again later.'
  },
  standardHeaders: true, // adds RateLimit-* headers
  legacyHeaders: false,
})

const authLimiter = rateLimit({
  store: new RedisStore({ sendCommand: (...args) => redisClient.sendCommand(args) }),
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  message: { error: 'Too many login attempts. Please try again later.' }
});

app.get('/health', async (req, res) => {
  try {
    const redisOk = await redisClient.ping() === 'PONG';
    res.json({
      status: 'ok',
      redis: redisOk ? 'connected' : 'disconnected',
      db: 'connected',
      timestamp: Date.now(),
    });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

app.use("/api/expenses", limiter, expenseRoutes);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/user', limiter, userRoutes);
app.use('/api/predict', limiter, predictRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5001;
let server;

connectDB().then(() => {
    server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}).catch((error) => {
    console.error(`Error starting server: ${error.message}`);
    process.exit(1);
});

// Graceful shutdown
const shutdown = async (signal) => {
  console.log(`\n Received ${signal}. Shutting down gracefully...`);
  try {
    if (server) {
      server.close(() => {
        console.log('Closed out remaining connections.');
      });
    }
    if (redisClient) {
      await redisClient.quit();
      console.log('Redis client disconnected.');
    }

    const { mongoose } = await import('mongoose');
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('MongoDB disconnected.');
    }
    console.log('Shutdown complete. Exiting process.');
    process.exit(0);
  } catch (error) {
    console.error(`Error during shutdown: ${error.message}`);
    process.exit(1);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
