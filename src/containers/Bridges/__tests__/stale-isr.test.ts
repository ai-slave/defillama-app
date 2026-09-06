import type { GetStaticPropsContext } from 'next'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const { getBridgeOverviewPageDataMock, getBridgePageDatanewMock } = vi.hoisted(() => ({
	getBridgeOverviewPageDataMock: vi.fn(),
	getBridgePageDatanewMock: vi.fn()
}))

vi.mock('~/utils/perf', () => ({
	withPerformanceLogging: (_filename: string, handler: unknown) => handler
}))

vi.mock('~/utils/metadata', () => ({
	default: {
		bridgeChainSlugsSet: new Set(['base']),
		bridgeChainSlugToName: { base: 'Base' },
		bridgeProtocolSlugsSet: new Set(['layerzero'])
	}
}))

vi.mock('~/containers/Bridges/queries.server', () => ({
	getBridgeOverviewPageData: getBridgeOverviewPageDataMock,
	getBridgePageDatanew: getBridgePageDatanewMock
}))

vi.mock('~/components/TemporarilyDisabledPage', () => ({
	TemporarilyDisabledPage: () => null
}))

vi.mock('~/containers/Bridges/BridgesOverviewByChain', () => ({
	BridgesOverviewByChain: () => null
}))

vi.mock('~/containers/Bridges/BridgeProtocolOverview', () => ({
	BridgeProtocolOverview: () => null
}))

vi.mock('~/layout', () => ({
	default: () => null
}))

import { getStaticProps as getBridgeStaticProps } from '~/pages/bridge/[bridge]'
import { getStaticProps as getBridgeChainStaticProps } from '~/pages/bridges/[chain]'

beforeEach(() => {
	vi.clearAllMocks()
	vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
	vi.restoreAllMocks()
})

describe('Bridges stale ISR handling', () => {
	test('rethrows a chain loader failure during stale regeneration', async () => {
		getBridgeOverviewPageDataMock.mockRejectedValue(new Error('upstream unavailable'))
		const context = {
			params: { chain: 'base' },
			revalidateReason: 'stale'
		} as GetStaticPropsContext<{ chain: string }>

		await expect(getBridgeChainStaticProps(context)).rejects.toThrow('upstream unavailable')
	})

	test('keeps the disabled chain fallback for an initial build failure', async () => {
		getBridgeOverviewPageDataMock.mockRejectedValue(new Error('upstream unavailable'))
		const context = {
			params: { chain: 'base' },
			revalidateReason: 'build'
		} as GetStaticPropsContext<{ chain: string }>

		await expect(getBridgeChainStaticProps(context)).resolves.toMatchObject({
			props: { state: 'disabled', chainSlug: 'base', chainLabel: 'Base' }
		})
	})

	test('rethrows missing bridge data during stale regeneration', async () => {
		getBridgePageDatanewMock.mockResolvedValue(null)
		const context = {
			params: { bridge: 'layerzero' },
			revalidateReason: 'stale'
		} as GetStaticPropsContext<{ bridge: string }>

		await expect(getBridgeStaticProps(context)).rejects.toThrow('No bridge data returned for layerzero')
	})

	test('keeps the disabled bridge fallback for an initial build failure', async () => {
		getBridgePageDatanewMock.mockRejectedValue(new Error('upstream unavailable'))
		const context = {
			params: { bridge: 'layerzero' },
			revalidateReason: 'build'
		} as GetStaticPropsContext<{ bridge: string }>

		await expect(getBridgeStaticProps(context)).resolves.toMatchObject({
			props: { state: 'disabled', bridgeSlug: 'layerzero' }
		})
	})
})
