import axios from 'axios';
import ApiError from '../utils/ApiError.js';

async function forecast(timeseries, horizonDates) {
    const base = process.env.ML_API_BASE_URL;
    if (!base) {
        const mean = timeseries.length ? timeseries.reduce((a, b)=> a + b, 0) / timeseries.length : 0;
        return Array.from({ length: horizonDates}, () => Math.round(mean));
    }
    try {
        const url = `${base.replace(/\/$/, '')}/predict`;
        const headers = {};
        if(process.env.ML_API_KEY) {
            headers['x-api-key'] = process.env.ML_API_KEY;
        }
        const {data} = await axios.post(url, {timeseries, horizon: horizonDates}, {headers});
        return data.forecast;
    } catch (error) {
        throw new ApiError('Forecasting failed', error);
    }
};

export default forecast;