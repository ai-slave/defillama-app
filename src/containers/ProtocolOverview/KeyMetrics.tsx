import { useMemo, useRef, useState } from 'react'
import { KeyMetricsPngExportButton } from '~/components/KeyMetricsPngExport/KeyMetricsPngExportButton'
import { BasicLink } from '~/components/Link'
import { ReportIncorrectData } from '~/components/ReportIncorrectData'
import { RaisesTotal } from '~/containers/Raises/RaisesTotal'
import { summarizeRaises } from '~/containers/Raises/summary'
import { definitions } from '~/public/definitions'
import { KeyMetricsFooter, KeyMetricsHeader } from '~/ui/KeyMetricsCard'
import { MetricRow, MetricSection, SubMetricRow, SubMetricSection } from '~/ui/MetricPrimitives'
import { formatDate } from '~/utils/dateFormat'
import { formatUsd, formatCompactNumber } from '~/utils/numberFormat'
import { getProtocolBridgeVolumeMetrics } from './chartSeries.utils'
import { getPrimaryValueLabelType } from './helpers'
import { getProtocolPrimaryMetricOverride } from './primaryMetricOverrides'
import type { IProtocolOverviewPageData } from './types'

type KeyMetricsRequiredFields = Pick<IProtocolOverviewPageData, 'name' | 'metrics' | 'isOracleProtocol' | 'oracleTvs'>

type KeyMetricsOptionalFields = Partial<
	Pick<
		IProtocolOverviewPageData,
		| 'category'
		| 'hasKeyMetrics'
		| 'currentTvlByChain'
		| 'openSmolStatsSummaryByDefault'
		| 'token'
		| 'tokenCGData'
		| 'outstandingFDV'
		| 'dexVolume'
		| 'dexNotionalVolume'
		| 'dexAggregatorVolume'
		| 'perpVolume'
		| 'perpAggregatorVolume'
		| 'bridgeAggregatorVolume'
		| 'optionsPremiumVolume'
		| 'optionsNotionalVolume'
		| 'liquidationVolume'
		| 'collateralLiquidated'
		| 'openInterest'
		| 'fees'
		| 'revenue'
		| 'holdersRevenue'
		| 'incentives'
		| 'bridgeVolume'
		| 'expenses'
		| 'treasury'
		| 'raises'
	>
>

export interface IKeyMetricsProps extends KeyMetricsRequiredFields, KeyMetricsOptionalFields {
	formatPrice: (value: number | null) => string | number | null
	tvl?: number
	tvlByChain?: Array<[string, number]>
	computedOracleTvs?: number | null
	hasTvlData?: boolean
}

type AdapterOverviewKey =
	| 'dexVolume'
	| 'dexNotionalVolume'
	| 'dexAggregatorVolume'
	| 'perpVolume'
	| 'perpAggregatorVolume'
	| 'bridgeAggregatorVolume'
	| 'optionsPremiumVolume'
	| 'optionsNotionalVolume'
	| 'liquidationVolume'
	| 'collateralLiquidated'

interface StandardMetricConfig {
	dataProp: AdapterOverviewKey
	definitionKey:
		| 'dexs'
		| 'dexsNotional'
		| 'dexAggregators'
		| 'perps'
		| 'perpsAggregators'
		| 'bridgeAggregators'
		| 'optionsPremium'
		| 'optionsNotional'
		| 'liquidationVolume'
		| 'collateralLiquidated'
	label: string
	dataType: string
}

const STANDARD_METRICS: Array<StandardMetricConfig> = [
	{ dataProp: 'dexVolume', definitionKey: 'dexs', label: 'DEX Volume', dataType: 'DEX Volume' },
	{
		dataProp: 'dexNotionalVolume',
		definitionKey: 'dexsNotional',
		label: 'DEX Notional Volume',
		dataType: 'DEX Notional Volume'
	},
	{
		dataProp: 'dexAggregatorVolume',
		definitionKey: 'dexAggregators',
		label: 'DEX Aggregator Volume',
		dataType: 'DEX Aggregator Volume'
	},
	{ dataProp: 'perpVolume', definitionKey: 'perps', label: 'Perp Volume', dataType: 'Perp Volume' },
	{
		dataProp: 'perpAggregatorVolume',
		definitionKey: 'perpsAggregators',
		label: 'Perp Aggregator Volume',
		dataType: 'Perp Aggregator Volume'
	},
	{
		dataProp: 'bridgeAggregatorVolume',
		definitionKey: 'bridgeAggregators',
		label: 'Bridge Aggregator Volume',
		dataType: 'Bridge Aggregator Volume'
	},
	{
		dataProp: 'optionsPremiumVolume',
		definitionKey: 'optionsPremium',
		label: 'Options Premium Volume',
		dataType: 'Options Premium Volume'
	},
	{
		dataProp: 'optionsNotionalVolume',
		definitionKey: 'optionsNotional',
		label: 'Options Notional Volume',
		dataType: 'Options Notional Volume'
	},
	{
		dataProp: 'liquidationVolume',
		definitionKey: 'liquidationVolume',
		label: 'Liquidation Volume',
		dataType: 'Liquidation Volume'
	},
	{
		dataProp: 'collateralLiquidated',
		definitionKey: 'collateralLiquidated',
		label: 'Collateral Liquidated',
		dataType: 'Collateral Liquidated'
	}
]

const ANNUALIZATION_FACTOR = 12.2

interface VolumeMetric {
	name: string
	tooltipContent?: string | undefined
	value: number
	chainBreakdown?: Record<string, number> | null
}

function buildStandardVolumeMetrics(
	data: {
		total30d?: number | null
		total7d?: number | null
		total24h?: number | null
		totalAllTime?: number | null
		chainBreakdown?: Record<
			string,
			{ total24h: number | null; total7d: number | null; total30d: number | null; totalAllTime: number | null }
		> | null
	},
	definitionKey: StandardMetricConfig['definitionKey'],
	label: string
) {
	const defs = definitions[definitionKey].protocol
	const cb = data.chainBreakdown
	const metrics: Array<VolumeMetric> = []

	if (data.total30d != null) {
		metrics.push({
			name: `${label} 30d`,
			tooltipContent: defs?.['30d'],
			value: data.total30d,
			chainBreakdown: cb ? extractChainValues(cb, 'total30d') : null
		})
	}
	if (data.total7d != null) {
		metrics.push({
			name: `${label} 7d`,
			tooltipContent: defs?.['7d'],
			value: data.total7d,
			chainBreakdown: cb ? extractChainValues(cb, 'total7d') : null
		})
	}
	if (data.total24h != null) {
		metrics.push({
			name: `${label} 24h`,
			tooltipContent: defs?.['24h'],
			value: data.total24h,
			chainBreakdown: cb ? extractChainValues(cb, 'total24h') : null
		})
	}
	if (data.totalAllTime != null) {
		metrics.push({
			name: `Cumulative ${label}`,
			tooltipContent: defs?.['cumulative'],
			value: data.totalAllTime,
			chainBreakdown: cb ? extractChainValues(cb, 'totalAllTime') : null
		})
	}

	return metrics
}

function extractChainValues(
	cb: Record<
		string,
		{ total24h: number | null; total7d: number | null; total30d: number | null; totalAllTime: number | null }
	>,
	key: 'total24h' | 'total7d' | 'total30d' | 'totalAllTime'
): Record<string, number> | null {
	const sortedEntries: Array<[string, number]> = []
	for (const chain in cb) {
		const chainData = cb[chain]
		if (chainData === undefined) continue
		const value = chainData[key]
		if (value != null) {
			sortedEntries.push([chain, value])
		}
	}

	sortedEntries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))

	return sortedEntries.length > 0 ? Object.fromEntries(sortedEntries) : null
}

export function KeyMetrics(props: IKeyMetricsProps) {
	const containerRef = useRef<HTMLDivElement>(null)

	if (!props.hasKeyMetrics) return null

	const primaryMetricOverride = getProtocolPrimaryMetricOverride(props)
	const primaryValue = primaryMetricOverride?.value ?? (props.isOracleProtocol ? props.computedOracleTvs : props.tvl)
	const { title: defaultPrimaryLabel } = getPrimaryValueLabelType(props.isOracleProtocol ? 'Oracle' : props.category)
	const primaryLabel = primaryMetricOverride?.title ?? defaultPrimaryLabel
	const hasTvlData =
		props.hasTvlData !== undefined
			? props.hasTvlData
			: props.currentTvlByChain !== undefined && props.currentTvlByChain !== null

	const hasPrimaryMetricData =
		primaryMetricOverride != null || (props.isOracleProtocol ? props.oracleTvs != null : hasTvlData)

	return (
		<div className="flex flex-1 flex-col gap-2">
			<KeyMetricsHeader id="key-metrics" />
			<div className="flex flex-col" ref={containerRef}>
				{props.isOracleProtocol && hasTvlData && props.tvl != null ? <TVL {...props} tvl={props.tvl} /> : null}
				<Fees {...props} />
				<Revenue {...props} />
				<HoldersRevenue {...props} />
				<Incentives {...props} />
				<Earnings {...props} />
				{STANDARD_METRICS.map((config) => {
					if (config.dataProp === primaryMetricOverride?.source) return null
					const data = props[config.dataProp]
					if (!data) return null
					const metrics = buildStandardVolumeMetrics(data, config.definitionKey, config.label)
					if (metrics.length === 0) return null
					return (
						<SmolStats
							key={config.dataType}
							data={metrics}
							protocolName={props.name}
							formatPrice={props.formatPrice}
							openSmolStatsSummaryByDefault={props.openSmolStatsSummaryByDefault}
							dataType={config.dataType}
						/>
					)
				})}
				{props.openInterest?.total24h != null ? (
					<SmolStats
						data={[
							{
								name: 'Open Interest',
								tooltipContent: definitions.openInterest.protocol,
								value: props.openInterest.total24h,
								chainBreakdown: props.openInterest.chainBreakdown
									? extractChainValues(props.openInterest.chainBreakdown, 'total24h')
									: null
							}
						]}
						protocolName={props.name}
						formatPrice={props.formatPrice}
						openSmolStatsSummaryByDefault={props.openSmolStatsSummaryByDefault}
						dataType="Open Interest"
					/>
				) : null}
				<BridgeVolume {...props} />
				<TokenCGData {...props} />
				{props.currentTvlByChain?.staking != null ? (
					<MetricRow
						label="Staked"
						valueClassName="ml-auto"
						value={
							props.tokenCGData?.marketCap?.current != null && props.tokenCGData.marketCap.current > 0 ? (
								<span className="flex items-center gap-1">
									<span className="font-jetbrains">{props.formatPrice(props.currentTvlByChain.staking)}</span>
									<span className="text-xs text-tertiary">
										(
										{formatCompactNumber(
											(props.currentTvlByChain.staking / props.tokenCGData.marketCap.current) * 100,
											{ minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }
										)}
										% of mcap)
									</span>
								</span>
							) : (
								<span className="font-jetbrains">{props.formatPrice(props.currentTvlByChain.staking)}</span>
							)
						}
					/>
				) : null}
				{props.currentTvlByChain?.borrowed != null ? (
					<MetricRow label="Active Loans" value={props.formatPrice(props.currentTvlByChain.borrowed)} />
				) : null}
				<Treasury {...props} />
				<Raises {...props} />
				<Expenses {...props} />
			</div>
			<KeyMetricsFooter>
				<ReportIncorrectData
					subject={{ type: 'protocol', name: props.name, isLending: props.category === 'Lending' }}
				/>
				<KeyMetricsPngExportButton
					containerRef={containerRef}
					title={props.name}
					iconUrl={`/api/public/protocol-icon?slug=${encodeURIComponent(props.name)}`}
					primaryValue={hasPrimaryMetricData ? (primaryValue ?? null) : null}
					primaryLabel={primaryLabel}
					formatPrice={props.formatPrice}
				/>
			</KeyMetricsFooter>
		</div>
	)
}

function TVL(props: IKeyMetricsProps & { tvl: number }) {
	const tvl = props.tvl
	const tvlByChain = props.tvlByChain

	const metrics = useMemo(() => {
		const metrics = []
		metrics.push({
			name: 'Total Value Locked',
			tooltipContent: "Total value locked in protocol's smart contracts",
			value: tvl
		})

		if (tvlByChain) {
			for (const [chain, chainTvl] of tvlByChain) {
				metrics.push({
					name: chain,
					value: chainTvl
				})
			}
		}

		return metrics
	}, [tvl, tvlByChain])

	if (metrics.length === 0) return null

	return (
		<SmolStats
			data={metrics}
			protocolName={props.name}
			formatPrice={props.formatPrice}
			openSmolStatsSummaryByDefault={props.openSmolStatsSummaryByDefault}
			dataType="TVL"
		/>
	)
}

// ============================================
// Metric Builders
// ============================================

interface MetricDefinition {
	annualized?: string
	'1y'?: string
	'30d'?: string
	'7d'?: string
	'24h'?: string
	cumulative?: string
	runRate?: string
}

interface MetricConfig {
	total30d?: number | null
	total1y?: number | null
	annualized1y?: number | null
	total7d?: number | null
	total24h?: number | null
	totalAllTime?: number | null
	emissions30d?: number | null
	emissions1y?: number | null
	emissions7d?: number | null
	emissions24h?: number | null
	emissionsAllTime?: number | null
}

type ChainBreakdownMap = Record<
	string,
	{ total24h: number | null; total7d: number | null; total30d: number | null; totalAllTime: number | null }
> | null

const buildMetrics = (
	data: MetricConfig,
	defs: MetricDefinition,
	label: string,
	isIncentives = false,
	chainBreakdown?: ChainBreakdownMap
): Array<VolumeMetric> => {
	const metrics: Array<VolumeMetric> = []
	const prefix = isIncentives ? 'Incentives' : label
	const cb = chainBreakdown ?? null

	if (isIncentives) {
		if (data.emissions1y != null) {
			metrics.push({
				name: `${prefix} 1y`,
				tooltipContent: defs?.['1y'],
				value: data.emissions1y
			})
		} else if (data.emissions30d != null) {
			metrics.push({
				name: `${prefix} (30d Run Rate)`,
				tooltipContent: defs?.runRate,
				value: data.emissions30d * ANNUALIZATION_FACTOR
			})
		}
		if (data.emissions30d != null) {
			metrics.push({ name: `${prefix} 30d`, tooltipContent: defs?.['30d'], value: data.emissions30d })
		}
		if (data.emissions7d != null) {
			metrics.push({ name: `${prefix} 7d`, tooltipContent: defs?.['7d'], value: data.emissions7d })
		}
		if (data.emissions24h != null) {
			metrics.push({ name: `${prefix} 24h`, tooltipContent: defs?.['24h'], value: data.emissions24h })
		}
		if (data.emissionsAllTime != null) {
			metrics.push({ name: `Cumulative ${prefix}`, tooltipContent: defs?.cumulative, value: data.emissionsAllTime })
		}
	} else {
		if (data.total30d != null) {
			metrics.push({
				name: `${label} 30d`,
				tooltipContent: defs?.['30d'],
				value: data.total30d,
				chainBreakdown: cb ? extractChainValues(cb, 'total30d') : null
			})
		}
		if (data.total7d != null) {
			metrics.push({
				name: `${label} 7d`,
				tooltipContent: defs?.['7d'],
				value: data.total7d,
				chainBreakdown: cb ? extractChainValues(cb, 'total7d') : null
			})
		}
		if (data.total24h != null) {
			metrics.push({
				name: `${label} 24h`,
				tooltipContent: defs?.['24h'],
				value: data.total24h,
				chainBreakdown: cb ? extractChainValues(cb, 'total24h') : null
			})
		}
		if (data.totalAllTime != null) {
			metrics.push({
				name: `Cumulative ${label}`,
				tooltipContent: defs?.cumulative,
				value: data.totalAllTime,
				chainBreakdown: cb ? extractChainValues(cb, 'totalAllTime') : null
			})
		}
	}

	return metrics
}

function Fees(props: IKeyMetricsProps) {
	if (!props.fees) return null

	const metrics = buildMetrics(props.fees, definitions.fees.protocol, 'Fees', false, props.fees.chainBreakdown)
	if (metrics.length === 0) return null

	return (
		<SmolStats
			data={metrics}
			protocolName={props.name}
			formatPrice={props.formatPrice}
			openSmolStatsSummaryByDefault={props.openSmolStatsSummaryByDefault}
			dataType="Fees"
		/>
	)
}

function Revenue(props: IKeyMetricsProps) {
	if (!props.revenue) return null

	const metrics = buildMetrics(
		props.revenue,
		definitions.revenue.protocol,
		'Revenue',
		false,
		props.revenue.chainBreakdown
	)
	if (metrics.length === 0) return null

	return (
		<SmolStats
			data={metrics}
			protocolName={props.name}
			formatPrice={props.formatPrice}
			openSmolStatsSummaryByDefault={props.openSmolStatsSummaryByDefault}
			dataType="Revenue"
		/>
	)
}

function HoldersRevenue(props: IKeyMetricsProps) {
	if (!props.holdersRevenue) return null

	const metrics = buildMetrics(
		props.holdersRevenue,
		definitions.holdersRevenue.protocol,
		'Holders Revenue',
		false,
		props.holdersRevenue.chainBreakdown
	)
	if (metrics.length === 0) return null

	return (
		<SmolStats
			data={metrics}
			protocolName={props.name}
			formatPrice={props.formatPrice}
			openSmolStatsSummaryByDefault={props.openSmolStatsSummaryByDefault}
			dataType="Holders Revenue"
		/>
	)
}

function Incentives(props: IKeyMetricsProps) {
	if (!props.incentives) return null

	const metrics = buildMetrics(props.incentives, definitions.incentives.protocol, 'Incentives', true)
	if (metrics.length === 0) return null

	return (
		<SmolStats
			data={metrics}
			protocolName={props.name}
			formatPrice={props.formatPrice}
			openSmolStatsSummaryByDefault={props.openSmolStatsSummaryByDefault}
			dataType="Incentives"
		/>
	)
}

function Earnings(props: IKeyMetricsProps) {
	const revenue = props.revenue
	const incentivesData = props.incentives

	if (!incentivesData && !revenue) return null

	const earnings24h =
		revenue?.total24h != null && incentivesData?.emissions24h != null
			? revenue.total24h - incentivesData.emissions24h
			: null
	const earnings7d =
		revenue?.total7d != null && incentivesData?.emissions7d != null
			? revenue.total7d - incentivesData.emissions7d
			: null
	const earnings30d =
		revenue?.total30d != null && incentivesData?.emissions30d != null
			? revenue.total30d - incentivesData.emissions30d
			: null
	const earningsAnnualized1y =
		revenue?.annualized1y != null && incentivesData?.emissions1y != null
			? revenue.annualized1y - incentivesData.emissions1y
			: null
	const earningsAllTime =
		revenue?.totalAllTime != null && incentivesData?.emissionsAllTime != null
			? revenue.totalAllTime - incentivesData.emissionsAllTime
			: null

	const metrics: Array<VolumeMetric> = []

	if (earningsAnnualized1y != null) {
		metrics.push({
			name: 'Earnings (Annualized)',
			tooltipContent: definitions.earnings.protocol.annualized,
			value: earningsAnnualized1y
		})
	} else if (earnings30d != null) {
		metrics.push({
			name: 'Earnings (30d Run Rate)',
			tooltipContent: definitions.earnings.protocol.runRate,
			value: earnings30d * ANNUALIZATION_FACTOR
		})
	}
	if (earnings30d != null) {
		metrics.push({ name: 'Earnings 30d', tooltipContent: definitions.earnings.protocol['30d'], value: earnings30d })
	}
	if (earnings7d != null) {
		metrics.push({ name: 'Earnings 7d', tooltipContent: definitions.earnings.protocol['7d'], value: earnings7d })
	}
	if (earnings24h != null) {
		metrics.push({ name: 'Earnings 24h', tooltipContent: definitions.earnings.protocol['24h'], value: earnings24h })
	}
	if (earningsAllTime != null) {
		metrics.push({
			name: 'Cumulative Earnings',
			tooltipContent: definitions.earnings.protocol.cumulative,
			value: earningsAllTime
		})
	}

	if (metrics.length === 0) return null

	return (
		<SmolStats
			data={metrics}
			protocolName={props.name}
			formatPrice={props.formatPrice}
			openSmolStatsSummaryByDefault={props.openSmolStatsSummaryByDefault}
			dataType="Earnings"
		/>
	)
}

function BridgeVolume(props: IKeyMetricsProps) {
	const [now] = useState(() => Date.now())

	if (!props.bridgeVolume || props.bridgeVolume.length === 0) return null

	const metrics = []
	const { lastCompletedDay, sevenCompletedDays, thirtyCompletedDays, sinceDataStart } = getProtocolBridgeVolumeMetrics(
		props.bridgeVolume,
		now
	)

	if (thirtyCompletedDays != null) {
		metrics.push({ name: 'Bridge Volume 30 completed days', tooltipContent: null, value: thirtyCompletedDays })
	}
	if (sevenCompletedDays != null) {
		metrics.push({ name: 'Bridge Volume 7 completed days', tooltipContent: null, value: sevenCompletedDays })
	}
	if (lastCompletedDay != null) {
		metrics.push({ name: 'Bridge Volume last completed day', tooltipContent: null, value: lastCompletedDay })
	}
	if (sinceDataStart != null) {
		metrics.push({ name: 'Bridge Volume since data start', tooltipContent: null, value: sinceDataStart })
	}

	if (metrics.length === 0) return null

	return (
		<SmolStats
			data={metrics}
			protocolName={props.name}
			formatPrice={props.formatPrice}
			openSmolStatsSummaryByDefault={props.openSmolStatsSummaryByDefault}
			dataType="Bridge Volume"
		/>
	)
}

function SmolStats({
	data,
	protocolName,
	formatPrice,
	openSmolStatsSummaryByDefault = false
}: {
	data: Array<{
		name: string
		tooltipContent?: string | null | undefined
		value: number
		chainBreakdown?: Record<string, number> | null
	}>
	protocolName: string
	formatPrice: (value: number | null) => string | number | null
	openSmolStatsSummaryByDefault?: boolean | undefined
	dataType: string
}) {
	const restOfData = useMemo(() => data.slice(1), [data])
	const primary = data[0]
	if (!primary) return null

	if (data.length === 1 && !primary.chainBreakdown) {
		return (
			<MetricRow
				label={primary.name}
				{...(primary.tooltipContent != null ? { tooltip: primary.tooltipContent } : {})}
				value={formatPrice(primary.value)}
			/>
		)
	}

	return (
		<MetricSection
			label={primary.name}
			{...(primary.tooltipContent != null ? { tooltip: primary.tooltipContent } : {})}
			value={formatPrice(primary.value)}
			defaultOpen={openSmolStatsSummaryByDefault}
		>
			{primary.chainBreakdown ? (
				<SubMetricSection key={`${primary.name}-chains-${protocolName}`} label={`${primary.name} by chain`}>
					{renderChainRows({
						chains: primary.chainBreakdown,
						protocolName,
						formatPrice,
						keySuffix: primary.name
					})}
				</SubMetricSection>
			) : null}
			{restOfData.map((metric) => (
				<ChainBreakdownMetricRow
					key={`${metric.name}-${metric.value}-${protocolName}`}
					metric={metric}
					protocolName={protocolName}
					formatPrice={formatPrice}
				/>
			))}
		</MetricSection>
	)
}

function ChainBreakdownMetricRow({
	metric,
	protocolName,
	formatPrice
}: {
	metric: {
		name: string
		tooltipContent?: string | null | undefined
		value: number
		chainBreakdown?: Record<string, number> | null
	}
	protocolName: string
	formatPrice: (value: number | null) => string | number | null
}) {
	if (!metric.chainBreakdown) {
		return (
			<SubMetricRow
				label={metric.name}
				{...(metric.tooltipContent != null ? { tooltip: metric.tooltipContent } : {})}
				value={formatPrice(metric.value)}
			/>
		)
	}
	return (
		<SubMetricSection label={metric.name} value={formatPrice(metric.value)}>
			{renderChainRows({ chains: metric.chainBreakdown, protocolName, formatPrice, keySuffix: metric.name })}
		</SubMetricSection>
	)
}

function renderChainRows({
	chains,
	protocolName,
	formatPrice,
	keySuffix
}: {
	chains: Record<string, number>
	protocolName: string
	formatPrice: (value: number | null) => string | number | null
	keySuffix: string
}) {
	const rows = []
	for (const chain in chains) {
		const value = chains[chain]
		if (value === undefined) continue
		rows.push(<SubMetricRow key={`${chain}-${keySuffix}-${protocolName}`} label={chain} value={formatPrice(value)} />)
	}
	return rows
}

function Treasury(props: IKeyMetricsProps) {
	if (!props.treasury) return null
	return (
		<MetricSection
			label="Treasury"
			value={formatUsd(props.treasury.total, {
				compact: true,
				minimumCompactValue: 1_000_000,
				compactSuffix: 'lowercase'
			})}
		>
			{props.treasury.majors != null ? (
				<SubMetricRow
					label="Majors"
					tooltip="BTC, ETH"
					value={formatUsd(props.treasury.majors, {
						compact: true,
						minimumCompactValue: 1_000_000,
						compactSuffix: 'lowercase'
					})}
				/>
			) : null}
			{props.treasury.stablecoins != null ? (
				<SubMetricRow
					label="Stablecoins"
					value={formatUsd(props.treasury.stablecoins, {
						compact: true,
						minimumCompactValue: 1_000_000,
						compactSuffix: 'lowercase'
					})}
				/>
			) : null}
			{props.treasury.ownTokens != null ? (
				<SubMetricRow
					label="Own Tokens"
					value={formatUsd(props.treasury.ownTokens, {
						compact: true,
						minimumCompactValue: 1_000_000,
						compactSuffix: 'lowercase'
					})}
				/>
			) : null}
			{props.treasury.others != null ? (
				<SubMetricRow
					label="Others"
					value={formatUsd(props.treasury.others, {
						compact: true,
						minimumCompactValue: 1_000_000,
						compactSuffix: 'lowercase'
					})}
				/>
			) : null}
		</MetricSection>
	)
}

function Expenses(props: IKeyMetricsProps) {
	if (!props.expenses) return null
	return (
		<MetricSection label="Annual Operational Expenses" value={props.formatPrice(props.expenses.total)}>
			<MetricRow
				label="Headcount"
				value={
					props.expenses.headcount != null
						? formatCompactNumber(props.expenses.headcount, {
								minimumCompactValue: 1_000_000,
								compactSuffix: 'lowercase'
							})
						: '\u2014'
				}
			/>
			{props.expenses.annualUsdCost.map(([category, amount]) => (
				<p
					className="flex flex-col gap-1 border-b border-dashed border-subtle py-1 group-last:border-none"
					key={`${props.name}-expenses-${category}-${amount}`}
				>
					<span className="flex flex-wrap justify-between">
						<span className="text-secondary">{category}</span>
						<span className="font-jetbrains">{props.formatPrice(amount)}</span>
					</span>
				</p>
			))}
			{props.expenses.sources?.length ? (
				<p className="flex flex-wrap justify-between gap-4 border-b border-dashed border-subtle py-1 text-secondary group-last:border-none">
					<span className="text-secondary">Sources</span>
					{props.expenses.sources.map((source) => (
						<a
							href={source}
							target="_blank"
							rel="noopener noreferrer"
							key={`${props.name}-expenses-source-${source}`}
							className="hover:underline"
						>
							{source}
						</a>
					))}
				</p>
			) : null}
			{props.expenses.notes?.length ? (
				<p className="flex flex-wrap justify-between gap-4 border-b border-dashed border-subtle py-1 text-secondary group-last:border-none">
					<span className="text-secondary">Notes</span>
					<span>{props.expenses.notes.join(', ')}</span>
				</p>
			) : null}
			{props.expenses.lastUpdate ? (
				<p className="flex flex-wrap justify-between gap-4 border-b border-dashed border-subtle py-1 text-secondary group-last:border-none">
					<span className="text-secondary">Last Update</span>
					<span>{formatDate(props.expenses.lastUpdate)}</span>
				</p>
			) : null}
		</MetricSection>
	)
}

function TokenCGData(props: IKeyMetricsProps) {
	if (!props.tokenCGData) return null
	const priceLabel = `${props.token?.symbol ? `$${props.token.symbol}` : 'Token'} Price`
	const linkedPriceLabel = props.token?.tokenPageRoute ? (
		<BasicLink href={props.token.tokenPageRoute} className="text-link hover:underline">
			{priceLabel}
		</BasicLink>
	) : (
		priceLabel
	)
	return (
		<>
			{props.tokenCGData.marketCap.current != null ? (
				<MetricRow label="Market Cap" value={props.formatPrice(props.tokenCGData.marketCap.current)} />
			) : null}
			{props.tokenCGData.price.current != null ? (
				props.tokenCGData.price.ath != null || props.tokenCGData.price.atl != null ? (
					/* A <summary> cannot contain a link, so the accordion label stays
					   plain text and the token-page link lives in the expanded body. */
					<MetricSection label={priceLabel} value={props.formatPrice(props.tokenCGData.price.current)}>
						<SubMetricRow label="All Time High" value={props.formatPrice(props.tokenCGData.price.ath)} />
						<SubMetricRow label="All Time Low" value={props.formatPrice(props.tokenCGData.price.atl)} />
						{props.token?.tokenPageRoute ? (
							<BasicLink
								href={props.token.tokenPageRoute}
								className="py-1 label-sm text-link hover:underline"
							>{`View ${priceLabel.replace(' Price', '')} token page`}</BasicLink>
						) : null}
					</MetricSection>
				) : (
					<MetricRow label={linkedPriceLabel} value={props.formatPrice(props.tokenCGData.price.current)} />
				)
			) : null}
			{props.tokenCGData.fdv.current != null ? (
				<MetricRow
					label="Fully Diluted Valuation"
					tooltip={
						"Fully Diluted Valuation, this is calculated by taking the expected maximum supply of the token and multiplying it by the price. It's mainly used to calculate the hypothetical marketcap of the token if all the tokens were unlocked and circulating.\n\nData for this metric is imported directly from coingecko."
					}
					value={props.formatPrice(props.tokenCGData.fdv.current)}
				/>
			) : null}
			{props.outstandingFDV != null ? (
				<MetricRow
					label="Outstanding FDV"
					tooltip={
						'Outstanding FDV is calculated by taking the outstanding supply of the token and multiplying it by the price.\n\nOutstanding supply is the total supply minus the supply that is not yet allocated to anything (eg coins in treasury or reserve).'
					}
					value={props.formatPrice(props.outstandingFDV)}
				/>
			) : null}
			{props.tokenCGData.volume24h?.total != null ? (
				<MetricSection
					label={`${props.token?.symbol ? `$${props.token.symbol}` : 'Token'} Volume 24h`}
					value={props.formatPrice(props.tokenCGData.volume24h.total)}
				>
					<SubMetricRow
						label="CEX Volume"
						value={props.tokenCGData.volume24h.cex != null ? props.formatPrice(props.tokenCGData.volume24h.cex) : '-'}
					/>
					<SubMetricRow
						label="DEX Volume"
						valueClassName="ml-auto"
						value={
							<span className="flex items-center gap-1">
								<span className="font-jetbrains">
									{props.tokenCGData.volume24h.dex != null ? props.formatPrice(props.tokenCGData.volume24h.dex) : '-'}
								</span>
								{props.tokenCGData.volume24h.dex != null && props.tokenCGData.volume24h.total > 0 ? (
									<span className="text-xs text-tertiary">
										(
										{formatCompactNumber((props.tokenCGData.volume24h.dex / props.tokenCGData.volume24h.total) * 100, {
											minimumCompactValue: 1_000_000,
											compactSuffix: 'lowercase'
										})}
										% of total)
									</span>
								) : null}
							</span>
						}
					/>
				</MetricSection>
			) : null}
		</>
	)
}

function Raises(props: IKeyMetricsProps) {
	if (!props.raises || props.raises.length === 0) return null
	return (
		<MetricSection label="Total Raised" value={<RaisesTotal {...summarizeRaises(props.raises)} />}>
			{props.raises.map((raise) => (
				<p
					className="flex flex-col gap-1 border-b border-dashed border-subtle py-1 group-last:border-none"
					key={`${raise.date}-${raise.amountUsd}-${props.name}`}
				>
					<span className="flex flex-wrap justify-between">
						<span className="text-secondary">{formatDate(raise.date, { input: 'seconds' })}</span>
						{raise.amountUsd != null ? (
							<span className="font-jetbrains">
								{formatUsd(raise.amountUsd, {
									compact: true,
									minimumCompactValue: 1_000_000,
									compactSuffix: 'lowercase'
								})}
							</span>
						) : null}
					</span>
					<span className="flex flex-wrap justify-between gap-1 text-secondary">
						<span>Round: {raise.round}</span>
						{raise.leadInvestors.length > 0 || raise.otherInvestors.length > 0 ? (
							<span>Investors: {[...raise.leadInvestors, ...raise.otherInvestors].join(', ')}</span>
						) : null}
					</span>
				</p>
			))}
		</MetricSection>
	)
}
