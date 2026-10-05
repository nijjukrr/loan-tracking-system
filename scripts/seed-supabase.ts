import { createClient } from '@supabase/supabase-js'
import importedData from '../src/data/imported-finance.json'
import {
  generateDailyInstallments,
  generateWeeklyInstallments,
  getInstallmentStatus,
  formatDateISO,
} from '../src/lib/financeLogic'

async function seedSupabase() {
  const supabaseUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL)?.trim()
  const supabaseKey = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY
  )?.trim()

  if (!supabaseUrl || !supabaseKey) {
    console.log('⚠️ Supabase environment variables not set.')
    console.log('Please set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env file.')
    console.log('Current status: App is running in local preview mode with verified Excel JSON data.')
    return
  }

  console.log(`Connecting to Supabase at: ${supabaseUrl}`)
  const supabase = createClient(supabaseUrl, supabaseKey)

  const todayStr = formatDateISO(new Date())
  const rawLoans = importedData.loans || []
  const rawMainTx = importedData.mainTransactions || []

  // 1. Seed MAIN Transactions
  console.log(`Seeding ${rawMainTx.length} MAIN transactions…`)
  for (const mt of rawMainTx) {
    const { error } = await supabase.from('main_transactions').upsert(
      {
        main_sheet_no: mt.mainSheetNo,
        transaction_date: mt.date,
        particulars: mt.particulars,
        credit: mt.credit,
        category: mt.category,
      },
      { onConflict: 'main_sheet_no' }
    )
    if (error) {
      console.warn(`Error upserting main_transaction #${mt.mainSheetNo}: ${error.message}`)
    }
  }

  // 2. Seed Customers and Loans
  console.log(`Seeding ${rawLoans.length} loans…`)
  for (const raw of rawLoans) {
    const isDaily = raw.mode === 'D'
    const principal = Number(raw.principal)
    const sourceCredit = Number(raw.sourceCredit || 0)
    const remarks = raw.sourceRemarks || ''

    let interestAmount = 0
    let weeklyPayment = 0
    let totalExpected = principal

    if (isDaily) {
      interestAmount = Math.round(principal * 0.03)
      totalExpected = principal + interestAmount * 6
    } else {
      weeklyPayment = 3000
      totalExpected = 30000
    }

    const isClosed = sourceCredit >= principal && remarks.includes('AMT RECD')
    const status = isClosed ? 'closed' : 'active'
    const totalCollected = sourceCredit

    // Insert or update customer
    const { data: customer } = await supabase
      .from('customers')
      .upsert({ name: raw.customerName }, { onConflict: 'name' })
      .select('id')
      .single()

    const customerId = customer?.id || null

    const loanPayload = {
      main_sheet_no: raw.mainSheetNo,
      customer_id: customerId,
      customer_name: raw.customerName,
      mode: raw.mode,
      loan_date: raw.loanDate,
      principal,
      interest_amount: interestAmount,
      weekly_payment: weeklyPayment,
      total_expected: totalExpected,
      total_collected: totalCollected,
      remaining_balance: Math.max(0, totalExpected - totalCollected),
      status,
      closed_at: isClosed ? raw.loanDate : null,
      source_remarks: remarks || null,
    }

    const { data: loan, error: loanErr } = await supabase
      .from('loans')
      .upsert(loanPayload, { onConflict: 'main_sheet_no' })
      .select('*')
      .single()

    if (loanErr || !loan) {
      console.warn(`Error upserting loan #${raw.mainSheetNo}: ${loanErr?.message}`)
      continue
    }

    // Seed installments
    const installmentsPayload = isDaily
      ? generateDailyInstallments(loan.id, raw.loanDate, undefined, interestAmount)
      : generateWeeklyInstallments(loan.id, raw.loanDate, undefined, weeklyPayment)

    for (const inst of installmentsPayload) {
      const currentStatus = getInstallmentStatus(
        inst.due_date,
        sourceCredit > 0 && inst.installment_number === 1 ? raw.loanDate : null,
        sourceCredit > 0 && inst.installment_number === 1 ? sourceCredit : 0,
        inst.expected_amount,
        todayStr
      )

      await supabase.from('installments').upsert(
        {
          loan_id: loan.id,
          installment_number: inst.installment_number,
          due_date: inst.due_date,
          expected_amount: inst.expected_amount,
          paid_date: sourceCredit > 0 && inst.installment_number === 1 ? raw.loanDate : null,
          paid_amount: sourceCredit > 0 && inst.installment_number === 1 ? sourceCredit : 0,
          status: currentStatus,
        },
        { onConflict: 'loan_id,installment_number' }
      )
    }

    // Seed initial payment if present
    if (sourceCredit > 0) {
      await supabase.from('payments').insert({
        loan_id: loan.id,
        customer_id: customerId,
        customer_name: raw.customerName,
        main_sheet_no: raw.mainSheetNo,
        mode: raw.mode,
        payment_date: raw.loanDate,
        amount: sourceCredit,
        payment_type: isClosed ? 'Principal' : isDaily ? 'Interest' : 'Weekly Installment',
        note: remarks || 'Imported from Excel MAIN sheet',
      })
    }
  }

  // 3. Verification Report Query
  console.log('\n--- VERIFICATION REPORT FROM SUPABASE ---')
  const { data: dbLoans } = await supabase.from('loans').select('*')
  const { data: dbMainTx } = await supabase.from('main_transactions').select('*')
  const { data: dbTenPct } = await supabase.from('ten_percent_entries').select('*')

  const dailyLoans = (dbLoans || []).filter((l) => l.mode === 'D')
  const weeklyLoans = (dbLoans || []).filter((l) => l.mode === 'W')
  const dailyPrincipal = dailyLoans.reduce((sum, l) => sum + Number(l.principal), 0)
  const weeklyPrincipal = weeklyLoans.reduce((sum, l) => sum + Number(l.principal), 0)

  console.log(`Daily Accounts: ${dailyLoans.length} (Expected: 8)`)
  console.log(`Daily Principal: ₹${dailyPrincipal.toLocaleString('en-IN')} (Expected: ₹1,25,000)`)
  console.log(`Weekly Accounts: ${weeklyLoans.length} (Expected: 1)`)
  console.log(`Weekly Principal: ₹${weeklyPrincipal.toLocaleString('en-IN')} (Expected: ₹27,000)`)
  console.log(`Total Money Lent: ₹${(dailyPrincipal + weeklyPrincipal).toLocaleString('en-IN')} (Expected: ₹1,52,000)`)
  console.log(`10% Entries: ${(dbTenPct || []).length} (Expected: 0)`)
  console.log(`MAIN Rows: ${(dbMainTx || []).length} (Expected: 29)`)
  console.log('-----------------------------------------\n')
}

seedSupabase().catch((err) => {
  console.error('Seed error:', err)
})
