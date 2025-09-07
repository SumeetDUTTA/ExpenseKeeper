import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import expenseRoutes from './routes/expenseRoutes.js';
import userRoutes from './routes/authRoutes.js';
import { connectDB } from './config/db.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

dotenv.config();

const app = express();

app.use(helmet());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combination': 'dev' ));

const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({ origin: corsOrigin, credentials: true }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
})
app.use('/api/', limiter);

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: Date.now() }));

app.use("/api/expenses", expenseRoutes);
app.use('/auth', userRoutes)

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5001;
connectDB().then(() => {
    app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}).catch((error) => {
    console.error(`Error starting server: ${error.message}`);
    process.exit(1);
});
