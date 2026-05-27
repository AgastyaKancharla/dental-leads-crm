/* eslint-disable */
import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { StatusBadge, PriorityBadge, OutcomeBadge } from '../components/Badges'
import { Phone, MessageCircle, ArrowLeft, Plus, X, Mic, FileText, Bell, Star, Upload, ChevronDown, ChevronUp, Trash2, Calendar } from 'lucide-react'
import { format, parseISO } from 'date-fns'

const STATUSES = ['new', 'called', 'interested', 'demo_sent', 'negotiating', 'closed', 'dead']
const OUTCOMES = ['interested', 'callback', 'not_interested', 'no_answer', 'demo_requested', 'closed', 'other']
const EMPTY_CALL = { outcome: 'interested', duration_minutes: '', notes: '', next_follow_up_date: '', next_action: 'call' }

export default function LeadDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [lead, setLead] = useState(null)
  const [callLogs, setCallLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCallModal, setShowCallModal] = useState(false)
  const [showReminderModal, setShowReminderModal] = useState(false)
  const [showScriptModal, setShowScriptModal] = useState(false)
  const [scripts, setScripts] = useState([])
  const [selectedScript, setSelectedScript] = useState(null)
  const [callForm, setCallForm] = useState(EMPTY_CALL)
  const [reminderForm, setReminderForm] = useState({ remind_at: '', type: 'call', message: '' })
  const [saving, setSaving] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [expandedTranscript, setExpandedTranscript] = useState({})
  const [audioFile, setAudioFile] = useState(null)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  useEffect(() => { fetchAll() }, [id])

  async function fetchAll() {
    setLoading(true)
    const [l, c, s] = await Promise.all([
      supabase.from('leads').select('*').eq('id', id).single(),
      supabase.from('call_logs').select('*').eq('lead_id', id).order('called_at', { ascending: false }),
      supabase.from('call_scripts').select('*').eq('is_active', true),
    ])
    setLead(l.data)
    setCallLogs(c.data || [])
    setScripts(s.data || [])
    setLoading(false)
  }

  async function updateStatus(newStatus) {
    setUpdatingStatus(true)
    await supabase.from('leads').update({ status: newStatus }).eq('id', id)
    setLead(prev => ({ ...prev, status: newStatus }))
    window.__toast && window.__toast(`Status → ${newStatus}`, 'success')
    setUpdatingStatus(false)
  }

  async function saveCallLog() {
    if (!callForm.outcome) { window.__toast && window.__toast('Select an outcome', 'error'); return }
    setSaving(true)
    let transcript = ''
    if (audioFile) {
      try {
        setTranscribing(true)
        const reader = new FileReader()
        reader.onload = async (e) => {
          const base64 = e.target.result.split(',')[1]
          const resp = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'claude-sonnet-4-20250514', max_tokens: 1000,
              messages: [{ role: 'user', content: [
                { type: 'text', text: 'Transcribe this sales call. Return only the transcription as "Speaker 1: ... Speaker 2: ..."' },
                { type: 'document', source: { type: 'base64', media_type: audioFile.type || 'audio/mpeg', data: base64 } }
              ]}]
            })
          })
          const data = await resp.json()
          transcript = data.content?.[0]?.text || 'Transcription not available'
          setTranscribing(false)
          await insertCallLog(transcript)
        }
        reader.readAsDataURL(audioFile)
        return
      } catch { setTranscribing(false) }
    }
    await insertCallLog(transcript)
  }

  async function insertCallLog(transcript) {
    const payload = {
      lead_id: id,
      outcome: callForm.outcome,
      duration_minutes: callForm.duration_minutes ? parseInt(callForm.duration_minutes) : null,
      notes: callForm.notes,
      next_follow_up_date: callForm.next_follow_up_date || null,
      next_action: callForm.next_action || null,
      transcript: transcript || null,
      called_at: new Date().toISOString(),
    }
    await supabase.from('call_logs').insert(payload)
    const statusMap = { interested: 'interested', callback: 'called', not_interested: 'dead', no_answer: 'called', demo_requested: 'demo_sent', closed: 'closed' }
    await supabase.from('leads').update({
      status: statusMap[callForm.outcome] || lead.status,
      next_follow_up_date: callForm.next_follow_up_date || null,
      next_action: callForm.next_action || null,
    }).eq('id', id)
    setSaving(false)
    setShowCallModal(false)
    setCallForm(EMPTY_CALL)
    setAudioFile(null)
    fetchAll()
    window.__toast && window.__toast('Call logged!', 'success')
  }

  async function saveReminder() {
    if (!reminderForm.remind_at) { window.__toast && window.__toast('Set a date/time', 'error'); return }
    setSaving(true)
    await supabase.from('reminders').insert({ lead_id: id, ...reminderForm })
    setSaving(false)
    setShowReminderModal(false)
    setReminderForm({ remind_at: '', type: 'call', message: '' })
    window.__toast && window.__toast('Reminder set!', 'success')
  }

  async function deleteCallLog(callId) {
    if (!window.confirm('Delete this call log?')) return
    await supabase.from('call_logs').delete().eq('id', callId)
    setCallLogs(prev => prev.filter(c => c.id !== callId))
    window.__toast && window.__toast('Deleted', 'success')
  }

  const OUTCOME_EMOJI = { interested: '😊', callback: '📞', not_interested: '❌', no_answer: '📵', demo_requested: '🖥️', closed: '✅', other: '💬' }
  const OUTCOME_COLOR = { interested: 'var(--green-bg)', callback: 'var(--yellow-bg)', not_interested: 'var(--red-bg)', no_answer: 'var(--bg3)', demo_requested: 'var(--purple-bg)', closed: 'var(--green-bg)', other: 'var(--bg3)' }

  // Today's date for min attribute on date inputs
  const today = new Date().toISOString().split('T')[0]

  if (loading) return <div className="loading"><div className="spinner" /> Loading...</div>
  if (!lead) return <div className="empty-state"><p>Lead not found</p></div>

  return (
    <div>
      <button className="btn btn-ghost btn-sm" style={{ marginBottom: 16 }} onClick={() => navigate('/leads')}>
        <ArrowLeft size={14} /> Back
      </button>

      {/* HEADER */}
      <div className="lead-detail-header">
        <div className="lead-detail-info">
          <h2>{lead.clinic_name}</h2>
          <div className="meta">
            <StatusBadge status={lead.status} />
            <PriorityBadge priority={lead.priority} />
            {lead.rating && <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 13, color: 'var(--yellow)' }}><Star size={12} fill="var(--yellow)" /> {lead.rating}</span>}
            {lead.area && <span style={{ fontSize: 12, color: 'var(--text3)' }}>📍 {lead.area}</span>}
          </div>
        </div>

        {/* ACTION BUTTONS */}
        <div className="mobile-actions">
          <a href={`tel:${lead.phone}`} className="btn btn-ghost btn-sm"><Phone size={14} /> Call</a>
          <a href={`https://wa.me/91${lead.phone}`} target="_blank" rel="noreferrer" className="wa-btn btn-sm"><MessageCircle size={13} /> WhatsApp</a>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowScriptModal(true)}><FileText size={14} /> Script</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowReminderModal(true)}><Bell size={14} /> Remind</button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowCallModal(true)}><Plus size={14} /> Log Call</button>
        </div>
      </div>

      {/* STATUS PILLS */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 10, fontWeight: 700 }}>Update Status</div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          {STATUSES.map(s => (
            <button key={s} onClick={() => updateStatus(s)} disabled={updatingStatus}
              className={`status-pill ${lead.status === s ? 'active' : ''}`}>
              {s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </button>
          ))}
        </div>
      </div>

      {/* DETAILS */}
      <div className="detail-grid">
        <div className="detail-block">
          <div className="detail-block-label">Doctor</div>
          <div className="detail-block-value">{lead.doctor_name || '—'}</div>
        </div>
        <div className="detail-block">
          <div className="detail-block-label">Phone</div>
          <div className="detail-block-value"><a className="phone-link" href={`tel:${lead.phone}`}>{lead.phone}</a></div>
        </div>
        <div className="detail-block">
          <div className="detail-block-label">Follow Up</div>
          <div className="detail-block-value" style={{ color: lead.next_follow_up_date ? 'var(--yellow)' : 'var(--text3)' }}>
            {lead.next_follow_up_date ? format(parseISO(lead.next_follow_up_date), 'dd MMM yyyy') : '—'}
          </div>
        </div>
        <div className="detail-block">
          <div className="detail-block-label">Next Action</div>
          <div className="detail-block-value" style={{ textTransform: 'capitalize' }}>{lead.next_action || '—'}</div>
        </div>
        {lead.notes && (
          <div className="detail-block" style={{ gridColumn: '1 / -1' }}>
            <div className="detail-block-label">Notes</div>
            <div className="detail-block-value" style={{ color: 'var(--text2)', lineHeight: 1.6 }}>{lead.notes}</div>
          </div>
        )}
      </div>

      {/* CALL HISTORY */}
      <div className="card">
        <div className="section-header">
          <div className="section-title" style={{ marginBottom: 0 }}>
            <Phone size={15} color="var(--accent)" /> Call History
            <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 400 }}>({callLogs.length})</span>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowCallModal(true)}><Plus size={13} /> Log</button>
        </div>
        {callLogs.length === 0 ? (
          <div className="empty-state" style={{ padding: '32px 0' }}>
            <p>No calls yet</p><span>Tap "Log" to record your first call</span>
          </div>
        ) : (
          <div className="call-timeline" style={{ marginTop: 14 }}>
            {callLogs.map(log => (
              <div key={log.id} className="call-entry">
                <div className="call-dot" style={{ background: OUTCOME_COLOR[log.outcome] }}>{OUTCOME_EMOJI[log.outcome] || '📞'}</div>
                <div className="call-content">
                  <div className="call-meta">
                    <OutcomeBadge outcome={log.outcome} />
                    <span className="call-date">{format(new Date(log.called_at), 'dd MMM, h:mm a')}</span>
                    {log.duration_minutes && <span style={{ fontSize: 11, color: 'var(--text3)' }}>⏱ {log.duration_minutes}m</span>}
                    {log.next_action && <span style={{ fontSize: 11, color: 'var(--accent)' }}>→ {log.next_action}</span>}
                    {log.next_follow_up_date && <span style={{ fontSize: 11, color: 'var(--yellow)' }}>📅 {format(parseISO(log.next_follow_up_date), 'dd MMM')}</span>}
                    <button onClick={() => deleteCallLog(log.id)} className="btn-icon" style={{ marginLeft: 'auto', padding: '3px 5px' }}><Trash2 size={11} /></button>
                  </div>
                  {log.notes && <div className="call-notes-text">{log.notes}</div>}
                  {log.transcript && (
                    <div>
                      <button style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, padding: 0 }}
                        onClick={() => setExpandedTranscript(p => ({ ...p, [log.id]: !p[log.id] }))}>
                        <Mic size={11} /> Transcript {expandedTranscript[log.id] ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                      </button>
                      {expandedTranscript[log.id] && <div className="call-transcript">{log.transcript}</div>}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
                    {OUTCOMES.map(o => <option key={o} value={o}>{o.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Duration (min)</label>
                  <input className="form-input" type="number" min="0" placeholder="5" value={callForm.duration_minutes} onChange={e => setCallForm(f => ({ ...f, duration_minutes: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Call Notes</label>
                <textarea className="form-input" placeholder="What was discussed? What did the doctor say? Any objections or interest shown?" value={callForm.notes} onChange={e => setCallForm(f => ({ ...f, notes: e.target.value }))} style={{ minHeight: 100 }} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">📅 Follow Up Date</label>
                  <input type="date" className="form-input" min={today} value={callForm.next_follow_up_date} onChange={e => setCallForm(f => ({ ...f, next_follow_up_date: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Next Action</label>
                  <select className="form-input" value={callForm.next_action} onChange={e => setCallForm(f => ({ ...f, next_action: e.target.value }))}>
                    <option value="">Select</option>
                    <option value="call">📞 Call</option>
                    <option value="whatsapp">💬 WhatsApp</option>
                    <option value="send_demo">🖥️ Send Demo</option>
                    <option value="meeting">🤝 Meeting</option>
                    <option value="close">✅ Close Deal</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Upload Recording (optional)</label>
                <div className="import-box" onClick={() => document.getElementById('audio-upload').click()}>
                  <input id="audio-upload" type="file" accept="audio/*" style={{ display: 'none' }} onChange={e => setAudioFile(e.target.files[0])} />
                  <Upload size={20} style={{ margin: '0 auto 8px', color: 'var(--text3)' }} />
                  {audioFile
                    ? <div style={{ color: 'var(--accent)', fontSize: 13 }}>✅ {audioFile.name}</div>
                    : <div style={{ color: 'var(--text3)', fontSize: 13 }}>Tap to upload recording<br /><span style={{ fontSize: 11 }}>Auto-transcribed by AI</span></div>}
                </div>
              </div>
              {transcribing && <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent)', fontSize: 13 }}><div className="spinner" /> Transcribing audio...</div>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowCallModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveCallLog} disabled={saving || transcribing}>
                {saving ? 'Saving...' : transcribing ? 'Transcribing...' : 'Save Call'}
              </button>
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
                <label className="form-label">📅 Date & Time</label>
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
                <input className="form-input" placeholder="e.g. Call after 3 PM" value={reminderForm.message} onChange={e => setReminderForm(f => ({ ...f, message: e.target.value }))} />
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
              <div style={{ display: 'flex', gap: 7, marginBottom: 16, flexWrap: 'wrap' }}>
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
