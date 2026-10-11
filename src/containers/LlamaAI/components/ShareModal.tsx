import * as Ariakit from '@ariakit/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { memo, useCallback, useEffect, useRef } from 'react'
import { toast } from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { AI_SERVER } from '~/constants'
import { SESSIONS_QUERY_KEY } from '~/containers/LlamaAI/hooks/useSessionList'
import { toShareToken, type ShareToken } from '~/containers/LlamaAI/ids'
import { assertResponse } from '~/containers/LlamaAI/utils/assertResponse'
import { Button } from '~/ui/Button'
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '~/ui/Dialog'
import { Field } from '~/ui/Field'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { InlineStatus } from '~/ui/Status'
import { trackUmamiEvent } from '~/utils/analytics/umami'
import { handleSimpleFetchResponse } from '~/utils/async'

interface ShareModalProps {
	open: boolean
	setOpen: (value: boolean) => void
	sessionId: string | null
	messageId?: string | null
}

interface ShareResult {
	shareToken: ShareToken
	isPublic: boolean
}

function buildShareLink(shareToken: ShareToken, messageId?: string | null) {
	const baseLink = `${window.location.origin}/ai/chat/shared/${shareToken}`
	return messageId ? `${baseLink}#msg-${messageId}` : baseLink
}

const CLIPBOARD_UNAVAILABLE = 'Clipboard access is unavailable here. Copy the link from the field above.'
const CREATION_FAILED = 'Couldn’t create a share link.'

export const ShareModal = memo(function ShareModal({ open, setOpen, sessionId, messageId }: ShareModalProps) {
	return (
		<Dialog size="sm" open={open} onClose={() => setOpen(false)} unmountOnHide portal>
			{open ? <ShareModalBody key={`${sessionId}:${messageId}`} sessionId={sessionId} messageId={messageId} /> : null}
		</Dialog>
	)
})

// Each opening/target owns its feedback and clipboard callbacks; the cache update survives dismissal.
function ShareModalBody({ sessionId, messageId }: Pick<ShareModalProps, 'sessionId' | 'messageId'>) {
	const { authorizedFetch } = useAuthContext()
	const queryClient = useQueryClient()
	const hasStartedRef = useRef(false)
	const openingRef = useRef<HTMLSpanElement>(null)
	const primaryRef = useRef<HTMLButtonElement>(null)
	const copy = useMutation({
		mutationFn: async (link: string) => {
			if (!navigator.clipboard?.writeText) throw new Error(CLIPBOARD_UNAVAILABLE)
			await navigator.clipboard.writeText(link)
			trackUmamiEvent('llamaai-copy-share-link')
			return link
		},
		onError: () => {
			if (!openingRef.current?.isConnected) toast.error('Couldn’t copy the share link.')
		}
	})
	const creation = useMutation<ShareResult>({
		mutationFn: async () => {
			if (!sessionId) throw new Error('No session to share')
			const data = (await authorizedFetch(`${AI_SERVER}/user/sessions/${sessionId}/share`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ forcePublic: true })
			})
				.then((response) => assertResponse(response, "Couldn't share the chat."))
				.then(handleSimpleFetchResponse)
				.then((res: Response) => res.json())) as { shareToken: string; isPublic: boolean }
			if (!data.shareToken) throw new Error('No share link returned')
			return { ...data, shareToken: toShareToken(data.shareToken) }
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: [SESSIONS_QUERY_KEY] })
		},
		onError: (error) => {
			console.error('Failed to create share link:', error)
			if (!openingRef.current?.isConnected) toast.error(CREATION_FAILED)
		}
	})
	const { mutate: createShareLink } = creation
	const { mutate: copyLink, reset: resetCopy } = copy
	const startShare = useCallback(() => {
		createShareLink(undefined, {
			// React Query drops this callback when the opening closes or its target changes.
			onSuccess: (data) => copyLink(buildShareLink(data.shareToken, messageId))
		})
	}, [createShareLink, copyLink, messageId])

	useEffect(() => {
		// Opening creates a public link; Strict Mode must not start that write twice. Without a session
		// there is nothing to create, so no request starts and no retry is offered.
		if (!sessionId || hasStartedRef.current) return
		hasStartedRef.current = true
		trackUmamiEvent('llamaai-share-conversation')
		startShare()
	}, [sessionId, startShare])

	const copiedAt = copy.isSuccess ? copy.submittedAt : null
	useEffect(() => {
		if (copiedAt === null) return
		const timer = setTimeout(resetCopy, 2000)
		return () => clearTimeout(timer)
	}, [copiedAt, resetCopy])

	const shareLink = creation.data ? buildShareLink(creation.data.shareToken, messageId) : ''
	const nativeShare = useMutation({
		mutationFn: async () => {
			await navigator.share({
				title: 'LlamaAI conversation',
				text: 'Check out this conversation from LlamaAI',
				url: shareLink
			})
			trackUmamiEvent('llamaai-native-share')
		}
	})
	const nativeShareError = nativeShare.error?.name !== 'AbortError' ? nativeShare.error : null
	const status = creation.isPending
		? 'Creating share link…'
		: copy.isPending
			? 'Copying share link…'
			: copy.isSuccess
				? 'Share link copied to clipboard'
				: shareLink
					? 'Share link ready'
					: ''

	return (
		<>
			<DialogHeader
				title="Share conversation"
				subtitle={
					sessionId
						? 'Anyone with the link can view this conversation.'
						: 'Sharing is available once the conversation is saved.'
				}
			/>
			{sessionId ? (
				<DialogBody>
					<Field label="Share link">
						{(control) => (
							// The field keeps its place while the link is created, so the dialog does not grow when it lands.
							<Input
								{...control}
								type="text"
								value={shareLink}
								readOnly
								aria-busy={creation.isPending}
								onFocus={(event) => event.currentTarget.select()}
								className="w-full min-w-0"
							/>
						)}
					</Field>
					{creation.error ? (
						<InlineStatus
							variant="error"
							action={
								<Button
									type="button"
									size="sm"
									onClick={() => {
										// The copy button takes this button's place as the request runs, so focus moves to it.
										primaryRef.current?.focus()
										startShare()
									}}
								>
									Try again
								</Button>
							}
						>
							{CREATION_FAILED}
						</InlineStatus>
					) : null}
					{copy.error ? (
						<InlineStatus variant="error">
							{copy.error.message === CLIPBOARD_UNAVAILABLE
								? CLIPBOARD_UNAVAILABLE
								: 'Couldn’t copy the link. Try again or copy it from the field above.'}
						</InlineStatus>
					) : null}
					{nativeShareError ? (
						<InlineStatus variant="error">Couldn’t share the link. Try again or copy it instead.</InlineStatus>
					) : null}
				</DialogBody>
			) : null}
			<DialogFooter
				leading={
					shareLink ? (
						<>
							{typeof navigator.share === 'function' ? (
								<Button
									type="button"
									size="md"
									onClick={() => nativeShare.mutate()}
									pendingLabel="Sharing…"
									pending={nativeShare.isPending}
								>
									Share…
								</Button>
							) : null}
							<Button
								type="button"
								size="md"
								onClick={() => {
									const text = encodeURIComponent('Check out this conversation from LlamaAI')
									window.open(
										`https://x.com/intent/tweet?text=${text}&url=${encodeURIComponent(shareLink)}`,
										'_blank',
										'noopener,noreferrer'
									)
								}}
								data-umami-event="llamaai-share-to-x"
							>
								Share to X
							</Button>
						</>
					) : null
				}
				dismiss={<Ariakit.DialogDismiss render={<Button size="md" />}>Close</Ariakit.DialogDismiss>}
			>
				{sessionId ? (
					// Focusable while disabled: the retry above hands focus to it. Without a link, or without clipboard
					// access, the error above says why it is unavailable.
					<Button
						ref={primaryRef}
						type="button"
						size="md"
						variant="primary"
						pendingLabel={creation.isPending ? 'Creating…' : 'Copying…'}
						pending={creation.isPending || copy.isPending}
						onClick={() => copyLink(shareLink)}
						disabled={!shareLink || copy.error?.message === CLIPBOARD_UNAVAILABLE}
						accessibleWhenDisabled
						doneLabel="Copied"
						done={copy.isSuccess}
					>
						<Icon name="copy" className="size-3.5" />
						Copy link
					</Button>
				) : null}
			</DialogFooter>
			{/* Also how a late failure tells whether this opening is still on screen. */}
			<span ref={openingRef} role="status" className="sr-only">
				{nativeShare.isPending ? 'Sharing link' : status}
			</span>
		</>
	)
}
