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
import { keepFocus } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { MenuItem, MenuSurface } from '~/ui/PopoverSurface'
import { BusyGlyph, ErrorLine, InlineStatus } from '~/ui/Status'
import { Tooltip } from '~/ui/Tooltip'
import { trackUmamiEvent } from '~/utils/analytics/umami'

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
// The copy waits on the publish; when publishing fails, that failure is reported once, by the publish.
const PUBLISH_FAILED = new Error('Publishing failed')

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
	// The last failures, kept while a retry runs: a mutation clears its own error when the retry starts.
	const [renameError, setRenameError] = useState<string | null>(null)
	const [menuError, setMenuError] = useState<string | null>(null)
	const formRef = useRef<HTMLFormElement>(null)
	const renameRef = useRef<HTMLButtonElement>(null)
	// The rename form leaves with focus; the Rename button that opened it takes it back.
	const closeRename = () =>
		keepFocus(
			() => setIsEditing(false),
			() => renameRef.current
		)
	const [confirmPrivate, setConfirmPrivate] = useState(false)
	const menuContentRef = useRef<HTMLDivElement>(null)
	const [confirmDelete, setConfirmDelete] = useState(false)
	const menuRef = useRef<HTMLButtonElement>(null)

	// Safari only accepts a clipboard write that starts inside the click, so a link still being created arrives as a
	// promise and the write waits for it.
	const copyLink = useMutation({
		mutationFn: (shareToken: string | Promise<string>) =>
			navigator.clipboard.write([
				new ClipboardItem({
					'text/plain': Promise.resolve(shareToken).then(
						(token) => new Blob([`${window.location.origin}/ai/chat/shared/${token}`], { type: 'text/plain' })
					)
				})
			]),
		onSuccess: () => {
			setMenuError(null)
			trackUmamiEvent('llamaai-session-share')
		},
		onError: (error) => {
			if (error === PUBLISH_FAILED) return
			setMenuError("Couldn't copy the link. Try again.")
			if (!menuContentRef.current?.isConnected) toast.error("Couldn't copy the link.")
		}
	})
	// Fast consecutive copies can batch away the pending render; each attempt needs a fresh timer.
	const successfulCopyAttempt = copyLink.isSuccess ? copyLink.submittedAt : null
	useEffect(() => {
		if (successfulCopyAttempt === null) return
		const timer = setTimeout(copyLink.reset, 2000)
		return () => clearTimeout(timer)
	}, [successfulCopyAttempt, copyLink.reset])

	// `makePublic` asks for a public link; without it the endpoint toggles, which only Make private uses.
	const visibility = useMutation({
		mutationFn: async (makePublic: boolean): Promise<{ shareToken: string }> => {
			const response = assertResponse(
				await authorizedFetch(`${AI_SERVER}/user/sessions/${session.sessionId}/share`, {
					method: 'PUT',
					...(makePublic
						? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ forcePublic: true }) }
						: {})
				}),
				"Couldn't update chat visibility."
			)
			return response.json()
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: [SESSIONS_QUERY_KEY] }),
		// Making the conversation private reports its failure in its own confirm dialog.
		onError: (_error, makePublic) => {
			if (makePublic) setMenuError("Couldn't make this conversation public. Try again.")
			if (!session.isPublic && !menuContentRef.current?.isConnected) toast.error("Couldn't make the chat public.")
			void queryClient.invalidateQueries({ queryKey: [SESSIONS_QUERY_KEY] })
		}
	})

	const menu = Ariakit.useMenuStore({ setOpen: () => setMenuError(null) })

	const updateTitle = useUpdateSessionTitle()
	// The parent also clears queue and prompt-failure state; each row owns its pending feedback.
	const deletion = useMutation({
		mutationFn: () => {
			trackUmamiEvent('llamaai-session-delete')
			return onDelete(session.sessionId, session.projectId)
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
					throw new Error("Couldn't change the pin. Try again.", { cause: error })
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
		if (updateTitle.isPending) return
		// A title cleared to blank keeps the old one, as Finder and Figma do.
		if (!title || title === session.title) {
			closeRename()
			return
		}
		try {
			await updateTitle.mutateAsync({ sessionId: session.sessionId, title, projectId: session.projectId })
			closeRename()
		} catch (error) {
			// useUpdateSessionTitle words every failure for readers.
			setRenameError(error.message)
			if (!formRef.current?.isConnected) toast.error(error.message)
		}
	}

	if (isEditing) {
		return (
			<form
				noValidate
				ref={formRef}
				onSubmit={handleSave}
				className="group relative -mx-2 flex flex-wrap items-center gap-1 rounded-md bg-hover-row px-1 py-0.5"
				style={style}
			>
				<Input
					type="text"
					name="newTitle"
					onKeyDown={(event) => {
						if (event.key === 'Escape' && !updateTitle.isPending) {
							event.preventDefault()
							closeRename()
						}
					}}
					aria-label="Session title"
					placeholder="Session title"
					defaultValue={session.title}
					autoFocus
					onFocus={(e) => e.currentTarget.select()}
					aria-invalid={renameError ? true : undefined}
					className="min-w-0 flex-1 truncate"
					// Read-only, not disabled, while saving: a disabled field drops focus to the page, and the rename could no
					// longer hand it back to its button.
					readOnly={updateTitle.isPending}
					aria-busy={updateTitle.isPending || undefined}
				/>
				<div className="flex items-center justify-center gap-1">
					<Button
						size="md"
						variant="primary"
						type="submit"
						aria-label={updateTitle.isPending ? 'Saving session title' : 'Save session title'}
						pendingLabel="Saving…"
						pending={updateTitle.isPending}
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
								aria-label="Cancel session rename"
								onClick={closeRename}
								disabled={updateTitle.isPending}
							/>
						}
					>
						<Icon name="x" className="size-4 shrink-0" />
					</Tooltip>
				</div>
				{renameError ? (
					<div className="w-full p-1.5">
						<InlineStatus variant="error">{renameError} Edit the title or save again.</InlineStatus>
					</div>
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
			<Ariakit.Button
				type="button"
				onClick={(e) => {
					if (e.metaKey || e.ctrlKey) {
						trackUmamiEvent('llamaai-session-click')
						window.open(chatSessionUrl(session.sessionId, terminalSymbol), '_blank')
						return
					}
					handleSessionClick(session.sessionId)
				}}
				disabled={deletion.isPending || isRestoring}
				accessibleWhenDisabled
				className="flex min-h-8 flex-1 items-center gap-1.5 overflow-hidden px-2 py-1.5 text-left group-focus-within:pr-16 group-hover:pr-16 aria-disabled:pointer-events-none aria-disabled:text-disabled"
			>
				{session.isPinned ? <Icon name="pin" className="size-3.5 shrink-0 text-tertiary" /> : null}
				{terminalSymbol ? (
					<Tooltip
						content={`Terminal chart · ${terminalSymbol}`}
						render={<span aria-label={`Terminal chart, ${terminalSymbol}`} />}
						className="flex shrink-0 items-center"
					>
						<Icon name="bar-chart" className="size-3.5 shrink-0 text-tertiary" />
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
			</Ariakit.Button>
			<div className="pointer-events-none absolute inset-y-0 right-0 flex items-center justify-center gap-0.5 rounded-r-md bg-surface-elevated-1 px-1 opacity-0 group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100 group-data-[active=true]:bg-brand-muted">
				<Tooltip
					content="Edit session title"
					render={
						<Button
							type="button"
							size="sm"
							variant="ghost"
							square
							ref={renameRef}
							aria-label={`Rename ${session.title}`}
							onClick={() => {
								setRenameError(null)
								setIsEditing(true)
							}}
							disabled={updateTitle.isPending || deletion.isPending || isRestoring}
						/>
					}
				>
					<Icon name="pencil" className="size-4 shrink-0" />
				</Tooltip>
				<Ariakit.MenuProvider store={menu}>
					<Ariakit.MenuButton
						ref={menuRef}
						aria-label={`Actions for ${session.title}`}
						render={<Button type="button" size="sm" variant="ghost" square />}
					>
						<Icon name="ellipsis" className="size-4 shrink-0" />
						<span className="sr-only">Open menu</span>
					</Ariakit.MenuButton>
					<MenuSurface
						variant="actions"
						ref={menuContentRef}
						composite={false}
						aria-label={`Actions for ${session.title}`}
					>
						<Ariakit.MenuList store={menu} aria-label="Session actions" className="flex shrink-0 flex-col">
							<MenuItem
								disabled={pinSession.isPending}
								onClick={() => {
									pinSession.mutate()
								}}
								className="border-b border-subtle last-of-type:border-b-0"
							>
								<Icon name="pin" className="size-3.5 shrink-0" />
								{session.isPinned ? 'Unpin' : 'Pin to top'}
							</MenuItem>
							{/* A link only opens for others once the conversation is public, so a private one publishes first. */}
							<MenuItem
								onClick={() => {
									if (session.isPublic) {
										copyLink.mutate(session.shareToken!)
										return
									}
									copyLink.mutate(
										visibility.mutateAsync(true).then(
											(data) => data.shareToken,
											() => Promise.reject(PUBLISH_FAILED)
										)
									)
								}}
								hideOnClick={false}
								accessibleWhenDisabled
								disabled={
									visibility.isPending ||
									copyLink.isPending ||
									(session.isPublic && !session.shareToken) ||
									updateTitle.isPending ||
									deletion.isPending ||
									isRestoring
								}
								className="border-b border-subtle last-of-type:border-b-0"
							>
								{visibility.isPending || copyLink.isPending ? (
									<BusyGlyph decorative size={14} />
								) : copyLink.isSuccess ? (
									<Icon name="check-circle" className="size-3.5 shrink-0" />
								) : (
									<Icon name="copy" className="size-3.5 shrink-0" />
								)}
								{visibility.isPending
									? 'Making public…'
									: copyLink.isPending
										? 'Copying…'
										: copyLink.isSuccess
											? 'Link copied'
											: session.isPublic
												? 'Copy link'
												: 'Make public and copy link'}
							</MenuItem>
							{session.isPublic ? (
								<MenuItem
									onClick={() => setConfirmPrivate(true)}
									hideOnClick={false}
									accessibleWhenDisabled
									disabled={visibility.isPending || updateTitle.isPending || deletion.isPending || isRestoring}
									className="border-b border-subtle last-of-type:border-b-0"
								>
									<Icon name="eye" className="size-3.5 shrink-0" />
									Make private
								</MenuItem>
							) : null}
							<MoveToProjectMenuItem sessionId={session.sessionId} currentProjectId={session.projectId ?? null} />
							<MenuItem
								onClick={() => setConfirmDelete(true)}
								disabled={updateTitle.isPending || deletion.isPending || isRestoring || visibility.isPending}
								data-deleting={deletion.isPending}
								destructive
								className="border-b border-subtle last-of-type:border-b-0"
							>
								{deletion.isPending ? (
									<BusyGlyph decorative size={14} />
								) : (
									<Icon name="trash-2" className="size-3.5 shrink-0" />
								)}
								Delete session
							</MenuItem>
						</Ariakit.MenuList>
						{menuError ? <ErrorLine inset="menuRow">{menuError}</ErrorLine> : null}
					</MenuSurface>
				</Ariakit.MenuProvider>
			</div>
			{confirmPrivate ? (
				<ConfirmActionDialog
					title="Make this conversation private?"
					description="The shared link will no longer let other people view this conversation."
					confirmLabel="Make private"
					pendingLabel="Updating…"
					errorMessage="Couldn't make the conversation private."
					mutation={visibility}
					variables={false}
					onClose={() => setConfirmPrivate(false)}
					finalFocus={menuRef}
				/>
			) : null}
			{confirmDelete ? (
				<DeleteSessionDialog
					title={`Delete “${session.title}”?`}
					errorMessage="Couldn't delete this chat."
					mutation={deletion}
					variables={undefined}
					onClose={() => setConfirmDelete(false)}
					finalFocus={menuRef}
				/>
			) : null}
			{isRestoring ? (
				<span className="absolute top-0 right-0 bottom-0 left-0 flex items-center justify-center rounded-sm bg-veil">
					<BusyGlyph label="Restoring chat" size={12} hideLabel />
				</span>
			) : null}
		</div>
	)
})
