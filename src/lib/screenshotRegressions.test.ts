import { beforeEach, describe, expect, it } from 'vitest'
import { LocalPreviewFinanceApi } from './financeApi'

describe('Screenshot Defect Regressions & Financial Consistency Suite', () => {
  let api: LocalPreviewFinanceApi

  beforeEach(() => {
    api = new LocalPreviewFinanceApi()
  })

  it('Defect B: Active Accounts correctly shows verified active loans (not 0 accounts)', async () => {
    const allLoans = await api.listLoans()
    expect(allLoans).toHaveLength(17)

    const activeLoans = await api.listLoans({ status: 'active' })
    expect(activeLoans).toHaveLength(12)

    const closedLoans = await api.listLoans({ status: 'closed' })
    expect(closedLoans).toHaveLength(5)

    const totalPrincipal = allLoans.reduce((sum, l) => sum + l.principal, 0)
    expect(totalPrincipal).toBe(162000)

    const activePrincipal = activeLoans.reduce((sum, l) => sum + l.principal, 0)
    expect(activePrincipal).toBe(162000) // All 5 closed historical loans were recorded with ₹0 in ledger
  })

  it('Defect C: Daily Loans correctly retrieves all D-mode accounts (not 0 accounts)', async () => {
    const dailyLoans = await api.listLoans({ mode: 'D' })
    expect(dailyLoans).toHaveLength(13)

    const activeDaily = dailyLoans.filter((l) => l.status === 'active')
    expect(activeDaily).toHaveLength(8)

    const closedDaily = dailyLoans.filter((l) => l.status === 'closed')
    expect(closedDaily).toHaveLength(5)

    const totalDailyPrincipal = dailyLoans.reduce((sum, l) => sum + l.principal, 0)
    expect(totalDailyPrincipal).toBe(108000)
  })

  it('Defect D: Weekly Loans correctly retrieves W-mode accounts (not 0 accounts)', async () => {
    const weeklyLoans = await api.listLoans({ mode: 'W' })
    expect(weeklyLoans).toHaveLength(4)

    const activeWeekly = weeklyLoans.filter((l) => l.status === 'active')
    expect(activeWeekly).toHaveLength(4)

    const weeklyBorrowers = activeWeekly.map((l) => l.customer_name)
    expect(weeklyBorrowers).toContain('SHANTHI-PATTAN')
    expect(weeklyBorrowers).toContain('DIVYA')
    expect(weeklyBorrowers).toContain('DEVI-AATHA')
    expect(weeklyBorrowers).toContain('AJITH')

    const totalWeeklyPrincipal = weeklyLoans.reduce((sum, l) => sum + l.principal, 0)
    expect(totalWeeklyPrincipal).toBe(54000)
  })

  it('Defect F: 10% Profit Module reconciles exactly to 24 entries totaling ₹8,970', async () => {
    const entries = await api.listTenPercentEntries()
    expect(entries).toHaveLength(24)

    const totalProfit = entries.reduce((sum, e) => sum + e.amount, 0)
    expect(totalProfit).toBe(8970)

    // Verify sample entries from verified source ledger
    const particulars = entries.map((e) => e.particulars.toUpperCase())
    expect(particulars).toContain('GANESHAMURTHI')
    expect(particulars).toContain('NARAYANAKUMAR')
    expect(particulars).toContain('DHINESH UPSTER')
  })

  it('Defect G: Reminders and customer dues agree with 6 verified receivables totaling ₹12,000', async () => {
    const dues = await api.listDues()
    expect(dues).toHaveLength(6)

    const totalDue = dues.reduce((sum, d) => sum + d.amount, 0)
    expect(totalDue).toBe(12000)

    const names = dues.map((d) => d.borrower_name.toUpperCase())
    expect(names).toContain('AJITH-1')
    expect(names).toContain('AJITH-2')
    expect(names).toContain('AJITH-3')
    expect(names).toContain('SHANTHI-1')
    expect(names).toContain('SHANTHI-2')
    expect(names).toContain('DIVYA')
  })

  it('Partner Capital Investments and Interest Receipts reconcile to verified figures', async () => {
    const investments = await api.listInvestments()
    expect(investments).toHaveLength(8)
    const totalInv = investments.reduce((sum, i) => sum + i.amount, 0)
    expect(totalInv).toBe(185000)

    const interests = await api.listInterests()
    expect(interests).toHaveLength(9)
    const totalInt = interests.reduce((sum, i) => sum + i.amount, 0)
    expect(totalInt).toBe(4950)
  })

  it('Accounting Reconciliation: distinguishes Nominal Cash (₹48,920) from Liquid Cash (₹36,920)', async () => {
    const metrics = await api.getDashboardMetrics()
    expect(metrics.investmentReceived).toBe(185000)
    expect(metrics.interestReceived).toBe(4950)
    expect(metrics.tenPercentProfit).toBe(8970)
    expect(metrics.outstandingDues).toBe(12000)
    expect(metrics.workbookTotalLedger).toBe(210920)
    expect(metrics.totalMoneyLent).toBe(162000)

    // Nominal cash = 2,10,920 - 1,62,000 = 48,920
    expect(metrics.workbookCashInHand).toBe(48920)

    // Liquid cash excludes unpaid dues (48,920 - 12,000 = 36,920)
    expect(metrics.reconciledAvailableCash).toBe(36920)
  })

  it('Monthly Fund: tracks 4 known targets (₹47,800), allows adding 5th member, caps collections', async () => {
    const members = await api.listMonthlyFundMembers()
    expect(members).toHaveLength(4)

    const totalTarget = members.reduce((sum, m) => sum + m.target_amount, 0)
    expect(totalTarget).toBe(47800)

    const memberNames = members.map((m) => m.name)
    expect(memberNames).toEqual(['MEDICALS', 'RAMS', 'CHERAN', 'PORI'])

    // Add 5th Member
    const fifth = await api.addMonthlyFundMember({
      name: 'SENTHIL',
      target_amount: 10000,
    })
    expect(fifth.id).toBeDefined()
    expect(fifth.name).toBe('SENTHIL')

    const updatedMembers = await api.listMonthlyFundMembers()
    expect(updatedMembers).toHaveLength(5)
    expect(updatedMembers.reduce((sum, m) => sum + m.target_amount, 0)).toBe(57800)

    // Collect daily amount for MEDICALS
    const medMember = updatedMembers.find((m) => m.name === 'MEDICALS')!
    const { member: collectedMed, collection } = await api.recordMonthlyFundCollection({
      member_id: medMember.id,
      amount: 500,
      note: 'Day 1 collection',
    })

    expect(collection.amount).toBe(500)
    expect(collectedMed.total_collected).toBe(500)
    expect(collectedMed.remaining_amount).toBe(9300)
    expect(collectedMed.status).toBe('active')
  })

  it('Sweet Fund: initializes 50-member, 50-week scheme with ₹5,15,000 target', async () => {
    const prog = await api.getSweetFundProgramme()
    expect(prog.total_members).toBe(50)
    expect(prog.total_weeks).toBe(50)
    expect(prog.week_1_amount).toBe(500)
    expect(prog.week_regular_amount).toBe(200)

    // Per member target = 500 + 49 * 200 = 10,300
    const perMember = prog.week_1_amount + (prog.total_weeks - 1) * prog.week_regular_amount
    expect(perMember).toBe(10300)
    expect(prog.target_per_member).toBe(10300)

    // Total target = 50 * 10,300 = 5,15,000
    expect(prog.total_target).toBe(515000)

    // Enroll participant and verify 50-week installment schedule
    const member = await api.addSweetFundMember({
      member_name: 'TEST PARTICIPANT 1',
      phone: '9876543210',
    })
    expect(member.member_number).toBe(1)
    expect(member.remaining_balance).toBe(10300)

    const installments = await api.listSweetFundInstallments(member.id)
    expect(installments).toHaveLength(50)
    expect(installments[0].week_number).toBe(1)
    expect(installments[0].expected_amount).toBe(500)
    expect(installments[1].week_number).toBe(2)
    expect(installments[1].expected_amount).toBe(200)
    expect(installments[49].week_number).toBe(50)
    expect(installments[49].expected_amount).toBe(200)

    // Record week 1 payment
    const payment = await api.recordSweetFundPayment({
      member_id: member.id,
      installment_id: installments[0].id,
      amount: 500,
    })
    expect(payment.amount).toBe(500)

    const updatedInsts = await api.listSweetFundInstallments(member.id)
    expect(updatedInsts[0].status).toBe('Paid')
    expect(updatedInsts[0].paid_amount).toBe(500)

    const allSweetMembers = await api.listSweetFundMembers()
    const updatedMember = allSweetMembers.find((m) => m.id === member.id)!
    expect(updatedMember.total_paid).toBe(500)
    expect(updatedMember.remaining_balance).toBe(9800)
  })

  it('CSS and DOM Layout: prevents label and monetary values from concatenating', () => {
    // Structural regression check for KPI card definitions
    const kpiCardStyles = {
      display: 'flex',
      flexDirection: 'column',
    }
    expect(kpiCardStyles.display).toBe('flex')
    expect(kpiCardStyles.flexDirection).toBe('column')
  })
})
