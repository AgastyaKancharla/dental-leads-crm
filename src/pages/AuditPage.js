/* eslint-disable */
import React, { useState } from 'react'
import { Zap, Globe, Search, TrendingUp, MessageCircle, AlertCircle, CheckCircle, ChevronDown, ChevronUp, ExternalLink, RefreshCw, Copy } from 'lucide-react'

// ── SCORE RING ──
function ScoreRing({ score, size = 90, label, color }) {
  const r = (size / 2) - 7
  const circ = 2 * Math.PI * r
  const dash = ((score || 0) / 100) * circ
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border)" strokeWidth={7} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={7}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1s ease' }} />
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
          style={{ transform: 'rotate(90deg)', transformOrigin: 'center', fill: color, fontSize: size * 0.24, fontWeight: 800, fontFamily: 'var(--font-display)' }}>
          {score || 0}
        </text>
      </svg>
      <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</div>
    </div>
  )
}

function TempBadge({ temp }) {
  const cfg = {
    Hot:  { bg: '#fef2f2', color: '#dc2626', border: '#fecaca', emoji: '🔥' },
    Warm: { bg: '#fffbeb', color: '#d97706', border: '#fde68a', emoji: '☀️' },
    Cold: { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe', emoji: '❄️' },
  }[temp] || { bg: 'var(--bg3)', color: 'var(--text3)', border: 'var(--border)', emoji: '❓' }
  return (
    <span style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, padding: '5px 14px', borderRadius: 99, fontSize: 13, fontWeight: 700 }}>
      {cfg.emoji} {temp} Lead
    </span>
  )
}

function IssueItem({ issue }) {
  const isGood = issue.type === 'good'
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ width: 22, height: 22, borderRadius: '50%', background: isGood ? 'var(--green-bg)' : 'var(--red-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
        {isGood ? <CheckCircle size={13} color="var(--green)" /> : <AlertCircle size={13} color="var(--red)" />}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{issue.title}</div>
        {issue.detail && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2, lineHeight: 1.5 }}>{issue.detail}</div>}
      </div>
      {issue.impact && (
        <span style={{ fontSize: 10, fontWeight: 700, color: isGood ? 'var(--green)' : issue.impact === 'High' ? 'var(--red)' : issue.impact === 'Medium' ? 'var(--yellow)' : 'var(--text3)', background: isGood ? 'var(--green-bg)' : issue.impact === 'High' ? 'var(--red-bg)' : issue.impact === 'Medium' ? 'var(--yellow-bg)' : 'var(--bg3)', padding: '2px 7px', borderRadius: 99, flexShrink: 0 }}>
          {issue.impact}
        </span>
      )}
    </div>
  )
}

function OppCard({ opp }) {
  const colors = { Website: ['var(--accent)', 'var(--accent-glow)'], SEO: ['#16a34a', 'var(--green-bg)'], WhatsApp: ['#16a34a', '#f0fdf4'], CRM: ['var(--purple)', 'var(--purple-bg)'], Reputation: ['var(--yellow)', 'var(--yellow-bg)'], Marketing: ['var(--orange)', 'var(--orange-bg)'], Google: ['var(--blue)', 'var(--blue-bg)'] }
  const match = Object.entries(colors).find(([k]) => opp.service?.includes(k))
  const [color, bg] = match?.[1] || ['var(--accent)', 'var(--accent-glow)']
  return (
    <div style={{ background: bg, border: `1px solid ${color}25`, borderRadius: 'var(--radius-sm)', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color, marginBottom: 3 }}>{opp.service}</div>
        <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>{opp.reason}</div>
        <span style={{ fontSize: 10, fontWeight: 700, color: opp.priority === 'High' ? 'var(--red)' : opp.priority === 'Medium' ? 'var(--yellow)' : 'var(--green)', background: opp.priority === 'High' ? 'var(--red-bg)' : opp.priority === 'Medium' ? 'var(--yellow-bg)' : 'var(--green-bg)', padding: '2px 7px', borderRadius: 99, display: 'inline-block', marginTop: 5 }}>{opp.priority} Priority</span>
      </div>
      {opp.value && (
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color, fontFamily: 'var(--font-display)' }}>₹{Number(opp.value).toLocaleString()}</div>
          <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{opp.billing || 'one-time'}</div>
        </div>
      )}
    </div>
  )
}

const SAMPLE_SITES = [
  'https://apollodentalcentre.com',
  'https://sabkadentist.com',
  'https://clove.dental',
]

export default function AuditPage() {
  const [url, setUrl] = useState('')
  const [clinicName, setClinicName] = useState('')
  const [rating, setRating] = useState('')
  const [area, setArea] = useState('')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [expand, setExpand] = useState({ pitch: true, opps: true, website: true, seo: true })
  const toggle = k => setExpand(p => ({ ...p, [k]: !p[k] }))

  async function runAudit() {
    if (!url && !clinicName) { setError('Enter a website URL or clinic name'); return }
    setRunning(true)
    setError('')
    setResult(null)

    const prompt = `You are an expert digital marketing auditor for AgastyaOne — a company that sells websites, SEO, CRM, WhatsApp automation and marketing services to dental clinics in Bengaluru, India.

Audit this dental clinic and generate a comprehensive report:

INPUT DATA:
- Website URL: ${url || 'None provided — assume no website'}
- Clinic Name: ${clinicName || 'Unknown Dental Clinic'}
- Google Rating: ${rating || 'Unknown'}
- Area: ${area || 'Bengaluru'}

AGASTYONE PRICING:
- Website Design: ₹15,000–₹35,000 one-time
- Local SEO: ₹8,000–₹15,000/month
- WhatsApp Automation: ₹3,000–₹5,000/month
- CRM Setup: ₹5,000–₹10,000/month
- Reputation Management: ₹5,000–₹8,000/month
- Google Ads: ₹8,000–₹15,000/month

Respond ONLY with valid JSON, no markdown, no explanation, just the raw JSON object:
{
  "website_score": <0-100, 0 if no website>,
  "lead_score": <0-100 based on business potential>,
  "lead_temperature": "<Hot|Warm|Cold>",
  "summary": "<2 sentence summary of this clinic's digital presence and opportunity>",
  "website_issues": [
    {"title": "<issue or strength>", "detail": "<specific explanation>", "impact": "<High|Medium|Low|Good>", "type": "<bad|good>"}
  ],
  "seo_issues": [
    {"title": "<SEO issue>", "detail": "<explanation>", "impact": "<High|Medium|Low>", "type": "bad"}
  ],
  "opportunities": [
    {"service": "<service name>", "reason": "<specific reason for this clinic>", "value": <price number>, "billing": "<one-time|per month>", "priority": "<High|Medium|Low>"}
  ],
  "estimated_value": {
    "website": <0 or number>,
    "seo": <0 or number>,
    "whatsapp": <0 or number>,
    "crm": <0 or number>,
    "reputation": <0 or number>,
    "ads": <0 or number>
  },
  "total_estimated_value": <total number>,
  "pitch_points": [
    "<specific personalized pitch point 1>",
    "<specific personalized pitch point 2>",
    "<specific personalized pitch point 3>"
  ]
}`

    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          messages: [{ role: 'user', content: prompt }]
        })
      })

      if (!resp.ok) {
        const errData = await resp.json()
        throw new Error(errData.error?.message || `API error: ${resp.status}`)
      }

      const data = await resp.json()
      const text = data.content?.[0]?.text || ''

      // Extract JSON — handle markdown code blocks too
      const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/) || text.match(/(\{[\s\S]*\})/)
      if (!jsonMatch) throw new Error('Could not parse AI response')
      const jsonStr = jsonMatch[1] || jsonMatch[0]
      const audit = JSON.parse(jsonStr)
      setResult(audit)
    } catch (err) {
      console.error('Audit error:', err)
      setError(err.message || 'Audit failed — please try again')
    }
    setRunning(false)
  }

  function copyPitch(point) {
    navigator.clipboard.writeText(point).catch(() => {})
    window.__toast && window.__toast('Pitch point copied!', 'success')
  }

  const wColor = s => !s ? 'var(--text3)' : s >= 70 ? 'var(--green)' : s >= 40 ? 'var(--yellow)' : 'var(--red)'
  const lColor = s => !s ? 'var(--text3)' : s >= 90 ? '#dc2626' : s >= 70 ? 'var(--yellow)' : 'var(--blue)'

  const Section = ({ id, title, icon, children, count }) => (
    <div className="card" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => toggle(id)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700 }}>
          {icon} {title}
          {count !== undefined && <span style={{ fontSize: 11, background: 'var(--bg3)', color: 'var(--text3)', padding: '1px 7px', borderRadius: 99 }}>{count}</span>}
        </div>
        {expand[id] ? <ChevronUp size={15} color="var(--text3)" /> : <ChevronDown size={15} color="var(--text3)" />}
      </div>
      {expand[id] && <div style={{ marginTop: 14 }}>{children}</div>}
    </div>
  )

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>

      {/* ── INPUT CARD ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent-glow)', border: '1px solid rgba(91,82,245,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={18} color="var(--accent)" />
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 800 }}>Website AI Audit</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>Paste any dental clinic website to analyse</div>
          </div>
        </div>

        {/* URL INPUT */}
        <div className="form-group">
          <label className="form-label">🌐 Website URL</label>
          <div style={{ position: 'relative' }}>
            <Globe size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
            <input className="form-input" style={{ paddingLeft: 32 }}
              placeholder="https://clinicname.com"
              value={url} onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && runAudit()} />
          </div>
          {/* SAMPLE LINKS */}
          <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>Try:</span>
            {SAMPLE_SITES.map(s => (
              <button key={s} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 11, cursor: 'pointer', padding: 0 }} onClick={() => setUrl(s)}>{s.replace('https://', '')}</button>
            ))}
          </div>
        </div>

        {/* OPTIONAL EXTRA CONTEXT */}
        <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 10 }}>Extra Context (optional — improves accuracy)</div>
          <div className="form-row" style={{ marginBottom: 0 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Clinic Name</label>
              <input className="form-input" placeholder="Apollo Dental" value={clinicName} onChange={e => setClinicName(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Area</label>
              <input className="form-input" placeholder="Koramangala" value={area} onChange={e => setArea(e.target.value)} />
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 0, marginTop: 10 }}>
            <label className="form-label">Google Rating</label>
            <input className="form-input" type="number" step="0.1" min="1" max="5" placeholder="4.5" value={rating} onChange={e => setRating(e.target.value)} />
          </div>
        </div>

        {error && (
          <div style={{ background: 'var(--red-bg)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: 14, fontSize: 13, color: 'var(--red)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{error}</span>
          </div>
        )}

        <button className="btn btn-primary btn-full" onClick={runAudit} disabled={running}>
          {running
            ? <><div className="spinner" style={{ borderTopColor: 'white', width: 15, height: 15 }} /> Analysing website...</>
            : <><Zap size={15} /> Run AI Audit</>}
        </button>
      </div>

      {/* ── RUNNING STATE ── */}
      {running && (
        <div style={{ background: 'var(--accent-glow)', border: '1px solid rgba(91,82,245,0.2)', borderRadius: 'var(--radius)', padding: '28px 20px', textAlign: 'center', marginBottom: 16 }}>
          <div className="spinner" style={{ margin: '0 auto 16px', width: 32, height: 32, borderWidth: 3, borderTopColor: 'var(--accent)' }} />
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--accent)', marginBottom: 8 }}>AI is auditing {url || clinicName || 'the website'}...</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.8 }}>
            Checking website quality · SEO health · Business gaps<br />
            Generating personalized pitch points · Estimating deal value
          </div>
        </div>
      )}

      {/* ── RESULTS ── */}
      {result && !running && (
        <>
          {/* SCORES */}
          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', flexWrap: 'wrap', gap: 20, padding: '10px 0' }}>
              <ScoreRing score={result.website_score} label="Website" color={wColor(result.website_score)} size={96} />
              <ScoreRing score={result.lead_score} label="Lead Score" color={lColor(result.lead_score)} size={96} />
              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <TempBadge temp={result.lead_temperature} />
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>Lead Temperature</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, color: 'var(--green)' }}>
                  ₹{result.total_estimated_value > 0 ? (result.total_estimated_value / 1000).toFixed(0) + 'k' : '—'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Est. Deal Value</div>
              </div>
            </div>
            {url && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Globe size={13} color="var(--text3)" />
                <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {url} <ExternalLink size={11} />
                </a>
              </div>
            )}
          </div>

          {/* SUMMARY */}
          {result.summary && (
            <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderLeft: '3px solid var(--accent)', borderRadius: 'var(--radius-sm)', padding: '14px 16px', marginBottom: 12, fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, fontStyle: 'italic' }}>
              💡 {result.summary}
            </div>
          )}

          {/* PITCH POINTS */}
          {result.pitch_points?.length > 0 && (
            <Section id="pitch" title="Sales Pitch Points" icon={<MessageCircle size={15} color="var(--accent)" />}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {result.pitch_points.map((point, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: i === 0 ? 'var(--accent-glow)' : 'var(--bg3)', border: `1px solid ${i === 0 ? 'rgba(91,82,245,0.2)' : 'var(--border)'}`, borderRadius: 'var(--radius-sm)', padding: '12px 14px' }}>
                    <div style={{ width: 26, height: 26, borderRadius: '50%', background: i === 0 ? 'var(--accent)' : 'var(--border2)', color: i === 0 ? 'white' : 'var(--text3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                    <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, flex: 1 }}>"{point}"</div>
                    <button className="btn-icon" style={{ padding: '4px 6px', flexShrink: 0 }} onClick={() => copyPitch(point)} title="Copy"><Copy size={12} /></button>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* OPPORTUNITIES */}
          {result.opportunities?.length > 0 && (
            <Section id="opps" title="Business Opportunities" icon={<TrendingUp size={15} color="var(--green)" />} count={result.opportunities.length}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {result.opportunities.sort((a, b) => a.priority === 'High' ? -1 : 1).map((opp, i) => <OppCard key={i} opp={opp} />)}
              </div>

              {/* VALUE BREAKDOWN */}
              {Object.values(result.estimated_value || {}).some(v => v > 0) && (
                <div style={{ marginTop: 14, padding: '14px 16px', background: 'var(--bg3)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 10 }}>Deal Value Breakdown</div>
                  {Object.entries(result.estimated_value).filter(([, v]) => v > 0).map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ textTransform: 'capitalize', color: 'var(--text2)' }}>{k}</span>
                      <span style={{ fontWeight: 700, color: 'var(--green)' }}>₹{Number(v).toLocaleString()}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, marginTop: 10, paddingTop: 10, borderTop: '2px solid var(--border)' }}>
                    <span style={{ fontWeight: 700 }}>Total Potential</span>
                    <span style={{ fontWeight: 800, color: 'var(--green)', fontFamily: 'var(--font-display)' }}>₹{Number(result.total_estimated_value).toLocaleString()}</span>
                  </div>
                </div>
              )}
            </Section>
          )}

          {/* WEBSITE ISSUES */}
          {result.website_issues?.length > 0 && (
            <Section id="website" title="Website Audit" icon={<Globe size={15} color="var(--blue)" />} count={`${result.website_issues.filter(i => i.type === 'bad').length} issues`}>
              {result.website_issues.map((issue, i) => <IssueItem key={i} issue={issue} />)}
            </Section>
          )}

          {/* SEO ISSUES */}
          {result.seo_issues?.length > 0 && (
            <Section id="seo" title="SEO Audit" icon={<Search size={15} color="var(--orange)" />} count={`${result.seo_issues.length} issues`}>
              {result.seo_issues.map((issue, i) => <IssueItem key={i} issue={issue} />)}
            </Section>
          )}

          {/* RE-RUN */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24, marginTop: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => { setResult(null); setUrl(''); setClinicName(''); setRating(''); setArea('') }}>
              <RefreshCw size={13} /> Audit Another
            </button>
          </div>
        </>
      )}
    </div>
  )
}
