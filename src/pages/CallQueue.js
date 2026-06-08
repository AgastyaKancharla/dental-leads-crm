/* eslint-disable */
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Phone, MessageCircle, Edit2, Trash2, CheckCircle, Clock, AlertCircle } from 'lucide-react'
import { format, parseISO, isToday, isPast, isTomorrow, isThisWeek, differenceInDays, startOfDay } from 'date-fns'

// ── QUICK LOG MODAL ──
function QuickLogModal({ lead, onDone, onClose }) {
  const OUTCOMES = ['interested','future_interested','callback','not_interested','no_answer','other']
  const OUTCOME_EMOJI = { interested:'😊', future_interested:'🔮', callback:'📞', not_interested:'❌', no_answer:'📵', other:'💬' }
  const [outcome, setOutcome] = useState('interested')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    const now = new Date().toISOString()
    // Log the call
    await supabase.from('call_logs').insert({
      lead_id: lead.id, outcome,
      notes: note || `✅ Callback completed`,
      called_at: now,
    })
    // Log note in timeline
    await supabase.from('lead_notes').insert({
      lead_id: lead.id,
      note: `📞 Callback completed — ${outcome.replace(/_/g,' ')}${note ? ': ' + note : ''}`,
      type: 'callback',
    })
    // Clear callback + update lead
    const statusMap = { interested:'interested', future_interested:'future_interested', callback:'called', not_interested:'dead', no_answer:'called', other:'called' }
    await supabase.from('leads').update({
      callback_scheduled_at: null,
      status: statusMap[outcome] || lead.status,
      last_called_at: now,
      call_count: (lead.call_count || 0) + 1,
      last_call_notes: note || `Callback completed — ${outcome.replace(/_/g,' ')}`,
    }).eq('id', lead.id)
    setSaving(false)
    window.__toast && window.__toast('Callback logged ✅', 'success')
    onDone()
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>✅ Log Callback — {lead.clinic_name}</h2>
          <button className="btn-icon" onClick={onClose} style={{ fontSize: 18 }}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">How did it go?</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {OUTCOMES.map(o => (
                <button key={o} onClick={() => setOutcome(o)}
                  style={{ padding: '7px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                    background: outcome === o ? 'var(--accent-glow2)' : 'var(--bg3)',
                    color: outcome === o ? 'var(--accent2)' : 'var(--text3)',
                    border: `1.5px solid ${outcome === o ? 'var(--accent)' : 'var(--border)'}`,
                  }}>
                  {OUTCOME_EMOJI[o]} {o.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Quick Note (optional)</label>
            <textarea className="form-input" rows={3} placeholder="What was discussed..." value={note} onChange={e => setNote(e.target.value)} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : '✅ Mark Done'}</button>
        </div>
      </div>
    </div>
  )
}

// ── RESCHEDULE MODAL ──
function RescheduleModal({ lead, onSave, onClose }) {
  const today = new Date().toISOString().split('T')[0]
  const current = lead.callback_scheduled_at ? new Date(lead.callback_scheduled_at) : new Date()
  const [date, setDate] = useState(() => {
    const d = current
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  })
  const [time, setTime] = useState(() => {
    const d = current
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  })
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!date) { window.__toast && window.__toast('Pick a date', 'error'); return }
    setSaving(true)
    const scheduledAt = `${date}T${time || '10:00'}:00+05:30`
    await supabase.from('leads').update({
      callback_scheduled_at: scheduledAt,
      next_follow_up_date: date,
      next_action: 'call',
    }).eq('id', lead.id)
    await supabase.from('lead_notes').insert({
      lead_id: lead.id,
      note: `🔄 Callback rescheduled to ${format(new Date(scheduledAt), 'dd MMM, h:mm a')}`,
      type: 'callback',
    })
    setSaving(false)
    window.__toast && window.__toast(`Rescheduled to ${format(new Date(scheduledAt), 'dd MMM, h:mm a')}`, 'success')
    onSave()
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🔄 Reschedule — {lead.clinic_name}</h2>
          <button className="btn-icon" onClick={onClose} style={{ fontSize: 18 }}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-row" style={{ marginBottom: 14 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">New Date</label>
              <input type="date" className="form-input" min={today} value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Time</label>
              <input type="time" className="form-input" value={time} onChange={e => setTime(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[{ l: 'Tomorrow', d: 1 }, { l: '3 days', d: 3 }, { l: '1 week', d: 7 }, { l: '2 weeks', d: 14 }].map(o => {
              const d = new Date(); d.setDate(d.getDate() + o.d)
              const val = d.toISOString().split('T')[0]
              return <button key={o.l} onClick={() => setDate(val)}
                style={{ padding: '5px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  background: date === val ? 'var(--accent-glow2)' : 'var(--bg3)',
                  color: date === val ? 'var(--accent2)' : 'var(--text3)',
                  border: `1px solid ${date === val ? 'var(--accent)' : 'var(--border)'}`,
                }}>{o.l}</button>
            })}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Reschedule'}</button>
        </div>
      </div>
    </div>
  )
}

// ── CALLBACK CARD ──
function CallbackCard({ lead, onRefresh }) {
  const navigate = useNavigate()
  const [showLog, setShowLog] = useState(false)
  const [showReschedule, setShowReschedule] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const scheduled = new Date(lead.callback_scheduled_at)
  const isOverdue = isPast(scheduled) && !isToday(scheduled)
  const isTodayFlag = isToday(scheduled)
  const daysOver = isOverdue ? differenceInDays(new Date(), scheduled) : 0

  async function deleteCallback() {
    if (!window.confirm(`Remove callback for ${lead.clinic_name}?`)) return
    setDeleting(true)
    await supabase.from('leads').update({
      callback_scheduled_at: null,
    }).eq('id', lead.id)
    await supabase.from('lead_notes').insert({
      lead_id: lead.id,
      note: `🗑️ Callback removed (was scheduled for ${format(scheduled, 'dd MMM, h:mm a')})`,
      type: 'note',
    })
    window.__toast && window.__toast('Callback removed', 'success')
    setDeleting(false)
    onRefresh()
  }

  const borderColor = isOverdue ? 'rgba(248,113,113,0.5)' : isTodayFlag ? 'rgba(251,191,36,0.5)' : 'var(--border)'
  const glowShadow = isOverdue ? '0 0 0 1.5px rgba(248,113,113,0.3), 0 4px 20px rgba(248,113,113,0.1)'
    : isTodayFlag ? '0 0 0 1.5px rgba(251,191,36,0.3), 0 4px 20px rgba(251,191,36,0.1)'
    : 'var(--shadow)'

  return (
    <>
      <div style={{ background: 'var(--bg2)', border: `1.5px solid ${borderColor}`, borderRadius: 'var(--radius)', padding: '14px 16px', boxShadow: glowShadow }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 3 }}>
              <span onClick={() => navigate(`/leads/${lead.id}`)} style={{ fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>{lead.clinic_name}</span>
              {isOverdue && <span style={{ fontSize: 10, fontWeight: 700, background: 'var(--red-bg)', color: 'var(--red)', padding: '2px 7px', borderRadius: 99, border: '1px solid rgba(248,113,113,0.2)' }}>🔴 {daysOver}d overdue</span>}
              {isTodayFlag && <span style={{ fontSize: 10, fontWeight: 700, background: 'var(--yellow-bg)', color: 'var(--yellow)', padding: '2px 7px', borderRadius: 99, border: '1px solid rgba(251,191,36,0.2)' }}>📅 Today</span>}
              {lead.priority && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
                background: lead.priority==='high'?'var(--red-bg)':lead.priority==='medium'?'var(--orange-bg)':'var(--green-bg)',
                color: lead.priority==='high'?'var(--red)':lead.priority==='medium'?'var(--orange)':'var(--green)',
              }}>{lead.priority==='high'?'🔴':lead.priority==='medium'?'🟠':'🟢'} {lead.priority}</span>}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {lead.doctor_name && <span>{lead.doctor_name}</span>}
              {lead.area && <span>📍 {lead.area}</span>}
              <span style={{ color: isOverdue ? 'var(--red)' : isTodayFlag ? 'var(--yellow)' : 'var(--text3)', fontWeight: isOverdue || isTodayFlag ? 700 : 400 }}>
                🕐 {format(scheduled, 'dd MMM, h:mm a')}
              </span>
            </div>
          </div>
        </div>

        {/* Last note */}
        {(lead.last_call_notes || lead.notes) && (
          <div style={{ fontSize: 11, color: 'var(--text3)', background: 'var(--bg3)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', marginBottom: 10, borderLeft: '2px solid var(--border2)' }}>
            💬 {(lead.last_call_notes || lead.notes).slice(0, 120)}{(lead.last_call_notes || lead.notes).length > 120 ? '...' : ''}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <a href={`tel:${lead.phone}`} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', background: 'var(--accent)', color: 'white', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 600, flex: 1, justifyContent: 'center' }}>
            <Phone size={13}/> Call
          </a>
          <a href={`https://wa.me/91${lead.phone}`} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', background: '#16a34a', color: 'white', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 600, flex: 1, justifyContent: 'center' }}>
            <MessageCircle size={13}/> WhatsApp
          </a>
          <button onClick={() => setShowLog(true)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 700, cursor: 'pointer', flex: 1, justifyContent: 'center' }}>
            <CheckCircle size={13}/> Done
          </button>
        </div>

        {/* Secondary actions */}
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          <button onClick={() => setShowReschedule(true)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: 'var(--bg3)', color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 11, fontWeight: 600, cursor: 'pointer', flex: 1, justifyContent: 'center' }}>
            <Edit2 size={11}/> Reschedule
          </button>
          <button onClick={deleteCallback} disabled={deleting} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 'var(--radius-sm)', fontSize: 11, fontWeight: 600, cursor: 'pointer', flex: 1, justifyContent: 'center' }}>
            <Trash2 size={11}/> {deleting ? 'Removing...' : 'Remove'}
          </button>
        </div>
      </div>

      {showLog && <QuickLogModal lead={lead} onDone={onRefresh} onClose={() => setShowLog(false)} />}
      {showReschedule && <RescheduleModal lead={lead} onSave={onRefresh} onClose={() => setShowReschedule(false)} />}
    </>
  )
}

// ── MAIN PAGE ──
export default function CallQueue() {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchCallbacks() }, [])

  async function fetchCallbacks() {
    setLoading(true)
    const { data } = await supabase
      .from('leads')
      .select('*')
      .not('callback_scheduled_at', 'is', null)
      .order('callback_scheduled_at', { ascending: true })
    setLeads(data || [])
    setLoading(false)
  }

  if (loading) return <div className="loading"><div className="spinner"/> Loading call queue...</div>

  // Group leads
  const overdue = leads.filter(l => isPast(new Date(l.callback_scheduled_at)) && !isToday(new Date(l.callback_scheduled_at)))
  const today = leads.filter(l => isToday(new Date(l.callback_scheduled_at)))
  const upcoming = leads.filter(l => !isPast(new Date(l.callback_scheduled_at)) && !isToday(new Date(l.callback_scheduled_at)))

  // Group upcoming by date
  const upcomingByDate = {}
  upcoming.forEach(l => {
    const dateKey = startOfDay(new Date(l.callback_scheduled_at)).toISOString()
    if (!upcomingByDate[dateKey]) upcomingByDate[dateKey] = []
    upcomingByDate[dateKey].push(l)
  })

  const totalCount = leads.length

  function SectionHeader({ emoji, title, count, color }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 15 }}>{emoji}</span>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</span>
        {count > 0 && <span style={{ marginLeft: 'auto', background: color || 'var(--accent)', color: 'white', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99 }}>{count}</span>}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, marginBottom: 4 }}>
          📞 Call Queue
        </div>
        <div style={{ fontSize: 13, color: 'var(--text3)' }}>
          {totalCount === 0 ? 'No callbacks scheduled' : `${totalCount} callback${totalCount > 1 ? 's' : ''} scheduled`}
          {overdue.length > 0 && <span style={{ color: 'var(--red)', fontWeight: 700 }}> · {overdue.length} overdue</span>}
          {today.length > 0 && <span style={{ color: 'var(--yellow)', fontWeight: 700 }}> · {today.length} today</span>}
        </div>
      </div>

      {/* Empty state */}
      {totalCount === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text3)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--text2)', marginBottom: 8 }}>Queue is empty</div>
          <div style={{ fontSize: 13 }}>When someone asks you to call back, open their lead and schedule a callback. It'll appear here.</div>
        </div>
      )}

      {/* Overdue */}
      {overdue.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <SectionHeader emoji="🔴" title="Overdue" count={overdue.length} color="var(--red)" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {overdue.map(l => <CallbackCard key={l.id} lead={l} onRefresh={fetchCallbacks} />)}
          </div>
        </div>
      )}

      {/* Today */}
      {today.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <SectionHeader emoji="📅" title="Today" count={today.length} color="var(--yellow)" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {today.map(l => <CallbackCard key={l.id} lead={l} onRefresh={fetchCallbacks} />)}
          </div>
        </div>
      )}

      {/* Upcoming grouped by date */}
      {Object.keys(upcomingByDate).length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <SectionHeader emoji="🗓️" title="Upcoming" count={upcoming.length} color="var(--accent)" />
          {Object.entries(upcomingByDate).map(([dateKey, dayLeads]) => {
            const d = new Date(dateKey)
            const label = isTomorrow(d) ? 'Tomorrow' : isThisWeek(d) ? format(d, 'EEEE') : format(d, 'dd MMM')
            return (
              <div key={dateKey} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{label}</span>
                  <span style={{ background: 'var(--bg3)', border: '1px solid var(--border)', padding: '1px 7px', borderRadius: 99, fontSize: 10 }}>{dayLeads.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {dayLeads.map(l => <CallbackCard key={l.id} lead={l} onRefresh={fetchCallbacks} />)}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
