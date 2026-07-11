import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import type { SlashCommandItem } from './slashCommand'

type Props = {
	items: SlashCommandItem[]
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

	useEffect(() => {
		setSelectedIndex(0)
	}, [items])

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
			<div className="w-72 rounded-md border border-(--legacy-cards-border) bg-(--legacy-cards-bg) p-3 text-xs text-(--legacy-text-tertiary) shadow-xl">
				No matches
			</div>
		)
	}

	let lastGroup: string | undefined
	return (
		<div className="w-72 overflow-hidden rounded-md border border-(--legacy-cards-border) bg-(--legacy-cards-bg) shadow-xl">
			<div className="max-h-80 overflow-y-auto py-1" role="listbox">
				{items.map((item, index) => {
					const showHeader = item.group !== lastGroup
					lastGroup = item.group
					const active = index === selectedIndex
					return (
						<div key={item.id}>
							{showHeader ? (
								<div className="px-3 pt-2 pb-1 text-[9px] font-medium tracking-wider text-(--legacy-text-tertiary) uppercase">
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
									active ? 'bg-(--legacy-link-button)' : 'hover:bg-(--legacy-link-hover-bg)'
								}`}
							>
								<span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-(--legacy-cards-border) bg-(--legacy-app-bg) font-jetbrains text-[11px] text-(--legacy-text-secondary)">
									{item.icon}
								</span>
								<span className="flex min-w-0 flex-1 flex-col">
									<span className="truncate text-sm text-(--legacy-text-primary)">{item.title}</span>
									<span className="truncate text-[11px] text-(--legacy-text-tertiary)">{item.description}</span>
								</span>
							</button>
						</div>
					)
				})}
			</div>
			<div className="flex items-center justify-between gap-2 border-t border-(--legacy-cards-border) px-3 py-1.5 text-[10px] text-(--legacy-text-tertiary)">
				<span>
					<kbd className="rounded-sm border border-(--legacy-cards-border) px-1">↑</kbd>{' '}
					<kbd className="rounded-sm border border-(--legacy-cards-border) px-1">↓</kbd> nav
				</span>
				<span>
					<kbd className="rounded-sm border border-(--legacy-cards-border) px-1">↵</kbd> insert{' '}
					<kbd className="ml-1 rounded-sm border border-(--legacy-cards-border) px-1">esc</kbd> dismiss
				</span>
			</div>
		</div>
	)
})
