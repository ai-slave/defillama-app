import type { Ref } from 'react'
import { useId, useImperativeHandle, useState } from 'react'
import type { SlashCommandItem } from './slashCommand'
import { SuggestionPopover, useSuggestionAccessibility, type SuggestionAnchor } from './SuggestionPopover'

type Props = {
	items: Array<SlashCommandItem>
	command: (item: SlashCommandItem) => void
}

export function SlashCommandPopover({
	ref,
	...props
}: Props & SuggestionAnchor & { ref?: Ref<SlashCommandListHandle> }) {
	return (
		<SuggestionPopover {...props}>
			<SlashCommandList {...props} ref={ref} />
		</SuggestionPopover>
	)
}

export type SlashCommandListHandle = {
	onKeyDown: (event: KeyboardEvent) => boolean
}

export function SlashCommandList({ items, command, ref }: Props & { ref?: Ref<SlashCommandListHandle> }) {
	const [selectedIndex, setSelectedIndex] = useState(0)
	// A new result list restarts the highlight at the top.
	const [syncedItems, setSyncedItems] = useState(items)
	if (items !== syncedItems) {
		setSyncedItems(items)
		setSelectedIndex(0)
	}

	const listId = useId()
	const optionId = (index: number) => `${listId}-${index}`
	useSuggestionAccessibility(listId, items.length > 0 ? optionId(selectedIndex) : null)

	useImperativeHandle(ref, () => ({
		onKeyDown(event) {
			if (event.isComposing) return false
			if (items.length === 0) return ['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)
			if (event.key === 'ArrowDown') {
				setSelectedIndex((i) => (i + 1) % items.length)
				return true
			}
			if (event.key === 'ArrowUp') {
				setSelectedIndex((i) => (i - 1 + items.length) % items.length)
				return true
			}
			if (event.key === 'Enter') {
				const item = items[selectedIndex]
				if (item) command(item)
				return true
			}
			return false
		}
	}))

	return (
		<div
			className="flex w-72 max-w-full flex-col overflow-hidden rounded-md border border-medium bg-overlay shadow-overlay"
			style={{ maxHeight: 'var(--popover-available-height)' }}
		>
			<div id={listId} aria-label="Insert a block" className="max-h-80 min-h-0 overflow-y-auto py-1" role="listbox">
				{items.length === 0 ? (
					<div className="p-3 body-sm text-tertiary" role="status">
						No matches
					</div>
				) : null}
				{items.map((item, index) => {
					// A group header opens each run of consecutive items sharing a group.
					const showHeader = index === 0 || item.group !== items[index - 1].group
					const active = index === selectedIndex
					return (
						<div key={item.id}>
							{showHeader ? (
								<div className="px-3 pt-2 pb-1 label-xs tracking-wider text-tertiary uppercase">{item.group}</div>
							) : null}
							<button
								type="button"
								role="option"
								id={optionId(index)}
								tabIndex={-1}
								aria-selected={active}
								onMouseMove={() => setSelectedIndex(index)}
								onClick={() => command(item)}
								onMouseDown={(event) => {
									event.preventDefault()
								}}
								className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition-colors hover:bg-hover-row aria-selected:bg-hover-row"
							>
								<span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-medium bg-page mono-sm text-secondary">
									{item.icon}
								</span>
								<span className="flex min-w-0 flex-1 flex-col">
									<span className="truncate label-md text-primary">{item.title}</span>
									<span className="truncate body-sm text-tertiary">{item.description}</span>
								</span>
							</button>
						</div>
					)
				})}
			</div>
			<div className="flex shrink-0 items-center justify-between gap-2 border-t border-medium px-3 py-1.5 body-xs text-tertiary">
				<span>
					<kbd className="rounded-sm border border-medium px-1">↑</kbd>{' '}
					<kbd className="rounded-sm border border-medium px-1">↓</kbd> nav
				</span>
				<span>
					<kbd className="rounded-sm border border-medium px-1">↵</kbd> insert{' '}
					<kbd className="ml-1 rounded-sm border border-medium px-1">esc</kbd> dismiss
				</span>
			</div>
		</div>
	)
}
