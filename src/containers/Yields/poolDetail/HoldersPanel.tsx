import type { ECharts } from 'echarts/core'
import { useRouter } from 'next/router'
import { lazy, type ReactNode, Suspense, useEffect, useState } from 'react'
import { useBlockExplorers } from '~/api/client'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import type { IPieChartProps } from '~/components/ECharts/PieChart/types'
import { escapeHtml } from '~/components/ECharts/shared/escapeHtml'
import {
	TokenPageTable,
	TokenPageTableBodyCell,
	TokenPageTableHeaderCell,
	TokenPageTableScroller
} from '~/components/Table/helpers'
import { childColors, OTHERS_COLOR } from '~/constants/colors'
import { Card } from '~/ui/Card'
import { Change } from '~/ui/Change'
import { CopyHelper } from '~/ui/Copy'
import { PanelHeader, PanelTitle } from '~/ui/Panel'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { SurfaceBodyLoadingStatus } from '~/ui/Status'
import { StatItem, SummaryChange } from '~/ui/SummaryStats'
import { Tooltip } from '~/ui/Tooltip'
import { getBlockExplorerNew } from '~/utils/blockExplorers'
import {
	formatCompactNumber,
	formatNumber,
	formatPercent,
	formatUsd,
	PERCENT_POINTS_TWO_DECIMALS_OPTIONS,
	USD_LOWERCASE_MILLIONS_OPTIONS
} from '~/utils/numberFormat'
import { pushShallowQuery } from '~/utils/routerQuery'
import { getHolderMode, getHolderModeQueryValue, type HolderMode } from './queryState'
import { getChartTooltipItems } from './tooltip'
import type { DetailHolders, Holder, HolderChange, HolderStatus } from './types'

const PERCENT_OPTIONS = {
	input: 'percent',
	minimumFractionDigits: 1,
	maximumFractionDigits: 1,
	useGrouping: false
} as const

const PieChart = lazy(() => import('~/components/ECharts/PieChart')) as React.FC<IPieChartProps>

// Holders shade from the up green (emerald-9) to lighter steps, like treemap children.
const HOLDER_BASE_COLOR = '#007b45'

function shortAddr(address: string): string {
	return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address
}

function fmtToken(balance: string | null, decimals: number | null): string {
	if (balance === null || decimals === null) return '—'
	const value = Number(balance) / 10 ** decimals
	return Number.isFinite(value)
		? formatCompactNumber(value, {
				compactSuffix: 'lowercase',
				...(value >= 1e3 ? { minimumFractionDigits: 1, maximumFractionDigits: 1 } : {})
			})
		: '—'
}

type HolderDelta = { status: HolderStatus; value: number | null; unit: 'pp' | 'percent' }

function windowDelta(change: HolderChange, mode: HolderMode): HolderDelta {
	return mode === 'share'
		? { status: change.share.status, value: change.share.pct_point_delta, unit: 'pp' }
		: { status: change.balance.status, value: change.balance.pct_delta, unit: 'percent' }
}

export function ChangeBadge({ delta }: { delta: HolderDelta | null }) {
	if (!delta) return <span className="text-secondary">—</span>
	switch (delta.status) {
		case 'up':
		case 'down':
			if (delta.value === null) return <span className="text-secondary">—</span>
			// The status carries the direction, as it did when the badge drew its own arrow.
			return <Change value={(delta.status === 'down' ? -1 : 1) * Math.abs(delta.value)} unit={delta.unit} />
		case 'entered_top_10':
			return (
				<Tooltip
					content="Entered Top 10"
					render={<span aria-label="Entered Top 10" />}
					className="ml-auto w-fit rounded-full bg-brand-muted px-1.5 py-0.5 label-sm whitespace-nowrap text-link"
				>
					Entered
				</Tooltip>
			)
		case 'steady':
			return <span className="text-secondary">Steady</span>
		case 'unknown':
			return <span className="text-secondary">—</span>
		default: {
			const exhaustive: never = delta.status
			return exhaustive
		}
	}
}

export function holderDistributionShares(
	list: Array<Holder>,
	top10Pct: number | null
): { shares: Array<number>; top10: number; others: number } | null {
	const shares: Array<number> = []
	for (const holder of list) {
		if (holder.share_pct === null) return null
		shares.push(holder.share_pct)
	}
	const top10 = top10Pct ?? shares.reduce((total, share) => total + share, 0)
	return { shares, top10, others: Math.max(0, 100 - top10) }
}

function HolderDistribution({
	list,
	colors,
	top10Pct,
	onReady
}: {
	list: Array<Holder>
	colors: Array<string>
	top10Pct: number | null
	onReady: (instance: ECharts | null) => void
}) {
	const distribution = holderDistributionShares(list, top10Pct)
	if (!distribution) {
		return <div className="flex min-h-[300px] items-center justify-center body-sm text-tertiary">Unavailable</div>
	}
	const { shares, others } = distribution
	const pieData = [
		...list.map((holder, i) => ({
			name: `#${i + 1} ${shortAddr(holder.address)}`,
			value: shares[i]!
		})),
		...(others > 0 ? [{ name: 'Others', value: others }] : [])
	]
	const stackColors: Record<string, string> = {}
	for (const [i, holder] of list.entries()) stackColors[`#${i + 1} ${shortAddr(holder.address)}`] = colors[i]!
	stackColors.Others = OTHERS_COLOR

	return (
		<div className="flex min-w-0 flex-col">
			<Suspense fallback={<SurfaceBodyLoadingStatus label="Loading chart" className="min-h-[300px]" />}>
				<PieChart
					height="300px"
					chartData={pieData}
					stackColors={stackColors}
					radius={['48%', '82%']}
					valueSymbol="%"
					showLegend={false}
					customLabel={{ show: false }}
					tooltipFormatter={(params: unknown) => {
						const item = getChartTooltipItems(params)[0]
						if (!item) return ''
						const rawValue = item.value
						const value = typeof rawValue === 'number' ? rawValue : Number(rawValue ?? 0)
						return `${item.marker}${escapeHtml(item.name)}: <b>${formatPercent(value, PERCENT_POINTS_TWO_DECIMALS_OPTIONS)}</b>`
					}}
					exportButtons="hidden"
					onReady={onReady}
				/>
			</Suspense>
		</div>
	)
}

function HoldersTable({
	list,
	decimals,
	colors,
	chain,
	mode,
	donutInstance,
	active,
	onActiveChange
}: {
	list: Array<Holder>
	decimals: number | null
	colors: Array<string>
	chain?: string | null
	mode: HolderMode
	donutInstance: ECharts | null
	active: number | null
	onActiveChange: (active: number | null) => void
}) {
	const { data: blockExplorers } = useBlockExplorers()

	return (
		<div className="min-w-0 border-t border-subtle p-2 lg:border-t-0 lg:border-l">
			<TokenPageTableScroller>
				<TokenPageTable className="min-w-[480px] table-fixed">
					<colgroup>
						<col style={{ width: '40%' }} />
						<col style={{ width: '30%' }} />
						<col style={{ width: '15%' }} />
						<col style={{ width: '15%' }} />
					</colgroup>
					<thead>
						<tr className="border-b border-subtle bg-surface">
							<TokenPageTableHeaderCell>Holder</TokenPageTableHeaderCell>
							<TokenPageTableHeaderCell textAlign="end">
								{mode === 'share' ? 'Share' : 'Balance'}
							</TokenPageTableHeaderCell>
							<TokenPageTableHeaderCell textAlign="end">7d</TokenPageTableHeaderCell>
							<TokenPageTableHeaderCell textAlign="end">30d</TokenPageTableHeaderCell>
						</tr>
					</thead>
					<tbody>
						{list.map((holder, i) => {
							const url =
								blockExplorers && chain
									? (getBlockExplorerNew({
											apiResponse: blockExplorers,
											address: holder.address,
											chainName: chain,
											urlType: 'address'
										})?.url ?? null)
									: null
							return (
								<tr
									key={holder.address}
									onMouseEnter={() => {
										onActiveChange(i)
										donutInstance?.dispatchAction({
											type: 'highlight',
											seriesIndex: 0,
											dataIndex: i
										})
									}}
									onMouseLeave={() => {
										onActiveChange(null)
										donutInstance?.dispatchAction({
											type: 'downplay',
											seriesIndex: 0,
											dataIndex: i
										})
									}}
									className={`border-b border-subtle last:border-b-0 ${active === i ? 'bg-hover-row' : ''}`}
								>
									<TokenPageTableBodyCell>
										<span className="flex items-center gap-2">
											<span
												className="size-2 shrink-0 rounded-full transition-transform"
												style={{
													background: colors[i],
													transform: active === i ? 'scale(1.6)' : 'scale(1)'
												}}
											/>
											<span className="w-4 shrink-0 text-secondary">{i + 1}</span>
											{url ? (
												<a
													className="mono-md text-link hover:underline"
													href={url}
													target="_blank"
													rel="noopener noreferrer"
												>
													{shortAddr(holder.address)}
												</a>
											) : (
												<span className="mono-md text-secondary">{shortAddr(holder.address)}</span>
											)}
											<CopyHelper toCopy={holder.address} />
										</span>
									</TokenPageTableBodyCell>
									<TokenPageTableBodyCell textAlign="end">
										{/* One 20px line whatever the cell holds, so switching mode cannot move the rows. */}
										{mode === 'share' && holder.share_pct !== null ? (
											<span className="flex h-5 items-center justify-end gap-2">
												<span className="text-primary">
													{formatPercent(holder.share_pct, PERCENT_POINTS_TWO_DECIMALS_OPTIONS)}
												</span>
												<span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-border-subtle sm:block">
													<span
														className="block h-full rounded-full"
														style={{
															width: `${Math.min(holder.share_pct, 100)}%`,
															background: colors[i]!
														}}
													/>
												</span>
											</span>
										) : mode === 'balance' ? (
											<span className="flex h-5 items-center justify-end text-primary">
												{fmtToken(holder.balance, decimals)}
											</span>
										) : (
											<span className="flex h-5 items-center justify-end text-secondary">—</span>
										)}
									</TokenPageTableBodyCell>
									<TokenPageTableBodyCell textAlign="end">
										<span className="flex h-5 items-center justify-end">
											<ChangeBadge delta={windowDelta(holder.change_7d, mode)} />
										</span>
									</TokenPageTableBodyCell>
									<TokenPageTableBodyCell textAlign="end">
										<span className="flex h-5 items-center justify-end">
											<ChangeBadge delta={windowDelta(holder.change_30d, mode)} />
										</span>
									</TokenPageTableBodyCell>
								</tr>
							)
						})}
					</tbody>
				</TokenPageTable>
			</TokenPageTableScroller>
		</div>
	)
}

function HolderSummary({ holders, donut }: { holders: DetailHolders; donut: ReactNode }) {
	const count = holders.count
	const countChange30d = holders.count_change_30d ?? null
	const avg = holders.avg_position_usd

	return (
		<div className="flex flex-col gap-4 px-4 py-3">
			<h3 className="label-md text-secondary">Distribution</h3>
			{donut}

			{count != null || avg != null ? (
				<div className="mt-auto flex flex-wrap justify-center gap-x-12 gap-y-4 border-t border-subtle pt-4">
					{count != null ? (
						<div className="flex items-end gap-2">
							<StatItem label="Total Holders" value={formatNumber(count)} />
							{countChange30d != null ? (
								<SummaryChange value={countChange30d} unit="count" comparison="over 30d" />
							) : null}
						</div>
					) : null}
					{avg != null ? (
						<StatItem label="Avg Holder Amount" value={formatUsd(avg, USD_LOWERCASE_MILLIONS_OPTIONS)} />
					) : null}
				</div>
			) : null}
		</div>
	)
}

export function HoldersPanel({
	holders,
	chain,
	poolId,
	exportTitle
}: {
	holders: DetailHolders
	chain?: string | null
	poolId: string
	exportTitle?: string
}) {
	const router = useRouter()
	const mode = getHolderMode(router.query.holderMode)
	const [donutInstance, setDonutInstance] = useState<ECharts | null>(null)
	const [active, setActive] = useState<number | null>(null)

	useEffect(() => {
		if (!donutInstance) return
		const onOver = (params: unknown) => setActive(getChartTooltipItems(params)[0]?.dataIndex ?? null)
		const onOut = () => setActive(null)
		donutInstance.on('mouseover', 'series.pie', onOver)
		donutInstance.on('mouseout', 'series.pie', onOut)
		return () => {
			donutInstance.off('mouseover', onOver)
			donutInstance.off('mouseout', onOut)
		}
	}, [donutInstance])

	const count = holders.count
	const avg = holders.avg_position_usd
	const top10Pct = holders.top_10_share_pct
	const list = holders.top_10_holders?.holders ?? []
	const decimals = holders.top_10_holders?.decimals ?? null
	const hasAny = (count != null && count > 0) || avg != null || top10Pct != null || list.length > 0
	if (!hasAny) return null

	if (list.length === 0) {
		return (
			<Card as="section" padding="md" className="flex flex-col gap-3">
				<h2 className="heading-xs">Holders</h2>
				<div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
					<StatItem
						label="Total Holders"
						value={
							count == null
								? '—'
								: formatCompactNumber(count, {
										compactSuffix: 'lowercase',
										...(count >= 1e3 ? { minimumFractionDigits: 1, maximumFractionDigits: 1 } : {})
									})
						}
					/>
					<StatItem label="Avg Position" value={formatUsd(avg, USD_LOWERCASE_MILLIONS_OPTIONS) ?? '—'} />
					<StatItem label="Top 10 Holders" value={top10Pct == null ? '—' : formatPercent(top10Pct, PERCENT_OPTIONS)} />
				</div>
			</Card>
		)
	}

	const colors = childColors(HOLDER_BASE_COLOR, list.length)
	return (
		<Card as="section" padding="none">
			<PanelHeader>
				<PanelTitle>Holders</PanelTitle>
				<div className="ml-auto flex flex-wrap items-center gap-1.5">
					<SegmentedControl<HolderMode>
						value={mode}
						options={[
							{ value: 'share', label: 'Share' },
							{ value: 'balance', label: 'Balance' }
						]}
						onValueChange={(next) =>
							void pushShallowQuery(router, { holderMode: getHolderModeQueryValue(next) }, router.pathname)
						}
						label="Holder value mode"
						variant="default"
						size="md"
					/>
					<ChartExportButtons
						chartInstance={() => donutInstance}
						filename={`${poolId}-top-10-holder-distribution`}
						title={exportTitle ? `${exportTitle} Top 10 Holder Distribution` : 'Top 10 Holder Distribution'}
						csvSource="rendered-chart"
					/>
				</div>
			</PanelHeader>
			<div className="grid grid-cols-1 lg:grid-cols-[minmax(17rem,1fr)_minmax(0,3fr)]">
				<HolderSummary
					holders={holders}
					donut={<HolderDistribution list={list} colors={colors} top10Pct={top10Pct} onReady={setDonutInstance} />}
				/>
				<HoldersTable
					list={list}
					decimals={decimals}
					colors={colors}
					{...(chain !== undefined ? { chain } : {})}
					mode={mode}
					donutInstance={donutInstance}
					active={active}
					onActiveChange={setActive}
				/>
			</div>
		</Card>
	)
}
