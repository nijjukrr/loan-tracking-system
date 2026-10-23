import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { financeApi } from '../lib/financeApi'
import { formatDateISO } from '../lib/financeLogic'
import { DomainValidationError, validateNewLoanInput } from '../lib/domainValidators'
import type { Customer, ModeKind, NewLoanInput } from '../types'

type Props = {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function NewLoanModal({ isOpen, onClose, onSuccess }: Props) {
  const [mode, setMode] = useState<ModeKind>('D')
  const [customerName, setCustomerName] = useState('')
  const [acNo, setAcNo] = useState('')
  const [matchingPeople, setMatchingPeople] = useState<Customer[]>([])
  const [selectedPerson, setSelectedPerson] = useState<Customer | null>(null)
  const [createSeparate, setCreateSeparate] = useState(false)
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [loanDate, setLoanDate] = useState(formatDateISO(new Date()))
  const [principal, setPrincipal] = useState<number>(10000)
  const [interestAmount, setInterestAmount] = useState<number>(300)
  const [weeklyPayment, setWeeklyPayment] = useState<number>(3000)
  const [totalReturn, setTotalReturn] = useState<number>(30000)
  const [firstDueDate, setFirstDueDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const query = customerName.trim()
    if (query.length < 2 || selectedPerson || createSeparate) {
      setMatchingPeople([])
      return
    }
    const timer = window.setTimeout(() => {
      void financeApi.listPeople(query).then(setMatchingPeople).catch(() => setMatchingPeople([]))
    }, 200)
    return () => window.clearTimeout(timer)
  }, [customerName, selectedPerson, createSeparate])

  if (!isOpen) return null

  const handlePrincipalChange = (val: number) => {
    setPrincipal(val)
    if (mode === 'D') {
      setInterestAmount(Math.round(val * 0.03))
    } else {
      const suggestedReturn = Math.round((val * 10) / 9)
      setTotalReturn(suggestedReturn)
      setWeeklyPayment(Math.round(suggestedReturn / 10))
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (saving) return // Idempotency protection against double clicks

    if (matchingPeople.length > 0 && !selectedPerson && !createSeparate) {
      setError('Choose an existing Person or confirm Create Separate Person.')
      return
    }

    setSaving(true)
    setError('')

    try {
      const input: NewLoanInput = {
        customer_id: selectedPerson?.id,
        customer_name: customerName.trim(),
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        mode,
        loan_date: loanDate,
        principal: Number(principal),
        interest_amount: mode === 'D' ? Number(interestAmount) : undefined,
        weekly_payment: mode === 'W' ? Number(weeklyPayment) : undefined,
        total_return: mode === 'W' ? Number(totalReturn) : undefined,
        first_due_date: firstDueDate || undefined,
        main_sheet_no: acNo.trim() ? Number(acNo) : undefined,
        ac_no: acNo.trim() ? Number(acNo) : undefined,
      }
      validateNewLoanInput(input)
      await financeApi.createLoan(input)
      onSuccess()
      onClose()
    } catch (err: unknown) {
      if (err instanceof DomainValidationError) {
        setError(`Validation error (${err.field}): ${err.message}`)
      } else {
        setError(err instanceof Error ? err.message : 'Unable to create loan.')
      }
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
                }}
              >
                Daily (10-Day Cycle)
              </button>
              <button
                type="button"
                className={`tab-btn ${mode === 'W' ? 'active' : ''}`}
                onClick={() => {
                  setMode('W')
                  const suggestedReturn = Math.round((principal * 10) / 9)
                  setTotalReturn(suggestedReturn)
                  setWeeklyPayment(Math.round(suggestedReturn / 10))
                }}
              >
                Weekly (10 Weeks)
              </button>
            </div>
          </label>

          <label>
            Person Name *
            <input
              required
              value={customerName}
              onChange={(e) => {
                setCustomerName(e.target.value)
                setSelectedPerson(null)
                setCreateSeparate(false)
              }}
              placeholder="e.g. YUVARAJ-DMK"
            />
          </label>

          {matchingPeople.length > 0 && (
            <div className="person-match-panel full-span">
              <strong>Similar Person found</strong>
              <p>Names can have separate accounts. Choose explicitly so records are never merged by mistake.</p>
              {matchingPeople.map((person) => (
                <button key={person.id} type="button" className="secondary-button" onClick={() => {
                  setSelectedPerson(person)
                  setCustomerName(person.name)
                  setPhone(person.phone || '')
                  setAddress(person.address || '')
                  setMatchingPeople([])
                }}>
                  Use Existing Person · {person.name}{person.phone ? ` · ${person.phone}` : ''}
                </button>
              ))}
              <button type="button" className="secondary-button" onClick={() => {
                setCreateSeparate(true)
                setMatchingPeople([])
              }}>Create Separate Person</button>
            </div>
          )}

          {(selectedPerson || createSeparate) && (
            <p className="selection-confirmation full-span">
              {selectedPerson ? `Using existing Person: ${selectedPerson.name}` : 'A separate Person record will be created.'}
            </p>
          )}

          <label>
            Account / Sheet No <span className="optional">Optional</span>
            <input
              type="number"
              value={acNo}
              onChange={(e) => setAcNo(e.target.value)}
              placeholder="e.g. 101 (auto if blank)"
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
              onChange={(e) => handlePrincipalChange(Number(e.target.value))}
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
            <>
              <label>
                Total Return (₹) *
                <input type="number" required min={principal} value={totalReturn} onChange={(e) => setTotalReturn(Number(e.target.value))} />
              </label>
              <label>
                Weekly Payment Amount (₹) *
                <input type="number" required min="1" value={weeklyPayment} onChange={(e) => setWeeklyPayment(Number(e.target.value))} />
              </label>
              <p className="field-help full-span">Suggested standard plan: ₹{Math.round((principal * 10) / 9).toLocaleString('en-IN')} total · ₹{Math.round(principal / 9).toLocaleString('en-IN')} × 10. You can override both amounts.</p>
            </>
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
