import { useQuery } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { fetchJson } from '~/utils/async'
import { getDisplayAliases } from '~/utils/chainNormalizer'
import type { IChainMetadata, IProtocolMetadata } from '~/utils/metadata/types'
import { getAvailableChainChartTypes } from './appMetadataChartTypes'
import { StreamDoneContext } from './queries'
import {
	type ChainChartType,
	type ChartBuilderConfig,
	isProtocolDashboardChartType,
	type ProtocolChartType
} from './types'

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
	'treasury',
	'yields',
	'borrowed',
	'activeUsers',
	'newUsers',
	'txCount',
	'gasUsed'
] as const satisfies ReadonlyArray<keyof IProtocolMetadata>

type ProtocolFlag = (typeof PROTOCOL_FLAG_KEYS)[number]
type ProtocolFlags = Partial<Record<ProtocolFlag, true>>

type ProtocolRecord = {
	slug: string
	displayName: string | undefined
	chains: Array<string>
	builderMetrics: Set<BuilderMetric>
	flags: ProtocolFlags
}

type ChainRecord = {
	name: string
	id: string
	gecko_id: string | undefined
	tokenSymbol: string | null | undefined
	flags: IChainMetadata
}

type AppMetadataContextType = {
	loading: boolean
	error: string | undefined
	protocolsBySlug: Map<string, ProtocolRecord>
	hasProtocolBuilderMetric: (slug: string, metric: BuilderMetric) => boolean
	availableProtocolChartTypes: (slug: string, opts?: { hasGeckoId?: boolean }) => Array<ProtocolChartType>
	chainsByName: Map<string, ChainRecord>
	availableChainChartTypes: (chainName: string, opts?: { hasGeckoId?: boolean }) => Array<ChainChartType>
}

type AppMetadataContextValue = AppMetadataContextType & { requestMetadata: () => void }

const AppMetadataContext = createContext<AppMetadataContextValue | undefined>(undefined)

const PROTOCOL_BUILDER_METRIC_FLAGS = [
	['tvl', 'tvl'],
	['fees', 'fees'],
	['revenue', 'revenue'],
	['volume', 'dexs'],
	['perps', 'perps'],
	['open-interest', 'openInterest'],
	['options-notional', 'optionsNotionalVolume'],
	['options-premium', 'optionsPremiumVolume'],
	['bridge-aggregators', 'bridgeAggregators'],
	['dex-aggregators', 'dexAggregators'],
	['perps-aggregators', 'perpsAggregators'],
	['user-fees', 'fees'],
	['holders-revenue', 'holdersRevenue'],
	['protocol-revenue', 'revenue'],
	['supply-side-revenue', 'fees'],
	['stablecoins', 'stablecoins'],
	['chain-fees', null],
	['chain-revenue', null]
] as const satisfies ReadonlyArray<readonly [BuilderMetric, ProtocolFlag | null]>
export function buildProtocolMetadataIndex(protocolsRaw: Record<string, IProtocolMetadata>) {
	const aggregatedProtocols = new Map<string, { flags: ProtocolFlags; chains: Set<string>; displayName?: string }>()

	for (const key in protocolsRaw) {
		const item = protocolsRaw[key]
		if (!item) continue
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
		for (const [metric, flagKey] of PROTOCOL_BUILDER_METRIC_FLAGS) {
			if (flagKey && aggregate.flags[flagKey]) builderMetrics.add(metric)
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

export function AppMetadataProvider({ children }: { children: React.ReactNode }) {
	const streamDone = useContext(StreamDoneContext)
	const [metadataRequested, setMetadataRequested] = useState(false)
	const requestMetadata = useCallback(() => setMetadataRequested(true), [])
	const {
		data: rawData,
		isLoading: loading,
		error: queryError
	} = useQuery({
		queryKey: ['pro-dashboard', 'app-metadata'],
		queryFn: async () => {
			const fetchPfPs = async (): Promise<{ pf: Array<string>; ps: Array<string> }> => {
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
		staleTime: Infinity,
		enabled: streamDone && metadataRequested
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
				if (!item) continue
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
			if (flags.treasury) types.add('treasury')
			if (flags.holdersRevenue) types.add('holdersRevenue')
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
			return Array.from(types).filter(isProtocolDashboardChartType)
		},
		[protocolsBySlug, pfPsProtocols.pf, pfPsProtocols.ps]
	)

	const availableChainChartTypes = useCallback(
		(chainName: string, opts?: { hasGeckoId?: boolean }) =>
			getAvailableChainChartTypes(chainsByName.get(chainName)?.flags, opts),
		[chainsByName]
	)

	const value: AppMetadataContextValue = useMemo(
		() => ({
			loading: !metadataRequested || loading || (!streamDone && rawData === undefined),
			error,
			protocolsBySlug,
			hasProtocolBuilderMetric,
			availableProtocolChartTypes,
			chainsByName,
			availableChainChartTypes,
			requestMetadata
		}),
		[
			metadataRequested,
			loading,
			streamDone,
			rawData,
			error,
			protocolsBySlug,
			chainsByName,
			availableProtocolChartTypes,
			availableChainChartTypes,
			hasProtocolBuilderMetric,
			requestMetadata
		]
	)

	return <AppMetadataContext.Provider value={value}>{children}</AppMetadataContext.Provider>
}

export function useAppMetadata(): AppMetadataContextType {
	const ctx = useContext(AppMetadataContext)
	const requestMetadata = ctx?.requestMetadata
	useEffect(() => requestMetadata?.(), [requestMetadata])
	if (!ctx) throw new Error('useAppMetadata must be used within an AppMetadataProvider')
	return ctx
}
