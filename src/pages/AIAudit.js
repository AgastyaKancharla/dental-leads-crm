/* eslint-disable */
import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Zap, RefreshCw, TrendingUp, AlertCircle, CheckCircle, Globe, Search, DollarSign, MessageCircle, Star, Clock, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import { format } from 'date-fns'

// ── SCORE RING ──
function ScoreRing({ score, size = 80, label, color }) {
  const r = (size / 2) - 6
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border)" strokeWidth={6} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={6}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" style={{ transition: 'stroke-dasharray 1s ease' }} />
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
          style={{ transform: 'rotate(90deg)', transformOrigin: 'center', fill: 'var(--text)', fontSize: size * 0.22, fontWeight: 800, fontFamily: 'var(--font-display)' }}>
          {score}
        </text>
      </svg>
      <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</div>
    </div>
  )
}

// ── TEMPERATURE BADGE ──
function TempBadge({ temp }) {
  const cfg = {
    Hot:  { bg: '#fef2f2', color: '#dc2626', border: '#fecaca', emoji: '🔥' },
    Warm: { bg: '#fffbeb', color: '#d97706', border: '#fde68a', emoji: '☀️' },
    Cold: { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe', emoji: '❄️' },
  }[temp] || { bg: 'var(--bg3)', color: 'var(--text3)', border: 'var(--border)', emoji: '❓' }
  return (
    <span style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, padding: '4px 12px', borderRadius: 99, fontSize: 13, fontWeight: 700 }}>
      {cfg.emoji} {temp} Lead
    </span>
  )
}

// ── ISSUE ITEM ──
function IssueItem({ issue, type }) {
  const isGood = type === 'good'
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ width: 20, height: 20, borderRadius: '50%', background: isGood ? 'var(--green-bg)' : 'var(--red-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
        {isGood ? <CheckCircle size={12} color="var(--green)" /> : <AlertCircle size={12} color="var(--red)" />}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{issue.title}</div>
        {issue.detail && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2, lineHeight: 1.5 }}>{issue.detail}</div>}
      </div>
      {issue.impact && <span style={{ fontSize: 10, fontWeight: 700, color: isGood ? 'var(--green)' : 'var(--red)', background: isGood ? 'var(--green-bg)' : 'var(--red-bg)', padding: '2px 7px', borderRadius: 99, flexShrink: 0 }}>{issue.impact}</span>}
    </div>
  )
}

// ── OPPORTUNITY CARD ──
function OpportunityCard({ opp }) {
  const COLORS = {
    'Website': { color: 'var(--accent)', bg: 'var(--accent-glow)' },
    'SEO': { color: '#16a34a', bg: 'var(--green-bg)' },
    'WhatsApp': { color: '#16a34a', bg: '#f0fdf4' },
    'CRM': { color: 'var(--purple)', bg: 'var(--purple-bg)' },
    'Reputation': { color: 'var(--yellow)', bg: 'var(--yellow-bg)' },
    'Marketing': { color: 'var(--orange)', bg: 'var(--orange-bg)' },
  }
  const match = Object.entries(COLORS).find(([k]) => opp.service?.includes(k))
  const { color, bg } = match?.[1] || { color: 'var(--accent)', bg: 'var(--accent-glow)' }
  return (
    <div style={{ background: bg, border: `1px solid ${color}20`, borderRadius: 'var(--radius-sm)', padding: '12px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color, marginBottom: 4 }}>{opp.service}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>{opp.reason}</div>
        </div>
        {opp.value && (
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color, fontFamily: 'var(--font-display)' }}>₹{Number(opp.value).toLocaleString()}</div>
            <div style={{ fontSize: 10, color: 'var(--text3)' }}>{opp.billing || 'one-time'}</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AIAudit({ lead }) {
  const [audits, setAudits] = useState([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [latest, setLatest] = useState(null)
  const [websiteUrl, setWebsiteUrl] = useState(lead?.website_url || '')
  const [showHistory, setShowHistory] = useState(false)
  const [expandSection, setExpandSection] = useState({ website: true, seo: true, opps: true, pitch: true })

  useEffect(() => { fetchAudits() }, [lead?.id])

  async function fetchAudits() {
    setLoading(true)
    const { data } = await supabase.from('ai_audits').select('*').eq('lead_id', lead.id).order('created_at', { ascending: false })
    setAudits(data || [])
    setLatest(data?.[0] || null)
    setLoading(false)
  }

  async function runAudit() {
    if (!lead) return
    setRunning(true)

    const prompt = `You are an expert digital marketing auditor for a company called AgastyaOne that sells websites, SEO, CRM, WhatsApp automation and marketing services to dental clinics in Bengaluru, India.

Analyze this dental clinic lead and generate a comprehensive audit report:

CLINIC DATA:
- Clinic Name: ${lead.clinic_name}
- Doctor: ${lead.doctor_name || 'Unknown'}
- Area: ${lead.area || 'Bengaluru'}
- Google Rating: ${lead.rating || 'Unknown'} stars
- Website URL: ${websiteUrl || lead.website_url || 'None - no website found'}
- Current Status: ${lead.status}
- Notes: ${lead.notes || 'None'}
- Call Count: ${lead.call_count || 0}
- Existing Services: ${lead.website_url ? 'Has website' : 'No website'}

PRICING CONTEXT (AgastyaOne services):
- Website Design: ₹15,000 - ₹35,000 one-time
- Local SEO: ₹8,000 - ₹15,000/month
- WhatsApp Automation: ₹3,000 - ₹5,000/month
- CRM Setup: ₹5,000 - ₹10,000/month
- Reputation Management: ₹5,000 - ₹8,000/month
- Google Ads Management: ₹8,000 - ₹15,000/month

Respond ONLY with a valid JSON object in this exact format:
{
  "website_score": <0-100 integer, 0 if no website>,
  "lead_score": <0-100 integer based on business potential>,
  "lead_temperature": "<Hot|Warm|Cold>",
  "website_issues": [
    {"title": "<issue>", "detail": "<explanation>", "impact": "<High|Medium|Low>", "type": "bad"},
    {"title": "<good thing>", "detail": "<explanation>", "impact": "Good", "type": "good"}
  ],
  "seo_issues": [
    {"title": "<seo issue>", "detail": "<explanation>", "impact": "<High|Medium|Low>", "type": "bad"}
  ],
  "opportunities": [
    {"service": "<service name>", "reason": "<why they need it>", "value": <number>, "billing": "<one-time|per month>", "priority": "<High|Medium|Low>"}
  ],
  "estimated_value": {
    "website": <number or 0>,
    "seo": <number or 0>,
    "whatsapp": <number or 0>,
    "crm": <number or 0>,
    "reputation": <number or 0>,
    "ads": <number or 0>
  },
  "total_estimated_value": <sum of monthly services * 12 + one-time>,
  "pitch_points": [
    "<personalized talking point 1 for sales call>",
    "<personalized talking point 2>",
    "<personalized talking point 3>"
  ],
  "summary": "<2 sentence summary of this lead's potential>"
}

Be specific to dental clinics in Bengaluru. If no website, assume score 0 and focus on website opportunity. Make pitch points conversational and specific to this clinic's situation.`

    try {
      const ANTHROPIC_KEY = process.env.REACT_APP_ANTHROPIC_KEY || ''
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          messages: [{ role: 'user', content: prompt }]
        })
      })
      const data = await resp.json()
      const text = data.content?.[0]?.text || ''
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON in response')
      const audit = JSON.parse(jsonMatch[0])

      // Save to DB
      const { data: saved } = await supabase.from('ai_audits').insert({
        lead_id: lead.id,
        website_url: websiteUrl || lead.website_url || null,
        website_score: audit.website_score,
        lead_score: audit.lead_score,
        lead_temperature: audit.lead_temperature,
        website_issues: audit.website_issues,
        seo_issues: audit.seo_issues,
        opportunities: audit.opportunities,
        estimated_value: audit.estimated_value,
        total_estimated_value: audit.total_estimated_value,
        pitch_points: audit.pitch_points,
        raw_response: text,
      }).select().single()

      // Update lead with website_url and last audit info
      await supabase.from('leads').update({
        website_url: websiteUrl || lead.website_url || null,
        last_audit_score: audit.lead_score,
        last_audit_at: new Date().toISOString(),
      }).eq('id', lead.id)

      setLatest(saved)
      setAudits(prev => [saved, ...prev])
      window.__toast && window.__toast('AI Audit complete!', 'success')
    } catch (err) {
      console.error(err)
      window.__toast && window.__toast('Audit failed — try again', 'error')
    }
    setRunning(false)
  }

  const toggle = (section) => setExpandSection(p => ({ ...p, [section]: !p[section] }))

  const Section = ({ id, title, icon, children, count }) => (
    <div className="card" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => toggle(id)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700 }}>
          {icon} {title}
          {count !== undefined && <span style={{ fontSize: 11, background: 'var(--bg3)', color: 'var(--text3)', padding: '1px 7px', borderRadius: 99, fontWeight: 600 }}>{count}</span>}
        </div>
        {expandSection[id] ? <ChevronUp size={16} color="var(--text3)" /> : <ChevronDown size={16} color="var(--text3)" />}
      </div>
      {expandSection[id] && <div style={{ marginTop: 14 }}>{children}</div>}
    </div>
  )

  if (loading) return <div className="loading"><div className="spinner" /> Loading audits...</div>

  const websiteIssues = latest?.website_issues || []
  const seoIssues = latest?.seo_issues || []
  const opportunities = latest?.opportunities || []
  const pitchPoints = latest?.pitch_points || []
  const estimatedValue = latest?.estimated_value || {}
  const totalValue = latest?.total_estimated_value || 0

  const websiteColor = (s) => s >= 70 ? 'var(--green)' : s >= 40 ? 'var(--yellow)' : 'var(--red)'
  const leadColor = (s) => s >= 90 ? '#dc2626' : s >= 70 ? 'var(--yellow)' : 'var(--blue)'

  return (
    <div>
      {/* ── RUN AUDIT CARD ── */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Zap size={16} color="var(--accent)" /> AI Audit — {lead.clinic_name}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>
              Analyses website quality, SEO, business opportunities and generates a personalized sales pitch using AI.
            </div>
          </div>
          {latest && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
              <TempBadge temp={latest.lead_temperature} />
            </div>
          )}
        </div>

        {/* WEBSITE URL INPUT */}
        <div style={{ marginTop: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: 6 }}>Website URL (optional)</label>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Globe size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
              <input className="form-input" style={{ paddingLeft: 32 }} placeholder="https://clinicname.com" value={websiteUrl}
                onChange={e => setWebsiteUrl(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={runAudit} disabled={running} style={{ whiteSpace: 'nowrap', minWidth: 120 }}>
              {running ? <><div className="spinner" style={{ borderTopColor: 'white', width: 14, height: 14 }} /> Analysing...</> : <><Zap size={14} /> Run Audit</>}
            </button>
          </div>
        </div>

        {latest && (
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>
            Last run: {format(new Date(latest.created_at), 'dd MMM yyyy, h:mm a')} · {audits.length} audit{audits.length !== 1 ? 's' : ''} total
            {audits.length > 1 && <button style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 11, marginLeft: 8 }} onClick={() => setShowHistory(h => !h)}>{showHistory ? 'Hide history' : 'View history'}</button>}
          </div>
        )}
      </div>

      {/* ── NO AUDIT YET ── */}
      {!latest && !running && (
        <div style={{ textAlign: 'center', padding: '48px 20px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', borderStyle: 'dashed' }}>
          <Zap size={40} color="var(--accent)" style={{ margin: '0 auto 14px', opacity: 0.5 }} />
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, marginBottom: 8 }}>No audit yet</div>
          <div style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
            Run an AI audit to get website score, SEO analysis,<br />business opportunities and a personalized sales pitch.
          </div>
          <button className="btn btn-primary" onClick={runAudit} disabled={running}>
            <Zap size={14} /> Run First Audit
          </button>
        </div>
      )}

      {/* ── RUNNING STATE ── */}
      {running && (
        <div style={{ background: 'var(--accent-glow)', border: '1px solid rgba(91,82,245,0.2)', borderRadius: 'var(--radius)', padding: '24px', textAlign: 'center', marginBottom: 12 }}>
          <div className="spinner" style={{ margin: '0 auto 14px', width: 28, height: 28, borderWidth: 3, borderTopColor: 'var(--accent)' }} />
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--accent)', marginBottom: 6 }}>AI is analysing {lead.clinic_name}...</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.7 }}>
            Checking website quality · SEO health · Business opportunities<br />Generating personalized pitch points
          </div>
        </div>
      )}

      {/* ── AUDIT RESULTS ── */}
      {latest && !running && (
        <>
          {/* SCORES ROW */}
          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', flexWrap: 'wrap', gap: 16, padding: '8px 0' }}>
              <ScoreRing score={latest.website_score} label="Website Score" color={websiteColor(latest.website_score)} size={90} />
              <ScoreRing score={latest.lead_score} label="Lead Score" color={leadColor(latest.lead_score)} size={90} />
              <div style={{ textAlign: 'center' }}>
                <TempBadge temp={latest.lead_temperature} />
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>Lead Temperature</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, color: 'var(--green)' }}>₹{totalValue > 0 ? (totalValue/1000).toFixed(0)+'k' : '—'}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Est. Total Value</div>
              </div>
            </div>
          </div>

          {/* SUMMARY */}
          {latest.raw_response && (() => {
            try {
              const parsed = JSON.parse(latest.raw_response.match(/\{[\s\S]*\}/)?.[0] || '{}')
              return parsed.summary ? (
                <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '14px 16px', marginBottom: 12, fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, fontStyle: 'italic' }}>
                  💡 {parsed.summary}
                </div>
              ) : null
            } catch { return null }
          })()}

          {/* PITCH POINTS — most important for sales */}
          {pitchPoints.length > 0 && (
            <Section id="pitch" title="Sales Pitch Points" icon={<MessageCircle size={15} color="var(--accent)" />} count={pitchPoints.length}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {pitchPoints.map((point, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: i === 0 ? 'var(--accent-glow)' : 'var(--bg3)', border: `1px solid ${i === 0 ? 'rgba(91,82,245,0.2)' : 'var(--border)'}`, borderRadius: 'var(--radius-sm)', padding: '12px 14px' }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: i === 0 ? 'var(--accent)' : 'var(--border)', color: i === 0 ? 'white' : 'var(--text3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                    <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, flex: 1 }}>"{point}"</div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* OPPORTUNITIES */}
          {opportunities.length > 0 && (
            <Section id="opps" title="Business Opportunities" icon={<TrendingUp size={15} color="var(--green)" />} count={opportunities.length}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {opportunities.sort((a, b) => (a.priority === 'High' ? -1 : 1)).map((opp, i) => <OpportunityCard key={i} opp={opp} />)}
              </div>

              {/* VALUE BREAKDOWN */}
              {Object.values(estimatedValue).some(v => v > 0) && (
                <div style={{ marginTop: 14, padding: '14px', background: 'var(--bg3)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 10 }}>Estimated Deal Value Breakdown</div>
                  {Object.entries(estimatedValue).filter(([, v]) => v > 0).map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ textTransform: 'capitalize', color: 'var(--text2)' }}>{k.replace(/_/g, ' ')}</span>
                      <span style={{ fontWeight: 700, color: 'var(--green)' }}>₹{Number(v).toLocaleString()}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginTop: 8, paddingTop: 8 }}>
                    <span style={{ fontWeight: 700 }}>Total Potential</span>
                    <span style={{ fontWeight: 800, color: 'var(--green)', fontFamily: 'var(--font-display)' }}>₹{Number(totalValue).toLocaleString()}</span>
                  </div>
                </div>
              )}
            </Section>
          )}

          {/* WEBSITE ISSUES */}
          {websiteIssues.length > 0 && (
            <Section id="website" title="Website Audit" icon={<Globe size={15} color="var(--blue)" />} count={websiteIssues.filter(i => i.type === 'bad').length + ' issues'}>
              {latest.website_url && (
                <a href={latest.website_url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--accent)', marginBottom: 12 }}>
                  <ExternalLink size={11} /> {latest.website_url}
                </a>
              )}
              <div>
                {websiteIssues.map((issue, i) => (
                  <IssueItem key={i} issue={issue} type={issue.type} />
                ))}
              </div>
            </Section>
          )}

          {/* SEO ISSUES */}
          {seoIssues.length > 0 && (
            <Section id="seo" title="SEO Audit" icon={<Search size={15} color="var(--orange)" />} count={seoIssues.length + ' issues'}>
              <div>
                {seoIssues.map((issue, i) => (
                  <IssueItem key={i} issue={issue} type={issue.type || 'bad'} />
                ))}
              </div>
            </Section>
          )}

          {/* AUDIT HISTORY */}
          {showHistory && audits.length > 1 && (
            <div className="card">
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Audit History</div>
              {audits.slice(1).map((a, i) => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < audits.length - 2 ? '1px solid var(--border)' : 'none', cursor: 'pointer' }}
                  onClick={() => setLatest(a)}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>{format(new Date(a.created_at), 'dd MMM yyyy, h:mm a')}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '3px 8px' }}>Website: {a.website_score}</span>
                    <span style={{ fontSize: 12, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '3px 8px' }}>Lead: {a.lead_score}</span>
                    <TempBadge temp={a.lead_temperature} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* RE-RUN BUTTON */}
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8, marginBottom: 16 }}>
            <button className="btn btn-ghost btn-sm" onClick={runAudit} disabled={running}>
              <RefreshCw size={13} /> Re-run Audit
            </button>
          </div>
        </>
      )}
    </div>
  )
}
