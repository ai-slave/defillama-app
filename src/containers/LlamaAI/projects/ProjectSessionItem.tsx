import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useUpdateSessionTitle } from '~/containers/LlamaAI/hooks/useUpdateSessionTitle'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { inputStyles } from '~/ui/Input'
import { LoadingSpinner } from '~/ui/Loaders'
import { RelativeTime } from '~/ui/RelativeTime'
import { Tooltip } from '~/ui/Tooltip'
import { getErrorMessage } from '~/utils/error'
import type { ProjectChatSession } from './types'

export function ProjectSessionItem({
	session: s,
	projectId,
	onSelect,
	onDelete,
	isDeleting
}: {
	session: ProjectChatSession
	projectId: string
	onSelect: () => void
	onDelete: () => void
	isDeleting: boolean
}) {
	const [isRenaming, setIsRenaming] = useState(false)
	const updateTitle = useUpdateSessionTitle()
	const formRef = useRef<HTMLFormElement>(null)
	const renameRef = useRef<HTMLButtonElement>(null)
	const isBusy = isDeleting || updateTitle.isPending
	const closeRename = () => {
		const restoreFocus = formRef.current?.contains(document.activeElement)
		setIsRenaming(false)
		if (restoreFocus) requestAnimationFrame(() => renameRef.current?.focus())
	}
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
			if (!formRef.current?.isConnected) toast.error(getErrorMessage(error))
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
						disabled={isBusy}
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
						accessibleWhenDisabled
						type="submit"
						disabled={isBusy}
						aria-label={updateTitle.isPending ? 'Saving title' : 'Save title'}
					>
						{updateTitle.isPending ? <LoadingSpinner size={14} /> : null}
						{updateTitle.isPending ? 'Saving…' : 'Save'}
					</Button>
					<Button
						type="button"
						size="md"
						variant="ghost"
						square
						onClick={() => closeRename()}
						disabled={isBusy}
						aria-label="Cancel rename"
					>
						<Icon name="x" height={16} width={16} />
					</Button>
				</form>
				{updateTitle.error ? (
					<p role="alert" className="mt-1 body-sm text-error">
						{updateTitle.error.message} Edit the title or retry saving.
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
					className="flex min-h-11 min-w-0 flex-1 items-center gap-1.5 px-2 py-1.5 text-left disabled:opacity-60 sm:min-h-9"
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
				<div className="hidden shrink-0 items-center gap-0.5 group-focus-within/row:flex group-hover/row:flex max-sm:flex">
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
									updateTitle.reset()
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
									onDelete()
								}}
							/>
						}
					>
						{isDeleting ? (
							<LoadingSpinner size={16} />
						) : (
							<Icon name="trash-2" height={16} width={16} className="text-error" />
						)}
					</Tooltip>
				</div>
			</div>
		</li>
	)
}
