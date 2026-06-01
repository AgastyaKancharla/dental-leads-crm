/* eslint-disable */
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { StatusBadge } from '../components/Badges'
import { Phone, MessageCircle, CheckCircle, ChevronRight, Target, Zap, Clock, RefreshCw } from 'lucide-react'
import LeadIntelligence from '../components/LeadIntelligence'
import { format, parseISO, isToday, isPast } from 'date-fns'

const QUICK_OUTCOMES = [
  { key: 'interested', label: '😊 Interested', color: 'var(--green)', bg: 'var(--green-bg)' },
  { key: 'callback', label: '📞 Callback', color: 'var(--yellow)', bg: 'var(--yellow-bg)' },
  { key: 'not_interested', label: '❌ Not Interested', color: 'var(--red)', bg: 'var(--red-bg)' },
  { key: 'no_answer', label: '📵 No Answer', color: 'var(--text3)', bg: 'var(--bg3)' },
  { key: 'demo_requested', label: '🖥️ Demo Req.', color: 'var(--purple)', bg: 'var(--purple-bg)' },
]

export default function CallQueue() {
  const navigate = useNavigate()
  const [queue, setQueue] = useState([])
  const [loading, setLoading] = useState(true)
  const [current, setCurrent] = useState(0)
  const [logging, setLogging] = useState(false)
  const [callNote, setCallNote] = useState('')
  const [followUpDate, setFollowUpDate] = useState('')
  const [showNoteBox, setShowNoteBox] = useState(false)
  const [doneToday, setDoneToday] = useState(0)
  const [filter, setFilter] = useState('all')
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => { fetchQueue() }, [filter])

  async function fetchQueue() {
    setLoading(true)
    let query = supabase.from('leads').select('*').neq('status', 'closed').neq('status', 'dead')

    if (filter === 'overdue') query = query.lt('next_follow_up_date', today).not('next_follow_up_date', 'is', null)
    else if (filter === 'today') query = query.eq('next_follow_up_date', today)
    else if (filter === 'new') query = query.eq('status', 'new')
    else if (filter === 'hot') query = query.in('status', ['interested', 'negotiating'])

    // Order: overdue first, then today, then by priority
    const { data } = await query.order('next_follow_up_date', { ascending: true, nullsFirst: false })

    // Smart sort: overdue > today's followup > hot > high priority > not called
    const sorted = (data || []).sort((a, b) => {
      const score = (l) => {
        if (l.next_follow_up_date && isPast(parseISO(l.next_follow_up_date)) && !isToday(parseISO(l.next_follow_up_date))) return 100
        if (l.next_follow_up_date && isToday(parseISO(l.next_follow_up_date))) return 90
        if (l.status === 'negotiating') return 80
        if (l.status === 'interested') return 70
        if (l.priority === 'high') return 60
        if (l.status === 'demo_sent') return 50
        if (l.status === 'new') return 40
        return 20
      }
      return score(b) - score(a)
    })

    // Count calls made today
    const { data: todayCalls } = await supabase.from('call_logs').select('id').gte('called_at', new Date().toISOString().split('T')[0])
    setDoneToday(todayCalls?.length || 0)
    setQueue(sorted)
    setCurrent(0)
    setLoading(false)
  }

  async function logQuickOutcome(outcome) {
    if (!queue[current]) return
    setLogging(true)
    const lead = queue[current]

    await supabase.from('call_logs').insert({
      lead_id: lead.id,
      outcome,
      notes: callNote || null,
      next_follow_up_date: followUpDate || null,
      next_action: outcome === 'interested' ? 'send_demo' : outcome === 'callback' ? 'call' : outcome === 'demo_requested' ? 'send_demo' : null,
      called_at: new Date().toISOString(),
    })

    const statusMap = { interested: 'interested', callback: 'called', not_interested: 'dead', no_answer: 'called', demo_requested: 'demo_sent' }
    await supabase.from('leads').update({
      status: statusMap[outcome] || lead.status,
      next_follow_up_date: followUpDate || lead.next_follow_up_date,
      next_action: outcome === 'callback' ? 'call' : outcome === 'interested' ? 'send_demo' : null,
    }).eq('id', lead.id)

    setDoneToday(d => d + 1)
    setCallNote('')
    setFollowUpDate('')
    setShowNoteBox(false)
    setCurrent(c => c + 1)
    setLogging(false)
    window.__toast && window.__toast(`Logged: ${outcome.replace('_', ' ')}`, 'success')
  }

  function skip() {
    setCurrent(c => c + 1)
  }

  if (loading) return <div className="loading"><div className="spinner" /> Loading queue...</div>

  const lead = queue[current]
  const remaining = queue.length - current

  const URGENCY_TAG = (lead) => {
    if (!lead) return null
    if (lead.next_follow_up_date && isPast(parseISO(lead.next_follow_up_date)) && !isToday(parseISO(lead.next_follow_up_date)))
      return <span style={{ background: 'var(--red-bg)', color: 'var(--red)', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99 }}>⚠️ OVERDUE</span>
    if (lead.next_follow_up_date && isToday(parseISO(lead.next_follow_up_date)))
      return <span style={{ background: 'var(--yellow-bg)', color: 'var(--yellow)', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99 }}>📅 TODAY</span>
    if (lead.status === 'interested' || lead.status === 'negotiating')
      return <span style={{ background: 'var(--orange-bg)', color: 'var(--orange)', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99 }}>🔥 HOT</span>
    return null
  }

  return (
    <div>
      {/* FILTERS */}
      <div style={{ display: 'flex', gap: 7, marginBottom: 14, overflowX: 'auto', paddingBottom: 4 }}>
        {[
          { key: 'all', label: 'All Queue' },
          { key: 'overdue', label: '🔴 Overdue' },
          { key: 'today', label: '📅 Today' },
          { key: 'hot', label: '🔥 Hot' },
          { key: 'new', label: '🆕 Not Called' },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} className={`btn btn-sm ${filter === f.key ? 'btn-primary' : 'btn-ghost'}`} style={{ whiteSpace: 'nowrap' }}>
            {f.label}
          </button>
        ))}
        <button className="btn btn-ghost btn-sm" onClick={fetchQueue} style={{ marginLeft: 'auto', flexShrink: 0 }}><RefreshCw size={13} /></button>
      </div>

      {/* PROGRESS BAR */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}><Target size={14} color="var(--accent)" /> Queue Progress</span>
          <span style={{ fontSize: 13, fontWeight: 700 }}><span style={{ color: 'var(--green)' }}>{doneToday}</span> done · <span style={{ color: 'var(--text3)' }}>{remaining} left</span></span>
        </div>
        <div style={{ height: 8, background: 'var(--bg3)', borderRadius: 99, overflow: 'hidden', border: '1px solid var(--border)' }}>
          <div style={{ height: '100%', width: `${queue.length > 0 ? (current / queue.length) * 100 : 0}%`, background: 'var(--accent)', borderRadius: 99, transition: 'width 0.3s' }} />
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 5 }}>{current} of {queue.length} in this session</div>
      </div>

      {/* CURRENT LEAD CARD */}
      {!lead ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 20px' }}>
          <CheckCircle size={48} color="var(--green)" style={{ margin: '0 auto 16px' }} />
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Queue Complete! 🎉</div>
          <div style={{ color: 'var(--text3)', fontSize: 14, marginBottom: 20 }}>Called {doneToday} leads today</div>
          <button className="btn btn-primary" onClick={fetchQueue}>Refresh Queue</button>
        </div>
      ) : (
        <>
          {/* LEAD INFO */}
          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                  {URGENCY_TAG(lead)}
                  <StatusBadge status={lead.status} />
                  {lead.priority === 'high' && <span style={{ background: 'var(--red-bg)', color: 'var(--red)', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99 }}>High Priority</span>}
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, marginBottom: 4, wordBreak: 'break-word' }}>{lead.clinic_name}</div>
                {lead.doctor_name && <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 2 }}>{lead.doctor_name}</div>}
                {lead.area && <div style={{ fontSize: 12, color: 'var(--text3)' }}>📍 {lead.area} {lead.rating && `· ⭐ ${lead.rating}`}</div>}
              </div>
              <button className="btn-icon" onClick={() => navigate(`/leads/${lead.id}`)} title="View full lead"><ChevronRight size={16} /></button>
            </div>

            {/* LAST CALL CONTEXT */}
            {lead.last_call_notes && (
              <div style={{ background: 'var(--yellow-bg)', border: '1px solid var(--yellow)30', borderRadius: 'var(--radius-sm)', padding: '10px 12px', marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--yellow)', fontWeight: 700, marginBottom: 3 }}>LAST CALL NOTE</div>
                <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{lead.last_call_notes}</div>
                {lead.last_called_at && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{format(new Date(lead.last_called_at), 'dd MMM, h:mm a')} · {lead.call_count} calls total</div>}
              </div>
            )}

            {/* AI INTELLIGENCE BRIEF */}
            <LeadIntelligence lead={lead} compact={true} />

            {/* CALL ACTIONS */}
            <div style={{ display: 'flex', gap: 10 }}>
              <a href={`tel:${lead.phone}`} className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                <Phone size={15} /> {lead.phone}
              </a>
              <a href={`https://wa.me/91${lead.phone}`} target="_blank" rel="noreferrer" className="wa-btn" style={{ flex: 0 }}>
                <MessageCircle size={15} />
              </a>
            </div>
          </div>

          {/* QUICK OUTCOME BUTTONS */}
          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 12 }}>Log Outcome (1 tap)</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {QUICK_OUTCOMES.map(o => (
                <button key={o.key} onClick={() => { setShowNoteBox(true) }} disabled={logging}
                  style={{ padding: '12px', background: o.bg, border: `1.5px solid ${o.color}30`, borderRadius: 'var(--radius-sm)', color: o.color, fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'all 0.15s', textAlign: 'center' }}
                  onMouseEnter={e => e.target.style.transform = 'scale(1.02)'}
                  onMouseLeave={e => e.target.style.transform = 'scale(1)'}
                  onClick={() => logQuickOutcome(o.key)}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* OPTIONAL NOTE + FOLLOW UP */}
          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 10 }}>Add Note & Follow Up (optional)</div>
            <textarea className="form-input" placeholder="What was discussed? Key points from this call..." value={callNote} onChange={e => setCallNote(e.target.value)} style={{ minHeight: 70, marginBottom: 10 }} />
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">📅 Follow Up Date</label>
              <input type="date" className="form-input" min={today} value={followUpDate} onChange={e => setFollowUpDate(e.target.value)} />
            </div>
          </div>

          {/* SKIP */}
          <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', marginBottom: 16 }} onClick={skip}>
            Skip this lead →
          </button>
        </>
      )}

      {/* UPCOMING IN QUEUE */}
      {queue.slice(current + 1, current + 4).length > 0 && (
        <div className="card">
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 10 }}>Up Next</div>
          {queue.slice(current + 1, current + 4).map((l, i) => (
            <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < 2 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--bg3)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text3)', flexShrink: 0 }}>{i + 2}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.clinic_name}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{l.area} · {l.status}</div>
              </div>
              {URGENCY_TAG(l)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
