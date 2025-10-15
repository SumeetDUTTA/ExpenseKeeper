import { forecast } from "../mlServices/mlService.js";
import Expense from "../models/expense.js";
import redisClient from "../utils/redisClient.js";
import  { notFound, errorHandler} from "../middleware/errorHandler.js";

export async function predict(req, res, next) {
    try {
        const horizon = Number(req.body.horizonDates) || 1;

        if (horizon < 1 || horizon > 12) {
            throw new errorHandler(400, 'horizonDates must be between 1 and 12');
        }

        const user = req.user || {};
        const user_total_budget = req.body.user_total_budget || user.monthlyBudget || 0;
        const user_type = req.body.user_type || user.user_type || 'college_student';

        const cacheKey = `forecast:${user._id}:${horizon}:${user_total_budget}:${user_type}`;

        // Check Redis cache
        const cachedResult = await redisClient.get(cacheKey);
        if (cachedResult) {
            return res.status(200).json(JSON.parse(cachedResult));
        }

        // Get user's expense data grouped by month and category
        const rows = await Expense.aggregate([
            { $match: { user: req.user._id } },
            { $group: {
                _id: { 
                    month: { $dateToString: { format: "%Y-%m", date: "$date" } },
                    category: "$category",
                },
                total: { $sum: "$amount" }
            }},
            { $sort: { "_id.month": 1 } }
        ]);

        if (!rows.length) {
            throw new errorHandler(400, 'Not enough data to generate prediction');
        }

        // Organize data by categories and months
        const uniqueMonths = [...new Set(rows.map(r => r._id.month))].sort();
        const categoriesSet = new Set(rows.map(r => r._id.category || 'Uncategorized'));
        const categoryMap = {};
        
        // Initialize category arrays
        for (const cat of categoriesSet) {
            categoryMap[cat] = Array(uniqueMonths.length).fill(0);
        }

        // Fill in the data
        const monthIndex = new Map(uniqueMonths.map((m, i) => [m, i]));
        for (const row of rows) {
            const cat = row._id.category || 'Uncategorized';
            const idx = monthIndex.get(row._id.month);
            if (idx !== null && idx !== undefined) {
                categoryMap[cat][idx] = Math.round(row.total);
            }
        }

        // Simple check: if I have at least 3 months of data, use ML; otherwise use simple average
        const MIN_MONTHS = 3;
        let predictionResult;

        if (uniqueMonths.length >= MIN_MONTHS) {
            predictionResult = await forecast(categoryMap, horizon, { user_total_budget, user_type });
        } else {
            // Simple fallback: use recent averages with small growth
            const results = {};
            let totalPredictions = [];
            
            for (const [cat, series] of Object.entries(categoryMap)) {
                const nonZero = series.filter(v => v > 0);
                const avg = nonZero.length ? nonZero.reduce((a, b) => a + b, 0) / nonZero.length : 0;
                const prediction = Math.round(avg * 1.05); // 5% growth
                results[cat] = Array(horizon).fill(prediction);
            }
            
            // Calculate totals
            for (let i = 0; i < horizon; i++) {
                totalPredictions[i] = Object.values(results).reduce((sum, catArray) => sum + catArray[i], 0);
            }
            
            predictionResult = {
                categories: results,
                total: totalPredictions,
                predictionMethod: 'simple_average'
            };
        }

        // Validate result
        if (!predictionResult || !predictionResult.categories || !predictionResult.total) {
            throw new errorHandler(500, 'Prediction failed to generate valid results');
        }

        // Create summary of input data
        const input_summary = Object.entries(categoryMap).map(([cat, series]) => {
            const nonZero = series.filter(v => v > 0);
            const months = nonZero.length;
            const average = months ? Math.round(nonZero.reduce((a, b) => a + b, 0) / months) : 0;
            return { category: cat, months, average };
        });

        // Log the prediction method used
        const method = predictionResult.predictionMethod || 'unknown';

        const result = {
            success: true,
            message: 'Prediction generated successfully',
            user_metadata: {
                budget: user_total_budget,
                type: user_type
            },
            input_summary,
            prediction_by_category: predictionResult.categories,
            total_prediction: predictionResult.total,
            predictionMethod: method,
        };

        // Store result in Redis cache
        await redisClient.set(cacheKey, JSON.stringify(result), {
            EX: 3600 // Cache for 1 hour
        });

        res.status(200).json(result);
        
    } catch (error) {
        console.error('Prediction error:', error);
        if (error instanceof errorHandler) {
            return next(error);
        }
        next(new errorHandler(500, 'Prediction failed', error));
    }
}