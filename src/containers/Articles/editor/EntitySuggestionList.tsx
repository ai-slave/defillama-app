import type { Ref } from 'react'
import { useId, useImperativeHandle, useMemo, useState } from 'react'
import { Button } from '~/ui/Button'
import { Change } from '~/ui/Change'
import { Keycap } from '~/ui/Keycap'
import { ListLoading, NoResults } from '~/ui/NoResults'
import { formatUsd } from '~/utils/numberFormat'
import type { ArticleEntitySuggestionItem } from '../entitySuggestions'
import type { ArticleEntityType } from '../types'
import { SuggestionPopover, useSuggestionAccessibility, type SuggestionAnchor } from './SuggestionPopover'

type Props = {
	items: Array<ArticleEntitySuggestionItem>
	recents: Array<ArticleEntitySuggestionItem>
	query: string
	loading: boolean
	command: (item: ArticleEntitySuggestionItem) => void
}

export function EntitySuggestionPopover({
	ref,
	...props
}: Props & SuggestionAnchor & { ref?: Ref<EntitySuggestionListHandle> }) {
	return (
		<SuggestionPopover {...props}>
			<EntitySuggestionList {...props} ref={ref} />
		</SuggestionPopover>
	)
}

export type EntitySuggestionListHandle = {
	onKeyDown: (event: KeyboardEvent) => boolean
}

const TYPE_BADGE: Record<ArticleEntityType, string> = {
	protocol: 'PROTO',
	chain: 'CHAIN',
	metric: 'PAGE',
	category: 'CAT',
	stablecoin: 'STBL',
	cex: 'CEX',
	bridge: 'BRIDGE',
	hack: 'HACK'
}

type Filter = 'all' | ArticleEntityType
const FILTER_ORDER: Array<{ key: Filter; label: string }> = [
	{ key: 'all', label: 'All' },
	{ key: 'protocol', label: 'Proto' },
	{ key: 'chain', label: 'Chain' },
	{ key: 'metric', label: 'Page' },
	{ key: 'stablecoin', label: 'Stbl' },
	{ key: 'category', label: 'Cat' },
	{ key: 'cex', label: 'CEX' },
	{ key: 'bridge', label: 'Bridge' }
]

function MetricChip({ item }: { item: ArticleEntitySuggestionItem }) {
	const p = item.preview
	if (!p) return null
	if (p.kind === 'protocol' || p.kind === 'chain') {
		const tvl = formatUsd(p.tvl, { compact: true })
		if (!tvl && p.change7d == null) return null
		return (
			<span className="ml-1 flex shrink-0 flex-col items-end gap-0.5 leading-none">
				{tvl ? <span className="body-sm text-secondary tabular-nums">{tvl}</span> : null}
				{p.change7d == null ? null : (
					<span className="body-xs tabular-nums">
						{/* The preview sends the 7d change as a fraction. */}
						<Change value={p.change7d * 100} />
					</span>
				)}
			</span>
		)
	}
	return null
}

export function EntitySuggestionList({
	items,
	recents,
	query,
	loading,
	command,
	ref
}: Props & { ref?: Ref<EntitySuggestionListHandle> }) {
	const [filter, setFilter] = useState<Filter>('all')

	const availableTypes = useMemo(() => {
		const set = new Set<ArticleEntityType>()
		for (const i of items) set.add(i.entityType)
		return set
	}, [items])

	const showRecents = !query.trim() && recents.length > 0 && filter === 'all'
	const filtered = useMemo(() => {
		const recentIds = new Set(showRecents ? recents.map((item) => item.id) : [])
		return items.filter((item) => (filter === 'all' || item.entityType === filter) && !recentIds.has(item.id))
	}, [items, filter, showRecents, recents])
	const flat = useMemo<Array<ArticleEntitySuggestionItem>>(() => {
		const list: Array<ArticleEntitySuggestionItem> = []
		if (showRecents) list.push(...recents)
		list.push(...filtered)
		return list
	}, [filtered, recents, showRecents])

	const [selectedId, setSelectedId] = useState<string | null>(flat[0]?.id ?? null)
	const listId = useId()
	const optionId = (id: string) => `${listId}-${encodeURIComponent(id)}`
	// The highlight survives while its row is still listed. When the row disappears the first row takes over
	// and the old highlight is forgotten, so widening the list again does not bring it back.
	const [syncedFlat, setSyncedFlat] = useState(flat)
	if (flat !== syncedFlat) {
		setSyncedFlat(flat)
		if (!selectedId || !flat.some((i) => i.id === selectedId)) setSelectedId(flat[0]?.id ?? null)
	}

	useSuggestionAccessibility(listId, selectedId ? optionId(selectedId) : null)

	useImperativeHandle(ref, () => ({
		onKeyDown(event) {
			if (event.isComposing) return false
			if (event.altKey && (event.key === 'ArrowRight' || event.key === 'ArrowLeft')) {
				const enabledFilters = FILTER_ORDER.filter((f) => f.key === 'all' || availableTypes.has(f.key))
				const idx = enabledFilters.findIndex((f) => f.key === filter)
				const dir = event.key === 'ArrowLeft' ? -1 : 1
				const next = enabledFilters[(idx + dir + enabledFilters.length) % enabledFilters.length]
				setFilter(next.key)
				return true
			}
			if (flat.length === 0) {
				if (event.key === 'Enter' || event.key === 'ArrowUp' || event.key === 'ArrowDown') return true
				return false
			}
			const idx = flat.findIndex((i) => i.id === selectedId)
			if (event.key === 'ArrowDown') {
				setSelectedId(flat[(idx + 1 + flat.length) % flat.length].id)
				return true
			}
			if (event.key === 'ArrowUp') {
				setSelectedId(flat[(idx - 1 + flat.length) % flat.length].id)
				return true
			}
			if (event.key === 'Enter') {
				const item = flat[idx >= 0 ? idx : 0]
				if (item) command(item)
				return true
			}
			return false
		}
	}))

	const renderItem = (item: ArticleEntitySuggestionItem, opts?: { recent?: boolean }) => {
		const active = item.id === selectedId
		return (
			<button
				key={item.id}
				data-id={item.id}
				type="button"
				role="option"
				id={optionId(item.id)}
				tabIndex={-1}
				aria-selected={active}
				className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition-colors hover:bg-hover-row aria-selected:bg-hover-row"
				onMouseMove={() => setSelectedId(item.id)}
				onClick={() => command(item)}
				onMouseDown={(event) => {
					event.preventDefault()
				}}
			>
				<span className="relative flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-medium bg-page">
					{item.logo ? (
						<img src={item.logo} alt="" className="size-full object-cover" loading="lazy" />
					) : (
						<span className="label-xs tracking-wider text-tertiary">{item.label.slice(0, 2).toUpperCase()}</span>
					)}
				</span>
				<span className="flex min-w-0 flex-1 flex-col">
					<span className="truncate label-md text-primary">{item.label}</span>
					<span className="truncate body-sm text-tertiary">
						{opts?.recent ? 'Recent · ' : ''}
						{item.subLabel || item.route}
					</span>
				</span>
				<MetricChip item={item} />
				<span className="ml-1 shrink-0 rounded-sm border border-medium px-1.5 py-px label-xs tracking-wider text-tertiary">
					{TYPE_BADGE[item.entityType] ?? item.entityType.toUpperCase()}
				</span>
			</button>
		)
	}

	const totalCount = items.length
	const filteredCount = filtered.length

	return (
		<div
			className="article-mention-pop flex w-[22rem] max-w-full flex-col overflow-hidden rounded-md border border-medium bg-overlay shadow-overlay"
			style={{ maxHeight: 'var(--popover-available-height)' }}
		>
			<div className="flex shrink-0 items-center justify-between gap-2 border-b border-medium px-3 py-1.5 body-sm text-tertiary">
				<span className="truncate">
					{query ? (
						<>
							Searching <span className="text-secondary">&quot;{query}&quot;</span>
						</>
					) : (
						'Type to search · Suggested'
					)}
				</span>
				<span className="shrink-0">
					{loading
						? 'Searching…'
						: totalCount
							? filter === 'all'
								? `${totalCount}`
								: `${filteredCount}/${totalCount}`
							: '—'}
				</span>
			</div>
			<div
				role="group"
				aria-label="Entity type"
				className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-medium px-2 py-1.5"
			>
				{FILTER_ORDER.map((f) => {
					const active = f.key === filter
					// A type with no hits has no pill; the active one stays so the reader can see why the list is empty.
					if (f.key !== 'all' && !active && !availableTypes.has(f.key)) return null
					return (
						<Button
							key={f.key}
							variant="toggle"
							size="sm"
							aria-pressed={active}
							data-active={active}
							onClick={() => setFilter(f.key)}
							onMouseDown={(event) => {
								event.preventDefault()
							}}
						>
							{f.label}
						</Button>
					)
				})}
			</div>
			<div
				id={listId}
				aria-label="Entities"
				aria-busy={loading}
				className="max-h-80 min-h-0 overflow-y-auto py-1"
				role="listbox"
			>
				{flat.length === 0 ? (
					loading ? (
						<ListLoading label="Searching" />
					) : (
						<NoResults>No matches</NoResults>
					)
				) : (
					<>
						{showRecents ? recents.map((i) => renderItem(i, { recent: true })) : null}
						{showRecents ? <div className="my-1 border-t border-medium" /> : null}
						{filtered.map((i) => renderItem(i))}
					</>
				)}
			</div>
			<div className="flex shrink-0 items-center justify-between gap-2 border-t border-medium px-3 py-1.5 body-xs text-tertiary">
				<span>
					<Keycap>↑</Keycap> <Keycap>↓</Keycap> nav <Keycap>alt ← →</Keycap> filter
				</span>
				<span>
					<Keycap>↵</Keycap> insert <Keycap>esc</Keycap> dismiss
				</span>
			</div>
		</div>
	)
}
