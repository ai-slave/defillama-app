import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useUpdateSessionTitle } from '~/containers/LlamaAI/hooks/useUpdateSessionTitle'
import { Button } from '~/ui/Button'
import { keepFocus } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { inputStyles } from '~/ui/Input'
import { RelativeTime } from '~/ui/RelativeTime'
import { Tooltip } from '~/ui/Tooltip'
import { getErrorMessage } from '~/utils/error'
import type { ProjectChatSession } from './types'

export function ProjectSessionItem({
	session: s,
	projectId,
	onSelect,
	onDelete
}: {
	session: ProjectChatSession
	projectId: string
	onSelect: () => void
	/** Receives the Delete button, so the confirmation can return focus to it. */
	onDelete: (trigger: HTMLElement) => void
}) {
	const [isRenaming, setIsRenaming] = useState(false)
	const updateTitle = useUpdateSessionTitle()
	const formRef = useRef<HTMLFormElement>(null)
	const renameRef = useRef<HTMLButtonElement>(null)
	const isBusy = updateTitle.isPending
	// The last failed save, not the mutation's error: that one clears as soon as a retry starts.
	const [renameError, setRenameError] = useState<string | null>(null)
	// The rename form leaves with focus; the Rename button that opened it takes it back.
	const closeRename = () =>
		keepFocus(
			() => setIsRenaming(false),
			() => renameRef.current
		)
	const handleRenameSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		if (updateTitle.isPending) return
		const title = (event.currentTarget.elements.namedItem('newTitle') as HTMLInputElement).value.trim()
		if (!title) return
		if (title === s.title) {
			closeRename()
			return
		}
		try {
			await updateTitle.mutateAsync({ sessionId: s.sessionId, title, projectId })
			closeRename()
		} catch (error) {
			if (formRef.current?.isConnected) setRenameError(getErrorMessage(error))
			else toast.error(getErrorMessage(error))
		}
	}
	if (isRenaming) {
		return (
			<li key={s.sessionId}>
				<form
					ref={formRef}
					onSubmit={handleRenameSubmit}
					className="group/row -mx-2 flex min-h-11 w-[calc(100%+1rem)] items-center gap-1 rounded-md bg-hover-row px-1 py-0.5 sm:min-h-9"
				>
					<input
						type="text"
						name="newTitle"
						aria-label="Session title"
						defaultValue={s.title}
						autoFocus
						readOnly={isBusy}
						onFocus={(e) => e.currentTarget.select()}
						onKeyDown={(e) => {
							if (e.key === 'Escape' && !isBusy) {
								e.preventDefault()
								closeRename()
							}
						}}
						className={`${inputStyles} min-w-0 flex-1`}
					/>
					<Button
						size="md"
						variant="primary"
						type="submit"
						pendingLabel={updateTitle.isPending ? 'Saving…' : null}
						aria-label={updateTitle.isPending ? undefined : 'Save title'}
					>
						Save
					</Button>
					<Tooltip
						content="Cancel rename"
						render={
							<Button
								type="button"
								size="md"
								variant="ghost"
								square
								onClick={() => closeRename()}
								disabled={isBusy}
								aria-label="Cancel rename"
							/>
						}
					>
						<Icon name="x" height={16} width={16} />
					</Tooltip>
				</form>
				{renameError ? (
					<p role="alert" className="mt-1 body-sm text-error">
						{renameError} Edit the title or retry saving.
					</p>
				) : null}
			</li>
		)
	}
	return (
		<li key={s.sessionId}>
			<div className="group/row relative -mx-2 flex w-[calc(100%+1rem)] items-center gap-1 rounded-md pr-1 body-md text-primary focus-within:bg-hover-row hover:bg-hover-row">
				<button
					type="button"
					onClick={() => onSelect()}
					disabled={isBusy}
					className="flex min-h-11 min-w-0 flex-1 items-center gap-1.5 px-2 py-1.5 text-left disabled:text-disabled sm:min-h-9"
				>
					{s.hasUnseenCompletion ? (
						<Tooltip
							content="New response ready"
							render={<span aria-label="Unseen completion" />}
							className="size-1.5 shrink-0 rounded-full bg-brand"
						>
							{null}
						</Tooltip>
					) : null}
					<span className="min-w-0 flex-1 truncate">{s.title || 'Untitled chat'}</span>
				</button>
				<RelativeTime
					value={s.lastActivity ?? s.createdAt}
					className="shrink-0 body-sm text-tertiary tabular-nums group-focus-within/row:hidden group-hover/row:hidden max-sm:hidden"
				/>
				{/* Collapsed, not hidden, until the row is hovered or focused: a hidden button cannot take focus back from
				    the rename form or the delete confirmation. */}
				<div className="flex shrink-0 items-center gap-0.5 overflow-hidden sm:w-0 sm:group-focus-within/row:w-auto sm:group-hover/row:w-auto">
					<Tooltip
						content="Rename chat"
						render={
							<Button
								type="button"
								size="md"
								variant="ghost"
								square
								ref={renameRef}
								aria-label={`Rename ${s.title || 'chat'}`}
								disabled={isBusy}
								onClick={(e) => {
									e.stopPropagation()
									setRenameError(null)
									setIsRenaming(true)
								}}
							/>
						}
					>
						<Icon name="pencil" height={16} width={16} />
					</Tooltip>
					<Tooltip
						content="Delete chat"
						render={
							<Button
								type="button"
								size="md"
								variant="ghost"
								square
								aria-label={`Delete ${s.title || 'chat'}`}
								disabled={isBusy}
								onClick={(e) => {
									e.stopPropagation()
									onDelete(e.currentTarget)
								}}
							/>
						}
					>
						<Icon name="trash-2" height={16} width={16} className="text-error" />
					</Tooltip>
				</div>
			</div>
		</li>
	)
}
