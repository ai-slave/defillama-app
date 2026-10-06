import { beforeEach, describe, expect, test, vi } from 'vitest'
import { hasVaultRisk } from '../loader'

const mocks = vi.hoisted(() => ({ fetchJson: vi.fn() }))
vi.mock('~/utils/async', () => ({ fetchJson: mocks.fetchJson }))

const POOL = '7820bd3c-461a-4811-9f0b-1d39c1503c3f'

beforeEach(() => {
	mocks.fetchJson.mockReset()
})

describe('hasVaultRisk', () => {
	test('returns true when the pool has a risk entry', async () => {
		mocks.fetchJson.mockResolvedValue({ data: { protocol_id: null, vault_specific_risks: [] } })
		await expect(hasVaultRisk(POOL)).resolves.toBe(true)
	})

	test('returns false when the response is not a vault fixture', async () => {
		mocks.fetchJson.mockResolvedValue({ data: null })
		await expect(hasVaultRisk(POOL)).resolves.toBe(false)
	})

	test('degrades to false when the fetch fails', async () => {
		mocks.fetchJson.mockRejectedValue(new Error('http://risk.test: [404] Not Found'))
		await expect(hasVaultRisk(POOL)).resolves.toBe(false)
	})

	test('rejects a non-UUID pool id without fetching', async () => {
		await expect(hasVaultRisk('not-a-uuid')).resolves.toBe(false)
		expect(mocks.fetchJson).not.toHaveBeenCalled()
	})
})
