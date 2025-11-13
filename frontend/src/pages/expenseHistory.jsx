// src/pages/ExpenseHistory.jsx
import React, { useEffect, useMemo, useState } from 'react'
import api from '../api'
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Brush, } from 'recharts'

function parseDate(s) {
  const d = s ? new Date(s) : new Date()
  if (Number.isNaN(d.getTime())) return null
  return d
}
function formatMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}
function formatDayKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
function getWeekKey(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}
function keyToLabel(key, agg) {
  if (!key) return ''
  if (agg === 'monthly') {
    const [y, m] = key.split('-')
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    return `${monthNames[Number(m)-1]} ${y}`
  }
  if (agg === 'weekly') {
    return key.replace('-', ' ')
  }
  return key
}
function clampDate(date) {
  const d = new Date(date)
  d.setHours(0,0,0,0)
  return d
}
function subMonths(date, months) {
  const d = new Date(date)
  d.setMonth(d.getMonth() - months)
  return d
}

export default function ExpenseHistory(){
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [preset, setPreset] = useState('3M')
  const [agg, setAgg] = useState('monthly')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await api.get('/expenses')
        if (Array.isArray(res.data)) setExpenses(res.data)
        else if (res.data?.expenses && Array.isArray(res.data.expenses)) setExpenses(res.data.expenses)
        else setExpenses(Array.isArray(res.data) ? res.data : [])
      } catch (e) {
        setError(e.response?.data?.message || e.message || 'Failed to load expenses')
        setExpenses([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const { startDate, endDate } = useMemo(() => {
    const now = new Date()
    let end = customEnd ? parseDate(customEnd) : now
    if (!end) end = now
    end.setHours(23, 59, 59, 999)

    let start = null
    if (customStart) {
      start = parseDate(customStart)
    } else {
      switch (preset) {
        case '1M': start = subMonths(now, 1); break
        case '3M': start = subMonths(now, 3); break
        case '6M': start = subMonths(now, 6); break
        case '1Y': start = subMonths(now, 12); break
        case 'All':
        default:
          const dates = expenses.map(e => parseDate(e.date)).filter(Boolean)
          start = dates.length ? new Date(Math.min(...dates.map(d=>d.getTime()))) : subMonths(now, 12)
      }
    }
    if (!start) start = subMonths(now, 3)
    start = clampDate(start)
    return { startDate: start, endDate: end }
  }, [preset, customStart, customEnd, expenses])

  const groupedData = useMemo(() => {
    const list = Array.isArray(expenses) ? expenses : []
    const filtered = list
      .map(it => ({ ...it, parsedDate: parseDate(it.date) }))
      .filter(it => it.parsedDate)
      .filter(it => {
        const t = it.parsedDate.getTime()
        return t >= startDate.getTime() && t <= endDate.getTime()
      })

    const map = new Map()
    filtered.forEach(it => {
      const dt = it.parsedDate
      let key
      if (agg === 'monthly') key = formatMonthKey(dt)
      else if (agg === 'weekly') key = getWeekKey(dt)
      else key = formatDayKey(dt)

      const prev = map.get(key) || 0
      map.set(key, prev + (Number(it.amount) || 0))
    })

    const keys = Array.from(map.keys()).sort((a,b) => {
      if (agg === 'monthly') {
        const [ay, am] = a.split('-').map(Number)
        const [by, bm] = b.split('-').map(Number)
        if (ay !== by) return ay - by
        return am - bm
      }
      if (agg === 'weekly') {
        const [ay, aw] = a.split('-W').map(Number)
        const [by, bw] = b.split('-W').map(Number)
        if (ay !== by) return ay - by
        return aw - bw
      }
      return new Date(a) - new Date(b)
    })

    const data = keys.map(k => ({ name: keyToLabel(k, agg), value: map.get(k) || 0, rawKey: k }))
    return { data, filtered, map }
  }, [expenses, startDate, endDate, agg])

  const chartData = Array.isArray(groupedData.data) ? groupedData.data : []
  const totalInRange = chartData.reduce((s, r) => s + (Number(r.value) || 0), 0)
  const periodsCount = chartData.length || 1
  const avgPerPeriod = Math.round((totalInRange / periodsCount) || 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold">SpendPulse (Expense history)</h2>
        <div className="text-sm text-gray-500">Track your spend over time</div>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm mb-4 flex flex-col md:flex-row gap-4 items-start md:items-center">
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => { setPreset('1M'); setCustomStart(''); setCustomEnd('') }} className={`px-3 py-1 rounded ${preset==='1M' ? 'bg-indigo-600 text-white' : 'bg-gray-100'}`}>1M</button>
          <button onClick={() => { setPreset('3M'); setCustomStart(''); setCustomEnd('') }} className={`px-3 py-1 rounded ${preset==='3M' ? 'bg-indigo-600 text-white' : 'bg-gray-100'}`}>3M</button>
          <button onClick={() => { setPreset('6M'); setCustomStart(''); setCustomEnd('') }} className={`px-3 py-1 rounded ${preset==='6M' ? 'bg-indigo-600 text-white' : 'bg-gray-100'}`}>6M</button>
          <button onClick={() => { setPreset('1Y'); setCustomStart(''); setCustomEnd('') }} className={`px-3 py-1 rounded ${preset==='1Y' ? 'bg-indigo-600 text-white' : 'bg-gray-100'}`}>1Y</button>
          <button onClick={() => { setPreset('All'); setCustomStart(''); setCustomEnd('') }} className={`px-3 py-1 rounded ${preset==='All' ? 'bg-indigo-600 text-white' : 'bg-gray-100'}`}>All</button>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <label className="text-sm text-gray-600">Aggregation</label>
          <select value={agg} onChange={e=>setAgg(e.target.value)} className="p-1 border rounded">
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Custom range</label>
          <input type="date" value={customStart} onChange={e=>{ setCustomStart(e.target.value); setPreset('') }} className="p-1 border rounded" />
          <input type="date" value={customEnd} onChange={e=>{ setCustomEnd(e.target.value); setPreset('') }} className="p-1 border rounded" />
          <button onClick={()=>{ setCustomStart(''); setCustomEnd(''); setPreset('3M') }} className="px-2 py-1 bg-gray-100 rounded">Reset</button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm text-gray-500">Total in range</div>
            <div className="text-2xl font-bold mt-1">₹{totalInRange}</div>
            <div className="text-xs text-gray-500 mt-1">Avg per {agg === 'daily' ? 'day' : agg === 'weekly' ? 'week' : 'month'}: ₹{avgPerPeriod}</div>
          </div>

          <div style={{ width: '65%', height: 260, minWidth: 0 }}>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => `₹${value}`} />
                  <Line type="monotone" dataKey="value" stroke="#8884d8" strokeWidth={2} dot />
                  <Brush dataKey="name" height={30} stroke="#8884d8" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500">No data for the chosen range</div>
            )}
          </div>
        </div>

        <div className="text-xs text-gray-500">Tip: change aggregation to see monthly/weekly/daily trends.</div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-2xl shadow-sm">
          <div className="text-sm text-gray-500 mb-3">Recent expenses (in selected range)</div>
          {loading ? <div>Loading…</div> : (
            groupedData.filtered.length === 0 ? (
              <div className="text-gray-500">No expenses in selected range</div>
            ) : (
              <div className="divide-y">
                {groupedData.filtered.slice().sort((a,b)=>b.parsedDate - a.parsedDate).slice(0,20).map(it => (
                  <div key={it._id || (it.parsedDate && it.parsedDate.getTime())} className="py-3 flex justify-between items-center">
                    <div>
                      <div className="font-medium">{it.category}</div>
                      <div className="text-xs text-gray-500">{it.parsedDate.toLocaleDateString()} · {it.note}</div>
                    </div>
                    <div className="text-right font-semibold">₹{it.amount}</div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm">
          <div className="text-sm text-gray-500 mb-3">Period breakdown</div>
          {chartData.length === 0 ? <div className="text-gray-500">No data</div> : (
            <div className="overflow-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-100"><tr><th className="p-2">Period</th><th className="p-2">Total</th></tr></thead>
                <tbody>
                  {chartData.map(row => (
                    <tr key={row.name} className="border-t">
                      <td className="p-2">{row.name}</td>
                      <td className="p-2">₹{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {error && <div className="text-red-600 mt-4">{String(error)}</div>}
    </div>
  )
}
