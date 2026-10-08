import { matchSorter } from 'match-sorter'
import { useDeferredValue, useMemo, useRef, useState } from 'react'
import { useVirtualItems } from '~/hooks/useVirtualItems'
import { Button } from '~/ui/Button'
import { keepFocus } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Input, searchFieldIconStyles, searchFieldInputPlacementStyles } from '~/ui/Input'
import { LoadingIndicator } from '~/ui/Status'
import { getItemIconUrl } from '../../utils'

interface EntityOption {
	value: string
	label: string
	logo?: string
	isChild?: boolean
	parentValue?: string
}

interface EntityPickerListProps {
	mode: 'chain' | 'protocol'
	entities: Array<EntityOption>
	selectedEntities: Array<string>
	onToggle: (value: string) => void
	onClear: () => void
	isLoading?: boolean
}

export function EntityPickerList({
	mode,
	entities,
	selectedEntities,
	onToggle,
	onClear,
	isLoading = false
}: EntityPickerListProps) {
	const [search, setSearch] = useState('')
	const deferredSearch = useDeferredValue(search)
	const listRef = useRef<HTMLDivElement | null>(null)
	// Clear removes itself with the selection; picking continues from the search.
	const searchRef = useRef<HTMLInputElement>(null)
	const searchQuery = deferredSearch.trim()

	const filteredEntities = useMemo(() => {
		if (!searchQuery) return entities

		const rankedEntities = matchSorter(entities, searchQuery, { keys: ['label'] })
		const rankedValues = new Set(rankedEntities.map((entity) => entity.value))
		const childrenByVisibleParent = new Map<string, Array<EntityOption>>()

		for (const entity of rankedEntities) {
			if (!entity.isChild || !entity.parentValue || !rankedValues.has(entity.parentValue)) continue
			const children = childrenByVisibleParent.get(entity.parentValue) || []
			children.push(entity)
			childrenByVisibleParent.set(entity.parentValue, children)
		}

		if (childrenByVisibleParent.size === 0) return rankedEntities

		const groupedEntities: Array<EntityOption> = []
		const addedValues = new Set<string>()

		for (const entity of rankedEntities) {
			if (addedValues.has(entity.value)) continue
			if (entity.isChild && entity.parentValue && rankedValues.has(entity.parentValue)) continue

			groupedEntities.push(entity)
			addedValues.add(entity.value)

			const children = childrenByVisibleParent.get(entity.value)
			if (!children) continue

			for (const child of children) {
				if (addedValues.has(child.value)) continue
				groupedEntities.push(child)
				addedValues.add(child.value)
			}
		}

		return groupedEntities
	}, [entities, searchQuery])

	const visibleEntityValues = useMemo(() => new Set(filteredEntities.map((entity) => entity.value)), [filteredEntities])

	const virtualizer = useVirtualItems({
		count: filteredEntities.length,
		getScrollElement: () => listRef.current,
		estimateSize: () => 40,
		overscan: 10
	})

	if (isLoading) {
		return (
			<div
				role="status"
				aria-live="polite"
				className="flex h-full min-h-[200px] items-center justify-center rounded-lg border border-subtle bg-surface"
			>
				<LoadingIndicator />
			</div>
		)
	}

	return (
		<div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-subtle">
			<div className="flex items-center justify-between border-b border-subtle bg-surface px-3 py-2">
				<div className="relative flex-1">
					<Icon name="search" width={16} height={16} className={searchFieldIconStyles} />
					<Input
						ref={searchRef}
						onInput={(e) => setSearch(e.currentTarget.value)}
						aria-label={`Search ${mode === 'chain' ? 'chains' : 'protocols'}`}
						placeholder={`Search ${mode === 'chain' ? 'chains' : 'protocols'}…`}
						className={searchFieldInputPlacementStyles}
					/>
				</div>
				{selectedEntities.length > 0 ? (
					<div className="ml-3 flex items-center gap-2 label-sm">
						<span className="text-secondary">{selectedEntities.length} selected</span>
						<Button variant="link" onClick={() => keepFocus(onClear, () => searchRef.current)}>
							Clear
						</Button>
					</div>
				) : null}
			</div>

			<div ref={listRef} className="flex-1 overflow-y-auto">
				{filteredEntities.length === 0 ? (
					<div className="flex h-full items-center justify-center body-sm text-tertiary">
						No {mode === 'chain' ? 'chains' : 'protocols'} found
					</div>
				) : (
					<div
						style={{
							height: virtualizer.totalSize,
							position: 'relative'
						}}
					>
						{virtualizer.items.map((row) => {
							const entity = filteredEntities[row.index]
							if (!entity) return null
							const isSelected = selectedEntities.includes(entity.value)
							const iconUrl = getItemIconUrl(mode, null, entity.value)
							const isChild = entity.isChild && !!entity.parentValue && visibleEntityValues.has(entity.parentValue)

							return (
								<button
									key={entity.value}
									type="button"
									aria-pressed={isSelected}
									onClick={() => onToggle(entity.value)}
									className={`flex w-full items-center gap-3 py-2 pr-3 text-left label-sm transition-all ${
										isSelected ? 'bg-brand-tint' : ''
									} ${isChild ? 'pl-8' : 'pl-3'}`}
									style={{
										position: 'absolute',
										top: 0,
										left: 0,
										width: '100%',
										transform: `translateY(${row.start}px)`
									}}
								>
									<div
										className={`flex size-4 shrink-0 items-center justify-center rounded-sm border transition-colors ${
											isSelected ? 'border-brand bg-brand' : 'border-subtle bg-surface-elevated-1'
										}`}
									>
										{isSelected ? <Icon name="check" width={10} height={10} className="text-on-brand" /> : null}
									</div>

									{iconUrl ? (
										<img
											src={iconUrl}
											alt={entity.label}
											width={20}
											height={20}
											className="size-5 shrink-0 rounded-full object-cover ring-1 ring-(--border-subtle)"
										/>
									) : null}

									<span className={`truncate ${isSelected ? 'font-medium text-link' : 'text-primary'}`}>
										{entity.label}
									</span>
								</button>
							)
						})}
					</div>
				)}
			</div>
		</div>
	)
}
