import { describe, it, expect, beforeEach } from 'vitest'
import { LocalPreviewFinanceApi } from './financeApi'

describe('Financial Correction Audit Trail', () => {
  let api: LocalPreviewFinanceApi

  beforeEach(() => {
    api = new LocalPreviewFinanceApi()
  })

  it('records an immutable audit entry with timestamp and operation details', async () => {
    const entry = await api.recordAuditLog({
      action: 'PAYMENT_ALLOCATION_CORRECTION',
      entity_type: 'payment',
      entity_id: 'pay-test-101',
      details: {
        previousAllocation: { interest: 500, principal: 0 },
        correctedAllocation: { interest: 0, principal: 500 },
        reason: 'Operator misclassified principal return as interest',
      },
      performed_by: 'compliance_officer',
    })

    expect(entry.id).toBeDefined()
    expect(entry.action).toBe('PAYMENT_ALLOCATION_CORRECTION')
    expect(entry.entity_type).toBe('payment')
    expect(entry.entity_id).toBe('pay-test-101')
    expect(entry.created_at).toBeDefined()
    expect(entry.details?.reason).toBe('Operator misclassified principal return as interest')

    const logs = await api.listAuditLogs()
    expect(logs.some((l) => l.id === entry.id)).toBe(true)
  })

  it('filters audit records by entity_type', async () => {
    await api.recordAuditLog({
      action: 'LOAN_MODIFICATION',
      entity_type: 'loan',
      entity_id: 'loan-123',
    })

    await api.recordAuditLog({
      action: 'DUE_RECEIVABLE_SETTLED',
      entity_type: 'due_receivable',
      entity_id: 'due-456',
    })

    const loanLogs = await api.listAuditLogs({ entity_type: 'loan' })
    expect(loanLogs.every((l) => l.entity_type === 'loan')).toBe(true)
    expect(loanLogs.some((l) => l.entity_id === 'loan-123')).toBe(true)
    expect(loanLogs.some((l) => l.entity_id === 'due-456')).toBe(false)
  })
})
