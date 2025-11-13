import React, {useState} from "react";
import api from "../api";

function normalizeTotalPrediction(tp) {
  try {
    if (Array.isArray(tp)) return tp
    if (typeof tp === 'number') return [tp]
    if (tp && typeof tp === 'object') {
      const keys = Object.keys(tp)
      const numericKeys = keys.every(k => !Number.isNaN(Date.parse(k)) || !isNaN(Number(k)))
      if (numericKeys) {
        return keys
          .slice()
          .sort((a, b) => {
            const da = Date.parse(a)
            const db = Date.parse(b)
            if (!Number.isNaN(da) && !Number.isNaN(db)) return da - db
            return (Number(a) || 0) - (Number(b) || 0)
          })
          .map(k => tp[k])
      }
      return Object.values(tp)
    }
  } catch (err) {
    console.error('normalizeTotalPrediction error:', err, tp)
  }
  return [] // <-- GUARANTEED fallback
}

export default function Predict() {
  const [horizon, setHorizon] = useState(1)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showBreakdown, setShowBreakdown] = useState(false)

  async function submit(e) {
    e && e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await api.post('/predict', { horizonDates: Number(horizon) })
      console.log('predict response:', res.data)
      setResult(res.data)
      setShowBreakdown(false)
    } catch (e) {
      setError(e.response?.data?.message || e.message)
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  // Defensive normalization with try/catch/fallback
  const totalPredRaw = result?.total_prediction
  let totalPredArray = []
  try {
    totalPredArray = normalizeTotalPrediction(totalPredRaw) || []
  } catch (err) {
    console.error('Error normalizing total_prediction:', err, totalPredRaw)
    totalPredArray = []
  }

  // ALWAYS use a safe array fallback before .map
  const chartData = (totalPredArray || []).map((v, i) => ({ name: `T+${i + 1}`, value: v }))

  const totalDisplay = (Array.isArray(totalPredArray) && totalPredArray.length > 0)
    ? totalPredArray.reduce((s, x) => s + (Number(x) || 0), 0)
    : (typeof totalPredRaw === 'number' ? totalPredRaw : null)

  const byCategory = result?.prediction_by_category || {}

  return (
    <div>
      <h2 className="text-xl font-semibold">Prediction</h2>

      <form onSubmit={submit} className="flex items-center gap-2 mb-4">
        <label>Horizon (months):</label>
        <input
          type="number"
          min="1"
          max="12"
          value={horizon}
          onChange={(e) => setHorizon(e.target.value)}
          className="p-2 border rounded w-20"
        />
        <button className="bg-indigo-600 text-white px-3 py-1 rounded">Run</button>
      </form>

      {loading && <div>Generating…</div>}
      {error && <div className="text-red-600">{error}</div>}

      {result && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded shadow flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500">Total prediction</div>
              <div className="text-2xl font-bold mt-1">
                {totalDisplay != null ? `₹${totalDisplay}` : '—'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowBreakdown(s => !s)}
              className="text-sm bg-gray-100 px-3 py-1 rounded"
            >
              {showBreakdown ? 'Hide breakdown by category' : 'Show breakdown by category'}
            </button>
            <div className="text-sm text-gray-500">
              Breakdown is hidden by default. Click the button to view category-level predictions.
            </div>
          </div>

          {showBreakdown && (
            <div className="bg-white p-4 rounded shadow">
              <h3 className="font-medium mb-2">Prediction by category</h3>

              <div className="overflow-auto">
                <table className="w-full text-left mt-2">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="p-2">Category</th>
                      {(chartData.length > 0 ? chartData : [{ name: `T+1` }]).map(c => (
                        <th key={c.name} className="p-2">{c.name}</th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {Object.keys(byCategory).length === 0 ? (
                      <tr className="border-t"><td className="p-2" colSpan={2}>No category predictions</td></tr>
                    ) : (
                      Object.entries(byCategory).map(([cat, arr]) => (
                        <tr key={cat} className="border-t">
                          <td className="p-2">{cat}</td>
                          {Array.isArray(arr) ? arr.map((v, i) => <td key={i} className="p-2">₹{v}</td>)
                           : <td className="p-2">{String(arr)}</td>}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}