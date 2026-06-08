/* eslint-disable */
import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { StatusBadge, PriorityBadge, OutcomeBadge } from '../components/Badges'
import AIAudit from './AIAudit'
import LeadIntelligence from '../components/LeadIntelligence'
import { Phone, MessageCircle, ArrowLeft, Plus, X, Mic, FileText, Bell, Star, Upload, ChevronDown, ChevronUp, Trash2, Edit2, ExternalLink, Copy, AlertTriangle, PhoneMissed, RefreshCw, StickyNote, Calendar } from 'lucide-react'
import { format, parseISO, formatDistanceToNow } from 'date-fns'

const STATUSES = ['new','called','interested','future_interested','demo_sent','quote_sent','negotiating','closed','dead','missed']
const OUTCOMES = ['interested','future_interested','callback','not_interested','no_answer','missed','demo_requested','quote_sent','closed','other']

const STATUS_EMOJI = { new:'🆕', called:'📞', interested:'😊', future_interested:'🔮', demo_sent:'🖥️', quote_sent:'💰', negotiating:'🤝', closed:'✅', dead:'❌', missed:'📵' }
const OUTCOME_EMOJI = { interested:'😊', future_interested:'🔮', callback:'📞', not_interested:'❌', no_answer:'📵', missed:'📵', demo_requested:'🖥️', quote_sent:'💰', closed:'✅', other:'💬' }
const OUTCOME_COLOR = { interested:'var(--green-bg)', future_interested:'rgba(14,165,233,0.1)', callback:'var(--yellow-bg)', not_interested:'var(--red-bg)', no_answer:'var(--bg3)', missed:'var(--red-bg)', demo_requested:'var(--purple-bg)', quote_sent:'rgba(168,85,247,0.1)', closed:'rgba(22,163,74,0.12)', other:'var(--bg3)' }

const STAGE_FLOW = [
  { key:'new',              label:'Lead',       emoji:'📋' },
  { key:'called',           label:'Called',     emoji:'📞' },
  { key:'interested',       label:'Interested', emoji:'😊' },
  { key:'demo_sent',        label:'Demo Sent',  emoji:'🖥️' },
  { key:'quote_sent',       label:'Quote Sent', emoji:'💰' },
  { key:'negotiating',      label:'Negotiating',emoji:'🤝' },
  { key:'closed',           label:'Closed',     emoji:'✅' },
]

const NEXT_ACTION_MAP = {
  interested:        { label:'Send Demo',       emoji:'🖥️', tip:'They showed interest — send the demo link now while its fresh.', action:'send_demo' },
  future_interested: { label:'Schedule Follow Up',emoji:'🔮', tip:'Interested but not now — set a follow-up reminder for 30-60 days later.', action:'call' },
  callback:          { label:'Call Back',        emoji:'📞', tip:'They asked you to call back — call exactly on the scheduled date/time.', action:'call' },
  not_interested:    { label:'Mark Dead',        emoji:'❌', tip:'Not interested — move on. Try again in 3 months.', action:null },
  no_answer:         { label:'Try Again',        emoji:'📵', tip:'No answer — try again tomorrow at a different time of day.', action:'call' },
  missed:            { label:'Reschedule',       emoji:'📵', tip:'Call was missed — reschedule and mark in the system.', action:'call' },
  demo_requested:    { label:'Send Demo Now',    emoji:'🖥️', tip:'They asked for a demo — send it immediately!', action:'send_demo' },
  quote_sent:        { label:'Follow Up on Quote',emoji:'💰', tip:'Quote is sent — follow up in 2-3 days to check if they reviewed it.', action:'call' },
  closed:            { label:'Won! 🎉',           emoji:'✅', tip:'Deal closed — collect payment and start onboarding.', action:null },
  other:             { label:'Follow Up',        emoji:'📞', tip:'Follow up to clarify the next step.', action:'call' },
}

const NOTE_TYPE_LABELS = { note:'📝 Note', callback:'📞 Callback', missed_call:'📵 Missed Call', quote:'💰 Quote', whatsapp:'💬 WhatsApp', meeting:'🤝 Meeting' }

export default function LeadDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [lead, setLead] = useState(null)
  const [callLogs, setCallLogs] = useState([])
  const [leadNotes, setLeadNotes] = useState([])
  const [reminders, setReminders] = useState([])
  const [scripts, setScripts] = useState([])
  const [waTemplates, setWaTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('timeline')
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [saving, setSaving] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [expandedLog, setExpandedLog] = useState({})
  const [audioFile, setAudioFile] = useState(null)
  const [selectedScript, setSelectedScript] = useState(null)

  // Modals
  const [showCallModal, setShowCallModal] = useState(false)
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [showMissedModal, setShowMissedModal] = useState(false)
  const [showReminderModal, setShowReminderModal] = useState(false)
  const [showCallbackModal, setShowCallbackModal] = useState(false)
  const [showMoreActions, setShowMoreActions] = useState(false)
  const [showStatusExpanded, setShowStatusExpanded] = useState(false)
  const [showDemoModal, setShowDemoModal] = useState(false)
  const [showQuoteModal, setShowQuoteModal] = useState(false)
  const [showScriptModal, setShowScriptModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)

  // Forms
  const today = new Date().toISOString().split('T')[0]
  const [callForm, setCallForm] = useState({ outcome:'interested', duration_minutes:'', notes:'', next_follow_up_date:'', next_action:'call', called_at:'', callback_time:'10:00' })

  // Auto-suggest follow-up date when outcome changes
  function handleOutcomeChange(outcome) {
    const autoFollowUp = { interested:1, callback:2, demo_requested:1, no_answer:1, future_interested:30, missed:1 }
    const days = autoFollowUp[outcome]
    let suggestedDate = ''
    if (days) {
      const d = new Date(); d.setDate(d.getDate() + days)
      suggestedDate = d.toISOString().split('T')[0]
    }
    const autoAction = { interested:'send_demo', callback:'call', demo_requested:'send_demo', no_answer:'call', future_interested:'call', missed:'call', not_interested:'', closed:'' }
    setCallForm(f => ({ ...f, outcome, next_follow_up_date: suggestedDate, next_action: autoAction[outcome] || 'call' }))
  }
  const [noteForm, setNoteForm] = useState({ note:'', type:'note', scheduled_at:'' })
  const [missedForm, setMissedForm] = useState({ reschedule_date:'', reschedule_time:'', note:'' })
  const [reminderForm, setReminderForm] = useState({ remind_at:'', type:'call', message:'' })
  const [demoForm, setDemoForm] = useState({ demo_link:'', demo_sent_date:'', demo_seen:false })
  const [quoteForm, setQuoteForm] = useState({ quote_amount:'', quote_sent_date:'' })
  const [editForm, setEditForm] = useState({})

  useEffect(() => { fetchAll() }, [id])

  async function fetchAll() {
    setLoading(true)
    const [l, c, n, r, s, w] = await Promise.all([
      supabase.from('leads').select('*').eq('id', id).single(),
      supabase.from('call_logs').select('*').eq('lead_id', id).order('called_at', { ascending: false }),
      supabase.from('lead_notes').select('*').eq('lead_id', id).order('created_at', { ascending: false }),
      supabase.from('reminders').select('*').eq('lead_id', id).eq('status', 'pending').order('remind_at'),
      supabase.from('call_scripts').select('*').eq('is_active', true),
      supabase.from('whatsapp_templates').select('*').order('created_at'),
    ])
    setLead(l.data)
    setCallLogs(c.data || [])
    setLeadNotes(n.data || [])
    setReminders(r.data || [])
    setScripts(s.data || [])
    setWaTemplates(w.data || [])
    if (l.data) {
      setDemoForm({ demo_link: l.data.demo_link || '', demo_sent_date: l.data.demo_sent_date || '', demo_seen: l.data.demo_seen || false })
      setQuoteForm({ quote_amount: l.data.quote_amount || '', quote_sent_date: l.data.quote_sent_date || '' })
      setEditForm({ clinic_name: l.data.clinic_name, doctor_name: l.data.doctor_name || '', phone: l.data.phone, area: l.data.area || '', rating: l.data.rating || '', priority: l.data.priority, notes: l.data.notes || '', estimated_value: l.data.estimated_value || '' })
    }
    setLoading(false)
  }

  async function updateStatus(s) {
    setUpdatingStatus(true)
    await supabase.from('leads').update({ status: s }).eq('id', id)
    setLead(p => ({ ...p, status: s }))
    window.__toast && window.__toast(`Status → ${s.replace(/_/g,' ')}`, 'success')
    setUpdatingStatus(false)
  }

  // ── SAVE CALL LOG ──
  async function saveCallLog() {
    if (!callForm.outcome) { window.__toast && window.__toast('Select an outcome', 'error'); return }
    setSaving(true)
    if (audioFile) {
      setTranscribing(true)
      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          const base64 = e.target.result.split(',')[1]
          const ANTHROPIC_KEY = process.env.REACT_APP_ANTHROPIC_KEY || ''
          const resp = await fetch('https://api.anthropic.com/v1/messages', {
            method:'POST', headers:{'Content-Type':'application/json','x-api-key':ANTHROPIC_KEY,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
            body: JSON.stringify({ model:'claude-sonnet-4-20250514', max_tokens:1000,
              messages:[{ role:'user', content:[
                { type:'text', text:'Transcribe this sales call. Format as "Agastya: ... Doctor: ..." Return only transcription.' },
                { type:'document', source:{ type:'base64', media_type: audioFile.type || 'audio/mpeg', data: base64 } }
              ]}]
            })
          })
          const data = await resp.json()
          await insertCallLog(data.content?.[0]?.text || '')
        } catch { await insertCallLog('') }
        setTranscribing(false)
      }
      reader.readAsDataURL(audioFile)
      return
    }
    await insertCallLog('')
  }

  async function insertCallLog(transcript) {
    const calledAt = callForm.called_at ? new Date(callForm.called_at).toISOString() : new Date().toISOString()
    await supabase.from('call_logs').insert({
      lead_id: id, outcome: callForm.outcome,
      duration_minutes: callForm.duration_minutes ? parseInt(callForm.duration_minutes) : null,
      notes: callForm.notes, next_follow_up_date: callForm.next_follow_up_date || null,
      next_action: callForm.next_action || null, transcript: transcript || null, called_at: calledAt,
    })
    const statusMap = { interested:'interested', future_interested:'future_interested', callback:'called', not_interested:'dead', no_answer:'called', missed:'missed', demo_requested:'demo_sent', quote_sent:'quote_sent', closed:'closed' }
    const isCallback = callForm.outcome === 'callback'
    const callbackAt = isCallback && callForm.next_follow_up_date
      ? `${callForm.next_follow_up_date}T${callForm.callback_time || '10:00'}`
      : null
    await supabase.from('leads').update({
      status: statusMap[callForm.outcome] || lead.status,
      next_follow_up_date: callForm.next_follow_up_date || null,
      next_action: callForm.next_action || null,
      last_call_notes: callForm.notes || null,
      last_called_at: calledAt,
      call_count: (lead.call_count || 0) + 1,
      ...(isCallback && callbackAt ? { callback_scheduled_at: callbackAt } : {}),
    }).eq('id', id)
    // ── Log next action to timeline ──
    if (callForm.next_action) {
      const ACTION_LABELS = { call:'📞 Call', whatsapp:'💬 WhatsApp', send_demo:'📤 Send Demo', send_quote:'💰 Send Quote', meeting:'🤝 Meeting', close:'✅ Close Deal', follow_up:'🔔 Follow Up' }
      const actionLabel = ACTION_LABELS[callForm.next_action] || callForm.next_action.replace(/_/g,' ')
      const dateStr = callForm.next_follow_up_date ? ` by ${format(parseISO(callForm.next_follow_up_date), 'dd MMM')}` : ''
      await supabase.from('lead_notes').insert({
        lead_id: id,
        note: `👉 Next action set: ${actionLabel}${dateStr}`,
        type: 'note',
      })
    }
    setSaving(false); setShowCallModal(false)
    setCallForm({ outcome:'interested', duration_minutes:'', notes:'', next_follow_up_date:'', next_action:'call', called_at:'', callback_time:'10:00' })
    setAudioFile(null); fetchAll()
    window.__toast && window.__toast('Call logged!', 'success')
  }

  // ── SAVE NOTE ──
  async function saveNote() {
    if (!noteForm.note) { window.__toast && window.__toast('Enter a note', 'error'); return }
    setSaving(true)
    await supabase.from('lead_notes').insert({ lead_id: id, note: noteForm.note, type: noteForm.type, scheduled_at: noteForm.scheduled_at || null })
    setSaving(false); setShowNoteModal(false)
    setNoteForm({ note:'', type:'note', scheduled_at:'' })
    fetchAll()
    window.__toast && window.__toast('Note saved!', 'success')
  }

  // ── SAVE MISSED CALL ──
  async function saveMissedCall() {
    setSaving(true)
    const rescheduleAt = missedForm.reschedule_date
      ? `${missedForm.reschedule_date}T${missedForm.reschedule_time || '10:00'}`
      : null

    // Log it as a missed call
    await supabase.from('call_logs').insert({
      lead_id: id, outcome: 'missed',
      notes: missedForm.note || 'Call missed. Rescheduled.',
      next_follow_up_date: missedForm.reschedule_date || null,
      next_action: 'call', called_at: new Date().toISOString(),
    })

    // Add a note
    await supabase.from('lead_notes').insert({
      lead_id: id, type: 'missed_call',
      note: `📵 Missed call${missedForm.note ? ` — ${missedForm.note}` : ''}${rescheduleAt ? `. Rescheduled for ${format(new Date(rescheduleAt), 'dd MMM, h:mm a')}` : ''}`,
      scheduled_at: rescheduleAt,
    })

    // Set reminder if rescheduled
    if (rescheduleAt) {
      await supabase.from('reminders').insert({
        lead_id: id, remind_at: rescheduleAt, type: 'call',
        message: `Rescheduled call — ${lead.clinic_name}`,
      })
    }

    // Update lead
    await supabase.from('leads').update({
      status: 'missed',
      missed_call_count: (lead.missed_call_count || 0) + 1,
      next_follow_up_date: missedForm.reschedule_date || null,
      reschedule_date: rescheduleAt,
    }).eq('id', id)

    setSaving(false); setShowMissedModal(false)
    setMissedForm({ reschedule_date:'', reschedule_time:'', note:'' })
    fetchAll()
    window.__toast && window.__toast('Missed call logged + reminder set!', 'success')
  }

  // ── SAVE DEMO ──
  async function saveDemoInfo() {
    setSaving(true)
    await supabase.from('leads').update({ ...demoForm, status:'demo_sent' }).eq('id', id)
    setLead(p => ({ ...p, ...demoForm, status:'demo_sent' }))
    setSaving(false); setShowDemoModal(false)
    window.__toast && window.__toast('Demo saved!', 'success')
  }

  // ── SAVE QUOTE ──
  async function saveQuote() {
    setSaving(true)
    const isClosed = lead.status === 'closed' || callForm.outcome === 'closed'
    await supabase.from('leads').update({
      ...quoteForm,
      status: isClosed ? 'closed' : 'quote_sent',
      estimated_value: isClosed ? quoteForm.quote_amount : lead.estimated_value,
    }).eq('id', id)
    await supabase.from('lead_notes').insert({ lead_id: id, type:'quote', note:`💰 Quote sent: ₹${Number(quoteForm.quote_amount).toLocaleString()} on ${quoteForm.quote_sent_date ? format(parseISO(quoteForm.quote_sent_date), 'dd MMM yyyy') : 'today'}` })
    setLead(p => ({ ...p, ...quoteForm, status: isClosed ? 'closed' : 'quote_sent' }))
    setSaving(false); setShowQuoteModal(false)
    fetchAll()
    window.__toast && window.__toast('Quote logged!', 'success')
  }

  // ── SAVE REMINDER ──
  async function saveReminder() {
    if (!reminderForm.remind_at) { window.__toast && window.__toast('Set date/time', 'error'); return }
    setSaving(true)
    await supabase.from('reminders').insert({ lead_id: id, ...reminderForm })
    setSaving(false); setShowReminderModal(false)
    setReminderForm({ remind_at:'', type:'call', message:'' })
    fetchAll()
    window.__toast && window.__toast('Reminder set!', 'success')
  }

  async function markReminderDone(rid) {
    await supabase.from('reminders').update({ status:'done' }).eq('id', rid)
    setReminders(p => p.filter(r => r.id !== rid))
    window.__toast && window.__toast('Done!', 'success')
  }

  async function deleteCallLog(callId) {
    if (!window.confirm('Delete this call log?')) return
    await supabase.from('call_logs').delete().eq('id', callId)
    setCallLogs(p => p.filter(c => c.id !== callId))
    window.__toast && window.__toast('Deleted', 'success')
  }

  async function deleteNote(noteId) {
    if (!window.confirm('Delete this note?')) return
    await supabase.from('lead_notes').delete().eq('id', noteId)
    setLeadNotes(p => p.filter(n => n.id !== noteId))
    window.__toast && window.__toast('Deleted', 'success')
  }

  async function saveEdit() {
    setSaving(true)
    const payload = { ...editForm, rating: editForm.rating ? parseFloat(editForm.rating) : null, estimated_value: editForm.estimated_value ? parseFloat(editForm.estimated_value) : null }
    await supabase.from('leads').update(payload).eq('id', id)
    setLead(p => ({ ...p, ...payload }))
    setSaving(false); setShowEditModal(false)
    window.__toast && window.__toast('Updated!', 'success')
  }

  function fillWaTemplate(msg) {
    return msg.replace(/\[Doctor Name\]/g, lead?.doctor_name || 'Doctor').replace(/\[Clinic Name\]/g, lead?.clinic_name || '').replace(/\[Demo Link\]/g, lead?.demo_link || '')
  }
  function copyText(text) { navigator.clipboard.writeText(text).catch(() => {}); window.__toast && window.__toast('Copied!', 'success') }

  // Build merged timeline (calls + notes) sorted by date
  const timeline = [
    ...callLogs.map(c => ({ ...c, _type: 'call', _date: new Date(c.called_at) })),
    ...leadNotes.map(n => ({ ...n, _type: 'note', _date: new Date(n.created_at) })),
  ].sort((a, b) => b._date - a._date)

  const latestCall = callLogs[0]
  const nextSuggestion = latestCall ? NEXT_ACTION_MAP[latestCall.outcome] : null
  const stageIndex = STAGE_FLOW.findIndex(s => s.key === lead?.status)

  if (loading) return <div className="loading"><div className="spinner" />Loading...</div>
  if (!lead) return <div className="empty-state"><p>Lead not found</p></div>

  return (
    <div>
      <button className="btn btn-ghost btn-sm" style={{ marginBottom:14 }} onClick={() => navigate(-1)}><ArrowLeft size={14} /> Back</button>

      {/* ── HEADER ── */}
      <div className="card" style={{ marginBottom:12 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:8 }}>
              <StatusBadge status={lead.status} />
              <PriorityBadge priority={lead.priority} />
              {lead.rating && <span style={{ display:'flex', alignItems:'center', gap:3, fontSize:12, color:'var(--yellow)', background:'var(--yellow-bg)', padding:'2px 8px', borderRadius:99 }}><Star size={11} fill="var(--yellow)" /> {lead.rating}</span>}
              {lead.missed_call_count > 0 && <span style={{ fontSize:11, background:'var(--red-bg)', color:'var(--red)', padding:'2px 8px', borderRadius:99, fontWeight:700 }}>📵 {lead.missed_call_count} missed</span>}
              {lead.partner_approval_needed && <span style={{ fontSize:11, background:'var(--yellow-bg)', color:'var(--yellow)', padding:'2px 8px', borderRadius:99, fontWeight:700 }}>🤝 Needs Partner</span>}
            </div>
            <h2 style={{ fontFamily:'var(--font-display)', fontSize:20, fontWeight:800, marginBottom:4, wordBreak:'break-word' }}>{lead.clinic_name}</h2>
            <div style={{ display:'flex', gap:12, flexWrap:'wrap', fontSize:13, color:'var(--text2)' }}>
              {lead.doctor_name && <span>👨‍⚕️ {lead.doctor_name}</span>}
              {lead.area && <span>📍 {lead.area}</span>}
              {lead.estimated_value && <span style={{ color:'var(--green)', fontWeight:600 }}>💰 ₹{Number(lead.estimated_value).toLocaleString()}</span>}
              {lead.quote_amount && <span style={{ color:'var(--purple)', fontWeight:600 }}>🏷️ Quote: ₹{Number(lead.quote_amount).toLocaleString()}</span>}
            </div>
          </div>
          <button className="btn-icon" onClick={() => setShowEditModal(true)}><Edit2 size={15} /></button>
        </div>

        {/* ACTION BUTTONS */}
        <div style={{ marginTop:14, paddingTop:14, borderTop:'1px solid var(--border)' }}>
          {/* Row 1: Primary */}
          <div style={{ display:'flex', gap:8, marginBottom:8 }}>
            <a href={`tel:${lead.phone}`} className="btn btn-primary" style={{ flex:1, justifyContent:'center', fontSize:14, padding:'11px' }}>
              <Phone size={14}/> Call
            </a>
            <a href={`https://wa.me/91${lead.phone}`} target="_blank" rel="noreferrer" className="wa-btn" style={{ flex:1, justifyContent:'center', padding:'11px', display:'flex', alignItems:'center', gap:6, fontSize:13, fontWeight:600, borderRadius:'var(--radius-sm)', textDecoration:'none' }}>
              <MessageCircle size={14}/> WhatsApp
            </a>
          </div>
          {/* Row 2: Secondary — compact icons with labels */}
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={() => setShowCallModal(true)} style={{ flex:1, padding:'8px 4px', borderRadius:'var(--radius-sm)', background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--text2)', fontSize:11, fontWeight:600, cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
              <Plus size={13}/> Log Call
            </button>
            <button onClick={() => setShowNoteModal(true)} style={{ flex:1, padding:'8px 4px', borderRadius:'var(--radius-sm)', background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--text2)', fontSize:11, fontWeight:600, cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
              <span style={{ fontSize:13 }}>📝</span> Note
            </button>
            <button onClick={() => setShowCallbackModal(true)} style={{ flex:1, padding:'8px 4px', borderRadius:'var(--radius-sm)', background: lead?.callback_scheduled_at ? 'var(--yellow-bg)' : 'var(--bg3)', border:`1px solid ${lead?.callback_scheduled_at ? 'rgba(251,191,36,0.3)' : 'var(--border)'}`, color: lead?.callback_scheduled_at ? 'var(--yellow)' : 'var(--text2)', fontSize:11, fontWeight:600, cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
              <span style={{ fontSize:13 }}>📞</span> Callback
            </button>
            <button onClick={() => setShowMissedModal(true)} style={{ flex:1, padding:'8px 4px', borderRadius:'var(--radius-sm)', background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--red)', fontSize:11, fontWeight:600, cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
              <span style={{ fontSize:13 }}>📵</span> Missed
            </button>
            {/* ⋯ More */}
            <button onClick={() => setShowMoreActions(p => !p)} style={{ flex:1, padding:'8px 4px', borderRadius:'var(--radius-sm)', background: showMoreActions ? 'var(--accent-glow2)' : 'var(--bg3)', border:`1px solid ${showMoreActions ? 'var(--accent)' : 'var(--border)'}`, color: showMoreActions ? 'var(--accent2)' : 'var(--text2)', fontSize:11, fontWeight:600, cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
              <span style={{ fontSize:13 }}>⋯</span> More
            </button>
          </div>
          {/* Expanded more actions */}
          {showMoreActions && (
            <div style={{ marginTop:8, padding:'10px 12px', background:'var(--bg3)', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', display:'flex', gap:6, flexWrap:'wrap' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowReminderModal(true)}>🔔 Remind</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowDemoModal(true)}>🖥️ Demo</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowQuoteModal(true)}>💰 Quote</button>
              {lead.demo_link && (
                <a href={`https://wa.me/91${lead.phone}?text=${encodeURIComponent(`Hi ${lead.doctor_name ? `Dr. ${lead.doctor_name.split(' ').pop()}` : 'Doctor'} 🙏\n\nAs discussed, here is the demo website we built for *${lead.clinic_name}*:\n${lead.demo_link}\n\nThis is exactly the kind of website we'll build for you — customised with your branding, services & booking system.\n\nLet me know your thoughts! — Agastya | AgastyaOne`)}`}
                  target="_blank" rel="noreferrer"
                  style={{ fontSize:11, padding:'5px 10px', borderRadius:99, background:'#dcfce7', color:'#16a34a', border:'1px solid rgba(22,163,74,0.3)', fontWeight:700, textDecoration:'none', display:'flex', alignItems:'center', gap:4 }}>
                  📤 Send Demo
                </a>
              )}
              <button
                onClick={async () => {
                  const flag = !lead.partner_approval_needed
                  await supabase.from('leads').update({ partner_approval_needed: flag }).eq('id', id)
                  setLead(p => ({ ...p, partner_approval_needed: flag }))
                  window.__toast && window.__toast(flag ? '🤝 Flagged: needs partner approval' : 'Partner flag removed', 'success')
                }}
                style={{ fontSize:11, padding:'5px 10px', borderRadius:99, background: lead.partner_approval_needed ? 'var(--yellow-bg)' : 'var(--bg3)', color: lead.partner_approval_needed ? 'var(--yellow)' : 'var(--text3)', border:`1px solid ${lead.partner_approval_needed ? 'rgba(217,119,6,0.3)' : 'var(--border)'}`, fontWeight:700, cursor:'pointer' }}>
                🤝 {lead.partner_approval_needed ? 'Needs Partner ✓' : 'Partner?'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── STATUS CHANGER — inline collapsed ── */}
      <div className="card" style={{ marginBottom:12, padding:'12px 16px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: showStatusExpanded ? 10 : 0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.4px' }}>Status</span>
            <span style={{ fontSize:11, fontWeight:700, padding:'2px 9px', borderRadius:99, background:'var(--accent)', color:'white' }}>
              {STATUS_EMOJI[lead.status]} {lead.status?.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}
            </span>
          </div>
          <button onClick={() => setShowStatusExpanded(p=>!p)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text3)', fontSize:11, fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
            {showStatusExpanded ? '▲ Less' : '▼ Change'}
          </button>
        </div>
        {showStatusExpanded && (
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {['called','interested','future_interested','demo_sent','quote_sent','negotiating','closed','dead'].map(s => (
              <button key={s} onClick={() => { updateStatus(s); setShowStatusExpanded(false) }} disabled={updatingStatus}
                style={{ fontSize:11, padding:'5px 10px', borderRadius:99, border:`1.5px solid ${lead.status===s?'var(--accent)':'var(--border)'}`, background: lead.status===s?'var(--accent)':'var(--bg2)', color: lead.status===s?'white':'var(--text2)', fontWeight: lead.status===s?700:400, cursor:'pointer', transition:'all 0.15s' }}>
                {STATUS_EMOJI[s]} {s.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── NEXT STEP SUGGESTION ── */}
      {nextSuggestion && !['closed','dead'].includes(lead.status) && (
        <div style={{ background:'var(--accent-glow)', border:'1px solid rgba(91,82,245,0.2)', borderRadius:'var(--radius)', padding:'14px 16px', marginBottom:12, display:'flex', alignItems:'flex-start', gap:12 }}>
          <div style={{ fontSize:22, flexShrink:0 }}>{nextSuggestion.emoji}</div>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:700, fontSize:14, color:'var(--accent)', marginBottom:3 }}>👉 {nextSuggestion.label}</div>
            <div style={{ fontSize:13, color:'var(--text2)', lineHeight:1.5 }}>{nextSuggestion.tip}</div>
            {lead.next_follow_up_date && <div style={{ fontSize:12, color:'var(--yellow)', marginTop:5, fontWeight:600 }}>📅 {format(parseISO(lead.next_follow_up_date), 'EEEE, dd MMM yyyy')}</div>}
          </div>
        </div>
      )}

      {/* ── MISSED CALL BANNER ── */}
      {lead.status === 'missed' && lead.reschedule_date && (
        <div className="missed-banner" style={{ marginBottom:12 }}>
          <PhoneMissed size={16} color="var(--red)" />
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--red)' }}>📵 Call Missed — Rescheduled</div>
            <div style={{ fontSize:12, color:'var(--text3)' }}>New time: {format(new Date(lead.reschedule_date), 'dd MMM yyyy, h:mm a')}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowMissedModal(true)}><RefreshCw size={12} /> Change</button>
        </div>
      )}

      {/* ── DEMO STATUS ── */}
      {(lead.demo_link || lead.status === 'demo_sent') && (
        <div style={{ background: lead.demo_seen ? 'var(--green-bg)' : 'var(--purple-bg)', border:`1px solid ${lead.demo_seen ? 'rgba(22,163,74,0.2)' : 'rgba(124,58,237,0.2)'}`, borderRadius:'var(--radius)', padding:'12px 16px', marginBottom:12 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
            <div>
              <div style={{ fontWeight:700, fontSize:13, color: lead.demo_seen ? 'var(--green)' : 'var(--purple)' }}>{lead.demo_seen ? '✅ Demo Seen' : '🖥️ Demo Sent — Not Seen Yet'}</div>
              {lead.demo_sent_date && <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>Sent: {format(parseISO(lead.demo_sent_date), 'dd MMM yyyy')}</div>}
              {lead.demo_link && <a href={lead.demo_link} target="_blank" rel="noreferrer" style={{ fontSize:12, color:'var(--accent)', display:'flex', alignItems:'center', gap:4, marginTop:4 }}><ExternalLink size={11} /> {lead.demo_link.slice(0,40)}...</a>}
            </div>
            <div style={{ display:'flex', gap:6, flexShrink:0 }}>
              {!lead.demo_seen && <button className="btn btn-sm" style={{ background:'var(--green-bg)', color:'var(--green)', border:'1px solid rgba(22,163,74,0.2)' }} onClick={async () => { await supabase.from('leads').update({ demo_seen:true }).eq('id', id); setLead(p=>({...p, demo_seen:true})); window.__toast&&window.__toast('Marked seen!','success') }}>Mark Seen</button>}
              <button className="btn btn-ghost btn-sm" onClick={() => setShowDemoModal(true)}>Edit</button>
            </div>
          </div>
        </div>
      )}

      {/* ── QUOTE STATUS ── */}
      {lead.quote_amount && (
        <div style={{ background:'rgba(168,85,247,0.06)', border:'1px solid rgba(168,85,247,0.2)', borderRadius:'var(--radius)', padding:'12px 16px', marginBottom:12, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontWeight:700, fontSize:13, color:'var(--purple)' }}>💰 Quote Sent: ₹{Number(lead.quote_amount).toLocaleString()}</div>
            {lead.quote_sent_date && <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>Sent: {format(parseISO(lead.quote_sent_date), 'dd MMM yyyy')}</div>}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowQuoteModal(true)}>Edit</button>
        </div>
      )}

      {/* ── ACTIVE REMINDERS ── */}
      {reminders.length > 0 && (
        <div className="card" style={{ marginBottom:12 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:10 }}>⏰ Active Reminders</div>
          {reminders.map(r => (
            <div key={r.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', background:'var(--yellow-bg)', border:'1px solid rgba(217,119,6,0.2)', borderRadius:'var(--radius-sm)', marginBottom:6 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600 }}>{r.type} · {r.message}</div>
                <div style={{ fontSize:11, color:'var(--text3)' }}>{format(new Date(r.remind_at), 'dd MMM yyyy, h:mm a')}</div>
              </div>
              <button className="btn btn-sm" style={{ background:'var(--green-bg)', color:'var(--green)', border:'1px solid rgba(22,163,74,0.2)', fontSize:11 }} onClick={() => markReminderDone(r.id)}>✓</button>
            </div>
          ))}
        </div>
      )}

      {/* ── TABS ── */}
      <div style={{ display:'flex', gap:6, marginBottom:12, overflowX:'auto', paddingBottom:4 }}>
        {[
          { key:'intel',    label:`🧠 AI Brief${lead.opportunity_score ? ` (${lead.opportunity_score})` : ''}` },
          { key:'timeline', label:`📞 Timeline (${timeline.length})` },
          { key:'notes',    label:`📝 Notes (${leadNotes.length})` },
          { key:'audit',    label:`🤖 AI Audit${lead.last_audit_score ? ` (${lead.last_audit_score})` : ''}` },
          { key:'details',  label:'📋 Details' },
          { key:'whatsapp', label:'💬 WA' },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} className={`btn btn-sm ${activeTab===t.key?'btn-primary':'btn-ghost'}`} style={{ whiteSpace:'nowrap' }}>{t.label}</button>
        ))}
      </div>

      {/* ══ TAB: TIMELINE ══ */}
      {activeTab === 'timeline' && (
        <div className="card">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <div style={{ fontFamily:'var(--font-display)', fontSize:15, fontWeight:700 }}>Full Journey Timeline</div>
            <div style={{ display:'flex', gap:7 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowNoteModal(true)}><StickyNote size={12} /> Note</button>
              <button className="btn btn-primary btn-sm" onClick={() => setShowCallModal(true)}><Plus size={12} /> Log Call</button>
            </div>
          </div>

          {timeline.length === 0 ? (
            <div className="empty-state" style={{ padding:'32px 0' }}>
              <div style={{ fontSize:32, marginBottom:12 }}>📞</div>
              <p>No activity yet</p>
              <span>Log your first call to start tracking this lead</span>
              <button className="btn btn-primary" style={{ marginTop:16 }} onClick={() => setShowCallModal(true)}>Log First Call</button>
            </div>
          ) : (
            <div style={{ position:'relative' }}>
              <div style={{ position:'absolute', left:15, top:0, bottom:0, width:2, background:'var(--border)', zIndex:0 }} />

              {timeline.map((item, index) => (
                <div key={item.id} style={{ display:'flex', gap:14, marginBottom:20, position:'relative', zIndex:1 }}>
                  {/* DOT */}
                  <div style={{ width:32, height:32, borderRadius:'50%', background: item._type === 'call' ? (OUTCOME_COLOR[item.outcome] || 'var(--bg3)') : 'var(--bg3)', border:`2px solid var(--border)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0, zIndex:1 }}>
                    {item._type === 'call' ? (OUTCOME_EMOJI[item.outcome] || '📞') : (NOTE_TYPE_LABELS[item.type]?.split(' ')[0] || '📝')}
                  </div>

                  {/* CONTENT */}
                  <div style={{ flex:1, minWidth:0 }}>
                    {item._type === 'call' ? (
                      <>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8, marginBottom:8 }}>
                          <div>
                            <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
                              <span style={{ fontWeight:700, fontSize:13 }}>Call {callLogs.length - callLogs.findIndex(c => c.id === item.id)}</span>
                              <OutcomeBadge outcome={item.outcome} />
                              {item.duration_minutes && <span style={{ fontSize:11, color:'var(--text3)', background:'var(--bg3)', padding:'2px 7px', borderRadius:99 }}>⏱ {item.duration_minutes}m</span>}
                            </div>
                            <div style={{ fontSize:11, color:'var(--text3)', marginTop:3 }}>
                              {format(new Date(item.called_at), 'EEEE, dd MMM yyyy · h:mm a')}
                              <span style={{ marginLeft:6 }}>({formatDistanceToNow(new Date(item.called_at), { addSuffix:true })})</span>
                            </div>
                          </div>
                          <button onClick={() => deleteCallLog(item.id)} className="btn-icon" style={{ padding:'3px 5px', flexShrink:0 }}><Trash2 size={11} /></button>
                        </div>
                        {item.notes && (
                          <div style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'12px 14px', marginBottom:8 }}>
                            <div style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:5 }}>What was discussed</div>
                            <div style={{ fontSize:13, color:'var(--text)', lineHeight:1.7, whiteSpace:'pre-wrap' }}>{item.notes}</div>
                          </div>
                        )}
                        {(item.next_action || item.next_follow_up_date) && (
                          <div style={{ background:'var(--accent-glow)', border:'1px solid rgba(91,82,245,0.15)', borderRadius:'var(--radius-sm)', padding:'7px 12px', marginBottom:8, display:'flex', gap:10, flexWrap:'wrap' }}>
                            {item.next_action && <span style={{ fontSize:12, color:'var(--accent)', fontWeight:600 }}>Next: {item.next_action.replace(/_/g,' ')}</span>}
                            {item.next_follow_up_date && <span style={{ fontSize:12, color:'var(--yellow)', fontWeight:600 }}>📅 {format(parseISO(item.next_follow_up_date), 'dd MMM yyyy')}</span>}
                          </div>
                        )}
                        {item.transcript && (
                          <div>
                            <button style={{ background:'none', border:'none', color:'var(--accent)', fontSize:12, cursor:'pointer', display:'flex', alignItems:'center', gap:4, padding:'4px 0', fontWeight:600 }}
                              onClick={() => setExpandedLog(p => ({ ...p, [item.id]: !p[item.id] }))}>
                              <Mic size={12} /> Transcript {expandedLog[item.id] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            </button>
                            {expandedLog[item.id] && <div style={{ background:'#f8f9ff', border:'1px solid rgba(91,82,245,0.15)', borderRadius:'var(--radius-sm)', padding:'12px 14px', marginTop:6, fontSize:12, color:'var(--text2)', lineHeight:1.8, maxHeight:220, overflowY:'auto', whiteSpace:'pre-wrap' }}>{item.transcript}</div>}
                          </div>
                        )}
                      </>
                    ) : (
                      // NOTE ENTRY
                      <div>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8, marginBottom:6 }}>
                          <div>
                            <div style={{ fontSize:12, fontWeight:700, color:'var(--text3)' }}>{NOTE_TYPE_LABELS[item.type] || '📝 Note'}</div>
                            <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>
                              {format(new Date(item.created_at), 'dd MMM yyyy, h:mm a')}
                              {item.scheduled_at && <span style={{ color:'var(--yellow)', marginLeft:6 }}>📅 {format(new Date(item.scheduled_at), 'dd MMM, h:mm a')}</span>}
                            </div>
                          </div>
                          <button onClick={() => deleteNote(item.id)} className="btn-icon" style={{ padding:'3px 5px' }}><Trash2 size={11} /></button>
                        </div>
                        <div style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'10px 12px', fontSize:13, color:'var(--text)', lineHeight:1.6 }}>{item.note}</div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* CURRENT STATUS */}
              <div style={{ display:'flex', gap:14, position:'relative', zIndex:1 }}>
                <div style={{ width:32, height:32, borderRadius:'50%', background: lead.status==='closed'?'var(--green)': lead.status==='dead'?'var(--bg3)':'var(--accent)', border:`2px solid ${lead.status==='closed'?'var(--green)':lead.status==='dead'?'var(--border)':'var(--accent)'}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0 }}>
                  {STATUS_EMOJI[lead.status] || '⏳'}
                </div>
                <div style={{ paddingTop:6 }}>
                  <div style={{ fontSize:13, fontWeight:700, color: lead.status==='closed'?'var(--green)':lead.status==='dead'?'var(--red)':'var(--text)' }}>
                    {lead.status==='closed'?'🎉 Deal Closed!':lead.status==='dead'?'❌ Not Interested':lead.status==='future_interested'?'🔮 Interested in Future':lead.status==='missed'?'📵 Call Missed':`Current: ${lead.status.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}`}
                  </div>
                  {lead.next_follow_up_date && !['closed','dead'].includes(lead.status) && <div style={{ fontSize:12, color:'var(--yellow)', marginTop:2 }}>📅 Next: {format(parseISO(lead.next_follow_up_date), 'dd MMM yyyy')}</div>}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ TAB: NOTES ══ */}
      {activeTab === 'notes' && (
        <div>
          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:12 }}>
            <button className="btn btn-primary btn-sm" onClick={() => setShowNoteModal(true)}><Plus size={13} /> Add Note</button>
          </div>
          {leadNotes.length === 0 ? (
            <div className="empty-state"><div style={{ fontSize:32 }}>📝</div><p>No notes yet</p><span>Add notes, callbacks, quotes and more</span></div>
          ) : (
            leadNotes.map(n => (
              <div key={n.id} className={`note-card type-${n.type}`}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'var(--text3)', marginBottom:4 }}>{NOTE_TYPE_LABELS[n.type] || '📝 Note'} · {format(new Date(n.created_at), 'dd MMM yyyy, h:mm a')}</div>
                    {n.scheduled_at && <div style={{ fontSize:11, color:'var(--yellow)', marginBottom:4 }}>📅 Scheduled: {format(new Date(n.scheduled_at), 'dd MMM yyyy, h:mm a')}</div>}
                    <div style={{ fontSize:13, color:'var(--text)', lineHeight:1.6 }}>{n.note}</div>
                  </div>
                  <button onClick={() => deleteNote(n.id)} className="btn-icon" style={{ padding:'3px 5px', flexShrink:0 }}><Trash2 size={11} /></button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ══ TAB: DETAILS ══ */}
      {activeTab === 'details' && (
        <div className="card">
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:14 }}>
            <div style={{ fontFamily:'var(--font-display)', fontSize:15, fontWeight:700 }}>Clinic Details</div>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowEditModal(true)}><Edit2 size={13} /> Edit</button>
          </div>
          <div className="detail-grid">
            {[
              { label:'Clinic Name', value:lead.clinic_name },
              { label:'Doctor', value:lead.doctor_name||'—' },
              { label:'Phone', value:lead.phone, isPhone:true },
              { label:'Area', value:lead.area||'—' },
              { label:'Rating', value:lead.rating?`⭐ ${lead.rating}`:'—' },
              { label:'Priority', value:lead.priority },
              { label:'Total Calls', value:`${callLogs.length} calls` },
              { label:'Missed Calls', value: lead.missed_call_count > 0 ? `📵 ${lead.missed_call_count}` : '0' },
              { label:'Deal Value', value:lead.estimated_value?`₹${Number(lead.estimated_value).toLocaleString()}`:'—' },
              { label:'Quote Sent', value:lead.quote_amount?`₹${Number(lead.quote_amount).toLocaleString()}`:'—' },
              { label:'Follow Up', value:lead.next_follow_up_date?format(parseISO(lead.next_follow_up_date),'dd MMM yyyy'):'—' },
              { label:'Next Action', value:lead.next_action?lead.next_action.replace(/_/g,' '):'—' },
            ].map(({ label, value, isPhone }) => (
              <div key={label} className="detail-block">
                <div className="detail-block-label">{label}</div>
                <div className="detail-block-value">{isPhone ? <a className="phone-link" href={`tel:${value}`}>{value}</a> : value}</div>
              </div>
            ))}
            {lead.notes && (
              <div className="detail-block" style={{ gridColumn:'1 / -1' }}>
                <div className="detail-block-label">Lead Notes</div>
                <div className="detail-block-value" style={{ color:'var(--text2)', lineHeight:1.6, whiteSpace:'pre-wrap' }}>{lead.notes}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ TAB: INTELLIGENCE ══ */}
      {activeTab === 'intel' && <LeadIntelligence lead={lead} />}

      {/* ══ TAB: AI AUDIT ══ */}
      {activeTab === 'audit' && <AIAudit lead={lead} />}

      {/* ══ TAB: WHATSAPP ══ */}
      {activeTab === 'whatsapp' && (
        <div>
          {waTemplates.length === 0
            ? <div className="empty-state"><p>No WA templates</p><span>Add in the WA Templates page</span></div>
            : waTemplates.map(t => {
                const filled = fillWaTemplate(t.message)
                return (
                  <div key={t.id} className="card" style={{ marginBottom:12 }}>
                    <div style={{ fontWeight:700, fontSize:13, marginBottom:4 }}>{t.title}</div>
                    <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:'var(--radius-sm)', padding:'12px 14px', marginBottom:10, fontSize:13, lineHeight:1.7, color:'#15803d', whiteSpace:'pre-wrap', wordBreak:'break-word' }}>{filled}</div>
                    <div style={{ display:'flex', gap:8 }}>
                      <button className="btn btn-ghost btn-sm" style={{ flex:1, justifyContent:'center' }} onClick={() => copyText(filled)}><Copy size={12} /> Copy</button>
                      <a href={`https://wa.me/91${lead.phone}?text=${encodeURIComponent(filled)}`} target="_blank" rel="noreferrer" className="wa-btn btn-sm" style={{ flex:1, justifyContent:'center' }}><MessageCircle size={12} /> Send</a>
                    </div>
                  </div>
                )
              })
          }
        </div>
      )}

      {/* ══════ MODALS ══════ */}

      {/* LOG CALL */}
      {showCallModal && (
        <div className="modal-overlay" onClick={() => setShowCallModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2>📞 Log Call — {lead.clinic_name}</h2><button className="btn-icon" onClick={() => setShowCallModal(false)}><X size={16} /></button></div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Outcome *</label>
                  <select className="form-input" value={callForm.outcome} onChange={e => handleOutcomeChange(e.target.value)}>
                    {OUTCOMES.map(o => <option key={o} value={o}>{OUTCOME_EMOJI[o]} {o.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Duration (min)</label>
                  <input className="form-input" type="number" min="0" placeholder="5" value={callForm.duration_minutes} onChange={e => setCallForm(f => ({ ...f, duration_minutes:e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">What was discussed?</label>
                <textarea className="form-input" placeholder="e.g. Spoke to Dr. Sharma. She was interested but said budget is tight this month. Asked to call back end of June..." value={callForm.notes} onChange={e => setCallForm(f => ({ ...f, notes:e.target.value }))} style={{ minHeight:110 }} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">📅 Call Date & Time</label>
                  <input type="datetime-local" className="form-input" max={new Date().toISOString().slice(0,16)} value={callForm.called_at} onChange={e => setCallForm(f => ({ ...f, called_at:e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">{callForm.outcome === 'callback' ? '📅 Callback Date' : '📅 Next Follow Up'}</label>
                  <input type="date" className="form-input" min={today} value={callForm.next_follow_up_date} onChange={e => setCallForm(f => ({ ...f, next_follow_up_date:e.target.value }))} />
                </div>
              </div>
              {callForm.outcome === 'callback' && (
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">🕐 Callback Time</label>
                    <input type="time" className="form-input" value={callForm.callback_time} onChange={e => setCallForm(f => ({ ...f, callback_time:e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Quick Pick</label>
                    <div style={{ display:'flex', gap:5, flexWrap:'wrap', paddingTop:4 }}>
                      {[{l:'Tomorrow',d:1},{l:'3 days',d:3},{l:'1 week',d:7}].map(o => {
                        const d = new Date(); d.setDate(d.getDate()+o.d)
                        const val = d.toISOString().split('T')[0]
                        return <button key={o.l} type="button" onClick={()=>setCallForm(f=>({...f,next_follow_up_date:val}))}
                          style={{ padding:'4px 8px', borderRadius:99, fontSize:10, fontWeight:600, cursor:'pointer',
                            background:callForm.next_follow_up_date===val?'var(--accent-glow2)':'var(--bg3)',
                            color:callForm.next_follow_up_date===val?'var(--accent2)':'var(--text3)',
                            border:`1px solid ${callForm.next_follow_up_date===val?'var(--accent)':'var(--border)'}` }}>{o.l}</button>
                      })}
                    </div>
                  </div>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Next Action</label>
                <select className="form-input" value={callForm.next_action} onChange={e => setCallForm(f => ({ ...f, next_action:e.target.value }))}>
                  <option value="">Select</option>
                  <option value="call">📞 Call Again</option>
                  <option value="whatsapp">💬 WhatsApp</option>
                  <option value="send_demo">🖥️ Send Demo</option>
                  <option value="send_quote">💰 Send Quote</option>
                  <option value="meeting">🤝 Fix Meeting</option>
                  <option value="close">✅ Close Deal</option>
                </select>
              </div>
              <div className="import-box" onClick={() => document.getElementById('audio-upload').click()} style={{ padding:'14px' }}>
                <input id="audio-upload" type="file" accept="audio/*" style={{ display:'none' }} onChange={e => setAudioFile(e.target.files[0])} />
                <Upload size={18} style={{ margin:'0 auto 6px', color:'var(--text3)' }} />
                {audioFile ? <div style={{ color:'var(--accent)', fontSize:13 }}>✅ {audioFile.name}</div> : <div style={{ color:'var(--text3)', fontSize:13 }}>Upload recording — AI transcribes it</div>}
              </div>
              {transcribing && <div style={{ display:'flex', alignItems:'center', gap:8, color:'var(--accent)', fontSize:13 }}><div className="spinner" /> Transcribing...</div>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowCallModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveCallLog} disabled={saving||transcribing}>{saving?'Saving...':transcribing?'Transcribing...':'Save Call'}</button>
            </div>
          </div>
        </div>
      )}

      {/* MISSED CALL */}
      {showMissedModal && (
        <div className="modal-overlay" onClick={() => setShowMissedModal(false)}>
          <div className="modal" style={{ maxWidth:440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2>📵 Mark Missed Call</h2><button className="btn-icon" onClick={() => setShowMissedModal(false)}><X size={16} /></button></div>
            <div className="modal-body">
              <div style={{ background:'var(--red-bg)', border:'1px solid rgba(220,38,38,0.2)', borderRadius:'var(--radius-sm)', padding:'10px 14px', marginBottom:16, fontSize:13, color:'var(--red)' }}>
                This will log a missed call and create a reschedule reminder automatically.
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">📅 Reschedule Date</label>
                  <input type="date" className="form-input" min={today} value={missedForm.reschedule_date} onChange={e => setMissedForm(f => ({ ...f, reschedule_date:e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">🕐 Time</label>
                  <input type="time" className="form-input" value={missedForm.reschedule_time} onChange={e => setMissedForm(f => ({ ...f, reschedule_time:e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Note (optional)</label>
                <input className="form-input" placeholder="e.g. They were busy, try after 5 PM" value={missedForm.note} onChange={e => setMissedForm(f => ({ ...f, note:e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowMissedModal(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ background:'var(--red)' }} onClick={saveMissedCall} disabled={saving}>{saving?'Saving...':'Log Missed + Reschedule'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ADD NOTE */}
      {showNoteModal && (
        <div className="modal-overlay" onClick={() => setShowNoteModal(false)}>
          <div className="modal" style={{ maxWidth:440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2>📝 Add Note</h2><button className="btn-icon" onClick={() => setShowNoteModal(false)}><X size={16} /></button></div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Type</label>
                <select className="form-input" value={noteForm.type} onChange={e => setNoteForm(f => ({ ...f, type:e.target.value }))}>
                  <option value="note">📝 General Note</option>
                  <option value="callback">📞 Callback Scheduled</option>
                  <option value="whatsapp">💬 WhatsApp Sent</option>
                  <option value="meeting">🤝 Meeting</option>
                  <option value="quote">💰 Quote Info</option>
                </select>
              </div>
              {(noteForm.type === 'callback' || noteForm.type === 'meeting') && (
                <div className="form-group">
                  <label className="form-label">📅 Scheduled Date & Time</label>
                  <input type="datetime-local" className="form-input" min={new Date().toISOString().slice(0,16)} value={noteForm.scheduled_at} onChange={e => setNoteForm(f => ({ ...f, scheduled_at:e.target.value }))} />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Note *</label>
                <textarea className="form-input" placeholder="Write your note here..." value={noteForm.note} onChange={e => setNoteForm(f => ({ ...f, note:e.target.value }))} style={{ minHeight:100 }} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowNoteModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveNote} disabled={saving}>{saving?'Saving...':'Save Note'}</button>
            </div>
          </div>
        </div>
      )}

      {/* QUOTE */}
      {showQuoteModal && (
        <div className="modal-overlay" onClick={() => setShowQuoteModal(false)}>
          <div className="modal" style={{ maxWidth:400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2>💰 Send Quote</h2><button className="btn-icon" onClick={() => setShowQuoteModal(false)}><X size={16} /></button></div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Quote Amount (₹)</label>
                <input className="form-input" type="number" placeholder="15000" value={quoteForm.quote_amount} onChange={e => setQuoteForm(f => ({ ...f, quote_amount:e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">📅 Date Sent</label>
                <input type="date" className="form-input" max={today} value={quoteForm.quote_sent_date} onChange={e => setQuoteForm(f => ({ ...f, quote_sent_date:e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowQuoteModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveQuote} disabled={saving}>{saving?'Saving...':'Save Quote'}</button>
            </div>
          </div>
        </div>
      )}

      {/* DEMO */}
      {showDemoModal && (
        <div className="modal-overlay" onClick={() => setShowDemoModal(false)}>
          <div className="modal" style={{ maxWidth:440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2>🖥️ Demo Info</h2><button className="btn-icon" onClick={() => setShowDemoModal(false)}><X size={16} /></button></div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Demo Link</label>
                <input className="form-input" placeholder="https://demo.agastyone.in/clinic-name" value={demoForm.demo_link} onChange={e => setDemoForm(f => ({ ...f, demo_link:e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">📅 Date Sent</label>
                <input type="date" className="form-input" max={today} value={demoForm.demo_sent_date} onChange={e => setDemoForm(f => ({ ...f, demo_sent_date:e.target.value }))} />
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', background:'var(--bg3)', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)' }}>
                <input type="checkbox" id="demo-seen" checked={demoForm.demo_seen} onChange={e => setDemoForm(f => ({ ...f, demo_seen:e.target.checked }))} style={{ width:16, height:16, cursor:'pointer' }} />
                <label htmlFor="demo-seen" style={{ fontSize:13, cursor:'pointer', fontWeight:500 }}>Doctor has seen the demo</label>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowDemoModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveDemoInfo} disabled={saving}>{saving?'Saving...':'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* REMINDER */}
      {showReminderModal && (
        <div className="modal-overlay" onClick={() => setShowReminderModal(false)}>
          <div className="modal" style={{ maxWidth:420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2>🔔 Set Reminder</h2><button className="btn-icon" onClick={() => setShowReminderModal(false)}><X size={16} /></button></div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">📅 When</label>
                <input type="datetime-local" className="form-input" min={new Date().toISOString().slice(0,16)} value={reminderForm.remind_at} onChange={e => setReminderForm(f => ({ ...f, remind_at:e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Type</label>
                <select className="form-input" value={reminderForm.type} onChange={e => setReminderForm(f => ({ ...f, type:e.target.value }))}>
                  <option value="call">📞 Call</option>
                  <option value="whatsapp">💬 WhatsApp</option>
                  <option value="meeting">🤝 Meeting</option>
                  <option value="follow_up">🔄 Follow Up</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Note</label>
                <input className="form-input" placeholder="e.g. Call after 6 PM" value={reminderForm.message} onChange={e => setReminderForm(f => ({ ...f, message:e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowReminderModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveReminder} disabled={saving}>{saving?'Saving...':'Set Reminder'}</button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT LEAD */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2>✏️ Edit Lead</h2><button className="btn-icon" onClick={() => setShowEditModal(false)}><X size={16} /></button></div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group"><label className="form-label">Clinic Name</label><input className="form-input" value={editForm.clinic_name} onChange={e => setEditForm(f => ({ ...f, clinic_name:e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Doctor Name</label><input className="form-input" value={editForm.doctor_name} onChange={e => setEditForm(f => ({ ...f, doctor_name:e.target.value }))} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Phone</label><input className="form-input" type="tel" value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone:e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Area</label><input className="form-input" value={editForm.area} onChange={e => setEditForm(f => ({ ...f, area:e.target.value }))} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Rating</label><input className="form-input" type="number" step="0.1" min="1" max="5" value={editForm.rating} onChange={e => setEditForm(f => ({ ...f, rating:e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Deal Value (₹)</label><input className="form-input" type="number" value={editForm.estimated_value} onChange={e => setEditForm(f => ({ ...f, estimated_value:e.target.value }))} /></div>
              </div>
              <div className="form-group">
                <label className="form-label">Priority</label>
                <select className="form-input" value={editForm.priority} onChange={e => setEditForm(f => ({ ...f, priority:e.target.value }))}>
                  <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
                </select>
              </div>
              <div className="form-group"><label className="form-label">Notes</label><textarea className="form-input" value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes:e.target.value }))} /></div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowEditModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveEdit} disabled={saving}>{saving?'Saving...':'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* SCRIPT */}
      {showScriptModal && (
        <div className="modal-overlay" onClick={() => setShowScriptModal(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2>📄 Call Scripts</h2><button className="btn-icon" onClick={() => setShowScriptModal(false)}><X size={16} /></button></div>
            <div className="modal-body">
              <div style={{ display:'flex', gap:7, marginBottom:14, flexWrap:'wrap' }}>
                {scripts.map(s => <button key={s.id} className={`btn btn-sm ${selectedScript?.id===s.id?'btn-primary':'btn-ghost'}`} onClick={() => setSelectedScript(s)}>{s.title}</button>)}
              </div>
              {selectedScript ? <div className="script-box">{selectedScript.content}</div> : <div style={{ color:'var(--text3)', fontSize:13, textAlign:'center', padding:'20px 0' }}>Select a script above</div>}
            </div>
          </div>
        </div>
      )}

      {/* CALLBACK SCHEDULER */}
      {showCallbackModal && lead && (() => {
        const todayStr = new Date().toISOString().split('T')[0]
        const current = lead.callback_scheduled_at ? new Date(lead.callback_scheduled_at) : null
        const [cbDate, setCbDate] = React.useState(current ? current.toISOString().split('T')[0] : '')
        const [cbTime, setCbTime] = React.useState(current ? current.toTimeString().slice(0,5) : '10:00')
        const [cbNote, setCbNote] = React.useState('')
        const [cbSaving, setCbSaving] = React.useState(false)

        async function saveCallback() {
          if (!cbDate) { window.__toast && window.__toast('Pick a date', 'error'); return }
          setCbSaving(true)
          const scheduledAt = `${cbDate}T${cbTime || '10:00'}`
          await supabase.from('leads').update({ callback_scheduled_at: scheduledAt, next_follow_up_date: cbDate, next_action: 'call' }).eq('id', lead.id)
          if (cbNote) await supabase.from('lead_notes').insert({ lead_id: lead.id, note: `📞 Callback scheduled for ${format(new Date(scheduledAt), 'dd MMM, h:mm a')}${cbNote ? ' — ' + cbNote : ''}`, type: 'callback' })
          setCbSaving(false)
          window.__toast && window.__toast(`Callback set for ${format(new Date(scheduledAt), 'dd MMM, h:mm a')}`, 'success')
          setShowCallbackModal(false)
          fetchData()
        }

        async function removeCallback() {
          await supabase.from('leads').update({ callback_scheduled_at: null }).eq('id', lead.id)
          window.__toast && window.__toast('Callback removed', 'success')
          setShowCallbackModal(false)
          fetchData()
        }

        return (
          <div className="modal-overlay" onClick={() => setShowCallbackModal(false)}>
            <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>📞 Schedule Callback</h2>
                <button className="btn-icon" onClick={() => setShowCallbackModal(false)} style={{ fontSize: 18 }}>×</button>
              </div>
              <div className="modal-body">
                <div className="form-row" style={{ marginBottom: 12 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Date</label>
                    <input type="date" className="form-input" min={todayStr} value={cbDate} onChange={e => setCbDate(e.target.value)}/>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Time</label>
                    <input type="time" className="form-input" value={cbTime} onChange={e => setCbTime(e.target.value)}/>
                  </div>
                </div>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:14 }}>
                  {[{l:'Tomorrow',d:1},{l:'3 days',d:3},{l:'1 week',d:7},{l:'2 weeks',d:14}].map(o => {
                    const d = new Date(); d.setDate(d.getDate()+o.d)
                    const val = d.toISOString().split('T')[0]
                    return <button key={o.l} onClick={()=>setCbDate(val)} style={{ padding:'5px 10px', borderRadius:99, fontSize:11, fontWeight:600, cursor:'pointer', background:cbDate===val?'var(--accent-glow2)':'var(--bg3)', color:cbDate===val?'var(--accent2)':'var(--text3)', border:`1px solid ${cbDate===val?'var(--accent)':'var(--border)'}` }}>{o.l}</button>
                  })}
                </div>
                <div className="form-group">
                  <label className="form-label">Note (optional)</label>
                  <input type="text" className="form-input" placeholder="e.g. Doctor back from audit" value={cbNote} onChange={e=>setCbNote(e.target.value)}/>
                </div>
              </div>
              <div className="modal-footer" style={{ justifyContent:'space-between' }}>
                {lead.callback_scheduled_at && <button className="btn btn-danger btn-sm" onClick={removeCallback}>🗑 Remove</button>}
                <div style={{ display:'flex', gap:8, marginLeft:'auto' }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowCallbackModal(false)}>Cancel</button>
                  <button className="btn btn-primary btn-sm" onClick={saveCallback} disabled={cbSaving}>{cbSaving?'Saving...':'Save Callback'}</button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
