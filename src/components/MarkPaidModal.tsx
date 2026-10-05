import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { financeApi } from '../lib/financeApi'
import { formatDateISO } from '../lib/financeLogic'
import type { Installment, Loan, PaymentType } from '../types'

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

type Props = {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  loan?: Loan | null
  installment?: Installment | null
}

export function MarkPaidModal({ isOpen, onClose, onSuccess, loan, installment }: Props) {
  const [paidDate, setPaidDate] = useState(formatDateISO(new Date()))
  const [amount, setAmount] = useState<number>(0)
  const [paymentType, setPaymentType] = useState<PaymentType>('Interest')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (loan) {
      if (loan.mode === 'W') {
        setPaymentType('Weekly Installment')
        setAmount(installment?.expected_amount || loan.weekly_payment || 3000)
      } else {
        setPaymentType('Interest')
        setAmount(installment?.expected_amount || loan.interest_amount || 300)
      }
      setPaidDate(formatDateISO(new Date()))
      setNote('')
      setError('')
    }
  }, [loan, installment])

  if (!isOpen || !loan) return null

  const expectedAmount = installment?.expected_amount || (loan.mode === 'D' ? loan.interest_amount : loan.weekly_payment)
  const currentDueDate = installment?.due_date || loan.loan_date

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!amount || amount <= 0) {
      setError('Please enter a valid positive payment amount.')
      return
    }

    setSaving(true)
    setError('')

    try {
      await financeApi.recordPayment({
        loan_id: loan!.id,
        installment_id: installment?.id,
        paid_date: paidDate,
        amount: Number(amount),
        payment_type: paymentType,
        note: note.trim() || undefined,
      })
      onSuccess()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to record payment.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={() => !saving && onClose()}>
      <form className="modal" onSubmit={handleSubmit} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">Payment Action</p>
            <h2>Mark Paid / Add Payment</h2>
          </div>
          <button className="icon-button" type="button" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>

        {error && <div className="form-message error-message">{error}</div>}

        <div className="payment-summary-card">
          <div>
            <strong>{loan.customer_name}</strong>
            <span>Main Sheet #{loan.main_sheet_no} · {loan.mode === 'D' ? 'Daily Loan' : 'Weekly Loan'}</span>
          </div>
          <div className="summary-pills">
            <span>Due Date: <strong>{currentDueDate}</strong></span>
            <span>Expected: <strong>{currency.format(expectedAmount)}</strong></span>
          </div>
        </div>

        <div className="form-grid">
          <label>
            Payment Date *
            <input type="date" required value={paidDate} onChange={(e) => setPaidDate(e.target.value)} />
          </label>

          <label>
            Amount Received (₹) *
            <input
              type="number"
              required
              min="1"
              step="1"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
          </label>

          <label>
            Payment Type *
            <select value={paymentType} onChange={(e) => setPaymentType(e.target.value as PaymentType)}>
              <option value="Interest">Interest</option>
              <option value="Weekly Installment">Weekly Installment</option>
              <option value="Principal">Principal</option>
              <option value="Partial">Partial</option>
              <option value="Other">Other</option>
            </select>
          </label>

          <label className="full-span">
            Note / Remark <span className="optional">Optional</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Received via UPI / Cash"
            />
          </label>
        </div>

        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" type="submit" disabled={saving}>
            {saving ? 'Saving Payment…' : 'Record Payment'}
          </button>
        </div>
      </form>
    </div>
  )
}
