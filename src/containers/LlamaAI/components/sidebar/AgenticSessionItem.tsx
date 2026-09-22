import * as Ariakit from '@ariakit/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { memo, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { AI_SERVER } from '~/constants'
import { llamaAIRequest } from '~/containers/LlamaAI/api/transport'
import { useLlamaAIChrome } from '~/containers/LlamaAI/chrome'
import { DeleteSessionDialog } from '~/containers/LlamaAI/components/DeleteSessionDialog'
import { SIDEBAR_ROW_SURFACE } from '~/containers/LlamaAI/components/sidebar/AgenticSidebar'
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
import { chatSessionUrl } from '~/containers/LlamaAI/terminal/terminalRoutes'
import { useTerminalEnabled } from '~/containers/LlamaAI/terminal/terminalViewStore'
import type { ChatSession } from '~/containers/LlamaAI/types'
import { assertResponse } from '~/containers/LlamaAI/utils/assertResponse'
import { Button } from '~/ui/Button'
import { Checkbox } from '~/ui/Checkbox'
import { ConfirmActionDialog } from '~/ui/ConfirmActionDialog'
import { Icon } from '~/ui/Icon'
import { inputStyles } from '~/ui/Input'
import { LoadingSpinner } from '~/ui/Loaders'
import { MenuItem, MenuSurface } from '~/ui/MenuSurface'
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
	const terminalSymbol = useTerminalEnabled() ? session.terminalSymbol : null

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

	const menu = Ariakit.useMenuStore({
		setOpen: () => {
			if (copyLink.isError) copyLink.reset()
			if (visibility.isError) visibility.reset()
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
					throw new Error(`Failed to toggle pin: ${getErrorMessage(error)}`, { cause: error })
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
				className="group relative -mx-2 flex flex-wrap items-center gap-1 rounded-md bg-hover-row px-1 py-0.5"
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
					className={`${inputStyles} min-w-0 flex-1 truncate`}
					disabled={updateTitle.isPending}
				/>
				<div className="flex items-center justify-center gap-1">
					<Ariakit.Button
						accessibleWhenDisabled
						type="submit"
						aria-label={updateTitle.isPending ? 'Saving session title' : 'Save session title'}
						render={<Button size="sm" variant="primary" />}
						disabled={updateTitle.isPending}
					>
						{updateTitle.isPending ? <LoadingSpinner size={12} /> : null}
						{updateTitle.isPending ? 'Saving…' : 'Save'}
					</Ariakit.Button>
					<Button
						type="button"
						size="sm"
						variant="ghost"
						square
						aria-label="Cancel session rename"
						onClick={closeRename}
						disabled={updateTitle.isPending}
					>
						<Icon name="x" height={16} width={16} className="shrink-0" />
					</Button>
				</div>
				{updateTitle.error ? (
					<p role="alert" className="w-full p-1.5 body-sm text-error">
						{updateTitle.error.message} Edit the title or retry saving.
					</p>
				) : null}
			</form>
		)
	}

	if (selectMode) {
		return (
			<div className="-mx-2" style={style}>
				<Checkbox variant="default" checked={!!isSelected} onChange={() => onToggleSelect?.(session.sessionId)}>
					<span className="flex-1 truncate">{session.title}</span>
				</Checkbox>
			</div>
		)
	}

	return (
		<div data-active={isActive} className={`group relative -mx-2 ${SIDEBAR_ROW_SURFACE}`} style={style}>
			<button
				type="button"
				onClick={(e) => {
					if (e.metaKey || e.ctrlKey) {
						trackUmamiEvent('llamaai-session-click')
						window.open(chatSessionUrl(session.sessionId, terminalSymbol), '_blank')
						return
					}
					handleSessionClick(session.sessionId)
				}}
				disabled={isEditing || deletion.isPending || isRestoring}
				className="flex min-h-8 flex-1 items-center gap-1.5 overflow-hidden px-2 py-1.5 text-left group-focus-within:pr-16 group-hover:pr-16 aria-disabled:pointer-events-none aria-disabled:opacity-60"
			>
				{session.isPinned ? <Icon name="pin" height={14} width={14} className="shrink-0 text-tertiary" /> : null}
				{terminalSymbol ? (
					<Tooltip
						content={`Terminal chart · ${terminalSymbol}`}
						render={<span aria-label={`Terminal chart, ${terminalSymbol}`} />}
						className="flex shrink-0 items-center"
					>
						<Icon name="bar-chart" height={14} width={14} className="shrink-0 text-tertiary" />
					</Tooltip>
				) : null}
				{session.hasUnseenCompletion ? (
					<Tooltip
						content="New response ready"
						render={<span aria-label="Unseen completion" />}
						className="size-1.5 shrink-0 rounded-full bg-brand"
					>
						{null}
					</Tooltip>
				) : null}
				<span className="truncate">{session.title}</span>
			</button>
			<div className="pointer-events-none absolute inset-y-0 right-0 flex items-center justify-center gap-0.5 rounded-r-md bg-surface-elevated-1 px-1 opacity-0 group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100 group-data-[active=true]:bg-brand-muted">
				<Tooltip
					content="Edit Session Title"
					render={
						<Button
							type="button"
							size="sm"
							variant="ghost"
							square
							ref={renameRef}
							aria-label={`Rename ${session.title}`}
							onClick={() => {
								updateTitle.reset()
								setIsEditing(true)
							}}
							disabled={updateTitle.isPending || deletion.isPending || isRestoring}
						/>
					}
				>
					<Icon name="pencil" height={16} width={16} className="shrink-0" />
				</Tooltip>
				<Ariakit.MenuProvider store={menu}>
					<Ariakit.MenuButton
						ref={menuRef}
						aria-label={`Actions for ${session.title}`}
						render={<Button type="button" size="sm" variant="ghost" square />}
					>
						<Icon name="ellipsis" height={16} width={16} className="shrink-0" />
						<span className="sr-only">Open menu</span>
					</Ariakit.MenuButton>
					<MenuSurface
						variant="actions"
						ref={menuContentRef}
						composite={false}
						aria-label={`Actions for ${session.title}`}
						className="z-50"
					>
						<Ariakit.MenuList store={menu} aria-label="Session actions" className="flex shrink-0 flex-col">
							<MenuItem
								disabled={pinSession.isPending}
								onClick={() => {
									pinSession.mutate()
								}}
								className="border-b border-subtle last-of-type:border-b-0"
							>
								<Icon name="pin" height={14} width={14} className="shrink-0" />
								{session.isPinned ? 'Unpin' : 'Pin to Top'}
							</MenuItem>
							<MenuItem
								onClick={() => {
									copyLink.mutate()
								}}
								hideOnClick={false}
								accessibleWhenDisabled
								disabled={!session.isPublic || !session.shareToken || visibility.isPending || copyLink.isPending}
								className="border-b border-subtle last-of-type:border-b-0 aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
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
							</MenuItem>
							<MenuItem
								onClick={() => {
									if (session.isPublic) {
										visibility.reset()
										setConfirmPrivate(true)
									} else {
										visibility.mutate()
									}
								}}
								hideOnClick={false}
								accessibleWhenDisabled
								disabled={visibility.isPending || updateTitle.isPending || deletion.isPending || isRestoring}
								className="border-b border-subtle last-of-type:border-b-0 aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
							>
								{visibility.isPending ? (
									<LoadingSpinner size={14} />
								) : (
									<Icon name={session.isPublic ? 'eye' : 'link'} height={14} width={14} className="shrink-0" />
								)}
								{session.isPublic ? 'Make Private' : 'Make Public'}
							</MenuItem>
							<MoveToProjectMenuItem sessionId={session.sessionId} currentProjectId={session.projectId ?? null} />
							<MenuItem
								onClick={() => {
									deletion.reset()
									deleteStore.show()
								}}
								disabled={updateTitle.isPending || deletion.isPending || isRestoring || visibility.isPending}
								data-deleting={deletion.isPending}
								className="border-b border-subtle text-error! last-of-type:border-b-0"
							>
								{deletion.isPending ? (
									<LoadingSpinner size={14} />
								) : (
									<Icon name="trash-2" height={14} width={14} className="shrink-0" />
								)}
								Delete Session
							</MenuItem>
						</Ariakit.MenuList>
						{copyLink.error ? (
							<p role="alert" className="px-3 py-2 body-sm text-error">
								Could not copy the link. Please try again.
							</p>
						) : null}
						{visibility.error && !confirmPrivate ? (
							<p role="alert" className="px-3 py-2 body-sm text-error">
								Failed to update visibility. Please try again.
							</p>
						) : null}
					</MenuSurface>
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
