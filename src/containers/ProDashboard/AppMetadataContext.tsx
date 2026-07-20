import { useQuery } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { getDisplayAliases } from '~/utils/chainNormalizer'
import type { IChainMetadata, IProtocolMetadata } from '~/utils/metadata/types'
import { getAvailableChainChartTypes } from './appMetadataChartTypes'
import type { ProDashboardAppMetadata } from './dataContracts'
import { StreamDoneContext } from './queries'
import { type ChartBuilderConfig, getProtocolChartTypes } from './types'

type BuilderMetric = ChartBuilderConfig['config']['metric']

const PROTOCOL_FLAG_KEYS = [
	'tvl',
	'fees',
	'revenue',
	'dexs',
	'perps',
	'openInterest',
	'optionsNotionalVolume',
	'optionsPremiumVolume',
	'bridgeAggregators',
	'dexAggregators',
	'perpsAggregators',
	'holdersRevenue',
	'stablecoins',
	'emissions',
	'incentives',
	'liquidity',
	'treasury',
	'bribeRevenue',
	'tokenTax',
	'yields',
	'borrowed',
	'activeUsers',
	'newUsers',
	'txCount',
	'gasUsed'
] as const satisfies readonly (keyof IProtocolMetadata)[]

type ProtocolFlag = (typeof PROTOCOL_FLAG_KEYS)[number]
type ProtocolFlags = Partial<Record<ProtocolFlag, true>>
type ChainFlags = IChainMetadata

type ProtocolRecord = {
	slug: string
	displayName?: string
	chains?: string[]
	builderMetrics: Set<BuilderMetric>
	flags: ProtocolFlags
}

type ChainRecord = {
	name: string
	id?: string
	gecko_id?: string
	tokenSymbol?: string
	flags: ChainFlags
}

type AppMetadataContextType = {
	loading: boolean
	error?: string
	protocolsBySlug: Map<string, ProtocolRecord>
	hasProtocolBuilderMetric: (slug: string, metric: BuilderMetric) => boolean
	availableProtocolChartTypes: (slug: string, opts?: { hasGeckoId?: boolean }) => string[]
	chainsByName: Map<string, ChainRecord>
	availableChainChartTypes: (chainName: string, opts?: { hasGeckoId?: boolean }) => string[]
}

const AppMetadataContext = createContext<AppMetadataContextType | undefined>(undefined)

const PROTOCOL_FLAG_BY_BUILDER_METRIC: Record<BuilderMetric, ProtocolFlag | null> = {
	tvl: 'tvl',
	fees: 'fees',
	revenue: 'revenue',
	volume: 'dexs',
	perps: 'perps',
	'open-interest': 'openInterest',
	'options-notional': 'optionsNotionalVolume',
	'options-premium': 'optionsPremiumVolume',
	'bridge-aggregators': 'bridgeAggregators',
	'dex-aggregators': 'dexAggregators',
	'perps-aggregators': 'perpsAggregators',
	'user-fees': 'fees',
	'holders-revenue': 'holdersRevenue',
	'protocol-revenue': 'revenue',
	'supply-side-revenue': 'fees',
	stablecoins: 'stablecoins',
	'chain-fees': null,
	'chain-revenue': null
}

async function fetchJson<T>(url: string): Promise<T> {
	const res = await fetch(url)
	if (!res.ok) throw new Error(`${url} -> ${res.status}`)
	return res.json()
}

export function buildProtocolMetadataIndex(protocolsRaw: Record<string, IProtocolMetadata>) {
	const aggregatedProtocols = new Map<string, { flags: ProtocolFlags; chains: Set<string>; displayName?: string }>()

	for (const key in protocolsRaw) {
		const item = protocolsRaw[key]
		const slug = item.name
		if (!slug) continue

		let aggregate = aggregatedProtocols.get(slug)
		if (!aggregate) {
			aggregate = { flags: {}, chains: new Set<string>() }
			aggregatedProtocols.set(slug, aggregate)
		}
		if (item.chains) {
			for (const chain of item.chains) aggregate.chains.add(chain)
		}
		if (item.displayName && !aggregate.displayName) aggregate.displayName = item.displayName
		for (const flag of PROTOCOL_FLAG_KEYS) {
			if (item[flag]) aggregate.flags[flag] = true
		}
	}

	const protocolsBySlug = new Map<string, ProtocolRecord>()
	for (const [slug, aggregate] of aggregatedProtocols) {
		const builderMetrics = new Set<BuilderMetric>()
		for (const metric in PROTOCOL_FLAG_BY_BUILDER_METRIC) {
			const flagKey = PROTOCOL_FLAG_BY_BUILDER_METRIC[metric as BuilderMetric]
			if (flagKey && aggregate.flags[flagKey]) builderMetrics.add(metric as BuilderMetric)
		}
		const record: ProtocolRecord = {
			slug,
			displayName: aggregate.displayName,
			chains: Array.from(aggregate.chains),
			builderMetrics,
			flags: aggregate.flags
		}
		protocolsBySlug.set(slug, record)
		protocolsBySlug.set(slug.toLowerCase(), record)
	}

	return protocolsBySlug
}

export function AppMetadataProvider({
	children,
	initialData
}: {
	children: React.ReactNode
	initialData?: ProDashboardAppMetadata | null
}) {
	const streamDone = useContext(StreamDoneContext)
	const [mountedAt] = useState(Date.now)
	const {
		data: rawData,
		isLoading: loading,
		error: queryError
	} = useQuery({
		queryKey: ['pro-dashboard', 'app-metadata'],
		queryFn: async () => {
			const fetchPfPs = async (): Promise<{ pf: string[]; ps: string[] }> => {
				try {
					const res = await fetch('/api/public/pro-dashboard/pf-ps-protocols')
					if (!res.ok) return { pf: [], ps: [] }
					return res.json()
				} catch {
					return { pf: [], ps: [] }
				}
			}

			const [protocols, chains, pfPs] = await Promise.all([
				fetchJson<Record<string, IProtocolMetadata>>('https://api.llama.fi/config/smol/appMetadata-protocols.json'),
				fetchJson<Record<string, IChainMetadata>>('https://api.llama.fi/config/smol/appMetadata-chains.json'),
				fetchPfPs()
			])

			return { protocols, chains, pfPs }
		},
		initialData: initialData ?? undefined,
		staleTime: initialData ? Infinity : 0,
		initialDataUpdatedAt: initialData ? mountedAt : undefined,
		enabled: streamDone || !!initialData
	})

	const error = queryError ? String(queryError.message) : undefined
	const protocolsRaw = rawData?.protocols ?? null
	const chainsRaw = rawData?.chains ?? null
	const pfPsRaw = rawData?.pfPs
	const pfPsProtocols = useMemo(
		() => ({
			pf: new Set<string>(pfPsRaw?.pf || []),
			ps: new Set<string>(pfPsRaw?.ps || [])
		}),
		[pfPsRaw]
	)

	const { protocolsBySlug, chainsByName } = useMemo(() => {
		const protocolsBySlug = protocolsRaw ? buildProtocolMetadataIndex(protocolsRaw) : new Map<string, ProtocolRecord>()
		const chainsByName = new Map<string, ChainRecord>()

		if (chainsRaw) {
			for (const key in chainsRaw) {
				const item = chainsRaw[key]
				const name = item.name
				if (!name) continue
				const record: ChainRecord = {
					name,
					id: item.id,
					gecko_id: item.gecko_id,
					tokenSymbol: item.tokenSymbol,
					flags: item
				}
				chainsByName.set(name, record)
				chainsByName.set(name.toLowerCase(), record)
				// TODO(chain-normalizer): legacy saved chart-builder configs can
				// reference old display aliases. Remove after configs are migrated.
				const aliases = getDisplayAliases(name)
				for (const alias of aliases) {
					chainsByName.set(alias, record)
				}
			}
		}

		return { protocolsBySlug, chainsByName }
	}, [protocolsRaw, chainsRaw])

	const hasProtocolBuilderMetric = useCallback(
		(slug: string, metric: BuilderMetric) => {
			const rec = protocolsBySlug.get(slug) ?? protocolsBySlug.get(slug.toLowerCase())
			return rec ? rec.builderMetrics.has(metric) : false
		},
		[protocolsBySlug]
	)

	const availableProtocolChartTypes = useCallback(
		(slug: string, opts?: { hasGeckoId?: boolean }) => {
			const record = protocolsBySlug.get(slug) ?? protocolsBySlug.get(slug.toLowerCase())
			const flags = record?.flags
			if (!flags) return []
			const types = new Set<string>()
			if (flags.tvl) types.add('tvl')
			if (flags.dexs) types.add('volume')
			if (flags.fees) types.add('fees')
			if (flags.revenue) types.add('revenue')
			if (flags.emissions || flags.incentives) {
				types.add('incentives')
				types.add('unlocks')
			}
			if (flags.liquidity) types.add('liquidity')
			if (flags.treasury) types.add('treasury')
			if (flags.holdersRevenue) types.add('holdersRevenue')
			if (flags.bribeRevenue) types.add('bribes')
			if (flags.tokenTax) types.add('tokenTax')
			if (flags.perps) types.add('perps')
			if (flags.openInterest) types.add('openInterest')
			if (flags.dexAggregators) types.add('aggregators')
			if (flags.perpsAggregators) types.add('perpsAggregators')
			if (flags.bridgeAggregators) types.add('bridgeAggregators')
			if (flags.optionsPremiumVolume) types.add('optionsPremium')
			if (flags.optionsNotionalVolume) types.add('optionsNotional')
			if (flags.activeUsers) types.add('activeUsers')
			if (flags.newUsers) types.add('newUsers')
			if (flags.txCount) types.add('txs')
			if (flags.gasUsed) types.add('gasUsed')
			if (flags.yields) types.add('medianApy')
			if (flags.borrowed) types.add('borrowed')
			if (opts?.hasGeckoId) {
				types.add('tokenMcap')
				types.add('tokenPrice')
				types.add('tokenVolume')
			}
			if (pfPsProtocols.pf.has(slug) || pfPsProtocols.pf.has(slug.toLowerCase())) {
				types.add('pfRatio')
			}
			if (pfPsProtocols.ps.has(slug) || pfPsProtocols.ps.has(slug.toLowerCase())) {
				types.add('psRatio')
			}
			const allowed = new Set(getProtocolChartTypes())
			return Array.from(types).filter((t) => allowed.has(t))
		},
		[protocolsBySlug, pfPsProtocols.pf, pfPsProtocols.ps]
	)

	const availableChainChartTypes = useCallback(
		(chainName: string, opts?: { hasGeckoId?: boolean }) =>
			getAvailableChainChartTypes(chainsByName.get(chainName)?.flags, opts),
		[chainsByName]
	)

	const value: AppMetadataContextType = useMemo(
		() => ({
			loading,
			error,
			protocolsBySlug,
			hasProtocolBuilderMetric,
			availableProtocolChartTypes,
			chainsByName,
			availableChainChartTypes
		}),
		[
			loading,
			error,
			protocolsBySlug,
			chainsByName,
			availableProtocolChartTypes,
			availableChainChartTypes,
			hasProtocolBuilderMetric
		]
	)

	return <AppMetadataContext.Provider value={value}>{children}</AppMetadataContext.Provider>
}

export function useAppMetadata() {
	const ctx = useContext(AppMetadataContext)
	if (!ctx) throw new Error('useAppMetadata must be used within an AppMetadataProvider')
	return ctx
}
