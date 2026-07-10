import { useQuery } from '@tanstack/react-query'
import { lazy, useEffect, useMemo } from 'react'
import type { IChartProps } from '~/components/ECharts/types'
import { useContentReady } from '~/containers/Investors/ContentReadyContext'
import { FLARE_BLUE, FLARE_ORANGE, lastNDaysZoom } from './chartDefaults'
import { chartToData, type UpstreamChart } from './transform'
import { ChartCard, KpiCard, NarrativeCallout, SectionHeader } from './ui'

const AreaChart = lazy(() => import('~/components/ECharts/AreaChart')) as React.FC<IChartProps>

interface FormattedValue {
	value: number
	formatted: string
}

interface StakingAPIResponse {
	narrative?: string
	stakingDelegationChart?: UpstreamChart
	kpis: {
		pctStakedOrDelegated: FormattedValue
		ftsoDelegated: FormattedValue
		ftsoDelegatedUsd?: FormattedValue
		totalStake: FormattedValue
		validatorCount: FormattedValue
		averageUptime: FormattedValue
	}
}

export default function Staking() {
	const query = useQuery<StakingAPIResponse>({
		queryKey: ['flare-staking'],
		queryFn: async () => {
			const res = await fetch('/api/public/flare/staking')
			if (!res.ok) throw new Error(`Flare staking API error: ${res.status}`)
			return res.json()
		},
		staleTime: 10 * 60 * 1000,
		refetchOnWindowFocus: false
	})

	const onContentReady = useContentReady()

	useEffect(() => {
		if (query.data) onContentReady()
	}, [query.data, onContentReady])

	const chart = useMemo(() => {
		const c = query.data?.stakingDelegationChart
		if (!c) return null
		return {
			title: c.title ?? 'P-Chain Staking vs. FTSO Delegation',
			subtitle: c.subtitle,
			data: chartToData(c),
			stacks: c.series.map((s) => s.name),
			// P-chain staking (the FIP.16 winner) in orange, FTSO delegation in blue.
			colors: Object.fromEntries(c.series.map((s) => [s.name, /ftso|deleg/i.test(s.name) ? FLARE_BLUE : FLARE_ORANGE]))
		}
	}, [query.data])

	if (!query.data) return null

	const k = query.data.kpis

	return (
		<div className="flex flex-col gap-6">
			{query.data.narrative && <NarrativeCallout>{query.data.narrative}</NarrativeCallout>}

			<SectionHeader>Staking &amp; Delegation</SectionHeader>
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
				<KpiCard label="% of Circ. Supply Staked or Delegated" value={k.pctStakedOrDelegated.formatted} />
				<KpiCard label="FTSO Delegation" value={k.ftsoDelegated.formatted} sub={k.ftsoDelegatedUsd?.formatted} />
				<KpiCard label="Total Stake" value={k.totalStake.formatted} />
				<KpiCard label="Validators" value={k.validatorCount.formatted} />
				<KpiCard label="Avg Uptime" value={k.averageUptime.formatted} />
			</div>

			{chart && chart.data.length > 0 && (
				<ChartCard title={chart.title}>
					<div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-(--legacy-text-label)">
						{chart.stacks.map((name) => (
							<span key={name} className="flex items-center gap-1.5">
								<span className="size-2.5 rounded-full" style={{ backgroundColor: chart.colors[name] }} />
								{name}
							</span>
						))}
					</div>
					<AreaChart
						chartData={chart.data}
						stacks={chart.stacks}
						stackColors={chart.colors}
						valueSymbol=""
						title=""
						hideGradient
						hideLegend
						height="360px"
						chartOptions={lastNDaysZoom(chart.data.length)}
					/>
					{chart.subtitle && (
						<p className="mt-2 text-xs leading-relaxed text-(--legacy-text-label)">{chart.subtitle}</p>
					)}
				</ChartCard>
			)}
		</div>
	)
}
