import type { GetStaticPropsContext } from 'next'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { installMetadataSeeder } from '~/utils/test/metadataCache'

const { fetchJsonMock } = vi.hoisted(() => ({ fetchJsonMock: vi.fn() }))

vi.mock('~/utils/async', async (importOriginal) => ({
	...(await importOriginal<typeof import('~/utils/async')>()),
	fetchJson: fetchJsonMock
}))

// Heavy page children; these tests assert only getStaticProps results.
vi.mock('~/components/TemporarilyDisabledPage', () => ({ TemporarilyDisabledPage: () => null }))
vi.mock('~/containers/Bridges/BridgesOverviewByChain', () => ({ BridgesOverviewByChain: () => null }))
vi.mock('~/containers/Bridges/BridgeProtocolOverview', () => ({ BridgeProtocolOverview: () => null }))
vi.mock('~/layout', () => ({ default: () => null }))

import { getStaticProps as getBridgeStaticProps } from '~/pages/bridge/[bridge]'
import { getStaticProps as getBridgeChainStaticProps } from '~/pages/bridges/[chain]'

const metadata = installMetadataSeeder()

beforeEach(() => {
	fetchJsonMock.mockReset()
	vi.spyOn(console, 'error').mockImplementation(() => {})
	vi.spyOn(console, 'log').mockImplementation(() => {})
	metadata.seed({
		bridgeChainSlugsSet: new Set(['base']),
		bridgeChainSlugToName: { base: 'Base' },
		bridgeProtocolSlugsSet: new Set(['layerzero'])
	})
})

const chainContext = (revalidateReason: 'stale' | 'build') =>
	({ params: { chain: 'base' }, revalidateReason }) as GetStaticPropsContext<{ chain: string }>
const bridgeContext = (revalidateReason: 'stale' | 'build') =>
	({ params: { bridge: 'layerzero' }, revalidateReason }) as GetStaticPropsContext<{ bridge: string }>

describe('Bridges stale ISR handling', () => {
	test('rethrows a chain loader failure during stale regeneration', async () => {
		fetchJsonMock.mockRejectedValue(new Error('upstream unavailable'))

		await expect(getBridgeChainStaticProps(chainContext('stale'))).rejects.toThrow('upstream unavailable')
	})

	test('keeps the disabled chain fallback for an initial build failure', async () => {
		fetchJsonMock.mockRejectedValue(new Error('upstream unavailable'))

		await expect(getBridgeChainStaticProps(chainContext('build'))).resolves.toMatchObject({
			props: { state: 'disabled', chainSlug: 'base', chainLabel: 'Base' }
		})
	})

	test('rethrows missing bridge data during stale regeneration', async () => {
		fetchJsonMock.mockResolvedValue({ bridges: [], chains: [] })

		await expect(getBridgeStaticProps(bridgeContext('stale'))).rejects.toThrow('No bridge data returned for layerzero')
	})

	test('keeps the disabled bridge fallback for an initial build failure', async () => {
		fetchJsonMock.mockRejectedValue(new Error('upstream unavailable'))

		await expect(getBridgeStaticProps(bridgeContext('build'))).resolves.toMatchObject({
			props: { state: 'disabled', bridgeSlug: 'layerzero' }
		})
	})
})
