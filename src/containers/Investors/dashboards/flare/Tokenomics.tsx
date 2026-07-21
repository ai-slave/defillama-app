import { useQuery } from '@tanstack/react-query'
import { lazy, useEffect, useState } from 'react'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import { useContentReady } from '~/containers/Investors/ContentReadyContext'
import { readInvestorApiJson } from '../../api.types'
import { CSV_ONLY_EXPORT } from './chartDefaults'
import { buildFlareTokenomicsData, type TokenomicsAPIResponse } from './data'
import { ChartCard, KpiCard, NarrativeCallout, SectionHeader } from './ui'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>

type BurnView = 'daily' | 'cumulative'

function ToggleButton({
	active,
	onClick,
	children
}: {
	active: boolean
	onClick: () => void
	children: React.ReactNode
}) {
	return (
		<button
			onClick={onClick}
			className={`rounded-md px-3 py-1 text-xs font-semibold tracking-wide transition-colors ${
				active
					? 'bg-sl-accent-muted text-sl-accent'
					: 'text-pro-text-secondary hover:bg-sl-hover-bg hover:text-pro-text-primary'
			}`}
		>
			{children}
		</button>
	)
}

const FAQ_ITEMS: { q: string; a: React.ReactNode }[] = [
	{
		q: 'What is FIP.16?',
		a: 'FIP.16 is a Flare governance proposal passed in April 2026 that restructured FLR token economics. Key changes: annual inflation reduced from 5% to 3%, the base gas fee increased 20x (25 → 500 gwei), staking incentivized over delegation via a 5x signing weight multiplier, and the FIRE protocol introduced to aggregate and burn network revenues.'
	},
	{
		q: 'What is the FIRE protocol?',
		a: 'FIRE (Flare Income Reinvestment Entity) is a protocol-level pool that collects revenues from transaction fees, FDC data requests, FAsset activity, and future MEV capture. Its primary mandate is to reduce FLR supply through open-market buybacks and burns. Secondary mandates include funding ecosystem incentives and supporting Foundation sustainability.'
	},
	{
		q: 'What is the 300M FLR/year burn target?',
		a: 'Under conservative modeling, the 20x base fee increase should generate approximately 300M FLR/year in burns from transaction fees alone — enough to offset a meaningful portion of annual inflation. This is an aspirational target; actual burn rate grows proportionally with network activity. The Burn vs. Emit chart above shows real-time progress toward this goal.'
	},
	{
		q: "What's the difference between gas burns and protocol burns?",
		a: 'Gas burns happen automatically on every Flare transaction — EVM base fees are burned by the protocol. Protocol burns (tracked via TIP20) are explicit burns triggered by FDC data requests, FAsset minting/redemption fees, and FIRE pool market purchases. Both types are shown in the charts above.'
	}
]

function FaqItem({ q, a }: { q: string; a: React.ReactNode }) {
	return (
		<details className="group rounded-lg border border-pro-cards-border bg-pro-cards-bg">
			<summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 text-sm font-medium text-pro-text-primary">
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
			<p className="px-4 pb-4 text-sm leading-relaxed text-pro-text-secondary">{a}</p>
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

	const onContentReady = useContentReady()
	const [burnView, setBurnView] = useState<BurnView>('daily')

	useEffect(() => {
		if (query.data) onContentReady()
	}, [query.data, onContentReady])

	if (!query.data) return null

	const { burn: b, emissions: e } = query.data
	const bk = b.kpis
	const ek = e.kpis

	return (
		<div className="flex flex-col gap-6">
			{query.data.narrative && <NarrativeCallout>{query.data.narrative}</NarrativeCallout>}

			<SectionHeader>FLR Burn</SectionHeader>
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
						<h3 className="text-sm font-semibold text-pro-text-primary">{b.burnTitle}</h3>
						<p className="mt-0.5 text-xs leading-relaxed text-pro-text-label">
							FLR removed from supply by gas burns - daily and cumulative.
						</p>
					</div>
					<div className="flex gap-1 rounded-md border border-pro-cards-border p-0.5">
						<ToggleButton active={burnView === 'daily'} onClick={() => setBurnView('daily')}>
							Daily
						</ToggleButton>
						<ToggleButton active={burnView === 'cumulative'} onClick={() => setBurnView('cumulative')}>
							Cumulative
						</ToggleButton>
					</div>
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
				<KpiCard label="Burn / Emit (latest)" value={ek.latestBurnVsEmitPct} />
				<KpiCard label="Net Inflation (latest)" value={ek.latestNetInflation} />
				<KpiCard label="Burn / Emit (30d)" value={ek.burnVsEmit30dPct} />
				<KpiCard label="Net Inflation (30d)" value={ek.netInflation30d} />
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
			{e.burnVsEmitSubtitle && <p className="text-xs leading-relaxed text-pro-text-label">{e.burnVsEmitSubtitle}</p>}

			<SectionHeader>FIRE Pool (FIP.16)</SectionHeader>
			<div className="rounded-lg border border-pro-cards-border bg-pro-cards-bg p-5">
				<div className="flex items-center gap-2">
					<span className="rounded-full border border-pro-cards-border bg-sl-btn-inactive-bg px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-pro-text-secondary uppercase">
						Coming Soon
					</span>
					<span className="text-sm font-medium text-pro-text-primary">FIRE pool balance & burns</span>
				</div>
				<p className="mt-3 text-xs leading-relaxed text-pro-text-label">{b.firePoolNote}</p>
			</div>

			<SectionHeader>FAQ</SectionHeader>
			<div className="flex flex-col gap-3">
				{FAQ_ITEMS.map((item) => (
					<FaqItem key={item.q} q={item.q} a={item.a} />
				))}
			</div>
		</div>
	)
}
