import { describe, expect, test } from 'vitest'
import { yieldsMeta, yieldsSnapshot } from '~/utils/testing/yieldsSnapshotFixture'
import { resolveTokenOptionKeys } from '../tokenPage'

const snapshot = yieldsSnapshot({
	meta: {
		...yieldsMeta,
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
})

describe('resolveTokenOptionKeys', () => {
	test('resolves to the direct asset option — never a family (a token page is about that token)', async () => {
		await expect(resolveTokenOptionKeys(snapshot, 'BTC')).resolves.toEqual(['asset:btc'])
		await expect(resolveTokenOptionKeys(snapshot, 'ETH')).resolves.toEqual(['asset:eth'])
		await expect(resolveTokenOptionKeys(snapshot, 'USDC')).resolves.toEqual(['asset:usdc'])
	})

	test('is case-insensitive', async () => {
		await expect(resolveTokenOptionKeys(snapshot, 'btc')).resolves.toEqual(['asset:btc'])
	})

	test('falls back to wrapped-variant asset options when neither family nor direct asset match', async () => {
		// only WBAR exists, matched via the `w` wrapper prefix
		await expect(resolveTokenOptionKeys(snapshot, 'BAR')).resolves.toEqual(['asset:wbar'])
		// only FOO.e exists, matched via the `.e` suffix
		await expect(resolveTokenOptionKeys(snapshot, 'FOO')).resolves.toEqual(['asset:foo.e'])
	})
})
