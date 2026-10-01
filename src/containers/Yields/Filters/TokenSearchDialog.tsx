import * as Ariakit from '@ariakit/react'
import { matchSorter } from 'match-sorter'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { SelectCheckIcon } from '~/components/Select/SelectCheckIcon'
import { TokenLogo } from '~/components/TokenLogo'
import { useMedia } from '~/hooks/useMedia'
import { useVirtualItems } from '~/hooks/useVirtualItems'
import { Button } from '~/ui/Button'
import { Dialog, dialogScrollableBodyStyles, DialogSearchHeader } from '~/ui/Dialog'
import { Hovercard } from '~/ui/Hovercard'
import { Icon } from '~/ui/Icon'
import { metricOptionChipStyles } from '~/ui/MetricChip'
import { NoResults } from '~/ui/NoResults'
import { popoverMultiSelectCheckStyles, popoverSingleSelectCheckStyles } from '~/ui/Popover'
import { SearchField } from '~/ui/SearchField'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { geckoTokenIconUrl } from '~/utils/icons'
import { formatNumber } from '~/utils/numberFormat'
import { TOKEN_MATCHES, TOKEN_ONS, type TokenMatch, type TokenOn } from '../data/tokenMatch'
import type { TokenOption } from '../data/types'

// Token search dialog shared by the earn / loop / borrow pages: search header, Recent chips,
// GROUPS (families) then TOKENS (virtualized), ↑↓/↵ navigation; the rail holds the selection,
// the live pool count, the Match × On rails (earn only) and Done.
// Token toggles apply instantly; the parent keeps Match × On local until a token can use them.

const MATCH_LABELS: Record<TokenMatch, string> = { exact: 'Exact', contains: 'Contains', set: 'Set' }
const ON_LABELS: Record<TokenOn, string> = { reference: 'Reference', pool: 'Pool', both: 'Both' }

const MATCH_HELP: Array<{ term: string; def: string }> = [
	{ term: 'Exact', def: 'Pools that include a token you picked.' },
	{ term: 'Contains', def: 'Pools containing at least one of your picks.' },
	{ term: 'Set', def: 'Pools whose tokens are exactly your selection (pair search).' }
]
const ON_HELP: Array<{ term: string; def: string }> = [
	{ term: 'Reference', def: 'The asset you provide to enter the pool.' },
	{ term: 'Pool', def: 'The token you hold while in the pool.' },
	{ term: 'Both', def: 'Match on either of the two.' }
]

const RECENT_KEY = 'yields-token-search-recent'
const RECENT_LIMIT = 5

function readRecent(): Array<string> {
	try {
		const raw = window.localStorage.getItem(RECENT_KEY)
		const parsed: unknown = raw ? JSON.parse(raw) : []
		return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
	} catch {
		return []
	}
}

function writeRecent(values: Array<string>) {
	try {
		window.localStorage.setItem(RECENT_KEY, JSON.stringify(values))
	} catch {
		// Storage can be blocked; Recent is a convenience only.
	}
}

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
	options: Array<TokenOption>
	selectedValues: Array<string>
	multiple: boolean
	onToggle: (value: string, wasSelected: boolean) => void
	onClear: () => void
	placeholder?: string
	match?: MatchConfig
	/** Pools matching the current page query; shown live in the rail. */
	resultCount?: number
}

function isFamily(value: string): boolean {
	return value.startsWith('family:')
}

function HelpIcon({ items, label }: { items: Array<{ term: string; def: string }>; label: string }) {
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

export function MatchOnControls({ match }: { match: MatchConfig }) {
	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-col gap-1.5">
				<span className="flex items-center gap-1 label-sm text-secondary">
					Match
					<HelpIcon items={MATCH_HELP} label="About match modes" />
				</span>
				<SegmentedControl
					label="Match mode"
					value={match.mode}
					onValueChange={match.onModeChange}
					options={TOKEN_MATCHES.map((m) => ({ value: m, label: MATCH_LABELS[m] }))}
					variant="field"
					size="sm"
				/>
			</div>
			<div className="flex flex-col gap-1.5">
				<span className="flex items-center gap-1 label-sm text-secondary">
					Search in
					<HelpIcon items={ON_HELP} label="About search targets" />
				</span>
				<SegmentedControl
					label="Search target"
					value={match.on}
					onValueChange={match.onOnChange}
					options={TOKEN_ONS.map((o) => ({ value: o, label: ON_LABELS[o] }))}
					variant="field"
					size="sm"
				/>
			</div>
		</div>
	)
}

function SectionHeader({
	label,
	hint,
	count,
	divider
}: {
	label: string
	hint?: string
	count?: number
	/** A hairline above, only where this section follows another block. */
	divider?: boolean
}) {
	return (
		<div
			className={`sticky top-0 z-10 -mx-2 flex items-center gap-2 bg-overlay px-4 pt-3 pb-1.5 ${
				divider ? 'mt-2 border-t border-subtle' : ''
			}`}
		>
			<span className="label-sm text-primary">{label}</span>
			{count != null ? <span className="label-sm text-tertiary">{formatNumber(count)}</span> : null}
			{hint ? <span className="body-sm text-tertiary">{hint}</span> : null}
		</div>
	)
}

function Chip({
	name,
	value,
	geckoId,
	selected,
	onClick,
	remove
}: {
	name: string
	value: string
	geckoId: string | undefined
	selected: boolean
	onClick: () => void
	remove?: boolean
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-pressed={remove ? undefined : selected}
			aria-label={remove ? `Remove ${name}` : undefined}
			data-active={selected}
			className={metricOptionChipStyles}
		>
			<LeadMark value={value} geckoId={geckoId} size={16} />
			{name}
			{isFamily(value) ? <span className="label-xs text-tertiary">Group</span> : null}
			{remove ? <Icon name="x" height={12} width={12} className="-mr-1 text-tertiary" /> : null}
		</button>
	)
}

function LeadMark({ value, geckoId, size }: { value: string; geckoId: string | undefined; size: number }) {
	if (isFamily(value)) return null
	return (
		<span className="flex shrink-0">
			<TokenLogo src={geckoId ? geckoTokenIconUrl(geckoId, size * 2) : null} alt="" size={size} />
		</span>
	)
}

function TokenOptionRow({
	option,
	selected,
	active,
	multiple,
	onToggle
}: {
	option: TokenOption
	selected: boolean
	active: boolean
	multiple: boolean
	onToggle: (value: string, wasSelected: boolean) => void
}) {
	const [name, value, geckoId] = option
	return (
		<button
			type="button"
			onClick={() => onToggle(value, selected)}
			aria-pressed={selected}
			data-active={active}
			className="group flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left body-md hover:bg-hover-row focus-visible:bg-hover-row data-[active=true]:bg-hover-row"
		>
			<LeadMark value={value} geckoId={geckoId} size={22} />
			<span className="truncate font-medium text-primary">{name}</span>
			<span
				aria-hidden
				className={multiple ? popoverMultiSelectCheckStyles(selected) : popoverSingleSelectCheckStyles(selected)}
			>
				<SelectCheckIcon />
			</span>
		</button>
	)
}

function TokenResults({
	families,
	assets,
	selectedSet,
	activeIndex,
	hasRecent,
	multiple,
	onToggle
}: {
	families: Array<TokenOption>
	assets: Array<TokenOption>
	selectedSet: Set<string>
	activeIndex: number
	hasRecent: boolean
	multiple: boolean
	onToggle: (value: string, wasSelected: boolean) => void
}) {
	const resultsRef = useRef<HTMLDivElement | null>(null)
	const familiesRef = useRef<HTMLDivElement | null>(null)
	const assetsRef = useRef<HTMLDivElement | null>(null)
	const [scrollMargin, setScrollMargin] = useState(0)
	const [headerHeight, setHeaderHeight] = useState(0)
	const getAssetKey = useCallback((index: number) => assets[index]?.[1] ?? index, [assets])

	// This component mounts inside Ariakit's portal, so the scroll element exists
	// before the virtualizer runs its first layout measurement.
	const assetVirtualizer = useVirtualItems({
		count: assets.length,
		getScrollElement: () => resultsRef.current,
		estimateSize: () => 40,
		overscan: 10,
		scrollMargin,
		// Rows scrolled to the top stop below the sticky Tokens header.
		scrollPaddingStart: headerHeight,
		getItemKey: getAssetKey
	})

	// The assets share their scroll container with the groups above. Measure that
	// offset initially and whenever responsive layout changes either region. Both
	// measured regions remain mounted so the observer also covers empty-to-loaded results.
	useLayoutEffect(() => {
		const scrollEl = resultsRef.current
		const familiesEl = familiesRef.current
		const assetsEl = assetsRef.current
		if (!scrollEl || !assetsEl) return
		const updateScrollMargin = () => {
			setScrollMargin(assetsEl.getBoundingClientRect().top - scrollEl.getBoundingClientRect().top + scrollEl.scrollTop)
			setHeaderHeight((assetsEl.previousElementSibling as HTMLElement | null)?.offsetHeight ?? 0)
		}
		updateScrollMargin()
		const observer = new ResizeObserver(updateScrollMargin)
		observer.observe(scrollEl)
		if (familiesEl) observer.observe(familiesEl)
		observer.observe(assetsEl)
		return () => observer.disconnect()
	}, [])

	// Keep the keyboard highlight in view; family rows are real DOM, asset rows are virtual.
	const { scrollToIndex } = assetVirtualizer
	useEffect(() => {
		if (activeIndex < 0) return
		if (activeIndex < families.length) {
			familiesRef.current?.querySelectorAll('button')[activeIndex]?.scrollIntoView({ block: 'nearest' })
			return
		}
		scrollToIndex(activeIndex - families.length, { align: 'auto' })
	}, [activeIndex, families.length, scrollToIndex])

	return (
		<div className={`${dialogScrollableBodyStyles} px-2 pb-2`} ref={resultsRef}>
			<div ref={familiesRef} hidden={families.length === 0}>
				<SectionHeader label="Groups" hint="one pick covers every variant" divider={hasRecent} />
				<div className="grid gap-x-1 sm:grid-cols-2">
					{families.map((option, index) => (
						<TokenOptionRow
							key={option[1]}
							option={option}
							selected={selectedSet.has(option[1])}
							active={index === activeIndex}
							multiple={multiple}
							onToggle={onToggle}
						/>
					))}
				</div>
			</div>

			<div hidden={assets.length === 0}>
				<SectionHeader label="Tokens" count={assets.length} divider={hasRecent || families.length > 0} />
				<div className="relative" style={{ height: assetVirtualizer.totalSize }} ref={assetsRef}>
					{assetVirtualizer.items.map((virtualRow) => {
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
									active={families.length + virtualRow.index === activeIndex}
									multiple={multiple}
									onToggle={onToggle}
								/>
							</div>
						)
					})}
				</div>
			</div>

			{families.length === 0 && assets.length === 0 ? (
				<NoResults>No tokens match. Try a symbol like USDC, or a group like ETH.</NoResults>
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
	match,
	resultCount
}: Props) {
	const [query, setQuery] = useState('')
	const [activeIndex, setActiveIndex] = useState(-1)
	const [recent, setRecent] = useState<Array<string>>(readRecent)
	const inputRef = useRef<HTMLInputElement | null>(null)
	const selectionRef = useRef<HTMLElement | null>(null)
	const isSmallScreen = useMedia('(max-width: 639px)')

	const selectedSet = useMemo(() => new Set(selectedValues), [selectedValues])
	const optionByValue = useMemo(() => new Map(options.map((option) => [option[1], option])), [options])

	const { families, assets } = useMemo(() => {
		const fam: Array<TokenOption> = []
		const ast: Array<TokenOption> = []
		const q = query.trim()
		const source = q
			? matchSorter(options, q, { keys: [(o) => o[0], (o) => o[1]], threshold: matchSorter.rankings.CONTAINS })
			: options
		for (const opt of source) (isFamily(opt[1]) ? fam : ast).push(opt)
		return { families: fam, assets: ast }
	}, [options, query])

	const recentShown = useMemo(() => recent.filter((value) => optionByValue.has(value)), [recent, optionByValue])

	if (!open) return null

	const toggle = (value: string, wasSelected: boolean) => {
		if (!wasSelected) {
			const next = [value, ...recent.filter((v) => v !== value)].slice(0, RECENT_LIMIT)
			setRecent(next)
			writeRecent(next)
		}
		onToggle(value, wasSelected)
	}

	const rowCount = families.length + assets.length
	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'ArrowDown') {
			e.preventDefault()
			setActiveIndex((i) => (rowCount === 0 ? -1 : Math.min(i + 1, rowCount - 1)))
		} else if (e.key === 'ArrowUp') {
			e.preventDefault()
			setActiveIndex((i) => Math.max(i - 1, 0))
		} else if (e.key === 'Enter') {
			const option = activeIndex < families.length ? families[activeIndex] : assets[activeIndex - families.length]
			if (!option) return
			e.preventDefault()
			toggle(option[1], selectedSet.has(option[1]))
		}
	}

	const setQueryAndReset = (next: string) => {
		setQuery(next)
		setActiveIndex(next.trim() ? 0 : -1)
	}

	const hasSelection = selectedValues.length > 0
	const showRecent = !query.trim() && recentShown.length > 0
	const chipRow = (label: string, values: Array<string>) => (
		<div className="flex flex-col gap-1.5">
			<span className="label-sm text-tertiary">{label}</span>
			<div className="flex flex-wrap gap-1.5">
				{values.map((value) => (
					<Chip
						key={value}
						name={optionByValue.get(value)?.[0] ?? value}
						value={value}
						geckoId={optionByValue.get(value)?.[2]}
						selected={selectedSet.has(value)}
						onClick={() => toggle(value, selectedSet.has(value))}
					/>
				))}
			</div>
		</div>
	)

	return (
		<Ariakit.DialogProvider open={open} setOpen={(nextOpen) => (nextOpen ? undefined : onClose())}>
			<Dialog
				size="lg"
				fullSheet
				// The results change height as the query changes, so the desktop dialog keeps its full height instead of
				// jumping with every keystroke.
				style={{ height: '100%' }}
				unmountOnHide
				portal
			>
				<DialogSearchHeader title={title}>
					{/* Phones skip the autofocus: the keyboard would cover the list before anyone asked to search. */}
					<SearchField
						ref={inputRef}
						label={title}
						value={query}
						onChange={setQueryAndReset}
						onKeyDown={handleKeyDown}
						placeholder={placeholder}
						autoComplete="off"
						spellCheck={false}
						autoFocus={!isSmallScreen}
					/>
				</DialogSearchHeader>
				<div className="flex min-h-0 flex-auto flex-col sm:flex-row">
					<div className="flex min-h-0 flex-auto flex-col">
						{showRecent ? <div className="px-4 pt-3 pb-1">{chipRow('Recent', recentShown)}</div> : null}

						<TokenResults
							key={query}
							families={families}
							assets={assets}
							selectedSet={selectedSet}
							activeIndex={activeIndex}
							hasRecent={showRecent}
							multiple={multiple}
							onToggle={toggle}
						/>
					</div>

					<aside className="flex shrink-0 flex-col gap-5 border-subtle bg-surface-elevated-1 p-4 max-sm:border-t sm:w-64 sm:border-l">
						<section
							ref={selectionRef}
							tabIndex={-1}
							aria-labelledby="token-search-selected"
							className="flex flex-col gap-2 outline-hidden"
						>
							<div className="flex items-center gap-2">
								<h3 id="token-search-selected" className="label-md text-primary">
									Selected
								</h3>
								{/* Disabled, not removed, when empty: the button keeps focus after it clears the picks. */}
								<Ariakit.Button
									disabled={!hasSelection}
									accessibleWhenDisabled
									render={<Button type="button" variant="ghost" size="sm" className="ml-auto" />}
									onClick={onClear}
								>
									Clear all
								</Ariakit.Button>
							</div>
							{hasSelection ? (
								<div className="flex flex-wrap gap-1.5">
									{selectedValues.map((value) => (
										<Chip
											key={value}
											name={optionByValue.get(value)?.[0] ?? value}
											value={value}
											geckoId={optionByValue.get(value)?.[2]}
											selected
											remove
											onClick={() => {
												// The chip leaves once the page applies the removal; focus waits on the section instead.
												selectionRef.current?.focus()
												toggle(value, true)
											}}
										/>
									))}
								</div>
							) : (
								<p className="body-sm text-tertiary">Nothing picked yet. Choose a token or a group.</p>
							)}
						</section>
						{resultCount != null ? (
							<div className="flex flex-col">
								<span className="heading-sm text-primary">{formatNumber(resultCount)}</span>
								<span className="body-sm text-secondary">
									{hasSelection ? 'pools match your picks' : 'pools in view'}
								</span>
							</div>
						) : null}
						{match ? <MatchOnControls match={match} /> : null}
						<Button type="button" variant="primary" size="md" className="mt-auto w-full" onClick={onClose}>
							Done
						</Button>
					</aside>
				</div>
			</Dialog>
		</Ariakit.DialogProvider>
	)
}
