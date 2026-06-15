/* eslint-disable */
import React from 'react'
import { STATUS_LABELS, STATUS_BADGE } from '../lib/statuses'

const OUTCOME_LABELS = {
  interested:'Interested', callback:'Callback', not_interested:'Not Interested',
  no_answer:'No Answer', not_reachable:'Not Reachable', demo_requested:'Demo Requested',
  closed:'Closed', missed:'Missed', future_interested:'Future Interest',
  quote_sent:'Quote Sent', other:'Other',
}

const OUTCOME_BADGE = {
  interested:'badge-interested', callback:'badge-called',
  not_interested:'badge-dead', no_answer:'badge-called',
  not_reachable:'badge-missed',
  renovation:'badge-renovation', gatekeeper:'badge-gatekeeper',
  out_of_city:'badge-future',
  partner_approval:'badge-called', demo_requested:'badge-demo_sent',
  closed:'badge-closed', missed:'badge-missed',
  future_interested:'badge-future', quote_sent:'badge-quote', other:'badge-new',
}

export function StatusBadge({ status }) {
  return (
    <span className={`badge ${STATUS_BADGE[status] || 'badge-new'}`}>
      {STATUS_LABELS[status] || status}
    </span>
  )
}

export function PriorityBadge({ priority }) {
  return <span className={`badge badge-${priority}`}>{priority?.charAt(0).toUpperCase()+priority?.slice(1)}</span>
}

export function OutcomeBadge({ outcome }) {
  return (
    <span className={`badge ${OUTCOME_BADGE[outcome] || 'badge-new'}`}>
      {OUTCOME_LABELS[outcome] || outcome}
    </span>
  )
}
