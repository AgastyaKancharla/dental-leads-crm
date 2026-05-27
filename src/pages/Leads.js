/* eslint-disable */
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { StatusBadge, PriorityBadge } from '../components/Badges'
import { Search, MessageCircle, X, Star, Users } from 'lucide-react'
import { format, parseISO } from 'date-fns'

const STATUSES = ['', 'new', 'called', 'interested', 'demo_sent', 'negotiating', 'closed', 'dead']
const PRIORITIES = ['', 'high', 'medium', 'low']
const AREAS = ['', 'Koramangala', 'Indiranagar', 'Whitefield', 'HSR Layout', 'JP Nagar', 'Jayanagar', 'BTM Layout', 'Electronic City', 'Marathahalli', 'Bannerghatta Road', 'Yelahanka', 'Hebbal', 'Rajajinagar', 'Malleshwaram', 'RT Nagar', 'Other']

const EMPTY_LEAD = { clinic_name: '', doctor_name: '', phone: '', area: '', rating: '', status: 'new', priority: 'medium', notes: '', next_follow_up_date: '', next_action: '' }

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

  useEffect(() => {
    fetchLeads()
    window.__openAddLead = () => { setForm(EMPTY_LEAD); setEditId(null); setShowModal(true) }
    return () => { delete window.__openAddLead }
  }, [])

  async function fetchLeads() {
    setLoading(true)
    const { data } = await supabase.from('leads').select('*').order('created_at', { ascending: false })
    setLeads(data || [])
    setLoading(false)
  }

  const filtered = leads.filter(l => {
    const q = search.toLowerCase()
    const matchSearch = !q || l.clinic_name?.toLowerCase().includes(q) || l.doctor_name?.toLowerCase().includes(q) || l.phone?.includes(q) || l.area?.toLowerCase().includes(q)
    const matchStatus = !statusFilter || l.status === statusFilter
    const matchPriority = !priorityFilter || l.priority === priorityFilter
    const matchArea = !areaFilter || l.area === areaFilter
    return matchSearch && matchStatus && matchPriority && matchArea
  })

  async function saveLead() {
    if (!form.clinic_name || !form.phone) {
      window.__toast && window.__toast('Clinic name and phone are required', 'error')
      return
    }
    setSaving(true)
    const payload = { ...form, rating: form.rating ? parseFloat(form.rating) : null, next_follow_up_date: form.next_follow_up_date || null, next_action: form.next_action || null }
    if (editId) {
      await supabase.from('leads').update(payload).eq('id', editId)
      window.__toast && window.__toast('Lead updated', 'success')
    } else {
      await supabase.from('leads').insert(payload)
      window.__toast && window.__toast('Lead added', 'success')
    }
    setSaving(false)
    setShowModal(false)
    fetchLeads()
  }

  async function deleteLead(id, e) {
    e.stopPropagation()
    if (!window.confirm('Delete this lead? All call history will also be deleted.')) return
    await supabase.from('leads').delete().eq('id', id)
    setLeads(prev => prev.filter(l => l.id !== id))
    window.__toast && window.__toast('Lead deleted', 'success')
  }

  function openEdit(lead, e) {
    e.stopPropagation()
    setForm({ ...lead, rating: lead.rating || '', next_follow_up_date: lead.next_follow_up_date || '', next_action: lead.next_action || '' })
    setEditId(lead.id)
    setShowModal(true)
  }

  return (
    <div>
      {/* FILTER BAR */}
      <div className="filter-bar">
        <div className="search-wrap">
          <Search />
          <input className="search-input" placeholder="Search clinic, doctor, phone..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {STATUSES.filter(Boolean).map(s => <option key={s} value={s}>{s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
        </select>
        <select className="filter-select" value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
          <option value="">All Priorities</option>
          {PRIORITIES.filter(Boolean).map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
        </select>
        <select className="filter-select" value={areaFilter} onChange={e => setAreaFilter(e.target.value)}>
          <option value="">All Areas</option>
          {AREAS.filter(Boolean).map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <span style={{ fontSize: 13, color: 'var(--text3)', marginLeft: 'auto', alignSelf: 'center' }}>{filtered.length} leads</span>
      </div>

      {/* TABLE */}
      {loading ? (
        <div className="loading"><div className="spinner" /> Loading leads...</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state"><Users size={48} /><p>No leads found</p><span>Add a lead or adjust your filters</span></div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Clinic</th>
                <th>Doctor</th>
                <th>Phone</th>
                <th>Area</th>
                <th>Rating</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Follow Up</th>
                <th>Next Action</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(lead => (
                <tr key={lead.id} onClick={() => navigate(`/leads/${lead.id}`)}>
                  <td style={{ fontWeight: 600 }}>{lead.clinic_name}</td>
                  <td style={{ color: 'var(--text2)' }}>{lead.doctor_name || '—'}</td>
                  <td>
                    <a className="phone-link" href={`tel:${lead.phone}`} onClick={e => e.stopPropagation()}>{lead.phone}</a>
                  </td>
                  <td style={{ color: 'var(--text2)' }}>{lead.area || '—'}</td>
                  <td>
                    {lead.rating ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Star size={12} fill="var(--yellow)" color="var(--yellow)" />
                        <span style={{ fontSize: 12 }}>{lead.rating}</span>
                      </span>
                    ) : '—'}
                  </td>
                  <td><StatusBadge status={lead.status} /></td>
                  <td><PriorityBadge priority={lead.priority} /></td>
                  <td style={{ fontSize: 12, color: lead.next_follow_up_date ? 'var(--yellow)' : 'var(--text3)' }}>
                    {lead.next_follow_up_date ? format(parseISO(lead.next_follow_up_date), 'dd MMM') : '—'}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text3)' }}>{lead.next_action || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                      <a href={`https://wa.me/91${lead.phone}`} target="_blank" rel="noreferrer" className="wa-btn btn-sm" style={{ padding: '5px 9px' }} title="WhatsApp">
                        <MessageCircle size={12} />
                      </a>
                      <button className="btn-icon" title="Edit" onClick={e => openEdit(lead, e)} style={{ padding: '5px 8px', fontSize: 12 }}>✏️</button>
                      <button className="btn-icon btn-danger" title="Delete" onClick={e => deleteLead(lead.id, e)} style={{ padding: '5px 8px', fontSize: 12 }}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ADD/EDIT MODAL */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editId ? 'Edit Lead' : 'Add New Lead'}</h2>
              <button className="btn-icon" onClick={() => setShowModal(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Clinic Name *</label>
                  <input className="form-input" placeholder="Apollo Dental" value={form.clinic_name} onChange={e => setForm(f => ({ ...f, clinic_name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Doctor Name</label>
                  <input className="form-input" placeholder="Dr. Sharma" value={form.doctor_name} onChange={e => setForm(f => ({ ...f, doctor_name: e.target.value }))} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Phone *</label>
                  <input className="form-input" placeholder="9876543210" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Area</label>
                  <select className="form-input" value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))}>
                    {AREAS.map(a => <option key={a} value={a}>{a || 'Select area'}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row-3">
                <div className="form-group">
                  <label className="form-label">Rating</label>
                  <input className="form-input" type="number" step="0.1" min="1" max="5" placeholder="4.2" value={form.rating} onChange={e => setForm(f => ({ ...f, rating: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    {STATUSES.filter(Boolean).map(s => <option key={s} value={s}>{s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Priority</label>
                  <select className="form-input" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                    {PRIORITIES.filter(Boolean).map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Next Follow Up Date</label>
                  <input type="date" className="form-input" value={form.next_follow_up_date} onChange={e => setForm(f => ({ ...f, next_follow_up_date: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Next Action</label>
                  <select className="form-input" value={form.next_action} onChange={e => setForm(f => ({ ...f, next_action: e.target.value }))}>
                    <option value="">Select action</option>
                    <option value="call">Call</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="send_demo">Send Demo</option>
                    <option value="meeting">Meeting</option>
                    <option value="close">Close</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-input" placeholder="Any important notes about this lead..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveLead} disabled={saving}>
                {saving ? 'Saving...' : editId ? 'Update Lead' : 'Add Lead'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
