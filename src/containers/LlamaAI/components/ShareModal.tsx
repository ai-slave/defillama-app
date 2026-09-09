import * as Ariakit from '@ariakit/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { memo, useCallback, useEffect, useId, useRef } from 'react'
import { toast } from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { AI_SERVER } from '~/constants'
import { SESSIONS_QUERY_KEY } from '~/containers/LlamaAI/hooks/useSessionList'
import { toShareToken, type ShareToken } from '~/containers/LlamaAI/ids'
import { assertResponse } from '~/containers/LlamaAI/utils/assertResponse'
import { Icon } from '~/ui/Icon'
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
				className="dialog w-full gap-0 border border-medium bg-surface p-4 shadow-2xl max-sm:drawer sm:max-w-sm"
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
			<div ref={openingRef} className="mb-4 flex items-center justify-between gap-2">
				<Ariakit.DialogHeading className="text-lg font-semibold">Share conversation</Ariakit.DialogHeading>
				<Ariakit.DialogDismiss
					aria-label="Close share dialog"
					className="-m-2 rounded-sm p-2 hover:bg-ai-surface-muted"
				>
					<Icon name="x" height={16} width={16} />
				</Ariakit.DialogDismiss>
			</div>
			<p role="status" className="m-0 text-sm text-ai-tertiary">
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
				<div className="mt-4 flex min-w-0 flex-col gap-2">
					<p className="m-0 text-xs text-ai-tertiary">Anyone with the link can view this conversation.</p>
					<label htmlFor={shareLinkInputId} className="text-xs font-medium text-ai-tertiary">
						Share Link
					</label>
					<input
						id={shareLinkInputId}
						type="text"
						value={shareLink}
						readOnly
						onFocus={(event) => event.currentTarget.select()}
						className="w-full min-w-0 rounded-sm border border-ai-line bg-page px-3 py-2 text-sm"
					/>
				</div>
			) : null}
			{creation.error ? (
				<p role="alert" className="mt-3 text-sm text-data-down">
					{creation.error.message}
				</p>
			) : null}
			{copy.error ? (
				<p role="alert" className="mt-3 text-sm text-data-down">
					{copy.error.message === CLIPBOARD_UNAVAILABLE
						? CLIPBOARD_UNAVAILABLE
						: 'Couldn’t copy the link. Try again or copy it from the field above.'}
				</p>
			) : null}
			{nativeShareError ? (
				<p role="alert" className="mt-3 text-sm text-data-down">
					Couldn’t share the link. Try again or copy it instead.
				</p>
			) : null}
			<div className="mt-4 flex flex-wrap items-center justify-end gap-3">
				<Ariakit.DialogDismiss className="rounded-sm px-3 py-2 text-xs text-ai-tertiary hover:bg-ai-surface-muted">
					Close
				</Ariakit.DialogDismiss>
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
						className="flex items-center gap-2 rounded-sm bg-brand px-3 py-2 text-xs text-ai-white hover:opacity-90 aria-disabled:opacity-50"
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
			{shareLink ? (
				<div className="mt-3 flex flex-wrap justify-end gap-3">
					{typeof navigator.share === 'function' ? (
						<Ariakit.Button
							type="button"
							onClick={() => nativeShare.mutate()}
							disabled={nativeShare.isPending}
							accessibleWhenDisabled
							className="flex items-center gap-2 rounded-sm border border-ai-line px-3 py-2 text-xs hover:bg-ai-surface-muted aria-disabled:opacity-50"
						>
							{nativeShare.isPending ? <LoadingSpinner size={14} /> : null}
							{nativeShare.isPending ? 'Sharing…' : 'Share…'}
						</Ariakit.Button>
					) : null}
					<button
						type="button"
						onClick={() => {
							const text = encodeURIComponent('Check out this conversation from LlamaAI')
							window.open(
								`https://x.com/intent/tweet?text=${text}&url=${encodeURIComponent(shareLink)}`,
								'_blank',
								'noopener,noreferrer'
							)
						}}
						data-umami-event="llamaai-share-to-x"
						className="rounded-sm border border-ai-line px-3 py-2 text-xs hover:bg-ai-surface-muted"
					>
						Share to X
					</button>
				</div>
			) : null}
			<span role="status" className="sr-only">
				{nativeShare.isPending ? 'Sharing link' : ''}
			</span>
		</>
	)
}
