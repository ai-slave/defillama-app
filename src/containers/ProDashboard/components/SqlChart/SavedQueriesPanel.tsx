import * as Ariakit from '@ariakit/react'
import { useRef, useState } from 'react'
import type { QuerySavedConfig } from '~/containers/Downloads/savedDownloads'
import { useSavedDownloads } from '~/contexts/LocalStorage'
import { Button } from '~/ui/Button'
import { focusNeighborOnLeave, keepFocus } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { InlineRenameInput } from '~/ui/InlineTextField'
import { ListRow } from '~/ui/ListRow'
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
	const renamingRowRef = useRef<HTMLLIElement>(null)
	// Enter and Escape remove the field; focus goes to the query's own button, which takes the field's place. The row is
	// read first: the commit detaches the ref.
	const finishFromKeyboard = (commit: () => void) => {
		const row = renamingRowRef.current
		keepFocus(commit, () => row?.querySelector('button'))
	}

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
						ref={isRenaming ? renamingRowRef : undefined}
						data-row
						// A tap focuses the row, which reveals its actions on screens that cannot hover.
						tabIndex={-1}
						className={`group/row flex items-center gap-1 border-b border-subtle last:border-b-0 ${
							isDisabled ? 'opacity-60' : ''
						}`}
					>
						{isRenaming ? (
							<span className="flex min-w-0 flex-1 flex-col gap-0.5 px-3 py-2">
								<InlineRenameInput
									initial={query.name}
									label="Saved query name"
									onCommit={(next, fromKeyboard) => {
										const trimmed = next.trim()
										const commit = () => {
											if (trimmed && trimmed !== query.name) renameDownload(query.id, trimmed)
											setRenamingId(null)
										}
										if (fromKeyboard) finishFromKeyboard(commit)
										else commit()
									}}
									onCancel={() => finishFromKeyboard(() => setRenamingId(null))}
								/>
								<span className="truncate mono-sm text-tertiary">{firstLine}</span>
							</span>
						) : (
							<Tooltip
								content={<span className="mono-sm whitespace-pre-wrap">{query.sql}</span>}
								data-fullwidth
								render={
									<ListRow
										as={Ariakit.Button}
										onClick={() => onApply(query)}
										disabled={isDisabled || isBusy}
										accessibleWhenDisabled
										aria-busy={isBusy}
										className="group/apply flex-1"
									/>
								}
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
