import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'

export function SecureAccessGate() {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setMessage('')
    const { error } = await supabase!.auth.signInWithPassword({ email, password })
    setSubmitting(false)
    if (error) setMessage(error.message)
  }

  return (
    <main className="access-gate">
      <div className="access-gate-brand">
        <div className="brand-mark">FT</div>
        <div><strong>Finance Tracker</strong><span>Private family ledger</span></div>
      </div>
      {!open ? (
        <button className="primary-button access-button" type="button" onClick={() => setOpen(true)}>Unlock</button>
      ) : (
        <form className="access-dialog" onSubmit={handleSubmit}>
          <div className="modal-header">
            <div><p className="eyebrow">Private access</p><h2>Unlock tracker</h2></div>
            <button className="icon-button" type="button" aria-label="Close" onClick={() => setOpen(false)}>×</button>
          </div>
          <label>Email<input autoFocus type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
          <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label>
          {message && <div className="form-message error-message">Unable to unlock. Check your details and try again.</div>}
          <button className="primary-button full-width" type="submit" disabled={submitting}>{submitting ? 'Unlocking…' : 'Unlock tracker'}</button>
        </form>
      )}
    </main>
  )
}
