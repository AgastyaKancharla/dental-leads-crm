/* eslint-disable */
import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { MessageCircle, Plus, X, Copy, Check } from 'lucide-react'

const EMPTY = { title: '', stage: 'new', message: '' }

export default function WhatsAppTemplates() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(null)
  const [previewLead, setPreviewLead] = useState({ clinic: 'Apollo Dental', doctor: 'Dr. Sharma', demo: 'https://demo.agastyone.in/apollo' })

  useEffect(() => { fetchTemplates() }, [])

  async function fetchTemplates() {
    const { data } = await supabase.from('whatsapp_templates').select('*').order('created_at')
    setTemplates(data || [])
    setLoading(false)
  }

  function fillTemplate(msg) {
    return msg
      .replace(/\[Doctor Name\]/g, previewLead.doctor)
      .replace(/\[Clinic Name\]/g, previewLead.clinic)
      .replace(/\[Demo Link\]/g, previewLead.demo)
  }

  async function copyTemplate(msg, id) {
    const filled = fillTemplate(msg)
    await navigator.clipboard.writeText(filled).catch(() => {})
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
    window.__toast && window.__toast('Copied to clipboard!', 'success')
  }

  function openWhatsApp(phone, msg) {
    const filled = encodeURIComponent(fillTemplate(msg))
    window.open(`https://wa.me/91${phone}?text=${filled}`, '_blank')
  }

  async function saveTemplate() {
    if (!form.title || !form.message) { window.__toast && window.__toast('Title and message required', 'error'); return }
    setSaving(true)
    if (editId) {
      await supabase.from('whatsapp_templates').update(form).eq('id', editId)
      window.__toast && window.__toast('Template updated', 'success')
    } else {
      await supabase.from('whatsapp_templates').insert(form)
      window.__toast && window.__toast('Template added', 'success')
    }
    setSaving(false); setShowModal(false); fetchTemplates()
  }

  async function deleteTemplate(id) {
    if (!window.confirm('Delete this template?')) return
    await supabase.from('whatsapp_templates').delete().eq('id', id)
    setTemplates(prev => prev.filter(t => t.id !== id))
    window.__toast && window.__toast('Deleted', 'success')
  }

  const STAGE_LABELS = { new: '🆕 Cold Outreach', called: '📞 Follow Up', interested: '🔥 Warm Lead', demo_sent: '🖥️ Demo Follow Up', negotiating: '🤝 Closing', other: '💬 General' }

  if (loading) return <div className="loading"><div className="spinner" /> Loading templates...</div>

  return (
    <div>
      {/* PREVIEW SETTINGS */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 10 }}>Preview Personalization</div>
        <div className="form-row">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Clinic Name</label>
            <input className="form-input" value={previewLead.clinic} onChange={e => setPreviewLead(p => ({ ...p, clinic: e.target.value }))} placeholder="Apollo Dental" />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Doctor Name</label>
            <input className="form-input" value={previewLead.doctor} onChange={e => setPreviewLead(p => ({ ...p, doctor: e.target.value }))} placeholder="Dr. Sharma" />
          </div>
        </div>
        <div className="form-group" style={{ marginBottom: 0, marginTop: 10 }}>
          <label className="form-label">Demo Link</label>
          <input className="form-input" value={previewLead.demo} onChange={e => setPreviewLead(p => ({ ...p, demo: e.target.value }))} placeholder="https://..." />
        </div>
      </div>

      {/* ADD BUTTON */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button className="btn btn-primary" onClick={() => { setForm(EMPTY); setEditId(null); setShowModal(true) }}>
          <Plus size={14} /> New Template
        </button>
      </div>

      {/* TEMPLATES LIST */}
      {templates.length === 0 ? (
        <div className="empty-state"><MessageCircle size={40} style={{ margin: '0 auto 12px', opacity: 0.2 }} /><p>No templates yet</p><span>Add your first WhatsApp template</span></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {templates.map(t => (
            <div key={t.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{t.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{STAGE_LABELS[t.stage] || t.stage}</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn-icon" onClick={() => { setForm({ title: t.title, stage: t.stage, message: t.message }); setEditId(t.id); setShowModal(true) }}>✏️</button>
                  <button className="btn-icon" onClick={() => deleteTemplate(t.id)}>🗑️</button>
                </div>
              </div>

              {/* PREVIEW */}
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 'var(--radius-sm)', padding: '12px 14px', marginBottom: 12, fontSize: 13, lineHeight: 1.7, color: '#15803d', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {fillTemplate(t.message)}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => copyTemplate(t.message, t.id)}>
                  {copied === t.id ? <><Check size={13} color="var(--green)" /> Copied!</> : <><Copy size={13} /> Copy</>}
                </button>
                <a href={`https://wa.me/`} target="_blank" rel="noreferrer" className="wa-btn btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={e => { e.preventDefault(); const phone = prompt('Enter phone number (without +91):'); if (phone) openWhatsApp(phone, t.message) }}>
                  <MessageCircle size={13} /> Send via WA
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ADD/EDIT MODAL */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editId ? 'Edit Template' : 'New Template'}</h2>
              <button className="btn-icon" onClick={() => setShowModal(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Title</label>
                  <input className="form-input" placeholder="e.g. Initial Intro" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Stage</label>
                  <select className="form-input" value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value }))}>
                    <option value="new">Cold Outreach</option>
                    <option value="called">Follow Up</option>
                    <option value="interested">Warm Lead</option>
                    <option value="demo_sent">Demo Follow Up</option>
                    <option value="negotiating">Closing</option>
                    <option value="other">General</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Message</label>
                <textarea className="form-input" placeholder="Use [Doctor Name], [Clinic Name], [Demo Link] as placeholders..." value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} style={{ minHeight: 200 }} />
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Placeholders: [Doctor Name] [Clinic Name] [Demo Link]</div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveTemplate} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
