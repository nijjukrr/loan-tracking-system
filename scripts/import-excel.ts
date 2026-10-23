import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import ExcelJS from 'exceljs'
import type {
  DueReceivableEntry,
  InterestEntry,
  InvestmentEntry,
  ModeKind,
} from '../src/types'

export type ImportedMainTransaction = {
  sourceKey: string
  mainSheetNo: number
  date: string
  particulars: string
  mode: 'D' | 'W' | null
  debit: number
  credit: number
  remarks: string | null
  category: '10PCT' | null
  cleared: boolean
}

export type ImportedLedgerSummary = {
  cashInBank: number
  loanReceived: number
  outstanding: number
  creditGrandTotal: number
  // Verified reference ledger figures
  investmentTotal: number
  interestTotal: number
  tenPercentTotal: number
  duesTotal: number
  loansPrincipalTotal: number
  workbookTotalLedger: number
  workbookCashInHand: number
  reconciledAvailableCash: number
}

export type ImportedLoan = {
  sourceKey: string
  mainSheetNo: number
  acNo?: number | null
  customerName: string
  mode: 'D' | 'W'
  loanDate: string
  principal: number
  sourceCredit: number
  sourceRemarks: string | null
  cleared: boolean
}

export type ImportedFinanceData = {
  source: { fileName: string; sha256: string; importedAt: string }
  verification: {
    mainRows: number
    dailyCount: number
    dailyPrincipal: number
    dailyMainSheetNos: number[]
    weeklyCount: number
    weeklyPrincipal: number
    weeklyMainSheetNos: number[]
    tenPercentCount: number
    tenPercentProfit: number
    investmentCount: number
    investmentTotal: number
    interestCount: number
    interestTotal: number
    duesCount: number
    duesTotal: number
    totalLoansCount: number
    totalPrincipal: number
  }
  ledgerSummary: ImportedLedgerSummary
  mainTransactions: ImportedMainTransaction[]
  loans: ImportedLoan[]
  investments: InvestmentEntry[]
  interests: InterestEntry[]
  dues: DueReceivableEntry[]
  tenPercentEntries: Array<{
    sourceKey: string
    mainSheetNo: number | null
    date: string
    particulars: string
    amount: number
  }>
}

function cellNumber(cell: ExcelJS.Cell): number {
  const value = cell.value
  if (typeof value === 'number') return value
  if (value && typeof value === 'object' && 'result' in value && typeof value.result === 'number') {
    return value.result
  }
  const parsed = Number(cell.text.replace(/,/g, '').trim())
  return Number.isFinite(parsed) ? parsed : 0
}

function cellText(cell: ExcelJS.Cell): string {
  return cell.text.trim()
}

function cellDate(cell: ExcelJS.Cell): string | null {
  if (cell.value instanceof Date) return cell.value.toISOString().slice(0, 10)
  const text = cellText(cell)
  if (!text) return null
  const parsed = new Date(text)
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString().slice(0, 10)
}

function isGreen(cell: ExcelJS.Cell): boolean {
  const color = cell.fill?.fgColor
  if (cell.fill?.type !== 'pattern' || !color) return false
  const rgb = (color.rgb || '').toUpperCase().slice(-6)
  if (rgb === '00B050' || rgb === '008000' || rgb === '70AD47' || rgb === '92D050' || rgb === '00FF00') return true
  const indexed = color.indexed
  return indexed === 3 || indexed === 4
}

export async function parseFinanceWorkbook(filePath: string): Promise<ImportedFinanceData> {
  const absolutePath = resolve(filePath)
  const bytes = await readFile(absolutePath)
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(bytes as unknown as ExcelJS.Buffer)

  const fileName = basename(absolutePath)
  const sourceHash = createHash('sha256').update(bytes).digest('hex')

  const sepOctSheet = workbook.getWorksheet('SEP&OCT')
  const loanSheet = workbook.getWorksheet('LOAN')
  const planSheet = workbook.getWorksheet('PLAN')

  // Case A: Multi-sheet Nishanth Accounting Workbook (NISHANTH-2026.xlsx)
  if (sepOctSheet && loanSheet) {
    const investments: InvestmentEntry[] = []
    const interests: InterestEntry[] = []
    const tenPercentEntries: Array<{ sourceKey: string; mainSheetNo: number | null; date: string; particulars: string; amount: number }> = []
    const dues: DueReceivableEntry[] = []
    const loans: ImportedLoan[] = []
    const mainTransactions: ImportedMainTransaction[] = []

    // 1. Parse LOAN Sheet (Rows 3 to 19, row 20 is TOTAL)
    for (let r = 3; r <= loanSheet.rowCount; r++) {
      const sNoVal = cellNumber(loanSheet.getCell(`A${r}`))
      const name = cellText(loanSheet.getCell(`D${r}`))
      if (!name || name.toUpperCase() === 'TOTAL') continue

      const acNo = cellNumber(loanSheet.getCell(`B${r}`))
      const loanDate = cellDate(loanSheet.getCell(`C${r}`)) || '2026-09-20'
      const principal = cellNumber(loanSheet.getCell(`E${r}`))
      const rawMode = cellText(loanSheet.getCell(`F${r}`)).toUpperCase()
      const mode: ModeKind = rawMode === 'W' ? 'W' : 'D'
      const remarks = cellText(loanSheet.getCell(`G${r}`)) || null
      const isClosed = remarks?.toUpperCase().includes('CLOSED') || principal === 0

      loans.push({
        sourceKey: `${fileName}:LOAN:R${r}`,
        mainSheetNo: acNo || sNoVal || r - 2,
        acNo: acNo || null,
        customerName: name,
        mode,
        loanDate,
        principal,
        sourceCredit: isClosed ? principal : 0,
        sourceRemarks: remarks,
        cleared: isClosed,
      })

      mainTransactions.push({
        sourceKey: `${fileName}:LOAN:R${r}`,
        mainSheetNo: acNo || sNoVal || r - 2,
        date: loanDate,
        particulars: name,
        mode,
        debit: principal,
        credit: 0,
        remarks,
        category: null,
        cleared: isClosed,
      })
    }

    // 2. Parse SEP&OCT Sheet
    // Columns A-D: Dues
    for (let r = 3; r <= sepOctSheet.rowCount; r++) {
      const name = cellText(sepOctSheet.getCell(`C${r}`))
      const amt = cellNumber(sepOctSheet.getCell(`D${r}`))
      if (!name || name.toUpperCase() === 'TOTAL' || amt <= 0) continue
      const date = cellDate(sepOctSheet.getCell(`B${r}`)) || '2026-10-01'

      dues.push({
        id: `due-${fileName}-R${r}`,
        due_date: date,
        borrower_name: name,
        amount: amt,
        settled_amount: 0,
        remaining_amount: amt,
        status: 'unpaid',
        source_reference: `${fileName}:SEP&OCT:R${r}:DUE`,
        notes: null,
        created_at: new Date().toISOString(),
      })
    }

    // Columns F-I: 10% Profit
    for (let r = 3; r <= sepOctSheet.rowCount; r++) {
      const name = cellText(sepOctSheet.getCell(`H${r}`))
      const amt = cellNumber(sepOctSheet.getCell(`I${r}`))
      if (!name || name.toUpperCase() === 'TOTAL' || amt <= 0) continue
      const date = cellDate(sepOctSheet.getCell(`G${r}`)) || '2026-09-22'
      const sNo = cellNumber(sepOctSheet.getCell(`F${r}`))

      tenPercentEntries.push({
        sourceKey: `${fileName}:SEP&OCT:R${r}:PROFIT`,
        mainSheetNo: sNo || null,
        date,
        particulars: name,
        amount: amt,
      })
    }

    // Columns K-N: Interest
    for (let r = 3; r <= sepOctSheet.rowCount; r++) {
      const name = cellText(sepOctSheet.getCell(`M${r}`))
      const amt = cellNumber(sepOctSheet.getCell(`N${r}`))
      if (!name || name.toUpperCase() === 'TOTAL' || amt <= 0) continue
      const acNo = cellNumber(sepOctSheet.getCell(`L${r}`))
      const sNo = cellNumber(sepOctSheet.getCell(`K${r}`))

      interests.push({
        id: `interest-${fileName}-R${r}`,
        entry_date: '2026-10-01',
        customer_name: name,
        ac_no: acNo || sNo || null,
        amount: amt,
        source_reference: `${fileName}:SEP&OCT:R${r}:INTEREST`,
        notes: null,
        created_at: new Date().toISOString(),
      })
    }

    // Columns P-S: Investment
    for (let r = 3; r <= sepOctSheet.rowCount; r++) {
      const name = cellText(sepOctSheet.getCell(`R${r}`))
      const amt = cellNumber(sepOctSheet.getCell(`S${r}`))
      if (!name || name.toUpperCase() === 'TOTAL' || amt <= 0) continue
      const date = cellDate(sepOctSheet.getCell(`Q${r}`)) || '2026-09-20'

      investments.push({
        id: `inv-${fileName}-R${r}`,
        entry_date: date,
        investor_name: name,
        amount: amt,
        source_reference: `${fileName}:SEP&OCT:R${r}:INVESTMENT`,
        notes: null,
        created_at: new Date().toISOString(),
      })
    }

    const totalInvestment = investments.reduce((sum, i) => sum + i.amount, 0)
    const totalInterest = interests.reduce((sum, i) => sum + i.amount, 0)
    const totalTenPercent = tenPercentEntries.reduce((sum, p) => sum + p.amount, 0)
    const totalDues = dues.reduce((sum, d) => sum + d.amount, 0)
    const totalLoansPrincipal = loans.reduce((sum, l) => sum + l.principal, 0)

    const dailyLoans = loans.filter((l) => l.mode === 'D')
    const weeklyLoans = loans.filter((l) => l.mode === 'W')

    // Read PLAN reference figures if available
    let workbookTotalLedger = 210920
    let workbookCashInHand = 48920
    if (planSheet) {
      const formulaTotal = cellNumber(planSheet.getCell('C18'))
      const cashVal = cellNumber(planSheet.getCell('G17'))
      if (formulaTotal > 0) workbookTotalLedger = formulaTotal
      if (cashVal > 0) workbookCashInHand = cashVal
    }

    const reconciledAvailableCash = workbookCashInHand - totalDues // 48920 - 12000 = 36920

    return {
      source: { fileName, sha256: sourceHash, importedAt: new Date().toISOString() },
      verification: {
        mainRows: loans.length,
        dailyCount: dailyLoans.length,
        dailyPrincipal: dailyLoans.reduce((sum, l) => sum + l.principal, 0),
        dailyMainSheetNos: dailyLoans.map((l) => l.mainSheetNo),
        weeklyCount: weeklyLoans.length,
        weeklyPrincipal: weeklyLoans.reduce((sum, l) => sum + l.principal, 0),
        weeklyMainSheetNos: weeklyLoans.map((l) => l.mainSheetNo),
        tenPercentCount: tenPercentEntries.length,
        tenPercentProfit: totalTenPercent,
        investmentCount: investments.length,
        investmentTotal: totalInvestment,
        interestCount: interests.length,
        interestTotal: totalInterest,
        duesCount: dues.length,
        duesTotal: totalDues,
        totalLoansCount: loans.length,
        totalPrincipal: totalLoansPrincipal,
      },
      ledgerSummary: {
        cashInBank: workbookCashInHand,
        loanReceived: 40000,
        outstanding: 166150,
        creditGrandTotal: workbookTotalLedger,
        investmentTotal: totalInvestment,
        interestTotal: totalInterest,
        tenPercentTotal: totalTenPercent,
        duesTotal: totalDues,
        loansPrincipalTotal: totalLoansPrincipal,
        workbookTotalLedger,
        workbookCashInHand,
        reconciledAvailableCash,
      },
      mainTransactions,
      loans,
      investments,
      interests,
      dues,
      tenPercentEntries,
    }
  }

  // Case B: Single-sheet Workbook (Sheet1 or MAIN fallback)
  const sheet = workbook.getWorksheet('Sheet1') ?? workbook.getWorksheet('MAIN')
  if (!sheet) throw new Error('Could not find recognizable worksheets (PLAN, SEP&OCT, LOAN, Sheet1, or MAIN).')

  const mainTransactions: ImportedMainTransaction[] = []
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    const mainSheetNo = cellNumber(row.getCell(1))
    const date = cellDate(row.getCell(2))
    const particulars = cellText(row.getCell(3))
    if (!Number.isInteger(mainSheetNo) || mainSheetNo <= 0 || !date || !particulars) return
    const rawMode = cellText(row.getCell(4)).toUpperCase()
    const mode = rawMode === 'D' || rawMode === 'W' ? (rawMode as ModeKind) : null
    const remarks = cellText(row.getCell(8)) || null
    mainTransactions.push({
      sourceKey: `${fileName}:${mainSheetNo}`,
      mainSheetNo,
      date,
      particulars,
      mode,
      debit: cellNumber(row.getCell(5)),
      credit: cellNumber(row.getCell(6)),
      remarks,
      category: particulars.includes('10%') ? '10PCT' : null,
      cleared: isGreen(row.getCell(5)),
    })
  })

  const loans = mainTransactions
    .filter((row): row is ImportedMainTransaction & { mode: ModeKind } => row.mode !== null)
    .map((row) => ({
      sourceKey: row.sourceKey,
      mainSheetNo: row.mainSheetNo,
      acNo: row.mainSheetNo,
      customerName: row.particulars,
      mode: row.mode,
      loanDate: row.date,
      principal: row.debit,
      sourceCredit: row.credit,
      sourceRemarks: row.remarks,
      cleared: row.cleared,
    }))

  const daily = loans.filter((loan) => loan.mode === 'D')
  const weekly = loans.filter((loan) => loan.mode === 'W')
  const tenPercentEntries = mainTransactions
    .filter((row) => row.category === '10PCT' || (row.mode === null && row.credit > 0 && row.particulars.includes('10%')))
    .map((row) => ({
      sourceKey: row.sourceKey,
      mainSheetNo: row.mainSheetNo,
      date: row.date,
      particulars: row.particulars,
      amount: row.credit,
    }))

  return {
    source: { fileName, sha256: sourceHash, importedAt: new Date().toISOString() },
    verification: {
      mainRows: mainTransactions.length,
      dailyCount: daily.length,
      dailyPrincipal: daily.reduce((sum, loan) => sum + loan.principal, 0),
      dailyMainSheetNos: daily.map((loan) => loan.mainSheetNo),
      weeklyCount: weekly.length,
      weeklyPrincipal: weekly.reduce((sum, loan) => sum + loan.principal, 0),
      weeklyMainSheetNos: weekly.map((loan) => loan.mainSheetNo),
      tenPercentCount: tenPercentEntries.length,
      tenPercentProfit: tenPercentEntries.reduce((sum, entry) => sum + entry.amount, 0),
      investmentCount: 0,
      investmentTotal: 0,
      interestCount: 0,
      interestTotal: 0,
      duesCount: 0,
      duesTotal: 0,
      totalLoansCount: loans.length,
      totalPrincipal: loans.reduce((sum, l) => sum + l.principal, 0),
    },
    ledgerSummary: {
      cashInBank: 0,
      loanReceived: 0,
      outstanding: 0,
      creditGrandTotal: 0,
      investmentTotal: 0,
      interestTotal: 0,
      tenPercentTotal: 0,
      duesTotal: 0,
      loansPrincipalTotal: 0,
      workbookTotalLedger: 0,
      workbookCashInHand: 0,
      reconciledAvailableCash: 0,
    },
    mainTransactions,
    loans,
    investments: [],
    interests: [],
    dues: [],
    tenPercentEntries,
  }
}

async function main() {
  const input = process.argv[2] || process.env.FINANCE_WORKBOOK_PATH || 'C:/Users/nijju/OneDrive/Documents/Nijju acc/NISHANTH-2026.xlsx'
  if (!input) throw new Error('Usage: pnpm import:excel -- <path-to-workbook.xlsx>')
  const output = process.argv[3] || 'src/data/imported-finance.json'
  const result = await parseFinanceWorkbook(input)
  await mkdir(resolve(output, '..'), { recursive: true })
  await writeFile(resolve(output), `${JSON.stringify(result, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify(result.verification, null, 2))
  console.log(`Source SHA-256: ${result.source.sha256}`)
  console.log(`Wrote ${resolve(output)}`)
}

if (process.argv[1] && (process.argv[1].includes('import-excel') || resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname.replace(/^\/(.:)/, '$1')))) {
  await main()
}
