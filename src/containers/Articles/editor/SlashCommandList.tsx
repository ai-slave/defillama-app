import { forwardRef, useImperativeHandle, useState } from 'react'
import type { SlashCommandItem } from './slashCommand'

type Props = {
	items: Array<SlashCommandItem>
	command: (item: SlashCommandItem) => void
}

export type SlashCommandListHandle = {
	onKeyDown: (event: KeyboardEvent) => boolean
}

export const SlashCommandList = forwardRef<SlashCommandListHandle, Props>(function SlashCommandList(
	{ items, command },
	ref
) {
	const [selectedIndex, setSelectedIndex] = useState(0)
	// A new result list restarts the highlight at the top.
	const [syncedItems, setSyncedItems] = useState(items)
	if (items !== syncedItems) {
		setSyncedItems(items)
		setSelectedIndex(0)
	}

	useImperativeHandle(ref, () => ({
		onKeyDown(event) {
			if (items.length === 0) return false
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

	if (items.length === 0) {
		return (
			<div className="w-72 rounded-md border border-medium bg-surface p-3 text-xs text-tertiary shadow-xl">
				No matches
			</div>
		)
	}

	return (
		<div className="w-72 overflow-hidden rounded-md border border-medium bg-surface shadow-xl">
			<div className="max-h-80 overflow-y-auto py-1" role="listbox">
				{items.map((item, index) => {
					// A group header opens each run of consecutive items sharing a group.
					const showHeader = index === 0 || item.group !== items[index - 1].group
					const active = index === selectedIndex
					return (
						<div key={item.id}>
							{showHeader ? (
								<div className="px-3 pt-2 pb-1 text-[9px] font-medium tracking-wider text-tertiary uppercase">
									{item.group}
								</div>
							) : null}
							<button
								type="button"
								role="option"
								aria-selected={active}
								onMouseEnter={() => setSelectedIndex(index)}
								onMouseDown={(event) => {
									event.preventDefault()
									command(item)
								}}
								className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition-colors ${
									active ? 'bg-research-tint' : 'hover:bg-research-tint-hover'
								}`}
							>
								<span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-medium bg-page font-jetbrains text-[11px] text-secondary">
									{item.icon}
								</span>
								<span className="flex min-w-0 flex-1 flex-col">
									<span className="truncate text-sm text-primary">{item.title}</span>
									<span className="truncate text-[11px] text-tertiary">{item.description}</span>
								</span>
							</button>
						</div>
					)
				})}
			</div>
			<div className="flex items-center justify-between gap-2 border-t border-medium px-3 py-1.5 text-[10px] text-tertiary">
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
})
