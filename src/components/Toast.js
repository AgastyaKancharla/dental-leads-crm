import React from 'react'
import { CheckCircle, AlertCircle } from 'lucide-react'

export default function Toast({ msg, type }) {
  return (
    <div className={`toast toast-${type}`}>
      {type === 'success' ? <CheckCircle size={15} color="var(--green)" /> : <AlertCircle size={15} color="var(--red)" />}
      {msg}
    </div>
  )
}
