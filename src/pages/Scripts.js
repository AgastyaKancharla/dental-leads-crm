import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { FileText, Plus, X, Trash2, Edit } from 'lucide-react'

const EMPTY_SCRIPT = { title: '', stage: 'new', content: '', is_active: true }

export default function Scripts() {
  const [scripts, setScripts] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_SCRIPT)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchScripts() }, [])

  async function fetchScripts() {
    setLoading(true)
    const { data } = await supabase.from('call_scripts').select('*').order('created_at')
    setScripts(data || [])
    if (data?.length > 0 && !selected) setSelected(data[0])
    setLoading(false)
  }

  async function saveScript() {
    if (!form.title || !form.content) { window.__toast && window.__toast('Title and content required', 'error'); return }
    setSaving(true)
    if (editId) {
      await supabase.from('call_scripts').update(form).eq('id', editId)
      window.__toast && window.__toast('Script updated', 'success')
    } else {
      await supabase.from('call_scripts').insert(form)
      window.__toast && window.__toast('Script added', 'success')
    }
    setSaving(false)
    setShowModal(false)
    fetchScripts()
  }

  async function deleteScript(id) {
    if (!window.confirm('Delete this script?')) return
    await supabase.from('call_scripts').delete().eq('id', id)
    setScripts(prev => prev.filter(s => s.id !== id))
    if (selected?.id === id) setSelected(null)
    window.__toast && window.__toast('Script deleted', 'success')
  }

  const STAGE_LABELS = { new: 'Cold Call', called: 'Follow Up', interested: 'Warm Lead', demo_sent: 'Demo Follow Up', negotiating: 'Closing', other: 'General' }

  if (loading) return <div className="loading"><div className="spinner" /> Loading scripts...</div>

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, height: 'calc(100vh - 120px)' }}>
      {/* LEFT - Script List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>Scripts ({scripts.length})</div>
          <button className="btn btn-primary btn-sm" onClick={() => { setForm(EMPTY_SCRIPT); setEditId(null); setShowModal(true) }}>
            <Plus size={13} /> Add
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto' }}>
          {scripts.map(s => (
            <div key={s.id}
              onClick={() => setSelected(s)}
              style={{ padding: '12px 14px', background: selected?.id === s.id ? 'var(--accent-glow)' : 'var(--bg2)', border: `1px solid ${selected?.id === s.id ? 'rgba(108,99,255,0.3)' : 'var(--border)'}`, borderRadius: 'var(--radius-sm)', cursor: 'pointer', transition: 'all 0.15s' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: selected?.id === s.id ? 'var(--accent2)' : 'var(--text)', marginBottom: 3 }}>{s.title}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>{STAGE_LABELS[s.stage] || s.stage}</div>
            </div>
          ))}
          {scripts.length === 0 && (
            <div style={{ color: 'var(--text3)', fontSize: 13, textAlign: 'center', padding: '30px 0' }}>No scripts yet</div>
          )}
        </div>
      </div>

      {/* RIGHT - Script Content */}
      <div style={{ overflowY: 'auto' }}>
        {selected ? (
          <div className="card" style={{ height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{selected.title}</h2>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>Stage: {STAGE_LABELS[selected.stage] || selected.stage}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => { setForm({ title: selected.title, stage: selected.stage, content: selected.content, is_active: selected.is_active }); setEditId(selected.id); setShowModal(true) }}>
                  <Edit size={13} /> Edit
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => deleteScript(selected.id)}>
                  <Trash2 size={13} /> Delete
                </button>
              </div>
            </div>
            <hr className="divider" />
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12, fontStyle: 'italic' }}>
              💡 Use this script while on a call. Personalise the [bracketed] parts as you go.
            </div>
            <div className="script-box">{selected.content}</div>
          </div>
        ) : (
          <div className="empty-state" style={{ paddingTop: 80 }}>
            <FileText size={48} />
            <p>Select a script to view</p>
            <span>Or add a new one</span>
          </div>
        )}
      </div>

      {/* ADD/EDIT MODAL */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editId ? 'Edit Script' : 'New Script'}</h2>
              <button className="btn-icon" onClick={() => setShowModal(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Title</label>
                  <input className="form-input" placeholder="e.g. Initial Cold Call" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Stage</label>
                  <select className="form-input" value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value }))}>
                    <option value="new">Cold Call</option>
                    <option value="called">Follow Up</option>
                    <option value="interested">Warm Lead</option>
                    <option value="demo_sent">Demo Follow Up</option>
                    <option value="negotiating">Closing</option>
                    <option value="other">General</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Script Content</label>
                <textarea className="form-input" placeholder="Write your call script here. Use [Doctor Name], [Clinic Name] as placeholders..." value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} style={{ minHeight: 300, fontFamily: 'inherit' }} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveScript} disabled={saving}>{saving ? 'Saving...' : 'Save Script'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
