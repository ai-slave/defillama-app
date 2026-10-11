import { StatTile } from '~/ui/SummaryStats'
import { formatPercent } from '~/utils/numberFormat'
import { useTab, type YieldsResponse } from './api'
import { ChartCard, SimpleTable } from './ui'

export default function Yields() {
	const { data } = useTab<YieldsResponse>('yields')
	const k = data?.kpis ?? ({} as Partial<NonNullable<typeof data>['kpis']>)

	return (
		<div className="flex flex-col gap-6">
			<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
				{data ? (
					<>
						<StatTile
							label={k.topLooperApy?.label || 'Top Looper Max APY'}
							value={k.topLooperApy?.formatted ?? '—'}
							sub="At max leverage"
						/>
						<StatTile
							label={k.topOdysseyApy?.label || 'Top Odyssey Max APY'}
							value={k.topOdysseyApy?.formatted ?? '—'}
							sub="At max leverage"
						/>
						<StatTile label={k.topVesperApy?.label || 'Top Vesper Net APY'} value={k.topVesperApy?.formatted ?? '—'} />
						<StatTile label="Active Odyssey Strategies" value={k.odysseyStrategyCount?.formatted ?? '—'} />
					</>
				) : (
					<>
						<StatTile label={k.topLooperApy?.label || 'Top Looper Max APY'} sub="At max leverage" loading />
						<StatTile label={k.topOdysseyApy?.label || 'Top Odyssey Max APY'} sub="At max leverage" loading />
						<StatTile label={k.topVesperApy?.label || 'Top Vesper Net APY'} loading />
						<StatTile label="Active Odyssey Strategies" loading />
					</>
				)}
			</div>

			<h2 className="heading-xs">Odyssey Loopr · Max APY by Chain</h2>
			<ChartCard title="Aggregated APY per chain" subtitle="At max leverage, across all live Looper strategies">
				<SimpleTable
					getOccurrenceKey={(row) => row.chain}
					rows={data?.odysseyApy?.rows}
					cols={[
						{ key: 'chain', label: 'Chain' },
						{ key: 'strategies', label: 'Strategies', right: true },
						{
							key: 'maxApyPct',
							label: 'Max APY',
							right: true,
							render: (r) =>
								`${formatPercent(r.maxApyPct ?? r.netApyPct ?? 0, { input: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })}`
						}
					]}
				/>
			</ChartCard>

			<h2 className="heading-xs">Odyssey Loopr · Per-Strategy Max APY</h2>
			<ChartCard title="Live strategies" subtitle="Collateral / borrow APY per pool (snapshot)">
				<SimpleTable
					getOccurrenceKey={(row) => JSON.stringify([row.name, row.chain, row.collateral, row.borrow])}
					rows={data?.looperApy?.rows}
					cols={[
						{ key: 'name', label: 'Strategy' },
						{ key: 'chain', label: 'Chain' },
						{ key: 'collateral', label: 'Collateral' },
						{ key: 'borrow', label: 'Borrow' },
						{
							key: 'underlyingApyPct',
							label: 'Underlying APY',
							right: true,
							render: (r) =>
								`${formatPercent(r.underlyingApyPct ?? r.collateralApyPct ?? 0, { input: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })}`
						},
						{
							key: 'borrowApyPct',
							label: 'Borrow APY',
							right: true,
							render: (r) =>
								`${formatPercent(r.borrowApyPct ?? 0, { input: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })}`
						},
						{
							key: 'maxApyPct',
							label: 'Max APY',
							right: true,
							render: (r) =>
								`${formatPercent(r.maxApyPct ?? r.netApyPct ?? 0, { input: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })}`
						}
					]}
				/>
			</ChartCard>

			<h2 className="heading-xs">Vesper Pools · Net APY</h2>
			<ChartCard title="All Vesper pools" subtitle="Current snapshot across Ethereum, Optimism and Base">
				<SimpleTable
					getOccurrenceKey={(row) => JSON.stringify([row.pool, row.chain, row.asset])}
					rows={data?.vesperApy?.pools}
					cols={[
						{ key: 'pool', label: 'Pool' },
						{ key: 'chain', label: 'Chain' },
						{ key: 'asset', label: 'Asset' },
						{ key: 'tvl', label: 'TVL', right: true },
						{
							key: 'netApyPct',
							label: 'Net APY',
							right: true,
							render: (r) =>
								`${formatPercent(r.netApyPct ?? 0, { input: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })}`
						}
					]}
				/>
			</ChartCard>

			<h2 className="heading-xs">Synth LP Pools · Current APY</h2>
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
				{Object.entries(data?.lpApyHistory || {}).map(([key, venue]) => (
					<ChartCard key={key} title={venue.venue} subtitle="Latest APY per pool">
						<SimpleTable
							getOccurrenceKey={(row) => row.pool}
							rows={venue.pools}
							cols={[
								{ key: 'pool', label: 'Pool' },
								{
									key: 'latestApy',
									label: 'APY',
									right: true,
									render: (r) =>
										`${formatPercent(r.latestApy ?? 0, { input: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })}`
								}
							]}
						/>
					</ChartCard>
				))}
			</div>

			<h2 className="heading-xs">All Synth LP Pools</h2>
			<ChartCard title="LP pools snapshot" subtitle="Live across Aerodrome, Velodrome, Curve, Lithos">
				<SimpleTable
					getOccurrenceKey={(row) => JSON.stringify([row.venue, row.chain, row.pool])}
					rows={data?.lpPools?.rows}
					cols={[
						{ key: 'venue', label: 'Venue' },
						{ key: 'chain', label: 'Chain' },
						{ key: 'pool', label: 'Pool' },
						{ key: 'tvl', label: 'TVL', right: true },
						{ key: 'apy', label: 'APY', right: true }
					]}
				/>
			</ChartCard>
		</div>
	)
}
