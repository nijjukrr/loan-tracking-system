import { beforeEach, describe, expect, it } from 'vitest'
import { LocalPreviewFinanceApi } from './financeApi'

describe('LocalPreviewFinanceApi Service', () => {
  let api: LocalPreviewFinanceApi

  beforeEach(async () => {
    api = new LocalPreviewFinanceApi()
    await api.clearAllData()
  })

  it('manages investment entries (create, list, delete)', async () => {
    const inv = await api.addInvestment({
      entry_date: '2026-09-01',
      investor_name: 'Ponniyan',
      amount: 27000,
      notes: 'Initial capital',
    })

    expect(inv.id).toBeDefined()
    expect(inv.amount).toBe(27000)
    expect(inv.investor_name).toBe('Ponniyan')

    const list = await api.listInvestments()
    expect(list).toHaveLength(1)
    expect(list[0].investor_name).toBe('Ponniyan')

    await api.deleteInvestment(inv.id)
    const afterDelete = await api.listInvestments()
    expect(afterDelete).toHaveLength(0)
  })

  it('manages interest receipts (create, list, delete)', async () => {
    const interest = await api.addInterest({
      entry_date: '2026-09-02',
      customer_name: 'Karuppasamy',
      amount: 1000,
      notes: 'September interest',
    })

    expect(interest.id).toBeDefined()
    expect(interest.amount).toBe(1000)

    const list = await api.listInterests()
    expect(list).toHaveLength(1)
    expect(list[0].customer_name).toBe('Karuppasamy')

    await api.deleteInterest(interest.id)
    const after = await api.listInterests()
    expect(after).toHaveLength(0)
  })

  it('manages customer dues and handles partial and full settlements', async () => {
    const due = await api.addDue({
      due_date: '2026-09-05',
      borrower_name: 'Ajith-1',
      amount: 3000,
      notes: 'Uncollected pending due',
    })

    expect(due.id).toBeDefined()
    expect(due.status).toBe('unpaid')
    expect(due.remaining_amount).toBe(3000)

    // Partial settlement: pay 1000
    const partial = await api.settleDue(due.id, 1000)
    expect(partial.settled_amount).toBe(1000)
    expect(partial.remaining_amount).toBe(2000)
    expect(partial.status).toBe('partial')

    // Full settlement: pay remaining 2000
    const settled = await api.settleDue(due.id, 2000)
    expect(settled.settled_amount).toBe(3000)
    expect(settled.remaining_amount).toBe(0)
    expect(settled.status).toBe('settled')
  })

  it('creates customer and retrieves customer profile with linked loans and dues', async () => {
    const cust = await api.createCustomer({
      name: 'Rathika',
      phone: '9876543210',
      address: 'Town Hall Rd',
    })
    expect(cust.id).toBeDefined()

    await api.createLoan({
      customer_id: cust.id,
      customer_name: 'Rathika',
      mode: 'D',
      loan_date: '2026-09-01',
      principal: 20000,
      interest_amount: 600,
    })

    await api.addDue({
      due_date: '2026-09-10',
      borrower_name: 'Rathika',
      amount: 1000,
    })

    const detail = await api.getCustomerDetail(cust.id)
    expect(detail).not.toBeNull()
    expect(detail?.customer.name).toBe('Rathika')
    expect(detail?.loans).toHaveLength(1)
    expect(detail?.dues).toHaveLength(1)
    expect(detail?.loans[0].principal).toBe(20000)
  })

  it('creates daily loan, records payment and updates installment status', async () => {
    const loan = await api.createLoan({
      customer_name: 'Test Borrower',
      mode: 'D',
      loan_date: '2026-09-01',
      principal: 10000,
      interest_amount: 300,
    })

    expect(loan.id).toBeDefined()
    expect(loan.status).toBe('active')

    const detail = await api.getLoanDetail(loan.id)
    expect(detail?.installments).toHaveLength(6)

    const payResult = await api.recordPayment({
      loan_id: loan.id,
      amount: 300,
      payment_type: 'Interest',
      paid_date: '2026-09-11',
    })

    expect(payResult.payment.amount).toBe(300)
    expect(payResult.loan.total_collected).toBe(300)
    expect(payResult.installments[0].status).toBe('Paid')
    expect(payResult.installments[0].paid_amount).toBe(300)
  })
})
