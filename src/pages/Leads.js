/* eslint-disable */
import React, { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { StatusBadge } from '../components/Badges'
import { Search, MessageCircle, X, Users, Plus, Phone, CheckSquare, Square, Bell, ChevronDown } from 'lucide-react'
import { format, parseISO, differenceInDays, isToday, isPast } from 'date-fns'
import { generateLeadIntelligence } from '../lib/intelligence'

import { STATUSES, STATUS_MAP as STATUS_MAP_LIB, BUCKET_HOT, BUCKET_PARKED, BUCKET_CLOSED, STATUS_EMOJI, NEXT_ACTION_MAP, STATUS_NEXT_ACTION } from '../lib/statuses'
const PRIORITIES = ['', 'high', 'medium', 'low']
const AREAS = ['', 'Koramangala', 'Indiranagar', 'Whitefield', 'HSR Layout', 'JP Nagar', 'Jayanagar', 'BTM Layout', 'Electronic City', 'Marathahalli', 'Bannerghatta Road', 'Yelahanka', 'Hebbal', 'Rajajinagar', 'Malleshwaram', 'RT Nagar', 'Other']
const EMPTY_LEAD = { clinic_name: '', doctor_name: '', phone: '', area: '', rating: '', status: 'new', priority: 'medium', notes: '', next_follow_up_date: '', next_action: '', email: '', best_time_to_call: '', tags: '' }
const today = new Date().toISOString().split('T')[0]

const OUTCOMES = ['interested', 'future_interested', 'callback', 'not_interested', 'no_answer', 'missed', 'demo_requested', 'quote_sent', 'closed', 'other']
const OUTCOME_EMOJI = { interested: '😊', future_interested: '🔮', callback: '📞', not_interested: '❌', no_answer: '📵', missed: '📵', demo_requested: '🖥️', quote_sent: '💰', closed: '✅', other: '💬' }
const OUTCOME_LABEL = { interested: 'Interested', future_interested: 'Future', callback: 'Callback', not_interested: 'Not Interested', no_answer: 'No Answer', missed: 'Missed', demo_requested: 'Demo Req', quote_sent: 'Quote Sent', closed: 'Closed', other: 'Other' }

// Priority left-border color
const PRI_BORDER = { high: '#f87171', medium: '#fb923c', low: '#34d399' }
const PRI_GLOW   = { high: 'rgba(248,113,113,0.13)', medium: 'rgba(251,146,60,0.10)', low: 'rgba(52,211,153,0.08)' }

// Quick-log outcome colors
const OC_STYLE = {
  interested:       { bg: 'rgba(52,211,153,0.15)',  color: '#34d399',  border: 'rgba(52,211,153,0.3)' },
  future_interested:{ bg: 'rgba(96,165,250,0.12)',  color: '#60a5fa',  border: 'rgba(96,165,250,0.25)' },
  callback:         { bg: 'rgba(251,191,36,0.12)',  color: '#fbbf24',  border: 'rgba(251,191,36,0.25)' },
  not_interested:   { bg: 'rgba(248,113,113,0.12)', color: '#f87171',  border: 'rgba(248,113,113,0.25)' },
  no_answer:        { bg: 'rgba(77,84,112,0.25)',   color: '#9ca3c0',  border: 'rgba(77,84,112,0.4)' },
  missed:           { bg: 'rgba(248,113,113,0.10)', color: '#f87171',  border: 'rgba(248,113,113,0.2)' },
  demo_requested:   { bg: 'rgba(192,132,252,0.12)', color: '#c084fc',  border: 'rgba(192,132,252,0.25)' },
  closed:           { bg: 'rgba(52,211,153,0.2)',   color: '#34d399',  border: 'rgba(52,211,153,0.4)' },
}

// Status → auto-update map (same as LeadDetail)
const STATUS_MAP = STATUS_MAP_LIB
const AUTO_FOLLOW = { interested:1, callback:2, demo_requested:1, no_answer:1, future_interested:30, missed:1 }
const AUTO_ACTION = { interested:'send_demo', callback:'call', demo_requested:'send_demo', no_answer:'call', future_interested:'call', missed:'call' }

// ── SECTION BUCKETS ──
function bucketLeads(leads) {
  const now = new Date()
  const urgent = [], followToday = [], hot = [], parked = [], rest = []

  for (const l of leads) {
    const status = l.status
    if (BUCKET_CLOSED.includes(status)) { rest.push(l); continue }

    const followDate = l.next_follow_up_date ? parseISO(l.next_follow_up_date) : null
    const overdue = followDate && isPast(followDate) && !isToday(followDate)
    const dueToday = followDate && isToday(followDate)

    if (overdue) { urgent.push(l); continue }
    if (dueToday) { followToday.push(l); continue }
    if (BUCKET_HOT.includes(status)) { hot.push(l); continue }
    if (BUCKET_PARKED.includes(status)) { parked.push(l); continue }
    rest.push(l)
  }

  return { urgent, followToday, hot, parked, rest }
}

// ── OUTCOME RULES (same as LeadDetail) ──
const OUTCOME_RULES = {
  // Not connected — no priority change
  no_answer:        { status: 'not_reachable',     next_action: 'call',      days: 1,   label: 'No Answer',             priority: null,     archive: false },
  switched_off:     { status: 'not_reachable',     next_action: 'call',      days: 1,   label: 'Switched Off',          priority: null,     archive: false },
  wrong_number:     { status: 'wrong_number',      next_action: null,        days: null, label: 'Wrong Number',          priority: null,     archive: true  },
  voicemail:        { status: 'not_reachable',     next_action: 'call',      days: 1,   label: 'Voicemail',             priority: null,     archive: false },
  // Receptionist — no priority change
  dr_busy:          { status: 'gatekeeper',        next_action: 'call',      days: 1,   label: 'Dr Busy',               priority: null,     archive: false },
  dr_not_well:      { status: 'gatekeeper',        next_action: 'call',      days: 2,   label: 'Dr Not Well',           priority: null,     archive: false },
  gatekeeper_block: { status: 'gatekeeper',        next_action: 'call',      days: 2,   label: 'Gatekeeper Blocking',   priority: null,     archive: false },
  // Doctor — dead → archive
  not_interested:   { status: 'dead',              next_action: null,        days: null, label: 'Not Interested',        priority: null,     archive: true  },
  happy_current:    { status: 'future_interested', next_action: 'call',      days: 90,  label: 'Happy with Current',    priority: 'low',    archive: false },
  // Doctor — soft maybe → medium
  silent_audit:     { status: 'called',            next_action: 'whatsapp',  days: 1,   label: 'Silent — Send Audit',   priority: 'medium', archive: false },
  // Doctor — interested but blocked → medium
  renovation:       { status: 'renovation',        next_action: 'call',      days: 30,  label: 'Renovation',            priority: 'medium', archive: false },
  relocation:       { status: 'out_of_city',       next_action: 'call',      days: 21,  label: 'Relocating',            priority: 'medium', archive: false },
  partner_approval: { status: 'partner_approval',  next_action: 'call',      days: 5,   label: 'Partner Approval',      priority: 'medium', archive: false },
  dr_occupied:      { status: 'gatekeeper',        next_action: 'call',      days: 3,   label: 'Dr Occupied',           priority: null,     archive: false },
  future_interest:  { status: 'future_interested', next_action: 'call',      days: 60,  label: 'Future Interest',       priority: 'medium', archive: false },
  // Doctor — moving forward → high
  wants_audit:      { status: 'called',            next_action: 'whatsapp',  days: 1,   label: 'Wants Audit',           priority: 'high',   archive: false },
  wants_demo:       { status: 'demo_sent',         next_action: 'follow_up', days: 2,   label: 'Wants Demo',            priority: 'high',   archive: false },
  wants_quote:      { status: 'quote_sent',        next_action: 'follow_up', days: 1,   label: 'Wants Quote',           priority: 'high',   archive: false },
  meeting_fixed:    { status: 'negotiating',       next_action: 'meeting',   days: 1,   label: 'Meeting Fixed',         priority: 'high',   archive: false },
  paid_advance:     { status: 'closed',            next_action: null,        days: null, label: 'Paid Advance',          priority: 'high',   archive: false },
}

function addDaysLocal(date, days) {
  const d = new Date(date); d.setDate(d.getDate() + days); return d
}

// ── QUICK LOG MODAL (3-step, thumb-friendly) ──
function QuickLogModal({ lead, onSave, onClose }) {
  const [step, setStep] = useState(1)
  const [happened, setHappened] = useState(null)
  const [outcome, setOutcome] = useState(null)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const BIG_BTN = ({ onClick, selected, emoji, label, sub, color }) => (
    <button onClick={onClick} style={{
      width: '100%', padding: '14px 16px', borderRadius: 12,
      border: `2px solid ${selected ? color : 'var(--border)'}`,
      background: selected ? `${color}18` : 'var(--bg3)',
      color: selected ? color : 'var(--text)',
      fontSize: 14, fontWeight: 700, cursor: 'pointer', textAlign: 'left',
      display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8,
    }}>
      <span style={{ fontSize: 20 }}>{emoji}</span>
      <div style={{ flex: 1 }}>
        <div>{label}</div>
        {sub && <div style={{ fontSize: 11, fontWeight: 400, opacity: 0.7, marginTop: 2 }}>{sub}</div>}
      </div>
      {selected && <span style={{ color }}>✓</span>}
    </button>
  )

  async function save() {
    if (!outcome) return
    const rule = OUTCOME_RULES[outcome]
    if (!rule) return
    setSaving(true)
    const now = new Date().toISOString()
    const followUpDate = rule.days ? addDaysLocal(new Date(), rule.days).toISOString().split('T')[0] : null
    await supabase.from('call_logs').insert({ lead_id: lead.id, outcome, notes: note || rule.label, called_at: now })
    await supabase.from('lead_notes').insert({ lead_id: lead.id, note: `📞 ${rule.label}${note ? ' — ' + note : ''}`, type: 'call' })
    const leadUpdate = {
      status: rule.status, last_called_at: now,
      call_count: (lead.call_count || 0) + 1,
      next_action: rule.next_action,
      next_follow_up_date: followUpDate,
      last_call_notes: note || rule.label,
    }
    if (rule.priority) leadUpdate.priority = rule.priority
    if (rule.archive) leadUpdate.archived = true
    await supabase.from('leads').update(leadUpdate).eq('id', lead.id)
    setSaving(false)
    window.__toast && window.__toast('Call logged ✅', 'success')
    onSave(); onClose()
  }

  const rule = outcome ? OUTCOME_RULES[outcome] : null
  const autoFollowDate = rule?.days ? addDaysLocal(new Date(), rule.days) : null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 460, borderRadius: 20 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>Log Call</div>
            <h2 style={{ fontSize: 15, margin: 0 }}>{lead.clinic_name}</h2>
          </div>
          <button className="btn-icon" onClick={onClose} style={{ fontSize: 20 }}>×</button>
        </div>
        <div className="modal-body">
          {step === 1 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', marginBottom: 12, textTransform: 'uppercase' }}>What happened?</div>
              <BIG_BTN emoji="📵" label="Not Connected" sub="No answer, switched off, wrong number" color="#f87171" selected={happened === 'not_connected'} onClick={() => setHappened('not_connected')} />
              <BIG_BTN emoji="🚧" label="Reached Receptionist" sub="Doctor blocked or unavailable" color="#fb923c" selected={happened === 'receptionist'} onClick={() => setHappened('receptionist')} />
              <BIG_BTN emoji="📞" label="Reached Doctor" sub="Spoke with decision maker" color="#34d399" selected={happened === 'doctor'} onClick={() => setHappened('doctor')} />
              {happened && <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 4 }} onClick={() => setStep(2)}>Next →</button>}
            </div>
          )}
          {step === 2 && happened === 'not_connected' && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', marginBottom: 12, textTransform: 'uppercase' }}>Why not connected?</div>
              <BIG_BTN emoji="🔇" label="No Answer" color="#9ca3af" selected={outcome === 'no_answer'} onClick={() => setOutcome('no_answer')} />
              <BIG_BTN emoji="📴" label="Switched Off" color="#9ca3af" selected={outcome === 'switched_off'} onClick={() => setOutcome('switched_off')} />
              <BIG_BTN emoji="❓" label="Wrong Number" color="#f87171" selected={outcome === 'wrong_number'} onClick={() => setOutcome('wrong_number')} />
              <BIG_BTN emoji="📬" label="Voicemail" color="#9ca3af" selected={outcome === 'voicemail'} onClick={() => setOutcome('voicemail')} />
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { setStep(1); setOutcome(null) }}>Back</button>
                {outcome && <button className="btn btn-primary" style={{ flex: 2, justifyContent: 'center' }} onClick={() => setStep(3)}>Next →</button>}
              </div>
            </div>
          )}
          {step === 2 && happened === 'receptionist' && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', marginBottom: 12, textTransform: 'uppercase' }}>What did receptionist say?</div>
              <BIG_BTN emoji="⏰" label="Doctor is Busy" sub="Call back later" color="#fb923c" selected={outcome === 'dr_busy'} onClick={() => setOutcome('dr_busy')} />
              <BIG_BTN emoji="🤒" label="Doctor is Unwell" color="#fb923c" selected={outcome === 'dr_not_well'} onClick={() => setOutcome('dr_not_well')} />
              <BIG_BTN emoji="🚫" label="Can't Reach Doctor" sub="Always blocking" color="#f87171" selected={outcome === 'gatekeeper_block'} onClick={() => setOutcome('gatekeeper_block')} />
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { setStep(1); setOutcome(null) }}>Back</button>
                {outcome && <button className="btn btn-primary" style={{ flex: 2, justifyContent: 'center' }} onClick={() => setStep(3)}>Next →</button>}
              </div>
            </div>
          )}
          {step === 2 && happened === 'doctor' && (
            <div style={{ maxHeight: '55vh', overflowY: 'auto' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', marginBottom: 8, textTransform: 'uppercase' }}>How did it go?</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', marginBottom: 6, opacity: 0.7 }}>NOT MOVING FORWARD</div>
              <BIG_BTN emoji="❌" label="Not Interested" sub="Hard no" color="#f87171" selected={outcome === 'not_interested'} onClick={() => setOutcome('not_interested')} />
              <BIG_BTN emoji="😐" label="Silent — Sending Audit" sub="Will send audit on WhatsApp" color="#9ca3af" selected={outcome === 'silent_audit'} onClick={() => setOutcome('silent_audit')} />
              <BIG_BTN emoji="✅" label="Happy with Current" sub="Not looking to change" color="#9ca3af" selected={outcome === 'happy_current'} onClick={() => setOutcome('happy_current')} />
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', margin: '12px 0 6px', opacity: 0.7 }}>INTERESTED BUT BLOCKED</div>
              <BIG_BTN emoji="🏗️" label="Renovation" color="#fbbf24" selected={outcome === 'renovation'} onClick={() => setOutcome('renovation')} />
              <BIG_BTN emoji="✈️" label="Relocating" color="#fbbf24" selected={outcome === 'relocation'} onClick={() => setOutcome('relocation')} />
              <BIG_BTN emoji="🤝" label="Partner Approval" color="#fbbf24" selected={outcome === 'partner_approval'} onClick={() => setOutcome('partner_approval')} />
              <BIG_BTN emoji="📅" label="Doctor Too Busy" color="#fbbf24" selected={outcome === 'dr_occupied'} onClick={() => setOutcome('dr_occupied')} />
              <BIG_BTN emoji="🔮" label="Future Interest" sub="3–6 months" color="#fbbf24" selected={outcome === 'future_interest'} onClick={() => setOutcome('future_interest')} />
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', margin: '12px 0 6px', opacity: 0.7 }}>MOVING FORWARD</div>
              <BIG_BTN emoji="📋" label="Wants Audit" sub="Send on WhatsApp" color="#34d399" selected={outcome === 'wants_audit'} onClick={() => setOutcome('wants_audit')} />
              <BIG_BTN emoji="🖥️" label="Wants Demo" color="#34d399" selected={outcome === 'wants_demo'} onClick={() => setOutcome('wants_demo')} />
              <BIG_BTN emoji="💰" label="Wants Quote" color="#34d399" selected={outcome === 'wants_quote'} onClick={() => setOutcome('wants_quote')} />
              <BIG_BTN emoji="🤝" label="Meeting Fixed" color="#60a5fa" selected={outcome === 'meeting_fixed'} onClick={() => setOutcome('meeting_fixed')} />
              <BIG_BTN emoji="🎉" label="Paid Advance" sub="Closed!" color="#a78bfa" selected={outcome === 'paid_advance'} onClick={() => setOutcome('paid_advance')} />
              <div style={{ display: 'flex', gap: 8, marginTop: 4, position: 'sticky', bottom: 0, background: 'var(--bg)', paddingTop: 8 }}>
                <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { setStep(1); setOutcome(null) }}>Back</button>
                {outcome && <button className="btn btn-primary" style={{ flex: 2, justifyContent: 'center' }} onClick={() => setStep(3)}>Next →</button>}
              </div>
            </div>
          )}
          {step === 3 && rule && (
            <div>
              <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>Auto-set for you</div>
                <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <div><span style={{ color: 'var(--text3)' }}>Status: </span><strong>{rule.status?.replace(/_/g, ' ')}</strong></div>
                  {rule.next_action && <div><span style={{ color: 'var(--text3)' }}>Next: </span><strong>{rule.next_action?.replace(/_/g, ' ')}</strong></div>}
                  {autoFollowDate
                    ? <div><span style={{ color: 'var(--text3)' }}>Follow up: </span><strong>{autoFollowDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong></div>
                    : <div style={{ color: 'var(--text3)' }}>No follow up needed</div>}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Note (optional)</label>
                <textarea className="form-input" placeholder="e.g. Dr said call after Diwali..." value={note} onChange={e => setNote(e.target.value)} rows={2} style={{ resize: 'none' }} />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setStep(2)}>Back</button>
                <button className="btn btn-primary" style={{ flex: 2, justifyContent: 'center' }} onClick={save} disabled={saving}>
                  {saving ? 'Saving...' : '✅ Done'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── LEAD CARD ──
function LeadCard({ lead, onQuickLog, onClick, onCallback }) {
  const priority = lead.priority || 'medium'
  const borderColor = PRI_BORDER[priority] || 'var(--border)'
  const glowBg = PRI_GLOW[priority] || 'var(--bg2)'

  const followDate = lead.next_follow_up_date ? parseISO(lead.next_follow_up_date) : null
  const isOverdue = followDate && isPast(followDate) && !isToday(followDate)
  const dueToday = followDate && isToday(followDate)
  const daysOver = isOverdue ? differenceInDays(new Date(), followDate) : 0
  const daysSinceCall = lead.last_called_at ? differenceInDays(new Date(), new Date(lead.last_called_at)) : null
  const hasCallback = !!lead.callback_scheduled_at
  const callbackPast = hasCallback && isPast(new Date(lead.callback_scheduled_at))
  const contextNote = lead.last_call_notes || lead.notes || null

  // Next action: prefer saved next_action field, fall back to status default
  const nextAction = (!BUCKET_CLOSED.includes(lead.status))
    ? STATUS_NEXT_ACTION[lead.status]
    : null

  return (
    <div
      onClick={onClick}
      style={{
        background: glowBg,
        border: `1px solid var(--border)`,
        borderLeft: `3.5px solid ${borderColor}`,
        borderRadius: 'var(--radius)',
        padding: '13px 14px',
        cursor: 'pointer',
        boxShadow: 'var(--shadow)',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        marginBottom: 8,
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.borderLeftColor = borderColor }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.borderLeftColor = borderColor }}
    >
      {/* ROW 1: name + status badge */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontWeight: 700, fontSize: 14, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {lead.clinic_name}
          </span>
          {lead.doctor_name && (
            <span style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginTop: 1 }}>
              {lead.doctor_name}{lead.area ? ` · 📍 ${lead.area}` : ''}
            </span>
          )}
        </div>
        <StatusBadge status={lead.status} />
      </div>

      {/* ROW 2: urgency line */}
      {(isOverdue || dueToday || hasCallback || daysSinceCall !== null) && (
        <div style={{ display: 'flex', gap: 10, fontSize: 11, flexWrap: 'wrap', marginBottom: 6 }}>
          {isOverdue && (
            <span style={{ color: 'var(--red)', fontWeight: 700 }}>
              🔴 OVERDUE {daysOver}d · {format(followDate, 'dd MMM')}
            </span>
          )}
          {dueToday && !isOverdue && (
            <span style={{ color: 'var(--yellow)', fontWeight: 700 }}>📅 Today</span>
          )}
          {hasCallback && (
            <span style={{ color: callbackPast ? 'var(--red)' : 'var(--yellow)', fontWeight: 700 }}>
              🔔 Callback: {format(new Date(lead.callback_scheduled_at), 'dd MMM, h:mm a')}
            </span>
          )}
          {daysSinceCall !== null && (
            <span style={{ color: daysSinceCall > 14 ? 'var(--red)' : daysSinceCall > 7 ? 'var(--yellow)' : 'var(--text3)' }}>
              📞 {daysSinceCall === 0 ? 'Called today' : `${daysSinceCall}d ago`} ({lead.call_count || 0})
            </span>
          )}
        </div>
      )}

      {/* ROW 3: last note — the context line */}
      {contextNote && (
        <div style={{
          fontSize: 12, color: 'var(--text2)',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '7px 10px',
          marginBottom: 10,
          lineHeight: 1.5,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          💬 {contextNote}
        </div>
      )}

      {/* ROW 3b: next action pill */}
      {nextAction && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          background: 'rgba(124,106,247,0.10)',
          border: '1px solid rgba(124,106,247,0.22)',
          borderRadius: 99,
          padding: '4px 10px',
          marginBottom: 8,
          fontSize: 11, fontWeight: 700,
          color: 'var(--accent)',
        }}>
          <span>{nextAction.emoji}</span>
          <span>Next: {nextAction.label}</span>
        </div>
      )}

      {/* ROW 4: actions */}
      <div style={{ display: 'flex', gap: 7, marginTop: 4 }} onClick={e => e.stopPropagation()}>
        {/* Quick log — primary CTA */}
        <button
          onClick={() => onQuickLog(lead)}
          style={{
            flex: 1,
            padding: '8px 10px',
            background: 'var(--accent)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            fontSize: 12, fontWeight: 700,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            boxShadow: '0 2px 10px rgba(124,106,247,0.3)',
          }}
        >
          <Phone size={12} /> Call + Log
        </button>

        {/* WhatsApp */}
        <a
          href={`https://wa.me/91${lead.phone}`}
          target="_blank" rel="noreferrer"
          style={{
            flex: 1,
            padding: '8px 10px',
            background: '#16a34a',
            color: 'white',
            borderRadius: 'var(--radius-sm)',
            fontSize: 12, fontWeight: 700,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            textDecoration: 'none',
          }}
        >
          <MessageCircle size={12} /> WhatsApp
        </a>

        {/* Dial only */}
        <a
          href={`tel:${lead.phone}`}
          style={{
            padding: '8px 10px',
            background: 'var(--bg3)',
            color: 'var(--text3)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            textDecoration: 'none',
          }}
          title="Dial only"
        >
          <Phone size={13} />
        </a>

        {/* Callback bell */}
        <button
          onClick={() => onCallback(lead)}
          style={{
            padding: '8px 10px',
            background: hasCallback ? 'var(--yellow-bg)' : 'var(--bg3)',
            color: hasCallback ? 'var(--yellow)' : 'var(--text3)',
            border: `1px solid ${hasCallback ? 'rgba(251,191,36,0.3)' : 'var(--border)'}`,
            borderRadius: 'var(--radius-sm)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
          title="Schedule callback"
        >
          <Bell size={13} />
        </button>
      </div>
    </div>
  )
}

// ── SECTION ──
function Section({ emoji, title, count, color, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ marginBottom: 20 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          background: 'none', border: 'none', cursor: 'pointer',
          padding: '0 0 10px', marginBottom: 2,
        }}
      >
        <span style={{ fontSize: 14 }}>{emoji}</span>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 800, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
          {title}
        </span>
        <span style={{
          marginLeft: 4, fontSize: 11, fontWeight: 700,
          background: color || 'var(--accent)',
          color: 'white', padding: '1px 7px', borderRadius: 99,
        }}>{count}</span>
        <ChevronDown size={13} style={{ marginLeft: 'auto', color: 'var(--text3)', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
      </button>
      {open && <div>{children}</div>}
    </div>
  )
}

// ── CALLBACK MODAL ──
function CallbackModal({ lead, onSave, onClose }) {
  const [date, setDate] = useState(lead.callback_scheduled_at ? lead.callback_scheduled_at.split('T')[0] : '')
  const [time, setTime] = useState('10:00')
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
    setSaving(false)
    window.__toast && window.__toast(`Callback set for ${format(new Date(scheduledAt), 'dd MMM, h:mm a')}`, 'success')
    onSave()
    onClose()
  }

  async function remove() {
    await supabase.from('leads').update({ callback_scheduled_at: null }).eq('id', lead.id)
    window.__toast && window.__toast('Callback removed', 'success')
    onSave(); onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📞 Schedule Callback — {lead.clinic_name}</h2>
          <button className="btn-icon" onClick={onClose} style={{ fontSize: 18 }}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-row" style={{ marginBottom: 14 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Date</label>
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
              return (
                <button key={o.l} onClick={() => setDate(val)} style={{
                  padding: '5px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  background: date === val ? 'var(--accent-glow2)' : 'var(--bg3)',
                  color: date === val ? 'var(--accent2)' : 'var(--text3)',
                  border: `1px solid ${date === val ? 'var(--accent)' : 'var(--border)'}`,
                }}>{o.l}</button>
              )
            })}
          </div>
        </div>
        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          {lead.callback_scheduled_at && (
            <button className="btn btn-danger btn-sm" onClick={remove}>🗑 Remove</button>
          )}
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════
//  MAIN COMPONENT
// ══════════════════════════════════
export default function Leads() {
  const navigate = useNavigate()
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState(() => sessionStorage.getItem('leads_search') || '')
  const [statusFilter, setStatusFilter] = useState(() => sessionStorage.getItem('leads_status') || '')
  const [priorityFilter, setPriorityFilter] = useState(() => sessionStorage.getItem('leads_priority') || '')
  const [areaFilter, setAreaFilter] = useState(() => sessionStorage.getItem('leads_area') || '')
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => { sessionStorage.setItem('leads_search', search) }, [search])
  useEffect(() => { sessionStorage.setItem('leads_status', statusFilter) }, [statusFilter])
  useEffect(() => { sessionStorage.setItem('leads_priority', priorityFilter) }, [priorityFilter])
  useEffect(() => { sessionStorage.setItem('leads_area', areaFilter) }, [areaFilter])

  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_LEAD)
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState(null)
  const [dupWarning, setDupWarning] = useState(null)
  const [quickLogLead, setQuickLogLead] = useState(null)
  const [callbackTarget, setCallbackTarget] = useState(null)

  const activeFilters = [statusFilter, priorityFilter, areaFilter].filter(Boolean).length

  useEffect(() => {
    fetchLeads()
    window.__openAddLead = () => { setForm(EMPTY_LEAD); setEditId(null); setShowModal(true) }
    return () => { delete window.__openAddLead }
  }, [])

  // Restore scroll
  useEffect(() => {
    const saved = sessionStorage.getItem('leads_scrollY')
    if (saved) {
      const pageBody = document.querySelector('.page-body')
      if (pageBody) setTimeout(() => { pageBody.scrollTop = parseInt(saved) }, 100)
      sessionStorage.removeItem('leads_scrollY')
    }
  }, [loading])

  function navigateToLead(id) {
    const pageBody = document.querySelector('.page-body')
    if (pageBody) sessionStorage.setItem('leads_scrollY', pageBody.scrollTop)
    navigate(`/leads/${id}`)
  }

  async function fetchLeads() {
    setLoading(true)
    const { data } = await supabase.from('leads').select('*').eq('archived', false).order('created_at', { ascending: false })
    setLeads(data || [])
    setLoading(false)
  }

  const filtered = leads.filter(l => {
    const q = search.toLowerCase()
    const matchSearch = !q || l.clinic_name?.toLowerCase().includes(q) || l.doctor_name?.toLowerCase().includes(q) || l.phone?.includes(q) || l.area?.toLowerCase().includes(q) || (l.tags || []).some(t => t.toLowerCase().includes(q))
    return matchSearch && (!statusFilter || l.status === statusFilter) && (!priorityFilter || l.priority === priorityFilter) && (!areaFilter || l.area === areaFilter)
  })

  // Sort: overdue first, then by priority
  const priOrd = { high: 0, medium: 1, low: 2 }
  const sorted = [...filtered].sort((a, b) => {
    const aOv = a.next_follow_up_date && isPast(parseISO(a.next_follow_up_date)) && !isToday(parseISO(a.next_follow_up_date))
    const bOv = b.next_follow_up_date && isPast(parseISO(b.next_follow_up_date)) && !isToday(parseISO(b.next_follow_up_date))
    if (aOv && !bOv) return -1
    if (!aOv && bOv) return 1
    return (priOrd[a.priority] ?? 1) - (priOrd[b.priority] ?? 1)
  })

  const buckets = bucketLeads(sorted)

  async function checkDuplicate(phone) {
    if (!phone || phone.length < 8) return
    const clean = phone.replace(/[^0-9]/g, '').replace(/^91/, '').slice(-10)
    const { data } = await supabase.from('leads').select('id, clinic_name, status').filter('phone', 'ilike', `%${clean}%`)
    const dups = data?.filter(d => !editId || d.id !== editId) || []
    setDupWarning(dups.length > 0 ? dups : null)
  }

  async function saveLead() {
    if (!form.clinic_name || !form.phone) { window.__toast && window.__toast('Clinic name and phone required', 'error'); return }
    setSaving(true)
    const payload = {
      ...form,
      rating: form.rating ? parseFloat(form.rating) : null,
      next_follow_up_date: form.next_follow_up_date || null,
      next_action: form.next_action || null,
      tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    }
    if (editId) {
      await supabase.from('leads').update(payload).eq('id', editId)
      window.__toast && window.__toast('Lead updated', 'success')
    } else {
      const { data: newLead } = await supabase.from('leads').insert(payload).select().single()
      window.__toast && window.__toast('Lead added — AI researching...', 'success')
      if (newLead) setTimeout(() => generateLeadIntelligence(newLead), 500)
    }
    setSaving(false); setShowModal(false); setDupWarning(null); fetchLeads()
  }

  async function deleteLead(id, e) {
    e.stopPropagation()
    if (!window.confirm('Delete this lead and all call history?')) return
    await supabase.from('leads').delete().eq('id', id)
    setLeads(prev => prev.filter(l => l.id !== id))
    window.__toast && window.__toast('Lead deleted', 'success')
  }

  function clearFilters() { setStatusFilter(''); setPriorityFilter(''); setAreaFilter(''); setSearch('') }

  function renderSection(key, emoji, title, color, defaultOpen) {
    const items = buckets[key]
    if (!items || items.length === 0) return null
    return (
      <Section key={key} emoji={emoji} title={title} count={items.length} color={color} defaultOpen={defaultOpen}>
        {items.map(lead => (
          <LeadCard
            key={lead.id}
            lead={lead}
            onQuickLog={setQuickLogLead}
            onClick={() => navigateToLead(lead.id)}
            onCallback={setCallbackTarget}
          />
        ))}
      </Section>
    )
  }

  const totalActive = filtered.filter(l => !BUCKET_CLOSED.includes(l.status)).length

  return (
    <div>
      {/* ── SEARCH + FILTER TOGGLE ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
        <div className="search-wrap" style={{ flex: 1 }}>
          <Search />
          <input
            className="search-input"
            placeholder="Search clinic, phone, doctor..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}
              onClick={() => setSearch('')}><X size={14} /></button>
          )}
        </div>
        <button
          onClick={() => setShowFilters(f => !f)}
          style={{
            padding: '9px 13px', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 700,
            background: showFilters || activeFilters > 0 ? 'var(--accent-glow2)' : 'var(--bg2)',
            color: showFilters || activeFilters > 0 ? 'var(--accent2)' : 'var(--text3)',
            border: `1.5px solid ${showFilters || activeFilters > 0 ? 'var(--accent)' : 'var(--border)'}`,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
          }}
        >
          ⚡ Filter {activeFilters > 0 && <span style={{ background: 'var(--accent)', color: 'white', borderRadius: 99, fontSize: 10, padding: '0px 5px', fontWeight: 800 }}>{activeFilters}</span>}
        </button>
      </div>

      {/* ── FILTER PANEL ── */}
      {showFilters && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px', marginBottom: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">All Statuses</option>
              {STATUSES.filter(Boolean).map(s => <option key={s} value={s}>{s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
            </select>
            <select className="filter-select" value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
              <option value="">All Priority</option>
              {PRIORITIES.filter(Boolean).map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
            </select>
            <select className="filter-select" value={areaFilter} onChange={e => setAreaFilter(e.target.value)} style={{ gridColumn: '1 / -1' }}>
              <option value="">All Areas</option>
              {AREAS.filter(Boolean).map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          {activeFilters > 0 && (
            <button onClick={clearFilters} style={{ fontSize: 12, fontWeight: 700, color: 'var(--red)', background: 'var(--red-bg)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 99, padding: '5px 12px', cursor: 'pointer' }}>
              × Clear {activeFilters} filter{activeFilters > 1 ? 's' : ''}
            </button>
          )}
        </div>
      )}

      {/* ── LEAD COUNT ── */}
      <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginBottom: 14, letterSpacing: 0.3 }}>
        {totalActive} active lead{totalActive !== 1 ? 's' : ''} · {filtered.length} total
      </div>

      {/* ── SECTIONS ── */}
      {loading ? (
        <div className="loading"><div className="spinner" /> Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <Users size={40} style={{ margin: '0 auto 12px', opacity: 0.2 }} />
          <p>No leads found</p>
          <span>{activeFilters > 0 ? 'Try clearing filters' : 'Add a lead to get started'}</span>
        </div>
      ) : (
        <>
          {renderSection('urgent', '🔴', 'Overdue', '#f87171', true)}
          {renderSection('followToday', '📅', 'Follow Up Today', '#fbbf24', true)}
          {renderSection('hot', '🔥', 'Hot — Push to Close', '#34d399', true)}
          {renderSection('rest', '🆕', 'New & Active', 'var(--accent)', true)}
          {renderSection('parked', '🔮', 'Parked', '#60a5fa', false)}
          {/* Closed/dead — always collapsed */}
          {buckets.rest.filter(l => BUCKET_CLOSED.includes(l.status)).length > 0 && (
            <Section emoji="📁" title="Closed & Dead" count={buckets.rest.filter(l => BUCKET_CLOSED.includes(l.status)).length} color="var(--text3)" defaultOpen={false}>
              {buckets.rest.filter(l => BUCKET_CLOSED.includes(l.status)).map(lead => (
                <LeadCard key={lead.id} lead={lead} onQuickLog={setQuickLogLead} onClick={() => navigateToLead(lead.id)} onCallback={setCallbackTarget} />
              ))}
            </Section>
          )}
        </>
      )}

      {/* ── QUICK LOG MODAL ── */}
      {quickLogLead && (
        <QuickLogModal
          lead={quickLogLead}
          onSave={fetchLeads}
          onClose={() => setQuickLogLead(null)}
        />
      )}

      {/* ── CALLBACK MODAL ── */}
      {callbackTarget && (
        <CallbackModal
          lead={callbackTarget}
          onSave={fetchLeads}
          onClose={() => setCallbackTarget(null)}
        />
      )}

      {/* ── ADD/EDIT MODAL ── */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editId ? 'Edit Lead' : '+ New Lead'}</h2>
              <button className="btn-icon" onClick={() => setShowModal(false)} style={{ fontSize: 18 }}>×</button>
            </div>
            <div className="modal-body">
              {dupWarning && (
                <div style={{ background: 'var(--yellow-bg)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--yellow)', marginBottom: 4 }}>⚠️ Possible duplicate</div>
                  {dupWarning.map(d => <div key={d.id} style={{ fontSize: 11, color: 'var(--text2)' }}>{d.clinic_name} — {d.status}</div>)}
                </div>
              )}
              <div className="form-row">
                <div className="form-group"><label className="form-label">Clinic Name *</label><input className="form-input" value={form.clinic_name} onChange={e => setForm(f => ({ ...f, clinic_name: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Doctor Name</label><input className="form-input" value={form.doctor_name} onChange={e => setForm(f => ({ ...f, doctor_name: e.target.value }))} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Phone *</label><input className="form-input" value={form.phone} onChange={e => { setForm(f => ({ ...f, phone: e.target.value })); checkDuplicate(e.target.value) }} /></div>
                <div className="form-group"><label className="form-label">Area</label><select className="form-input" value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))}>{AREAS.map(a => <option key={a} value={a}>{a || 'Select area'}</option>)}</select></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Status</label><select className="form-input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>{STATUSES.filter(Boolean).map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}</select></div>
                <div className="form-group"><label className="form-label">Priority</label><select className="form-input" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>{PRIORITIES.filter(Boolean).map(p => <option key={p} value={p}>{p}</option>)}</select></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Follow Up Date</label><input className="form-input" type="date" value={form.next_follow_up_date} onChange={e => setForm(f => ({ ...f, next_follow_up_date: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Rating</label><input className="form-input" type="number" step="0.1" min="1" max="5" value={form.rating} onChange={e => setForm(f => ({ ...f, rating: e.target.value }))} /></div>
              </div>
              <div className="form-group"><label className="form-label">Notes</label><textarea className="form-input" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">Tags (comma separated)</label><input className="form-input" placeholder="e.g. chain, high-value" value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} /></div>
            </div>
            <div className="modal-footer">
              {editId && <button className="btn btn-danger btn-sm" onClick={e => deleteLead(editId, e)}>Delete</button>}
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveLead} disabled={saving}>{saving ? 'Saving...' : editId ? 'Update' : 'Add Lead'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
