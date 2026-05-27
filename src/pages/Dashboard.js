/* eslint-disable */
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { StatusBadge } from '../components/Badges'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Phone, Users, TrendingUp, CheckCircle, Clock, AlertTriangle, Calendar, ArrowRight } from 'lucide-react'
import { format, isToday, isPast, parseISO } from 'date-fns'

const STAGE_COLORS = {
  new: '#3b82f6',
  called: '#f59e0b',
  interested: '#22c55e',
  demo_sent: '#a855f7',
  negotiating: '#f97316',
  closed: '#4ade80',
  dead: '#555',
}

const STAGES = ['new', 'called', 'interested', 'demo_sent', 'negotiating', 'closed', 'dead']

export default function Dashboard() {
  const navigate = useNavigate()
  const [leads, setLeads] = useState([])
  const [callLogs, setCallLogs] = useState([])
  const [reminders, setReminders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    setLoading(true)
    const [l, c, r] = await Promise.all([
      supabase.from('leads').select('*').order('created_at', { ascending: false }),
      supabase.from('call_logs').select('*').order('called_at', { ascending: false }),
      supabase.from('reminders').select('*, leads(clinic_name, doctor_name, phone)').eq('status', 'pending').order('remind_at'),
    ])
    setLeads(l.data || [])
    setCallLogs(c.data || [])
    setReminders(r.data || [])
    setLoading(false)
  }

  if (loading) return <div className="loading"><div className="spinner" /> Loading dashboard...</div>

  const total = leads.length
  const closedCount = leads.filter(l => l.status === 'closed').length
  const todayFollowUps = leads.filter(l => l.next_follow_up_date && isToday(parseISO(l.next_follow_up_date)))
  const overdueLeads = leads.filter(l => l.next_follow_up_date && isPast(parseISO(l.next_follow_up_date)) && !isToday(parseISO(l.next_follow_up_date)) && l.status !== 'closed' && l.status !== 'dead')
  const callsToday = callLogs.filter(c => isToday(new Date(c.called_at))).length
  const convRate = total > 0 ? ((closedCount / total) * 100).toFixed(1) : 0

  const pipelineData = STAGES.slice(0, -1).map(s => ({
    name: s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()),
    count: leads.filter(l => l.status === s).length,
    color: STAGE_COLORS[s],
  }))

  const overdueReminders = reminders.filter(r => isPast(new Date(r.remind_at)) && !isToday(new Date(r.remind_at)))
  const todayReminders = reminders.filter(r => isToday(new Date(r.remind_at)))

  async function markReminderDone(id) {
    await supabase.from('reminders').update({ status: 'done' }).eq('id', id)
    setReminders(prev => prev.filter(r => r.id !== id))
    window.__toast && window.__toast('Reminder marked done', 'success')
  }

  return (
    <div>
      {/* STATS */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--blue-bg)' }}><Users size={16} color="var(--blue)" /></div>
          <div className="stat-label">Total Leads</div>
          <div className="stat-value">{total}</div>
          <div className="stat-sub">All time</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--yellow-bg)' }}><Phone size={16} color="var(--yellow)" /></div>
          <div className="stat-label">Calls Today</div>
          <div className="stat-value">{callsToday}</div>
          <div className="stat-sub">Logged today</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--green-bg)' }}><TrendingUp size={16} color="var(--green)" /></div>
          <div className="stat-label">Conversion</div>
          <div className="stat-value">{convRate}%</div>
          <div className="stat-sub">{closedCount} closed</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--orange-bg)' }}><Clock size={16} color="var(--orange)" /></div>
          <div className="stat-label">Follow Ups Today</div>
          <div className="stat-value">{todayFollowUps.length}</div>
          <div className="stat-sub">{overdueLeads.length} overdue</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--green-bg)' }}><CheckCircle size={16} color="var(--green)" /></div>
          <div className="stat-label">Interested</div>
          <div className="stat-value">{leads.filter(l => l.status === 'interested').length}</div>
          <div className="stat-sub">Hot leads</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--purple-bg)' }}><Calendar size={16} color="var(--purple)" /></div>
          <div className="stat-label">Demo Sent</div>
          <div className="stat-value">{leads.filter(l => l.status === 'demo_sent').length}</div>
          <div className="stat-sub">Awaiting response</div>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* LEFT */}
        <div>
          {/* PIPELINE CHART */}
          <div className="card" style={{ marginBottom: 18 }}>
            <div className="section-title"><TrendingUp size={16} color="var(--accent2)" /> Pipeline Overview</div>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={pipelineData} barSize={32}>
                  <XAxis dataKey="name" tick={{ fill: 'var(--text3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text3)', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                    cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {pipelineData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* TODAY'S FOLLOW UPS */}
          <div className="card">
            <div className="section-header">
              <div className="section-title" style={{ marginBottom: 0 }}><Clock size={16} color="var(--yellow)" /> Today's Follow-ups</div>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/reminders')}>View All <ArrowRight size={12} /></button>
            </div>
            {todayFollowUps.length === 0 && overdueLeads.length === 0 ? (
              <div style={{ color: 'var(--text3)', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>No follow-ups scheduled for today 🎉</div>
            ) : (
              <div className="scroll-list" style={{ marginTop: 12 }}>
                {overdueLeads.slice(0, 5).map(lead => (
                  <div key={lead.id} className="reminder-item overdue" style={{ cursor: 'pointer' }} onClick={() => navigate(`/leads/${lead.id}`)}>
                    <div className="reminder-dot" style={{ background: 'var(--red)' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{lead.clinic_name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text3)' }}>{lead.doctor_name} · {lead.phone} · <span style={{ color: 'var(--red)' }}>OVERDUE</span></div>
                    </div>
                    <StatusBadge status={lead.status} />
                  </div>
                ))}
                {todayFollowUps.map(lead => (
                  <div key={lead.id} className="reminder-item today-reminder" style={{ cursor: 'pointer' }} onClick={() => navigate(`/leads/${lead.id}`)}>
                    <div className="reminder-dot" style={{ background: 'var(--yellow)' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{lead.clinic_name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text3)' }}>{lead.doctor_name} · {lead.phone} · {lead.next_action}</div>
                    </div>
                    <StatusBadge status={lead.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* ALERTS */}
          {(overdueReminders.length > 0 || todayReminders.length > 0) && (
            <div className="card">
              <div className="section-title"><AlertTriangle size={16} color="var(--red)" /> Alerts</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {overdueReminders.slice(0, 3).map(r => (
                  <div key={r.id} style={{ background: 'var(--red-bg)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--red)' }}>OVERDUE</div>
                    <div style={{ fontSize: 13, marginTop: 2 }}>{r.leads?.clinic_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{r.message}</div>
                    <button className="btn btn-sm" style={{ marginTop: 8, background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.3)' }} onClick={() => markReminderDone(r.id)}>Mark Done</button>
                  </div>
                ))}
                {todayReminders.slice(0, 3).map(r => (
                  <div key={r.id} style={{ background: 'var(--yellow-bg)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--yellow)' }}>TODAY · {format(new Date(r.remind_at), 'h:mm a')}</div>
                    <div style={{ fontSize: 13, marginTop: 2 }}>{r.leads?.clinic_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{r.message}</div>
                    <button className="btn btn-sm" style={{ marginTop: 8, background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid rgba(34,197,94,0.3)' }} onClick={() => markReminderDone(r.id)}>Mark Done</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* RECENT LEADS */}
          <div className="card">
            <div className="section-header">
              <div className="section-title" style={{ marginBottom: 0 }}><Users size={16} color="var(--accent2)" /> Recent Leads</div>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/leads')}>All <ArrowRight size={12} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
              {leads.slice(0, 7).map(lead => (
                <div key={lead.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', background: 'var(--bg3)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }} onClick={() => navigate(`/leads/${lead.id}`)}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{lead.clinic_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{lead.area}</div>
                  </div>
                  <StatusBadge status={lead.status} />
                </div>
              ))}
            </div>
          </div>

          {/* QUICK STATS */}
          <div className="card">
            <div className="section-title"><CheckCircle size={16} color="var(--green)" /> Stage Breakdown</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {STAGES.map(s => {
                const count = leads.filter(l => l.status === s).length
                const pct = total > 0 ? (count / total) * 100 : 0
                return (
                  <div key={s}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: 'var(--text2)' }}>{s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
                      <span style={{ color: 'var(--text3)' }}>{count}</span>
                    </div>
                    <div style={{ height: 4, background: 'var(--bg3)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: STAGE_COLORS[s], borderRadius: 2, transition: 'width 0.5s' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
