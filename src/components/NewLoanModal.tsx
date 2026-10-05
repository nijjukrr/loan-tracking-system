import { useState } from 'react'
import type { FormEvent } from 'react'
import { financeApi } from '../lib/financeApi'
import { formatDateISO } from '../lib/financeLogic'
import type { ModeKind, NewLoanInput } from '../types'

type Props = {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function NewLoanModal({ isOpen, onClose, onSuccess }: Props) {
  const [mode, setMode] = useState<ModeKind>('D')
  const [customerName, setCustomerName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [loanDate, setLoanDate] = useState(formatDateISO(new Date()))
  const [principal, setPrincipal] = useState<number>(10000)
  const [interestAmount, setInterestAmount] = useState<number>(300)
  const [weeklyPayment, setWeeklyPayment] = useState<number>(3000)
  const [firstDueDate, setFirstDueDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen) return null

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!customerName.trim()) {
      setError('Customer name is required.')
      return
    }
    if (!principal || principal <= 0) {
      setError('Enter a valid principal amount.')
      return
    }

    setSaving(true)
    setError('')

    try {
      const input: NewLoanInput = {
        customer_name: customerName.trim(),
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        mode,
        loan_date: loanDate,
        principal: Number(principal),
        interest_amount: mode === 'D' ? Number(interestAmount) : undefined,
        weekly_payment: mode === 'W' ? Number(weeklyPayment) : undefined,
        first_due_date: firstDueDate || undefined,
      }
      await financeApi.createLoan(input)
      onSuccess()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to create loan.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={() => !saving && onClose()}>
      <form className="modal" onSubmit={handleSubmit} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">New Account</p>
            <h2>+ Create New Loan</h2>
          </div>
          <button className="icon-button" type="button" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>

        {error && <div className="form-message error-message">{error}</div>}

        <div className="form-grid">
          <label className="full-span">
            Mode / Loan Type
            <div className="radio-tabs">
              <button
                type="button"
                className={`tab-btn ${mode === 'D' ? 'active' : ''}`}
                onClick={() => {
                  setMode('D')
                  setInterestAmount(Math.round(principal * 0.03))
                }}
              >
                Daily (10-Day Cycle)
              </button>
              <button
                type="button"
                className={`tab-btn ${mode === 'W' ? 'active' : ''}`}
                onClick={() => {
                  setMode('W')
                  setWeeklyPayment(3000)
                }}
              >
                Weekly (10 Weeks)
              </button>
            </div>
          </label>

          <label>
            Customer Name *
            <input
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="e.g. YUVARAJ-DMK"
            />
          </label>

          <label>
            Phone Number <span className="optional">Optional</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 9876543210" />
          </label>

          <label>
            Loan Date *
            <input type="date" required value={loanDate} onChange={(e) => setLoanDate(e.target.value)} />
          </label>

          <label>
            Principal Amount (₹) *
            <input
              type="number"
              required
              min="500"
              step="500"
              value={principal}
              onChange={(e) => {
                const val = Number(e.target.value)
                setPrincipal(val)
                if (mode === 'D') setInterestAmount(Math.round(val * 0.03))
              }}
            />
          </label>

          {mode === 'D' ? (
            <label>
              10-Day Interest Amount (₹) *
              <input
                type="number"
                required
                min="1"
                value={interestAmount}
                onChange={(e) => setInterestAmount(Number(e.target.value))}
              />
            </label>
          ) : (
            <label>
              Weekly Payment Amount (₹) *
              <input
                type="number"
                required
                min="100"
                value={weeklyPayment}
                onChange={(e) => setWeeklyPayment(Number(e.target.value))}
              />
            </label>
          )}

          <label>
            First Due Date <span className="optional">Optional</span>
            <input
              type="date"
              value={firstDueDate}
              onChange={(e) => setFirstDueDate(e.target.value)}
              placeholder="Auto-calculated if blank"
            />
          </label>

          <label className="full-span">
            Address / Remarks <span className="optional">Optional</span>
            <textarea rows={2} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Notes or location" />
          </label>
        </div>

        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" type="submit" disabled={saving}>
            {saving ? 'Creating…' : 'Create Loan'}
          </button>
        </div>
      </form>
    </div>
  )
}
