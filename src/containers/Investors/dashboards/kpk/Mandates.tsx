import { useMemo, useState } from 'react'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { PanelStatus } from '~/ui/Status'
import { formatDate } from '~/utils/dateFormat'
import { formatPercent, PERCENT_POINTS_TWO_DECIMALS_OPTIONS } from '~/utils/numberFormat'
import { queryReadFailed } from '~/utils/query'
import { useTab, type KpkMandateClient, type KpkMandates, type KpkMandateSleeve, type KpkMandateWindow } from './api'
import { KPK_BENCH_TEXT, KPK_MINT_TEXT } from './chartDefaults'
import { CompositionSection } from './CompositionSection'
import {
	clientFooterRows,
	deployedTitle,
	missingAumTitle,
	performanceEarnedTitle,
	rateBasisTitle
} from './mandatesModel'
import {
	Card,
	CompareBars,
	DataTable,
	earnedTitle,
	earnedWindowLine,
	InfoTip,
	LedgerStrip,
	LedgerTile,
	MeterBar,
	RefLinks,
	RowLink,
	scopeLine,
	signClass,
	signedBps,
	signedInt,
	signedPp,
	usdFromMillions,
	usdSignedFromMillions,
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

export default function Mandates() {
	const query = useTab<KpkMandates>('mandates')
	const { data } = query
	const [selectedDenom, setSelectedDenom] = useState<string | null>(null)

	const denomOptions = useMemo(
		() => (data?.denominations ?? []).map((denom) => ({ value: denom, label: denom })),
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

	const showPerf = !data || data.denominations.length > 0

	const clientFooter = useMemo(() => (data ? clientFooterRows(data) : undefined), [data])

	if (queryReadFailed(query)) {
		return (
			<PanelStatus variant="error" retry={query}>
				Couldn't load treasury mandate data.
			</PanelStatus>
		)
	}

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
						<span className="body-sm text-secondary">
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
					<div className="flex flex-wrap items-center justify-between gap-3">
						<h2 className="heading-xs">Performance vs benchmark</h2>
						{denomOptions.length > 0 && activeDenom && (
							<SegmentedControl
								variant="default"
								size="md"
								label="Denomination"
								options={denomOptions}
								value={activeDenom}
								onValueChange={setSelectedDenom}
							/>
						)}
					</div>
					{data?.yieldAsOf && (
						<p className="-mt-1 body-sm text-secondary">
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
									// The mark leads the figure, so the percentages stay aligned down the column.
									render: (row) => (
										<span className={KPK_MINT_TEXT}>
											<InfoTip text={rateBasisTitle(row)} className="mr-1" />
											{formatPercent(row.apy, PERCENT_POINTS_TWO_DECIMALS_OPTIONS) ?? '—'}
										</span>
									)
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
						<div className="mt-4 flex flex-wrap gap-8 border-t border-subtle pt-4">
							<div className="flex flex-col gap-1">
								<span className="label-sm tracking-wider text-secondary uppercase">Annual excess return</span>
								<span className="flex items-center gap-1.5">
									<span className={`tabular-nums ${signClass(perf?.excess)} mono-lg`}>
										{perf ? usdSignedFromMillions(perf.excess) : '—'}
									</span>
									<InfoTip text={perfEarnedTitle} />
								</span>
								<span className="body-sm text-secondary">
									Earned above benchmark on the {activeDenom ?? '—'} book
									{excessWindow ? ` over the ${excessWindow.days} days to ${formatDate(excessWindow.to)}` : ''}
								</span>
							</div>
							<div className="flex flex-col gap-1">
								<span className="label-sm tracking-wider text-secondary uppercase">Benchmark</span>
								<span className="body-md text-primary">{perf?.benchLabel ?? '—'}</span>
							</div>
						</div>
						{activeDenom && perf && (
							<p className="mt-4 border-t border-subtle pt-3 body-sm text-secondary">
								{scopeLine(activeDenom, perf.scope)}
							</p>
						)}
					</Card>
				</section>
			)}

			<section className="flex flex-col gap-3">
				<h2 className="heading-xs">Per-client breakdown</h2>
				<Card>
					{/* The client column stays put, so a narrow screen scrolling through the
					    sleeve columns still shows whose row it is reading. */}
					<DataTable<KpkMandateClient>
						getOccurrenceKey={(row) => row.name}
						freeze="column"
						rows={data?.clients}
						cols={[
							{
								key: 'name',
								label: 'Client',
								render: (row) => <span className="text-primary">{row.name}</span>
							},
							{
								key: 'aum',
								label: 'AUM',
								right: true,
								render: (row) => {
									if (row.aum != null) return usdFromMillions(row.aum)
									const title = missingAumTitle(row, data?.asOf, data?.yieldAsOf)
									return title ? (
										<span>
											<InfoTip text={title} className="mr-1" />—
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
									<span className="flex items-center justify-end gap-2">
										<InfoTip text={deployedTitle(row)} className="-mr-1" />
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
