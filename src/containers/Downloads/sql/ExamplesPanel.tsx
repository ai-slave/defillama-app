import * as Ariakit from '@ariakit/react'
import { useId, useMemo, useRef, useState, type RefObject } from 'react'
import { Button } from '~/ui/Button'
import { keepFocus } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import { Tooltip } from '~/ui/Tooltip'
import { EXAMPLE_QUERIES, SUBCATEGORY_META, type ExampleQuery, type ExampleSubcategory } from './examples'

interface ExamplesPanelProps {
	onApply: (example: ExampleQuery) => void
	busyTaskId?: string | null
	/** Omitted where the panel cannot collapse, such as the SQL chart sidebar. */
	collapse?: { collapsed: boolean; onToggle: () => void }
}

export function ExamplesPanel({ onApply, busyTaskId, collapse }: ExamplesPanelProps) {
	// Collapsing swaps the panel for the rail, so the other side's toggle takes focus.
	const toggleRef = useRef<HTMLButtonElement>(null)
	const toggle = collapse ? () => keepFocus(collapse.onToggle, () => toggleRef.current) : null
	if (collapse?.collapsed) {
		return <CollapsedExamplesRail onExpand={toggle!} toggleRef={toggleRef} />
	}
	return <ExpandedExamplesPanel onApply={onApply} busyTaskId={busyTaskId} onCollapse={toggle} toggleRef={toggleRef} />
}

function CollapsedExamplesRail({
	onExpand,
	toggleRef
}: {
	onExpand: () => void
	toggleRef: RefObject<HTMLButtonElement | null>
}) {
	return (
		<aside className="flex flex-col items-stretch gap-2 rounded-md border border-subtle bg-surface p-1.5">
			<Tooltip
				content="Expand playbook"
				render={
					<Button ref={toggleRef} variant="ghost" size="md" square onClick={onExpand} aria-label="Expand playbook" />
				}
			>
				<Icon name="panel-left-open" className="size-4 rotate-180" />
			</Tooltip>
			<button
				type="button"
				onClick={onExpand}
				aria-label={`Playbook · ${EXAMPLE_QUERIES.length} queries`}
				className="group flex flex-1 flex-col items-center gap-2 rounded-md px-1 py-3 label-sm text-tertiary transition-colors hover:text-link"
			>
				<Icon name="sparkles" className="size-3.5 text-tertiary transition-colors group-hover:text-link" />
				<span className="tracking-widest uppercase [writing-mode:vertical-rl]" style={{ transform: 'rotate(180deg)' }}>
					Playbook
				</span>
				<span className="tabular-nums">{EXAMPLE_QUERIES.length}</span>
			</button>
		</aside>
	)
}

function ExpandedExamplesPanel({
	onApply,
	busyTaskId,
	onCollapse,
	toggleRef
}: {
	onApply: (example: ExampleQuery) => void
	busyTaskId?: string | null
	onCollapse: (() => void) | null
	toggleRef: RefObject<HTMLButtonElement | null>
}) {
	const [filter, setFilter] = useState('')
	const filterId = useId()
	const filterRef = useRef<HTMLInputElement>(null)
	const [hoveredGroup, setHoveredGroup] = useState<ExampleSubcategory | null>(null)

	const filteredGroups = useMemo(() => {
		const q = filter.trim().toLowerCase()
		const matches = q
			? EXAMPLE_QUERIES.filter(
					(ex) =>
						ex.title.toLowerCase().includes(q) ||
						ex.description.toLowerCase().includes(q) ||
						ex.subcategory.toLowerCase().includes(q)
				)
			: EXAMPLE_QUERIES

		const byGroup = new Map<ExampleSubcategory, Array<ExampleQuery>>()
		for (const ex of matches) {
			const list = byGroup.get(ex.subcategory) ?? []
			list.push(ex)
			byGroup.set(ex.subcategory, list)
		}
		return SUBCATEGORY_META.filter((g) => byGroup.has(g.name)).map((g) => ({ meta: g, items: byGroup.get(g.name)! }))
	}, [filter])

	const totalVisible = filteredGroups.reduce((sum, g) => sum + g.items.length, 0)
	const activeBlurb = useMemo(() => {
		const active = hoveredGroup ? SUBCATEGORY_META.find((g) => g.name === hoveredGroup) : filteredGroups[0]?.meta
		return active ?? SUBCATEGORY_META[0]
	}, [hoveredGroup, filteredGroups])

	const groupOrdinalOffsets = useMemo(() => {
		const offsets: Array<number> = []
		let offset = 0
		for (const group of filteredGroups) {
			offsets.push(offset)
			offset += group.items.length
		}
		return offsets
	}, [filteredGroups])

	return (
		<aside className="flex max-h-[min(38rem,calc(100vh-11rem))] flex-col gap-3 rounded-md border border-subtle bg-surface p-3">
			<header className="flex items-baseline justify-between gap-2">
				<div className="flex items-baseline gap-2">
					<h3 className="title-md tracking-tight text-primary">Playbook</h3>
					<span className="body-sm text-tertiary tabular-nums">{EXAMPLE_QUERIES.length}</span>
				</div>
				<div className="flex items-center gap-1">
					<Icon name="sparkles" className="size-3.5 text-tertiary" />
					{onCollapse ? (
						<Tooltip
							content="Collapse playbook"
							render={
								<Button
									ref={toggleRef}
									variant="ghost"
									size="sm"
									square
									onClick={onCollapse}
									aria-label="Collapse playbook"
								/>
							}
						>
							<Icon name="panel-left-close" className="size-4 rotate-180" />
						</Tooltip>
					) : null}
				</div>
			</header>

			{/* An underline field, not SearchField: a boxed field outweighs this dense 256px rail. */}
			<div className="flex flex-col gap-1">
				<label htmlFor={filterId} className="label-sm text-secondary">
					Filter
				</label>
				<div className="relative">
					<Icon
						name="search"
						className="pointer-events-none absolute top-1/2 left-0 size-3 -translate-y-1/2 text-tertiary"
					/>
					<input
						ref={filterRef}
						id={filterId}
						type="text"
						value={filter}
						onChange={(e) => setFilter(e.target.value)}
						placeholder="Filter queries…"
						className="w-full border-b border-medium bg-transparent pr-6 pb-1.5 pl-5 body-sm text-primary transition-colors placeholder:text-tertiary focus:border-brand focus:outline-hidden"
					/>
					{filter ? (
						<Button
							variant="ghost"
							size="sm"
							square
							// The button leaves with the text, so focus goes back to the field.
							onClick={() =>
								keepFocus(
									() => setFilter(''),
									() => filterRef.current
								)
							}
							aria-label="Clear filter"
							className="absolute top-1/2 right-0 -translate-y-1/2"
						>
							<Icon name="x" className="size-4" />
						</Button>
					) : null}
				</div>
			</div>

			<div className="-mr-1 flex flex-col gap-4 overflow-y-auto pr-1" onMouseLeave={() => setHoveredGroup(null)}>
				{filteredGroups.length === 0 ? (
					<p className="py-8 text-center body-sm text-tertiary">
						No queries match <span className="font-mono text-secondary">"{filter}"</span>
					</p>
				) : null}

				{filteredGroups.map(({ meta, items }, groupIndex) => (
					<section key={meta.name} onMouseEnter={() => setHoveredGroup(meta.name)} className="flex flex-col gap-1">
						<header className="flex items-baseline justify-between">
							<h4 className="flex items-center gap-1.5 title-sm text-secondary">
								<span
									aria-hidden
									className="inline-block size-1.5 shrink-0 rounded-full"
									style={{ background: meta.color }}
								/>
								{meta.name}
							</h4>
							<span className="body-sm text-tertiary tabular-nums">{items.length}</span>
						</header>
						<ul className="flex flex-col border-t border-subtle">
							{items.map((ex, itemIndex) => {
								const ordinal = groupOrdinalOffsets[groupIndex] + itemIndex + 1
								const itemId = `example:${ex.title}`
								const isBusy = busyTaskId === itemId
								const isDisabled = !!busyTaskId && !isBusy
								return (
									<PlaybookItem
										key={ex.title}
										ordinal={ordinal}
										example={ex}
										accentColor={meta.color}
										onApply={onApply}
										isBusy={isBusy}
										isDisabled={isDisabled}
									/>
								)
							})}
						</ul>
					</section>
				))}
			</div>

			<footer className="border-t border-subtle pt-2">
				<p className="flex items-baseline gap-1.5 body-sm text-tertiary">
					<span
						aria-hidden
						className="inline-block size-1 shrink-0 translate-y-[-1px] rounded-full"
						style={{ background: activeBlurb.color }}
					/>
					<span>
						<span className="font-semibold text-secondary">{activeBlurb.name}.</span> {activeBlurb.blurb}
					</span>
				</p>
				<p className="mt-1 body-sm text-tertiary">
					Click an example to load tables and run it.
					{totalVisible !== EXAMPLE_QUERIES.length ? ` · ${totalVisible} shown` : ''}
				</p>
			</footer>
		</aside>
	)
}

function PlaybookItem({
	ordinal,
	example,
	accentColor,
	onApply,
	isBusy,
	isDisabled
}: {
	ordinal: number
	example: ExampleQuery
	accentColor: string
	onApply: (example: ExampleQuery) => void
	isBusy: boolean
	isDisabled: boolean
}) {
	return (
		<li
			className={`group/item relative border-b border-subtle last:border-b-0 ${
				isDisabled ? 'opacity-60' : ''
			} ${isBusy ? 'bg-brand-faint' : ''}`}
		>
			<span
				aria-hidden
				className={`pointer-events-none absolute top-1 bottom-1 -left-0.5 w-0.5 origin-left rounded-full transition-all duration-200 ${
					isBusy
						? 'scale-y-100 opacity-100'
						: 'scale-y-0 opacity-0 group-hover/item:scale-y-100 group-hover/item:opacity-100'
				}`}
				style={{ background: accentColor }}
			/>
			{/* The pressed example turns busy under the reader's focus, so it stays focusable while it runs. */}
			<Tooltip
				content={example.description}
				placement="right"
				render={
					<Ariakit.Button
						onClick={() => onApply(example)}
						disabled={isDisabled || isBusy}
						accessibleWhenDisabled={isBusy}
						aria-busy={isBusy}
						className={`grid w-full grid-cols-[1.5rem_minmax(0,1fr)_0.75rem] items-center gap-2 py-1.5 text-left transition-transform duration-200 disabled:cursor-not-allowed ${
							!isDisabled && !isBusy ? 'group-hover/item:translate-x-0.5' : ''
						}`}
					/>
				}
			>
				<span className="flex size-4 items-center justify-center">
					{isBusy ? (
						<LoadingSpinner size={10} />
					) : (
						<span className="label-sm text-tertiary transition-colors group-hover/item:text-primary">
							{String(ordinal).padStart(2, '0')}
						</span>
					)}
				</span>
				<span
					className={`truncate label-sm transition-colors ${
						isBusy ? 'text-link' : 'text-primary group-hover/item:text-link'
					}`}
				>
					{example.title}
				</span>
				<Icon
					name="arrow-right"
					className={`size-3 transition-all duration-200 ${
						isBusy
							? 'translate-x-0 text-link opacity-100'
							: '-translate-x-1 text-tertiary opacity-0 group-hover/item:translate-x-0 group-hover/item:text-link group-hover/item:opacity-100'
					}`}
				/>
			</Tooltip>
		</li>
	)
}
