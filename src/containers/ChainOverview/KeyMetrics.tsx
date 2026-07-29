import { Fragment, memo, useRef } from 'react'
import { BasicLink } from '~/components/Link'
import { definitions as rwaDefinitions } from '~/containers/RWA/definitions'
import { definitions } from '~/public/definitions'
import {
	MetricRow as ChainMetricRow,
	MetricSection as ChainMetricSection,
	SubMetricRow as ChainSubMetricRow
} from '~/ui/MetricPrimitives'
import { Tooltip } from '~/ui/Tooltip'
import { slug } from '~/utils'
import { formatDate } from '~/utils/dateFormat'
import { formatUsd, formatCompactNumber, formatPercent, formatPercentChange } from '~/utils/numberFormat'
import { KeyMetricsPngExportButton } from './KeyMetricsPngExport'
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
	treasury: IChainOverviewData['treasury']
	chainRaises: IChainOverviewData['chainRaises']
	chainAssets: IChainOverviewData['chainAssets']
	nfts: IChainOverviewData['nfts']
	chainTokenInfo: IChainOverviewData['chainTokenInfo']
	protocols: IChainOverviewData['protocols']
	totalValueUSD: number | null
	tvlSettingsGovtokens: boolean
}

export const KeyMetrics = memo(function KeyMetrics(props: KeyMetricsProps) {
	const keyMetricsRef = useRef<HTMLDivElement>(null)
	const keyMetricsTitle = props.metadata.name === 'All' ? 'All Chains' : props.metadata.name
	const hasKeyMetricsPrimary = props.protocols.length > 0 && props.totalValueUSD != null

	return (
		<div className="flex flex-1 flex-col gap-2">
			<div className="flex items-center justify-between">
				<h2 className="label-md">Key Metrics</h2>
				{props.metadata.name !== 'All' ? (
					<KeyMetricsPngExportButton
						containerRef={keyMetricsRef}
						chainName={keyMetricsTitle}
						chainIconSlug={props.metadata.name}
						primaryValue={props.totalValueUSD}
						primaryLabel="Total Value Locked in DeFi"
						formatPrice={formatKeyMetricsValue}
						hasTvlData={hasKeyMetricsPrimary}
					/>
				) : null}
			</div>
			<div className="flex flex-col" ref={keyMetricsRef}>
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
				<TreasurySection treasury={props.treasury} />
				<RaisesSection chainRaises={props.chainRaises} />
				<BridgedTvlSection chainAssets={props.chainAssets} tvlSettingsGovtokens={props.tvlSettingsGovtokens} />
				{props.nfts ? (
					<ChainMetricRow
						label="NFT Volume (24h)"
						tooltip="Volume of Non Fungible Tokens traded in the last 24 hours"
						value={formatUsd(props.nfts.total24h, {
							compact: true,
							minimumCompactValue: 1_000_000,
							compactSuffix: 'lowercase'
						})}
					/>
				) : null}
				<ChainTokenInfo chainTokenInfo={props.chainTokenInfo} />
			</div>
		</div>
	)
})

function StablecoinsMcap({ stablecoins, isAll }: { stablecoins: IChainOverviewData['stablecoins']; isAll: boolean }) {
	if (!stablecoins?.mcap) return null

	return (
		<ChainMetricSection
			label="Stablecoins Mcap"
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
					value={
						<Tooltip
							content={`${formatUsd(stablecoins.change7dUsd, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}`}
							className={`ml-auto justify-end truncate mono-md underline decoration-dotted ${
								+stablecoins.change7d >= 0 ? 'text-data-up' : 'text-data-down'
							}`}
						>
							{formatPercentChange(stablecoins.change7d)}
						</Tooltip>
					}
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
			label="RWA Active Mcap"
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
					value={
						<span className={dexs.change_7dover7d >= 0 ? 'text-data-up' : 'text-data-down'}>
							{formatPercentChange(dexs.change_7dover7d)}
						</span>
					}
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
					value={
						<span className={perps.change_7dover7d >= 0 ? 'text-data-up' : 'text-data-down'}>
							{formatPercentChange(perps.change_7dover7d)}
						</span>
					}
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

function TreasurySection({ treasury }: { treasury: IChainOverviewData['treasury'] }) {
	if (!treasury) return null

	return (
		<ChainMetricSection
			label="Treasury"
			value={formatUsd(treasury.tvl, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}
		>
			{treasury.tokenBreakdowns?.stablecoins != null ? (
				<ChainSubMetricRow
					label="Stablecoins"
					value={formatUsd(treasury.tokenBreakdowns.stablecoins, {
						compact: true,
						minimumCompactValue: 1_000_000,
						compactSuffix: 'lowercase'
					})}
				/>
			) : null}
			{treasury.tokenBreakdowns?.majors != null ? (
				<ChainSubMetricRow
					label="Major Tokens (ETH, BTC)"
					value={formatUsd(treasury.tokenBreakdowns.majors, {
						compact: true,
						minimumCompactValue: 1_000_000,
						compactSuffix: 'lowercase'
					})}
				/>
			) : null}
			{treasury.tokenBreakdowns?.others != null ? (
				<ChainSubMetricRow
					label="Other Tokens"
					value={formatUsd(treasury.tokenBreakdowns.others, {
						compact: true,
						minimumCompactValue: 1_000_000,
						compactSuffix: 'lowercase'
					})}
				/>
			) : null}
			{treasury.tokenBreakdowns?.ownTokens != null ? (
				<ChainSubMetricRow
					label="Own Tokens"
					value={formatUsd(treasury.tokenBreakdowns.ownTokens, {
						compact: true,
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
	const totalRaisedUsd = chainRaises.reduce((sum, raise) => sum + (raise.amountUsd ?? 0), 0)
	return (
		<ChainMetricSection
			label="Total Raised"
			tooltip="Sum of all money raised by the chain, including VC funding rounds, public sales and ICOs."
			value={formatUsd(totalRaisedUsd, {
				compact: true,
				minimumCompactValue: 1_000_000,
				compactSuffix: 'lowercase'
			})}
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
						{raise.leadInvestors.length || raise.otherInvestors.length ? (
							<span>
								Investors:{' '}
								{raise.leadInvestors.concat(raise.otherInvestors).map((i, index, arr) => (
									<Fragment key={'raised from ' + i}>
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
			{chainAssets.native?.total ? (
				<ChainSubMetricRow
					label="Native"
					tooltip="Sum of marketcaps of all tokens that were issued on the chain (excluding the chain's own token)"
					value={formatUsd(chainAssets.native.total, {
						compact: true,
						minimumCompactValue: 1_000_000,
						compactSuffix: 'lowercase'
					})}
				/>
			) : null}
			{chainAssets.ownTokens?.total ? (
				<ChainSubMetricRow
					label="Own Tokens"
					tooltip="Marketcap of the governance token of the chain"
					value={formatUsd(chainAssets.ownTokens.total, {
						compact: true,
						minimumCompactValue: 1_000_000,
						compactSuffix: 'lowercase'
					})}
				/>
			) : null}
			{chainAssets.canonical.total ? (
				<ChainSubMetricRow
					label="Canonical"
					tooltip="Tokens that were bridged to the chain through the canonical bridge"
					value={formatUsd(chainAssets.canonical.total, {
						compact: true,
						minimumCompactValue: 1_000_000,
						compactSuffix: 'lowercase'
					})}
				/>
			) : null}
			{chainAssets.thirdParty.total ? (
				<ChainSubMetricRow
					label="Third Party"
					tooltip="Tokens that were bridged to the chain through third party bridges"
					value={formatUsd(chainAssets.thirdParty.total, {
						compact: true,
						minimumCompactValue: 1_000_000,
						compactSuffix: 'lowercase'
					})}
				/>
			) : null}
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
				label={tokenLabel(`$${chainTokenInfo.token_symbol} Market Cap`)}
				value={formatNullableCurrency(chainTokenInfo.market_cap)}
			/>
			<ChainMetricRow
				label={tokenLabel(`$${chainTokenInfo.token_symbol} FDV`)}
				value={formatNullableCurrency(chainTokenInfo.fully_diluted_valuation)}
			/>
		</>
	)
}
