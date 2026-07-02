import { Fragment, useMemo, useState } from 'react'
import { Icon } from '~/components/Icon'
import { formattedNum } from '~/utils'
import { scenarioTone } from '../derive'
import { toneClasses } from '../kindMeta'
import { ChapterHead } from '../primitives/ChapterHead'
import { KindIcon } from '../primitives/KindIcon'
import type { ProtocolRiskFixture, ScenarioVM } from '../types'
import { usePositionUsd } from './PositionControl'
import { ScenarioDetailContent } from './ScenarioDetailPanel'
import {
	anyHasAnchors,
	formatDepositPct,
	isDisplayedScenario,
	isUnquantified,
	modeledLossCell,
	SCENARIO_GROUPS,
	scaleToPosition,
	scenarioGroup,
	scenarioHasDetail,
	scenarioRowId,
	scrollToScenarioRow,
	type StressSel,
	worstCaseLabel
} from './scenarioShared'

type SortKey = 'loss' | 'stress' | 'worst' | 'title' | 'exit'
type SortDir = 'asc' | 'desc'

const DEFAULT_DIR: Record<SortKey, SortDir> = {
	loss: 'desc',
	stress: 'desc',
	worst: 'desc',
	title: 'asc',
	exit: 'asc'
}

const STRESS_OPTS: Array<{ v: StressSel; label: string }> = [
	{ v: 10, label: '−10%' },
	{ v: 30, label: '−30%' },
	{ v: 50, label: '−50%' },
	{ v: 'worst', label: 'Worst' }
]

function exitLabel(s: ScenarioVM): string {
	return s.actingWindow.kind === 'no-escape' ? 'Instant' : s.actingWindow.label.replace(' withdraw window', '')
}

function exitSortKey(s: ScenarioVM): number {
	return s.actingWindow.kind === 'no-escape' ? 0 : s.actingWindow.minSec
}

// The detail receives the same `stress` the row rendered at, so they can never disagree.
function ScenarioRow({
	s,
	protocol,
	supplyUsd,
	position,
	stress,
	hasAnchors,
	sectionMax,
	selected,
	onToggle
}: {
	s: ScenarioVM
	protocol: ProtocolRiskFixture | null
	supplyUsd: number
	position: number | null
	stress?: StressSel
	hasAnchors: boolean
	sectionMax: number
	selected: boolean
	onToggle: () => void
}) {
	const tone = toneClasses(scenarioTone(s))
	const clickable = scenarioHasDetail(s)
	const unquantified = isUnquantified(s)
	const detailId = `${scenarioRowId(s.scenarioId)}-detail`
	const noEscape = s.actingWindow.kind === 'no-escape'

	const cell = unquantified ? null : modeledLossCell(s, stress)
	const atStressUsd = cell ? cell.sortUsd : 0
	const shareAtStress = cell && supplyUsd > 0 ? Math.min(1, atStressUsd / supplyUsd) : null
	const possibleUsd = scaleToPosition(atStressUsd, supplyUsd, position)
	const stressAmount = cell
		? cell.sortUsd > 0
			? formattedNum(scaleToPosition(cell.sortUsd, supplyUsd, position), true)
			: cell.amount
		: '—'
	// The modeled loss as a share of the biggest in the table — grows as the stress climbs.
	const barPct = cell && cell.sortUsd > 0 ? Math.min(100, Math.max(4, (cell.sortUsd / sectionMax) * 100)) : 0
	const mech = (
		<>
			<span className={`flex size-6 shrink-0 items-center justify-center rounded-md ${tone.chip}`} aria-hidden>
				<KindIcon kind={s.kind} className="size-3" />
			</span>
			<span
				className={`min-w-0 truncate font-medium ${unquantified ? 'text-(--text-secondary)' : 'text-(--text-primary)'}`}
			>
				{s.title}
			</span>
		</>
	)
	return (
		<Fragment>
			<tr
				id={scenarioRowId(s.scenarioId)}
				onClick={() => clickable && onToggle()}
				className={`border-t border-(--cards-border) ${clickable ? 'cursor-pointer hover:bg-(--bg-main)/50' : ''} ${
					selected ? 'bg-(--bg-main)' : ''
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
							className="flex w-full items-center gap-2 rounded text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--primary)"
						>
							{mech}
						</button>
					) : (
						<span className="flex w-full items-center gap-2">{mech}</span>
					)}
				</td>
				<td className="px-5 py-3 text-right align-middle whitespace-nowrap">
					{unquantified ? (
						<span className="block text-(--text-secondary) italic">Not quantified</span>
					) : cell?.amount === '—' ? (
						<span className="text-(--text-secondary)">—</span>
					) : (
						<span
							className={`font-semibold tabular-nums ${cell?.amount === '$0' ? 'text-(--text-secondary)' : 'text-(--text-primary)'}`}
						>
							{shareAtStress != null ? formatDepositPct(shareAtStress) : formattedNum(possibleUsd, true)}
						</span>
					)}
				</td>
				{/* only present when the backend serves a price curve */}
				{hasAnchors ? (
					<td className="px-5 py-3 text-right align-middle whitespace-nowrap">
						{unquantified ? (
							<span className="text-xs text-(--text-secondary)">—</span>
						) : (
							<span className="flex flex-col items-end gap-1">
								<span
									className={`font-semibold tabular-nums ${cell && cell.amount !== '—' && cell.amount !== '$0' ? 'text-(--text-primary)' : 'text-(--text-secondary)'}`}
								>
									{stressAmount}
								</span>
								{barPct > 0 ? (
									<span className="h-1 w-full max-w-28 overflow-hidden rounded-full bg-(--bg-main)" aria-hidden>
										<span
											className={`block h-full rounded-full ${tone.bar} opacity-80`}
											style={{ width: `${barPct}%` }}
										/>
									</span>
								) : null}
							</span>
						)}
					</td>
				) : null}
				{/* the drop-independent ceiling stays in view while the toggle moves other columns */}
				<td className="px-5 py-3 text-right align-middle text-xs whitespace-nowrap text-(--text-secondary) tabular-nums">
					{unquantified ? '—' : worstCaseLabel(s, supplyUsd, position)}
				</td>
				<td className="px-5 py-3 text-right align-middle">
					<span className="inline-flex items-center gap-1 rounded-full bg-(--bg-main) px-2 py-0.5 text-xs whitespace-nowrap text-(--text-secondary)">
						{noEscape ? null : <Icon name="clock" className="size-3" aria-hidden />}
						{exitLabel(s)}
					</span>
				</td>
				<td className="px-2 py-3 align-middle">
					{clickable ? (
						<Icon name="chevron-down" className={`size-3.5 text-(--text-secondary) ${selected ? 'rotate-180' : ''}`} />
					) : null}
				</td>
			</tr>
			{selected && clickable ? (
				<tr id={detailId} className="border-t border-(--cards-border) bg-(--bg-main)/30">
					<td colSpan={hasAnchors ? 6 : 5} className="px-4 py-4">
						<ScenarioDetailContent
							scenario={s}
							protocol={protocol}
							supplyUsd={supplyUsd}
							stress={stress}
							layout="two-column"
						/>
					</td>
				</tr>
			) : null}
		</Fragment>
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
	const arrow = (
		<Icon
			name="chevron-down"
			className={`size-3 shrink-0 transition ${active ? 'opacity-100' : 'opacity-0'} ${active && dir === 'asc' ? 'rotate-180' : ''}`}
			aria-hidden
		/>
	)
	return (
		<th
			className={`border-b border-black/10 px-5 py-2.5 font-medium whitespace-nowrap dark:border-white/10 ${align === 'right' ? 'text-right' : 'text-left'}`}
			aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}
		>
			<button
				type="button"
				onClick={() => onSort(k)}
				className={`inline-flex items-center gap-1 rounded transition-colors hover:text-(--text-primary) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--primary) ${
					active ? 'text-(--text-primary)' : ''
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
	scenarios: ScenarioVM[]
	protocol: ProtocolRiskFixture | null
	supplyUsd: number
}) {
	const [selectedId, setSelectedId] = useState<string | null>(null)
	const [sortKey, setSortKey] = useState<SortKey>('worst')
	const [sortDir, setSortDir] = useState<SortDir>('desc')
	const [stress, setStress] = useState<StressSel>(30)
	const [position] = usePositionUsd()

	const computed = useMemo(() => scenarios.filter((s) => s.status === 'computed'), [scenarios])
	// The stress toggle + its column only appear when the backend serves the per-drop curve.
	const hasAnchors = anyHasAnchors(computed)
	const activeStress = hasAnchors ? stress : undefined

	// Section-wide scale for the magnitude bars, capped at the pool so a full-loss row reads
	// as a full bar. Pool-relative, so an entered deposit doesn't change the ratios.
	const sectionMax = useMemo(
		() => Math.max(1, ...computed.map((s) => (supplyUsd > 0 ? Math.min(s.lossMaxUsd, supplyUsd) : s.lossMaxUsd))),
		[computed, supplyUsd]
	)
	const noEscape = computed.filter((s) => s.actingWindow.kind === 'no-escape').length

	const groups = useMemo(() => {
		// `loss`/`stress` rank by the loss at the selected drop, `worst` by the ceiling — all
		// pool-relative, so independent of any entered deposit.
		const lossOf = (s: ScenarioVM) => (isUnquantified(s) ? -1 : modeledLossCell(s, activeStress).sortUsd)
		const ascending: Record<SortKey, (a: ScenarioVM, b: ScenarioVM) => number> = {
			title: (a, b) => a.title.localeCompare(b.title),
			loss: (a, b) => lossOf(a) - lossOf(b) || a.lossMaxUsd - b.lossMaxUsd,
			stress: (a, b) => lossOf(a) - lossOf(b) || a.lossMaxUsd - b.lossMaxUsd,
			worst: (a, b) => a.lossMaxUsd - b.lossMaxUsd,
			exit: (a, b) => exitSortKey(a) - exitSortKey(b)
		}
		const base = ascending[sortKey]
		const cmp = sortDir === 'asc' ? base : (a: ScenarioVM, b: ScenarioVM) => -base(a, b)
		const visible = scenarios.filter(isDisplayedScenario)
		return SCENARIO_GROUPS.map((g) => ({
			...g,
			rows: [...visible.filter((s) => scenarioGroup(s) === g.key)].sort(cmp)
		})).filter((g) => g.rows.length)
	}, [scenarios, sortKey, sortDir, activeStress])

	if (!groups.length) return null

	const stressHeaderLabel = activeStress === 'worst' ? 'Worst-case loss' : `Loss at −${activeStress}%`

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
		<div className="flex flex-col gap-4">
			<ChapterHead
				title="How you could lose money"
				hint="Each row is a distinct failure. Possible loss is the share of your deposit at the selected collateral drop; Worst case is the ceiling if everything goes wrong — a conditional loss if it happens, not a likelihood. Price-scaling rows move with the drop selector; the rest are fixed. Enter a deposit to see the dollar figures as your own. Open a row for conditions, mitigations, and the math."
			/>

			<div className="overflow-hidden rounded-md border border-(--cards-border)">
				{computed.length > 0 ? (
					<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-(--cards-border) bg-(--bg-main)/40 px-3 py-2.5">
						<span className="text-xs text-(--text-secondary) tabular-nums">
							{computed.length} {computed.length === 1 ? 'scenario' : 'scenarios'}
							{noEscape > 0 ? (
								<>
									{' · '}
									<span className="font-semibold text-(--text-primary)">{noEscape}</span> with no time to exit
								</>
							) : (
								' · all have an exit window'
							)}
							{position != null ? (
								<>
									{' · $ shown for your '}
									<span className="font-semibold text-(--text-primary)">{formattedNum(position, true)}</span>
									{' deposit'}
								</>
							) : null}
						</span>

						{hasAnchors ? (
							<div className="flex shrink-0 items-center gap-2">
								<span className="text-xs text-(--text-secondary)">Collateral drop</span>
								<div
									role="group"
									aria-label="Collateral price-drop stress level"
									className="inline-flex items-center gap-0.5 rounded-lg bg-(--app-bg) p-0.5"
								>
									{STRESS_OPTS.map((opt) => (
										<button
											key={String(opt.v)}
											type="button"
											onClick={() => setStress(opt.v)}
											aria-pressed={stress === opt.v}
											className={`rounded-md px-2.5 py-1 text-xs font-medium tabular-nums transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--primary) ${
												stress === opt.v
													? 'bg-black/8 text-(--text-primary) dark:bg-white/8'
													: 'text-(--text-secondary) hover:text-(--text-primary)'
											}`}
										>
											{opt.label}
										</button>
									))}
								</div>
							</div>
						) : null}
					</div>
				) : null}

				<div className="overflow-x-auto">
					<table className="w-full min-w-[880px] table-fixed text-sm">
						{/* the numeric columns share one width so the header reads as an even rhythm */}
						<colgroup>
							<col />
							<col className="w-36" />
							{hasAnchors ? <col className="w-36" /> : null}
							<col className="w-36" />
							<col className="w-36" />
							<col className="w-8" />
						</colgroup>
						<thead className="bg-(--bg-main) text-xs text-(--text-secondary)">
							<tr>
								<SortHeader k="title" label="Scenario" sort={sortKey} dir={sortDir} onSort={onSort} />
								<SortHeader k="loss" label="Possible loss" align="right" sort={sortKey} dir={sortDir} onSort={onSort} />
								{hasAnchors ? (
									<SortHeader
										k="stress"
										label={stressHeaderLabel}
										align="right"
										sort={sortKey}
										dir={sortDir}
										onSort={onSort}
									/>
								) : null}
								<SortHeader k="worst" label="Worst case" align="right" sort={sortKey} dir={sortDir} onSort={onSort} />
								<SortHeader k="exit" label="Exit window" align="right" sort={sortKey} dir={sortDir} onSort={onSort} />
								<th className="w-8 border-b border-black/10 px-2 py-2.5 dark:border-white/10" aria-hidden />
							</tr>
						</thead>
						<tbody>
							{groups.map((g) => (
								<Fragment key={g.key}>
									<tr className="border-t border-(--cards-border) bg-(--bg-main)">
										<td colSpan={hasAnchors ? 6 : 5} className="px-4 py-1.5">
											<span className="text-xs font-semibold text-(--text-primary)">{g.label}</span>
											<span className="ml-1.5 text-xs text-(--text-secondary) tabular-nums">({g.rows.length})</span>
										</td>
									</tr>
									{g.rows.map((s) => (
										<ScenarioRow
											key={s.scenarioId}
											s={s}
											protocol={protocol}
											supplyUsd={supplyUsd}
											position={position}
											stress={activeStress}
											hasAnchors={hasAnchors}
											sectionMax={sectionMax}
											selected={selectedId === s.scenarioId}
											onToggle={() => toggle(s.scenarioId)}
										/>
									))}
								</Fragment>
							))}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	)
}
