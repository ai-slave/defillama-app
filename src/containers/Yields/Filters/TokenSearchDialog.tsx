import * as Ariakit from '@ariakit/react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { matchSorter } from 'match-sorter'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { DialogCloseButton, DialogHeading, dialogScrollableBodyStyles, dialogSurfaceStyles } from '~/ui/Dialog'
import { Hovercard } from '~/ui/Hovercard'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { formatNumber } from '~/utils/numberFormat'
import { TOKEN_MATCHES, TOKEN_ONS, type TokenMatch, type TokenOn } from '../data/tokenMatch'
import type { TokenOption } from '../data/types'

// Full-screen token search dialog shared by the earn / loop / borrow pages.
// Two labelled sections (GROUPS = families, ASSETS = individual tokens) resolve the
// "which ETH?" ambiguity of a flat list; the assets section is virtualized because
// thousands of tokens can appear. Earn additionally gets a Match × On query-builder
// band at the top. Token toggles apply instantly; the parent keeps Match × On local
// until the filter has a token that can use them.

const MATCH_LABELS: Record<TokenMatch, string> = { exact: 'Exact', contains: 'Contains', set: 'Set' }
const ON_LABELS: Record<TokenOn, string> = { reference: 'Reference', pool: 'Pool', both: 'Both' }

const MATCH_HELP: { term: string; def: string }[] = [
	{ term: 'Exact', def: 'Pools that include a token you picked.' },
	{ term: 'Contains', def: 'Pools containing at least one of your picks.' },
	{ term: 'Set', def: 'Pools whose tokens are exactly your selection (pair search).' }
]
const ON_HELP: { term: string; def: string }[] = [
	{ term: 'Reference', def: 'The asset you provide to enter the pool.' },
	{ term: 'Pool', def: 'The token you hold while in the pool.' },
	{ term: 'Both', def: 'Match on either of the two.' }
]

export interface MatchConfig {
	mode: TokenMatch
	on: TokenOn
	onModeChange: (mode: TokenMatch) => void
	onOnChange: (on: TokenOn) => void
}

interface Props {
	open: boolean
	onClose: () => void
	title: string
	options: TokenOption[]
	selectedValues: string[]
	multiple: boolean
	onToggle: (value: string, wasSelected: boolean) => void
	onClear: () => void
	placeholder?: string
	match?: MatchConfig
}

function isFamily(value: string): boolean {
	return value.startsWith('family:')
}

function HelpIcon({ items, label }: { items: { term: string; def: string }[]; label: string }) {
	return (
		<Hovercard
			placement="top-start"
			className="text-tertiary hover:text-secondary"
			contentClassName="max-w-105 p-3"
			render={<button type="button" aria-label={label} />}
			content={
				<dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
					{items.map((it) => (
						<div key={it.term} className="contents">
							<dt className="label-md whitespace-nowrap text-primary">{it.term}</dt>
							<dd className="body-md text-secondary">{it.def}</dd>
						</div>
					))}
				</dl>
			}
		>
			<Icon name="help-circle" height={14} width={14} />
		</Hovercard>
	)
}

function SectionHeader({ label, hint, count }: { label: string; hint: string; count: number }) {
	return (
		<div className="sticky top-0 z-10 -mx-2 flex items-baseline gap-2 border-t border-subtle bg-surface-elevated-1 px-3 py-1.5">
			<span className="label-sm text-secondary uppercase">{`${label} · ${formatNumber(count)}`}</span>
			<span className="body-sm text-secondary">{hint}</span>
		</div>
	)
}

function TokenOptionRow({
	option,
	selected,
	multiple,
	onToggle
}: {
	option: TokenOption
	selected: boolean
	multiple: boolean
	onToggle: (value: string, wasSelected: boolean) => void
}) {
	const [name, value] = option
	return (
		<button
			type="button"
			onClick={() => onToggle(value, selected)}
			aria-pressed={selected}
			className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left body-sm ${
				selected ? 'hover-wash bg-brand-muted' : 'hover:bg-hover-row focus-visible:bg-hover-row'
			}`}
		>
			{multiple ? (
				<span
					className={`flex size-4 shrink-0 items-center justify-center rounded-sm border ${
						selected ? 'border-brand bg-brand text-on-brand' : 'border-medium'
					}`}
					aria-hidden
				>
					{selected ? <Icon name="check" height={10} width={10} /> : null}
				</span>
			) : null}
			<span className="truncate label-sm text-primary">{name}</span>
			{selected && !multiple ? (
				<Icon name="check" height={14} width={14} className="ml-auto shrink-0 text-link-on-tint" />
			) : null}
		</button>
	)
}

function TokenResults({
	families,
	assets,
	selectedSet,
	multiple,
	onToggle,
	query
}: {
	families: TokenOption[]
	assets: TokenOption[]
	selectedSet: Set<string>
	multiple: boolean
	onToggle: (value: string, wasSelected: boolean) => void
	query: string
}) {
	const resultsRef = useRef<HTMLDivElement | null>(null)
	const familiesRef = useRef<HTMLDivElement | null>(null)
	const assetsRef = useRef<HTMLDivElement | null>(null)
	const [scrollMargin, setScrollMargin] = useState(0)
	const getAssetKey = useCallback((index: number) => assets[index]?.[1] ?? index, [assets])

	// This component mounts inside Ariakit's portal, so the scroll element exists
	// before the virtualizer runs its first layout measurement.
	const assetVirtualizer = useVirtualizer({
		count: assets.length,
		getScrollElement: () => resultsRef.current,
		estimateSize: () => 37,
		overscan: 10,
		scrollMargin,
		getItemKey: getAssetKey
	})

	useEffect(() => {
		resultsRef.current?.scrollTo({ top: 0 })
	}, [query])

	// The assets share their scroll container with the groups above. Measure that
	// offset initially and whenever responsive layout changes either region.
	useLayoutEffect(() => {
		const scrollEl = resultsRef.current
		const familiesEl = familiesRef.current
		const assetsEl = assetsRef.current
		if (!scrollEl || !assetsEl) return
		const updateScrollMargin = () =>
			setScrollMargin(assetsEl.getBoundingClientRect().top - scrollEl.getBoundingClientRect().top + scrollEl.scrollTop)
		updateScrollMargin()
		const observer = new ResizeObserver(updateScrollMargin)
		observer.observe(scrollEl)
		if (familiesEl) observer.observe(familiesEl)
		observer.observe(assetsEl)
		return () => observer.disconnect()
	}, [query, families.length, assets.length])

	return (
		<div className={`${dialogScrollableBodyStyles} px-2 pb-2`} ref={resultsRef}>
			{families.length ? (
				<div className="mb-1" ref={familiesRef}>
					<SectionHeader
						label="Groups"
						hint="curated families — one pick covers every variant"
						count={families.length}
					/>
					<div className="grid gap-x-1 sm:grid-cols-2">
						{families.map((option) => (
							<TokenOptionRow
								key={option[1]}
								option={option}
								selected={selectedSet.has(option[1])}
								multiple={multiple}
								onToggle={onToggle}
							/>
						))}
					</div>
				</div>
			) : null}

			{assets.length ? (
				<div>
					<SectionHeader label="Assets" hint="individual tokens" count={assets.length} />
					<div className="relative" style={{ height: assetVirtualizer.getTotalSize() }} ref={assetsRef}>
						{assetVirtualizer.getVirtualItems().map((virtualRow) => {
							const option = assets[virtualRow.index]
							if (!option) return null
							return (
								<div
									key={virtualRow.key}
									className="absolute top-0 left-0 w-full"
									style={{ transform: `translateY(${virtualRow.start - scrollMargin}px)` }}
								>
									<TokenOptionRow
										option={option}
										selected={selectedSet.has(option[1])}
										multiple={multiple}
										onToggle={onToggle}
									/>
								</div>
							)
						})}
					</div>
				</div>
			) : null}

			{!families.length && !assets.length ? (
				<div className="px-3 py-6 text-center body-sm text-tertiary">No matches</div>
			) : null}
		</div>
	)
}

export function TokenSearchDialog({
	open,
	onClose,
	title,
	options,
	selectedValues,
	multiple,
	onToggle,
	onClear,
	placeholder = 'Search assets or groups…',
	match
}: Props) {
	const [query, setQuery] = useState('')
	const inputRef = useRef<HTMLInputElement | null>(null)

	const selectedSet = useMemo(() => new Set(selectedValues), [selectedValues])
	// The parent mounts a fresh dialog for each open session. Capture the initial
	// selection once so selected-first ordering stays stable while toggling.
	const [snapshot] = useState(() => new Set(selectedValues))

	const { families, assets } = useMemo(() => {
		const fam: TokenOption[] = []
		const ast: TokenOption[] = []
		const q = query.trim()
		const source = q
			? matchSorter(options, q, { keys: [(o) => o[0], (o) => o[1]], threshold: matchSorter.rankings.CONTAINS })
			: options
		for (const opt of source) (isFamily(opt[1]) ? fam : ast).push(opt)
		if (snapshot.size === 0) return { families: fam, assets: ast }
		const selectedFirst = (a: TokenOption, b: TokenOption) =>
			(snapshot.has(a[1]) ? 0 : 1) - (snapshot.has(b[1]) ? 0 : 1)
		return { families: [...fam].sort(selectedFirst), assets: [...ast].sort(selectedFirst) }
	}, [options, query, snapshot])

	if (!open) return null

	const hasSelection = selectedValues.length > 0

	return (
		<Ariakit.DialogProvider open={open} setOpen={(nextOpen) => (nextOpen ? undefined : onClose())}>
			<Ariakit.Dialog
				className={`${dialogSurfaceStyles} [--dialog-width:680px]`}
				style={{ height: '100%' }}
				initialFocus={inputRef}
				unmountOnHide
				portal
			>
				<div className="flex items-center gap-2 border-b border-subtle p-3">
					<DialogHeading>{title}</DialogHeading>
					<DialogCloseButton className="-mr-1 ml-auto" />
				</div>

				{match ? (
					<div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-3 pt-1 pb-3">
						<div className="flex items-center gap-2">
							<span className="flex items-center gap-1 label-md text-secondary">
								Match
								<HelpIcon items={MATCH_HELP} label="About Match modes" />
							</span>
							<SegmentedControl
								label="Match mode"
								value={match.mode}
								onValueChange={match.onModeChange}
								options={TOKEN_MATCHES.map((m) => ({ value: m, label: MATCH_LABELS[m] }))}
								variant="default"
								size="md"
							/>
						</div>
						<div className="flex items-center gap-2">
							<span className="flex items-center gap-1 label-md text-secondary">
								Search in
								<HelpIcon items={ON_HELP} label="About search targets" />
							</span>
							<SegmentedControl
								label="Search target"
								value={match.on}
								onValueChange={match.onOnChange}
								options={TOKEN_ONS.map((o) => ({ value: o, label: ON_LABELS[o] }))}
								variant="default"
								size="md"
							/>
						</div>
					</div>
				) : null}

				<div className="relative mx-3 mb-2">
					<Icon
						name="search"
						className="pointer-events-none absolute top-0 bottom-0 left-3 my-auto size-4 text-tertiary"
					/>
					<Input
						ref={inputRef}
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder={placeholder}
						className="w-full pr-8 pl-8"
					/>
					{query ? (
						<button
							type="button"
							onClick={() => {
								setQuery('')
								inputRef.current?.focus()
							}}
							aria-label="Clear search"
							className="absolute top-0 right-3 bottom-0 my-auto text-tertiary hover:text-primary"
						>
							<Icon name="x" height={14} width={14} />
						</button>
					) : null}
				</div>

				<>
					{/* Selection feedback is only useful once there is something actionable to clear. */}
					{hasSelection ? (
						<button
							type="button"
							onClick={onClear}
							className="mx-3 mb-1.5 flex items-center justify-between rounded-md px-1 py-1 body-sm text-secondary hover:bg-hover-row hover:text-primary"
						>
							<span>{`${selectedValues.length} selected`}</span>
							<span className="flex items-center gap-1">
								Clear
								<Icon name="x" height={14} width={14} />
							</span>
						</button>
					) : null}
					<TokenResults
						families={families}
						assets={assets}
						selectedSet={selectedSet}
						multiple={multiple}
						onToggle={onToggle}
						query={query}
					/>
				</>
			</Ariakit.Dialog>
		</Ariakit.DialogProvider>
	)
}
