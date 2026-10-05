import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import ExcelJS from 'exceljs'

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
}

export type ImportedLoan = {
  sourceKey: string
  mainSheetNo: number
  customerName: string
  mode: 'D' | 'W'
  loanDate: string
  principal: number
  sourceCredit: number
  sourceRemarks: string | null
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
  }
  mainTransactions: ImportedMainTransaction[]
  loans: ImportedLoan[]
  tenPercentEntries: Array<{
    sourceKey: string
    mainSheetNo: number
    date: string
    particulars: string
    amount: number
  }>
}

function cellNumber(cell: ExcelJS.Cell): number {
  const value = cell.value
  if (typeof value === 'number') return value
  if (value && typeof value === 'object' && 'result' in value && typeof value.result === 'number') return value.result
  const parsed = Number(cell.text.replace(/,/g, ''))
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

export async function parseFinanceWorkbook(filePath: string): Promise<ImportedFinanceData> {
  const absolutePath = resolve(filePath)
  const bytes = await readFile(absolutePath)
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(bytes as unknown as ExcelJS.Buffer)
  const sheet = workbook.getWorksheet('MAIN') ?? workbook.getWorksheet('Sheet1')
  if (!sheet) throw new Error('Could not find a MAIN or Sheet1 worksheet.')

  const fileName = basename(absolutePath)
  const sourceHash = createHash('sha256').update(bytes).digest('hex')
  const mainTransactions: ImportedMainTransaction[] = []

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    const mainSheetNo = cellNumber(row.getCell(1))
    const date = cellDate(row.getCell(2))
    const particulars = cellText(row.getCell(3))
    if (!Number.isInteger(mainSheetNo) || mainSheetNo <= 0 || !date || !particulars) return
    const rawMode = cellText(row.getCell(4)).toUpperCase()
    const mode = rawMode === 'D' || rawMode === 'W' ? rawMode : null
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
    })
  })

  const loans = mainTransactions
    .filter((row): row is ImportedMainTransaction & { mode: 'D' | 'W' } => row.mode !== null)
    .map((row) => ({
      sourceKey: row.sourceKey,
      mainSheetNo: row.mainSheetNo,
      customerName: row.particulars,
      mode: row.mode,
      loanDate: row.date,
      principal: row.debit,
      sourceCredit: row.credit,
      sourceRemarks: row.remarks,
    }))
  const daily = loans.filter((loan) => loan.mode === 'D')
  const weekly = loans.filter((loan) => loan.mode === 'W')
  const tenPercentEntries = mainTransactions
    .filter((row) => row.category === '10PCT')
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
    },
    mainTransactions,
    loans,
    tenPercentEntries,
  }
}

async function main() {
  const input = process.argv[2] || process.env.FINANCE_WORKBOOK_PATH
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

