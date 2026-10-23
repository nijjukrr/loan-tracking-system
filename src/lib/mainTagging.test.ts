import { describe, it, expect, beforeEach } from 'vitest'
import { LocalPreviewFinanceApi } from './financeApi'

describe('MAIN Transaction Auditable 10% Profit Tagging', () => {
  let api: LocalPreviewFinanceApi

  beforeEach(() => {
    api = new LocalPreviewFinanceApi()
  })

  it('allows tagging an untagged MAIN transaction and creates a 10% entry', async () => {
    const untaggedBefore = await api.listUntaggedMainTransactions()
    if (untaggedBefore.length === 0) {
      // If none untagged in mock data, skip gracefully
      return
    }

    const targetTx = untaggedBefore[0]
    const created = await api.tagMainTransaction(targetTx.id)

    expect(created).toBeDefined()
    expect(created.amount).toBe(targetTx.credit)
    expect(created.source_kind).toBe('main_tag')
    expect(created.main_transaction_id).toBe(targetTx.id)

    const untaggedAfter = await api.listUntaggedMainTransactions()
    expect(untaggedAfter.some((tx) => tx.id === targetTx.id)).toBe(false)
  })

  it('rejects duplicate tagging of an already tagged MAIN transaction', async () => {
    const untagged = await api.listUntaggedMainTransactions()
    if (untagged.length === 0) return

    const targetTx = untagged[0]
    await api.tagMainTransaction(targetTx.id)

    // Attempting to tag again must reject
    await expect(api.tagMainTransaction(targetTx.id)).rejects.toThrow(
      'Transaction is already tagged as 10% profit.'
    )
  })

  it('supports untagging a MAIN transaction, restoring it to the untagged pool', async () => {
    const untagged = await api.listUntaggedMainTransactions()
    if (untagged.length === 0) return

    const targetTx = untagged[0]
    const tagged = await api.tagMainTransaction(targetTx.id)

    // Untag
    await api.untagMainTransaction(targetTx.id)

    const untaggedAfter = await api.listUntaggedMainTransactions()
    expect(untaggedAfter.some((tx) => tx.id === targetTx.id)).toBe(true)

    const entries = await api.listTenPercentEntries()
    expect(entries.some((e) => e.id === tagged.id)).toBe(false)
  })

  it('resets the main transaction category when deleting a main_tag entry', async () => {
    const untagged = await api.listUntaggedMainTransactions()
    if (untagged.length === 0) return

    const targetTx = untagged[0]
    const tagged = await api.tagMainTransaction(targetTx.id)

    // Delete the 10% entry directly
    await api.deleteTenPercentEntry(tagged.id)

    const untaggedAfter = await api.listUntaggedMainTransactions()
    expect(untaggedAfter.some((tx) => tx.id === targetTx.id)).toBe(true)
  })
})
