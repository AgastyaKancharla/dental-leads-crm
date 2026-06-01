/* eslint-disable */
import { supabase } from './supabase'

const TAVILY_KEY = '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'
const ANTHROPIC_HEADER = { 'Content-Type': 'application/json', 'anthropic-dangerous-direct-browser-access': 'true' }

// ── MAIN FUNCTION — call this when lead is added ──
export async function generateLeadIntelligence(lead) {
  if (!lead?.id) return

  // Mark as processing
  await supabase.from('lead_intelligence').upsert({
    lead_id: lead.id, status: 'processing', updated_at: new Date().toISOString()
  }, { onConflict: 'lead_id' })
  await supabase.from('leads').update({ intelligence_status: 'processing' }).eq('id', lead.id)

  try {
    // ── STEP 1: TAVILY SEARCH ──
    const searchQuery = `${lead.clinic_name} ${lead.area || 'Bengaluru'} dental clinic`
    const tavilyResp = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TAVILY_KEY,
        query: searchQuery,
        search_depth: 'basic',
        max_results: 8,
        include_answer: true,
        include_domains: ['practo.com', 'justdial.com', 'instagram.com', 'facebook.com', 'google.com'],
      })
    })

    let searchContext = ''
    let rawSearch = ''
    if (tavilyResp.ok) {
      const tavilyData = await tavilyResp.json()
      rawSearch = JSON.stringify(tavilyData)
      const results = tavilyData.results || []
      searchContext = results.map(r => `URL: ${r.url}\nTitle: ${r.title}\nContent: ${r.content?.slice(0, 300)}`).join('\n\n---\n\n')
      if (tavilyData.answer) searchContext = `Summary: ${tavilyData.answer}\n\n${searchContext}`
    }

    // ── STEP 2: CLAUDE ANALYSIS ──
    const prompt = `You are an expert sales intelligence analyst for AgastyaOne, a digital marketing company in Bengaluru that sells:
- Website Design: ₹15,000–₹35,000 one-time
- Local SEO: ₹8,000–₹15,000/month  
- WhatsApp Automation: ₹3,000–₹5,000/month
- CRM Setup: ₹5,000–₹10,000/month
- Reputation Management: ₹5,000–₹8,000/month
- Google Ads: ₹8,000–₹15,000/month

LEAD DATA:
- Clinic: ${lead.clinic_name}
- Doctor: ${lead.doctor_name || 'Unknown'}
- Phone: ${lead.phone}
- Area: ${lead.area || 'Bengaluru'}
- Google Rating: ${lead.rating || 'Unknown'} (${lead.notes?.includes('review') ? lead.notes : 'reviews unknown'})
- Notes: ${lead.notes || 'None'}

WEB SEARCH RESULTS:
${searchContext || 'No search results available — reason from clinic name and area only'}

Analyze everything and respond ONLY with this exact JSON (no markdown, no explanation):
{
  "has_website": <true|false>,
  "website_url": "<url or null>",
  "has_instagram": <true|false>,
  "instagram_url": "<url or null>",
  "has_facebook": <true|false>,
  "has_practo": <true|false>,
  "has_justdial": <true|false>,
  "has_whatsapp_business": <true|false>,
  "has_online_booking": <true|false>,
  "clinic_type": "<single dentist|multi-specialty|chain|unknown>",
  "estimated_patient_volume": "<low|medium|high|very high>",
  "review_velocity": "<dead|slow|active|very active>",
  "competitor_count": <estimated number of dental clinics in same area>,
  "opportunity_score": <0-100>,
  "primary_pitch": "<1 sentence — main thing to sell them>",
  "opening_line": "<exact opening line for cold call — conversational, specific, not salesy>",
  "pitch_points": [
    "<specific pitch point 1 based on what you found>",
    "<specific pitch point 2>",
    "<specific pitch point 3>"
  ],
  "services_to_sell": [
    {"service": "<name>", "reason": "<why>", "value": <number>, "billing": "<one-time|per month>", "priority": <1|2|3>}
  ],
  "estimated_deal_value": <total number>,
  "intelligence_summary": "<2-3 sentence paragraph summarizing what you know about this clinic and why they are a good/bad lead>"
}`

    const aiResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: ANTHROPIC_HEADER,
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      })
    })

    if (!aiResp.ok) throw new Error(`AI error: ${aiResp.status}`)
    const aiData = await aiResp.json()
    const text = aiData.content?.[0]?.text || ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in AI response')
    const intel = JSON.parse(jsonMatch[0])

    // ── STEP 3: SAVE TO DB ──
    await supabase.from('lead_intelligence').upsert({
      lead_id: lead.id,
      status: 'done',
      has_website: intel.has_website,
      website_url: intel.website_url,
      has_instagram: intel.has_instagram,
      instagram_url: intel.instagram_url,
      has_facebook: intel.has_facebook,
      has_practo: intel.has_practo,
      has_justdial: intel.has_justdial,
      has_whatsapp_business: intel.has_whatsapp_business,
      has_online_booking: intel.has_online_booking,
      clinic_type: intel.clinic_type,
      estimated_patient_volume: intel.estimated_patient_volume,
      review_velocity: intel.review_velocity,
      competitor_count: intel.competitor_count,
      opportunity_score: intel.opportunity_score,
      primary_pitch: intel.primary_pitch,
      pitch_points: intel.pitch_points,
      opening_line: intel.opening_line,
      services_to_sell: intel.services_to_sell,
      estimated_deal_value: intel.estimated_deal_value,
      raw_search_results: rawSearch.slice(0, 5000),
      raw_ai_response: text.slice(0, 5000),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'lead_id' })

    await supabase.from('leads').update({
      intelligence_status: 'done',
      opportunity_score: intel.opportunity_score,
      website_url: intel.website_url || lead.website_url,
    }).eq('id', lead.id)

    return intel

  } catch (err) {
    console.error('Intelligence error:', err)
    await supabase.from('lead_intelligence').upsert({
      lead_id: lead.id, status: 'failed', updated_at: new Date().toISOString()
    }, { onConflict: 'lead_id' })
    await supabase.from('leads').update({ intelligence_status: 'failed' }).eq('id', lead.id)
    return null
  }
}
