/* eslint-disable */
import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Search, X, Phone, MapPin } from 'lucide-react'
import { StatusBadge } from './Badges'

export default function GlobalSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const ref = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    const handleKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(true)
        setTimeout(() => inputRef.current?.focus(), 50)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  useEffect(() => {
    if (!query || query.length < 2) { setResults([]); return }
    const timer = setTimeout(() => search(query), 200)
    return () => clearTimeout(timer)
  }, [query])

  async function search(q) {
    setLoading(true)
    const clean = q.replace(/[^0-9a-zA-Z\s]/g, '')
    const { data } = await supabase.from('leads').select('id, clinic_name, doctor_name, phone, area, status, priority')
      .or(`clinic_name.ilike.%${clean}%,doctor_name.ilike.%${clean}%,phone.ilike.%${clean}%,area.ilike.%${clean}%`)
      .limit(8)
    setResults(data || [])
    setLoading(false)
  }

  function go(id) {
    navigate(`/leads/${id}`)
    setOpen(false)
    setQuery('')
    setResults([])
  }

  if (!open) {
    return (
      <button onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50) }}
        style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 12px', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', color:'var(--text3)', fontSize:13, cursor:'pointer', transition:'all 0.15s', minWidth:160 }}
        title="Search (Ctrl+K)">
        <Search size={14} /> Search... <span style={{ marginLeft:'auto', fontSize:10, background:'var(--border)', padding:'1px 5px', borderRadius:4 }}>⌘K</span>
      </button>
    )
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(15,17,32,0.5)', backdropFilter:'blur(4px)', zIndex:500, display:'flex', alignItems:'flex-start', justifyContent:'center', paddingTop:80 }}
      onClick={() => { setOpen(false); setQuery(''); setResults([]) }}>
      <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', width:'100%', maxWidth:520, margin:'0 16px', boxShadow:'var(--shadow-lg)', overflow:'hidden' }}
        onClick={e => e.stopPropagation()}>
        {/* SEARCH INPUT */}
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'14px 16px', borderBottom:'1px solid var(--border)' }}>
          <Search size={16} color="var(--accent)" />
          <input ref={inputRef} autoFocus style={{ flex:1, border:'none', background:'none', fontSize:15, color:'var(--text)', outline:'none' }}
            placeholder="Search by clinic, doctor, phone, area..." value={query} onChange={e => setQuery(e.target.value)} />
          {loading && <div className="spinner" style={{ width:14, height:14, borderWidth:1.5 }} />}
          <button style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text3)' }} onClick={() => { setOpen(false); setQuery('') }}><X size={16} /></button>
        </div>

        {/* RESULTS */}
        {results.length > 0 && (
          <div style={{ maxHeight:380, overflowY:'auto' }}>
            {results.map((lead, i) => (
              <div key={lead.id} onClick={() => go(lead.id)}
                style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', cursor:'pointer', borderBottom:'1px solid var(--border)', transition:'background 0.1s' }}
                onMouseEnter={e => e.currentTarget.style.background='var(--bg3)'}
                onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                <div style={{ width:36, height:36, borderRadius:'50%', background:'var(--accent-glow)', border:'1px solid rgba(91,82,245,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>
                  🏥
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:600, fontSize:14 }}>{lead.clinic_name}</div>
                  <div style={{ fontSize:12, color:'var(--text3)', display:'flex', gap:8, marginTop:2, flexWrap:'wrap' }}>
                    {lead.doctor_name && <span>👨‍⚕️ {lead.doctor_name}</span>}
                    {lead.phone && <span style={{ display:'flex', alignItems:'center', gap:3 }}><Phone size={10} /> {lead.phone}</span>}
                    {lead.area && <span style={{ display:'flex', alignItems:'center', gap:3 }}><MapPin size={10} /> {lead.area}</span>}
                  </div>
                </div>
                <StatusBadge status={lead.status} />
              </div>
            ))}
          </div>
        )}

        {query.length >= 2 && results.length === 0 && !loading && (
          <div style={{ padding:'24px 16px', textAlign:'center', color:'var(--text3)', fontSize:13 }}>No leads found for "{query}"</div>
        )}

        {!query && (
          <div style={{ padding:'16px', color:'var(--text3)', fontSize:12 }}>
            <div style={{ marginBottom:8, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.4px' }}>Tips</div>
            <div>• Search by clinic name, doctor name, phone number or area</div>
            <div style={{ marginTop:4 }}>• Works with partial phone numbers too — try searching "9876"</div>
          </div>
        )}
      </div>
    </div>
  )
}
