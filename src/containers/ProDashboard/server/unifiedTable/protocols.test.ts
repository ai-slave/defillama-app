import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
	anyMock,
	fetchOracleMetricsMock,
	fetchProtocolRowMembershipDatasetMock,
	fetchProtocolSupplementalMetricsMock,
	oneMock
} = vi.hoisted(() => ({
	anyMock: vi.fn(),
	fetchOracleMetricsMock: vi.fn(),
	fetchProtocolRowMembershipDatasetMock: vi.fn(),
	fetchProtocolSupplementalMetricsMock: vi.fn(),
	oneMock: vi.fn()
}))

vi.mock('~/containers/Oracles/api', () => ({ fetchOracleMetrics: fetchOracleMetricsMock }))

vi.mock('./supplementalMetrics', async (importOriginal) => {
	const original = await importOriginal<typeof import('./supplementalMetrics')>()
	return { ...original, fetchProtocolSupplementalMetrics: fetchProtocolSupplementalMetricsMock }
})

vi.mock('./rowMembership', async (importOriginal) => {
	const original = await importOriginal<typeof import('./rowMembership')>()
	return { ...original, fetchProtocolRowMembershipDataset: fetchProtocolRowMembershipDatasetMock }
})

vi.mock('~/server/db/llama', () => ({
	llamaDb: {
		any: anyMock,
		one: oneMock
	}
}))

const totals = {
	tvl_base: 1,
	volume_dexs_1d: 1,
	volume_dexs_7d: 1,
	volume_aggregators_1d: 1,
	volume_aggregators_7d: 1,
	volume_derivatives_1d: 1,
	volume_aggr_derivatives_1d: 1,
	volume_options_1d: 1
}

const options = {
	config: {
		id: 'table',
		kind: 'unified-table' as const,
		configVersion: 3 as const,
		strategy: 'protocols' as const,
		rowHeaders: ['protocol' as const],
		params: null
	},
	rowHeaders: ['protocol' as const],
	baseMetricFamilies: [],
	pointMetrics: [],
	supplementalMetrics: [],
	needsOracleMembership: false,
	rowMembership: { kind: 'all-protocols' as const }
}

describe('unified table metric totals cache', () => {
	beforeEach(() => {
		vi.resetModules()
		vi.useFakeTimers()
		vi.setSystemTime(new Date('2026-07-19T00:00:00Z'))
		anyMock.mockReset().mockResolvedValue([])
		fetchOracleMetricsMock.mockReset().mockResolvedValue({ oracles: {}, chainsByOracle: {}, oraclesTVS: {} })
		fetchProtocolRowMembershipDatasetMock.mockReset().mockResolvedValue(null)
		fetchProtocolSupplementalMetricsMock.mockReset().mockResolvedValue({})
		oneMock.mockReset().mockResolvedValue(totals)
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it('reuses totals briefly and refreshes them after the TTL', async () => {
		const { fetchProtocolsTable } = await import('./protocols')
		const tvlOptions = { ...options, baseMetricFamilies: ['tvl' as const] }

		await fetchProtocolsTable(tvlOptions)
		await fetchProtocolsTable(tvlOptions)
		expect(oneMock).toHaveBeenCalledTimes(1)

		vi.setSystemTime(new Date('2026-07-19T00:05:01Z'))
		await fetchProtocolsTable(tvlOptions)
		expect(oneMock).toHaveBeenCalledTimes(2)
	})

	it('clears a rejected totals request so the next call can retry', async () => {
		oneMock.mockRejectedValueOnce(new Error('temporary database failure')).mockResolvedValueOnce(totals)
		const { fetchProtocolsTable } = await import('./protocols')

		const tvlOptions = { ...options, baseMetricFamilies: ['tvl' as const] }
		await expect(fetchProtocolsTable(tvlOptions)).rejects.toThrow('temporary database failure')
		await expect(fetchProtocolsTable(tvlOptions)).resolves.toEqual({ rows: [], parentMetrics: {} })
		expect(oneMock).toHaveBeenCalledTimes(2)
	})

	it('retains independent totals projections within the TTL', async () => {
		const { fetchProtocolsTable } = await import('./protocols')

		await fetchProtocolsTable({ ...options, baseMetricFamilies: ['tvl'] })
		await fetchProtocolsTable({ ...options, baseMetricFamilies: ['dex-volume'] })
		await fetchProtocolsTable({ ...options, baseMetricFamilies: ['tvl'] })

		expect(oneMock).toHaveBeenCalledTimes(2)
	})

	it('skips the global totals query when the requested columns do not use global shares', async () => {
		const { fetchProtocolsTable } = await import('./protocols')

		await fetchProtocolsTable({ ...options, baseMetricFamilies: ['fees', 'revenue', 'market-cap'] })

		expect(oneMock).not.toHaveBeenCalled()
	})

	it('maps the canonical Lens holder revenue comparison to a percentage metric', async () => {
		fetchOracleMetricsMock.mockResolvedValue({
			oracles: { Chainlink: ['example--protocol'] },
			chainsByOracle: {},
			oraclesTVS: {}
		})
		anyMock
			.mockResolvedValueOnce([
				{
					protocol: 'example--protocol',
					protocol_category: 'Dexs',
					chain_slugs: ['ethereum'],
					holder_revenue_7d: 75,
					holder_revenue_7d_pct_change: -0.125,
					holder_revenue_30d: 125,
					holder_revenue_30d_pct_change: 0.25,
					exclude_tvl_from_parent: false
				}
			])
			.mockResolvedValueOnce([])
		const { fetchProtocolsTable } = await import('./protocols')

		const result = await fetchProtocolsTable({
			...options,
			baseMetricFamilies: ['holder-revenue'],
			needsOracleMembership: true
		})

		expect(result.rows).toHaveLength(1)
		expect(result.rows[0]?.metrics.holderRevenue_7d).toBe(75)
		expect(result.rows[0]?.metrics.holderRevenueChange7dOver7d).toBe(-12.5)
		expect(result.rows[0]?.metrics.holdersRevenue30d).toBe(125)
		expect(result.rows[0]?.metrics.holderRevenueChange30dOver30d).toBe(25)
		expect(result.rows[0]?.oracles).toEqual(['Chainlink'])
	})

	it('maps the first Lens metric batch while keeping incentives out of unsupported subprotocol projections', async () => {
		anyMock
			.mockResolvedValueOnce([
				{
					protocol: 'example--protocol',
					protocol_category: 'Dexs',
					chain_slugs: ['ethereum'],
					tvl_base: 100,
					tvl_base_365d_pct_change: 1,
					tvl_staking: 10,
					tvl_borrowed: 20,
					tvl_pool2: 30,
					tvl_treasury: 40,
					tvl_vesting: 50,
					fees_90d: 90,
					fees_90d_pct_change: 0.25,
					revenue_ytd: 120,
					revenue_ytd_pct_change: -0.1,
					holder_revenue_365d: 365,
					holder_revenue_365d_pct_change: 0.5,
					incentive_1d: 1,
					incentive_7d: 7,
					incentive_30d: 30,
					incentive_30d_pct_change: 1,
					incentive_90d: 90,
					incentive_180d: 180,
					incentive_365d: 365,
					incentive_ytd: 220,
					incentive_alltime: 500,
					incentive_annualised: 400,
					volume_dexs_90d: 900,
					volume_dexs_365d: 3650,
					volume_derivatives_90d: 800,
					volume_derivatives_365d: 3200,
					volume_derivatives_alltime: 5000,
					volume_aggregators_90d: 700,
					volume_aggregators_365d: 2800,
					volume_aggregators_alltime: 4200,
					volume_aggregators_30d_pct_change: 0.2,
					volume_options_90d: 600,
					volume_options_365d: 2400,
					volume_options_alltime: 3600,
					volume_options_notional_1d: 10,
					volume_options_notional_7d: 70,
					volume_options_notional_30d: 300,
					volume_options_30d_pct_change: -0.3,
					exclude_tvl_from_parent: false
				}
			])
			.mockResolvedValueOnce([])
		const { fetchProtocolsTable } = await import('./protocols')

		const result = await fetchProtocolsTable({
			...options,
			baseMetricFamilies: [
				'tvl',
				'dex-volume',
				'perps-volume',
				'fees',
				'holder-revenue',
				'incentives',
				'revenue',
				'aggregator-volume',
				'options-volume'
			]
		})
		const metrics = result.rows[0]?.metrics

		expect(metrics).toMatchObject({
			change1y: 100,
			stakingTvl: 10,
			borrowedTvl: 20,
			pool2Tvl: 30,
			treasuryTvl: 40,
			vestingTvl: 50,
			fees_90d: 90,
			feesChange90dOver90d: 25,
			revenue_ytd: 120,
			revenueChangeYtd: -10,
			holderRevenue_1y: 365,
			holderRevenueChange1yOver1y: 50,
			emissions24h: 1,
			emissions7d: 7,
			emissions30d: 30,
			emissions90d: 90,
			emissions180d: 180,
			emissions1y: 365,
			emissionsYtd: 220,
			cumulativeEmissions: 500,
			emissionsAnnualized1y: 400,
			emissionsChange30dOver30d: 100,
			volume_90d: 900,
			volume_1y: 3650,
			perps_volume_90d: 800,
			perps_volume_1y: 3200,
			cumulativePerpsVolume: 5000,
			aggregators_volume_90d: 700,
			aggregators_volume_1y: 2800,
			cumulativeAggregatorVolume: 4200,
			aggregatorVolumeChange30dOver30d: 20,
			options_volume_90d: 600,
			options_volume_1y: 2400,
			cumulativeOptionsVolume: 3600,
			optionsNotionalVolume24h: 10,
			optionsNotionalVolume7d: 70,
			optionsNotionalVolume30d: 300,
			optionsVolumeChange30dOver30d: -30
		})
		expect(String(anyMock.mock.calls[0]?.[0])).toContain('mp.incentive_30d')
		expect(String(anyMock.mock.calls[1]?.[0])).not.toContain('msp.incentive_30d')
	})

	it('uses canonical protocol and chain display names from Lens metadata', async () => {
		anyMock
			.mockResolvedValueOnce([
				{
					protocol: 'gmx',
					protocol_name: 'GMX',
					protocol_category: 'Derivatives',
					chain_slugs: ['bsc', 'op-mainnet'],
					exclude_tvl_from_parent: false
				}
			])
			.mockResolvedValueOnce([
				{
					sub_protocol: 'gmx-v2',
					protocol: 'gmx',
					protocol_name: 'GMX V2',
					parent_protocol_name: 'GMX',
					protocol_category: 'Derivatives',
					chain_slugs: ['bsc', 'op-mainnet'],
					exclude_tvl_from_parent: false
				}
			])
		const { fetchProtocolsTable } = await import('./protocols')

		const result = await fetchProtocolsTable(options)

		expect(result.rows).toHaveLength(1)
		expect(result.rows[0]).toMatchObject({
			displayName: 'GMX V2',
			parentProtocolName: 'GMX',
			chains: ['BSC', 'OP Mainnet']
		})
	})

	it('does not request oracle membership for unrelated tables', async () => {
		const { fetchProtocolsTable } = await import('./protocols')

		await fetchProtocolsTable(options)

		expect(fetchOracleMetricsMock).not.toHaveBeenCalled()
	})

	it('constructs only requested metric families and their exact ratio dependencies', async () => {
		anyMock
			.mockResolvedValueOnce([
				{
					protocol: 'example--protocol',
					protocol_category: 'Dexs',
					chain_slugs: ['ethereum'],
					tvl_base: 100,
					fees_1d: 0,
					fees_annualised: 50,
					revenue_annualised: 25,
					mcap: 1_000,
					fdv: 2_000,
					volume_dexs_1d: 999,
					exclude_tvl_from_parent: false
				}
			])
			.mockResolvedValueOnce([])
		const { fetchProtocolsTable } = await import('./protocols')

		const result = await fetchProtocolsTable({
			...options,
			baseMetricFamilies: ['market-cap', 'tvl', 'fees', 'revenue']
		})
		const metrics = result.rows[0]?.metrics

		expect(metrics).toMatchObject({
			tvl: 100,
			fees24h: 0,
			feesAnnualized1y: 50,
			revenueAnnualized1y: 25,
			mcap: 1_000,
			fdv: 2_000,
			mcaptvl: 10,
			pf: 20,
			ps: 40
		})
		expect(metrics).not.toHaveProperty('volume24h')
		expect(metrics).not.toHaveProperty('protocolCount')
	})

	it('preserves omitted activity in a successful Lens row as unavailable', async () => {
		anyMock
			.mockResolvedValueOnce([
				{
					protocol: 'inactive--protocol',
					protocol_category: 'Dexs',
					chain_slugs: ['ethereum'],
					exclude_tvl_from_parent: false
				}
			])
			.mockResolvedValueOnce([])
		const { fetchProtocolsTable } = await import('./protocols')

		const result = await fetchProtocolsTable({
			...options,
			baseMetricFamilies: [
				'tvl',
				'dex-volume',
				'fees',
				'holder-revenue',
				'revenue',
				'perps-volume',
				'aggregator-volume',
				'derivatives-aggregator-volume',
				'options-volume',
				'open-interest',
				'market-cap'
			]
		})
		const metrics = result.rows[0]?.metrics

		expect(metrics).toMatchObject({
			tvl: null,
			volume24h: null,
			volume_7d: null,
			volume_30d: null,
			cumulativeVolume: null,
			fees24h: null,
			fees_1y: null,
			cumulativeFees: null,
			holderRevenue_24h: null,
			holdersRevenue30d: null,
			revenue24h: null,
			revenue_1y: null,
			cumulativeRevenue: null,
			perpsVolume24h: null,
			aggregators_volume_24h: null,
			derivatives_aggregators_volume_24h: null,
			options_volume_24h: null,
			mcap: null,
			fdv: null,
			openInterest: null
		})
		expect(metrics?.feesAnnualized1y).toBeNull()
		expect(metrics?.revenueAnnualized1y).toBeNull()
		expect(metrics?.feesChange_1d).toBeNull()
	})

	it('exposes open interest only when that metric family is requested', async () => {
		const lensRows = [
			{
				protocol: 'perps-protocol',
				protocol_category: 'Derivatives',
				chain_slugs: ['ethereum'],
				open_interest: 42,
				exclude_tvl_from_parent: false
			}
		]
		anyMock.mockResolvedValueOnce(lensRows).mockResolvedValueOnce([])
		const { fetchProtocolsTable } = await import('./protocols')

		const withoutOpenInterest = await fetchProtocolsTable(options)
		expect(withoutOpenInterest.rows[0]?.metrics).not.toHaveProperty('openInterest')

		anyMock.mockReset().mockResolvedValueOnce(lensRows).mockResolvedValueOnce([])
		const withOpenInterest = await fetchProtocolsTable({ ...options, baseMetricFamilies: ['open-interest'] })
		expect(withOpenInterest.rows[0]?.metrics.openInterest).toBe(42)
	})

	it('retains canonical parent open interest when child metric allocation is absent', async () => {
		anyMock
			.mockResolvedValueOnce([
				{
					protocol: 'gmx',
					protocol_name: 'GMX',
					protocol_category: 'Derivatives',
					chain_slugs: ['arbitrum'],
					open_interest: 100,
					exclude_tvl_from_parent: false
				}
			])
			.mockResolvedValueOnce([
				{
					sub_protocol: 'gmx-v2',
					protocol: 'gmx',
					protocol_name: 'GMX V2',
					parent_protocol_name: 'GMX',
					protocol_category: 'Derivatives',
					chain_slugs: ['arbitrum'],
					open_interest: null,
					exclude_tvl_from_parent: false
				}
			])
		const { fetchProtocolsTable } = await import('./protocols')

		const result = await fetchProtocolsTable({ ...options, baseMetricFamilies: ['open-interest'] })

		expect(result.rows.map((row) => row.protocolId)).toEqual(['gmx-v2'])
		expect(result.parentMetrics.gmx?.supplements?.openInterest).toEqual({
			childProtocolIds: ['gmx-v2'],
			childProtocolIdsByChain: {},
			metrics: { openInterest: 100 },
			metricsByChain: {}
		})
	})

	it('filters metric presets by canonical dataset membership without narrowing broad custom tables', async () => {
		const { fetchProtocolsTable } = await import('./protocols')
		const lensRows = [
			{
				protocol: 'canonical',
				protocol_name: 'Canonical',
				chain_slugs: ['ethereum'],
				open_interest: null,
				exclude_tvl_from_parent: false
			},
			{
				protocol: 'lens-only',
				protocol_name: 'Lens only',
				chain_slugs: ['ethereum'],
				open_interest: 100,
				exclude_tvl_from_parent: false
			}
		]
		anyMock.mockResolvedValueOnce(lensRows).mockResolvedValueOnce([])
		fetchProtocolRowMembershipDatasetMock.mockResolvedValueOnce({
			status: 'complete',
			protocols: [{ name: 'Canonical', slug: 'canonical', chains: ['Ethereum'], total24h: null }]
		})

		const preset = await fetchProtocolsTable({
			...options,
			baseMetricFamilies: ['open-interest'],
			rowMembership: { kind: 'base-metric', family: 'open-interest' }
		})
		expect(preset.rows.map((row) => row.protocolId)).toEqual(['canonical'])

		anyMock.mockClear().mockResolvedValueOnce(lensRows).mockResolvedValueOnce([])
		fetchProtocolRowMembershipDatasetMock.mockResolvedValueOnce(null)
		const broad = await fetchProtocolsTable({ ...options, baseMetricFamilies: ['open-interest'] })
		expect(broad.rows.map((row) => row.protocolId)).toEqual(['canonical', 'lens-only'])
	})

	it('constructs only requested optional chain metrics', async () => {
		const { fetchProtocolsTable } = await import('./protocols')
		const chainOptions = { ...options, rowHeaders: ['chain' as const, 'protocol' as const] }
		const canonicalChainRows = [
			{
				chain: 'ethereum',
				open_interest: 42,
				bridged_tvl: 100,
				stables_mcap: 30,
				total_stables_mcap: 120
			}
		]
		anyMock.mockReset().mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce(canonicalChainRows)

		const minimal = await fetchProtocolsTable(chainOptions)
		const minimalMetrics = minimal.chainMetrics?.ethereum
		expect(minimalMetrics?.availability).toBe('available')
		if (minimalMetrics?.availability !== 'available') throw new Error('Expected canonical Ethereum metrics')
		expect(minimalMetrics.metrics).toEqual({})

		anyMock.mockReset().mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce(canonicalChainRows)
		const expanded = await fetchProtocolsTable({
			...chainOptions,
			baseMetricFamilies: ['open-interest', 'bridged-tvl', 'stablecoins']
		})
		const expandedMetrics = expanded.chainMetrics?.ethereum
		expect(expandedMetrics?.availability).toBe('available')
		if (expandedMetrics?.availability !== 'available') throw new Error('Expected canonical Ethereum metrics')
		expect(expandedMetrics.metrics).toEqual({ openInterest: 42, bridgedTvl: 100, stablesMcap: 30, stablesShare: 25 })
	})

	it('constructs sparse canonical chain metrics from requested families', async () => {
		anyMock
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([
				{
					chain: 'ethereum',
					app_fees_1d: 0,
					app_fees_annualised: 120,
					chain_fees_1d: 10,
					chain_fees_7d: 70,
					chain_fees_30d: 300,
					chain_fees_1d_pct_change: 0.1,
					chain_fees_7d_pct_change: 0.2,
					chain_fees_30d_pct_change: 0.3,
					chain_revenue_1d: 4,
					chain_revenue_7d: 28,
					chain_revenue_30d: 120,
					chain_revenue_1d_pct_change: -0.1,
					chain_revenue_7d_pct_change: -0.2,
					chain_revenue_30d_pct_change: -0.3,
					chain_rev_1d: 11,
					chain_rev_7d: 77,
					chain_rev_30d: 330,
					chain_rev_1d_pct_change: 0.4,
					chain_rev_7d_pct_change: 0.5,
					chain_rev_30d_pct_change: 0.6,
					tvl_base: 999
				}
			])
		const { fetchProtocolsTable } = await import('./protocols')

		const result = await fetchProtocolsTable({
			...options,
			rowHeaders: ['chain', 'protocol'],
			baseMetricFamilies: ['fees', 'revenue']
		})
		const ethereum = result.chainMetrics?.ethereum

		expect(ethereum?.availability).toBe('available')
		if (ethereum?.availability !== 'available') throw new Error('Expected canonical Ethereum metrics')
		expect(ethereum.metrics).toMatchObject({
			fees24h: 0,
			fees_7d: null,
			feesAnnualized1y: 120,
			average_1y: 10,
			chainFees24h: 10,
			chainFees7d: 70,
			chainFees30d: 300,
			chainFeesChange1d: 10,
			chainFeesChange7dOver7d: 20,
			chainFeesChange30dOver30d: 30,
			chainRevenue24h: 4,
			chainRevenue7d: 28,
			chainRevenue30d: 120,
			chainRevenueChange1d: -10,
			chainRevenueChange7dOver7d: -20,
			chainRevenueChange30dOver30d: -30,
			chainRev24h: 11,
			chainRev7d: 77,
			chainRev30d: 330,
			chainRevChange1d: 40,
			chainRevChange7dOver7d: 50,
			chainRevChange30dOver30d: 60
		})
		expect(ethereum.metrics).not.toHaveProperty('tvl')
		expect(ethereum.metrics).not.toHaveProperty('tvlShare')
		expect(ethereum.metrics).not.toHaveProperty('protocolCount')
	})

	it('maps canonical chain incentives without allocating them to protocol-chain rows', async () => {
		anyMock
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([
				{ chain: 'ethereum', incentive_1d: 1, incentive_7d: 7, incentive_30d: 30, incentive_365d: 365 }
			])
		const { fetchProtocolsTable } = await import('./protocols')

		const result = await fetchProtocolsTable({
			...options,
			rowHeaders: ['chain', 'protocol'],
			baseMetricFamilies: ['incentives']
		})
		const ethereum = result.chainMetrics?.ethereum
		expect(ethereum?.availability).toBe('available')
		if (ethereum?.availability !== 'available') throw new Error('Expected canonical Ethereum metrics')
		expect(ethereum.metrics).toMatchObject({
			emissions24h: 1,
			emissions7d: 7,
			emissions30d: 30,
			emissions1y: 365
		})
	})

	it('shares one request scope between supplemental values and canonical membership', async () => {
		anyMock
			.mockResolvedValueOnce([
				{
					protocol: 'protocol',
					protocol_category: 'Dexs',
					chain_slugs: ['ethereum'],
					chain_slug: 'Ethereum',
					exclude_tvl_from_parent: false
				},
				{
					protocol: 'protocol',
					protocol_category: 'Dexs',
					chain_slugs: ['base'],
					chain_slug: 'Base',
					exclude_tvl_from_parent: false
				}
			])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([])
		const { fetchProtocolsTable } = await import('./protocols')

		await fetchProtocolsTable({
			...options,
			rowHeaders: ['chain', 'protocol'],
			supplementalMetrics: ['earnings'],
			rowMembership: { kind: 'supplemental-metric', metric: 'earnings' }
		})

		expect(fetchProtocolSupplementalMetricsMock).toHaveBeenCalledOnce()
		expect(fetchProtocolRowMembershipDatasetMock).toHaveBeenCalledOnce()
		const supplementalScope = fetchProtocolSupplementalMetricsMock.mock.calls[0]?.[2]
		const membershipScope = fetchProtocolRowMembershipDatasetMock.mock.calls[0]?.[2]
		expect(supplementalScope).toBeDefined()
		expect(membershipScope).toBe(supplementalScope)
	})
})
