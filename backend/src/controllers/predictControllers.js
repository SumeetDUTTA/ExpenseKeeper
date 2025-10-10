import { forecast } from "../mlServices/mlService.js";
import Expense from "../models/expense.js";
import ApiError from "../utils/ApiError.js";

export async function predict(req, res, next) {
    try {
        const horizon = Number(req.body.horizonDates) || 1;

        const user = req.user || {};
        const user_total_budget = req.body.user_total_budget || user.monthlyBudget || 0;
        const user_type = req.body.user_type || user.user_type || 'college_student';

        result = await forecast(categories, horizon, { user_total_budget, user_type });

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
            throw new ApiError(400, 'Not enough data to generate prediction');
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

        // Simple check: if we have at least 3 months of data, use ML; otherwise use simple average
        const MIN_MONTHS = 3;
        let result;

        if (uniqueMonths.length >= MIN_MONTHS) {
            console.log(`📊 Using ML prediction (${uniqueMonths.length} months of data)`);
            result = await forecast(categoryMap, horizon);
        } else {
            console.log(`📊 Using simple average (only ${uniqueMonths.length} months of data)`);
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
            
            result = {
                categories: results,
                total: totalPredictions,
                predictionMethod: 'simple_average'
            };
        }

        // Validate result
        if (!result || !result.categories || !result.total) {
            throw new ApiError(500, 'Prediction failed to generate valid results');
        }

        // Create summary of input data
        const input_summary = Object.entries(categoryMap).map(([cat, series]) => {
            const nonZero = series.filter(v => v > 0);
            const months = nonZero.length;
            const average = months ? Math.round(nonZero.reduce((a, b) => a + b, 0) / months) : 0;
            return { category: cat, months, average };
        });

        // Log the prediction method used
        const method = result.predictionMethod || 'unknown';
        console.log(`🎯 Prediction method: ${method}`);

        res.status(200).json({
            success: true,
            message: 'Prediction generated successfully',
            input_summary,
            prediction_by_category: result.categories,
            total_prediction: result.total,
            predictionMethod: method,
        });

    } catch (error) {
        console.error('Prediction error:', error);
        if (error instanceof ApiError) {
            return next(error);
        }
        next(new ApiError(500, 'Prediction failed', error));
    }
}