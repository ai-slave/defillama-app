import { Fragment, useRef, type ReactNode } from 'react'
import { KeyMetricsPngExportButton } from '~/components/KeyMetricsPngExport/KeyMetricsPngExportButton'
import { BasicLink } from '~/components/Link'
import { RaisesTotal } from '~/containers/Raises/RaisesTotal'
import { summarizeRaises } from '~/containers/Raises/summary'
import { definitions as rwaDefinitions } from '~/containers/RWA/definitions'
import { definitions } from '~/public/definitions'
import { Change, formatChange } from '~/ui/Change'
import { KeyMetricsPanel } from '~/ui/KeyMetricsCard'
import {
	MetricRow as ChainMetricRow,
	MetricSection as ChainMetricSection,
	SubMetricRow as ChainSubMetricRow
} from '~/ui/MetricPrimitives'
import { slug } from '~/utils'
import { formatDate } from '~/utils/dateFormat'
import { formatUsd, formatCompactNumber, formatPercent } from '~/utils/numberFormat'
import type { IChainOverviewData } from './types'

const formatKeyMetricsValue = (value: number | string | null) => {
	if (Number.isNaN(Number(value))) return null
	return formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
}

const formatNullableCurrency = (value: number | null | undefined) => {
	if (value == null || Number.isNaN(value)) return 'N/A'
	return formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
}

interface KeyMetricsProps {
	metadata: IChainOverviewData['metadata']
	stablecoins: IChainOverviewData['stablecoins']
	rwaActiveMcap: IChainOverviewData['rwaActiveMcap']
	chainStablecoins: IChainOverviewData['chainStablecoins']
	chainFees: IChainOverviewData['chainFees']
	chainRevenue: IChainOverviewData['chainRevenue']
	chainIncentives: IChainOverviewData['chainIncentives']
	appRevenue: IChainOverviewData['appRevenue']
	appFees: IChainOverviewData['appFees']
	dexs: IChainOverviewData['dexs']
	perps: IChainOverviewData['perps']
	inflows: IChainOverviewData['inflows']
	users: IChainOverviewData['users']
	chainRaises: IChainOverviewData['chainRaises']
	chainAssets: IChainOverviewData['chainAssets']
	chainTokenInfo: IChainOverviewData['chainTokenInfo']
	protocols: IChainOverviewData['protocols']
	totalValueUSD: number | null
	tvlSettingsGovtokens: boolean
	/** Left slot of the footer row; the parent owns the CSV export because it holds the chart data. */
	footerAction?: ReactNode
}

export function KeyMetrics(props: KeyMetricsProps) {
	const keyMetricsRef = useRef<HTMLDivElement>(null)
	const keyMetricsTitle = props.metadata.name === 'All' ? 'All Chains' : props.metadata.name
	const hasKeyMetricsPrimary = props.protocols.length > 0 && props.totalValueUSD != null

	return (
		<KeyMetricsPanel
			rowsRef={keyMetricsRef}
			footer={
				<>
					{props.footerAction}
					{props.metadata.name !== 'All' ? (
						<KeyMetricsPngExportButton
							containerRef={keyMetricsRef}
							title={keyMetricsTitle}
							iconUrl={`/api/public/chain-icon?slug=${encodeURIComponent(props.metadata.name)}`}
							primaryValue={hasKeyMetricsPrimary ? props.totalValueUSD : null}
							primaryLabel="Total Value Locked in DeFi"
							formatPrice={formatKeyMetricsValue}
						/>
					) : null}
				</>
			}
		>
			<StablecoinsMcap stablecoins={props.stablecoins} isAll={props.metadata.name === 'All'} />
			<RwaActiveMcap rwaActiveMcap={props.rwaActiveMcap} />
			<NativeStablecoins chainStablecoins={props.chainStablecoins} />
			{props.chainFees.total24h != null ? (
				<ChainMetricRow
					label="Chain Fees (24h)"
					tooltip={definitions.fees.chain['24h']}
					value={formatUsd(props.chainFees.total24h, {
						compact: true,
						minimumCompactValue: 1_000_000,
						compactSuffix: 'lowercase'
					})}
				/>
			) : null}
			{props.chainRevenue.total24h != null ? (
				<ChainMetricRow
					label="Chain Revenue (24h)"
					tooltip={definitions.revenue.chain['24h']}
					value={formatUsd(props.chainRevenue.total24h, {
						compact: true,
						minimumCompactValue: 1_000_000,
						compactSuffix: 'lowercase'
					})}
				/>
			) : null}
			{props.chainFees.totalREV24h != null ? (
				<ChainMetricRow
					label="Chain REV (24h)"
					tooltip={definitions.rev.chain['24h']}
					value={formatUsd(props.chainFees.totalREV24h, {
						compact: true,
						minimumCompactValue: 1_000_000,
						compactSuffix: 'lowercase'
					})}
				/>
			) : null}
			{props.chainIncentives.emissions24h != null ? (
				<ChainMetricRow
					label="Token Incentives (24h)"
					tooltip={definitions.incentives.protocol['24h']}
					value={formatUsd(props.chainIncentives.emissions24h, {
						compact: true,
						minimumCompactValue: 1_000_000,
						compactSuffix: 'lowercase'
					})}
				/>
			) : null}
			{props.appRevenue.total24h != null && props.appRevenue.total24h > 1e3 ? (
				<ChainMetricRow
					label="App Revenue (24h)"
					tooltip={definitions.appRevenue.chain['24h']}
					value={formatUsd(props.appRevenue.total24h, {
						compact: true,
						minimumCompactValue: 1_000_000,
						compactSuffix: 'lowercase'
					})}
				/>
			) : null}
			{props.appFees.total24h != null && props.appFees.total24h > 1e3 ? (
				<ChainMetricRow
					label="App Fees (24h)"
					tooltip={definitions.appFees.chain['24h']}
					value={formatUsd(props.appFees.total24h, {
						compact: true,
						minimumCompactValue: 1_000_000,
						compactSuffix: 'lowercase'
					})}
				/>
			) : null}
			<DexsVolume dexs={props.dexs} />
			<PerpsVolume perps={props.perps} />
			{props.inflows?.netInflows != null ? (
				<ChainMetricRow
					label="Inflows (24h)"
					tooltip="Net value bridged to the chain during the latest completed UTC day."
					value={formatUsd(props.inflows.netInflows, {
						compact: true,
						minimumCompactValue: 1_000_000,
						compactSuffix: 'lowercase'
					})}
				/>
			) : null}
			<ActiveAddresses users={props.users} />
			<RaisesSection chainRaises={props.chainRaises} />
			<BridgedTvlSection chainAssets={props.chainAssets} tvlSettingsGovtokens={props.tvlSettingsGovtokens} />
			<ChainTokenInfo chainTokenInfo={props.chainTokenInfo} />
		</KeyMetricsPanel>
	)
}

function StablecoinsMcap({ stablecoins, isAll }: { stablecoins: IChainOverviewData['stablecoins']; isAll: boolean }) {
	if (!stablecoins?.mcap) return null

	return (
		<ChainMetricSection
			label="Stablecoins market cap"
			tooltip={
				isAll
					? 'Sum of market cap of all stablecoins circulating on all chains'
					: 'Sum of market cap of all stablecoins circulating on the chain'
			}
			value={formatUsd(stablecoins.mcap, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}
		>
			{stablecoins.change7d != null ? (
				<ChainSubMetricRow
					label="Change (7d)"
					value={<Change value={stablecoins.change7d} tooltip={formatChange(stablecoins.change7dUsd, 'usd')} />}
				/>
			) : null}
			{stablecoins.dominance != null ? (
				<ChainSubMetricRow
					label={`${stablecoins.topToken.symbol} Dominance`}
					value={formatPercent(stablecoins.dominance, { input: 'percent' })}
				/>
			) : null}
		</ChainMetricSection>
	)
}

function RwaActiveMcap({ rwaActiveMcap }: { rwaActiveMcap: IChainOverviewData['rwaActiveMcap'] }) {
	if (!rwaActiveMcap) return null

	return (
		<ChainMetricRow
			label="RWA Active AUM"
			tooltip={rwaDefinitions.activeMcap.description}
			value={formatUsd(rwaActiveMcap, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}
		/>
	)
}

function NativeStablecoins({ chainStablecoins }: { chainStablecoins: IChainOverviewData['chainStablecoins'] }) {
	if (!chainStablecoins?.length) return null

	return (
		<ChainMetricRow
			label={`Native Stablecoin${chainStablecoins.length > 1 ? 's' : ''}`}
			value={
				<>
					{chainStablecoins.map((coin) => (
						<BasicLink key={`native-stablecoin-${coin.name}`} href={coin.url} className="hover:underline">
							{coin.symbol ?? coin.name}
						</BasicLink>
					))}
				</>
			}
		/>
	)
}

function DexsVolume({ dexs }: { dexs: IChainOverviewData['dexs'] }) {
	if (dexs?.total24h == null) return null

	return (
		<ChainMetricSection
			label="DEXs Volume (24h)"
			tooltip={definitions.dexs.chain['24h']}
			value={formatUsd(dexs.total24h, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}
		>
			{dexs.total7d != null ? (
				<ChainSubMetricRow
					label="Volume (7d)"
					tooltip={definitions.dexs.chain['7d']}
					value={formatUsd(dexs.total7d, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}
				/>
			) : null}
			{dexs.change_7dover7d != null ? (
				<ChainSubMetricRow
					label="Weekly Change"
					tooltip={definitions.dexs.chain['change7dover7d']}
					value={<Change value={dexs.change_7dover7d} />}
				/>
			) : null}
			{dexs.dexsDominance != null ? (
				<ChainSubMetricRow
					label="DEX vs CEX dominance"
					value={formatPercent(dexs.dexsDominance, { input: 'percent' })}
				/>
			) : null}
		</ChainMetricSection>
	)
}

function PerpsVolume({ perps }: { perps: IChainOverviewData['perps'] }) {
	if (perps?.total24h == null) return null

	return (
		<ChainMetricSection
			label="Perps Volume (24h)"
			tooltip={definitions.perps.chain['24h']}
			value={formatUsd(perps.total24h, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}
		>
			{perps.total7d != null ? (
				<ChainSubMetricRow
					label="Volume (7d)"
					tooltip={definitions.perps.chain['7d']}
					value={formatUsd(perps.total7d, {
						compact: true,
						minimumCompactValue: 1_000_000,
						compactSuffix: 'lowercase'
					})}
				/>
			) : null}
			{perps.change_7dover7d != null ? (
				<ChainSubMetricRow
					label="Weekly Change"
					tooltip={definitions.perps.chain['change7dover7d']}
					value={<Change value={perps.change_7dover7d} />}
				/>
			) : null}
		</ChainMetricSection>
	)
}

function ActiveAddresses({ users }: { users: IChainOverviewData['users'] }) {
	if (users.activeUsers == null) return null

	const hasSubMetrics = users.newUsers != null || users.transactions != null

	if (!hasSubMetrics) {
		return (
			<ChainMetricRow
				label="Active Addresses (24h)"
				tooltip={
					<p>
						Number of unique addresses that have interacted with the protocol directly in the last 24 hours.
						Interactions are counted as transactions sent directly against the protocol, thus transactions that go
						through an aggregator or some other middleman contract are not counted here.
						<br />
						<br />
						The reasoning for this is that this is meant to help measure stickiness/loyalty of users, and users that are
						interacting with the protocol through another product aren't likely to be sticky.
						<br />
						<br />
						Updates daily at 00:00 UTC
					</p>
				}
				value={formatCompactNumber(users.activeUsers, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}
			/>
		)
	}

	return (
		<ChainMetricSection
			label="Active Addresses (24h)"
			tooltip="Number of unique addresses that have interacted with the protocol directly in the last 24 hours. Interactions are counted as transactions sent directly against the protocol, thus transactions that go through an aggregator or some other middleman contract are not counted here. The reasoning for this is that this is meant to help measure stickiness/loyalty of users, and users that are interacting with the protocol through another product aren't likely to be sticky. Updates daily at 00:00 UTC"
			value={formatCompactNumber(users.activeUsers, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}
		>
			{users.newUsers != null ? (
				<ChainSubMetricRow
					label="New Addresses (24h)"
					value={formatCompactNumber(users.newUsers, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}
				/>
			) : null}
			{users.transactions != null ? (
				<ChainSubMetricRow
					label="Transactions (24h)"
					value={formatCompactNumber(users.transactions, {
						minimumCompactValue: 1_000_000,
						compactSuffix: 'lowercase'
					})}
				/>
			) : null}
		</ChainMetricSection>
	)
}

function RaisesSection({ chainRaises }: { chainRaises: IChainOverviewData['chainRaises'] }) {
	if (!chainRaises || chainRaises.length === 0) return null
	const sortedRaises = chainRaises.toSorted((a, b) => a.date - b.date)
	return (
		<ChainMetricSection
			label="Total Raised"
			tooltip="Sum of all money raised by the chain, including VC funding rounds, public sales and ICOs."
			value={<RaisesTotal {...summarizeRaises(chainRaises)} />}
		>
			{sortedRaises.map((raise) => (
				<p
					className="flex flex-col gap-1 border-b border-dashed border-subtle py-1 group-last:border-none"
					key={`${raise.date}-${raise.amountUsd}-${raise.round}`}
				>
					<span className="flex flex-wrap justify-between">
						<span className="body-md text-tertiary">{formatDate(raise.date, { input: 'seconds' })}</span>
						<span className="mono-md">
							{formatUsd(raise.amountUsd, {
								compact: true,
								minimumCompactValue: 1_000_000,
								compactSuffix: 'lowercase'
							})}
						</span>
					</span>
					<span className="flex flex-wrap justify-between gap-1 body-md text-secondary">
						<span>Round: {raise.round}</span>
						{raise.leadInvestors.length > 0 || raise.otherInvestors.length > 0 ? (
							<span>
								Investors:{' '}
								{raise.leadInvestors.concat(raise.otherInvestors).map((i, index, arr) => (
									<Fragment key={`raised from ${i}`}>
										<a href={`/raises/${slug(i)}`}>{i}</a>
										{index < arr.length - 1 ? ', ' : ''}
									</Fragment>
								))}
							</span>
						) : null}
					</span>
				</p>
			))}
		</ChainMetricSection>
	)
}

/**
 * Sub-metrics in display order. The producer may report five sections or eight - it carves
 * stablecoins/rwa/lst back out of canonical/thirdParty/native - and `total` already includes
 * whichever are present, so every section has to be rendered or the total stops adding up.
 */
const BRIDGED_TVL_SUB_METRICS = [
	{
		key: 'native',
		label: 'Native',
		tooltip: "Sum of market caps of all tokens that were issued on the chain (excluding the chain's own token)"
	},
	{ key: 'ownTokens', label: 'Own Tokens', tooltip: 'Market cap of the governance token of the chain' },
	{
		key: 'canonical',
		label: 'Canonical',
		tooltip: 'Tokens that were bridged to the chain through the canonical bridge'
	},
	{
		key: 'thirdParty',
		label: 'Third Party',
		tooltip: 'Tokens that were bridged to the chain through third party bridges'
	},
	{ key: 'stablecoins', label: 'Stablecoins', tooltip: 'Stablecoins held on the chain' },
	{ key: 'rwa', label: 'RWAs', tooltip: 'Tokenized real world assets held on the chain' },
	{ key: 'lst', label: 'Liquid Staking', tooltip: 'Liquid staking tokens held on the chain' }
] as const

function BridgedTvlSection({
	chainAssets,
	tvlSettingsGovtokens
}: {
	chainAssets: IChainOverviewData['chainAssets']
	tvlSettingsGovtokens: boolean
}) {
	if (!chainAssets) return null

	return (
		<ChainMetricSection
			label="Bridged TVL"
			tooltip="Value of all tokens held on the chain"
			value={formatUsd(chainAssets.total.total + (tvlSettingsGovtokens ? (chainAssets.ownTokens?.total ?? 0) : 0), {
				compact: true,
				minimumCompactValue: 1_000_000,
				compactSuffix: 'lowercase'
			})}
		>
			{BRIDGED_TVL_SUB_METRICS.map(({ key, label, tooltip }) => {
				const total = chainAssets[key]?.total
				return total ? (
					<ChainSubMetricRow
						key={key}
						label={label}
						tooltip={tooltip}
						value={formatUsd(total, {
							compact: true,
							minimumCompactValue: 1_000_000,
							compactSuffix: 'lowercase'
						})}
					/>
				) : null
			})}
		</ChainMetricSection>
	)
}

function ChainTokenInfo({ chainTokenInfo }: { chainTokenInfo: IChainOverviewData['chainTokenInfo'] }) {
	if (!chainTokenInfo?.token_symbol) return null

	const tokenLabel = (text: string) =>
		chainTokenInfo.tokenPageRoute ? (
			<BasicLink href={chainTokenInfo.tokenPageRoute} className="text-link hover:underline">
				{text}
			</BasicLink>
		) : (
			text
		)

	return (
		<>
			<ChainMetricRow
				label={tokenLabel(`$${chainTokenInfo.token_symbol} Price`)}
				value={formatNullableCurrency(chainTokenInfo.current_price)}
			/>
			<ChainMetricRow
				label={tokenLabel(`$${chainTokenInfo.token_symbol} market cap`)}
				value={formatNullableCurrency(chainTokenInfo.market_cap)}
			/>
			<ChainMetricRow
				label={tokenLabel(`$${chainTokenInfo.token_symbol} FDV`)}
				value={formatNullableCurrency(chainTokenInfo.fully_diluted_valuation)}
			/>
		</>
	)
}
