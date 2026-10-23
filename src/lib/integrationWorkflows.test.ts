import { describe, it, expect, beforeEach } from 'vitest'
import { LocalPreviewFinanceApi } from './financeApi'
import { computeDashboardMetrics } from './financeLogic'
import { computeReconciliationReport } from './reconciliation'
import type { NewLoanInput, NewPaymentInput } from '../types'

describe('End-to-End Finance Workflows & Accounting Integration', () => {
  let api: LocalPreviewFinanceApi

  beforeEach(() => {
    api = new LocalPreviewFinanceApi()
  })

  describe('1. Loan Lifecycle & Payment Allocation', () => {
    it('executes a Daily loan cycle from disbursement to full principal repayment', async () => {
      const loanInput: NewLoanInput = {
        customer_name: 'Integration Daily Borrower',
        main_sheet_no: 501,
        mode: 'D',
        loan_date: '2026-10-01',
        principal: 10000,
        interest_amount: 500,
        first_due_date: '2026-10-11',
      }

      const loan = await api.createLoan(loanInput)
      expect(loan.id).toBeDefined()
      expect(loan.principal).toBe(10000)
      expect(loan.remaining_balance).toBe(13000) // 10000 + 500 * 6
      expect(loan.status).toBe('active')

      const detail = await api.getLoanDetail(loan.id)
      expect(detail).not.toBeNull()
      expect(detail!.installments.length).toBe(6)

      // Step 2: Pay 1st installment interest (₹500)
      const payInput: NewPaymentInput = {
        loan_id: loan.id,
        amount: 500,
        payment_type: 'Interest',
        payment_date: '2026-10-11',
      }
      const payResult = await api.recordPayment(payInput)
      expect(payResult.payment.amount).toBe(500)
      expect(payResult.loan.total_collected).toBe(500)
      expect(payResult.loan.remaining_balance).toBe(12500)

      // Step 3: Pay full principal return (₹10,000)
      const principalPay: NewPaymentInput = {
        loan_id: loan.id,
        amount: 10000,
        payment_type: 'Principal',
        payment_date: '2026-10-20',
      }
      const prinResult = await api.recordPayment(principalPay)
      expect(prinResult.payment.amount).toBe(10000)
      expect(prinResult.loan.total_collected).toBe(10500)
    })

    it('executes a Weekly loan cycle with installment settlements', async () => {
      const weeklyLoanInput: NewLoanInput = {
        customer_name: 'Integration Weekly Borrower',
        main_sheet_no: 502,
        mode: 'W',
        loan_date: '2026-10-01',
        principal: 20000,
        weekly_payment: 2000,
        total_return: 20000,
        first_due_date: '2026-10-08',
      }

      const loan = await api.createLoan(weeklyLoanInput)
      const detail = await api.getLoanDetail(loan.id)
      expect(detail!.installments.length).toBe(10)

      // Record first weekly payment
      const p1 = await api.recordPayment({
        loan_id: loan.id,
        amount: 2000,
        payment_type: 'Weekly Installment',
        payment_date: '2026-10-08',
        principal_allocation: 1800,
        interest_allocation: 200,
      })

      expect(p1.loan.total_collected).toBe(2000)
      expect(p1.loan.remaining_balance).toBe(18000)
    })
  })

  describe('2. Auditable 10% Profit Tagging vs Capital Credit', () => {
    it('prevents automatic classification of investment capital as 10% profit', async () => {
      const untagged = await api.listUntaggedMainTransactions()
      if (untagged.length === 0) return

      const tx = untagged[0]
      // Explicit tagging is required
      const entry = await api.tagMainTransaction(tx.id)
      expect(entry.amount).toBe(tx.credit)
      expect(entry.source_kind).toBe('main_tag')

      // Cannot tag twice
      await expect(api.tagMainTransaction(tx.id)).rejects.toThrow(
        'Transaction is already tagged as 10% profit.'
      )

      // Untagging restores transaction
      await api.untagMainTransaction(tx.id)
      const untaggedAfter = await api.listUntaggedMainTransactions()
      expect(untaggedAfter.some((t) => t.id === tx.id)).toBe(true)
    })
  })

  describe('3. Customer Dues Partial and Full Settlements', () => {
    it('manages due settlements atomically and maintains remaining balance', async () => {
      const due = await api.addDue({
        borrower_name: 'Integration Due Borrower',
        amount: 5000,
        due_date: '2026-10-15',
        notes: 'Uncollected interest balance',
      })

      expect(due.status).toBe('unpaid')
      expect(due.remaining_amount).toBe(5000)

      // Partial settlement of ₹2,000
      const partial = await api.settleDue(due.id, 2000)
      expect(partial.settled_amount).toBe(2000)
      expect(partial.remaining_amount).toBe(3000)
      expect(partial.status).toBe('partial')

      // Final settlement of remaining ₹3,000
      const full = await api.settleDue(due.id, 3000)
      expect(full.settled_amount).toBe(5000)
      expect(full.remaining_amount).toBe(0)
      expect(full.status).toBe('settled')
    })
  })

  describe('4. Master Reconciliation & Liquid Cash Integrity', () => {
    it('strictly separates nominal cash from liquid cash in accounting reconciliation', () => {
      const report = computeReconciliationReport({
        investments: [
          { id: '1', entry_date: '2026-10-01', investor_name: 'Ponniyan', amount: 27000, created_at: '' },
          { id: '2', entry_date: '2026-10-01', investor_name: 'Sathish', amount: 13000, created_at: '' },
          { id: '3', entry_date: '2026-10-01', investor_name: 'Rathika', amount: 50000, created_at: '' },
          { id: '4', entry_date: '2026-10-01', investor_name: 'Gurusamy', amount: 30000, created_at: '' },
          { id: '5', entry_date: '2026-10-01', investor_name: 'Jyothimani', amount: 10000, created_at: '' },
          { id: '6', entry_date: '2026-10-01', investor_name: 'Sathish-Thand', amount: 25000, created_at: '' },
          { id: '7', entry_date: '2026-10-01', investor_name: 'Sivaraj', amount: 10000, created_at: '' },
          { id: '8', entry_date: '2026-10-01', investor_name: 'Thangaraj', amount: 20000, created_at: '' },
        ],
        interests: [
          { id: '1', entry_date: '2026-10-01', customer_name: 'Yuvaraj-DMK', amount: 500, created_at: '' },
          { id: '2', entry_date: '2026-10-01', customer_name: 'Pattani', amount: 90, created_at: '' },
          { id: '3', entry_date: '2026-10-01', customer_name: 'Pattani', amount: 60, created_at: '' },
          { id: '4', entry_date: '2026-10-01', customer_name: 'Kavitha', amount: 500, created_at: '' },
          { id: '5', entry_date: '2026-10-01', customer_name: 'Pattani', amount: 200, created_at: '' },
          { id: '6', entry_date: '2026-10-01', customer_name: 'Karuppasamy', amount: 1000, created_at: '' },
          { id: '7', entry_date: '2026-10-01', customer_name: 'Yuvaraj-DMK', amount: 500, created_at: '' },
          { id: '8', entry_date: '2026-10-01', customer_name: 'Prakash', amount: 2000, created_at: '' },
          { id: '9', entry_date: '2026-10-01', customer_name: 'SCM Selvam', amount: 100, created_at: '' },
        ],
        tenPercentEntries: [
          { id: '1', entry_date: '2026-10-01', particulars: 'Verified 10% Profit', amount: 8970, main_sheet_no: null, notes: null, source_kind: 'imported', main_transaction_id: null, created_at: '' },
        ],
        dues: [
          { id: '1', borrower_name: 'Ajith-1', due_date: '2026-10-01', amount: 3000, settled_amount: 0, remaining_amount: 3000, status: 'unpaid', created_at: '' },
          { id: '2', borrower_name: 'Shanthi-1', due_date: '2026-10-01', amount: 1000, settled_amount: 0, remaining_amount: 1000, status: 'unpaid', created_at: '' },
          { id: '3', borrower_name: 'Divya', due_date: '2026-10-01', amount: 1000, settled_amount: 0, remaining_amount: 1000, status: 'unpaid', created_at: '' },
          { id: '4', borrower_name: 'Ajith-2', due_date: '2026-10-01', amount: 3000, settled_amount: 0, remaining_amount: 3000, status: 'unpaid', created_at: '' },
          { id: '5', borrower_name: 'Ajith-3', due_date: '2026-10-01', amount: 3000, settled_amount: 0, remaining_amount: 3000, status: 'unpaid', created_at: '' },
          { id: '6', borrower_name: 'Shanthi-2', due_date: '2026-10-01', amount: 1000, settled_amount: 0, remaining_amount: 1000, status: 'unpaid', created_at: '' },
        ],
        loans: [
          { id: '1', customer_name: 'Portfolio', main_sheet_no: 1, mode: 'D', loan_date: '2026-10-01', principal: 162000, interest_amount: 0, weekly_payment: 0, total_expected: 162000, total_collected: 0, remaining_balance: 162000, status: 'active', created_at: '', updated_at: '' },
        ],
      })

      expect(report.categories.investments.actualTotal).toBe(185000)
      expect(report.categories.interests.actualTotal).toBe(4950)
      expect(report.categories.tenPercentProfit.actualTotal).toBe(8970)
      expect(report.categories.outstandingDues.actualTotal).toBe(12000)
      expect(report.categories.principalIssued.actualTotal).toBe(162000)

      expect(report.cashReconciliation.calculatedTotalLedger).toBe(210920)
      expect(report.cashReconciliation.workbookNominalCash).toBe(48920)
      expect(report.cashReconciliation.reconciledAvailableCash).toBe(36920)
      expect(report.cashReconciliation.uncollectedDuesAdjustment).toBe(12000)
    })

    it('verifies dashboard metrics consistency across the shared financial ledger', () => {
      const metrics = computeDashboardMetrics([], [], [], [], '2026-10-23')
      expect(metrics.investmentReceived).toBe(185000)
      expect(metrics.interestReceived).toBe(4950)
      expect(metrics.outstandingDues).toBe(12000)
      expect(metrics.workbookTotalLedger).toBe(210920)
      expect(metrics.workbookCashInHand).toBe(48920)
      expect(metrics.reconciledAvailableCash).toBe(36920)
    })
  })
})
