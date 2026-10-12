import { Fragment, useMemo, useState } from 'react'
import { TokenPageTableShell } from '~/components/Table/helpers'
import { SortIcon } from '~/components/Table/SortIcon'
import { Icon } from '~/ui/Icon'
import { Tag } from '~/ui/Tag'
import { formatUsd } from '~/utils/numberFormat'
import { scenarioTone } from '../derive'
import { toneClasses } from '../kindMeta'
import { ChapterHead } from '../primitives/ChapterHead'
import { KindIcon } from '../primitives/KindIcon'
import type { ProtocolRiskFixture, ScenarioVM } from '../types'
import { usePositionUsd } from './PositionControl'
import { ScenarioDetailContent } from './ScenarioDetailPanel'
import {
	isDisplayedScenario,
	isUnquantified,
	modeledLossCell,
	SCENARIO_GROUPS,
	scenarioGroup,
	scenarioHasDetail,
	scenarioRowId,
	scrollToScenarioRow,
	worstCaseLabel
} from './scenarioShared'

// One Loss column at a fixed −30%, not a column per crash depth and not a selector: across a
// table this size the served anchors carry only a handful of distinct values (one LT/LTV model
// drives all of them), and the full per-depth curve is already listed inside each expanded row.
// The depth is fixed rather than chosen — we pick the standard stress instead of asking. Leaving
// it unset isn't an option: 23 of 53 computed rows on a live vault carry only a ceiling, so a
// depth-less column reads "—" on nearly half the table.
const STRESS_DEPTH = 30
type SortKey = 'title' | 'loss' | 'worst' | 'exit'
type SortDir = 'asc' | 'desc'

const DEFAULT_DIR: Record<SortKey, SortDir> = {
	title: 'asc',
	loss: 'desc',
	worst: 'desc',
	exit: 'asc'
}

function exitLabel(s: ScenarioVM): string {
	return s.actingWindow.kind === 'no-escape' ? 'Instant' : s.actingWindow.label.replace(' withdraw window', '')
}

function exitSortKey(s: ScenarioVM): number {
	return s.actingWindow.kind === 'no-escape' ? 0 : s.actingWindow.minSec
}

// The scenario's loss at the fixed stress depth. Price-driven rows read their served anchor;
// the rest show their own figure, which doesn't move with price anyway.
function LossCell({ s, supplyUsd }: { s: ScenarioVM; supplyUsd: number | null }) {
	const cell = modeledLossCell(s, s.lossByAnchor?.length ? STRESS_DEPTH : undefined, supplyUsd)
	return (
		<td className="px-3 py-3 text-right align-middle whitespace-nowrap">
			<span className={`label-md tabular-nums ${cell.amount === '—' || cell.zero ? 'text-secondary' : 'text-primary'}`}>
				{cell.amount}
			</span>
		</td>
	)
}

// One row per failure: what it is, what it costs, the ceiling, and whether you can get out.
function ScenarioRow({
	s,
	protocol,
	supplyUsd,
	selected,
	onToggle
}: {
	s: ScenarioVM
	protocol: ProtocolRiskFixture | null
	supplyUsd: number | null
	selected: boolean
	onToggle: () => void
}) {
	const tone = toneClasses(scenarioTone(s))
	const clickable = scenarioHasDetail(s)
	const unquantified = isUnquantified(s)
	const detailId = `${scenarioRowId(s.scenarioId)}-detail`
	const noEscape = s.actingWindow.kind === 'no-escape'
	const mech = (
		<>
			<span className={`flex size-6 shrink-0 items-center justify-center rounded-md ${tone.chip}`} aria-hidden>
				<KindIcon kind={s.kind} className="size-3" />
			</span>
			<span className={`min-w-0 truncate label-md ${unquantified ? 'text-secondary' : 'text-primary'}`}>{s.title}</span>
		</>
	)
	return (
		<>
			{/* A table row that expands its detail row below: the tint ties the open row to that detail. A tr cannot be a
			    ListRow, and its disclosure button carries aria-expanded. */}
			<tr
				id={scenarioRowId(s.scenarioId)}
				onClick={() => clickable && onToggle()}
				className={`border-t border-subtle ${
					clickable ? (selected ? 'cursor-pointer bg-brand-muted' : 'cursor-pointer hover:bg-hover-row') : ''
				}`}
			>
				<td className="px-3 py-3 align-middle">
					{clickable ? (
						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation()
								onToggle()
							}}
							aria-expanded={selected}
							aria-controls={detailId}
							className="flex w-full items-center gap-2 rounded-sm text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
						>
							{mech}
						</button>
					) : (
						<span className="flex w-full items-center gap-2">{mech}</span>
					)}
				</td>

				{unquantified ? (
					<td className="px-3 py-3 text-right align-middle whitespace-nowrap">
						<span className="text-secondary italic">Not quantified</span>
					</td>
				) : (
					<LossCell s={s} supplyUsd={supplyUsd} />
				)}

				{/* the drop-independent ceiling stays in view beside every anchor */}
				<td className="px-3 py-3 text-right align-middle whitespace-nowrap text-secondary">
					{unquantified ? '—' : worstCaseLabel(s, supplyUsd)}
				</td>
				<td className="px-3 py-3 text-right align-middle">
					<Tag>
						{noEscape ? null : <Icon name="clock" className="size-3" aria-hidden />}
						{exitLabel(s)}
					</Tag>
				</td>
				<td className="px-2 py-3 align-middle">
					{clickable ? (
						<Icon name="chevron-down" className={`size-3.5 text-secondary ${selected ? 'rotate-180' : ''}`} />
					) : null}
				</td>
			</tr>
			{selected && clickable ? (
				<tr id={detailId} className="border-t border-subtle">
					<td colSpan={5} className="px-4 py-4">
						<ScenarioDetailContent scenario={s} protocol={protocol} supplyUsd={supplyUsd} layout="two-column" />
					</td>
				</tr>
			) : null}
		</>
	)
}

function SortHeader({
	k,
	label,
	align = 'left',
	sort,
	dir,
	onSort
}: {
	k: SortKey
	label: string
	align?: 'left' | 'right'
	sort: SortKey
	dir: SortDir
	onSort: (k: SortKey) => void
}) {
	const active = sort === k
	// The resting caret is visible, so every sortable column says it sorts.
	const arrow = <SortIcon dir={active ? dir : false} />
	return (
		<th
			className={`border-b border-subtle px-3 py-2 font-medium whitespace-nowrap ${align === 'right' ? 'text-right' : 'text-left'}`}
			aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}
		>
			<button
				type="button"
				onClick={() => onSort(k)}
				className={`inline-flex items-center gap-1 rounded-sm transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
					active ? 'text-primary' : ''
				}`}
			>
				{align === 'right' ? (
					<>
						{arrow}
						{label}
					</>
				) : (
					<>
						{label}
						{arrow}
					</>
				)}
			</button>
		</th>
	)
}

export function ScenarioByExit({
	scenarios,
	protocol,
	supplyUsd
}: {
	scenarios: Array<ScenarioVM>
	protocol: ProtocolRiskFixture | null
	supplyUsd: number | null
}) {
	const [selectedId, setSelectedId] = useState<string | null>(null)
	const [sortKey, setSortKey] = useState<SortKey>('worst')
	const [sortDir, setSortDir] = useState<SortDir>('desc')
	const [position] = usePositionUsd()

	const computed = useMemo(() => scenarios.filter((s) => s.status === 'computed'), [scenarios])
	const noEscape = computed.filter((s) => s.actingWindow.kind === 'no-escape').length

	const groups = useMemo(() => {
		// All keys rank pool-relative, so an entered deposit never reorders the table.
		const lossOf = (s: ScenarioVM) =>
			isUnquantified(s) ? -1 : modeledLossCell(s, s.lossByAnchor?.length ? STRESS_DEPTH : undefined).sortUsd
		const ascending: Record<SortKey, (a: ScenarioVM, b: ScenarioVM) => number> = {
			title: (a, b) => a.title.localeCompare(b.title),
			loss: (a, b) => lossOf(a) - lossOf(b) || a.lossMaxUsd - b.lossMaxUsd,
			worst: (a, b) => a.lossMaxUsd - b.lossMaxUsd,
			exit: (a, b) => exitSortKey(a) - exitSortKey(b)
		}
		const base = ascending[sortKey]
		const cmp = sortDir === 'asc' ? base : (a: ScenarioVM, b: ScenarioVM) => -base(a, b)
		const visible = scenarios.filter(isDisplayedScenario)
		return SCENARIO_GROUPS.map((g) => ({
			...g,
			rows: visible.filter((s) => scenarioGroup(s) === g.key).sort(cmp)
		})).filter((g) => g.rows.length)
	}, [scenarios, sortKey, sortDir])

	if (groups.length === 0) return null

	const onSort = (k: SortKey) => {
		if (k === sortKey) {
			setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
		} else {
			setSortKey(k)
			setSortDir(DEFAULT_DIR[k])
		}
	}

	const toggle = (id: string) => {
		setSelectedId((v) => {
			const next = v === id ? null : id
			if (next) scrollToScenarioRow(id)
			return next
		})
	}

	return (
		<div className="flex flex-col gap-5">
			<ChapterHead
				title="Loss scenarios"
				hint={`Each row is a distinct failure, and every loss is a share of your deposit — the same percentage whatever you deposited. Loss is that share at a −${STRESS_DEPTH}% collateral crash, the standard stress; Worst case is the ceiling if everything goes wrong, a conditional loss if it happens rather than a likelihood. Open a row for the loss at every crash depth, the dollar amounts, conditions, and the math.`}
			/>

			<TokenPageTableShell>
				{computed.length > 0 ? (
					<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-subtle bg-surface-elevated-1 p-2">
						<span className="body-sm text-secondary">
							{computed.length} {computed.length === 1 ? 'scenario' : 'scenarios'}
							{noEscape > 0 ? (
								<>
									{' · '}
									<span className="label-sm text-primary">{noEscape}</span> with no time to exit
								</>
							) : (
								' · all have an exit window'
							)}
							{' · loss as % of deposit'}
							{position != null ? (
								<>
									{' · dollars for your '}
									<span className="label-sm text-primary">
										{formatUsd(position, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}
									</span>
									{' inside each row'}
								</>
							) : null}
						</span>
					</div>
				) : null}

				<div className="overflow-x-auto">
					<table className="w-full min-w-[920px] table-fixed">
						{/* the numeric columns share one width so the header reads as an even rhythm */}
						<colgroup>
							<col />
							<col className="w-36" />
							<col className="w-32" />
							<col className="w-32" />
							<col className="w-8" />
						</colgroup>
						<thead className="bg-surface table-header text-secondary">
							<tr>
								<SortHeader k="title" label="Scenario" sort={sortKey} dir={sortDir} onSort={onSort} />
								<SortHeader
									k="loss"
									label={`Loss at −${STRESS_DEPTH}%`}
									align="right"
									sort={sortKey}
									dir={sortDir}
									onSort={onSort}
								/>
								<SortHeader k="worst" label="Worst case" align="right" sort={sortKey} dir={sortDir} onSort={onSort} />
								<SortHeader k="exit" label="Exit window" align="right" sort={sortKey} dir={sortDir} onSort={onSort} />
								<th className="w-8 border-b border-subtle px-2 py-2" aria-hidden />
							</tr>
						</thead>
						<tbody>
							{groups.map((g) => (
								<Fragment key={g.key}>
									<tr className="border-t border-subtle bg-surface">
										<td colSpan={5} className="px-4 py-1.5">
											<span className="label-md text-primary">{g.label}</span>
											<span className="ml-1.5 body-sm text-secondary">({g.rows.length})</span>
										</td>
									</tr>
									{g.rows.map((s) => (
										<ScenarioRow
											key={s.scenarioId}
											s={s}
											protocol={protocol}
											supplyUsd={supplyUsd}
											selected={selectedId === s.scenarioId}
											onToggle={() => toggle(s.scenarioId)}
										/>
									))}
								</Fragment>
							))}
						</tbody>
					</table>
				</div>
			</TokenPageTableShell>
		</div>
	)
}
