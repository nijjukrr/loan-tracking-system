# Nijju Finance Tracker — Data and UI Defect Investigation & Root Cause Analysis

## Executive Summary
This document records the forensic investigation into the defects visible in the application screenshots, cross-references them against `NISHANTH-2026.xlsx`, and documents the proven root causes across the data architecture, state synchronization, and CSS layout system.

---

## 1. Defect Inventory from Screenshots

### Defect A: Dashboard Metric Card Text Collapse (Screenshot 4)
- **Visible Symptom**: In the Executive Finance Dashboard, the primary KPI metrics run together in plain text with no margins or visual containers:
  `Investments Received₹1,85,0008 partner capital credits (₹1.85L)Principal Disbursed₹1,62,00017 loan accounts ledgered (₹1.62L)Interest Received₹4,9509 receipts verified (₹4,950)...`
- **Root Cause**: In `src/App.css`, class `.kpi-card.highlight-card`, `.accent-card`, etc., were defined with `border-left`, but the base classes `.kpi-grid`, `.kpi-card`, `.kpi-label`, `.kpi-value`, and `.kpi-subtext` were completely missing. Because `DashboardPage.tsx` rendered them as `<Link to="..." className="kpi-card">`, and `<a>` elements default to `display: inline`, the cards rendered inline with no background, border, padding, or flex/grid separation.

### Defect B: Active Accounts, Daily Loans, and Weekly Loans Display 0 (Screenshots 2 & 3)
- **Visible Symptom**:
  - Daily Loans page shows "Daily Accounts (0)", "Money Given ₹0", "Money Collected ₹0".
  - Weekly Loans page shows "Weekly Accounts (0)", "Money Given ₹0", "Money Collected ₹0".
  - Active Accounts page shows 0 accounts.
  - Yet Reports & Exports displays 17 historical loan ledger rows totaling ₹1,62,000.
- **Root Cause**:
  1. `src/data/imported-finance.json` was previously emptied to `{ "loans": [], "mainTransactions": [] }`.
  2. In `src/lib/financeApi.ts`, `buildInitialData()` reads `importedData.loans`. Because the JSON had `[]`, it generated 0 loans and 0 installments.
  3. `getLocalStore()` cached this `[]` under `localStorage` key `'finance-tracker-loans-v5'`. Because `[]` is valid JSON, subsequent page reloads parsed `[]` and never populated the operational screens.
  4. In contrast, `ReportsPage.tsx` and reconciliation utilities read directly from the static schema or independent targets, causing a complete split between reports and operational screens.

### Defect C: 10% Profit, Investments, Interest, and Reminders Discrepancies
- **Visible Symptom**:
  - 10% Profit dedicated page showed ₹0 and 0 entries, while Reports & Exports showed 24 verified profit entries totaling ₹8,970.
  - Reminders page showed 0 dues, while Reports & Exports listed 6 customer dues totaling ₹12,000.
- **Root Cause**:
  - `buildInitialData()` in `src/lib/financeApi.ts` did not initialize `investments`, `interests`, or `dues` from `importedData`.
  - `getLocalStore()` called `safeParse(STORAGE_KEY_INVESTMENTS, [])` with an empty array fallback rather than the imported dataset baseline.
  - Without stored data, `listTenPercentEntries()`, `listInvestments()`, `listInterests()`, and `listDues()` all returned empty arrays.

### Defect D: Missing Fund Modules
- **Visible Symptom**:
  - The navigation sidebar lacked dedicated interfaces for the **Monthly Fund** (specified targets ₹47,800 across 4 known members) and the **Sweet Fund** (50 members, 50 weeks, ₹5,15,000 target).
- **Root Cause**:
  - Routes and components for Monthly Fund and Sweet Fund had not been integrated into `App.tsx` and `AppLayout.tsx`.

---

## 2. Workbook Source-of-Truth Verification (`NISHANTH-2026.xlsx`)

The authoritative workbook `NISHANTH-2026.xlsx` was inspected directly using `ExcelJS`.
The verified figures are:

| Financial Category | Source Sheet & Columns | Verified Entry Count | Verified Total Amount |
| :--- | :--- | :--- | :--- |
| **Partner Capital Investment** | `SEP&OCT` (Cols P–S) | 8 entries | ₹1,85,000 |
| **Interest Inflow Received** | `SEP&OCT` (Cols K–N) | 9 entries | ₹4,950 |
| **10% Profit Entries** | `SEP&OCT` (Cols F–I) | 24 entries | ₹8,970 |
| **Outstanding Customer Dues** | `SEP&OCT` (Cols A–D) | 6 entries | ₹12,000 |
| **Loan Principal Disbursed** | `LOAN` (Cols A–G) | 17 ledger rows (12 active, 5 closed) | ₹1,62,000 |
| **Summary Ledger Total** | `PLAN` (Cell C18) | — | ₹2,10,920 |
| **Reported Cash/Bank** | `PLAN` (Cell G17) | — | ₹48,920 |
| **Reconciled Liquid Cash** | Cash minus ₹12k dues | — | ₹36,920 |

### Daily vs Weekly Loan Classification
In sheet `LOAN`:
- **Daily Loans (Mode 'D')**: 13 ledger rows (Principal ₹1,08,000). 11 active, 2 closed.
- **Weekly Loans (Mode 'W')**: 4 ledger rows (Principal ₹54,000). 1 active (Kannan A/C 4 ₹30,000), 3 closed.
- **Total Ledger Rows**: 17 rows, ₹1,62,000 principal.

---

## 3. Systematic Architecture & UI Repair Plan

1. **Extraction Package**: Run a comprehensive extraction on `NISHANTH-2026.xlsx` into `finance-extraction-output/` with full provenance, CSV extracts, and reconciliation reports.
2. **Unified Data Layer (`financeApi.ts`)**:
   - Restore all 17 loans, 8 investments, 9 interests, 24 profit entries, and 6 dues into `imported-finance.json`.
   - Update `buildInitialData()` to initialize all financial categories from `importedData`.
   - Bump the local storage key to `v6` and ensure auto-hydration if any store is missing or empty.
   - Guarantee that operational pages (`DailyPage`, `WeeklyPage`, `ActiveAccountsPage`, `TenPercentPage`, `RemindersPage`, `InvestmentsPage`, `InterestPage`) all read from the same unified repository.
3. **CSS Design System Repairs (`App.css`)**:
   - Define `.kpi-grid` with CSS Grid: `display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem;`.
   - Define `.kpi-card` with `display: flex; flex-direction: column; padding: 1.25rem; border-radius: var(--radius); background: var(--surface); border: 1px solid var(--line);`.
   - Define `.kpi-label` (block, uppercase eyebrow, muted), `.kpi-value` (block, 1.5rem, bold, tabular numerals), and `.kpi-subtext` (block, 0.75rem, muted).
4. **Fund Modules Implementation**:
   - Create `MonthlyFundPage.tsx` with member management, daily collections (₹300/₹500/custom), progress tracking, and audit logging.
   - Create `SweetFundPage.tsx` with 50-member schedule generator, Diwali target deadline calculation, partial collections, and workbook import preparation.
5. **Automated Regression Suite**:
   - Unit and integration tests covering the screenshot bugs, ensuring loans, dues, and profit agree across operational and report pages.
