import * as Ariakit from '@ariakit/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { memo, useCallback, useEffect, useId, useRef } from 'react'
import { toast } from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { AI_SERVER } from '~/constants'
import { SESSIONS_QUERY_KEY } from '~/containers/LlamaAI/hooks/useSessionList'
import { toShareToken, type ShareToken } from '~/containers/LlamaAI/ids'
import { assertResponse } from '~/containers/LlamaAI/utils/assertResponse'
import { Button } from '~/ui/Button'
import { DialogCloseButton, DialogHeading, dialogScrollableBodyStyles, dialogSurfaceStyles } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { LoadingSpinner } from '~/ui/Loaders'
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

export const ShareModal = memo(function ShareModal({ open, setOpen, sessionId, messageId }: ShareModalProps) {
	return (
		<Ariakit.DialogProvider open={open} setOpen={setOpen}>
			<Ariakit.Dialog
				className={`${dialogSurfaceStyles} [--dialog-width:448px]`}
				unmountOnHide
				portal
				hideOnInteractOutside
			>
				{open ? <ShareModalBody key={`${sessionId}:${messageId}`} sessionId={sessionId} messageId={messageId} /> : null}
			</Ariakit.Dialog>
		</Ariakit.DialogProvider>
	)
})

// Each opening/target owns its feedback and clipboard callbacks; the cache update survives dismissal.
function ShareModalBody({ sessionId, messageId }: Pick<ShareModalProps, 'sessionId' | 'messageId'>) {
	const { authorizedFetch } = useAuthContext()
	const queryClient = useQueryClient()
	const hasStartedRef = useRef(false)
	const openingRef = useRef<HTMLDivElement>(null)
	const shareLinkInputId = useId()
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
				.then((response) => assertResponse(response, 'Failed to share session'))
				.then(handleSimpleFetchResponse)
				.then((res: Response) => res.json())) as { shareToken: string; isPublic: boolean }
			if (!data.shareToken) throw new Error('No share link returned')
			return { ...data, shareToken: toShareToken(data.shareToken) }
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: [SESSIONS_QUERY_KEY] })
		},
		onError: (error) => {
			if (!openingRef.current?.isConnected) toast.error(error.message)
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
	const pending = creation.isPending || copy.isPending

	return (
		<>
			<div
				ref={openingRef}
				className="flex shrink-0 items-center justify-between gap-3 border-b border-subtle px-4 py-3"
			>
				<DialogHeading>Share conversation</DialogHeading>
				<DialogCloseButton className="-mr-1" ariaLabel="Close share dialog" />
			</div>
			<div className={`${dialogScrollableBodyStyles} flex flex-col gap-4 p-4`}>
				<p role="status" className="m-0 body-sm text-secondary">
					{!sessionId
						? 'Sharing is available once the conversation is saved.'
						: creation.isPending
							? 'Creating share link…'
							: copy.isPending
								? 'Copying share link…'
								: copy.isSuccess
									? 'Share link copied to clipboard'
									: shareLink
										? 'Share link ready'
										: ''}
				</p>
				{shareLink ? (
					<div className="flex min-w-0 flex-col gap-1.5">
						<p className="m-0 body-sm text-secondary">Anyone with the link can view this conversation.</p>
						<label htmlFor={shareLinkInputId} className="label-sm text-secondary">
							Share Link
						</label>
						<Input
							id={shareLinkInputId}
							type="text"
							value={shareLink}
							readOnly
							onFocus={(event) => event.currentTarget.select()}
							className="w-full min-w-0"
						/>
					</div>
				) : null}
				{creation.error ? (
					<p role="alert" className="body-sm text-data-down">
						{creation.error.message}
					</p>
				) : null}
				{copy.error ? (
					<p role="alert" className="body-sm text-data-down">
						{copy.error.message === CLIPBOARD_UNAVAILABLE
							? CLIPBOARD_UNAVAILABLE
							: 'Couldn’t copy the link. Try again or copy it from the field above.'}
					</p>
				) : null}
				{nativeShareError ? (
					<p role="alert" className="body-sm text-data-down">
						Couldn’t share the link. Try again or copy it instead.
					</p>
				) : null}
				{shareLink ? (
					<div className="flex flex-wrap gap-2">
						{typeof navigator.share === 'function' ? (
							<Ariakit.Button
								type="button"
								onClick={() => nativeShare.mutate()}
								disabled={nativeShare.isPending}
								accessibleWhenDisabled
								render={<Button size="md" />}
							>
								{nativeShare.isPending ? <LoadingSpinner size={14} /> : null}
								{nativeShare.isPending ? 'Sharing…' : 'Share…'}
							</Ariakit.Button>
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
					</div>
				) : null}
			</div>
			<div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-subtle px-4 py-3">
				<Ariakit.DialogDismiss render={<Button size="md" />}>Close</Ariakit.DialogDismiss>
				{sessionId ? (
					<Ariakit.Button
						type="button"
						onClick={() => {
							if (pending) return
							if (shareLink) copyLink(shareLink)
							else startShare()
						}}
						disabled={pending || copy.error?.message === CLIPBOARD_UNAVAILABLE}
						accessibleWhenDisabled
						render={<Button size="md" variant="primary" />}
					>
						{pending ? (
							<LoadingSpinner size={14} />
						) : (
							<Icon name={copy.isSuccess ? 'check-circle' : 'copy'} height={14} width={14} />
						)}
						{creation.isPending
							? 'Creating…'
							: copy.isPending
								? 'Copying…'
								: copy.isSuccess
									? 'Copied'
									: shareLink
										? 'Copy link'
										: 'Retry'}
					</Ariakit.Button>
				) : null}
			</div>
			<span role="status" className="sr-only">
				{nativeShare.isPending ? 'Sharing link' : ''}
			</span>
		</>
	)
}
