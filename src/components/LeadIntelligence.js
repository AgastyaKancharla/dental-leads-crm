/* eslint-disable */
import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { generateLeadIntelligence } from '../lib/intelligence'
import { Zap, RefreshCw, Globe, Instagram, Phone, CheckCircle, XCircle, Clock, Copy, ExternalLink, TrendingUp } from 'lucide-react'

function PresenceDot({ has, label, url }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 0' }}>
      {has
        ? <CheckCircle size={14} color="var(--green)" />
        : <XCircle size={14} color="var(--red)" />}
      <span style={{ fontSize: 12, color: has ? 'var(--text)' : 'var(--text3)', fontWeight: has ? 500 : 400 }}>{label}</span>
      {url && has && (
        <a href={url} target="_blank" rel="noreferrer" style={{ marginLeft: 'auto' }}>
          <ExternalLink size={11} color="var(--accent)" />
        </a>
      )}
    </div>
  )
}

function ScoreBadge({ score }) {
  const color = score >= 80 ? 'var(--red)' : score >= 60 ? 'var(--yellow)' : 'var(--blue)'
  const bg = score >= 80 ? 'var(--red-bg)' : score >= 60 ? 'var(--yellow-bg)' : 'var(--blue-bg)'
  const label = score >= 80 ? '🔥 Hot' : score >= 60 ? '☀️ Warm' : '❄️ Cold'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 52, height: 52, borderRadius: '50%', border: `3px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, color }}>
        {score}
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color }}>{label} Lead</div>
        <div style={{ fontSize: 11, color: 'var(--text3)' }}>Opportunity score</div>
      </div>
    </div>
  )
}

export default function LeadIntelligence({ lead, compact = false }) {
  const [intel, setIntel] = useState(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => { if (lead?.id) fetchIntel() }, [lead?.id])

  async function fetchIntel() {
    setLoading(true)
    const { data } = await supabase.from('lead_intelligence').select('*').eq('lead_id', lead.id).single()
    setIntel(data)
    setLoading(false)

    // Auto-run if never done or pending
    if (!data || data.status === 'pending') {
      runIntelligence()
    }
  }

  async function runIntelligence() {
    setRunning(true)
    const result = await generateLeadIntelligence(lead)
    if (result) {
      const { data } = await supabase.from('lead_intelligence').select('*').eq('lead_id', lead.id).single()
      setIntel(data)
    }
    setRunning(false)
  }

  function copyLine(text) {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    window.__toast && window.__toast('Copied!', 'success')
  }

  // ── COMPACT VIEW (for Call Queue) ──
  if (compact) {
    if (loading || running || !intel || intel.status !== 'done') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: 'var(--bg3)', borderRadius: 'var(--radius-sm)', fontSize: 12, color: 'var(--text3)' }}>
          {loading || running ? <><div className="spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} /> Researching clinic...</> : <><Zap size={12} /> Tap to run AI research</>}
        </div>
      )
    }
    return (
      <div style={{ background: 'var(--accent-glow)', border: '1px solid rgba(91,82,245,0.15)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', marginTop: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700 }}>🤖 AI Brief</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>Score:</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: intel.opportunity_score >= 80 ? 'var(--red)' : intel.opportunity_score >= 60 ? 'var(--yellow)' : 'var(--blue)', fontFamily: 'var(--font-display)' }}>{intel.opportunity_score}</span>
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5, marginBottom: 8 }}>{intel.primary_pitch}</div>
        {intel.opening_line && (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', fontSize: 12, color: 'var(--text)', lineHeight: 1.5, fontStyle: 'italic' }}>
            📞 "{intel.opening_line}"
          </div>
        )}
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          {!intel.has_website && <span style={{ fontSize: 10, background: 'var(--red-bg)', color: 'var(--red)', padding: '2px 7px', borderRadius: 99, fontWeight: 600 }}>No Website</span>}
          {!intel.has_whatsapp_business && <span style={{ fontSize: 10, background: 'var(--orange-bg)', color: 'var(--orange)', padding: '2px 7px', borderRadius: 99, fontWeight: 600 }}>No WA Business</span>}
          {intel.has_practo && <span style={{ fontSize: 10, background: 'var(--green-bg)', color: 'var(--green)', padding: '2px 7px', borderRadius: 99, fontWeight: 600 }}>On Practo</span>}
          {intel.estimated_deal_value > 0 && <span style={{ fontSize: 10, background: 'var(--green-bg)', color: 'var(--green)', padding: '2px 7px', borderRadius: 99, fontWeight: 600 }}>₹{(intel.estimated_deal_value/1000).toFixed(0)}k potential</span>}
        </div>
      </div>
    )
  }

  // ── FULL VIEW (for Lead Detail tab) ──
  if (loading) return <div className="loading"><div className="spinner" /> Loading intelligence...</div>

  if (running || intel?.status === 'processing') {
    return (
      <div style={{ background: 'var(--accent-glow)', border: '1px solid rgba(91,82,245,0.2)', borderRadius: 'var(--radius)', padding: '32px 20px', textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto 16px', width: 32, height: 32, borderWidth: 3, borderTopColor: 'var(--accent)' }} />
        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--accent)', marginBottom: 8 }}>Researching {lead.clinic_name}...</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.8 }}>
          Searching web · Checking website · Social media · Practo · JustDial<br />
          Generating personalized pitch — takes ~20 seconds
        </div>
      </div>
    )
  }

  if (!intel || intel.status === 'failed' || intel.status === 'pending') {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px', background: 'var(--bg3)', border: '2px dashed var(--border)', borderRadius: 'var(--radius)' }}>
        <Zap size={36} color="var(--accent)" style={{ margin: '0 auto 12px', opacity: 0.5 }} />
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>
          {intel?.status === 'failed' ? 'Research failed — try again' : 'No intelligence yet'}
        </div>
        <div style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 20 }}>AI will research this clinic's online presence and generate a personalized pitch</div>
        <button className="btn btn-primary" onClick={runIntelligence} disabled={running}>
          <Zap size={14} /> Research This Lead
        </button>
      </div>
    )
  }

  const { data: parsed } = (() => {
    try { return { data: JSON.parse(intel.raw_ai_response?.match(/\{[\s\S]*\}/)?.[0] || '{}') } }
    catch { return { data: {} } }
  })()
  const summary = parsed.intelligence_summary || ''

  return (
    <div>
      {/* ── HEADER: SCORE + RE-RUN ── */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <ScoreBadge score={intel.opportunity_score || 0} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {intel.estimated_deal_value > 0 && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, color: 'var(--green)' }}>₹{(intel.estimated_deal_value/1000).toFixed(0)}k</div>
                <div style={{ fontSize: 10, color: 'var(--text3)' }}>est. deal value</div>
              </div>
            )}
            <button className="btn btn-ghost btn-sm" onClick={runIntelligence} disabled={running} title="Re-run research">
              <RefreshCw size={13} />
            </button>
          </div>
        </div>
        {summary && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', fontSize: 13, color: 'var(--text2)', lineHeight: 1.7 }}>
            {summary}
          </div>
        )}
      </div>

      {/* ── OPENING LINE — most important ── */}
      {intel.opening_line && (
        <div style={{ background: 'linear-gradient(135deg, var(--accent-glow), rgba(91,82,245,0.04))', border: '1px solid rgba(91,82,245,0.2)', borderRadius: 'var(--radius)', padding: '16px', marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>📞 Opening Line — Say This When They Pick Up</div>
          <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.7, fontStyle: 'italic', marginBottom: 10 }}>"{intel.opening_line}"</div>
          <button className="btn btn-sm" style={{ background: 'var(--accent)', color: 'white', fontSize: 12 }} onClick={() => copyLine(intel.opening_line)}>
            <Copy size={12} /> {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      )}

      {/* ── PITCH POINTS ── */}
      {intel.pitch_points?.length > 0 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp size={15} color="var(--green)" /> Pitch Points
          </div>
          {intel.pitch_points.map((p, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: i < intel.pitch_points.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: i === 0 ? 'var(--accent)' : 'var(--bg3)', color: i === 0 ? 'white' : 'var(--text3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
              <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, flex: 1 }}>{p}</div>
              <button className="btn-icon" style={{ padding: '3px 5px', flexShrink: 0 }} onClick={() => copyLine(p)}><Copy size={11} /></button>
            </div>
          ))}
        </div>
      )}

      {/* ── SERVICES TO SELL ── */}
      {intel.services_to_sell?.length > 0 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, marginBottom: 12 }}>💰 What to Sell</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[...intel.services_to_sell].sort((a, b) => (a.priority || 99) - (b.priority || 99)).map((s, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '10px 12px', background: i === 0 ? 'var(--green-bg)' : 'var(--bg3)', border: `1px solid ${i === 0 ? 'rgba(22,163,74,0.2)' : 'var(--border)'}`, borderRadius: 'var(--radius-sm)', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: i === 0 ? 'var(--green)' : 'var(--text)' }}>
                    {i === 0 && '⭐ '}{s.service}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{s.reason}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--green)', fontFamily: 'var(--font-display)' }}>₹{Number(s.value || 0).toLocaleString()}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)' }}>{s.billing}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ONLINE PRESENCE ── */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, marginBottom: 12 }}>🌐 Online Presence</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
          <PresenceDot has={intel.has_website} label="Website" url={intel.website_url} />
          <PresenceDot has={intel.has_whatsapp_business} label="WhatsApp Business" />
          <PresenceDot has={intel.has_instagram} label="Instagram" url={intel.instagram_url} />
          <PresenceDot has={intel.has_online_booking} label="Online Booking" />
          <PresenceDot has={intel.has_practo} label="Practo" />
          <PresenceDot has={intel.has_facebook} label="Facebook" />
          <PresenceDot has={intel.has_justdial} label="JustDial" />
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          {[
            { label: 'Type', value: intel.clinic_type?.replace(/_/g, ' ') },
            { label: 'Patient volume', value: intel.estimated_patient_volume },
            { label: 'Review activity', value: intel.review_velocity },
            { label: 'Local competitors', value: intel.competitor_count ? `~${intel.competitor_count}` : null },
          ].filter(i => i.value).map(item => (
            <div key={item.label} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '6px 10px' }}>
              <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{item.label}</div>
              <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'capitalize', marginTop: 2 }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', marginBottom: 8 }}>
        Last updated: {intel.updated_at ? new Date(intel.updated_at).toLocaleString('en-IN') : 'Unknown'} · Powered by Tavily + Claude
      </div>
    </div>
  )
}
