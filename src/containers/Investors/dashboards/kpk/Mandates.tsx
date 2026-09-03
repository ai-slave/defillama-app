import { useMemo, useState } from 'react'
import { formatDate } from '~/utils/dateFormat'
import type { KpkMandateClient, KpkMandateSleeve } from './api'
import { useKpkMandates } from './api'
import { KPK_BENCH_TEXT, KPK_MINT_TEXT } from './chartDefaults'
import { CompositionSection } from './CompositionSection'
import {
	Card,
	CompareBars,
	DataTable,
	LedgerStrip,
	LedgerTile,
	MeterBar,
	pct,
	QueryError,
	RefLinks,
	RowLink,
	scopeLine,
	SectionHeader,
	signClass,
	signedBps,
	signedInt,
	signedPp,
	ToggleGroup,
	usdFromMillions
} from './ui'

/** Sleeve mix with its alpha underneath. A denomination the client does not hold is a dash, not `0%`. */
function SleeveCell({ sleeve }: { sleeve: KpkMandateSleeve | null }) {
	if (!sleeve?.mix) return <>—</>
	return (
		<span className="flex flex-col items-end">
			{pct(sleeve.mix, 0)}
			{sleeve.alpha != null && <span className={`body-sm ${signClass(sleeve.alpha)}`}>{signedBps(sleeve.alpha)}</span>}
		</span>
	)
}

function deployedTitle(client: KpkMandateClient): string | undefined {
	if (client.defiUsd == null || client.yieldAum == null) return undefined
	const parts = [
		`${usdFromMillions(client.defiUsd)} of ${usdFromMillions(client.yieldAum)} in yield-bearing defi positions`
	]
	if (client.opsUsd) parts.push(`${usdFromMillions(client.opsUsd)} held as ops`)
	if (client.coveragePct != null && client.coveragePct < 99.95) {
		parts.push(`${pct(client.coveragePct, 1)} of the defi book matched a benchmark`)
	}
	return parts.join(', ')
}

export default function Mandates() {
	const { data, isError } = useKpkMandates()
	const [selectedDenom, setSelectedDenom] = useState<string | null>(null)

	const denomOptions = useMemo(
		() => (data?.denominations ?? []).map((denom) => ({ key: denom, label: denom })),
		[data?.denominations]
	)
	const activeDenom = selectedDenom && data?.perf?.[selectedDenom] ? selectedDenom : (data?.denominations?.[0] ?? null)
	const perf = activeDenom ? data?.perf?.[activeDenom] : undefined
	// One scale for every row of the comparison bars, headroom above the largest
	// figure in either series — the benchmark moves per window, so it can lead.
	const barScale = useMemo(
		() => (perf ? Math.max(...perf.windows.map((window) => Math.max(window.apy ?? 0, window.bench ?? 0))) * 1.1 : 0),
		[perf]
	)

	const sharesTotal = data ? data.clients.reduce((sum, client) => sum + (client.share ?? 0), 0) : null

	const showPerf = !data || data.denominations.length > 0

	if (isError) return <QueryError label="Treasury mandates" />

	return (
		<div className="flex flex-col gap-5">
			<LedgerStrip>
				<LedgerTile
					label="Mandate AUM"
					value={data ? usdFromMillions(data.aum) : undefined}
					sub={
						data
							? `Across ${data.clientCount} DAO and institutional treasury mandates${
									data.asOf ? ` · as of ${formatDate(data.asOf)}` : ''
								}`
							: undefined
					}
				/>
				<LedgerTile
					label="Deployed onchain"
					value={data ? (data.deployedOnchain ?? '—') : undefined}
					sub="Cumulative across all mandates, since inception"
				/>
				<LedgerTile
					label="Annual excess return"
					value={data ? usdFromMillions(data.totals.excess) : undefined}
					sub="At the 30-day spread, summed across every benchmarked mandate sleeve"
				/>
			</LedgerStrip>

			<CompositionSection title="Composition of Mandate AUM" comps={data?.comp} initialKey="client" />

			{showPerf && (
				<section className="flex flex-col gap-3">
					<SectionHeader title="Performance vs benchmark">
						{denomOptions.length > 0 && activeDenom && (
							<ToggleGroup
								label="Denomination"
								options={denomOptions}
								value={activeDenom}
								onChange={setSelectedDenom}
							/>
						)}
					</SectionHeader>
					{}
					{data?.yieldAsOf && (
						<p className="-mt-1 text-xs text-pro-text-secondary">
							Positions report as of {formatDate(data.yieldAsOf)}
							{data.yieldIsSample ? ' — sample data, so every figure in this section is frozen at that date' : ''}
						</p>
					)}
					<Card>
						<DataTable
							rows={perf?.windows}
							cols={[
								{ key: 'label', label: 'Window' },
								{
									key: 'apy',
									label: 'KPK APY',
									right: true,
									render: (row) => <span className={KPK_MINT_TEXT}>{pct(row.apy)}</span>
								},
								{
									key: 'bench',
									label: 'Benchmark',
									right: true,
									render: (row) => <span className={KPK_BENCH_TEXT}>{pct(row.bench)}</span>
								},
								{
									key: 'spread',
									label: 'Spread',
									right: true,
									render: (row) => <span className={signClass(row.spread)}>{signedPp(row.spread)}</span>
								},
								{
									key: 'spreadBps',
									label: 'Spread (bps)',
									right: true,
									render: (row) => <span className={signClass(row.spreadBps)}>{signedInt(row.spreadBps)}</span>
								},
								{
									key: 'bars',
									label: '',
									width: '25%',
									render: (row) => (
										<CompareBars
											value={row.apy}
											benchmark={row.bench}
											scale={barScale}
											labels={{
												value: `KPK ${pct(row.apy)} over ${row.label}`,
												benchmark: `Benchmark ${pct(row.bench)}`
											}}
										/>
									)
								}
							]}
						/>
						<div className="mt-4 flex flex-wrap gap-8 border-t border-pro-cards-border pt-4">
							<div className="flex flex-col gap-1">
								<span className="label-sm tracking-wider text-pro-text-label uppercase">Annual excess return</span>
								<span className={`font-mono text-xl font-medium tabular-nums ${signClass(perf?.excess)}`}>
									{perf ? usdFromMillions(perf.excess) : '—'}
								</span>
								<span className="body-sm text-pro-text-secondary">
									30-day spread on the {activeDenom ?? '—'} balance
									{data?.yieldAsOf ? ` as of ${formatDate(data.yieldAsOf)}` : ' as reported'}
								</span>
							</div>
							<div className="flex flex-col gap-1">
								<span className="label-sm tracking-wider text-pro-text-label uppercase">Benchmark</span>
								<span className="text-sm text-pro-text-primary">{perf?.benchLabel ?? '—'}</span>
							</div>
						</div>
						{activeDenom && perf && (
							<p className="mt-4 border-t border-pro-cards-border pt-3 body-sm text-pro-text-secondary">
								{scopeLine(activeDenom, perf.scope)}
							</p>
						)}
					</Card>
				</section>
			)}

			<section className="flex flex-col gap-3">
				<SectionHeader title="Per-client breakdown" />
				<Card>
					<DataTable<KpkMandateClient>
						rows={data?.clients}
						cols={[
							{
								key: 'name',
								label: 'Client',
								render: (row) => <span className="text-pro-text-primary">{row.name}</span>
							},
							{
								key: 'aum',
								label: 'AUM',
								right: true,
								render: (row) =>
									row.aum == null && row.yieldAum != null ? (
										<span
											className="cursor-help"
											title={`Not in the ${(data?.asOf && formatDate(data.asOf)) ?? 'latest'} treasury snapshot yet; ${usdFromMillions(
												row.yieldAum
											)} as of ${(data?.yieldAsOf && formatDate(data.yieldAsOf)) ?? 'the positions report'}`}
										>
											—
										</span>
									) : (
										usdFromMillions(row.aum)
									)
							},
							{ key: 'share', label: 'Share', right: true, render: (row) => pct(row.share, 1) },
							{
								key: 'deployedPct',
								label: 'Deployed',
								right: true,
								render: (row) => (
									<span
										title={deployedTitle(row)}
										className={`flex items-center justify-end gap-2 ${deployedTitle(row) ? 'cursor-help' : ''}`}
									>
										{pct(row.deployedPct, 1)}
										<MeterBar value={row.deployedPct} />
									</span>
								)
							},
							{ key: 'usd', label: 'USD mix & alpha', right: true, render: (row) => <SleeveCell sleeve={row.usd} /> },
							{ key: 'eth', label: 'ETH mix & alpha', right: true, render: (row) => <SleeveCell sleeve={row.eth} /> },
							{
								key: 'excess',
								label: 'Annual excess return',
								right: true,
								render: (row) => <span className={signClass(row.excess)}>{usdFromMillions(row.excess)}</span>
							},
							{ key: 'since', label: 'Managed since', right: true },
							{
								key: 'url',
								label: '',
								render: (row) => <RowLink href={row.url} label={`${row.name} treasury dashboard`} />
							}
						]}
						footer={
							data
								? {
										name: 'Total',
										aum: usdFromMillions(data.totals.aum),
										share: pct(sharesTotal, 1),
										deployedPct: pct(data.totals.weightedDeployedPct, 1),
										excess: usdFromMillions(data.totals.excess)
									}
								: undefined
						}
					/>
				</Card>
			</section>

			<RefLinks refs={data?.refs} />
		</div>
	)
}
