# Nijju Finance Tracker — Production Repair & Verification Report

**Application:** Nijju Finance Tracker  
**Target Repository:** `https://github.com/nijjukrr/loan-tracking-system`  
**Architecture:** React 19, TypeScript, Vite, Supabase / Unified Local Preview Repository  
**Source Workbook:** `NISHANTH-2026.xlsx` (Sheets: `PLAN`, `SEP&OCT`, `LOAN`)  
**Status:** Repaired, Fully Verified, All 16 Test Suites (78 Tests) Passing  

---

## 1. Executive Summary of Root Causes and Architectural Repairs

### A. Dashboard Metrics Layout Collapse (Screenshot 4)
* **Root Cause:** `.kpi-card` and `.kpi-grid` lacked foundational CSS rule definitions in `src/App.css`. Because child metrics and labels were wrapped in generic `<span>` and `<a>` inline elements without flexbox or grid layouts, the browser collapsed them into continuous inline text strings without margins or visual containers.
* **Repair:** Created a standardized design system in `src/App.css` enforcing CSS Grid (`.kpi-grid`) and Flex column containers (`.kpi-card`) with dedicated sub-elements (`.kpi-label`, `.kpi-value`, `.kpi-subtext`), tab-isolated numbers (`font-variant-numeric: tabular-nums`), responsive breakpoints, and strict padding boundaries.

### B. Operational Screens Showing Zero Accounts (Screenshots 1, 2, 3)
* **Root Cause 1 (`VITE_LOCAL_ONLY` flag):** `src/lib/financeApi.ts` previously evaluated `const localOnly = env.VITE_LOCAL_ONLY === 'true'`, and if true, explicitly evaluated `rawLoans: localOnly ? [] : ...`, intentionally zeroing out all 17 imported loans whenever local mode was active.
* **Root Cause 2 (Empty Stubs in JSON):** `src/data/imported-finance.json` had empty stubs `[]` for `loans`, `investments`, `interests`, and `dues`.
* **Root Cause 3 (Stale LocalStorage Cache):** The browser's localStorage cache retained empty arrays from earlier runs under old cache keys (`v1`–`v5`).
* **Repair:** 
  1. Extracted and normalized authoritative records directly from `NISHANTH-2026.xlsx` via `scripts/export-extraction-package.ts`.
  2. Fully populated `src/data/imported-finance.json` with all 17 loans, 8 capital investments, 9 interest receipts, 24 10% profit entries, and 6 customer dues.
  3. Bumped the localStorage key to `v6`, added `purgeLegacyStores()`, and implemented fallback initialization to load verified records on initial startup while honoring explicit empty sets on user data resets.

### C. Mode Classification Misalignment (Daily vs Weekly Loans)
* **Root Cause:** Mode filtering in `DailyPage.tsx` and `WeeklyPage.tsx` did not handle case normalization (`D` vs `W`), leading to empty lists or missing accounts.
* **Repair:** Unified queries in `financeApi.ts` to enforce strict mode matching, returning 13 Daily loans (8 active, 5 closed) and 4 Weekly loans (4 active, 0 closed), totaling 12 active accounts and ₹1,62,000 principal.

### D. Empty Payment Ledger
* **Root Cause:** The original Excel workbook contains **zero payment collection vouchers**; the `sourceCredit` column recorded loan settlement status rather than separate cash receipt transactions.
* **Repair:** Replaced misleading zero counts with an honest empty-state UI in `PaymentsPage.tsx` explaining that individual collection vouchers have not yet been imported, while preserving the capability to record atomic payment receipts against any active installment.

### E. Discrepancy Between 10% Profit Page and Reports
* **Root Cause:** `TenPercentPage.tsx` maintained an independent state that queried empty manual entries rather than shared verified imported records.
* **Repair:** Rebuilt `TenPercentPage.tsx` to read directly from `financeApi.listTenPercentEntries()`, reconciling to all 24 verified transactions totaling **₹8,970**.

### F. Reminders vs Reports Customer Dues
* **Root Cause:** Dues receivables from the `SEP&OCT` sheet were isolated in reporting and not connected to operational reminder queries.
* **Repair:** Wired `RemindersPage.tsx` to `financeApi.listDues()`, restoring all 6 verified dues totaling **₹12,000** with partial settlement workflows.

---

## 2. Authoritative Financial Ledgers & Reconciliation Breakdown

| Category | Reference Target | Verified Records | Detail Sum | Reconciliation Status |
| :--- | :--- | :--- | :--- | :--- |
| **Partner Capital Investment** | ₹1,85,000 | 8 entries | ₹1,85,000 | **100% Reconciled (0 Variance)** |
| **Interest Inflow Received** | ₹4,950 | 9 receipts | ₹4,950 | **100% Reconciled (0 Variance)** |
| **10% Profit Received** | ₹8,970 | 24 entries | ₹8,970 | **100% Reconciled (0 Variance)** |
| **Outstanding Customer Dues** | ₹12,000 | 6 receivables | ₹12,000 | **100% Reconciled (0 Variance)** |
| **Loan Principal Disbursed** | ₹1,62,000 | 17 accounts | ₹1,62,000 | **100% Reconciled (0 Variance)** |
| **Summary Ledger Total** | ₹2,10,920 | Formula Target | ₹2,10,920 | **100% Reconciled (0 Variance)** |
| **Source Reported Nominal Cash** | ₹48,920 | Formula Target | ₹48,920 | **100% Reconciled (0 Variance)** |
| **Reconciled Liquid Available Cash** | ₹36,920 | Cash Balance | ₹36,920 | **Excludes ₹12,000 unpaid dues** |

---

## 3. Dedicated Fund Modules Implementation

### Monthly Fund Programme (`/funds/monthly`)
- **Initial Target Members (4 Specified):**
  - **MEDICALS:** Target ₹9,800
  - **RAMS:** Target ₹9,500
  - **CHERAN:** Target ₹19,000
  - **PORI:** Target ₹9,500
  - **Initial Target Total:** **₹47,800**
- **5th Member Provision:** Built-in form allows adding the 5th member with custom name and target when provided without fabricating placeholder names.
- **Daily Collections:** Quick buttons for ₹300, ₹500, or exact remaining balance, plus custom amount input.
- **Capped Collection Logic:** Automatically marks member as "Completed" and disables further collections once target is reached.
- **Accounting Isolation:** Kept completely separate from lending profit and loan repayments.

### Sweet Fund Programme (`/funds/sweet`)
- **Target Parameters:** Configured for 50 participants across 50 contribution weeks.
- **Contribution Schedule:**
  - Week 1: ₹500
  - Weeks 2–50: ₹200/week
  - Target per member: ₹500 + (49 × ₹200) = **₹10,300**
  - Total Planned Target for 50 members: **₹5,15,000**
- **Diwali Deadline Reconciliation:** Compares 50-week projected completion against configured Diwali date (2027-10-29) and flags variance notice without artificially altering weekly payments.
- **Excel/CSV Importer:** Ready with pre-validation and preview table to import participant roster once external workbook is received.

---

## 4. Extraction Package Artifacts Generated

All 10 extracted artifacts are located in `finance-extraction-output/`:
1. `finance_import_package.json`: Complete canonical JSON import package.
2. `finance_raw_extract.csv`: Raw cell-by-cell export with source coordinates.
3. `finance_unclassified_rows.csv`: Traceability log for zero-amount closure rows.
4. `finance_reconciliation_report.md`: Markdown audit report.
5. `finance_investments.json`: 8 investment records (₹1,85,000).
6. `finance_interest.json`: 9 interest receipts (₹4,950).
7. `finance_profit.json`: 24 10% profit entries (₹8,970).
8. `finance_dues.json`: 6 receivables entries (₹12,000).
9. `finance_loans.json`: 17 historical loan ledger accounts (₹1,62,000).
10. `finance_payments.json`: Empty dataset honestly documenting absence of payment vouchers.

---

## 5. Verification Results

```
> oxlint
Found 0 warnings and 0 errors.
Finished in 42ms on 52 files with 114 rules using 12 threads.

> vitest run
Test Files  16 passed (16)
Tests       78 passed (78)
Duration    16.31s

> tsc -b && vite build
✓ 95 modules transformed.
dist/index.html                   0.47 kB │ gzip:   0.30 kB
dist/assets/index-1ak5fZ9Q.css   18.84 kB │ gzip:   4.59 kB
dist/assets/index-BGvV4o2P.js   727.61 kB │ gzip: 183.25 kB
✓ built in 228ms
```
