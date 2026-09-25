import { describe, expect, test } from 'vitest'
import { SERVER_URL } from '~/constants'
import { fixtureStatus, installFixtureFetch } from '~/utils/testing/fixtureFetch'
const http = installFixtureFetch()

import { reconcileChainAssetFlowKeys } from '../flowKeys'
import { getBridgedTVLByChain, getBridgedTVLChains } from '../queries'

const asset = (total: number) => ({
	total: { total, breakdown: {} },
	canonical: { total, breakdown: {} },
	thirdParty: { total: 0, breakdown: {} }
})

describe('getBridgedTVLByChain', () => {
	test('preserves integer presentation ordering ties without loading list-only flows', async () => {
		http.serve({ [`${SERVER_URL}/chain-assets/chains`]: { Alpha: asset(10.2), Beta: asset(10.9) } })

		const result = await getBridgedTVLByChain({
			chain: 'Alpha',
			chainMetadata: {
				alpha: { id: 'alpha', name: 'Alpha', chainAssets: true },
				beta: { id: 'beta', name: 'Beta', chainAssets: true }
			}
		})

		expect(result.chains).toEqual([
			{ label: 'All', to: '/bridged' },
			{ label: 'Alpha', to: '/bridged/alpha' },
			{ label: 'Beta', to: '/bridged/beta' }
		])
		expect(result.chainData?.total.total).toBe(10.2)
		expect(http.urls()).toEqual([`${SERVER_URL}/chain-assets/chains`])
		expect(result).not.toHaveProperty('assets')
	})

	test('keeps required list data when the optional flow request fails', async () => {
		http.serve({ [`${SERVER_URL}/chain-assets/chains`]: { Alpha: asset(10) } })
		http.serve({ [`${SERVER_URL}/chain-assets/flows/24h`]: fixtureStatus(404) })

		const result = await getBridgedTVLChains({
			chainMetadata: { alpha: { id: 'alpha', name: 'Alpha', chainAssets: true } }
		})

		expect(result.assets.Alpha?.total.total).toBe(10)
		expect(result.flows1d).toBeNull()
	})
})

describe('reconcileChainAssetFlowKeys', () => {
	test('maps display, spaced, and alias-id keys to asset display names', () => {
		const assets = { Base: asset(1), 'OP Mainnet': asset(2), 'Chain With Spaces': asset(3) }
		const flows = {
			base: { total: { perc: 1, raw: 1 } },
			optimism: { total: { perc: 2, raw: 2 } },
			'chain with spaces': { total: { perc: 3, raw: 3 } },
			'unknown-chain': { total: { perc: 99, raw: 99 } }
		}

		const reconciled = reconcileChainAssetFlowKeys({
			assets,
			flows,
			chainMetadata: {
				base: { id: 'base', name: 'Base' },
				optimism: { id: 'optimism', name: 'OP Mainnet' },
				spaces: { id: 'spaces', name: 'Chain With Spaces' }
			}
		})

		expect(Object.keys(reconciled)).toEqual(['Base', 'OP Mainnet', 'Chain With Spaces'])
		expect(reconciled['OP Mainnet']?.total?.raw).toBe(2)
		expect(reconciled['Chain With Spaces']?.total?.raw).toBe(3)
		expect(reconciled['unknown-chain']).toBeUndefined()
	})
})
