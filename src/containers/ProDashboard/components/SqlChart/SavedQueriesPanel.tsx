import * as Ariakit from '@ariakit/react'
import { useState } from 'react'
import type { QuerySavedConfig } from '~/containers/Downloads/savedDownloads'
import { useSavedDownloads } from '~/contexts/LocalStorage'
import { Button } from '~/ui/Button'
import { focusNeighborOnLeave } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { BusyGlyph, EmptyState } from '~/ui/Status'
import { Tooltip } from '~/ui/Tooltip'

interface SavedQueriesPanelProps {
	queries: Array<QuerySavedConfig>
	busyTaskId: string | null
	onApply: (query: QuerySavedConfig) => void
}

export function SavedQueriesPanel({ queries, busyTaskId, onApply }: SavedQueriesPanelProps) {
	const { renameDownload, deleteDownload } = useSavedDownloads()
	const [renamingId, setRenamingId] = useState<string | null>(null)

	if (queries.length === 0) {
		return (
			<EmptyState size="md" icon="bookmark" title="No saved queries yet">
				Saving a SQL card stores its query here — reusable on any dashboard and in SQL Studio.
			</EmptyState>
		)
	}

	return (
		<ul className="flex flex-col border-t border-subtle">
			{queries.map((query) => {
				const taskId = `saved:${query.id}`
				const isBusy = busyTaskId === taskId
				const isDisabled = !!busyTaskId && !isBusy
				const isRenaming = renamingId === query.id
				const firstLine = query.sql.split('\n').find((line) => line.trim()) ?? ''
				return (
					<li
						key={query.id}
						data-row
						// A tap focuses the row, which reveals its actions on screens that cannot hover.
						tabIndex={-1}
						className={`group/row flex items-center gap-1 border-b border-subtle last:border-b-0 ${
							isDisabled ? 'opacity-60' : ''
						}`}
					>
						{isRenaming ? (
							<span className="flex min-w-0 flex-1 flex-col gap-0.5 py-2">
								<InlineRenameInput
									initial={query.name}
									onCommit={(next) => {
										const trimmed = next.trim()
										if (trimmed && trimmed !== query.name) renameDownload(query.id, trimmed)
										setRenamingId(null)
									}}
									onCancel={() => setRenamingId(null)}
								/>
								<span className="truncate mono-sm text-tertiary">{firstLine}</span>
							</span>
						) : (
							<Tooltip
								content={<span className="mono-sm whitespace-pre-wrap">{query.sql}</span>}
								data-fullwidth
								render={
									<Ariakit.Button
										type="button"
										onClick={() => onApply(query)}
										disabled={isDisabled || isBusy}
										accessibleWhenDisabled
										aria-busy={isBusy}
									/>
								}
								className="group/apply min-w-0 flex-1 py-2 text-left aria-disabled:cursor-not-allowed"
							>
								<span className="flex w-full min-w-0 flex-col gap-0.5">
									<span className="flex items-center gap-2">
										{isBusy ? <BusyGlyph decorative size={12} /> : null}
										<span
											className={`truncate body-sm transition-colors ${
												isBusy ? 'text-link' : 'text-primary group-hover/apply:text-link'
											}`}
										>
											{query.name}
										</span>
									</span>
									<span className="truncate mono-sm text-tertiary">{firstLine}</span>
								</span>
							</Tooltip>
						)}
						<span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-focus-within/row:opacity-100 group-hover/row:opacity-100 pointer-coarse:opacity-100">
							<Tooltip
								content="Rename"
								render={
									<Button
										variant="ghost"
										size="sm"
										square
										onClick={() => setRenamingId(query.id)}
										aria-label={`Rename ${query.name}`}
										disabled={!!busyTaskId || isRenaming}
										accessibleWhenDisabled
									/>
								}
							>
								<Icon name="pencil" className="size-4" />
							</Tooltip>
							<Tooltip
								content="Delete"
								render={
									<Button
										variant="ghostDestructive"
										size="sm"
										square
										ref={focusNeighborOnLeave()}
										onClick={() => deleteDownload(query.id)}
										aria-label={`Delete ${query.name}`}
										disabled={!!busyTaskId}
										accessibleWhenDisabled
									/>
								}
							>
								<Icon name="trash-2" className="size-4" />
							</Tooltip>
						</span>
					</li>
				)
			})}
		</ul>
	)
}

// Module scope keeps the ref callback's identity stable, so it runs when the input attaches, not on every keystroke.
function focusAndSelect(input: HTMLInputElement | null) {
	input?.focus()
	input?.select()
}

function InlineRenameInput({
	initial,
	onCommit,
	onCancel
}: {
	initial: string
	onCommit: (value: string) => void
	onCancel: () => void
}) {
	const [value, setValue] = useState(initial)

	return (
		<Input
			variant="inline"
			ref={focusAndSelect}
			aria-label="Saved query name"
			value={value}
			onChange={(e) => setValue(e.target.value)}
			onKeyDown={(e) => {
				if (e.key === 'Enter') {
					e.preventDefault()
					onCommit(value)
				} else if (e.key === 'Escape') {
					e.preventDefault()
					onCancel()
				}
				e.stopPropagation()
			}}
			onBlur={() => onCommit(value)}
			onClick={(e) => e.stopPropagation()}
		/>
	)
}
