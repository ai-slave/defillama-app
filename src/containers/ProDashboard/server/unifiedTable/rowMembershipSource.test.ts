import { beforeEach, describe, expect, test } from 'vitest'
import { V2_SERVER_URL } from '~/constants'
import type { IAdapterChainMetrics } from '~/containers/AdapterMetrics/api.types'
import { installFixtureFetch, fixtureStatus } from '~/utils/test/fixtureFetch'
import { installMetadataSeeder } from '~/utils/test/metadataCache'
import { fetchProtocolRowMembershipDataset } from './rowMembership'

const http = installFixtureFetch()
const metadata = installMetadataSeeder()
const protocol: IAdapterChainMetrics['protocols'][number] = {
	defillamaId: 'perps',
	name: 'Perps',
	displayName: 'Perps',
	slug: 'perps',
	id: 'perps',
	total24h: 100,
	breakdown24h: null,
	breakdown30d: null,
	module: null,
	category: 'Derivatives',
	logo: '',
	chains: ['Ethereum'],
	protocolType: 'protocol',
	methodologyURL: null,
	methodology: null
}
beforeEach(() => {
	metadata.seed({
		chainMetadata: {
			ethereum: { name: 'Ethereum', id: 'ethereum', openInterest: true },
			base: { name: 'Base', id: 'base', openInterest: true }
		}
	})
	http.serve({
		[`${V2_SERVER_URL}/metrics/open-interest/chain/ethereum?dataType=openInterestAtEnd`]: {
			protocols: [protocol],
			allChains: ['Ethereum']
		}
	})
})
describe('protocol row membership source', () => {
	test('loads selected-chain membership from the canonical open-interest endpoint', async () => {
		const result = await fetchProtocolRowMembershipDataset(
			{ kind: 'base-metric', family: 'open-interest' },
			{ kind: 'chain', chains: ['Ethereum'] }
		)
		expect(result).toMatchObject({
			status: 'complete',
			protocols: [{ name: 'Perps', total24h: 100, chains: ['Ethereum'] }]
		})
	})
	test('rejects failed-chain membership even when another chain returns rows', async () => {
		http.serve({ [`${V2_SERVER_URL}/metrics/open-interest/chain/base?dataType=openInterestAtEnd`]: fixtureStatus(503) })
		await expect(
			fetchProtocolRowMembershipDataset(
				{ kind: 'base-metric', family: 'open-interest' },
				{ kind: 'chain', chains: ['Ethereum', 'Base'] }
			)
		).rejects.toThrow('Canonical open-interest membership is unavailable for: Base')
	})
})
