import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { formatUsd, formatPercent } from '~/utils/numberFormat'
import type { ArticleEntitySuggestionItem } from '../entitySuggestions'
import type { ArticleEntityType } from '../types'

type Props = {
	items: Array<ArticleEntitySuggestionItem>
	recents: Array<ArticleEntitySuggestionItem>
	query: string
	loading: boolean
	command: (item: ArticleEntitySuggestionItem) => void
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

const changeColor = (n?: number | null) =>
	typeof n !== 'number' ? '' : n > 0 ? 'text-success' : n < 0 ? 'text-error' : ''

function MetricChip({ item }: { item: ArticleEntitySuggestionItem }) {
	const p = item.preview
	if (!p) return null
	if (p.kind === 'protocol' || p.kind === 'chain') {
		const tvl = formatUsd(p.tvl, { compact: true })
		const change = formatPercent(p.change7d, {
			input: 'fraction',
			minimumFractionDigits: 1,
			maximumFractionDigits: 1,
			signDisplay: 'exceptZero',
			useGrouping: false
		})
		if (!tvl && !change) return null
		return (
			<span className="ml-1 flex shrink-0 flex-col items-end gap-0.5 leading-none">
				{tvl ? <span className="text-[11px] text-secondary tabular-nums">{tvl}</span> : null}
				{change ? <span className={`text-[10px] tabular-nums ${changeColor(p.change7d)}`}>{change}</span> : null}
			</span>
		)
	}
	return null
}

export const EntitySuggestionList = forwardRef<EntitySuggestionListHandle, Props>(function EntitySuggestionList(
	{ items, recents, query, loading, command },
	ref
) {
	const [filter, setFilter] = useState<Filter>('all')

	const availableTypes = useMemo(() => {
		const set = new Set<ArticleEntityType>()
		for (const i of items) set.add(i.entityType)
		return set
	}, [items])

	const showRecents = !query.trim() && recents.length > 0 && filter === 'all'
	const filtered = useMemo(
		() => (filter === 'all' ? items : items.filter((i) => i.entityType === filter)),
		[items, filter]
	)
	const flat = useMemo<Array<ArticleEntitySuggestionItem>>(() => {
		const list: Array<ArticleEntitySuggestionItem> = []
		if (showRecents) list.push(...recents)
		list.push(...filtered)
		return list
	}, [filtered, recents, showRecents])

	const [selectedId, setSelectedId] = useState<string | null>(flat[0]?.id ?? null)
	const listRef = useRef<HTMLDivElement | null>(null)
	// The highlight survives while its row is still listed. When the row disappears the first row takes over
	// and the old highlight is forgotten, so widening the list again does not bring it back.
	const [syncedFlat, setSyncedFlat] = useState(flat)
	if (flat !== syncedFlat) {
		setSyncedFlat(flat)
		if (!selectedId || !flat.some((i) => i.id === selectedId)) setSelectedId(flat[0]?.id ?? null)
	}

	useEffect(() => {
		if (!selectedId || !listRef.current) return
		const el = listRef.current.querySelector<HTMLElement>(`[data-id="${CSS.escape(selectedId)}"]`)
		el?.scrollIntoView({ block: 'nearest' })
	}, [selectedId])

	useImperativeHandle(ref, () => ({
		onKeyDown(event) {
			if (event.key === 'Tab') {
				const enabledFilters = FILTER_ORDER.filter((f) => f.key === 'all' || availableTypes.has(f.key))
				const idx = enabledFilters.findIndex((f) => f.key === filter)
				const dir = event.shiftKey ? -1 : 1
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
				aria-selected={active}
				className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition-colors ${
					active ? 'bg-research-tint' : 'hover:bg-research-tint-hover'
				}`}
				onMouseEnter={() => setSelectedId(item.id)}
				onMouseDown={(event) => {
					event.preventDefault()
					command(item)
				}}
			>
				<span className="relative flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-medium bg-page">
					{item.logo ? (
						<img src={item.logo} alt="" className="size-full object-cover" loading="lazy" />
					) : (
						<span className="text-[9px] font-medium tracking-wider text-tertiary">
							{item.label.slice(0, 2).toUpperCase()}
						</span>
					)}
				</span>
				<span className="flex min-w-0 flex-1 flex-col">
					<span className="truncate text-sm text-primary">{item.label}</span>
					<span className="truncate text-[11px] text-tertiary">
						{opts?.recent ? 'Recent · ' : ''}
						{item.subLabel || item.route}
					</span>
				</span>
				<MetricChip item={item} />
				<span className="ml-1 shrink-0 rounded-sm border border-medium px-1.5 py-px text-[9px] font-medium tracking-wider text-tertiary">
					{TYPE_BADGE[item.entityType] ?? item.entityType.toUpperCase()}
				</span>
			</button>
		)
	}

	const totalCount = items.length
	const filteredCount = filtered.length

	return (
		<div className="article-mention-pop w-[22rem] overflow-hidden rounded-md border border-medium bg-surface shadow-xl">
			<div className="flex items-center justify-between gap-2 border-b border-medium px-3 py-1.5 text-[11px] text-tertiary">
				<span className="truncate">
					{query ? (
						<>
							Searching <span className="text-secondary">"{query}"</span>
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
			<div className="flex items-center gap-1 overflow-x-auto border-b border-medium px-2 py-1.5">
				{FILTER_ORDER.map((f) => {
					const enabled = f.key === 'all' || availableTypes.has(f.key)
					const active = f.key === filter
					return (
						<button
							key={f.key}
							type="button"
							disabled={!enabled}
							onMouseDown={(event) => {
								event.preventDefault()
								if (enabled) setFilter(f.key)
							}}
							className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wider uppercase transition-colors ${
								active
									? 'border-link bg-link text-on-brand'
									: enabled
										? 'border-medium text-secondary hover:bg-research-tint-hover'
										: 'border-medium/50 text-tertiary/50'
							}`}
						>
							{f.label}
						</button>
					)
				})}
			</div>
			<div ref={listRef} className="max-h-80 overflow-y-auto py-1" role="listbox">
				{flat.length === 0 ? (
					<div className="px-3 py-8 text-center text-xs text-tertiary">{loading ? 'Searching…' : 'No matches'}</div>
				) : (
					<>
						{showRecents ? recents.map((i) => renderItem(i, { recent: true })) : null}
						{showRecents ? <div className="my-1 border-t border-medium" /> : null}
						{filtered.map((i) => renderItem(i))}
					</>
				)}
			</div>
			<div className="flex items-center justify-between gap-2 border-t border-medium px-3 py-1.5 text-[10px] text-tertiary">
				<span>
					<kbd className="rounded-sm border border-medium px-1">↑</kbd>{' '}
					<kbd className="rounded-sm border border-medium px-1">↓</kbd> nav{' '}
					<kbd className="ml-1 rounded-sm border border-medium px-1">tab</kbd> filter
				</span>
				<span>
					<kbd className="rounded-sm border border-medium px-1">↵</kbd> insert{' '}
					<kbd className="ml-1 rounded-sm border border-medium px-1">esc</kbd> dismiss
				</span>
			</div>
		</div>
	)
})
