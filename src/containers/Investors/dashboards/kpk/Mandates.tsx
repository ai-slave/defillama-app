import { useMemo, useState } from 'react'
import { formatDate } from '~/utils/dateFormat'
import { formatPercent, PERCENT_POINTS_TWO_DECIMALS_OPTIONS } from '~/utils/numberFormat'
import type { KpkExcessWindow, KpkMandateClient, KpkMandatePerf, KpkMandateSleeve, KpkMandateWindow } from './api'
import { useKpkMandates } from './api'
import { KPK_BENCH_TEXT, KPK_MINT_TEXT } from './chartDefaults'
import { CompositionSection } from './CompositionSection'
import {
	Card,
	CompareBars,
	DataTable,
	earnedTitle,
	earnedWindowLine,
	LedgerStrip,
	LedgerTile,
	MeterBar,
	PROSE_DUST_M,
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
	usdFromMillions,
	usdSignedFromMillions,
	type FooterRow,
	KPK_PERCENT_OPTIONS
} from './ui'

/** Sleeve mix with its alpha underneath. A denomination the client does not hold is a dash, not `0%`. */
function SleeveCell({ sleeve }: { sleeve: KpkMandateSleeve | null }) {
	if (!sleeve?.mix) return <>—</>
	return (
		<span className="flex flex-col items-end">
			{formatPercent(sleeve.mix, {
				input: 'percent',
				smallValueDisplay: 'rounded',
				maximumFractionDigits: 0,
				useGrouping: false
			}) ?? '—'}
			{sleeve.alpha != null && <span className={`body-sm ${signClass(sleeve.alpha)}`}>{signedBps(sleeve.alpha)}</span>}
		</span>
	)
}

function deployedTitle(client: KpkMandateClient): string | undefined {
	if (client.deployedUsd == null || client.yieldAum == null) return undefined
	const idle = client.idleUsd ?? 0
	const workingOps = (client.opsUsd ?? 0) - idle
	const legs: Array<string> = []
	if ((client.defiUsd ?? 0) > PROSE_DUST_M) legs.push(`${usdFromMillions(client.defiUsd)} in defi positions`)
	if (workingOps > PROSE_DUST_M) legs.push(`${usdFromMillions(workingOps)} in ops positions`)
	let out = `${usdFromMillions(client.deployedUsd)} of ${usdFromMillions(client.yieldAum)} deployed`
	if (legs.length > 0) out += ` — ${legs.join(' and ')}`
	if (idle > PROSE_DUST_M) out += `, with ${usdFromMillions(idle)} sitting idle`
	return out
}

function rateBasisTitle(window: KpkMandateWindow): string | undefined {
	if (window.realized === undefined) return undefined
	if (!window.realized) {
		return 'Spot reading: a trailing mean applied to the latest balances. No per-position history covers this window.'
	}
	const balance = window.avgBalance == null ? '' : ` on a mean balance of ${usdFromMillions(window.avgBalance)}`
	const spot =
		window.spot?.apy == null
			? ''
			: ` The spot reading on the latest balances is ${formatPercent(window.spot.apy, PERCENT_POINTS_TWO_DECIMALS_OPTIONS) ?? '—'}.`
	return `Earned: money-weighted across every priced position-day in the window${balance}.${spot}`
}

function performanceEarnedTitle(
	perf: KpkMandatePerf | undefined,
	window: KpkExcessWindow | null | undefined
): string | undefined {
	if (!perf || !window || perf.earned == null || perf.benchEarned == null || perf.avgBalance == null) return undefined
	const from = formatDate(window.from) ?? window.from
	const to = formatDate(window.to) ?? window.to
	return `Window ${from} – ${to} (${window.days} days). ${perf.denom} earned ${usdFromMillions(
		perf.earned
	)} against ${usdFromMillions(perf.benchEarned)} at benchmark, on a mean balance of ${usdFromMillions(perf.avgBalance)}.`
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
	const excessWindow = data?.excessWindow
	const perfEarnedTitle = performanceEarnedTitle(perf, excessWindow)
	// One scale for every row of the comparison bars, headroom above the largest
	// figure in either series — the benchmark moves per window, so it can lead.
	const barScale = useMemo(
		() => (perf ? Math.max(...perf.windows.map((window) => Math.max(window.apy ?? 0, window.bench ?? 0))) * 1.1 : 0),
		[perf]
	)

	const sharesTotal = data ? data.clients.reduce((sum, client) => sum + (client.share ?? 0), 0) : null

	const showPerf = !data || data.denominations.length > 0

	const clientFooter = useMemo<Array<FooterRow> | undefined>(() => {
		if (!data) return undefined
		const rows: Array<FooterRow> = []
		const inactive = data.inactive
		if (inactive) {
			rows.push({
				muted: true,
				title: `${inactive.names.join(', ')} held nothing in the ${
					(data.asOf && formatDate(data.asOf)) ?? 'latest'
				} snapshot, so they are not listed above.`,
				cells: {
					name: `Plus ${inactive.count} mandate${inactive.count > 1 ? 's' : ''} with no current balance`,
					excess: usdSignedFromMillions(inactive.excess)
				}
			})
		}
		rows.push({
			cells: {
				name: 'Total',
				aum: usdFromMillions(data.totals.aum),
				share: formatPercent(sharesTotal, KPK_PERCENT_OPTIONS) ?? '—',
				deployedPct: formatPercent(data.totals.weightedDeployedPct, KPK_PERCENT_OPTIONS) ?? '—',
				excess: usdSignedFromMillions(data.totals.excess)
			}
		})
		return rows
	}, [data, sharesTotal])

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
				>
					{data && (
						<span className="body-sm text-pro-text-secondary">
							Non-custodial · client assets never leave client-controlled Safes
						</span>
					)}
				</LedgerTile>
				<LedgerTile
					label="Deployed onchain"
					value={data ? (data.deployedOnchain ?? '—') : undefined}
					sub="Cumulative across all mandates, since inception"
					subRef={data?.deploymentRef}
					metric={data?.deployedOnchainTxnsLabel}
					metricLabel="onchain transactions"
					metricRef={data?.deployedOnchainTxnsRef}
				/>
				{/* Dollars actually earned above benchmark, so it can be negative — and the
				    caption has to say what window produced it. */}
				<LedgerTile
					label="Annual excess return"
					value={data ? usdSignedFromMillions(data.totals.excess) : undefined}
					valueClass={data ? signClass(data.totals.excess) : undefined}
					sub={data ? earnedWindowLine(excessWindow) : undefined}
					subTitle={earnedTitle(excessWindow)}
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
					{data?.yieldAsOf && (
						<p className="-mt-1 text-xs text-pro-text-secondary">
							Positions report as of {formatDate(data.yieldAsOf)}
							{data.yieldIsSample ? ' — sample data, so every figure in this section is frozen at that date' : ''}
						</p>
					)}
					<Card>
						<DataTable<KpkMandateWindow>
							getRowKey={(row) => String(row.days)}
							rows={perf?.windows}
							cols={[
								{ key: 'label', label: 'Window' },
								{
									key: 'apy',
									label: 'KPK APY',
									title:
										'Money-weighted over every priced position-day in the window, not a spot read on the latest balances',
									right: true,
									render: (row) => {
										const basis = rateBasisTitle(row)
										return (
											<span title={basis} className={`${KPK_MINT_TEXT} ${basis ? 'cursor-help' : ''}`}>
												{formatPercent(row.apy, PERCENT_POINTS_TWO_DECIMALS_OPTIONS) ?? '—'}
											</span>
										)
									}
								},
								{
									key: 'bench',
									label: 'Benchmark',
									right: true,
									render: (row) => (
										<span className={KPK_BENCH_TEXT}>
											{formatPercent(row.bench, PERCENT_POINTS_TWO_DECIMALS_OPTIONS) ?? '—'}
										</span>
									)
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
												value: `KPK ${formatPercent(row.apy, PERCENT_POINTS_TWO_DECIMALS_OPTIONS) ?? '—'} over ${row.label}`,
												benchmark: `Benchmark ${formatPercent(row.bench, PERCENT_POINTS_TWO_DECIMALS_OPTIONS) ?? '—'}`
											}}
										/>
									)
								}
							]}
						/>
						<div className="mt-4 flex flex-wrap gap-8 border-t border-pro-cards-border pt-4">
							<div className="flex flex-col gap-1">
								<span className="label-sm tracking-wider text-pro-text-label uppercase">Annual excess return</span>
								<span
									title={perfEarnedTitle}
									className={`font-mono text-xl font-medium tabular-nums ${signClass(perf?.excess)} ${
										perfEarnedTitle ? 'cursor-help' : ''
									}`}
								>
									{perf ? usdSignedFromMillions(perf.excess) : '—'}
								</span>
								<span className="body-sm text-pro-text-secondary">
									Earned above benchmark on the {activeDenom ?? '—'} book
									{excessWindow ? ` over the ${excessWindow.days} days to ${formatDate(excessWindow.to)}` : ''}
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
						getOccurrenceKey={(row) => row.name}
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
								render: (row) => {
									if (row.aum != null) return usdFromMillions(row.aum)
									const snapshot = (data?.asOf && formatDate(data.asOf)) ?? 'latest'
									// Two ways a client can be missing from the snapshot and still be real:
									// the store has not caught up, or it wound down inside the earned window.
									const title =
										row.yieldAum != null
											? `Not in the ${snapshot} treasury snapshot yet; ${usdFromMillions(row.yieldAum)} as of ${
													(data?.yieldAsOf && formatDate(data.yieldAsOf)) ?? 'the positions report'
												}`
											: row.excessAvgBalance != null
												? `Not in the ${snapshot} treasury snapshot — held a mean ${usdFromMillions(
														row.excessAvgBalance
													)} during the earned-return window`
												: undefined
									return title ? (
										<span className="cursor-help" title={title}>
											—
										</span>
									) : (
										'—'
									)
								}
							},
							{
								key: 'share',
								label: 'Share',
								right: true,
								render: (row) => formatPercent(row.share, KPK_PERCENT_OPTIONS) ?? '—'
							},
							{
								key: 'deployedPct',
								label: 'Deployed',
								title: 'Defi plus ops positions, less what sits idle in wallets',
								right: true,
								render: (row) => (
									<span
										title={deployedTitle(row)}
										className={`flex items-center justify-end gap-2 ${deployedTitle(row) ? 'cursor-help' : ''}`}
									>
										{formatPercent(row.deployedPct, KPK_PERCENT_OPTIONS) ?? '—'}
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
								render: (row) => <span className={signClass(row.excess)}>{usdSignedFromMillions(row.excess)}</span>
							},
							{ key: 'since', label: 'Managed since', right: true },
							{
								key: 'url',
								label: '',
								render: (row) => <RowLink href={row.url} label={`${row.name} treasury dashboard`} />
							}
						]}
						footer={clientFooter}
					/>
				</Card>
			</section>

			<RefLinks refs={data?.refs} />
		</div>
	)
}
