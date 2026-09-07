import * as Ariakit from '@ariakit/react'
import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useUpdateSessionTitle } from '~/containers/LlamaAI/hooks/useUpdateSessionTitle'
import { Icon } from '~/ui/Icon'
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
					className="group/row -mx-2 flex w-[calc(100%+1rem)] items-center gap-1 rounded-lg bg-ai-surface-muted px-2 py-1"
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
						className="min-w-0 flex-1 bg-transparent p-1 text-[13px] text-inherit focus:outline-hidden"
					/>
					<Ariakit.Button
						accessibleWhenDisabled
						type="submit"
						disabled={isBusy}
						className="flex min-h-7 items-center justify-center gap-1 rounded-md bg-brand px-2 text-ai-white disabled:opacity-60"
						aria-label={updateTitle.isPending ? 'Saving title' : 'Save title'}
					>
						{updateTitle.isPending ? <LoadingSpinner size={12} /> : null}
						{updateTitle.isPending ? 'Saving…' : 'Save'}
					</Ariakit.Button>
					<button
						type="button"
						onClick={() => closeRename()}
						disabled={isBusy}
						className="flex size-7 items-center justify-center rounded-md bg-ai-error-vivid/15 text-ai-error disabled:opacity-60"
						aria-label="Cancel rename"
					>
						<Icon name="x" height={13} width={13} />
					</button>
				</form>
				{updateTitle.error ? (
					<p role="alert" className="mt-1 text-xs text-ai-error">
						{updateTitle.error.message} Edit the title or retry saving.
					</p>
				) : null}
			</li>
		)
	}
	return (
		<li key={s.sessionId}>
			<div className="group/row relative -mx-2 flex w-[calc(100%+1rem)] items-center gap-1 rounded-lg pr-1 transition-colors focus-within:bg-ai-surface-muted hover:bg-ai-surface-muted">
				<button
					type="button"
					onClick={() => onSelect()}
					disabled={isBusy}
					className="flex min-w-0 flex-1 items-center gap-1.5 p-2 text-left disabled:opacity-60"
				>
					{s.hasUnseenCompletion ? (
						<Tooltip content="New response ready">
							<span className="size-1.5 shrink-0 rounded-full bg-brand" aria-label="Unseen completion" />
						</Tooltip>
					) : null}
					<span className="min-w-0 flex-1 truncate text-[13px]">{s.title || 'Untitled chat'}</span>
				</button>
				<RelativeTime
					value={s.lastActivity ?? s.createdAt}
					className="shrink-0 text-xs text-ai-muted tabular-nums group-focus-within/row:hidden group-hover/row:hidden max-sm:hidden"
				/>
				<div className="hidden shrink-0 items-center gap-0.5 group-focus-within/row:flex group-hover/row:flex max-sm:flex">
					<Tooltip
						content="Rename chat"
						render={
							<button
								type="button"
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
						className="flex size-7 items-center justify-center rounded-md text-ai-muted transition-colors hover:bg-brand hover:text-ai-white focus-visible:bg-brand focus-visible:text-ai-white disabled:opacity-50"
					>
						<Icon name="pencil" height={13} width={13} />
					</Tooltip>
					<Tooltip
						content="Delete chat"
						render={
							<button
								type="button"
								aria-label={`Delete ${s.title || 'chat'}`}
								disabled={isBusy}
								onClick={(e) => {
									e.stopPropagation()
									onDelete()
								}}
							/>
						}
						className="flex size-7 items-center justify-center rounded-md text-ai-muted transition-colors hover:bg-ai-error-vivid/10 hover:text-ai-error focus-visible:bg-ai-error-vivid/10 focus-visible:text-ai-error disabled:opacity-50"
					>
						{isDeleting ? <LoadingSpinner size={12} /> : <Icon name="trash-2" height={13} width={13} />}
					</Tooltip>
				</div>
			</div>
		</li>
	)
}
