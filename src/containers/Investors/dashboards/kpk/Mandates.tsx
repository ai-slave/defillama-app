import { useMemo, useState } from 'react'
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
	NoticeBanner,
	QueryError,
	RefLinks,
	RowLink,
	SectionHeader,
	ToggleGroup,
	pct,
	signClass,
	signedBps,
	signedInt,
	signedPp,
	usdFromMillions
} from './ui'

/** Sleeve mix with its alpha underneath; an empty sleeve is a dash, not `0%`. */
function SleeveCell({ sleeve }: { sleeve: KpkMandateSleeve }) {
	if (!sleeve.mix) return <>—</>
	return (
		<span className="flex flex-col items-end">
			{pct(sleeve.mix, 0)}
			{sleeve.alpha != null && <span className={`body-sm ${KPK_MINT_TEXT}`}>{signedBps(sleeve.alpha)}</span>}
		</span>
	)
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
	// One scale for every row of the comparison bars, headroom above the largest APY.
	const barScale = useMemo(
		() => (perf ? Math.max(...perf.windows.map((window) => window.apy), perf.bench) * 1.1 : 0),
		[perf]
	)

	if (isError) return <QueryError label="Treasury mandates" />

	return (
		<div className="flex flex-col gap-5">
			{data?.notice && <NoticeBanner>{data.notice}</NoticeBanner>}

			<LedgerStrip>
				<LedgerTile
					label="Mandate AUM"
					value={data ? usdFromMillions(data.aum) : undefined}
					sub={data ? `Across ${data.clientCount} DAO and institutional treasury mandates` : undefined}
				/>
				<LedgerTile
					label="Deployed onchain"
					value={data ? (data.deployedOnchain ?? '—') : undefined}
					sub="Cumulative across all mandates, since inception"
				/>
				<LedgerTile
					label="Annual excess return"
					value={data ? usdFromMillions(data.totals.excess) : undefined}
					sub="Alpha vs benchmark on USD and ETH mandates"
				/>
			</LedgerStrip>

			<CompositionSection title="Composition of Mandate AUM" comps={data?.comp} initialKey="client" />

			<section className="flex flex-col gap-3">
				<SectionHeader title="Performance vs benchmark">
					{denomOptions.length > 0 && activeDenom && (
						<ToggleGroup label="Denomination" options={denomOptions} value={activeDenom} onChange={setSelectedDenom} />
					)}
				</SectionHeader>
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
								render: () => <span className={KPK_BENCH_TEXT}>{pct(perf?.bench)}</span>
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
								width: '30%',
								render: (row) => (
									<CompareBars
										value={row.apy}
										benchmark={perf?.bench}
										scale={barScale}
										labels={{
											value: `KPK ${pct(row.apy)} over ${row.label}`,
											benchmark: `Benchmark ${pct(perf?.bench)}`
										}}
									/>
								)
							}
						]}
					/>
					<div className="mt-4 flex flex-wrap gap-8 border-t border-pro-cards-border pt-4">
						<div className="flex flex-col gap-1">
							<span className="label-sm tracking-wider text-pro-text-label uppercase">Annual excess return</span>
							<span className={`font-mono text-xl font-medium tabular-nums ${KPK_MINT_TEXT}`}>
								{perf ? usdFromMillions(perf.excess) : '—'}
							</span>
							<span className="body-sm text-pro-text-secondary">
								Trailing 12 months, {activeDenom ?? '—'}-denominated
							</span>
						</div>
						<div className="flex flex-col gap-1">
							<span className="label-sm tracking-wider text-pro-text-label uppercase">Benchmark</span>
							<span className="text-sm text-pro-text-primary">{perf?.benchLabel ?? '—'}</span>
						</div>
					</div>
				</Card>
			</section>

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
							{ key: 'aum', label: 'AUM', right: true, render: (row) => usdFromMillions(row.aum) },
							{ key: 'share', label: 'Share', right: true, render: (row) => pct(row.share, 1) },
							{
								key: 'deployedPct',
								label: 'Deployed',
								right: true,
								render: (row) => (
									<span className="flex items-center justify-end gap-2">
										{pct(row.deployedPct, 1)}
										<MeterBar value={row.deployedPct} />
									</span>
								)
							},
							{
								key: 'usd',
								label: 'USD mix & alpha',
								right: true,
								render: (row) => <SleeveCell sleeve={row.usd} />
							},
							{
								key: 'eth',
								label: 'ETH mix & alpha',
								right: true,
								render: (row) => <SleeveCell sleeve={row.eth} />
							},
							{
								key: 'excess',
								label: 'Annual excess return',
								right: true,
								render: (row) => <span className={KPK_MINT_TEXT}>{usdFromMillions(row.excess)}</span>
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
										share: pct(100, 1),
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
