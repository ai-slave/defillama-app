import * as Ariakit from '@ariakit/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { memo, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { AI_SERVER } from '~/constants'
import { llamaAIRequest } from '~/containers/LlamaAI/api/transport'
import { useLlamaAIChrome } from '~/containers/LlamaAI/chrome'
import { DeleteSessionDialog } from '~/containers/LlamaAI/components/DeleteSessionDialog'
import {
	findSessionInInfiniteData,
	updateSessionInInfiniteData,
	type SessionListInfiniteData
} from '~/containers/LlamaAI/hooks/sessionListCache'
import { SESSION_WRITE_KEY, useInvalidateSessionWrites } from '~/containers/LlamaAI/hooks/sessionMutationCache'
import { withSessionWriteScope } from '~/containers/LlamaAI/hooks/sessionWriteScope'
import { useClearUnseenCompletion } from '~/containers/LlamaAI/hooks/useClearUnseenCompletion'
import { SESSIONS_QUERY_KEY } from '~/containers/LlamaAI/hooks/useSessionList'
import { useUpdateSessionTitle } from '~/containers/LlamaAI/hooks/useUpdateSessionTitle'
import { MoveToProjectMenuItem } from '~/containers/LlamaAI/projects/MoveToProjectMenu'
import type { ChatSession } from '~/containers/LlamaAI/types'
import { assertResponse } from '~/containers/LlamaAI/utils/assertResponse'
import { ConfirmActionDialog } from '~/ui/ConfirmActionDialog'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import { Tooltip } from '~/ui/Tooltip'
import { trackUmamiEvent } from '~/utils/analytics/umami'
import { getErrorMessage } from '~/utils/error'

interface AgenticSessionItemProps {
	session: ChatSession
	isActive: boolean
	onSessionSelect: (sessionId: string) => void
	onDelete: (sessionId: string, projectId?: string | null) => Promise<void>
	isRestoring: boolean
	style?: React.CSSProperties
	selectMode?: boolean
	isSelected?: boolean
	onToggleSelect?: (sessionId: string) => void
}

// Rendered from a list in the projects sidebar, where the compiler caches the row callback rather than
// each row, so memo is what keeps untouched sessions from re-rendering.
export const AgenticSessionItem = memo(function AgenticSessionItem({
	session,
	isActive,
	onSessionSelect,
	onDelete,
	isRestoring,
	style,
	selectMode,
	isSelected,
	onToggleSelect
}: AgenticSessionItemProps) {
	const { user, authorizedFetch } = useAuthContext()
	const { hideSidebar } = useLlamaAIChrome()
	const queryClient = useQueryClient()
	const clearUnseenCompletion = useClearUnseenCompletion()

	const [isEditing, setIsEditing] = useState(false)
	const formRef = useRef<HTMLFormElement>(null)
	const renameRef = useRef<HTMLButtonElement>(null)
	const closeRename = () => {
		const restoreFocus = formRef.current?.contains(document.activeElement)
		setIsEditing(false)
		if (restoreFocus) requestAnimationFrame(() => renameRef.current?.focus())
	}
	const [confirmPrivate, setConfirmPrivate] = useState(false)
	const menuContentRef = useRef<HTMLDivElement>(null)
	const deleteStore = Ariakit.useDialogStore()
	const menuRef = useRef<HTMLButtonElement>(null)

	const copyLink = useMutation({
		mutationFn: () => navigator.clipboard.writeText(`${window.location.origin}/ai/chat/shared/${session.shareToken}`),
		onSuccess: () => trackUmamiEvent('llamaai-session-share'),
		onError: () => {
			if (!menuContentRef.current?.isConnected) toast.error('Failed to copy link')
		}
	})
	// Fast consecutive copies can batch away the pending render; each attempt needs a fresh timer.
	const successfulCopyAttempt = copyLink.isSuccess ? copyLink.submittedAt : null
	useEffect(() => {
		if (successfulCopyAttempt === null) return
		const timer = setTimeout(copyLink.reset, 2000)
		return () => clearTimeout(timer)
	}, [successfulCopyAttempt, copyLink.reset])

	const visibility = useMutation({
		mutationFn: async () => {
			const response = assertResponse(
				await authorizedFetch(`${AI_SERVER}/user/sessions/${session.sessionId}/share`, {
					method: 'PUT'
				}),
				'Failed to update session visibility'
			)
			return response.json()
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: [SESSIONS_QUERY_KEY] }),
		onError: () => {
			if (!session.isPublic && !menuContentRef.current?.isConnected) toast.error('Failed to make session public')
			void queryClient.invalidateQueries({ queryKey: [SESSIONS_QUERY_KEY] })
		}
	})

	const updateTitle = useUpdateSessionTitle()
	// The parent also clears queue and prompt-failure state; each row owns its pending feedback.
	const deletion = useMutation({
		mutationFn: () => onDelete(session.sessionId, session.projectId),
		onError: (error) => {
			if (!deleteStore.getState().contentElement?.isConnected) toast.error(error.message)
		}
	})

	const invalidateSessionWrites = useInvalidateSessionWrites()
	const sessionsKey = [SESSIONS_QUERY_KEY, user?.id]
	// Keep other rows usable while this session is being pinned.
	const pinSession = useMutation({
		mutationKey: [SESSION_WRITE_KEY, user?.id],
		mutationFn: () =>
			withSessionWriteScope(queryClient, `${user?.id}:${session.sessionId}:pin`, async () => {
				await queryClient.cancelQueries({ queryKey: sessionsKey })
				const previous = findSessionInInfiniteData(
					queryClient.getQueryData<SessionListInfiniteData>(sessionsKey),
					session.sessionId
				)
				queryClient.setQueryData(sessionsKey, (old: SessionListInfiniteData | undefined) =>
					updateSessionInInfiniteData(old, session.sessionId, (current) => ({
						...current,
						isPinned: !current.isPinned,
						pinnedAt: !current.isPinned ? new Date().toISOString() : undefined
					}))
				)
				try {
					await llamaAIRequest(authorizedFetch, `/user/sessions/${session.sessionId}/pin`, { method: 'PUT' })
				} catch (error) {
					if (previous) {
						queryClient.setQueryData(sessionsKey, (old: SessionListInfiniteData | undefined) =>
							updateSessionInInfiniteData(old, session.sessionId, (current) =>
								current.isPinned === !previous.isPinned
									? { ...current, isPinned: previous.isPinned, pinnedAt: previous.pinnedAt }
									: current
							)
						)
					}
					throw new Error(`Failed to toggle pin: ${getErrorMessage(error)}`)
				}
			}),
		onError: (error) => toast.error(error.message),
		onSettled: invalidateSessionWrites
	})

	const handleSessionClick = (sessionId: string) => {
		if (isActive) return
		trackUmamiEvent('llamaai-session-click')
		if (session.hasUnseenCompletion) clearUnseenCompletion(sessionId, session.projectId)
		onSessionSelect(sessionId)
		if (document.documentElement.clientWidth < 1024) {
			hideSidebar()
		}
	}

	const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault()
		const title = (e.currentTarget.elements.namedItem('newTitle') as HTMLInputElement | null)?.value.trim() ?? ''
		if (updateTitle.isPending || !title) return
		if (title === session.title) {
			closeRename()
			return
		}
		try {
			await updateTitle.mutateAsync({ sessionId: session.sessionId, title, projectId: session.projectId })
			closeRename()
		} catch (error) {
			if (!formRef.current?.isConnected) toast.error(getErrorMessage(error))
		}
	}

	const handleDelete = () => {
		if (deletion.isPending) return
		trackUmamiEvent('llamaai-session-delete')
		deletion.mutate(undefined, { onSuccess: () => deleteStore.hide() })
	}

	if (isEditing) {
		return (
			<form
				ref={formRef}
				onSubmit={handleSave}
				className="group relative -mx-1.5 flex flex-wrap items-center gap-0.5 rounded-sm text-xs hover:bg-ai-surface-muted data-[active=true]:bg-brand data-[active=true]:text-ai-white"
				style={style}
			>
				<input
					type="text"
					name="newTitle"
					onKeyDown={(event) => {
						if (event.key === 'Escape' && !updateTitle.isPending) {
							event.preventDefault()
							closeRename()
						}
					}}
					aria-label="Session title"
					defaultValue={session.title}
					autoFocus
					onFocus={(e) => e.currentTarget.select()}
					className="min-w-0 flex-1 truncate p-1.5 text-left text-xs"
					disabled={updateTitle.isPending}
				/>
				<div className="flex items-center justify-center gap-0.5">
					<Ariakit.Button
						accessibleWhenDisabled
						type="submit"
						aria-label={updateTitle.isPending ? 'Saving session title' : 'Save session title'}
						className="flex items-center justify-center gap-1 rounded-sm bg-brand p-1.5 text-ai-white"
						disabled={updateTitle.isPending}
					>
						{updateTitle.isPending ? <LoadingSpinner size={12} /> : null}
						{updateTitle.isPending ? 'Saving…' : 'Save'}
					</Ariakit.Button>
					<button
						type="button"
						aria-label="Cancel session rename"
						onClick={closeRename}
						className="flex aspect-square items-center justify-center rounded-sm bg-ai-error-vivid/20 p-1.5 text-error"
						disabled={updateTitle.isPending}
					>
						<Icon name="x" height={12} width={12} className="shrink-0" />
					</button>
				</div>
				{updateTitle.error ? (
					<p role="alert" className="w-full p-1.5 text-ai-error">
						{updateTitle.error.message} Edit the title or retry saving.
					</p>
				) : null}
			</form>
		)
	}

	if (selectMode) {
		return (
			<label
				className="group relative -mx-1.5 flex w-full cursor-pointer items-center gap-2 rounded-sm p-1.5 text-left text-xs hover:bg-ai-surface-muted"
				style={style}
			>
				<input
					type="checkbox"
					checked={!!isSelected}
					onChange={() => onToggleSelect?.(session.sessionId)}
					className="size-3.5 shrink-0 accent-brand"
				/>
				<span className="flex-1 truncate">{session.title}</span>
			</label>
		)
	}

	return (
		<div
			data-active={isActive}
			className="group relative -mx-1.5 flex items-center rounded-sm text-xs focus-within:bg-ai-surface-muted hover:bg-ai-surface-muted data-[active=true]:bg-brand data-[active=true]:text-ai-white"
			style={style}
		>
			<button
				type="button"
				onClick={(e) => {
					if (e.metaKey || e.ctrlKey) {
						trackUmamiEvent('llamaai-session-click')
						window.open(`/ai/chat/${session.sessionId}`, '_blank')
						return
					}
					handleSessionClick(session.sessionId)
				}}
				disabled={isEditing || deletion.isPending || isRestoring}
				className="flex flex-1 items-center gap-1 overflow-hidden p-1.5 text-left aria-disabled:pointer-events-none aria-disabled:opacity-60"
			>
				{session.isPinned ? <Icon name="pin" height={10} width={10} className="shrink-0 opacity-40" /> : null}
				{session.hasUnseenCompletion ? (
					<Tooltip content="New response ready">
						<span className="size-1.5 shrink-0 rounded-full bg-brand" aria-label="Unseen completion" />
					</Tooltip>
				) : null}
				<span className="truncate">{session.title}</span>
			</button>
			<div className="flex items-center justify-center opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
				<Tooltip
					content="Edit Session Title"
					render={
						<button
							type="button"
							ref={renameRef}
							aria-label={`Rename ${session.title}`}
							onClick={() => {
								updateTitle.reset()
								setIsEditing(true)
							}}
							disabled={updateTitle.isPending || deletion.isPending || isRestoring}
						/>
					}
					className="flex aspect-square items-center justify-center rounded-sm p-1.5 hover:bg-brand hover:text-ai-white focus-visible:bg-brand focus-visible:text-ai-white"
				>
					<Icon name="pencil" height={12} width={12} className="shrink-0" />
				</Tooltip>
				<Ariakit.MenuProvider>
					<Ariakit.MenuButton
						ref={menuRef}
						aria-label={`Actions for ${session.title}`}
						className="flex aspect-square items-center justify-center rounded-sm p-1.5 hover:bg-brand hover:text-ai-white focus-visible:bg-brand focus-visible:text-ai-white"
					>
						<Icon name="ellipsis" height={12} width={12} className="shrink-0" />
						<span className="sr-only">Open menu</span>
					</Ariakit.MenuButton>
					<Ariakit.Menu
						ref={menuContentRef}
						portal
						unmountOnHide
						hideOnInteractOutside
						gutter={8}
						wrapperProps={{
							className: 'max-sm:fixed! max-sm:bottom-0! max-sm:top-[unset]! max-sm:transform-none! max-sm:w-full!'
						}}
						className="z-50 flex min-w-[180px] flex-col overflow-auto overscroll-contain rounded-md border border-ai-line bg-surface text-primary max-sm:h-[calc(100dvh-80px)] max-sm:drawer max-sm:rounded-b-none sm:max-h-[min(400px,60dvh)] sm:max-w-md lg:max-h-(--popover-available-height)"
					>
						<Ariakit.PopoverDismiss aria-label="Close session menu" className="ml-auto p-2 opacity-50 sm:hidden">
							<Icon name="x" className="size-5" />
						</Ariakit.PopoverDismiss>
						<Ariakit.MenuItem
							disabled={pinSession.isPending}
							onClick={() => {
								pinSession.mutate()
							}}
							className="flex shrink-0 cursor-pointer items-center gap-2 truncate border-b border-medium px-3 py-2 cv-auto-37 first-of-type:rounded-t-md last-of-type:rounded-b-md hover:bg-brand-muted focus-visible:bg-brand-muted data-active-item:bg-brand-muted"
						>
							<Icon name="pin" height={14} width={14} className="shrink-0" />
							{session.isPinned ? 'Unpin' : 'Pin to Top'}
						</Ariakit.MenuItem>
						<Ariakit.MenuItem
							onClick={() => {
								copyLink.mutate()
							}}
							hideOnClick={false}
							disabled={!session.isPublic || !session.shareToken || visibility.isPending || copyLink.isPending}
							className="flex shrink-0 cursor-pointer items-center gap-2 truncate border-b border-medium px-3 py-2 cv-auto-37 first-of-type:rounded-t-md last-of-type:rounded-b-md hover:bg-brand-muted focus-visible:bg-brand-muted aria-disabled:cursor-not-allowed aria-disabled:opacity-60 data-active-item:bg-brand-muted"
						>
							{copyLink.isSuccess ? (
								<Icon name="check-circle" height={14} width={14} className="shrink-0" />
							) : (
								<Icon name="copy" height={14} width={14} className="shrink-0" />
							)}
							{!session.isPublic
								? 'Make Public to Share'
								: copyLink.isPending
									? 'Copying…'
									: copyLink.isSuccess
										? 'Link copied'
										: 'Copy Link'}
						</Ariakit.MenuItem>
						{copyLink.error ? (
							<p role="alert" className="px-3 py-2 text-xs text-ai-error">
								Could not copy the link. Please try again.
							</p>
						) : null}
						<Ariakit.MenuItem
							onClick={() => {
								if (session.isPublic) {
									visibility.reset()
									setConfirmPrivate(true)
								} else {
									visibility.mutate()
								}
							}}
							hideOnClick={false}
							disabled={visibility.isPending || updateTitle.isPending || deletion.isPending || isRestoring}
							className="flex shrink-0 cursor-pointer items-center gap-2 truncate border-b border-medium px-3 py-2 cv-auto-37 first-of-type:rounded-t-md last-of-type:rounded-b-md hover:bg-brand-muted focus-visible:bg-brand-muted aria-disabled:cursor-not-allowed aria-disabled:opacity-60 data-active-item:bg-brand-muted"
						>
							{visibility.isPending ? (
								<LoadingSpinner size={14} />
							) : (
								<Icon name={session.isPublic ? 'eye' : 'link'} height={14} width={14} className="shrink-0" />
							)}
							{session.isPublic ? 'Make Private' : 'Make Public'}
						</Ariakit.MenuItem>
						{visibility.error && !confirmPrivate ? (
							<p role="alert" className="px-3 py-2 text-xs text-ai-error">
								Failed to update visibility. Please try again.
							</p>
						) : null}
						<MoveToProjectMenuItem sessionId={session.sessionId} currentProjectId={session.projectId ?? null} />
						<Ariakit.MenuItem
							onClick={() => {
								deletion.reset()
								deleteStore.show()
							}}
							disabled={updateTitle.isPending || deletion.isPending || isRestoring || visibility.isPending}
							data-deleting={deletion.isPending}
							className="flex shrink-0 cursor-pointer items-center gap-2 truncate border-b border-medium px-3 py-2 cv-auto-37 first-of-type:rounded-t-md last-of-type:rounded-b-md hover:bg-ai-error-vivid/10 hover:text-error focus-visible:bg-ai-error-vivid/10 focus-visible:text-error data-active-item:bg-ai-error-vivid/10 data-active-item:text-error data-[deleting=true]:bg-ai-error-vivid/10 data-[deleting=true]:text-error"
						>
							{deletion.isPending ? (
								<LoadingSpinner size={14} />
							) : (
								<Icon name="trash-2" height={14} width={14} className="shrink-0" />
							)}
							Delete Session
						</Ariakit.MenuItem>
					</Ariakit.Menu>
				</Ariakit.MenuProvider>
			</div>
			{confirmPrivate ? (
				<ConfirmActionDialog
					title="Make this conversation private?"
					description="The shared link will no longer let other people view this conversation."
					confirmLabel="Make private"
					pendingLabel="Updating…"
					mutation={visibility}
					variables={undefined}
					onClose={() => setConfirmPrivate(false)}
					finalFocus={menuRef}
				/>
			) : null}
			<DeleteSessionDialog
				store={deleteStore}
				title={`Delete “${session.title}”?`}
				pending={deletion.isPending}
				error={deletion.error}
				onConfirm={handleDelete}
				finalFocus={menuRef}
			/>
			{isRestoring ? (
				<span className="absolute top-0 right-0 bottom-0 left-0 flex items-center justify-center rounded-sm bg-surface/70">
					<LoadingSpinner size={12} />
				</span>
			) : null}
		</div>
	)
})
