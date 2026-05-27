/* eslint-disable */
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { StatusBadge } from '../components/Badges'
import { Bell, Clock, AlertTriangle, Phone, MessageCircle } from 'lucide-react'
import { format, isToday, isPast, isFuture, parseISO } from 'date-fns'

export default function Reminders() {
  const navigate = useNavigate()
  const [reminders, setReminders] = useState([])
  const [followUps, setFollowUps] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('today')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [r, f] = await Promise.all([
      supabase.from('reminders').select('*, leads(clinic_name, doctor_name, phone, status)').eq('status', 'pending').order('remind_at'),
      supabase.from('leads').select('*').not('next_follow_up_date', 'is', null).neq('status', 'closed').neq('status', 'dead').order('next_follow_up_date'),
    ])
    setReminders(r.data || [])
    setFollowUps(f.data || [])
    setLoading(false)
  }

  async function markDone(id) {
    await supabase.from('reminders').update({ status: 'done' }).eq('id', id)
    setReminders(prev => prev.filter(r => r.id !== id))
    window.__toast && window.__toast('Marked as done!', 'success')
  }

  async function snooze(id) {
    await supabase.from('reminders').update({ status: 'snoozed' }).eq('id', id)
    setReminders(prev => prev.filter(r => r.id !== id))
    window.__toast && window.__toast('Snoozed', 'success')
  }

  const overdueReminders = reminders.filter(r => isPast(new Date(r.remind_at)) && !isToday(new Date(r.remind_at)))
  const todayReminders = reminders.filter(r => isToday(new Date(r.remind_at)))
  const upcomingReminders = reminders.filter(r => isFuture(new Date(r.remind_at)) && !isToday(new Date(r.remind_at)))

  const overdueFollowUps = followUps.filter(l => l.next_follow_up_date && isPast(parseISO(l.next_follow_up_date)) && !isToday(parseISO(l.next_follow_up_date)))
  const todayFollowUps = followUps.filter(l => l.next_follow_up_date && isToday(parseISO(l.next_follow_up_date)))
  const upcomingFollowUps = followUps.filter(l => l.next_follow_up_date && isFuture(parseISO(l.next_follow_up_date)) && !isToday(parseISO(l.next_follow_up_date)))

  const TYPE_ICON = { call: '📞', whatsapp: '💬', meeting: '🤝', follow_up: '🔄' }

  if (loading) return <div className="loading"><div className="spinner" /> Loading...</div>

  const Section = ({ title, color, icon, children }) => (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 14, fontWeight: 700, color }}>
        {icon} {title}
      </div>
      {children}
    </div>
  )

  const ReminderCard = ({ r }) => (
    <div className={`reminder-item ${isPast(new Date(r.remind_at)) && !isToday(new Date(r.remind_at)) ? 'overdue' : isToday(new Date(r.remind_at)) ? 'today-reminder' : ''}`}>
      <div style={{ fontSize: 18 }}>{TYPE_ICON[r.type] || '🔔'}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>{r.leads?.clinic_name}</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{r.leads?.doctor_name} · {r.leads?.phone}</div>
        {r.message && <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4, fontStyle: 'italic' }}>"{r.message}"</div>}
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{format(new Date(r.remind_at), 'dd MMM yyyy, h:mm a')}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <a href={`https://wa.me/91${r.leads?.phone}`} target="_blank" rel="noreferrer" className="wa-btn btn-sm" style={{ fontSize: 11 }}><MessageCircle size={11} /> WA</a>
        <button className="btn btn-sm" style={{ background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid rgba(34,197,94,0.3)', fontSize: 11 }} onClick={() => markDone(r.id)}>✓ Done</button>
        <button className="btn btn-sm btn-ghost" style={{ fontSize: 11 }} onClick={() => snooze(r.id)}>Snooze</button>
      </div>
    </div>
  )

  const FollowUpCard = ({ lead }) => (
    <div className={`reminder-item ${isPast(parseISO(lead.next_follow_up_date)) && !isToday(parseISO(lead.next_follow_up_date)) ? 'overdue' : isToday(parseISO(lead.next_follow_up_date)) ? 'today-reminder' : ''}`}
      style={{ cursor: 'pointer' }} onClick={() => navigate(`/leads/${lead.id}`)}>
      <div style={{ fontSize: 18 }}>
        {lead.next_action === 'call' ? '📞' : lead.next_action === 'whatsapp' ? '💬' : lead.next_action === 'send_demo' ? '🖥️' : lead.next_action === 'meeting' ? '🤝' : '🔔'}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>{lead.clinic_name}</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{lead.doctor_name} · {lead.phone}</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
          <StatusBadge status={lead.status} />
          {lead.next_action && <span style={{ fontSize: 11, color: 'var(--accent2)', textTransform: 'capitalize' }}>→ {lead.next_action}</span>}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
        <div style={{ fontSize: 12, color: isPast(parseISO(lead.next_follow_up_date)) && !isToday(parseISO(lead.next_follow_up_date)) ? 'var(--red)' : 'var(--yellow)', fontWeight: 600 }}>
          {format(parseISO(lead.next_follow_up_date), 'dd MMM')}
        </div>
        <a href={`tel:${lead.phone}`} className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={e => e.stopPropagation()}><Phone size={11} /> Call</a>
        <a href={`https://wa.me/91${lead.phone}`} target="_blank" rel="noreferrer" className="wa-btn" style={{ fontSize: 11 }} onClick={e => e.stopPropagation()}><MessageCircle size={11} /> WA</a>
      </div>
    </div>
  )

  return (
    <div>
      {/* TABS */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {['today', 'followups', 'reminders'].map(t => (
          <button key={t} className={`btn ${tab === t ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab(t)}>
            {t === 'today' ? `📅 Today's Plan` : t === 'followups' ? `📋 Follow-ups` : `🔔 Reminders`}
          </button>
        ))}
      </div>

      {/* TODAY TAB */}
      {tab === 'today' && (
        <div>
          {overdueReminders.length === 0 && todayReminders.length === 0 && overdueFollowUps.length === 0 && todayFollowUps.length === 0 ? (
            <div className="empty-state"><Bell size={48} /><p>Nothing due today!</p><span>You're all caught up 🎉</span></div>
          ) : (
            <>
              {(overdueReminders.length > 0 || overdueFollowUps.length > 0) && (
                <Section title={`OVERDUE (${overdueReminders.length + overdueFollowUps.length})`} color="var(--red)" icon={<AlertTriangle size={16} />}>
                  {overdueFollowUps.map(l => <FollowUpCard key={l.id} lead={l} />)}
                  {overdueReminders.map(r => <ReminderCard key={r.id} r={r} />)}
                </Section>
              )}
              {(todayReminders.length > 0 || todayFollowUps.length > 0) && (
                <Section title={`TODAY (${todayReminders.length + todayFollowUps.length})`} color="var(--yellow)" icon={<Clock size={16} />}>
                  {todayFollowUps.map(l => <FollowUpCard key={l.id} lead={l} />)}
                  {todayReminders.map(r => <ReminderCard key={r.id} r={r} />)}
                </Section>
              )}
            </>
          )}
        </div>
      )}

      {/* FOLLOW UPS TAB */}
      {tab === 'followups' && (
        <div>
          {overdueFollowUps.length > 0 && (
            <Section title={`OVERDUE (${overdueFollowUps.length})`} color="var(--red)" icon={<AlertTriangle size={16} />}>
              {overdueFollowUps.map(l => <FollowUpCard key={l.id} lead={l} />)}
            </Section>
          )}
          {todayFollowUps.length > 0 && (
            <Section title={`TODAY (${todayFollowUps.length})`} color="var(--yellow)" icon={<Clock size={16} />}>
              {todayFollowUps.map(l => <FollowUpCard key={l.id} lead={l} />)}
            </Section>
          )}
          {upcomingFollowUps.length > 0 && (
            <Section title={`UPCOMING (${upcomingFollowUps.length})`} color="var(--text2)" icon={<Bell size={16} />}>
              {upcomingFollowUps.map(l => <FollowUpCard key={l.id} lead={l} />)}
            </Section>
          )}
          {followUps.length === 0 && <div className="empty-state"><Clock size={48} /><p>No follow-ups scheduled</p></div>}
        </div>
      )}

      {/* REMINDERS TAB */}
      {tab === 'reminders' && (
        <div>
          {overdueReminders.length > 0 && (
            <Section title={`OVERDUE (${overdueReminders.length})`} color="var(--red)" icon={<AlertTriangle size={16} />}>
              {overdueReminders.map(r => <ReminderCard key={r.id} r={r} />)}
            </Section>
          )}
          {todayReminders.length > 0 && (
            <Section title={`TODAY (${todayReminders.length})`} color="var(--yellow)" icon={<Clock size={16} />}>
              {todayReminders.map(r => <ReminderCard key={r.id} r={r} />)}
            </Section>
          )}
          {upcomingReminders.length > 0 && (
            <Section title={`UPCOMING (${upcomingReminders.length})`} color="var(--text2)" icon={<Bell size={16} />}>
              {upcomingReminders.map(r => <ReminderCard key={r.id} r={r} />)}
            </Section>
          )}
          {reminders.length === 0 && <div className="empty-state"><Bell size={48} /><p>No active reminders</p><span>Set reminders from any lead's detail page</span></div>}
        </div>
      )}
    </div>
  )
}
