/* eslint-disable */
import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, LineChart, Line, CartesianGrid, Legend } from 'recharts'
import { TrendingUp, Download } from 'lucide-react'
import { format, subDays, isSameDay, parseISO } from 'date-fns'

export default function Analytics() {
  const [leads, setLeads] = useState([])
  const [callLogs, setCallLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const [l, c] = await Promise.all([
      supabase.from('leads').select('*'),
      supabase.from('call_logs').select('*').order('called_at'),
    ])
    setLeads(l.data || [])
    setCallLogs(c.data || [])
    setLoading(false)
  }

  function exportCSV() {
    const headers = ['Clinic Name','Doctor Name','Phone','Area','Rating','Status','Priority','Follow Up Date','Next Action','Call Count','Last Called','Notes','Estimated Value']
    const rows = leads.map(l => [
      l.clinic_name, l.doctor_name, l.phone, l.area, l.rating, l.status, l.priority,
      l.next_follow_up_date, l.next_action, l.call_count,
      l.last_called_at ? format(new Date(l.last_called_at), 'dd MMM yyyy') : '',
      l.notes, l.estimated_value
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${v || ''}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `wevalue-leads-${format(new Date(), 'dd-MMM-yyyy')}.csv`; a.click()
    window.__toast && window.__toast('Exported!', 'success')
  }

  if (loading) return <div className="loading"><div className="spinner" /> Loading analytics...</div>

  const total = leads.length
  const closed = leads.filter(l => l.status === 'closed')
  const revenue = closed.reduce((s, l) => s + (l.estimated_value || 0), 0)

  // 30-day call trend
  const last30 = Array.from({ length: 30 }, (_, i) => {
    const d = subDays(new Date(), 29 - i)
    return { day: format(d, 'dd/MM'), calls: callLogs.filter(c => isSameDay(new Date(c.called_at), d)).length }
  })

  // Outcome distribution
  const outcomeCounts = {}
  callLogs.forEach(c => { outcomeCounts[c.outcome] = (outcomeCounts[c.outcome] || 0) + 1 })
  const outcomeData = Object.entries(outcomeCounts).map(([k, v]) => ({ name: k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), value: v }))
  const OUTCOME_COLORS = ['#22c55e','#f59e0b','#ef4444','#9ca3af','#a855f7','#16a34a','#6b7280']

  // Area breakdown
  const areaMap = {}
  leads.forEach(l => {
    if (!l.area) return
    if (!areaMap[l.area]) areaMap[l.area] = { total: 0, closed: 0, interested: 0, revenue: 0 }
    areaMap[l.area].total++
    if (l.status === 'closed') { areaMap[l.area].closed++; areaMap[l.area].revenue += (l.estimated_value || 0) }
    if (l.status === 'interested' || l.status === 'negotiating') areaMap[l.area].interested++
  })
  const areaData = Object.entries(areaMap).map(([a, d]) => ({ area: a, ...d, rate: d.total > 0 ? +((d.closed/d.total)*100).toFixed(1) : 0 })).sort((a,b) => b.total-a.total)

  // Priority distribution
  const priorityData = ['high','medium','low'].map(p => ({ name: p.charAt(0).toUpperCase()+p.slice(1), value: leads.filter(l=>l.priority===p).length, color: p==='high'?'var(--red)':p==='medium'?'var(--yellow)':'var(--green)' }))

  return (
    <div>
      {/* EXPORT */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="btn btn-ghost" onClick={exportCSV}><Download size={14} /> Export All Leads CSV</button>
      </div>

      {/* SUMMARY CARDS */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(2,1fr)', marginBottom: 16 }}>
        {[
          { label: 'Total Leads', value: total, color: 'var(--accent)' },
          { label: 'Total Calls', value: callLogs.length, color: 'var(--yellow)' },
          { label: 'Conversion Rate', value: `${total > 0 ? ((closed.length/total)*100).toFixed(1) : 0}%`, color: 'var(--green)' },
          { label: 'Total Revenue', value: revenue > 0 ? `₹${(revenue/1000).toFixed(0)}k` : '—', color: '#16a34a' },
          { label: 'Avg Calls/Lead', value: total > 0 ? (callLogs.length/total).toFixed(1) : '—', color: 'var(--blue)' },
          { label: 'Avg Deal Size', value: closed.length > 0 ? `₹${(revenue/closed.length).toFixed(0)}` : '—', color: 'var(--purple)' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ color: s.color, fontSize: 22 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* 30 DAY TREND */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title"><TrendingUp size={15} color="var(--accent)" /> 30-Day Call Activity</div>
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={last30}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="day" tick={{ fill: 'var(--text3)', fontSize: 9 }} axisLine={false} tickLine={false} interval={4} />
            <YAxis tick={{ fill: 'var(--text3)', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} width={20} />
            <Tooltip contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
            <Line type="monotone" dataKey="calls" stroke="var(--accent)" strokeWidth={2} dot={false} name="Calls" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* OUTCOME BREAKDOWN */}
      {outcomeData.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-title">📊 All-Time Outcome Breakdown</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <PieChart width={130} height={130}>
              <Pie data={outcomeData} cx={60} cy={60} innerRadius={35} outerRadius={60} dataKey="value" paddingAngle={2}>
                {outcomeData.map((_, i) => <Cell key={i} fill={OUTCOME_COLORS[i % OUTCOME_COLORS.length]} />)}
              </Pie>
            </PieChart>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {outcomeData.map((o, i) => (
                <div key={o.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 99, background: OUTCOME_COLORS[i % OUTCOME_COLORS.length], display: 'inline-block' }} />
                    <span style={{ color: 'var(--text2)' }}>{o.name}</span>
                  </span>
                  <span style={{ fontWeight: 700 }}>{o.value} <span style={{ color: 'var(--text3)', fontWeight: 400 }}>({callLogs.length > 0 ? ((o.value/callLogs.length)*100).toFixed(0) : 0}%)</span></span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* AREA TABLE */}
      {areaData.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-title">📍 Area Performance</div>
          <div className="table-wrap" style={{ boxShadow: 'none', border: 'none' }}>
            <table style={{ minWidth: 'unset' }}>
              <thead><tr><th>Area</th><th>Leads</th><th>Closed</th><th>Conv%</th><th>Revenue</th></tr></thead>
              <tbody>
                {areaData.map(a => (
                  <tr key={a.area}>
                    <td style={{ fontWeight: 500 }}>{a.area}</td>
                    <td>{a.total}</td>
                    <td style={{ color: 'var(--green)', fontWeight: 600 }}>{a.closed}</td>
                    <td style={{ color: 'var(--accent)', fontWeight: 700 }}>{a.rate}%</td>
                    <td style={{ color: '#16a34a' }}>{a.revenue > 0 ? `₹${a.revenue.toLocaleString()}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PRIORITY BREAKDOWN */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title">⚡ Priority Distribution</div>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={priorityData} barSize={40}>
            <XAxis dataKey="name" tick={{ fill: 'var(--text3)', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'var(--text3)', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} width={24} />
            <Tooltip contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} cursor={{ fill: 'rgba(91,82,245,0.04)' }} />
            <Bar dataKey="value" radius={[6,6,0,0]} name="Leads">
              {priorityData.map((e,i) => <Cell key={i} fill={e.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
