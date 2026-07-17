import { describe, expect, it, vi } from 'vitest'

const { getEarnPageMock } = vi.hoisted(() => ({ getEarnPageMock: vi.fn() }))

const meta = {
	chains: [],
	protocols: [],
	categories: [],
	tokens: {
		families: [
			{ value: 'family:btc', symbol: 'BTC' },
			{ value: 'family:eth', symbol: 'ETH' }
		],
		assets: [
			{ value: 'asset:btc', symbol: 'BTC' },
			{ value: 'asset:eth', symbol: 'ETH' },
			{ value: 'asset:usdc', symbol: 'USDC' },
			{ value: 'asset:wbar', symbol: 'WBAR' },
			{ value: 'asset:foo.e', symbol: 'FOO.e' }
		]
	}
}

vi.mock('../../snapshot', async (importOriginal) => ({
	...(await importOriginal<typeof import('../../snapshot')>()),
	readYieldsMeta: vi.fn(() => Promise.resolve(meta))
}))
vi.mock('../../earn.server', () => ({ getEarnPage: getEarnPageMock }))

import { getTokenEarnRows, resolveTokenOptionKeys as resolveTokenOptionKeysFromSnapshot } from '../tokenPage'

const snapshot = {} as never
const resolveTokenOptionKeys = (symbol: string) => resolveTokenOptionKeysFromSnapshot(snapshot, symbol)

describe('resolveTokenOptionKeys', () => {
	it('resolves to the direct asset option — never a family (a token page is about that token)', async () => {
		await expect(resolveTokenOptionKeys('BTC')).resolves.toEqual(['asset:btc'])
		await expect(resolveTokenOptionKeys('ETH')).resolves.toEqual(['asset:eth'])
		await expect(resolveTokenOptionKeys('USDC')).resolves.toEqual(['asset:usdc'])
	})

	it('is case-insensitive', async () => {
		await expect(resolveTokenOptionKeys('btc')).resolves.toEqual(['asset:btc'])
	})

	it('falls back to wrapped-variant asset options when neither family nor direct asset match', async () => {
		// only WBAR exists, matched via the `w` wrapper prefix
		await expect(resolveTokenOptionKeys('BAR')).resolves.toEqual(['asset:wbar'])
		// only FOO.e exists, matched via the `.e` suffix
		await expect(resolveTokenOptionKeys('FOO')).resolves.toEqual(['asset:foo.e'])
	})

	it('returns no keys for an unknown symbol or blank input', async () => {
		await expect(resolveTokenOptionKeys('NOPE')).resolves.toEqual([])
		await expect(resolveTokenOptionKeys('   ')).resolves.toEqual([])
	})
})

describe('getTokenEarnRows', () => {
	it('redacts stability fields from public token page rows', async () => {
		getEarnPageMock.mockResolvedValue({
			rows: [{ id: 'pool-1', stabilityScore: 0.9, stabilityRating: 'stable', stabilityAvg30d: 4.2 }]
		})

		const result = await getTokenEarnRows(snapshot, 'BTC')

		expect(result.rows).toEqual([{ id: 'pool-1', stabilityScore: null, stabilityRating: null, stabilityAvg30d: null }])
	})
})
