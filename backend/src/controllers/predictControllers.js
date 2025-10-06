import forecast from "../mlServices/mlService.js";
import Expense from "../models/expense.js";
import ApiError from "../utils/ApiError.js";

export async function predict(req, res, next) {
    try {
        const horizonDates = req.body.horizonDates || 1;
        const rows = await Expense.aggregate([
            { $match: {user: req.user._id} },
            { $group: {
                _id: { $dateToString: { format: "%Y-%m", date: "$date"} },
                total: { $sum: "$amount" }
            }},
            { $sort: { _id: 1 }}
        ])
        if (!rows.length) throw new ApiError(400, 'Not enough data to generate prediction');
        const timeseries = rows.map(r => r.total);
        const prediction = await forecast(timeseries, horizonDates);
        res.status(200).json({
            success: true,
            series: rows.map(r => ({ month: r._id, total: r.total })),
            prediction
        });
    } catch (error) {
        next(new ApiError(500, 'Prediction failed', error));
    }
}