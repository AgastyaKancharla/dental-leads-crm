/* eslint-disable */
import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { StatusBadge, PriorityBadge, OutcomeBadge } from '../components/Badges'
import { Phone, MessageCircle, ArrowLeft, Plus, X, Mic, FileText, Bell, Star, Upload, ChevronDown, ChevronUp, Trash2, Edit2, CheckCircle, Clock, AlertTriangle, ExternalLink, Copy } from 'lucide-react'
import { format, parseISO, formatDistanceToNow } from 'date-fns'

const STATUSES = ['new', 'called', 'interested', 'demo_sent', 'negotiating', 'closed', 'dead']
const OUTCOMES = ['interested', 'callback', 'not_interested', 'no_answer', 'demo_requested', 'closed', 'other']
const EMPTY_CALL = { outcome: 'interested', duration_minutes: '', notes: '', next_follow_up_date: '', next_action: 'call', called_at: '' }

const OUTCOME_EMOJI  = { interested:'😊', callback:'📞', not_interested:'❌', no_answer:'📵', demo_requested:'🖥️', closed:'✅', other:'💬' }
const OUTCOME_COLOR  = { interested:'var(--green-bg)', callback:'var(--yellow-bg)', not_interested:'var(--red-bg)', no_answer:'var(--bg3)', demo_requested:'var(--purple-bg)', closed:'rgba(22,163,74,0.12)', other:'var(--bg3)' }
const OUTCOME_BORDER = { interested:'rgba(22,163,74,0.2)', callback:'rgba(217,119,6,0.2)', not_interested:'rgba(220,38,38,0.2)', no_answer:'var(--border)', demo_requested:'rgba(124,58,237,0.2)', closed:'rgba(22,163,74,0.3)', other:'var(--border)' }

const STAGE_FLOW = [
  { key: 'new',         label: 'Lead Added',     emoji: '📋' },
  { key: 'called',      label: 'First Call',      emoji: '📞' },
  { key: 'interested',  label: 'Interested',      emoji: '😊' },
  { key: 'demo_sent',   label: 'Demo Sent',       emoji: '🖥️' },
  { key: 'negotiating', label: 'Negotiating',     emoji: '🤝' },
  { key: 'closed',      label: 'Closed',          emoji: '✅' },
]

const NEXT_ACTION_MAP = {
  interested:     { action: 'send_demo', label: 'Send Demo', emoji: '🖥️', tip: 'They showed interest — send the demo link now while its fresh' },
  callback:       { action: 'call',      label: 'Call Back',  emoji: '📞', tip: 'They asked for a callback — call on the scheduled date' },
  not_interested: { action: null,        label: 'Move On',    emoji: '❌', tip: 'Mark as dead or try again in 3 months' },
  no_answer:      { action: 'call',      label: 'Try Again',  emoji: '📵', tip: 'No answer — try again tomorrow at a different time' },
  demo_requested: { action: 'send_demo', label: 'Send Demo',  emoji: '🖥️', tip: 'They asked for a demo — send it immediately!' },
  closed:         { action: null,        label: 'Won! 🎉',    emoji: '✅', tip: 'Deal closed — collect payment and onboard' },
  other:          { action: 'call',      label: 'Follow Up',  emoji: '📞', tip: 'Follow up to clarify next steps' },
}

export default function LeadDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [lead, setLead] = useState(null)
  const [callLogs, setCallLogs] = useState([])
  const [reminders, setReminders] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCallModal, setShowCallModal] = useState(false)
  const [showReminderModal, setShowReminderModal] = useState(false)
  const [showScriptModal, setShowScriptModal] = useState(false)
  const [showDemoModal, setShowDemoModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [scripts, setScripts] = useState([])
  const [waTemplates, setWaTemplates] = useState([])
  const [selectedScript, setSelectedScript] = useState(null)
  const [callForm, setCallForm] = useState(EMPTY_CALL)
  const [reminderForm, setReminderForm] = useState({ remind_at: '', type: 'call', message: '' })
  const [demoForm, setDemoForm] = useState({ demo_link: '', demo_sent_date: '', demo_seen: false })
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [expandedLog, setExpandedLog] = useState({})
  const [audioFile, setAudioFile] = useState(null)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [activeTab, setActiveTab] = useState('timeline')
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => { fetchAll() }, [id])

  async function fetchAll() {
    setLoading(true)
    const [l, c, s, r, w] = await Promise.all([
      supabase.from('leads').select('*').eq('id', id).single(),
      supabase.from('call_logs').select('*').eq('lead_id', id).order('called_at', { ascending: true }),
      supabase.from('call_scripts').select('*').eq('is_active', true),
      supabase.from('reminders').select('*').eq('lead_id', id).eq('status', 'pending').order('remind_at'),
      supabase.from('whatsapp_templates').select('*').order('created_at'),
    ])
    setLead(l.data)
    setCallLogs(c.data || [])
    setScripts(s.data || [])
    setReminders(r.data || [])
    setWaTemplates(w.data || [])
    if (l.data) {
      setDemoForm({ demo_link: l.data.demo_link || '', demo_sent_date: l.data.demo_sent_date || '', demo_seen: l.data.demo_seen || false })
      setEditForm({ clinic_name: l.data.clinic_name, doctor_name: l.data.doctor_name || '', phone: l.data.phone, area: l.data.area || '', rating: l.data.rating || '', priority: l.data.priority, notes: l.data.notes || '', estimated_value: l.data.estimated_value || '' })
    }
    setLoading(false)
  }

  async function updateStatus(newStatus) {
    setUpdatingStatus(true)
    await supabase.from('leads').update({ status: newStatus }).eq('id', id)
    setLead(prev => ({ ...prev, status: newStatus }))
    window.__toast && window.__toast(`Status → ${newStatus}`, 'success')
    setUpdatingStatus(false)
  }

  async function saveDemoInfo() {
    setSaving(true)
    await supabase.from('leads').update({ ...demoForm, status: 'demo_sent' }).eq('id', id)
    setLead(prev => ({ ...prev, ...demoForm, status: 'demo_sent' }))
    setSaving(false); setShowDemoModal(false)
    window.__toast && window.__toast('Demo info saved!', 'success')
  }

  async function saveEdit() {
    setSaving(true)
    const payload = { ...editForm, rating: editForm.rating ? parseFloat(editForm.rating) : null, estimated_value: editForm.estimated_value ? parseFloat(editForm.estimated_value) : null }
    await supabase.from('leads').update(payload).eq('id', id)
    setLead(prev => ({ ...prev, ...payload }))
    setSaving(false); setShowEditModal(false)
    window.__toast && window.__toast('Lead updated!', 'success')
  }

  async function saveCallLog() {
    if (!callForm.outcome) { window.__toast && window.__toast('Select an outcome', 'error'); return }
    setSaving(true)
    if (audioFile) {
      setTranscribing(true)
      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          const base64 = e.target.result.split(',')[1]
          const resp = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1000,
              messages: [{ role: 'user', content: [
                { type: 'text', text: 'Transcribe this sales call recording. Format as "Agastya: ... Doctor: ..." Return only the transcription.' },
                { type: 'document', source: { type: 'base64', media_type: audioFile.type || 'audio/mpeg', data: base64 } }
              ]}]
            })
          })
          const data = await resp.json()
          await insertCallLog(data.content?.[0]?.text || 'Transcription unavailable')
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
    const statusMap = { interested:'interested', callback:'called', not_interested:'dead', no_answer:'called', demo_requested:'demo_sent', closed:'closed' }
    await supabase.from('leads').update({
      status: statusMap[callForm.outcome] || lead.status,
      next_follow_up_date: callForm.next_follow_up_date || null,
      next_action: callForm.next_action || null,
    }).eq('id', id)
    setSaving(false); setShowCallModal(false); setCallForm(EMPTY_CALL); setAudioFile(null)
    fetchAll()
    window.__toast && window.__toast('Call logged!', 'success')
  }

  async function saveReminder() {
    if (!reminderForm.remind_at) { window.__toast && window.__toast('Set date/time', 'error'); return }
    setSaving(true)
    await supabase.from('reminders').insert({ lead_id: id, ...reminderForm })
    setSaving(false); setShowReminderModal(false); setReminderForm({ remind_at: '', type: 'call', message: '' })
    window.__toast && window.__toast('Reminder set!', 'success')
    fetchAll()
  }

  async function markReminderDone(rid) {
    await supabase.from('reminders').update({ status: 'done' }).eq('id', rid)
    setReminders(prev => prev.filter(r => r.id !== rid))
    window.__toast && window.__toast('Done!', 'success')
  }

  async function deleteCallLog(callId) {
    if (!window.confirm('Delete this call log?')) return
    await supabase.from('call_logs').delete().eq('id', callId)
    setCallLogs(prev => prev.filter(c => c.id !== callId))
    window.__toast && window.__toast('Deleted', 'success')
  }

  function fillWaTemplate(msg) {
    return msg.replace(/\[Doctor Name\]/g, lead?.doctor_name || 'Doctor').replace(/\[Clinic Name\]/g, lead?.clinic_name || '').replace(/\[Demo Link\]/g, lead?.demo_link || '')
  }

  function copyText(text) {
    navigator.clipboard.writeText(text).catch(() => {})
    window.__toast && window.__toast('Copied!', 'success')
  }

  const latestLog = callLogs[callLogs.length - 1]
  const nextSuggestion = latestLog ? NEXT_ACTION_MAP[latestLog.outcome] : null
  const stageIndex = STAGE_FLOW.findIndex(s => s.key === lead?.status)

  if (loading) return <div className="loading"><div className="spinner" /> Loading...</div>
  if (!lead) return <div className="empty-state"><p>Lead not found</p></div>

  return (
    <div>
      {/* BACK */}
      <button className="btn btn-ghost btn-sm" style={{ marginBottom: 14 }} onClick={() => navigate(-1)}>
        <ArrowLeft size={14} /> Back
      </button>

      {/* ── CLINIC HEADER ── */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <StatusBadge status={lead.status} />
              <PriorityBadge priority={lead.priority} />
              {lead.rating && <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, color: 'var(--yellow)', background: 'var(--yellow-bg)', padding: '2px 8px', borderRadius: 99 }}><Star size={11} fill="var(--yellow)" /> {lead.rating}</span>}
            </div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, marginBottom: 4, wordBreak: 'break-word' }}>{lead.clinic_name}</h2>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 13, color: 'var(--text2)' }}>
              {lead.doctor_name && <span>👨‍⚕️ {lead.doctor_name}</span>}
              {lead.area && <span>📍 {lead.area}</span>}
              {lead.estimated_value && <span style={{ color: 'var(--green)', fontWeight: 600 }}>💰 ₹{Number(lead.estimated_value).toLocaleString()}</span>}
            </div>
          </div>
          <button className="btn-icon" onClick={() => setShowEditModal(true)} title="Edit lead"><Edit2 size={15} /></button>
        </div>

        {/* QUICK ACTIONS */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          <a href={`tel:${lead.phone}`} className="btn btn-primary btn-sm"><Phone size={13} /> {lead.phone}</a>
          <a href={`https://wa.me/91${lead.phone}`} target="_blank" rel="noreferrer" className="wa-btn btn-sm"><MessageCircle size={13} /> WhatsApp</a>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowCallModal(true)}><Plus size={13} /> Log Call</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowDemoModal(true)}>🖥️ Demo</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowReminderModal(true)}><Bell size={13} /> Remind</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowScriptModal(true)}><FileText size={13} /> Script</button>
        </div>
      </div>

      {/* ── JOURNEY PROGRESS BAR ── */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 12 }}>Journey Progress</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          {STAGE_FLOW.map((stage, i) => {
            const isCompleted = stageIndex > i
            const isCurrent = stageIndex === i
            const isLast = i === STAGE_FLOW.length - 1
            return (
              <React.Fragment key={stage.key}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: isLast ? 0 : 1, minWidth: 0 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: isCompleted ? 'var(--green)' : isCurrent ? 'var(--accent)' : 'var(--bg3)', border: `2px solid ${isCompleted ? 'var(--green)' : isCurrent ? 'var(--accent)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0 }}
                    onClick={() => updateStatus(stage.key)}>
                    {isCompleted ? '✓' : stage.emoji}
                  </div>
                  <div style={{ fontSize: 9, color: isCurrent ? 'var(--accent)' : isCompleted ? 'var(--green)' : 'var(--text3)', fontWeight: isCurrent ? 700 : 400, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', maxWidth: 52, textOverflow: 'ellipsis' }}>{stage.label}</div>
                </div>
                {!isLast && (
                  <div style={{ flex: 1, height: 2, background: isCompleted ? 'var(--green)' : 'var(--border)', marginBottom: 16, transition: 'background 0.3s', minWidth: 8 }} />
                )}
              </React.Fragment>
            )
          })}
        </div>
      </div>

      {/* ── NEXT ACTION SUGGESTION ── */}
      {nextSuggestion && lead.status !== 'closed' && lead.status !== 'dead' && (
        <div style={{ background: nextSuggestion.action ? 'var(--accent-glow)' : 'var(--bg3)', border: `1px solid ${nextSuggestion.action ? 'rgba(91,82,245,0.2)' : 'var(--border)'}`, borderRadius: 'var(--radius)', padding: '14px 16px', marginBottom: 12, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ fontSize: 22, flexShrink: 0 }}>{nextSuggestion.emoji}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--accent)', marginBottom: 3 }}>Suggested Next Step: {nextSuggestion.label}</div>
            <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>{nextSuggestion.tip}</div>
            {lead.next_follow_up_date && (
              <div style={{ fontSize: 12, color: 'var(--yellow)', marginTop: 6, fontWeight: 600 }}>📅 Scheduled: {format(parseISO(lead.next_follow_up_date), 'EEEE, dd MMM yyyy')}</div>
            )}
          </div>
        </div>
      )}

      {/* ── DEMO STATUS CARD (if demo sent) ── */}
      {(lead.status === 'demo_sent' || lead.demo_link) && (
        <div style={{ background: lead.demo_seen ? 'var(--green-bg)' : 'var(--purple-bg)', border: `1px solid ${lead.demo_seen ? 'rgba(22,163,74,0.2)' : 'rgba(124,58,237,0.2)'}`, borderRadius: 'var(--radius)', padding: '14px 16px', marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: lead.demo_seen ? 'var(--green)' : 'var(--purple)', marginBottom: 4 }}>
                {lead.demo_seen ? '✅ Demo Seen' : '🖥️ Demo Sent — Not Seen Yet'}
              </div>
              {lead.demo_sent_date && <div style={{ fontSize: 12, color: 'var(--text3)' }}>Sent: {format(parseISO(lead.demo_sent_date), 'dd MMM yyyy')}</div>}
              {lead.demo_link && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                  <a href={lead.demo_link} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4 }}><ExternalLink size={11} /> {lead.demo_link.slice(0, 35)}...</a>
                  <button className="btn-icon" style={{ padding: '3px 5px' }} onClick={() => copyText(lead.demo_link)}><Copy size={11} /></button>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              {!lead.demo_seen && (
                <button className="btn btn-sm" style={{ background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid rgba(22,163,74,0.2)', fontSize: 12 }}
                  onClick={async () => { await supabase.from('leads').update({ demo_seen: true }).eq('id', id); setLead(p => ({ ...p, demo_seen: true })); window.__toast && window.__toast('Marked as seen!', 'success') }}>
                  Mark Seen
                </button>
              )}
              <button className="btn btn-ghost btn-sm" onClick={() => setShowDemoModal(true)}>Edit</button>
            </div>
          </div>
        </div>
      )}

      {/* ── ACTIVE REMINDERS ── */}
      {reminders.length > 0 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 10 }}>⏰ Active Reminders</div>
          {reminders.map(r => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'var(--yellow-bg)', border: '1px solid rgba(217,119,6,0.2)', borderRadius: 'var(--radius-sm)', marginBottom: 6 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{r.type} reminder</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{format(new Date(r.remind_at), 'dd MMM yyyy, h:mm a')} · {r.message}</div>
              </div>
              <button className="btn btn-sm" style={{ background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid rgba(22,163,74,0.2)', fontSize: 11 }} onClick={() => markReminderDone(r.id)}>✓</button>
            </div>
          ))}
        </div>
      )}

      {/* ── TABS ── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {['timeline', 'details', 'whatsapp'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`btn btn-sm ${activeTab === tab ? 'btn-primary' : 'btn-ghost'}`} style={{ textTransform: 'capitalize' }}>
            {tab === 'timeline' ? `📞 Call History (${callLogs.length})` : tab === 'details' ? '📋 Details' : '💬 WA Templates'}
          </button>
        ))}
      </div>

      {/* ── TAB: CALL TIMELINE ── */}
      {activeTab === 'timeline' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700 }}>Full Call History</div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowCallModal(true)}><Plus size={13} /> Log Call</button>
          </div>

          {callLogs.length === 0 ? (
            <div className="empty-state" style={{ padding: '32px 0' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📞</div>
              <p>No calls logged yet</p>
              <span>Log your first call to start tracking this lead's journey</span>
              <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowCallModal(true)}>Log First Call</button>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              {/* VERTICAL LINE */}
              <div style={{ position: 'absolute', left: 15, top: 0, bottom: 0, width: 2, background: 'var(--border)', zIndex: 0 }} />

              {callLogs.map((log, index) => (
                <div key={log.id} style={{ display: 'flex', gap: 14, marginBottom: 20, position: 'relative', zIndex: 1 }}>
                  {/* DOT */}
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: OUTCOME_COLOR[log.outcome], border: `2px solid ${OUTCOME_BORDER[log.outcome]}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0, zIndex: 1 }}>
                    {OUTCOME_EMOJI[log.outcome] || '📞'}
                  </div>

                  {/* CONTENT */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* HEADER */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                      <div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                          <span style={{ fontWeight: 700, fontSize: 13 }}>Call {index + 1}</span>
                          <OutcomeBadge outcome={log.outcome} />
                          {log.duration_minutes && <span style={{ fontSize: 11, color: 'var(--text3)', background: 'var(--bg3)', padding: '2px 7px', borderRadius: 99 }}>⏱ {log.duration_minutes}m</span>}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>
                          {format(new Date(log.called_at), 'EEEE, dd MMM yyyy · h:mm a')}
                          <span style={{ marginLeft: 6 }}>({formatDistanceToNow(new Date(log.called_at), { addSuffix: true })})</span>
                        </div>
                      </div>
                      <button onClick={() => deleteCallLog(log.id)} className="btn-icon" style={{ padding: '3px 5px', flexShrink: 0 }}><Trash2 size={11} /></button>
                    </div>

                    {/* NOTES — most important */}
                    {log.notes && (
                      <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', marginBottom: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>What was discussed</div>
                        <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{log.notes}</div>
                      </div>
                    )}

                    {/* NEXT STEP SET ON THIS CALL */}
                    {(log.next_action || log.next_follow_up_date) && (
                      <div style={{ background: 'var(--accent-glow)', border: '1px solid rgba(91,82,245,0.15)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', marginBottom: 8, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {log.next_action && <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>Next: {log.next_action.replace(/_/g, ' ')}</span>}
                        {log.next_follow_up_date && <span style={{ fontSize: 12, color: 'var(--yellow)', fontWeight: 600 }}>📅 {format(parseISO(log.next_follow_up_date), 'dd MMM yyyy')}</span>}
                      </div>
                    )}

                    {/* TRANSCRIPT */}
                    {log.transcript && (
                      <div>
                        <button style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: '4px 0', fontWeight: 600 }}
                          onClick={() => setExpandedLog(p => ({ ...p, [log.id]: !p[log.id] }))}>
                          <Mic size={12} /> Call Transcript {expandedLog[log.id] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                        {expandedLog[log.id] && (
                          <div style={{ background: '#f8f9ff', border: '1px solid rgba(91,82,245,0.15)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', marginTop: 6, fontSize: 12, color: 'var(--text2)', lineHeight: 1.8, maxHeight: 250, overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
                            {log.transcript}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* CURRENT STATUS AT BOTTOM */}
              <div style={{ display: 'flex', gap: 14, position: 'relative', zIndex: 1 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: lead.status === 'closed' ? 'var(--green)' : lead.status === 'dead' ? 'var(--bg3)' : 'var(--accent)', border: `2px solid ${lead.status === 'closed' ? 'var(--green)' : lead.status === 'dead' ? 'var(--border)' : 'var(--accent)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                  {lead.status === 'closed' ? '✅' : lead.status === 'dead' ? '❌' : '⏳'}
                </div>
                <div style={{ paddingTop: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: lead.status === 'closed' ? 'var(--green)' : 'var(--text)' }}>
                    {lead.status === 'closed' ? 'Deal Closed! 🎉' : lead.status === 'dead' ? 'Lead Closed (Not Interested)' : `Current Stage: ${lead.status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}`}
                  </div>
                  {lead.next_follow_up_date && lead.status !== 'closed' && (
                    <div style={{ fontSize: 12, color: 'var(--yellow)', marginTop: 2 }}>📅 Next follow-up: {format(parseISO(lead.next_follow_up_date), 'dd MMM yyyy')}</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: DETAILS ── */}
      {activeTab === 'details' && (
        <div>
          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700 }}>Clinic Details</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowEditModal(true)}><Edit2 size={13} /> Edit</button>
            </div>
            <div className="detail-grid">
              {[
                { label: 'Clinic Name', value: lead.clinic_name },
                { label: 'Doctor', value: lead.doctor_name || '—' },
                { label: 'Phone', value: lead.phone, isPhone: true },
                { label: 'Area', value: lead.area || '—' },
                { label: 'Google Rating', value: lead.rating ? `⭐ ${lead.rating}` : '—' },
                { label: 'Priority', value: lead.priority },
                { label: 'Total Calls', value: `${callLogs.length} calls` },
                { label: 'Deal Value', value: lead.estimated_value ? `₹${Number(lead.estimated_value).toLocaleString()}` : '—' },
                { label: 'Follow Up', value: lead.next_follow_up_date ? format(parseISO(lead.next_follow_up_date), 'dd MMM yyyy') : '—' },
                { label: 'Next Action', value: lead.next_action ? lead.next_action.replace(/_/g, ' ') : '—' },
              ].map(({ label, value, isPhone }) => (
                <div key={label} className="detail-block">
                  <div className="detail-block-label">{label}</div>
                  <div className="detail-block-value">
                    {isPhone ? <a className="phone-link" href={`tel:${value}`}>{value}</a> : value}
                  </div>
                </div>
              ))}
              {lead.notes && (
                <div className="detail-block" style={{ gridColumn: '1 / -1' }}>
                  <div className="detail-block-label">Lead Notes</div>
                  <div className="detail-block-value" style={{ color: 'var(--text2)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{lead.notes}</div>
                </div>
              )}
            </div>
          </div>

          {/* STATUS CHANGE */}
          <div className="card">
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 10 }}>Change Status</div>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              {STATUSES.map(s => (
                <button key={s} onClick={() => updateStatus(s)} disabled={updatingStatus}
                  className={`status-pill ${lead.status === s ? 'active' : ''}`}>
                  {s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: WHATSAPP ── */}
      {activeTab === 'whatsapp' && (
        <div>
          {waTemplates.length === 0 ? (
            <div className="empty-state"><p>No WA templates</p><span>Add templates in the WA Templates page</span></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {waTemplates.map(t => {
                const filled = fillWaTemplate(t.message)
                return (
                  <div key={t.id} className="card">
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{t.title}</div>
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 'var(--radius-sm)', padding: '12px 14px', marginBottom: 12, fontSize: 13, lineHeight: 1.7, color: '#15803d', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {filled}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => copyText(filled)}><Copy size={12} /> Copy</button>
                      <a href={`https://wa.me/91${lead.phone}?text=${encodeURIComponent(filled)}`} target="_blank" rel="noreferrer" className="wa-btn btn-sm" style={{ flex: 1, justifyContent: 'center' }}><MessageCircle size={12} /> Send</a>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════ MODALS ══════════ */}

      {/* LOG CALL MODAL */}
      {showCallModal && (
        <div className="modal-overlay" onClick={() => setShowCallModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📞 Log Call — {lead.clinic_name}</h2>
              <button className="btn-icon" onClick={() => setShowCallModal(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Outcome *</label>
                  <select className="form-input" value={callForm.outcome} onChange={e => setCallForm(f => ({ ...f, outcome: e.target.value }))}>
                    {OUTCOMES.map(o => <option key={o} value={o}>{OUTCOME_EMOJI[o]} {o.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Duration (min)</label>
                  <input className="form-input" type="number" min="0" placeholder="5" value={callForm.duration_minutes} onChange={e => setCallForm(f => ({ ...f, duration_minutes: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">What was discussed? *</label>
                <textarea className="form-input" placeholder="e.g. Spoke to Dr. Sharma. She was interested but said budget is tight this month. Mentioned they get 30-40 patients a week. Asked to call back end of June..." value={callForm.notes} onChange={e => setCallForm(f => ({ ...f, notes: e.target.value }))} style={{ minHeight: 120 }} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">📅 Call Date & Time</label>
                  <input type="datetime-local" className="form-input" max={new Date().toISOString().slice(0,16)} value={callForm.called_at} onChange={e => setCallForm(f => ({ ...f, called_at: e.target.value }))} />
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>Leave blank for now</span>
                </div>
                <div className="form-group">
                  <label className="form-label">📅 Next Follow Up</label>
                  <input type="date" className="form-input" min={today} value={callForm.next_follow_up_date} onChange={e => setCallForm(f => ({ ...f, next_follow_up_date: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Next Action</label>
                <select className="form-input" value={callForm.next_action} onChange={e => setCallForm(f => ({ ...f, next_action: e.target.value }))}>
                  <option value="">Select</option>
                  <option value="call">📞 Call Again</option>
                  <option value="whatsapp">💬 Send WhatsApp</option>
                  <option value="send_demo">🖥️ Send Demo</option>
                  <option value="meeting">🤝 Fix Meeting</option>
                  <option value="close">✅ Close Deal</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Upload Call Recording (optional)</label>
                <div className="import-box" onClick={() => document.getElementById('audio-upload').click()} style={{ padding: '16px' }}>
                  <input id="audio-upload" type="file" accept="audio/*" style={{ display: 'none' }} onChange={e => setAudioFile(e.target.files[0])} />
                  <Upload size={18} style={{ margin: '0 auto 6px', color: 'var(--text3)' }} />
                  {audioFile ? <div style={{ color: 'var(--accent)', fontSize: 13 }}>✅ {audioFile.name}</div> : <div style={{ color: 'var(--text3)', fontSize: 13 }}>Upload recording — AI will transcribe it</div>}
                </div>
              </div>
              {transcribing && <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent)', fontSize: 13 }}><div className="spinner" /> Transcribing with AI...</div>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowCallModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveCallLog} disabled={saving || transcribing}>
                {saving ? 'Saving...' : transcribing ? 'Transcribing...' : 'Save Call Log'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DEMO MODAL */}
      {showDemoModal && (
        <div className="modal-overlay" onClick={() => setShowDemoModal(false)}>
          <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🖥️ Demo Info</h2>
              <button className="btn-icon" onClick={() => setShowDemoModal(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Demo Link</label>
                <input className="form-input" placeholder="https://demo.agastyone.in/clinic-name" value={demoForm.demo_link} onChange={e => setDemoForm(f => ({ ...f, demo_link: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">📅 Date Sent</label>
                <input type="date" className="form-input" max={today} value={demoForm.demo_sent_date} onChange={e => setDemoForm(f => ({ ...f, demo_sent_date: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--bg3)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <input type="checkbox" id="demo-seen" checked={demoForm.demo_seen} onChange={e => setDemoForm(f => ({ ...f, demo_seen: e.target.checked }))} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                <label htmlFor="demo-seen" style={{ fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>Doctor has seen the demo</label>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowDemoModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveDemoInfo} disabled={saving}>{saving ? 'Saving...' : 'Save Demo Info'}</button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT LEAD MODAL */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>✏️ Edit Lead</h2>
              <button className="btn-icon" onClick={() => setShowEditModal(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Clinic Name</label>
                  <input className="form-input" value={editForm.clinic_name} onChange={e => setEditForm(f => ({ ...f, clinic_name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Doctor Name</label>
                  <input className="form-input" value={editForm.doctor_name} onChange={e => setEditForm(f => ({ ...f, doctor_name: e.target.value }))} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="form-input" type="tel" value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Area</label>
                  <input className="form-input" value={editForm.area} onChange={e => setEditForm(f => ({ ...f, area: e.target.value }))} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Rating</label>
                  <input className="form-input" type="number" step="0.1" min="1" max="5" value={editForm.rating} onChange={e => setEditForm(f => ({ ...f, rating: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Deal Value (₹)</label>
                  <input className="form-input" type="number" placeholder="15000" value={editForm.estimated_value} onChange={e => setEditForm(f => ({ ...f, estimated_value: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Priority</label>
                <select className="form-input" value={editForm.priority} onChange={e => setEditForm(f => ({ ...f, priority: e.target.value }))}>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-input" value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowEditModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveEdit} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
            </div>
          </div>
        </div>
      )}

      {/* REMINDER MODAL */}
      {showReminderModal && (
        <div className="modal-overlay" onClick={() => setShowReminderModal(false)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🔔 Set Reminder</h2>
              <button className="btn-icon" onClick={() => setShowReminderModal(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">📅 When</label>
                <input type="datetime-local" className="form-input" min={new Date().toISOString().slice(0,16)} value={reminderForm.remind_at} onChange={e => setReminderForm(f => ({ ...f, remind_at: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Type</label>
                <select className="form-input" value={reminderForm.type} onChange={e => setReminderForm(f => ({ ...f, type: e.target.value }))}>
                  <option value="call">📞 Call</option>
                  <option value="whatsapp">💬 WhatsApp</option>
                  <option value="meeting">🤝 Meeting</option>
                  <option value="follow_up">🔄 Follow Up</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Note</label>
                <input className="form-input" placeholder="e.g. Call after 6 PM" value={reminderForm.message} onChange={e => setReminderForm(f => ({ ...f, message: e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowReminderModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveReminder} disabled={saving}>{saving ? 'Saving...' : 'Set Reminder'}</button>
            </div>
          </div>
        </div>
      )}

      {/* SCRIPT MODAL */}
      {showScriptModal && (
        <div className="modal-overlay" onClick={() => setShowScriptModal(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📄 Call Scripts</h2>
              <button className="btn-icon" onClick={() => setShowScriptModal(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', gap: 7, marginBottom: 14, flexWrap: 'wrap' }}>
                {scripts.map(s => (
                  <button key={s.id} className={`btn btn-sm ${selectedScript?.id === s.id ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setSelectedScript(s)}>{s.title}</button>
                ))}
              </div>
              {selectedScript
                ? <div className="script-box">{selectedScript.content}</div>
                : <div style={{ color: 'var(--text3)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Select a script above</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
