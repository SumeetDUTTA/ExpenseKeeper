import axios from 'axios';

const base = process.env.ML_API_URL || 'http://localhost:8000';

// Simple helper function
function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

// Simple recent mean calculation
function recentMean(series, window = 6) {
    if (!Array.isArray(series) || series.length === 0) return 0;
    const tail = series.slice(-window);
    const nonZero = tail.filter(n => n > 0);
    const use = nonZero.length ? nonZero : tail;
    return use.length ? use.reduce((a, b) => a + b, 0) / use.length : 0;
}

// Simple statistical fallback
function statisticalFallback(categories, horizon = 1) {
    const results = {};
    let totalPredictions = [];
    
    for (const [cat, series] of Object.entries(categories)) {
        const mean = recentMean(series, 6);
        const growth = 1.02; // 2% modest growth
        const predictions = Array(horizon).fill(0).map(() => Math.round(mean * growth));
        results[cat] = predictions;
        
        predictions.forEach((val, i) => {
            totalPredictions[i] = (totalPredictions[i] || 0) + val;
        });
    }
    
    return {
        categories: results,
        total: totalPredictions,
        predictionMethod: 'statistical_fallback'
    };
}

// Main prediction function - SIMPLIFIED
export async function forecast(categories, h = 1) {
    console.log('🤖 Starting ML prediction...');
    
    try {
        // Try ML prediction first
        const url = `${base.replace(/\/$/, '')}/predict`;

        const payload = {
            categories,
            horizon: h,
            user_total_budget: meta.user_total_budget,
            user_type: meta.user_type,
        }

        const { data: response } = await axios.post(url, payload, {
            timeout: 10000,
            headers: { 'Content-Type': 'application/json' }
        });
        
        console.log('✅ ML prediction successful!');
        
        // Simple processing - just clean up the ML results
        const cleanCats = {};
        const recomputedTotal = [];
        
        for (const [cat, vals] of Object.entries(response.categories || {})) {
            const predicted = Array.isArray(vals) ? vals.map(Number) : [];
            if (predicted.length === 0) {
                cleanCats[cat] = [];
                continue;
            }
            
            // Simple approach: trust the ML model with basic bounds
            const rawMean = predicted.reduce((a, b) => a + b, 0) / predicted.length;
            console.log(`📊 ${cat}: ML predicted ₹${Math.round(rawMean)}/month`);
            
            // Just ensure values are positive and reasonable (not more than 50K per category)
            const cleaned = predicted.map(v => clamp(Math.round(v), 0, 50000));
            cleanCats[cat] = cleaned;
            
            cleaned.forEach((v, i) => {
                recomputedTotal[i] = (recomputedTotal[i] || 0) + v;
            });
        }
        
        const totalAvg = recomputedTotal.reduce((a, b) => a + b, 0) / recomputedTotal.length;
        console.log(`💰 Total predicted: ₹${Math.round(totalAvg)}/month`);
        
        return {
            categories: cleanCats,
            total: recomputedTotal,
            predictionMethod: 'ml_model'
        };
        
    } catch (err) {
        console.log(`❌ ML prediction failed: ${err.message} - using statistical fallback`);
        return statisticalFallback(categories, h);
    }
}

