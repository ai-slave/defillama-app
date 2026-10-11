import { StatusBadge } from '~/ui/StatusBadge'
import { StatTile } from '~/ui/SummaryStats'
import { formatDateTime } from '~/utils/dateFormat'
import { formatNumber, formatRatio, formatUsd, formatPercent } from '~/utils/numberFormat'
import { useTab, type PegRow, type PegSupplyCap, type PegsResponse } from './api'
import { ChartCard, SimpleTable, type Col } from './ui'

const SIZES = [10_000, 50_000, 100_000, 500_000, 1_000_000]

function PegPill({ ratio, bps }: { ratio: number; bps?: number }) {
	const dev = bps != null ? bps : Math.abs(ratio - 1) * 10_000
	const color = dev <= 30 ? 'text-success' : dev <= 100 ? 'text-warning' : 'text-error'
	return (
		<span className={`tabular-nums ${color}`}>
			{formatRatio(ratio, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}{' '}
			<span className="body-xs text-secondary">({formatNumber(dev, { maximumFractionDigits: 0 })} bps)</span>
		</span>
	)
}

function SynthTable({ rows }: { rows: Array<PegRow> }) {
	if (!rows?.length) return <div className="px-2 py-4 body-sm text-secondary">No data</div>
	return (
		<div className="overflow-x-auto">
			<table className="w-full body-md">
				<thead>
					<tr className="border-b border-subtle bg-page">
						<th className="px-3 py-2.5 text-left title-sm tracking-wider text-secondary uppercase">Chain</th>
						<th className="px-3 py-2.5 text-left title-sm tracking-wider text-secondary uppercase">Counter</th>
						<th className="px-3 py-2.5 text-right title-sm tracking-wider text-secondary uppercase">Spot Peg</th>
						{SIZES.map((s) => (
							<th key={s} className="px-3 py-2.5 text-right title-sm tracking-wider text-secondary uppercase">
								{formatUsd(s, { compact: true, maximumFractionDigits: 0 })}
							</th>
						))}
						<th className="px-3 py-2.5 text-right title-sm tracking-wider text-secondary uppercase">Kyber</th>
					</tr>
				</thead>
				<tbody>
					{rows.map((r) => (
						<tr key={r.chain + r.counter} className="border-b border-subtle last:border-0 hover:bg-hover-row">
							<td className="px-3 py-2.5 text-primary capitalize">{r.chain}</td>
							<td className="px-3 py-2.5 text-secondary">{r.counter}</td>
							<td className="px-3 py-2.5 text-right">
								<PegPill ratio={r.pegRatio} />
							</td>
							{SIZES.map((s) => {
								const d = r.depth.find((x) => x.sizeUsd === s)
								return (
									<td key={s} className="px-3 py-2.5 text-right tabular-nums">
										{d ? <PegPill ratio={d.pegRatio} bps={Math.abs(d.pegRatio - 1) * 10_000} /> : '—'}
									</td>
								)
							})}
							<td className="px-3 py-2.5 text-right">
								<StatusBadge status={r.kyberSupported ? 'good' : 'neutral'}>
									{r.kyberSupported ? 'yes' : 'no'}
								</StatusBadge>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	)
}

export default function Pegs() {
	const { data } = useTab<PegsResponse>('pegs')
	const msUSD = (data?.rows || []).filter((r) => r.synth === 'msUSD')
	const msETH = (data?.rows || []).filter((r) => r.synth === 'msETH')
	const k = data?.kpis

	return (
		<div className="flex flex-col gap-6">
			{data?.asOf && (
				<p className="body-sm text-secondary">
					As of {formatDateTime(data.asOf, { timeZone: 'UTC' }) ?? '-'} — {data.methodology}
				</p>
			)}

			<h2 className="heading-xs">Spot peg · Headline</h2>
			<div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
				{data ? (
					<>
						<StatTile
							label="msUSD spot peg"
							value={
								k?.msUSD
									? `${formatRatio(k.msUSD.spotPegRatio, { minimumFractionDigits: 4, maximumFractionDigits: 4 })} (${k.msUSD.spotDeviationBps} bps)`
									: '—'
							}
							sub={
								k?.msUSD
									? `Worst: ${k.msUSD.worstChain} @ ${formatUsd(k.msUSD.worstSizeUsd, { compact: true, maximumFractionDigits: 0 })} → ${formatRatio(k.msUSD.worstPegRatio, { minimumFractionDigits: 4, maximumFractionDigits: 4 })} (${k.msUSD.worstDeviationBps} bps)`
									: undefined
							}
						/>
						<StatTile
							label="msETH spot peg"
							value={
								k?.msETH
									? `${formatRatio(k.msETH.spotPegRatio, { minimumFractionDigits: 4, maximumFractionDigits: 4 })} (${k.msETH.spotDeviationBps} bps)`
									: '—'
							}
							sub={
								k?.msETH
									? `Worst: ${k.msETH.worstChain} @ ${formatUsd(k.msETH.worstSizeUsd, { compact: true, maximumFractionDigits: 0 })} → ${formatRatio(k.msETH.worstPegRatio, { minimumFractionDigits: 4, maximumFractionDigits: 4 })} (${k.msETH.worstDeviationBps} bps)`
									: undefined
							}
						/>
					</>
				) : (
					<>
						<StatTile label="msUSD spot peg" loading />
						<StatTile label="msETH spot peg" loading />
					</>
				)}
			</div>

			<h2 className="heading-xs">msUSD · Peg depth</h2>
			<ChartCard
				title="msUSD across chains"
				subtitle="Effective peg at 5 trade sizes (DefiLlama coins · KyberSwap on supported chains)"
			>
				<SynthTable rows={msUSD} />
			</ChartCard>

			<h2 className="heading-xs">msETH · Peg depth</h2>
			<ChartCard title="msETH across chains" subtitle="Effective peg at 5 trade sizes">
				<SynthTable rows={msETH} />
			</ChartCard>

			<h2 className="heading-xs">Supply caps · Onchain + bridges</h2>
			{(() => {
				const capCols: Array<Col<PegSupplyCap>> = [
					{ key: 'chain', label: 'Chain' },
					{ key: 'synth', label: 'Synth' },
					{
						key: 'supply',
						label: 'Supply',
						right: true,
						render: (r) => formatNumber(r.supply)
					},
					{
						key: 'maxSupply',
						label: 'Max Supply',
						right: true,
						render: (r) => formatNumber(r.maxSupply)
					},
					{
						key: 'usagePct',
						label: 'Usage',
						right: true,
						render: (r) =>
							`${formatPercent(r.usagePct, { input: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: false })}`
					}
				]
				return (
					<>
						<ChartCard title="Mint caps" subtitle="totalSupply / maxTotalSupply">
							<SimpleTable<PegSupplyCap>
								getOccurrenceKey={(row) => JSON.stringify([row.chain, row.synth])}
								rows={data?.supplyCaps}
								cols={capCols}
							/>
						</ChartCard>
						{data?.bridgeInCaps?.length ? (
							<ChartCard title="Bridge-in caps" subtitle="Per-chain bridged-in supply vs cap">
								<SimpleTable<PegSupplyCap>
									getOccurrenceKey={(row) => JSON.stringify([row.chain, row.synth])}
									rows={data.bridgeInCaps}
									cols={capCols}
								/>
							</ChartCard>
						) : null}
						{data?.bridgeOutCaps?.length ? (
							<ChartCard title="Bridge-out caps" subtitle="Per-chain bridged-out supply vs cap">
								<SimpleTable<PegSupplyCap>
									getOccurrenceKey={(row) => JSON.stringify([row.chain, row.synth])}
									rows={data.bridgeOutCaps}
									cols={capCols}
								/>
							</ChartCard>
						) : null}
					</>
				)
			})()}
		</div>
	)
}
