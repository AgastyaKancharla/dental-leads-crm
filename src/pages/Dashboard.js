/* eslint-disable */
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { StatusBadge } from '../components/Badges'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, FunnelChart, Funnel, LabelList, LineChart, Line, CartesianGrid } from 'recharts'
import { Phone, Users, TrendingUp, CheckCircle, Clock, AlertTriangle, Calendar, ArrowRight, Target, Star, MapPin, DollarSign, Zap } from 'lucide-react'
import { format, isToday, isPast, parseISO, subDays, startOfDay, isSameDay } from 'date-fns'

const STAGE_COLORS = { new: '#3b82f6', called: '#f59e0b', interested: '#22c55e', demo_sent: '#a855f7', negotiating: '#f97316', closed: '#16a34a', dead: '#9ca3af' }
const STAGES = ['new', 'called', 'interested', 'demo_sent', 'negotiating', 'closed', 'dead']

export default function Dashboard() {
  const navigate = useNavigate()
  const [leads, setLeads] = useState([])
  const [callLogs, setCallLogs] = useState([])
  const [reminders, setReminders] = useState([])
  const [target, setTarget] = useState(50)
  const [editingTarget, setEditingTarget] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [l, c, r, t] = await Promise.all([
      supabase.from('leads').select('*').order('created_at', { ascending: false }),
      supabase.from('call_logs').select('*').order('called_at', { ascending: false }),
      supabase.from('reminders').select('*, leads(clinic_name, doctor_name, phone)').eq('status', 'pending').order('remind_at'),
      supabase.from('daily_targets').select('*').eq('date', new Date().toISOString().split('T')[0]).single(),
    ])
    setLeads(l.data || [])
    setCallLogs(c.data || [])
    setReminders(r.data || [])
    if (t.data) setTarget(t.data.target_calls)
    setLoading(false)
  }

  async function saveTarget(val) {
    const today = new Date().toISOString().split('T')[0]
    await supabase.from('daily_targets').upsert({ date: today, target_calls: val }, { onConflict: 'date' })
    setTarget(val)
    setEditingTarget(false)
    window.__toast && window.__toast('Target updated!', 'success')
  }

  async function markReminderDone(id) {
    await supabase.from('reminders').update({ status: 'done' }).eq('id', id)
    setReminders(prev => prev.filter(r => r.id !== id))
    window.__toast && window.__toast('Done!', 'success')
  }

  if (loading) return <div className="loading"><div className="spinner" /> Loading dashboard...</div>

  // ── CORE METRICS ──
  const total = leads.length
  const closedLeads = leads.filter(l => l.status === 'closed')
  const closedCount = closedLeads.length
  const convRate = total > 0 ? ((closedCount / total) * 100).toFixed(1) : 0
  const totalRevenue = closedLeads.reduce((s, l) => s + (l.estimated_value || 0), 0)
  const avgDeal = closedCount > 0 ? (totalRevenue / closedCount).toFixed(0) : 0
  const hotLeads = leads.filter(l => l.status === 'interested' || l.status === 'negotiating')
  const demoSent = leads.filter(l => l.status === 'demo_sent')
  const demoSeen = leads.filter(l => l.demo_seen)
  const notCalled = leads.filter(l => l.status === 'new')

  // ── TODAY'S STATS ──
  const callsToday = callLogs.filter(c => isToday(new Date(c.called_at)))
  const callsMadeToday = callsToday.length
  const targetPct = Math.min((callsMadeToday / target) * 100, 100)
  const todayFollowUps = leads.filter(l => l.next_follow_up_date && isToday(parseISO(l.next_follow_up_date)))
  const overdueLeads = leads.filter(l => l.next_follow_up_date && isPast(parseISO(l.next_follow_up_date)) && !isToday(parseISO(l.next_follow_up_date)) && l.status !== 'closed' && l.status !== 'dead')
  const overdueReminders = reminders.filter(r => isPast(new Date(r.remind_at)) && !isToday(new Date(r.remind_at)))
  const todayReminders = reminders.filter(r => isToday(new Date(r.remind_at)))

  // ── PIPELINE DATA ──
  const pipelineData = STAGES.slice(0, -1).map(s => ({
    name: s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()),
    count: leads.filter(l => l.status === s).length,
    color: STAGE_COLORS[s],
  }))

  // ── FUNNEL DROP-OFF ──
  const funnelData = [
    { name: 'Total Leads', value: total, color: '#3b82f6' },
    { name: 'Called', value: leads.filter(l => l.status !== 'new').length, color: '#f59e0b' },
    { name: 'Interested', value: leads.filter(l => ['interested','demo_sent','negotiating','closed'].includes(l.status)).length, color: '#22c55e' },
    { name: 'Demo Sent', value: leads.filter(l => ['demo_sent','negotiating','closed'].includes(l.status)).length, color: '#a855f7' },
    { name: 'Closed', value: closedCount, color: '#16a34a' },
  ]

  // ── LAST 7 DAYS CALL ACTIVITY ──
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(new Date(), 6 - i)
    const calls = callLogs.filter(c => isSameDay(new Date(c.called_at), d))
    const interested = calls.filter(c => c.outcome === 'interested').length
    return { day: format(d, 'EEE'), calls: calls.length, interested }
  })

  // ── OUTCOME BREAKDOWN TODAY ──
  const outcomeBreakdown = ['interested','callback','not_interested','no_answer','demo_requested','closed','other'].map(o => ({
    name: o.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    value: callsToday.filter(c => c.outcome === o).length,
    color: { interested:'#22c55e', callback:'#f59e0b', not_interested:'#ef4444', no_answer:'#9ca3af', demo_requested:'#a855f7', closed:'#16a34a', other:'#6b7280' }[o]
  })).filter(o => o.value > 0)

  // ── AREA PERFORMANCE ──
  const areaMap = {}
  leads.forEach(l => {
    if (!l.area) return
    if (!areaMap[l.area]) areaMap[l.area] = { total: 0, closed: 0, interested: 0 }
    areaMap[l.area].total++
    if (l.status === 'closed') areaMap[l.area].closed++
    if (l.status === 'interested' || l.status === 'negotiating') areaMap[l.area].interested++
  })
  const areaData = Object.entries(areaMap)
    .map(([area, d]) => ({ area, ...d, rate: d.total > 0 ? ((d.closed / d.total) * 100).toFixed(0) : 0 }))
    .sort((a, b) => b.total - a.total).slice(0, 6)

  // ── TOP PRIORITY LEADS ──
  const urgentLeads = [
    ...overdueLeads.map(l => ({ ...l, urgency: 'overdue' })),
    ...todayFollowUps.map(l => ({ ...l, urgency: 'today' })),
    ...hotLeads.filter(l => !l.next_follow_up_date).map(l => ({ ...l, urgency: 'hot' }))
  ].slice(0, 8)

  const StatCard = ({ label, value, sub, icon, color, onClick }) => (
    <div className="stat-card" style={{ cursor: onClick ? 'pointer' : 'default' }} onClick={onClick}>
      <div className="stat-icon" style={{ background: `${color}18` }}>{icon}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color }}>{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )

  return (
    <div>
      {/* ── ALERT BANNER ── */}
      {(overdueLeads.length > 0 || overdueReminders.length > 0) && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => navigate('/reminders')}>
          <AlertTriangle size={16} color="var(--red)" />
          <span style={{ fontSize: 13, color: 'var(--red)', fontWeight: 600 }}>
            {overdueLeads.length} overdue follow-ups + {overdueReminders.length} overdue reminders — tap to action
          </span>
          <ArrowRight size={14} color="var(--red)" style={{ marginLeft: 'auto' }} />
        </div>
      )}

      {/* ── DAILY TARGET TRACKER ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Target size={16} color="var(--accent)" />
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14 }}>Today's Call Target</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-display)', color: targetPct >= 100 ? 'var(--green)' : 'var(--text)' }}>{callsMadeToday}</span>
            <span style={{ color: 'var(--text3)', fontSize: 14 }}>/</span>
            {editingTarget ? (
              <input type="number" defaultValue={target} autoFocus style={{ width: 60, padding: '4px 8px', border: '1.5px solid var(--accent)', borderRadius: 6, fontSize: 14, fontWeight: 700, textAlign: 'center' }}
                onBlur={e => saveTarget(parseInt(e.target.value) || 50)}
                onKeyDown={e => e.key === 'Enter' && saveTarget(parseInt(e.target.value) || 50)} />
            ) : (
              <span style={{ fontSize: 14, color: 'var(--text3)', cursor: 'pointer', textDecoration: 'underline dotted' }} onClick={() => setEditingTarget(true)}>{target} calls</span>
            )}
          </div>
        </div>
        <div style={{ height: 10, background: 'var(--bg3)', borderRadius: 99, overflow: 'hidden', border: '1px solid var(--border)' }}>
          <div style={{ height: '100%', width: `${targetPct}%`, background: targetPct >= 100 ? 'var(--green)' : targetPct >= 60 ? 'var(--accent)' : 'var(--yellow)', borderRadius: 99, transition: 'width 0.5s ease' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: 'var(--text3)' }}>
          <span>{target - callsMadeToday > 0 ? `${target - callsMadeToday} more to hit target` : '🎉 Target hit!'}</span>
          <span>{todayFollowUps.length} follow-ups due today</span>
        </div>
      </div>

      {/* ── STATS GRID ── */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(2,1fr)' }}>
        <StatCard label="Total Leads" value={total} sub={`${notCalled.length} not called`} icon={<Users size={15} color="#3b82f6" />} color="#3b82f6" onClick={() => navigate('/leads')} />
        <StatCard label="Calls Today" value={callsMadeToday} sub={`${outcomeBreakdown.length} outcomes`} icon={<Phone size={15} color="var(--yellow)" />} color="var(--yellow)" />
        <StatCard label="Hot Leads" value={hotLeads.length} sub="Interested + Negotiating" icon={<Zap size={15} color="var(--orange)" />} color="var(--orange)" onClick={() => navigate('/leads')} />
        <StatCard label="Demo Sent" value={demoSent.length} sub={`${demoSeen.length} seen`} icon={<Star size={15} color="var(--purple)" />} color="var(--purple)" />
        <StatCard label="Closed" value={closedCount} sub={`${convRate}% conversion`} icon={<CheckCircle size={15} color="var(--green)" />} color="var(--green)" />
        <StatCard label="Revenue" value={totalRevenue > 0 ? `₹${(totalRevenue/1000).toFixed(0)}k` : '—'} sub={`Avg ₹${avgDeal}`} icon={<DollarSign size={15} color="#16a34a" />} color="#16a34a" />
      </div>

      {/* ── CALL ACTIVITY — 7 DAYS ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title"><Phone size={15} color="var(--accent)" /> 7-Day Call Activity</div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={last7} barSize={20} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="day" tick={{ fill: 'var(--text3)', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'var(--text3)', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} width={24} />
            <Tooltip contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} cursor={{ fill: 'rgba(91,82,245,0.04)' }} />
            <Bar dataKey="calls" fill="var(--accent)" radius={[4,4,0,0]} name="Calls" />
            <Bar dataKey="interested" fill="var(--green)" radius={[4,4,0,0]} name="Interested" />
          </BarChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--accent)', display: 'inline-block' }} /> Calls Made</span>
          <span style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--green)', display: 'inline-block' }} /> Interested</span>
        </div>
      </div>

      {/* ── PIPELINE FUNNEL ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title"><TrendingUp size={15} color="var(--accent)" /> Conversion Funnel</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {funnelData.map((f, i) => {
            const pct = funnelData[0].value > 0 ? (f.value / funnelData[0].value) * 100 : 0
            const dropOff = i > 0 ? funnelData[i-1].value - f.value : 0
            return (
              <div key={f.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, color: 'var(--text)' }}>{f.name}</span>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    {i > 0 && dropOff > 0 && <span style={{ fontSize: 11, color: 'var(--red)' }}>-{dropOff} dropped</span>}
                    <span style={{ fontWeight: 700, color: f.color }}>{f.value} <span style={{ color: 'var(--text3)', fontWeight: 400 }}>({pct.toFixed(0)}%)</span></span>
                  </div>
                </div>
                <div style={{ height: 8, background: 'var(--bg3)', borderRadius: 99, overflow: 'hidden', border: '1px solid var(--border)' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: f.color, borderRadius: 99, transition: 'width 0.6s ease' }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── TODAY'S OUTCOMES PIE ── */}
      {outcomeBreakdown.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-title"><Phone size={15} color="var(--accent)" /> Today's Outcomes ({callsMadeToday} calls)</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <PieChart width={120} height={120}>
              <Pie data={outcomeBreakdown} cx={55} cy={55} innerRadius={30} outerRadius={55} dataKey="value" paddingAngle={2}>
                {outcomeBreakdown.map((o, i) => <Cell key={i} fill={o.color} />)}
              </Pie>
            </PieChart>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {outcomeBreakdown.map(o => (
                <div key={o.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 99, background: o.color, display: 'inline-block', flexShrink: 0 }} />
                    <span style={{ color: 'var(--text2)' }}>{o.name}</span>
                  </span>
                  <span style={{ fontWeight: 700, color: o.color }}>{o.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── AREA PERFORMANCE ── */}
      {areaData.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-title"><MapPin size={15} color="var(--accent)" /> Area Performance</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {areaData.map(a => (
              <div key={a.area}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                  <span style={{ fontWeight: 600 }}>{a.area}</span>
                  <div style={{ display: 'flex', gap: 10, color: 'var(--text3)' }}>
                    <span>{a.total} leads</span>
                    <span style={{ color: 'var(--green)', fontWeight: 600 }}>{a.closed} closed</span>
                    <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{a.rate}%</span>
                  </div>
                </div>
                <div style={{ height: 6, background: 'var(--bg3)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', height: '100%', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ width: `${a.total > 0 ? (a.closed/a.total)*100 : 0}%`, background: 'var(--green)', transition: 'width 0.5s' }} />
                    <div style={{ width: `${a.total > 0 ? (a.interested/a.total)*100 : 0}%`, background: 'var(--yellow)', transition: 'width 0.5s' }} />
                  </div>
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 14, marginTop: 4 }}>
              <span style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--green)', display: 'inline-block' }} /> Closed</span>
              <span style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--yellow)', display: 'inline-block' }} /> Interested</span>
            </div>
          </div>
        </div>
      )}

      {/* ── URGENT ACTION QUEUE ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-header">
          <div className="section-title" style={{ marginBottom: 0 }}><AlertTriangle size={15} color="var(--red)" /> Action Queue</div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/reminders')}>All <ArrowRight size={12} /></button>
        </div>
        {urgentLeads.length === 0 ? (
          <div style={{ color: 'var(--text3)', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>🎉 All clear! No urgent actions.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            {urgentLeads.map(lead => (
              <div key={lead.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: lead.urgency === 'overdue' ? '#fff8f8' : lead.urgency === 'today' ? '#fffdf5' : 'var(--bg3)', border: `1px solid ${lead.urgency === 'overdue' ? '#fecaca' : lead.urgency === 'today' ? '#fde68a' : 'var(--border)'}`, cursor: 'pointer' }} onClick={() => navigate(`/leads/${lead.id}`)}>
                <span style={{ fontSize: 16 }}>{lead.urgency === 'overdue' ? '🔴' : lead.urgency === 'today' ? '🟡' : '🔥'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.clinic_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                    {lead.urgency === 'overdue' ? '⚠️ OVERDUE' : lead.urgency === 'today' ? '📅 Today' : '🔥 Hot lead'} · {lead.next_action || lead.status}
                    {lead.last_call_notes && <span> · "{lead.last_call_notes?.slice(0, 40)}..."</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <a href={`tel:${lead.phone}`} className="btn-icon btn-sm" onClick={e => e.stopPropagation()} style={{ padding: '5px 7px' }}><Phone size={12} /></a>
                  <a href={`https://wa.me/91${lead.phone}`} target="_blank" rel="noreferrer" className="wa-btn" style={{ padding: '5px 8px', fontSize: 11 }} onClick={e => e.stopPropagation()}>WA</a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── PIPELINE STAGE BREAKDOWN ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title"><TrendingUp size={15} color="var(--accent)" /> Pipeline Breakdown</div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={pipelineData} barSize={28}>
            <XAxis dataKey="name" tick={{ fill: 'var(--text3)', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'var(--text3)', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} width={24} />
            <Tooltip contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} cursor={{ fill: 'rgba(91,82,245,0.04)' }} />
            <Bar dataKey="count" radius={[6,6,0,0]} name="Leads">
              {pipelineData.map((e, i) => <Cell key={i} fill={e.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── DEMO TRACKING ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title"><Star size={15} color="var(--purple)" /> Demo Pipeline</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {[
            { label: 'Demos Sent', value: demoSent.length, color: 'var(--purple)', bg: 'var(--purple-bg)' },
            { label: 'Seen', value: demoSeen.length, color: 'var(--green)', bg: 'var(--green-bg)' },
            { label: 'Not Seen', value: demoSent.length - demoSeen.length, color: 'var(--yellow)', bg: 'var(--yellow-bg)' },
          ].map(item => (
            <div key={item.label} style={{ background: item.bg, border: `1px solid ${item.color}30`, borderRadius: 'var(--radius-sm)', padding: '12px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-display)', color: item.color }}>{item.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{item.label}</div>
            </div>
          ))}
        </div>
        {demoSent.filter(l => !l.demo_seen).length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8, fontWeight: 600 }}>DEMOS NOT SEEN YET — FOLLOW UP:</div>
            {demoSent.filter(l => !l.demo_seen).slice(0, 4).map(l => (
              <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'var(--bg3)', borderRadius: 'var(--radius-sm)', marginBottom: 6, cursor: 'pointer' }} onClick={() => navigate(`/leads/${l.id}`)}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{l.clinic_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{l.demo_sent_date ? `Sent ${format(parseISO(l.demo_sent_date), 'dd MMM')}` : 'Demo sent'}</div>
                </div>
                <a href={`https://wa.me/91${l.phone}`} target="_blank" rel="noreferrer" className="wa-btn" style={{ fontSize: 11, padding: '4px 8px' }} onClick={e => e.stopPropagation()}>Chase</a>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── REMINDERS ── */}
      {(todayReminders.length > 0 || overdueReminders.length > 0) && (
        <div className="card">
          <div className="section-title"><Calendar size={15} color="var(--yellow)" /> Reminders Due</div>
          {[...overdueReminders, ...todayReminders].slice(0, 5).map(r => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: isPast(new Date(r.remind_at)) && !isToday(new Date(r.remind_at)) ? '#fff8f8' : '#fffdf5', border: `1px solid ${isPast(new Date(r.remind_at)) && !isToday(new Date(r.remind_at)) ? '#fecaca' : '#fde68a'}`, borderRadius: 'var(--radius-sm)', marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{r.leads?.clinic_name}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{r.message} · {format(new Date(r.remind_at), 'dd MMM, h:mm a')}</div>
              </div>
              <button className="btn btn-sm" style={{ background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid rgba(22,163,74,0.2)', fontSize: 11 }} onClick={() => markReminderDone(r.id)}>✓ Done</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
