/* eslint-disable */
// ─── SINGLE SOURCE OF TRUTH FOR LEAD STATUSES ───────────────────────────────
// Add a new status here and it auto-propagates everywhere in the app.
//
// Fields per entry:
//   key       – DB value (snake_case)
//   label     – human-readable display name
//   emoji     – used in badges, timelines, dropdowns
//   badge     – CSS class (must exist in index.css)
//   bucket    – 'active' | 'hot' | 'parked' | 'closed'
//               active  → shows in Active section
//               hot     → shows in Hot section (highest priority)
//               parked  → shows in Parked section
//               closed  → shows in Closed & Dead section
// ─────────────────────────────────────────────────────────────────────────────

export const STATUS_CONFIG = [
  // ── Active / in-progress ──────────────────────────────────────────────────
  { key: 'new',               label: 'New',               emoji: '🆕', badge: 'badge-new',         bucket: 'active'  },
  { key: 'called',            label: 'Called',            emoji: '📞', badge: 'badge-called',      bucket: 'active'  },
  { key: 'missed',            label: 'Missed',            emoji: '📵', badge: 'badge-missed',      bucket: 'active'  },
  { key: 'not_reachable',     label: 'Not Reachable',     emoji: '📵', badge: 'badge-missed',      bucket: 'active'  },

  // ── Hot / progressing ─────────────────────────────────────────────────────
  { key: 'interested',        label: 'Interested',        emoji: '😊', badge: 'badge-interested',  bucket: 'hot'     },
  { key: 'demo_sent',         label: 'Demo Sent',         emoji: '🖥️', badge: 'badge-demo_sent',   bucket: 'hot'     },
  { key: 'quote_sent',        label: 'Quote Sent',        emoji: '💰', badge: 'badge-quote',       bucket: 'hot'     },
  { key: 'negotiating',       label: 'Negotiating',       emoji: '🤝', badge: 'badge-negotiating', bucket: 'hot'     },

  // ── Parked / waiting ─────────────────────────────────────────────────────
  { key: 'future_interested', label: 'Future Interest',   emoji: '🔮', badge: 'badge-future',      bucket: 'parked'  },
  { key: 'renovation',        label: 'Renovating',        emoji: '🏗️', badge: 'badge-renovation',  bucket: 'parked'  },
  { key: 'gatekeeper',        label: 'Gatekeeper',        emoji: '🚧', badge: 'badge-gatekeeper',  bucket: 'parked'  },
  { key: 'out_of_city',       label: 'Out of City',       emoji: '✈️', badge: 'badge-future',      bucket: 'parked'  },
  { key: 'partner_approval',  label: 'Partner Approval',  emoji: '🤝', badge: 'badge-called',      bucket: 'parked'  },
  { key: 'no_budget',         label: 'No Budget Now',     emoji: '💸', badge: 'badge-renovation',  bucket: 'parked'  },
  { key: 'wrong_number',      label: 'Wrong Number',      emoji: '❓', badge: 'badge-missed',      bucket: 'parked'  },

  // ── Closed / terminal ────────────────────────────────────────────────────
  { key: 'closed',            label: 'Closed',            emoji: '✅', badge: 'badge-closed',      bucket: 'closed'  },
  { key: 'dead',              label: 'Not Interested',    emoji: '❌', badge: 'badge-dead',        bucket: 'closed'  },
]

// ── Derived maps (auto-generated — don't edit these) ─────────────────────────

export const STATUS_KEYS    = STATUS_CONFIG.map(s => s.key)
export const STATUS_LABELS  = Object.fromEntries(STATUS_CONFIG.map(s => [s.key, s.label]))
export const STATUS_EMOJI   = Object.fromEntries(STATUS_CONFIG.map(s => [s.key, s.emoji]))
export const STATUS_BADGE   = Object.fromEntries(STATUS_CONFIG.map(s => [s.key, s.badge]))

// All status keys including blank for filter dropdowns
export const STATUSES = ['', ...STATUS_KEYS]

// Bucket membership helpers
export const BUCKET_HOT     = STATUS_CONFIG.filter(s => s.bucket === 'hot').map(s => s.key)
export const BUCKET_PARKED  = STATUS_CONFIG.filter(s => s.bucket === 'parked').map(s => s.key)
export const BUCKET_CLOSED  = STATUS_CONFIG.filter(s => s.bucket === 'closed').map(s => s.key)
export const BUCKET_ACTIVE  = STATUS_CONFIG.filter(s => s.bucket === 'active').map(s => s.key)

// Outcome → next action suggestion (used in lead cards and detail page)
export const NEXT_ACTION_MAP = {
  interested:        { label:'Send Demo',          emoji:'🖥️', tip:'They showed interest — send the demo link now while its fresh.',          action:'send_demo' },
  future_interested: { label:'Schedule Follow Up', emoji:'🔮', tip:'Interested but not now — set a follow-up reminder for 30-60 days later.', action:'call'      },
  callback:          { label:'Call Back',           emoji:'📞', tip:'They asked you to call back — call exactly on the scheduled date/time.',  action:'call'      },
  not_interested:    { label:'Mark Dead',           emoji:'❌', tip:'Not interested — move on. Try again in 3 months.',                       action:null        },
  no_answer:         { label:'Try Again',           emoji:'📵', tip:'No answer — try again tomorrow at a different time of day.',              action:'call'      },
  missed:            { label:'Reschedule',          emoji:'📵', tip:'Call was missed — reschedule and mark in the system.',                   action:'call'      },
  demo_requested:    { label:'Send Demo Now',       emoji:'🖥️', tip:'They asked for a demo — send it immediately!',                           action:'send_demo' },
  quote_sent:        { label:'Follow Up on Quote',  emoji:'💰', tip:'Quote is sent — follow up in 2-3 days to check if they reviewed it.',   action:'call'      },
  closed:            { label:'Won! 🎉',             emoji:'✅', tip:'Deal closed — collect payment and start onboarding.',                     action:null        },
  other:             { label:'Follow Up',           emoji:'📞', tip:'Follow up to clarify the next step.',                                    action:'call'      },
}

// Status → default next action label (shown on card when no call outcome exists yet)
export const STATUS_NEXT_ACTION = {
  new:               { label:'Make first call',    emoji:'📞' },
  called:            { label:'Follow up call',     emoji:'📞' },
  interested:        { label:'Send demo',          emoji:'🖥️' },
  demo_sent:         { label:'Follow up on demo',  emoji:'📞' },
  quote_sent:        { label:'Follow up on quote', emoji:'💰' },
  negotiating:       { label:'Close the deal',     emoji:'🤝' },
  future_interested: { label:'Schedule check-in',  emoji:'🔮' },
  gatekeeper:        { label:'Reach the doctor',   emoji:'🚧' },
  renovation:        { label:'Check back later',   emoji:'🏗️' },
  out_of_city:       { label:'Call when back',     emoji:'✈️' },
  partner_approval:  { label:'Follow up approval', emoji:'🤝' },
  no_budget:         { label:'Re-engage later',    emoji:'💸' },
  missed:            { label:'Reschedule call',    emoji:'📵' },
  not_reachable:     { label:'Try again',          emoji:'📵' },
}
export const STATUS_MAP = {
  interested:       'interested',
  future_interested:'future_interested',
  callback:         'called',
  not_interested:   'dead',
  no_answer:        'called',
  missed:           'missed',
  demo_requested:   'demo_sent',
  quote_sent:       'quote_sent',
  closed:           'closed',
}
