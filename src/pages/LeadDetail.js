/* eslint-disable */
import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Phone, MessageCircle, ArrowLeft, Plus, X, Star, Globe, MapPin, Clock, ChevronRight, Send, Calendar, User, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react'
import { format, parseISO, formatDistanceToNow, addDays } from 'date-fns'

// ─── AUTO FOLLOW-UP RULES ────────────────────────────────────────────────────
// Given outcome + blocker → returns { status, next_action, follow_up_days, label }
const OUTCOME_RULES = {
  // Not connected
  no_answer:        { status: 'not_reachable', next_action: 'call',      days: 1,  label: 'No Answer' },
  switched_off:     { status: 'not_reachable', next_action: 'call',      days: 1,  label: 'Switched Off' },
  wrong_number:     { status: 'wrong_number',  next_action: null,         days: null, label: 'Wrong Number' },
  voicemail:        { status: 'not_reachable', next_action: 'call',      days: 1,  label: 'Voicemail' },
  // Receptionist
  dr_busy:          { status: 'gatekeeper',    next_action: 'call',      days: 1,  label: 'Dr Busy' },
  dr_not_well:      { status: 'gatekeeper',    next_action: 'call',      days: 2,  label: 'Dr Not Well' },
  gatekeeper_block: { status: 'gatekeeper',    next_action: 'call',      days: 2,  label: 'Gatekeeper Blocking' },
  // Doctor — no
  not_interested:   { status: 'dead',          next_action: null,         days: null, label: 'Not Interested' },
  happy_current:    { status: 'future_interested', next_action: 'call',  days: 90, label: 'Happy with Current' },
  // Doctor — soft maybe
  silent_audit:     { status: 'called',        next_action: 'whatsapp',  days: 1,  label: 'Silent — Send Audit' },
  // Doctor — interested with blocker
  renovation:       { status: 'renovation',    next_action: 'call',      days: 30, label: 'Renovation' },
  relocation:       { status: 'out_of_city',   next_action: 'call',      days: 21, label: 'Relocating' },
  partner_approval: { status: 'partner_approval', next_action: 'call',   days: 5,  label: 'Partner Approval' },
  dr_occupied:      { status: 'gatekeeper',    next_action: 'call',      days: 3,  label: 'Dr Occupied' },
  future_interest:  { status: 'future_interested', next_action: 'call',  days: 60, label: 'Future Interest' },
  // Doctor — moving forward
  wants_audit:      { status: 'called',        next_action: 'whatsapp',  days: 1,  label: 'Wants Audit' },
  wants_demo:       { status: 'demo_sent',     next_action: 'follow_up', days: 2,  label: 'Wants Demo' },
  wants_quote:      { status: 'quote_sent',    next_action: 'follow_up', days: 1,  label: 'Wants Quote' },
  meeting_fixed:    { status: 'negotiating',   next_action: 'meeting',   days: 1,  label: 'Meeting Fixed' },
  paid_advance:     { status: 'closed',        next_action: null,         days: null, label: 'Paid Advance' },
}

// ─── CALL LOG MODAL (3-step, thumb friendly) ─────────────────────────────────
function LogCallModal({ lead, onDone, onClose }) {
  const [step, setStep] = useState(1)
  const [happened, setHappened] = useState(null)   // 'not_connected' | 'receptionist' | 'doctor'
  const [outcome, setOutcome] = useState(null)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const BIG_BTN = (props) => (
    <button
      onClick={props.onClick}
      style={{
        width: '100%', padding: '16px 20px', borderRadius: 12, border: `2px solid ${props.selected ? props.color : 'var(--border)'}`,
        background: props.selected ? `${props.color}18` : 'var(--bg3)',
        color: props.selected ? props.color : 'var(--text)',
        fontSize: 15, fontWeight: 700, cursor: 'pointer', textAlign: 'left',
        display: 'flex', alignItems: 'center', gap: 12, transition: 'all 0.15s',
        marginBottom: 10,
      }}>
      <span style={{ fontSize: 22 }}>{props.emoji}</span>
      <div>
        <div>{props.label}</div>
        {props.sub && <div style={{ fontSize: 12, fontWeight: 400, opacity: 0.7, marginTop: 2 }}>{props.sub}</div>}
      </div>
      {props.selected && <CheckCircle size={18} style={{ marginLeft: 'auto', flexShrink: 0 }} />}
    </button>
  )

  async function save() {
    if (!outcome) return
    const rule = OUTCOME_RULES[outcome]
    if (!rule) return
    setSaving(true)
    const now = new Date().toISOString()
    const followUpDate = rule.days ? addDays(new Date(), rule.days).toISOString().split('T')[0] : null

    // 1. Insert call log
    await supabase.from('call_logs').insert({
      lead_id: lead.id,
      outcome,
      notes: note || rule.label,
      called_at: now,
    })

    // 2. Insert timeline note
    await supabase.from('lead_notes').insert({
      lead_id: lead.id,
      note: `📞 ${rule.label}${note ? ' — ' + note : ''}${followUpDate ? ` · Follow up: ${format(new Date(followUpDate), 'dd MMM')}` : ''}`,
      type: 'call',
    })

    // 3. Update lead
    const update = {
      status: rule.status,
      last_called_at: now,
      call_count: (lead.call_count || 0) + 1,
      next_action: rule.next_action,
      next_follow_up_date: followUpDate,
      last_call_notes: note || rule.label,
    }
    if (rule.priority) update.priority = rule.priority
    if (rule.archive) update.archived = true
    await supabase.from('leads').update(update).eq('id', lead.id)

    setSaving(false)
    window.__toast && window.__toast('Call logged ✅', 'success')
    onDone()
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 480, borderRadius: 20 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 14, marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600, marginBottom: 2 }}>LOG CALL</div>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{lead.clinic_name}</h2>
          </div>
          <button className="btn-icon" onClick={onClose} style={{ fontSize: 20 }}>×</button>
        </div>

        <div className="modal-body">
          {/* STEP 1 — What happened */}
          {step === 1 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text3)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.5px' }}>What happened?</div>
              <BIG_BTN emoji="📵" label="Not Connected" sub="No answer, off, wrong number, voicemail" color="#f87171" selected={happened === 'not_connected'} onClick={() => setHappened('not_connected')} />
              <BIG_BTN emoji="🚧" label="Reached Receptionist" sub="Doctor not available or blocked" color="#fb923c" selected={happened === 'receptionist'} onClick={() => setHappened('receptionist')} />
              <BIG_BTN emoji="📞" label="Reached Doctor" sub="Spoke directly with decision maker" color="#34d399" selected={happened === 'doctor'} onClick={() => setHappened('doctor')} />
              {happened && (
                <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 6 }} onClick={() => setStep(2)}>
                  Next <ChevronRight size={15} />
                </button>
              )}
            </div>
          )}

          {/* STEP 2 — Specific outcome */}
          {step === 2 && happened === 'not_connected' && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text3)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Why not connected?</div>
              <BIG_BTN emoji="🔇" label="No Answer" sub="Rang but no pick up" color="#9ca3af" selected={outcome === 'no_answer'} onClick={() => setOutcome('no_answer')} />
              <BIG_BTN emoji="📴" label="Switched Off" sub="Phone is off or unreachable" color="#9ca3af" selected={outcome === 'switched_off'} onClick={() => setOutcome('switched_off')} />
              <BIG_BTN emoji="❓" label="Wrong Number" sub="Number doesn't exist or wrong person" color="#f87171" selected={outcome === 'wrong_number'} onClick={() => setOutcome('wrong_number')} />
              <BIG_BTN emoji="📬" label="Voicemail" sub="Went to voicemail" color="#9ca3af" selected={outcome === 'voicemail'} onClick={() => setOutcome('voicemail')} />
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { setStep(1); setOutcome(null) }}>Back</button>
                {outcome && <button className="btn btn-primary" style={{ flex: 2, justifyContent: 'center' }} onClick={() => setStep(3)}>Next <ChevronRight size={15} /></button>}
              </div>
            </div>
          )}

          {step === 2 && happened === 'receptionist' && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text3)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.5px' }}>What did receptionist say?</div>
              <BIG_BTN emoji="⏰" label="Doctor is Busy" sub="Will be free later, call back" color="#fb923c" selected={outcome === 'dr_busy'} onClick={() => setOutcome('dr_busy')} />
              <BIG_BTN emoji="🤒" label="Doctor is Unwell" sub="Not in clinic today" color="#fb923c" selected={outcome === 'dr_not_well'} onClick={() => setOutcome('dr_not_well')} />
              <BIG_BTN emoji="🚫" label="Can't Reach Doctor" sub="Won't give number, always blocking" color="#f87171" selected={outcome === 'gatekeeper_block'} onClick={() => setOutcome('gatekeeper_block')} />
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { setStep(1); setOutcome(null) }}>Back</button>
                {outcome && <button className="btn btn-primary" style={{ flex: 2, justifyContent: 'center' }} onClick={() => setStep(3)}>Next <ChevronRight size={15} /></button>}
              </div>
            </div>
          )}

          {step === 2 && happened === 'doctor' && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text3)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.5px' }}>How did it go?</div>
              {/* Not moving forward */}
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', marginBottom: 8, marginTop: 4, textTransform: 'uppercase' }}>Not moving forward</div>
              <BIG_BTN emoji="❌" label="Not Interested" sub="Hard no" color="#f87171" selected={outcome === 'not_interested'} onClick={() => setOutcome('not_interested')} />
              <BIG_BTN emoji="😐" label="Silent — Sent Audit" sub="Didn't say yes/no, offered to send audit" color="#9ca3af" selected={outcome === 'silent_audit'} onClick={() => setOutcome('silent_audit')} />
              <BIG_BTN emoji="✅" label="Happy with Current" sub="Satisfied, not looking for change" color="#9ca3af" selected={outcome === 'happy_current'} onClick={() => setOutcome('happy_current')} />
              {/* Interested but blocked */}
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', marginBottom: 8, marginTop: 16, textTransform: 'uppercase' }}>Interested but blocked</div>
              <BIG_BTN emoji="🏗️" label="Renovation" sub="Clinic under renovation" color="#fbbf24" selected={outcome === 'renovation'} onClick={() => setOutcome('renovation')} />
              <BIG_BTN emoji="✈️" label="Relocating" sub="Clinic is moving locations" color="#fbbf24" selected={outcome === 'relocation'} onClick={() => setOutcome('relocation')} />
              <BIG_BTN emoji="🤝" label="Partner Approval" sub="Needs to discuss with partner" color="#fbbf24" selected={outcome === 'partner_approval'} onClick={() => setOutcome('partner_approval')} />
              <BIG_BTN emoji="📅" label="Doctor Too Busy" sub="Interested but caught up right now" color="#fbbf24" selected={outcome === 'dr_occupied'} onClick={() => setOutcome('dr_occupied')} />
              <BIG_BTN emoji="🔮" label="Future Interest" sub="Okay but not now, 3-6 months" color="#fbbf24" selected={outcome === 'future_interest'} onClick={() => setOutcome('future_interest')} />
              {/* Moving forward */}
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', marginBottom: 8, marginTop: 16, textTransform: 'uppercase' }}>Moving forward</div>
              <BIG_BTN emoji="📋" label="Wants Audit" sub="Send audit report on WhatsApp" color="#34d399" selected={outcome === 'wants_audit'} onClick={() => setOutcome('wants_audit')} />
              <BIG_BTN emoji="🖥️" label="Wants Website Demo" sub="Send demo link" color="#34d399" selected={outcome === 'wants_demo'} onClick={() => setOutcome('wants_demo')} />
              <BIG_BTN emoji="💰" label="Wants Quote" sub="Send pricing on WhatsApp" color="#34d399" selected={outcome === 'wants_quote'} onClick={() => setOutcome('wants_quote')} />
              <BIG_BTN emoji="🤝" label="Meeting Fixed" sub="Date confirmed" color="#60a5fa" selected={outcome === 'meeting_fixed'} onClick={() => setOutcome('meeting_fixed')} />
              <BIG_BTN emoji="✅" label="Paid Advance" sub="Deal closed!" color="#a78bfa" selected={outcome === 'paid_advance'} onClick={() => setOutcome('paid_advance')} />
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { setStep(1); setOutcome(null) }}>Back</button>
                {outcome && <button className="btn btn-primary" style={{ flex: 2, justifyContent: 'center' }} onClick={() => setStep(3)}>Next <ChevronRight size={15} /></button>}
              </div>
            </div>
          )}

          {/* STEP 3 — Note + confirm */}
          {step === 3 && outcome && (
            <div>
              {OUTCOME_RULES[outcome] && (
                <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase' }}>Auto-set for you</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ fontSize: 13, display: 'flex', gap: 8 }}>
                      <span style={{ color: 'var(--text3)' }}>Status:</span>
                      <strong>{OUTCOME_RULES[outcome].status?.replace(/_/g, ' ')}</strong>
                    </div>
                    {OUTCOME_RULES[outcome].next_action && (
                      <div style={{ fontSize: 13, display: 'flex', gap: 8 }}>
                        <span style={{ color: 'var(--text3)' }}>Next action:</span>
                        <strong>{OUTCOME_RULES[outcome].next_action?.replace(/_/g, ' ')}</strong>
                      </div>
                    )}
                    {OUTCOME_RULES[outcome].days && (
                      <div style={{ fontSize: 13, display: 'flex', gap: 8 }}>
                        <span style={{ color: 'var(--text3)' }}>Follow up:</span>
                        <strong>{format(addDays(new Date(), OUTCOME_RULES[outcome].days), 'dd MMM yyyy')}</strong>
                      </div>
                    )}
                    {!OUTCOME_RULES[outcome].days && <div style={{ fontSize: 13, color: 'var(--text3)' }}>No follow up needed</div>}
                  </div>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Add a note (optional)</label>
                <textarea
                  className="form-input"
                  placeholder="e.g. Doctor said call after Diwali, renovation done by end of month..."
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  rows={3}
                  style={{ resize: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setStep(2)}>Back</button>
                <button className="btn btn-primary" style={{ flex: 2, justifyContent: 'center' }} onClick={save} disabled={saving}>
                  {saving ? <><div className="spinner" style={{ borderTopColor: 'white' }} /> Saving...</> : '✅ Save & Done'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── WHATSAPP SEND MODAL ─────────────────────────────────────────────────────
function WhatsAppModal({ lead, templates, onClose, onSent }) {
  const [selected, setSelected] = useState(null)
  const [sending, setSending] = useState(false)

  function fillTemplate(msg) {
    return msg
      .replace(/\[Doctor Name\]/g, lead.doctor_name || 'Doctor')
      .replace(/\[Clinic Name\]/g, lead.clinic_name)
      .replace(/\[Demo Link\]/g, 'https://demo.agastyone.in/' + lead.clinic_name?.toLowerCase().replace(/\s+/g, '-'))
  }

  async function send() {
    if (!selected) return
    setSending(true)
    const msg = fillTemplate(selected.message)
    // Log in timeline
    await supabase.from('lead_notes').insert({
      lead_id: lead.id,
      note: `💬 WhatsApp sent — ${selected.title}`,
      type: 'whatsapp',
    })
    await supabase.from('leads').update({ last_called_at: new Date().toISOString() }).eq('id', lead.id)
    const waUrl = `https://wa.me/91${lead.phone}?text=${encodeURIComponent(msg)}`
    window.open(waUrl, '_blank')
    setSending(false)
    window.__toast && window.__toast('WhatsApp opened ✅', 'success')
    onSent()
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>💬 Send WhatsApp — {lead.clinic_name}</h2>
          <button className="btn-icon" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {templates.length === 0 && <div style={{ color: 'var(--text3)', fontSize: 13 }}>No templates yet. Add them in WA Templates.</div>}
          {templates.map(t => (
            <div key={t.id} onClick={() => setSelected(t)}
              style={{ padding: '12px 14px', borderRadius: 10, border: `2px solid ${selected?.id === t.id ? 'var(--accent)' : 'var(--border)'}`, background: selected?.id === t.id ? 'var(--accent-glow)' : 'var(--bg3)', cursor: 'pointer', marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{t.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{fillTemplate(t.message).slice(0, 120)}...</div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" style={{ flex: 2, justifyContent: 'center' }} onClick={send} disabled={!selected || sending}>
              {sending ? 'Opening...' : '💬 Open WhatsApp →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── STATUS CONFIG ─────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  new:               { label: 'New Lead',         color: '#9ca3af', bg: 'rgba(156,163,175,0.12)',  emoji: '🆕' },
  not_reachable:     { label: 'Not Reachable',    color: '#9ca3af', bg: 'rgba(156,163,175,0.12)',  emoji: '📵' },
  wrong_number:      { label: 'Wrong Number',     color: '#f87171', bg: 'rgba(248,113,113,0.1)',   emoji: '❓' },
  gatekeeper:        { label: 'Gatekeeper',       color: '#fb923c', bg: 'rgba(251,146,60,0.1)',    emoji: '🚧' },
  called:            { label: 'Called',           color: '#60a5fa', bg: 'rgba(96,165,250,0.1)',    emoji: '📞' },
  interested:        { label: 'Interested',       color: '#34d399', bg: 'rgba(52,211,153,0.1)',    emoji: '😊' },
  renovation:        { label: 'Renovation',       color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',    emoji: '🏗️' },
  out_of_city:       { label: 'Relocating',       color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',    emoji: '✈️' },
  partner_approval:  { label: 'Partner Approval', color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',    emoji: '🤝' },
  future_interested: { label: 'Future Interest',  color: '#a78bfa', bg: 'rgba(167,139,250,0.1)',   emoji: '🔮' },
  demo_sent:         { label: 'Demo Sent',        color: '#34d399', bg: 'rgba(52,211,153,0.1)',    emoji: '🖥️' },
  quote_sent:        { label: 'Quote Sent',       color: '#34d399', bg: 'rgba(52,211,153,0.1)',    emoji: '💰' },
  negotiating:       { label: 'Negotiating',      color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',   emoji: '🤝' },
  closed:            { label: 'Closed ✅',        color: '#34d399', bg: 'rgba(52,211,153,0.15)',   emoji: '✅' },
  dead:              { label: 'Not Interested',   color: '#f87171', bg: 'rgba(248,113,113,0.08)',  emoji: '❌' },
}

const NEXT_ACTION_LABEL = {
  call: '📞 Call them',
  whatsapp: '💬 Send WhatsApp',
  follow_up: '🔔 Follow up',
  send_demo: '🖥️ Send Demo',
  meeting: '🤝 Meeting',
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function LeadDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [lead, setLead] = useState(null)
  const [timeline, setTimeline] = useState([])
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCallModal, setShowCallModal] = useState(false)
  const [showWaModal, setShowWaModal] = useState(false)
  const [editNote, setEditNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  useEffect(() => { fetchAll() }, [id])

  async function fetchAll() {
    setLoading(true)
    const [leadRes, notesRes, callsRes, templatesRes] = await Promise.all([
      supabase.from('leads').select('*').eq('id', id).single(),
      supabase.from('lead_notes').select('*').eq('lead_id', id).order('created_at', { ascending: false }),
      supabase.from('call_logs').select('*').eq('lead_id', id).order('called_at', { ascending: false }),
      supabase.from('whatsapp_templates').select('*').order('created_at'),
    ])
    setLead(leadRes.data)
    setTemplates(templatesRes.data || [])

    // Merge notes + calls into one timeline
    const notes = (notesRes.data || []).map(n => ({ ...n, _type: 'note', _time: n.created_at }))
    const calls = (callsRes.data || []).map(c => ({ ...c, _type: 'call', _time: c.called_at }))
    const merged = [...notes, ...calls].sort((a, b) => new Date(b._time) - new Date(a._time))
    setTimeline(merged)
    setLoading(false)
  }

  async function saveQuickNote() {
    if (!editNote.trim()) return
    setSavingNote(true)
    await supabase.from('lead_notes').insert({ lead_id: id, note: editNote.trim(), type: 'note' })
    setEditNote('')
    setSavingNote(false)
    fetchAll()
    window.__toast && window.__toast('Note saved', 'success')
  }

  if (loading) return <div className="loading"><div className="spinner" /> Loading...</div>
  if (!lead) return <div className="loading">Lead not found</div>

  const sc = STATUS_CONFIG[lead.status] || STATUS_CONFIG['new']
  const hasWebsite = lead.notes?.includes('Website:') && !lead.notes?.includes('No website')
  const followUpDate = lead.next_follow_up_date ? (() => { try { return parseISO(lead.next_follow_up_date) } catch { return null } })() : null
  const followUpOverdue = followUpDate && followUpDate < new Date()

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', paddingBottom: 40 }}>

      {/* BACK */}
      <button className="btn btn-ghost" onClick={() => navigate('/leads')} style={{ marginBottom: 16, gap: 6 }}>
        <ArrowLeft size={15} /> All Leads
      </button>

      {/* ── CLINIC CARD ─────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 16 }}>
        {/* Status badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 99, background: sc.bg, color: sc.color, fontSize: 13, fontWeight: 700 }}>
            {sc.emoji} {sc.label}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>
            {lead.call_count ? `${lead.call_count} call${lead.call_count > 1 ? 's' : ''}` : 'Not called yet'}
          </div>
        </div>

        {/* Clinic name */}
        <h1 style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-display)', marginBottom: 4 }}>{lead.clinic_name}</h1>
        {lead.doctor_name && <div style={{ fontSize: 14, color: 'var(--text3)', marginBottom: 12 }}>👨‍⚕️ {lead.doctor_name}</div>}

        {/* Info row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          {lead.area && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--text2)' }}>
              <MapPin size={13} /> {lead.area}
            </div>
          )}
          {lead.rating && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: '#fbbf24' }}>
              <Star size={13} fill="#fbbf24" /> {lead.rating}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: hasWebsite ? 'var(--green)' : 'var(--red)' }}>
            <Globe size={13} /> {hasWebsite ? 'Has website' : 'No website'}
          </div>
          {lead.priority && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 99,
              background: lead.priority === 'high' ? 'rgba(248,113,113,0.12)' : lead.priority === 'medium' ? 'rgba(251,146,60,0.1)' : 'rgba(52,211,153,0.08)',
              color: lead.priority === 'high' ? '#f87171' : lead.priority === 'medium' ? '#fb923c' : '#34d399'
            }}>
              {lead.priority === 'high' ? '🔥' : lead.priority === 'medium' ? '⚡' : '🌿'} {lead.priority}
            </div>
          )}
        </div>

        {/* Next action banner */}
        {lead.next_action && lead.status !== 'dead' && lead.status !== 'wrong_number' && lead.status !== 'closed' && (
          <div style={{ background: followUpOverdue ? 'rgba(248,113,113,0.1)' : 'var(--accent-glow)', border: `1px solid ${followUpOverdue ? 'rgba(248,113,113,0.3)' : 'var(--accent)'}`, borderRadius: 10, padding: '10px 14px', marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: followUpOverdue ? '#f87171' : 'var(--accent2)', marginBottom: 2 }}>
                {followUpOverdue ? '⚠️ OVERDUE' : '👉 NEXT ACTION'}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                {NEXT_ACTION_LABEL[lead.next_action] || lead.next_action}
              </div>
            </div>
            {followUpDate && (
              <div style={{ fontSize: 12, color: followUpOverdue ? '#f87171' : 'var(--text3)', fontWeight: 600, textAlign: 'right' }}>
                {followUpOverdue ? 'Was due' : 'Due'}<br />
                {format(followUpDate, 'dd MMM')}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── ACTION BUTTONS ──────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        <a href={`tel:${lead.phone}`} className="btn btn-primary" style={{ justifyContent: 'center', padding: '14px', fontSize: 15, borderRadius: 12, textDecoration: 'none' }}>
          <Phone size={16} /> Call
        </a>
        <button className="btn" onClick={() => setShowWaModal(true)} style={{ justifyContent: 'center', padding: '14px', fontSize: 15, borderRadius: 12, background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)' }}>
          <MessageCircle size={16} /> WhatsApp
        </button>
      </div>

      {/* LOG CALL BUTTON */}
      <button className="btn btn-primary" onClick={() => setShowCallModal(true)}
        style={{ width: '100%', justifyContent: 'center', padding: '16px', fontSize: 16, fontWeight: 800, borderRadius: 14, marginBottom: 20, background: 'linear-gradient(135deg, var(--accent), var(--accent2))', boxShadow: '0 4px 20px rgba(124,106,247,0.3)' }}>
        📋 Log Call Outcome
      </button>

      {/* ── QUICK NOTE ──────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>📝 Quick Note</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="form-input" placeholder="Add a note..." value={editNote} onChange={e => setEditNote(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && saveQuickNote()}
            style={{ flex: 1, padding: '10px 14px' }} />
          <button className="btn btn-primary" onClick={saveQuickNote} disabled={savingNote || !editNote.trim()} style={{ padding: '10px 16px', borderRadius: 10 }}>
            <Send size={14} />
          </button>
        </div>
      </div>

      {/* ── TIMELINE ─────────────────────────────────────────────── */}
      <div className="card">
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16 }}>🕐 Activity Timeline</div>
        {timeline.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 13, padding: '20px 0' }}>No activity yet — log your first call above</div>
        )}
        {timeline.map((item, i) => (
          <div key={item.id || i} style={{ display: 'flex', gap: 12, paddingBottom: 16, marginBottom: 16, borderBottom: i < timeline.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: item._type === 'call' ? 'rgba(96,165,250,0.15)' : 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
              {item._type === 'call' ? '📞' : item.type === 'whatsapp' ? '💬' : '📝'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.5, marginBottom: 3 }}>
                {item._type === 'call' ? (
                  <span><strong>{item.outcome?.replace(/_/g, ' ')}</strong>{item.notes ? ` — ${item.notes}` : ''}</span>
                ) : (
                  item.note
                )}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                {item._time ? formatDistanceToNow(new Date(item._time), { addSuffix: true }) : ''}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* MODALS */}
      {showCallModal && <LogCallModal lead={lead} onDone={fetchAll} onClose={() => setShowCallModal(false)} />}
      {showWaModal && <WhatsAppModal lead={lead} templates={templates} onClose={() => setShowWaModal(false)} onSent={fetchAll} />}
    </div>
  )
}
