import { useEffect, useRef, useState } from 'react'
import type { QuerySavedConfig } from '~/containers/Downloads/savedDownloads'
import { useSavedDownloads } from '~/contexts/LocalStorage'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import { Tooltip } from '~/ui/Tooltip'

interface SavedQueriesPanelProps {
	queries: QuerySavedConfig[]
	busyTaskId: string | null
	onApply: (query: QuerySavedConfig) => void
}

export function SavedQueriesPanel({ queries, busyTaskId, onApply }: SavedQueriesPanelProps) {
	const { renameDownload, deleteDownload } = useSavedDownloads()
	const [renamingId, setRenamingId] = useState<string | null>(null)

	if (queries.length === 0) {
		return (
			<div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-subtle px-4 py-8 text-center">
				<Icon name="bookmark" className="size-4 text-tertiary" />
				<p className="text-xs text-secondary">No saved queries yet.</p>
				<p className="body-sm text-tertiary">
					Saving a SQL widget stores its query here — reusable on any dashboard and in SQL Studio.
				</p>
			</div>
		)
	}

	return (
		<ul className="flex flex-col border-t border-(--border-subtle)/60">
			{queries.map((query) => {
				const taskId = `saved:${query.id}`
				const isBusy = busyTaskId === taskId
				const isDisabled = !!busyTaskId && !isBusy
				const isRenaming = renamingId === query.id
				const firstLine = query.sql.split('\n').find((line) => line.trim()) ?? ''
				return (
					<li
						key={query.id}
						className={`group flex items-center gap-1 border-b border-(--border-subtle)/40 last:border-b-0 ${
							isDisabled ? 'opacity-40' : ''
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
									<button
										type="button"
										onClick={() => onApply(query)}
										disabled={isDisabled || isBusy}
										aria-busy={isBusy}
									/>
								}
								className="group/apply min-w-0 flex-1 py-2 text-left disabled:cursor-not-allowed"
							>
								<span className="flex w-full min-w-0 flex-col gap-0.5">
									<span className="flex items-center gap-2">
										{isBusy ? <LoadingSpinner size={10} /> : null}
										<span
											className={`truncate body-sm transition-colors ${
												isBusy ? 'text-brand' : 'text-primary group-hover/apply:text-brand'
											}`}
										>
											{query.name}
										</span>
									</span>
									<span className="truncate mono-sm text-tertiary">{firstLine}</span>
								</span>
							</Tooltip>
						)}
						<span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
							<button
								type="button"
								onClick={() => setRenamingId(query.id)}
								aria-label={`Rename ${query.name}`}
								disabled={!!busyTaskId || isRenaming}
								className="flex size-6 items-center justify-center rounded-md text-tertiary transition-colors hover:bg-hover-row hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
							>
								<Icon name="pencil" className="size-3" />
							</button>
							<button
								type="button"
								onClick={() => deleteDownload(query.id)}
								aria-label={`Delete ${query.name}`}
								disabled={!!busyTaskId}
								className="flex size-6 items-center justify-center rounded-md text-tertiary transition-colors hover:bg-error/10 hover:text-error disabled:cursor-not-allowed disabled:opacity-40"
							>
								<Icon name="trash-2" className="size-3" />
							</button>
						</span>
					</li>
				)
			})}
		</ul>
	)
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
	const inputRef = useRef<HTMLInputElement | null>(null)

	useEffect(() => {
		inputRef.current?.focus()
		inputRef.current?.select()
	}, [])

	return (
		<input
			ref={inputRef}
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
			className="min-w-0 rounded-sm bg-page px-1 py-px label-sm text-primary ring-1 ring-brand outline-hidden"
		/>
	)
}
