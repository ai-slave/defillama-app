import type { ECharts } from 'echarts/core'
import { useRouter } from 'next/router'
import { lazy, Suspense, useEffect, useState } from 'react'
import { useBlockExplorers } from '~/api/client'
import type { IPieChartProps } from '~/components/ECharts/PieChart/types'
import {
	TokenPageTable,
	TokenPageTableBodyCell,
	TokenPageTableHeaderCell,
	TokenPageTableScroller
} from '~/components/Table/helpers'
import { Card } from '~/ui/Card'
import { CopyHelper } from '~/ui/Copy'
import { Icon } from '~/ui/Icon'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { StatItem } from '~/ui/SummaryStats'
import { Tooltip } from '~/ui/Tooltip'
import { formattedNum } from '~/utils'
import { getBlockExplorerNew } from '~/utils/blockExplorers'
import { pushShallowQuery } from '~/utils/routerQuery'
import { fmtCount, fmtUsd } from './format'
import { getHolderMode, getHolderModeQueryValue, type HolderMode } from './queryState'
import { getChartTooltipItems } from './tooltip'
import type { DetailHolders, Holder, HolderChange, HolderStatus } from './types'

const PieChart = lazy(() => import('~/components/ECharts/PieChart')) as React.FC<IPieChartProps>

const OTHERS_COLOR = '#8a8a8a'
const RAMP_FROM = '#0a5c4f'
const RAMP_TO = '#86e3d2'

function lerpHex(a: string, b: string, t: number): string {
	const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16))
	const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16))
	return (
		'#' +
		pa
			.map((value, i) =>
				Math.round(value + (pb[i] - value) * t)
					.toString(16)
					.padStart(2, '0')
			)
			.join('')
	)
}

function shortAddr(address: string): string {
	return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address
}

function pctStr(value: number, digits = 1): string {
	return `${value.toFixed(digits)}%`
}

function fmtToken(balance: string, decimals: number): string {
	const value = Number(balance) / 10 ** decimals
	return Number.isFinite(value) ? fmtCount(value) : '—'
}

function signedCount(value: number): string {
	return `${value > 0 ? '+' : ''}${value.toLocaleString()}`
}

function changeColor(value: number): string {
	return value > 0 ? 'text-(--yield-positive-text)' : value < 0 ? 'text-(--yield-negative-text)' : ''
}

function windowDelta(
	change: HolderChange | undefined,
	mode: HolderMode
): { status: HolderStatus; value: number | null } | null {
	if (!change) return null
	return mode === 'share'
		? { status: change.share.status, value: change.share.pct_point_delta }
		: { status: change.balance.status, value: change.balance.pct_delta }
}

function ChangeBadge({ delta }: { delta: { status: HolderStatus; value: number | null } | null }) {
	if (!delta) return <span className="text-secondary">—</span>
	switch (delta.status) {
		case 'up':
			return (
				<span className="inline-flex items-center justify-end gap-1 whitespace-nowrap text-(--yield-positive-text)">
					<Icon name="arrow-up" className="size-3.5 shrink-0" aria-hidden />+{Math.abs(delta.value ?? 0).toFixed(1)}%
				</span>
			)
		case 'down':
			return (
				<span className="inline-flex items-center justify-end gap-1 whitespace-nowrap text-(--yield-negative-text)">
					<Icon name="arrow-down" className="size-3.5 shrink-0" aria-hidden />-{Math.abs(delta.value ?? 0).toFixed(1)}%
				</span>
			)
		case 'entered_top_10':
			return (
				<Tooltip
					content="Entered Top 10"
					render={<span aria-label="Entered Top 10" />}
					className="ml-auto w-fit rounded-full bg-brand-muted px-1.5 py-0.5 label-sm whitespace-nowrap text-link-on-tint"
				>
					Entered
				</Tooltip>
			)
		default:
			return <span className="text-secondary">Steady</span>
	}
}

function HolderDistribution({
	list,
	colors,
	top10Pct,
	poolId,
	exportTitle,
	onReady
}: {
	list: Holder[]
	colors: string[]
	top10Pct: number | null
	poolId: string
	exportTitle?: string
	onReady: (instance: ECharts | null) => void
}) {
	const top10 = top10Pct ?? list.reduce((total, holder) => total + holder.share_pct, 0)
	const others = Math.max(0, 100 - top10)
	const pieData = [
		...list.map((holder, i) => ({ name: `#${i + 1} ${shortAddr(holder.address)}`, value: holder.share_pct })),
		...(others > 0 ? [{ name: 'Others', value: others }] : [])
	]
	const stackColors: Record<string, string> = {}
	for (const [i, holder] of list.entries()) stackColors[`#${i + 1} ${shortAddr(holder.address)}`] = colors[i]
	stackColors.Others = OTHERS_COLOR

	return (
		<div className="relative flex min-w-0 flex-col">
			<Suspense fallback={<div className="min-h-[360px]" />}>
				<PieChart
					title="Holder Distribution"
					chartData={pieData}
					stackColors={stackColors}
					radius={['48%', '82%']}
					valueSymbol="%"
					showLegend={false}
					customLabel={{ show: false }}
					formatTooltip={(params: unknown) => {
						const item = getChartTooltipItems(params)[0]
						if (!item) return ''
						const rawValue = item.value
						const value = typeof rawValue === 'number' ? rawValue : Number(rawValue ?? 0)
						return `${item.marker}${item.name}: <b>${value.toFixed(2)}%</b>`
					}}
					exportButtons={{
						png: true,
						csv: true,
						filename: `${poolId}-top-10-holder-distribution`,
						pngTitle: exportTitle ? `${exportTitle} Top 10 Holder Distribution` : 'Top 10 Holder Distribution'
					}}
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
	onModeChange,
	donutInstance,
	active,
	onActiveChange
}: {
	list: Holder[]
	decimals: number
	colors: string[]
	chain?: string | null
	mode: HolderMode
	onModeChange: (mode: HolderMode) => void
	donutInstance: ECharts | null
	active: number | null
	onActiveChange: (active: number | null) => void
}) {
	const { data: blockExplorers } = useBlockExplorers()
	const flow = { up: 0, down: 0, entered: 0 }
	for (const holder of list) {
		const delta = windowDelta(holder.change_7d, mode)
		if (delta?.status === 'up') flow.up += 1
		else if (delta?.status === 'down') flow.down += 1
		else if (delta?.status === 'entered_top_10') flow.entered += 1
	}
	const flowChips = [
		{
			n: flow.up,
			label: mode === 'balance' ? 'Accumulating' : 'Share Up',
			dot: 'bg-data-up',
			pill: 'bg-surface-elevated-1 text-primary'
		},
		{
			n: flow.entered,
			label: 'Entered Top 10',
			dot: 'bg-brand',
			pill: 'bg-brand-muted text-link-on-tint'
		},
		{
			n: flow.down,
			label: mode === 'balance' ? 'Reducing' : 'Share Down',
			dot: 'bg-data-down',
			pill: 'bg-surface-elevated-1 text-primary'
		}
	].filter((chip) => chip.n > 0)

	return (
		<div className="min-w-0 border-t border-subtle p-2 lg:border-t-0 lg:border-l">
			<div className="mb-1 flex flex-wrap items-center justify-between gap-2 border-b border-subtle px-1 pb-2">
				<SegmentedControl<HolderMode>
					value={mode}
					options={[
						{ value: 'share', label: 'Share' },
						{ value: 'balance', label: 'Balance' }
					]}
					onValueChange={onModeChange}
					label="Holder value mode"
					variant="default"
					size="md"
				/>
				<div className="flex flex-wrap items-center gap-1.5">
					{flowChips.map((chip) => (
						<span
							key={chip.label}
							className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 label-sm ${chip.pill}`}
						>
							<span className={`size-1.5 rounded-full ${chip.dot}`} />
							{chip.n} {chip.label}
						</span>
					))}
				</div>
			</div>
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
										donutInstance?.dispatchAction({ type: 'highlight', seriesIndex: 0, dataIndex: i })
									}}
									onMouseLeave={() => {
										onActiveChange(null)
										donutInstance?.dispatchAction({ type: 'downplay', seriesIndex: 0, dataIndex: i })
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
												<Tooltip
													content={`${holder.address} — view on explorer`}
													render={
														<a
															className="mono-md text-link hover:underline"
															href={url}
															target="_blank"
															rel="noopener noreferrer"
														/>
													}
												>
													{shortAddr(holder.address)}
												</Tooltip>
											) : (
												<Tooltip content={holder.address} className="mono-md text-secondary">
													{shortAddr(holder.address)}
												</Tooltip>
											)}
											<CopyHelper toCopy={holder.address} />
										</span>
									</TokenPageTableBodyCell>
									<TokenPageTableBodyCell textAlign="end">
										{mode === 'share' ? (
											<span className="flex items-center justify-end gap-2">
												<span className="text-primary">{holder.share_pct.toFixed(2)}%</span>
												<span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-border-subtle sm:block">
													<span
														className="block h-full rounded-full"
														style={{ width: `${Math.min(holder.share_pct, 100)}%`, background: colors[i] }}
													/>
												</span>
											</span>
										) : (
											<span className="block text-right text-primary">{fmtToken(holder.balance, decimals)}</span>
										)}
									</TokenPageTableBodyCell>
									<TokenPageTableBodyCell textAlign="end">
										<ChangeBadge delta={windowDelta(holder.change_7d, mode)} />
									</TokenPageTableBodyCell>
									<TokenPageTableBodyCell textAlign="end">
										<ChangeBadge delta={windowDelta(holder.change_30d, mode)} />
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

function HolderInsights({ holders, list, tvlUsd }: { holders: DetailHolders; list: Holder[]; tvlUsd?: number | null }) {
	const count = holders.count
	const avg = holders.avg_position_usd
	const countChange7d = holders.count_change_7d ?? null
	const countChange30d = holders.count_change_30d ?? null
	const top10 = holders.top_10_share_pct ?? list.reduce((total, holder) => total + holder.share_pct, 0)
	const exposureTiers = [
		{ label: 'Top 1', pct: list[0]?.share_pct ?? null },
		{ label: 'Top 5', pct: list.slice(0, 5).reduce((total, holder) => total + holder.share_pct, 0) },
		{ label: 'Top 10', pct: top10 }
	]

	return (
		<div className="border-t border-subtle lg:col-span-full xl:col-span-1 xl:border-t-0 xl:border-l">
			<div className="flex flex-col gap-3 p-3">
				<h2 className="heading-xs">Holder Insights</h2>

				{tvlUsd != null ? (
					<div className="flex flex-col gap-2">
						<span className="label-md text-secondary">TVL Exposure</span>
						{exposureTiers.map((tier) => (
							<div key={tier.label} className="flex items-center justify-between body-md">
								<span className="text-secondary">{tier.label}</span>
								<span className="mono-md-bold text-primary">
									{tier.pct == null ? '—' : formattedNum((tier.pct / 100) * tvlUsd, true)}
								</span>
							</div>
						))}
					</div>
				) : null}

				{count != null ? (
					<div className="flex flex-col gap-2 rounded-md bg-surface-elevated-1 p-2">
						<div className="flex items-center justify-between">
							<span className="body-md text-secondary">Total Holders</span>
							<span className="mono-md-bold text-primary">{count.toLocaleString()}</span>
						</div>
						{countChange7d != null ? (
							<div className="flex items-center justify-between body-md">
								<span className="text-secondary">7d change</span>
								<span className={`mono-md-bold ${changeColor(countChange7d)}`}>{signedCount(countChange7d)}</span>
							</div>
						) : null}
						{countChange30d != null ? (
							<div className="flex items-center justify-between body-md">
								<span className="text-secondary">30d change</span>
								<span className={`mono-md-bold ${changeColor(countChange30d)}`}>{signedCount(countChange30d)}</span>
							</div>
						) : null}
					</div>
				) : null}

				{avg != null ? (
					<div className="flex flex-col gap-1 rounded-md bg-surface-elevated-1 p-2">
						<span className="body-md text-secondary">Avg Position Size</span>
						<span className="mono-md-bold text-primary">{formattedNum(avg, true)}</span>
					</div>
				) : null}
			</div>
		</div>
	)
}

export function HoldersPanel({
	holders,
	chain,
	tvlUsd,
	poolId,
	exportTitle
}: {
	holders: DetailHolders
	chain?: string | null
	tvlUsd?: number | null
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
	const decimals = holders.top_10_holders?.decimals ?? 18
	const hasAny = (count != null && count > 0) || avg != null || top10Pct != null || list.length > 0
	if (!hasAny) return null

	if (list.length === 0) {
		return (
			<Card as="section" padding="md" className="flex flex-col gap-3">
				<h2 className="heading-xs">Holders</h2>
				<div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
					<StatItem label="Total holders" value={count == null ? '—' : fmtCount(count)} />
					<StatItem label="Avg position" value={fmtUsd(avg)} />
					<StatItem label="Top 10 holders" value={top10Pct == null ? '—' : pctStr(top10Pct)} />
				</div>
			</Card>
		)
	}

	const colors = list.map((_, i) => (list.length > 1 ? lerpHex(RAMP_FROM, RAMP_TO, i / (list.length - 1)) : RAMP_FROM))
	return (
		<Card padding="none" className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-[1fr_2fr_1fr]">
			<HolderDistribution
				list={list}
				colors={colors}
				top10Pct={top10Pct}
				poolId={poolId}
				exportTitle={exportTitle}
				onReady={setDonutInstance}
			/>
			<HoldersTable
				list={list}
				decimals={decimals}
				colors={colors}
				chain={chain}
				mode={mode}
				onModeChange={(next) =>
					void pushShallowQuery(router, { holderMode: getHolderModeQueryValue(next) }, router.pathname)
				}
				donutInstance={donutInstance}
				active={active}
				onActiveChange={setActive}
			/>
			<HolderInsights holders={holders} list={list} tvlUsd={tvlUsd} />
		</Card>
	)
}
