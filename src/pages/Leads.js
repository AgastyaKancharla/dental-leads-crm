/* eslint-disable */
import React, { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { StatusBadge, PriorityBadge } from '../components/Badges'
import { Search, MessageCircle, X, Star, Users, Plus, Phone, CheckSquare, Square, ChevronDown, Filter, AlertCircle } from 'lucide-react'
import { format, parseISO, differenceInDays } from 'date-fns'

const STATUSES = ['', 'new', 'called', 'interested', 'future_interested', 'demo_sent', 'quote_sent', 'negotiating', 'closed', 'dead', 'missed', 'not_reachable']
const PRIORITIES = ['', 'high', 'medium', 'low']
const AREAS = ['', 'Koramangala', 'Indiranagar', 'Whitefield', 'HSR Layout', 'JP Nagar', 'Jayanagar', 'BTM Layout', 'Electronic City', 'Marathahalli', 'Bannerghatta Road', 'Yelahanka', 'Hebbal', 'Rajajinagar', 'Malleshwaram', 'RT Nagar', 'Other']
const EMPTY_LEAD = { clinic_name:'', doctor_name:'', phone:'', area:'', rating:'', status:'new', priority:'medium', notes:'', next_follow_up_date:'', next_action:'', email:'', best_time_to_call:'', tags:'' }
const today = new Date().toISOString().split('T')[0]

export default function Leads() {
  const navigate = useNavigate()
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [areaFilter, setAreaFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_LEAD)
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState(null)
  // Bulk select
  const [selected, setSelected] = useState(new Set())
  const [showBulkBar, setShowBulkBar] = useState(false)
  const [bulkAction, setBulkAction] = useState('')
  const [bulkValue, setBulkValue] = useState('')
  const [bulkSaving, setBulkSaving] = useState(false)
  // Duplicate check
  const [dupWarning, setDupWarning] = useState(null)
  const [checkingDup, setCheckingDup] = useState(false)

  useEffect(() => {
    fetchLeads()
    window.__openAddLead = () => { setForm(EMPTY_LEAD); setEditId(null); setShowModal(true) }
    return () => { delete window.__openAddLead }
  }, [])

  useEffect(() => { setShowBulkBar(selected.size > 0) }, [selected])

  async function fetchLeads() {
    setLoading(true)
    const { data } = await supabase.from('leads').select('*').order('created_at', { ascending: false })
    setLeads(data || [])
    setLoading(false)
  }

  const filtered = leads.filter(l => {
    const q = search.toLowerCase()
    const matchSearch = !q || l.clinic_name?.toLowerCase().includes(q) || l.doctor_name?.toLowerCase().includes(q) || l.phone?.includes(q) || l.area?.toLowerCase().includes(q) || l.email?.toLowerCase().includes(q) || (l.tags || []).some(t => t.toLowerCase().includes(q))
    return matchSearch && (!statusFilter || l.status === statusFilter) && (!priorityFilter || l.priority === priorityFilter) && (!areaFilter || l.area === areaFilter)
  })

  // ── DUPLICATE CHECK ──
  async function checkDuplicate(phone) {
    if (!phone || phone.length < 8) return
    setCheckingDup(true)
    const clean = phone.replace(/[^0-9]/g, '').replace(/^91/, '').slice(-10)
    const { data } = await supabase.from('leads').select('id, clinic_name, status').filter('phone', 'ilike', `%${clean}%`)
    const dups = data?.filter(d => !editId || d.id !== editId) || []
    setDupWarning(dups.length > 0 ? dups : null)
    setCheckingDup(false)
  }

  // ── SAVE LEAD ──
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
      await supabase.from('leads').insert(payload)
      window.__toast && window.__toast('Lead added', 'success')
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

  function openEdit(lead, e) {
    e.stopPropagation()
    setForm({ ...lead, rating: lead.rating || '', next_follow_up_date: lead.next_follow_up_date || '', next_action: lead.next_action || '', tags: (lead.tags || []).join(', '), email: lead.email || '', best_time_to_call: lead.best_time_to_call || '' })
    setEditId(lead.id); setShowModal(true)
  }

  // ── BULK SELECT ──
  function toggleSelect(id, e) {
    e.stopPropagation()
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function selectAll() {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map(l => l.id)))
  }

  // ── BULK ACTIONS ──
  async function applyBulkAction() {
    if (!bulkAction) { window.__toast && window.__toast('Select an action', 'error'); return }
    if (!bulkValue && bulkAction !== 'delete') { window.__toast && window.__toast('Select a value', 'error'); return }
    if (bulkAction === 'delete' && !window.confirm(`Delete ${selected.size} leads? This cannot be undone.`)) return
    setBulkSaving(true)
    const ids = Array.from(selected)

    if (bulkAction === 'delete') {
      for (const id of ids) await supabase.from('leads').delete().eq('id', id)
      window.__toast && window.__toast(`${ids.length} leads deleted`, 'success')
    } else if (bulkAction === 'status') {
      await supabase.from('leads').update({ status: bulkValue }).in('id', ids)
      window.__toast && window.__toast(`${ids.length} leads → ${bulkValue}`, 'success')
    } else if (bulkAction === 'priority') {
      await supabase.from('leads').update({ priority: bulkValue }).in('id', ids)
      window.__toast && window.__toast(`${ids.length} leads priority → ${bulkValue}`, 'success')
    } else if (bulkAction === 'follow_up') {
      await supabase.from('leads').update({ next_follow_up_date: bulkValue }).in('id', ids)
      window.__toast && window.__toast(`${ids.length} leads follow-up set`, 'success')
    } else if (bulkAction === 'next_action') {
      await supabase.from('leads').update({ next_action: bulkValue }).in('id', ids)
      window.__toast && window.__toast(`${ids.length} leads next action → ${bulkValue}`, 'success')
    }

    setBulkSaving(false); setSelected(new Set()); setBulkAction(''); setBulkValue('')
    fetchLeads()
  }

  // Lead age indicator
  function getAgeColor(createdAt, status) {
    if (['closed', 'dead'].includes(status)) return null
    const days = differenceInDays(new Date(), new Date(createdAt))
    if (days > 30) return 'var(--red)'
    if (days > 14) return 'var(--yellow)'
    return null
  }

  const BULK_VALUE_OPTIONS = {
    status: STATUSES.filter(Boolean),
    priority: PRIORITIES.filter(Boolean),
    follow_up: null,
    next_action: ['call', 'whatsapp', 'send_demo', 'send_quote', 'meeting', 'close'],
    delete: null,
  }

  return (
    <div>
      {/* ── FILTER BAR ── */}
      <div className="filter-bar">
        <div className="search-wrap" style={{ flex:2, minWidth:200 }}>
          <Search />
          <input className="search-input" placeholder="Search clinic, phone, email, tag..." value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--text3)' }} onClick={() => setSearch('')}><X size={14} /></button>}
        </div>
        <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {STATUSES.filter(Boolean).map(s => <option key={s} value={s}>{s.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</option>)}
        </select>
        <select className="filter-select" value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
          <option value="">All Priority</option>
          {PRIORITIES.filter(Boolean).map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</option>)}
        </select>
        <select className="filter-select" value={areaFilter} onChange={e => setAreaFilter(e.target.value)}>
          <option value="">All Areas</option>
          {AREAS.filter(Boolean).map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <span style={{ fontSize:12, color:'var(--text3)', whiteSpace:'nowrap' }}>{filtered.length} leads</span>
      </div>

      {/* ── BULK ACTION BAR ── */}
      {showBulkBar && (
        <div style={{ background:'var(--accent)', borderRadius:'var(--radius-sm)', padding:'10px 14px', marginBottom:12, display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
          <span style={{ color:'white', fontWeight:700, fontSize:13 }}>{selected.size} selected</span>
          <select style={{ padding:'6px 10px', borderRadius:6, border:'none', fontSize:12, fontWeight:600 }} value={bulkAction} onChange={e => { setBulkAction(e.target.value); setBulkValue('') }}>
            <option value="">Choose action...</option>
            <option value="status">Change Status</option>
            <option value="priority">Change Priority</option>
            <option value="follow_up">Set Follow Up Date</option>
            <option value="next_action">Set Next Action</option>
            <option value="delete">🗑️ Delete All</option>
          </select>

          {bulkAction === 'status' && (
            <select style={{ padding:'6px 10px', borderRadius:6, border:'none', fontSize:12 }} value={bulkValue} onChange={e => setBulkValue(e.target.value)}>
              <option value="">Select status...</option>
              {STATUSES.filter(Boolean).map(s => <option key={s} value={s}>{s.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</option>)}
            </select>
          )}
          {bulkAction === 'priority' && (
            <select style={{ padding:'6px 10px', borderRadius:6, border:'none', fontSize:12 }} value={bulkValue} onChange={e => setBulkValue(e.target.value)}>
              <option value="">Select priority...</option>
              {PRIORITIES.filter(Boolean).map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</option>)}
            </select>
          )}
          {bulkAction === 'follow_up' && (
            <input type="date" style={{ padding:'6px 10px', borderRadius:6, border:'none', fontSize:12 }} min={today} value={bulkValue} onChange={e => setBulkValue(e.target.value)} />
          )}
          {bulkAction === 'next_action' && (
            <select style={{ padding:'6px 10px', borderRadius:6, border:'none', fontSize:12 }} value={bulkValue} onChange={e => setBulkValue(e.target.value)}>
              <option value="">Select action...</option>
              {['call','whatsapp','send_demo','send_quote','meeting','close'].map(a => <option key={a} value={a}>{a.replace(/_/g,' ')}</option>)}
            </select>
          )}

          <button className="btn btn-sm" style={{ background:'white', color:'var(--accent)', fontWeight:700 }} onClick={applyBulkAction} disabled={bulkSaving}>
            {bulkSaving ? 'Applying...' : 'Apply'}
          </button>
          <button className="btn btn-sm" style={{ background:'rgba(255,255,255,0.2)', color:'white' }} onClick={() => { setSelected(new Set()); setBulkAction(''); setBulkValue('') }}>Cancel</button>
        </div>
      )}

      {/* ── TABLE ── */}
      {loading ? (
        <div className="loading"><div className="spinner" /> Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state"><Users size={40} style={{ margin:'0 auto 12px', opacity:0.2 }} /><p>No leads found</p><span>Add a lead or adjust filters</span></div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width:36 }}>
                  <button style={{ background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center' }} onClick={selectAll}>
                    {selected.size === filtered.length && filtered.length > 0 ? <CheckSquare size={15} color="var(--accent)" /> : <Square size={15} color="var(--text3)" />}
                  </button>
                </th>
                <th>Clinic</th>
                <th>Phone</th>
                <th>Area</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Follow Up</th>
                <th>Last Call</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(lead => {
                const ageColor = getAgeColor(lead.created_at, lead.status)
                const isSelected = selected.has(lead.id)
                const daysSinceCall = lead.last_called_at ? differenceInDays(new Date(), new Date(lead.last_called_at)) : null
                return (
                  <tr key={lead.id} onClick={() => navigate(`/leads/${lead.id}`)} style={{ background: isSelected ? 'rgba(91,82,245,0.04)' : undefined }}>
                    <td onClick={e => e.stopPropagation()}>
                      <button style={{ background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center' }} onClick={e => toggleSelect(lead.id, e)}>
                        {isSelected ? <CheckSquare size={15} color="var(--accent)" /> : <Square size={15} color="var(--text3)" />}
                      </button>
                    </td>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        {ageColor && <div style={{ width:6, height:6, borderRadius:'50%', background:ageColor, flexShrink:0 }} title="Stale lead" />}
                        <div>
                          <div style={{ fontWeight:600 }}>{lead.clinic_name}</div>
                          {lead.doctor_name && <div style={{ fontSize:11, color:'var(--text3)' }}>{lead.doctor_name}</div>}
                          {lead.tags?.length > 0 && (
                            <div style={{ display:'flex', gap:4, marginTop:3, flexWrap:'wrap' }}>
                              {lead.tags.slice(0,2).map(t => <span key={t} style={{ fontSize:10, background:'var(--accent-glow)', color:'var(--accent)', padding:'1px 6px', borderRadius:99, fontWeight:600 }}>{t}</span>)}
                              {lead.tags.length > 2 && <span style={{ fontSize:10, color:'var(--text3)' }}>+{lead.tags.length-2}</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <a className="phone-link" href={`tel:${lead.phone}`} onClick={e => e.stopPropagation()}>{lead.phone}</a>
                      {lead.best_time_to_call && <div style={{ fontSize:10, color:'var(--text3)' }}>🕐 {lead.best_time_to_call}</div>}
                    </td>
                    <td style={{ color:'var(--text2)', fontSize:12 }}>{lead.area||'—'}</td>
                    <td><StatusBadge status={lead.status} /></td>
                    <td><PriorityBadge priority={lead.priority} /></td>
                    <td style={{ fontSize:12, color: lead.next_follow_up_date ? 'var(--yellow)' : 'var(--text3)', fontWeight: lead.next_follow_up_date ? 600 : 400 }}>
                      {lead.next_follow_up_date ? format(parseISO(lead.next_follow_up_date), 'dd MMM') : '—'}
                    </td>
                    <td style={{ fontSize:11, color:'var(--text3)' }}>
                      {daysSinceCall !== null ? (
                        <span style={{ color: daysSinceCall > 14 ? 'var(--red)' : daysSinceCall > 7 ? 'var(--yellow)' : 'var(--text3)' }}>
                          {daysSinceCall === 0 ? 'Today' : `${daysSinceCall}d ago`}
                        </span>
                      ) : '—'}
                      {lead.call_count > 0 && <div style={{ fontSize:10 }}>{lead.call_count} calls</div>}
                    </td>
                    <td>
                      <div style={{ display:'flex', gap:5 }} onClick={e => e.stopPropagation()}>
                        <a href={`https://wa.me/91${lead.phone}`} target="_blank" rel="noreferrer" className="wa-btn" style={{ padding:'5px 8px' }}><MessageCircle size={12} /></a>
                        <button className="btn-icon" onClick={e => openEdit(lead, e)} style={{ padding:'5px 7px' }}>✏️</button>
                        <button className="btn-icon" onClick={e => deleteLead(lead.id, e)} style={{ padding:'5px 7px' }}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── ADD/EDIT MODAL ── */}
      {showModal && (
        <div className="modal-overlay" onClick={() => { setShowModal(false); setDupWarning(null) }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editId ? '✏️ Edit Lead' : '➕ Add New Lead'}</h2>
              <button className="btn-icon" onClick={() => { setShowModal(false); setDupWarning(null) }}><X size={16} /></button>
            </div>
            <div className="modal-body">
              {/* DUPLICATE WARNING */}
              {dupWarning && (
                <div style={{ background:'var(--yellow-bg)', border:'1px solid rgba(217,119,6,0.3)', borderRadius:'var(--radius-sm)', padding:'10px 14px', marginBottom:14 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'var(--yellow)', marginBottom:6, display:'flex', alignItems:'center', gap:6 }}><AlertCircle size={14} /> Possible Duplicate Detected</div>
                  {dupWarning.map(d => (
                    <div key={d.id} style={{ fontSize:12, color:'var(--text2)' }}>• {d.clinic_name} — {d.status}</div>
                  ))}
                  <div style={{ fontSize:11, color:'var(--text3)', marginTop:4 }}>You can still save if it's a different branch.</div>
                </div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Clinic Name *</label>
                  <input className="form-input" placeholder="Apollo Dental" value={form.clinic_name} onChange={e => setForm(f => ({ ...f, clinic_name:e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Doctor Name</label>
                  <input className="form-input" placeholder="Dr. Sharma" value={form.doctor_name} onChange={e => setForm(f => ({ ...f, doctor_name:e.target.value }))} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Phone *</label>
                  <input className="form-input" placeholder="9876543210" type="tel" value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone:e.target.value }))}
                    onBlur={e => checkDuplicate(e.target.value)} />
                  {checkingDup && <span style={{ fontSize:11, color:'var(--text3)' }}>Checking for duplicates...</span>}
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input" placeholder="clinic@gmail.com" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email:e.target.value }))} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Area</label>
                  <select className="form-input" value={form.area} onChange={e => setForm(f => ({ ...f, area:e.target.value }))}>
                    {AREAS.map(a => <option key={a} value={a}>{a||'Select area'}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Best Time to Call</label>
                  <input className="form-input" placeholder="e.g. After 5 PM" value={form.best_time_to_call} onChange={e => setForm(f => ({ ...f, best_time_to_call:e.target.value }))} />
                </div>
              </div>
              <div className="form-row-3">
                <div className="form-group">
                  <label className="form-label">Rating</label>
                  <input className="form-input" type="number" step="0.1" min="1" max="5" placeholder="4.2" value={form.rating} onChange={e => setForm(f => ({ ...f, rating:e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-input" value={form.status} onChange={e => setForm(f => ({ ...f, status:e.target.value }))}>
                    {STATUSES.filter(Boolean).map(s => <option key={s} value={s}>{s.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Priority</label>
                  <select className="form-input" value={form.priority} onChange={e => setForm(f => ({ ...f, priority:e.target.value }))}>
                    {PRIORITIES.filter(Boolean).map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">📅 Follow Up Date</label>
                  <input type="date" className="form-input" min={today} value={form.next_follow_up_date} onChange={e => setForm(f => ({ ...f, next_follow_up_date:e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Next Action</label>
                  <select className="form-input" value={form.next_action} onChange={e => setForm(f => ({ ...f, next_action:e.target.value }))}>
                    <option value="">Select</option>
                    <option value="call">📞 Call</option>
                    <option value="whatsapp">💬 WhatsApp</option>
                    <option value="send_demo">🖥️ Send Demo</option>
                    <option value="send_quote">💰 Send Quote</option>
                    <option value="meeting">🤝 Meeting</option>
                    <option value="close">✅ Close</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Tags <span style={{ fontWeight:400, color:'var(--text3)' }}>(comma separated)</span></label>
                <input className="form-input" placeholder="e.g. Google Ads, Budget issue, Referred" value={form.tags} onChange={e => setForm(f => ({ ...f, tags:e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-input" placeholder="Any important notes..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes:e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => { setShowModal(false); setDupWarning(null) }}>Cancel</button>
              <button className="btn btn-primary" onClick={saveLead} disabled={saving}>{saving?'Saving...':editId?'Update':'Add Lead'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
