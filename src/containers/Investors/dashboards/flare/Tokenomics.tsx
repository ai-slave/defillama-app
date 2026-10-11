import { useQuery } from '@tanstack/react-query'
import { lazy, Suspense, useState } from 'react'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import {
	CHART_FILL,
	ChartPanel,
	ChartPanelBodyLoading,
	ChartPanelExportShellLoading,
	ChartPanelTitle,
	ChartPanelToolbar
} from '~/ui/ChartPanel'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { PanelLoadingStatus, PanelStatus } from '~/ui/Status'
import { StatusBadge } from '~/ui/StatusBadge'
import { StatTile } from '~/ui/SummaryStats'
import { formatNumber } from '~/utils/numberFormat'
import { queryReadFailed } from '~/utils/query'
import { readInvestorApiJson } from '../../api.types'
import { CSV_ONLY_EXPORT } from './chartDefaults'
import { buildFlareTokenomicsData, type TokenomicsAPIResponse } from './data'
import { NarrativeCallout, SectionHeader } from './ui'

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
		<details className="group rounded-lg border border-subtle bg-surface">
			<summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 label-md text-primary">
				{q}
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					className="size-4 shrink-0 text-secondary transition-transform group-open:rotate-180"
				>
					<path d="M6 9l6 6 6-6" />
				</svg>
			</summary>
			<p className="px-4 pb-4 body-md text-secondary">{a}</p>
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
	const protocolExport = useGetChartInstance()
	const burnExport = useGetChartInstance()
	const fireExport = useGetChartInstance()

	// A failed refresh of data already shown keeps it; the error and its Try again replace the tab only before data loads.
	if (queryReadFailed(query))
		return (
			<PanelStatus variant="error" retry={query}>
				Couldn't load Flare tokenomics.
			</PanelStatus>
		)
	if (!query.data) return <PanelLoadingStatus />

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
						<StatTile label="Annualized Inflation" value={inf.kpis.annualizedInflationPct} />
						<StatTile label="Circulating Supply" value={inf.kpis.circulatingSupply} />
						<StatTile
							label="On-chain Burned (Total)"
							value={inf.kpis.cumulativeOnchainBurned}
							tooltip="All on-chain burn mechanisms combined (FTSOv1, FSP, fee burns and more), so it's larger than the transaction-fee burn tracked below."
						/>
						<StatTile label="Emitted (Last Month)" value={inf.kpis.lastMonthEmitted} />
						<StatTile label="Burned (Last Month)" value={inf.kpis.lastMonthBurned} />
					</div>
					{inf.pctChart && (
						<ChartPanel>
							<Suspense fallback={<ChartPanelExportShellLoading />}>
								<MultiSeriesChart
									dataset={inf.pctChart.dataset}
									charts={inf.pctChart.charts}
									valueSymbol="%"
									title={inf.pctChart.title ?? 'Annualized Inflation Rate'}
									subtitle={inf.pctChart.subtitle}
									headingAs="h3"
									containerClassName={CHART_FILL}
									exportButtons={CSV_ONLY_EXPORT}
									chartOptions={inf.pctChart.chartOptions}
								/>
							</Suspense>
						</ChartPanel>
					)}
					<div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
						{inf.circulatingChart && (
							<ChartPanel>
								<Suspense fallback={<ChartPanelExportShellLoading />}>
									<MultiSeriesChart
										dataset={inf.circulatingChart.dataset}
										charts={inf.circulatingChart.charts}
										valueSymbol=""
										title={inf.circulatingChart.title ?? 'Circulating Supply (Monthly)'}
										subtitle={inf.circulatingChart.subtitle}
										headingAs="h3"
										containerClassName={CHART_FILL}
										exportButtons={CSV_ONLY_EXPORT}
										chartOptions={inf.circulatingChart.chartOptions}
									/>
								</Suspense>
							</ChartPanel>
						)}
						{protocolChart && (
							<ChartPanel>
								<ChartPanelToolbar
									leading={
										<ChartPanelTitle subtitle={protocolChart.subtitle}>
											{protocolChart.title ?? 'FLR by Protocol (Monthly)'}
										</ChartPanelTitle>
									}
								>
									<SegmentedControl<typeof protocolView>
										variant="default"
										size="md"
										label="FLR by protocol flow"
										options={[
											{ value: 'burned', label: 'Burned' },
											{ value: 'emitted', label: 'Emitted' }
										]}
										value={protocolView}
										onValueChange={setProtocolView}
									/>
									<ChartExportButtons
										chartInstance={protocolExport.chartInstance}
										filename="flr-by-protocol"
										showPng={false}
										csvSource={{ type: 'dataset', prepare: () => protocolChart.dataset }}
									/>
								</ChartPanelToolbar>
								<Suspense fallback={<ChartPanelBodyLoading />}>
									<MultiSeriesChart
										dataset={protocolChart.dataset}
										charts={protocolChart.charts}
										valueSymbol=""
										containerClassName={CHART_FILL}
										exportButtons="hidden"
										onReady={protocolExport.handleChartReady}
										chartOptions={protocolChart.chartOptions}
									/>
								</Suspense>
							</ChartPanel>
						)}
					</div>
				</>
			)}

			<SectionHeader>FLR Transaction Burn</SectionHeader>
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
				<StatTile label="Latest Daily" value={bk.latestDailyBurn} />
				<StatTile label="Burn 7d" value={bk.burn7d} />
				<StatTile label="Burn 30d" value={bk.burn30d} />
				<StatTile label="Burn YTD" value={bk.burnYtd} />
				<StatTile label="Total Burned" value={bk.totalGasBurned} />
			</div>

			<ChartPanel>
				<ChartPanelToolbar
					leading={
						<ChartPanelTitle subtitle="FLR removed from supply by transaction fees, net of the FTSO/FDC voter gas refund. Daily and cumulative.">
							{b.burnTitle}
						</ChartPanelTitle>
					}
				>
					<SegmentedControl<BurnView>
						variant="default"
						size="md"
						label="FLR burn period"
						options={[
							{ value: 'daily', label: 'Daily' },
							{ value: 'cumulative', label: 'Cumulative' }
						]}
						value={burnView}
						onValueChange={setBurnView}
					/>
					<ChartExportButtons
						chartInstance={burnExport.chartInstance}
						filename={`flr-burn-${burnView}`}
						showPng={false}
						csvSource={{
							type: 'dataset',
							prepare: () => (burnView === 'daily' ? b.dailyDataset : b.cumulativeDataset)
						}}
					/>
				</ChartPanelToolbar>
				<Suspense fallback={<ChartPanelBodyLoading />}>
					{burnView === 'daily' ? (
						<MultiSeriesChart
							key="daily"
							dataset={b.dailyDataset}
							charts={b.charts.daily}
							valueSymbol=""
							containerClassName={CHART_FILL}
							exportButtons="hidden"
							onReady={burnExport.handleChartReady}
							chartOptions={b.chartOptions}
						/>
					) : (
						<MultiSeriesChart
							key="cumulative"
							dataset={b.cumulativeDataset}
							charts={b.charts.cumulative}
							valueSymbol=""
							containerClassName={CHART_FILL}
							exportButtons="hidden"
							onReady={burnExport.handleChartReady}
							chartOptions={b.chartOptions}
						/>
					)}
				</Suspense>
			</ChartPanel>

			<SectionHeader>FLR Emissions</SectionHeader>
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
				{maxSupplyQuery.data != null && <StatTile label="Max Supply" value={maxSupplyQuery.data} />}
				<StatTile label="Latest Epoch Emit" value={ek.latestEpochEmit} />
				<StatTile label="Emit 30d" value={ek.emit30d} />
				<StatTile label="Cumulative Emitted" value={ek.cumulativeEmissionsTracked} />
				<StatTile label="Epochs Tracked" value={ek.epochsTracked} />
				<StatTile label="Latest Epoch Burn" value={ek.latestEpochBurn} />
			</div>
			<ChartPanel>
				<Suspense fallback={<ChartPanelExportShellLoading />}>
					<MultiSeriesChart
						dataset={e.perEpochDataset}
						charts={e.charts.perEpoch}
						valueSymbol=""
						title={e.emissionsTitle}
						headingAs="h3"
						containerClassName={CHART_FILL}
						exportButtons={CSV_ONLY_EXPORT}
						chartOptions={e.perEpochChartOptions}
					/>
				</Suspense>
			</ChartPanel>

			<SectionHeader>Burn vs. Emit & Net Inflation</SectionHeader>
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
				<StatTile
					label="Burn / Emit (latest)"
					value={ek.latestBurnVsEmitPct}
					tooltip="Transaction-fee burn as a percent of FLR emitted, for the latest reward epoch. 100% would mean burn fully offsets new emission."
				/>
				<StatTile
					label="Net Inflation (latest)"
					value={ek.latestNetInflation}
					tooltip="FLR emitted minus FLR burned, for the latest reward epoch."
				/>
				<StatTile
					label="Burn / Emit (30d)"
					value={ek.burnVsEmit30dPct}
					tooltip="Transaction-fee burn as a percent of FLR emitted, over the trailing 30 days."
				/>
				<StatTile
					label="Net Inflation (30d)"
					value={ek.netInflation30d}
					tooltip="FLR emitted minus FLR burned, over the trailing 30 days."
				/>
			</div>
			<ChartPanel>
				<Suspense fallback={<ChartPanelExportShellLoading />}>
					<MultiSeriesChart
						dataset={e.burnVsEmitDataset}
						charts={e.charts.burnVsEmit}
						valueSymbol=""
						title={e.burnVsEmitTitle}
						headingAs="h3"
						containerClassName={CHART_FILL}
						showLegend
						exportButtons={CSV_ONLY_EXPORT}
						chartOptions={e.burnVsEmitChartOptions}
					/>
				</Suspense>
			</ChartPanel>
			{e.burnVsEmitSubtitle && <p className="body-sm text-secondary">{e.burnVsEmitSubtitle}</p>}

			<SectionHeader>FIRE (FIP.16)</SectionHeader>
			{fire ? (
				<>
					<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
						<StatTile label="Total Collected" value={fire.kpis.totalCollectedUsd} />
						<StatTile label="Collected 30d" value={fire.kpis.collected30dUsd} />
						<StatTile
							label="FDC Fees"
							value={fire.kpis.fdcCollectedUsd}
							tooltip="Fees paid for FDC (Flare Data Connector) data requests."
						/>
						<StatTile
							label="Minting Fees"
							value={fire.kpis.mintingFeeCollectedUsd}
							tooltip="Fees paid when minting FXRP."
						/>
						{fire.kpis.redemptionFeeCollectedUsd != null && (
							<StatTile
								label="Redemption Fees"
								value={fire.kpis.redemptionFeeCollectedUsd}
								tooltip="Fees paid when redeeming FXRP back to XRP."
							/>
						)}
						<StatTile label="Tag Fees" value={fire.kpis.tagsCollectedUsd} tooltip="Fees from Flare's Tags product." />
					</div>
					<ChartPanel>
						<ChartPanelToolbar
							leading={
								<ChartPanelTitle subtitle={fire.subtitle ?? 'Daily fees collected by source and cumulative total.'}>
									{fire.title}
								</ChartPanelTitle>
							}
						>
							<StatusBadge status="good">Live{fire.liveSince ? ` since ${fire.liveSince}` : ''}</StatusBadge>
							<ChartExportButtons
								chartInstance={fireExport.chartInstance}
								filename="flare-fire-fees"
								showPng={false}
								csvSource={{ type: 'dataset', prepare: () => fire.dataset }}
							/>
						</ChartPanelToolbar>
						<Suspense fallback={<ChartPanelBodyLoading />}>
							<MultiSeriesChart
								dataset={fire.dataset}
								charts={fire.charts}
								valueSymbol="$"
								containerClassName={CHART_FILL}
								showLegend
								exportButtons="hidden"
								onReady={fireExport.handleChartReady}
								chartOptions={fire.chartOptions}
							/>
						</Suspense>
					</ChartPanel>
					{fire.wallets.length > 0 && (
						<div className="overflow-x-auto rounded-lg border border-subtle bg-surface">
							<table className="w-full text-left body-md">
								<thead>
									<tr className="border-b border-subtle label-md tracking-wider text-secondary uppercase">
										<th className="p-3">Source</th>
										<th className="p-3">Wallet</th>
										<th className="p-3 text-right">Fees</th>
										<th className="p-3 text-right">Fees (USD)</th>
										<th className="p-3 text-right">Txns</th>
									</tr>
								</thead>
								<tbody>
									{fire.wallets.map((w) => (
										<tr key={w.wallet} className="border-b border-subtle last:border-b-0">
											<td className="p-3 font-medium text-primary">{w.name}</td>
											<td className="p-3">
												<a
													href={`https://flare-explorer.flare.network/address/${w.wallet}`}
													target="_blank"
													rel="noopener noreferrer"
													className="mono-sm text-secondary hover:text-primary"
												>
													{w.wallet.slice(0, 6)}…{w.wallet.slice(-4)}
												</a>
											</td>
											<td className="p-3 text-right body-sm text-secondary tabular-nums">
												{formatNumber(w.feesToken, { maximumFractionDigits: 0 })} {w.feeToken}
											</td>
											<td className="p-3 text-right body-sm text-primary tabular-nums">{w.feesUsdFormatted}</td>
											<td className="p-3 text-right body-sm text-secondary tabular-nums">{formatNumber(w.txCount)}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
					<p className="body-sm text-secondary">{fire.note}</p>
				</>
			) : (
				<div className="rounded-lg border border-subtle bg-surface p-5">
					<p className="body-sm text-secondary">{b.firePoolNote}</p>
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
