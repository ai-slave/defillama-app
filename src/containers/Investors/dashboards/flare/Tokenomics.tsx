import { useQuery } from '@tanstack/react-query'
import { lazy, useState } from 'react'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import { TabStatus } from '~/containers/Investors/TabStatus'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { formatNumber } from '~/utils/numberFormat'
import { readInvestorApiJson } from '../../api.types'
import { CSV_ONLY_EXPORT } from './chartDefaults'
import { buildFlareTokenomicsData, type TokenomicsAPIResponse } from './data'
import { ChartCard, KpiCard, NarrativeCallout, SectionHeader } from './ui'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>

type BurnView = 'daily' | 'cumulative'

const FAQ_ITEMS: Array<{ q: string; a: React.ReactNode }> = [
	{
		q: 'What is FIP.16?',
		a: 'FIP.16 is a Flare governance proposal passed in April 2026 that restructured FLR token economics. Key changes: annual inflation reduced from 5% to 3%, the base gas fee increased 20x (25 → 500 gwei), staking incentivized over delegation via a 5x signing weight multiplier, and the FIRE protocol introduced to aggregate and burn network revenues.'
	},
	{
		q: 'What is the FIRE protocol?',
		a: 'FIRE (Flare Income Reinvestment Entity) is a protocol-level pool that collects revenues from transaction fees, FDC data requests, FAsset activity, and future MEV capture. Its primary mandate is to reduce FLR supply through open-market buybacks and burns. Secondary mandates include funding ecosystem incentives and supporting Foundation sustainability. FIRE went live in May 2026, and the FIRE section above tracks fees collected (FDC, FAssets minting, FAssets redemption, Tags) in real time.'
	},
	{
		q: 'What is the 300M FLR/year burn target?',
		a: 'Under conservative modeling, the 20x base fee increase should generate approximately 300M FLR/year in burns from transaction fees alone, enough to offset a meaningful portion of annual inflation. This is an aspirational target; actual burn rate grows proportionally with network activity. The Burn vs. Emit chart above shows real-time progress toward this goal.'
	},
	{
		q: "What's the difference between gas burns and protocol burns?",
		a: 'Gas burns happen automatically on every Flare transaction: EVM base fees are burned by the protocol. The one exception is FTSO/FDC voter submissions, which are refunded above a fixed 0.000525 FLR cap: that refunded portion goes back to the voter and is not burned, and the burn figures here are net of it. Protocol burns (tracked via TIP20) are explicit burns triggered by FDC data requests, FAsset minting/redemption fees, and FIRE pool market purchases. Both types are shown in the charts above.'
	}
]

function FaqItem({ q, a }: { q: string; a: React.ReactNode }) {
	return (
		<details className="group rounded-lg border border-pro-cards-border bg-pro-cards-bg">
			<summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 label-md text-pro-text-primary">
				{q}
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					className="size-4 shrink-0 text-pro-text-label transition-transform group-open:rotate-180"
				>
					<path d="M6 9l6 6 6-6" />
				</svg>
			</summary>
			<p className="px-4 pb-4 body-md text-pro-text-secondary">{a}</p>
		</details>
	)
}

export default function Tokenomics() {
	const query = useQuery({
		queryKey: ['flare-tokenomics'],
		queryFn: async () => {
			const res = await fetch('/api/public/flare/tokenomics')
			if (!res.ok) throw new Error(`Flare tokenomics API error: ${res.status}`)
			return buildFlareTokenomicsData(await readInvestorApiJson<TokenomicsAPIResponse>(res))
		},
		staleTime: 10 * 60 * 1000,
		refetchOnWindowFocus: false
	})

	// Max Supply lived on the (now removed) Supply tab; the tokenomics endpoint
	// doesn't carry it, so pull just that one figure from the supply endpoint.
	const maxSupplyQuery = useQuery({
		queryKey: ['flare-supply'],
		queryFn: async () => {
			const res = await fetch('/api/public/flare/supply')
			if (!res.ok) throw new Error(`Flare supply API error: ${res.status}`)
			const data = await readInvestorApiJson<{
				kpis?: { maxSupply?: { value: number; formatted: string } }
			}>(res)
			return data.kpis?.maxSupply?.formatted ?? null
		},
		staleTime: 10 * 60 * 1000,
		refetchOnWindowFocus: false
	})

	const [burnView, setBurnView] = useState<BurnView>('daily')
	const [protocolView, setProtocolView] = useState<'emitted' | 'burned'>('burned')

	if (query.error) return <TabStatus variant="error">Couldn't load Flare tokenomics.</TabStatus>
	if (!query.data) return <TabStatus variant="loading" />

	const { burn: b, emissions: e, inflation: inf, fire } = query.data
	const bk = b.kpis
	const ek = e.kpis
	const protocolChart = inf ? (protocolView === 'emitted' ? inf.emittedByProtocol : inf.burnedByProtocol) : null

	return (
		<div className="flex flex-col gap-6">
			{query.data.narrative && <NarrativeCallout>{query.data.narrative}</NarrativeCallout>}

			{inf && (
				<>
					<SectionHeader>Inflation & Supply</SectionHeader>
					<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
						<KpiCard label="Annualized Inflation" value={inf.kpis.annualizedInflationPct} />
						<KpiCard label="Circulating Supply" value={inf.kpis.circulatingSupply} />
						<KpiCard
							label="On-chain Burned (Total)"
							value={inf.kpis.cumulativeOnchainBurned}
							def="All on-chain burn mechanisms combined (FTSOv1, FSP, fee burns and more), so it's larger than the transaction-fee burn tracked below."
						/>
						<KpiCard label="Emitted (Last Month)" value={inf.kpis.lastMonthEmitted} />
						<KpiCard label="Burned (Last Month)" value={inf.kpis.lastMonthBurned} />
					</div>
					{inf.pctChart && (
						<ChartCard title={inf.pctChart.title ?? 'Annualized Inflation Rate'} subtitle={inf.pctChart.subtitle}>
							<MultiSeriesChart
								dataset={inf.pctChart.dataset}
								charts={inf.pctChart.charts}
								valueSymbol="%"
								title=""
								height="360px"
								exportButtons={CSV_ONLY_EXPORT}
								chartOptions={inf.pctChart.chartOptions}
							/>
						</ChartCard>
					)}
					<div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
						{inf.circulatingChart && (
							<ChartCard
								title={inf.circulatingChart.title ?? 'Circulating Supply (Monthly)'}
								subtitle={inf.circulatingChart.subtitle}
							>
								<MultiSeriesChart
									dataset={inf.circulatingChart.dataset}
									charts={inf.circulatingChart.charts}
									valueSymbol=""
									title=""
									height="360px"
									exportButtons={CSV_ONLY_EXPORT}
									chartOptions={inf.circulatingChart.chartOptions}
								/>
							</ChartCard>
						)}
						{protocolChart && (
							<div className="rounded-lg border border-pro-cards-border bg-pro-cards-bg p-4">
								<div className="mb-3 flex flex-wrap items-end justify-between gap-2">
									<div className="min-w-0">
										<h3 className="title-md text-pro-text-primary">
											{protocolChart.title ?? 'FLR by Protocol (Monthly)'}
										</h3>
										{protocolChart.subtitle && (
											<p className="mt-0.5 body-sm text-pro-text-label">{protocolChart.subtitle}</p>
										)}
									</div>
									<SegmentedControl<typeof protocolView>
										variant="default"
										size="sm"
										label="FLR by protocol flow"
										options={[
											{ value: 'burned', label: 'Burned' },
											{ value: 'emitted', label: 'Emitted' }
										]}
										value={protocolView}
										onValueChange={setProtocolView}
									/>
								</div>
								<MultiSeriesChart
									dataset={protocolChart.dataset}
									charts={protocolChart.charts}
									valueSymbol=""
									title=""
									height="360px"
									exportButtons={CSV_ONLY_EXPORT}
									chartOptions={protocolChart.chartOptions}
								/>
							</div>
						)}
					</div>
				</>
			)}

			<SectionHeader>FLR Transaction Burn</SectionHeader>
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
				<KpiCard label="Latest Daily" value={bk.latestDailyBurn} />
				<KpiCard label="Burn 7d" value={bk.burn7d} />
				<KpiCard label="Burn 30d" value={bk.burn30d} />
				<KpiCard label="Burn YTD" value={bk.burnYtd} />
				<KpiCard label="Total Burned" value={bk.totalGasBurned} />
			</div>

			<div className="rounded-lg border border-pro-cards-border bg-pro-cards-bg p-4">
				<div className="mb-3 flex flex-wrap items-end justify-between gap-2">
					<div className="min-w-0">
						<h3 className="title-md text-pro-text-primary">{b.burnTitle}</h3>
						<p className="mt-0.5 body-sm text-pro-text-label">
							FLR removed from supply by transaction fees, net of the FTSO/FDC voter gas refund. Daily and cumulative.
						</p>
					</div>
					<SegmentedControl<BurnView>
						variant="default"
						size="sm"
						label="FLR burn period"
						options={[
							{ value: 'daily', label: 'Daily' },
							{ value: 'cumulative', label: 'Cumulative' }
						]}
						value={burnView}
						onValueChange={setBurnView}
					/>
				</div>
				{burnView === 'daily' ? (
					<MultiSeriesChart
						dataset={b.dailyDataset}
						charts={b.charts.daily}
						valueSymbol=""
						title=""
						height="360px"
						exportButtons={CSV_ONLY_EXPORT}
						chartOptions={b.chartOptions}
					/>
				) : (
					<MultiSeriesChart
						dataset={b.cumulativeDataset}
						charts={b.charts.cumulative}
						valueSymbol=""
						title=""
						height="360px"
						chartOptions={b.chartOptions}
					/>
				)}
			</div>

			<SectionHeader>FLR Emissions</SectionHeader>
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
				{maxSupplyQuery.data != null && <KpiCard label="Max Supply" value={maxSupplyQuery.data} />}
				<KpiCard label="Latest Epoch Emit" value={ek.latestEpochEmit} />
				<KpiCard label="Emit 30d" value={ek.emit30d} />
				<KpiCard label="Cumulative Emitted" value={ek.cumulativeEmissionsTracked} />
				<KpiCard label="Epochs Tracked" value={ek.epochsTracked} />
				<KpiCard label="Latest Epoch Burn" value={ek.latestEpochBurn} />
			</div>
			<ChartCard title={e.emissionsTitle}>
				<MultiSeriesChart
					dataset={e.perEpochDataset}
					charts={e.charts.perEpoch}
					valueSymbol=""
					title=""
					height="360px"
					exportButtons={CSV_ONLY_EXPORT}
					chartOptions={e.perEpochChartOptions}
				/>
			</ChartCard>

			<SectionHeader>Burn vs. Emit & Net Inflation</SectionHeader>
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
				<KpiCard
					label="Burn / Emit (latest)"
					value={ek.latestBurnVsEmitPct}
					def="Transaction-fee burn as a percent of FLR emitted, for the latest reward epoch. 100% would mean burn fully offsets new emission."
				/>
				<KpiCard
					label="Net Inflation (latest)"
					value={ek.latestNetInflation}
					def="FLR emitted minus FLR burned, for the latest reward epoch."
				/>
				<KpiCard
					label="Burn / Emit (30d)"
					value={ek.burnVsEmit30dPct}
					def="Transaction-fee burn as a percent of FLR emitted, over the trailing 30 days."
				/>
				<KpiCard
					label="Net Inflation (30d)"
					value={ek.netInflation30d}
					def="FLR emitted minus FLR burned, over the trailing 30 days."
				/>
			</div>
			<ChartCard title={e.burnVsEmitTitle}>
				<MultiSeriesChart
					dataset={e.burnVsEmitDataset}
					charts={e.charts.burnVsEmit}
					valueSymbol=""
					title=""
					height="400px"
					hideDefaultLegend={false}
					exportButtons={CSV_ONLY_EXPORT}
					chartOptions={e.burnVsEmitChartOptions}
				/>
			</ChartCard>
			{e.burnVsEmitSubtitle && <p className="body-sm text-pro-text-label">{e.burnVsEmitSubtitle}</p>}

			<SectionHeader>FIRE (FIP.16)</SectionHeader>
			{fire ? (
				<>
					<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
						<KpiCard label="Total Collected" value={fire.kpis.totalCollectedUsd} />
						<KpiCard label="Collected 30d" value={fire.kpis.collected30dUsd} />
						<KpiCard
							label="FDC Fees"
							value={fire.kpis.fdcCollectedUsd}
							def="Fees paid for FDC (Flare Data Connector) data requests."
						/>
						<KpiCard label="Minting Fees" value={fire.kpis.mintingFeeCollectedUsd} def="Fees paid when minting FXRP." />
						{fire.kpis.redemptionFeeCollectedUsd != null && (
							<KpiCard
								label="Redemption Fees"
								value={fire.kpis.redemptionFeeCollectedUsd}
								def="Fees paid when redeeming FXRP back to XRP."
							/>
						)}
						<KpiCard label="Tag Fees" value={fire.kpis.tagsCollectedUsd} def="Fees from Flare's Tags product." />
					</div>
					<div className="rounded-lg border border-pro-cards-border bg-pro-cards-bg p-4">
						<div className="mb-3 flex flex-wrap items-end justify-between gap-2">
							<div className="min-w-0">
								<h3 className="title-md text-pro-text-primary">{fire.title}</h3>
								<p className="mt-0.5 body-sm text-pro-text-label">
									{fire.subtitle ?? 'Daily fees collected by source and cumulative total.'}
								</p>
							</div>
							<span className="rounded-full border border-pro-cards-border px-2.5 py-0.5 label-xs tracking-wide text-success uppercase">
								Live{fire.liveSince ? ` since ${fire.liveSince}` : ''}
							</span>
						</div>
						<MultiSeriesChart
							dataset={fire.dataset}
							charts={fire.charts}
							valueSymbol="$"
							title=""
							height="360px"
							hideDefaultLegend={false}
							exportButtons={CSV_ONLY_EXPORT}
							chartOptions={fire.chartOptions}
						/>
					</div>
					{fire.wallets.length > 0 && (
						<div className="overflow-x-auto rounded-lg border border-pro-cards-border bg-pro-cards-bg">
							<table className="w-full text-left body-md">
								<thead>
									<tr className="border-b border-pro-cards-border label-md tracking-wider text-pro-text-label uppercase">
										<th className="p-3">Source</th>
										<th className="p-3">Wallet</th>
										<th className="p-3 text-right">Fees</th>
										<th className="p-3 text-right">Fees (USD)</th>
										<th className="p-3 text-right">Txns</th>
									</tr>
								</thead>
								<tbody>
									{fire.wallets.map((w) => (
										<tr key={w.wallet} className="border-b border-pro-cards-border last:border-b-0">
											<td className="p-3 font-medium text-pro-text-primary">{w.name}</td>
											<td className="p-3">
												<a
													href={`https://flare-explorer.flare.network/address/${w.wallet}`}
													target="_blank"
													rel="noopener noreferrer"
													className="mono-sm text-pro-text-secondary hover:text-pro-text-primary"
												>
													{w.wallet.slice(0, 6)}…{w.wallet.slice(-4)}
												</a>
											</td>
											<td className="p-3 text-right body-sm text-pro-text-secondary tabular-nums">
												{formatNumber(w.feesToken, { maximumFractionDigits: 0 })} {w.feeToken}
											</td>
											<td className="p-3 text-right body-sm text-pro-text-primary tabular-nums">
												{w.feesUsdFormatted}
											</td>
											<td className="p-3 text-right body-sm text-pro-text-secondary tabular-nums">
												{formatNumber(w.txCount)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
					<p className="body-sm text-pro-text-label">{fire.note}</p>
				</>
			) : (
				<div className="rounded-lg border border-pro-cards-border bg-pro-cards-bg p-5">
					<p className="body-sm text-pro-text-label">{b.firePoolNote}</p>
				</div>
			)}

			<SectionHeader>FAQ</SectionHeader>
			<div className="flex flex-col gap-3">
				{FAQ_ITEMS.map((item) => (
					<FaqItem key={item.q} q={item.q} a={item.a} />
				))}
			</div>
		</div>
	)
}
