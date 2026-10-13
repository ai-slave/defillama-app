import * as Ariakit from '@ariakit/react'
import { useEffect, useState } from 'react'
import { useArticleExport } from '~/containers/LlamaAI/components/AddToArticle/useArticleExport'
import { FeedbackDialog } from '~/containers/LlamaAI/components/FeedbackForm'
import { PDFExportButton } from '~/containers/LlamaAI/components/PDFExportButton'
import type { ArtifactRegistry } from '~/containers/LlamaAI/renderModel'
import type { MessageMetadata, UnifiedCitationReference } from '~/containers/LlamaAI/types'
import type { ArticleExportRequest } from '~/containers/LlamaAI/utils/articleExport'
import { captureChartImage } from '~/containers/LlamaAI/utils/copyChartCapture'
import {
	buildCopyHtml,
	buildCopyMarkdown,
	withFetchCache,
	type CopyMessageSource
} from '~/containers/LlamaAI/utils/copyMessage'
import { formatResponseCost, formatResponseDuration } from '~/containers/LlamaAI/utils/responseMetrics'
import { useDarkModeManager } from '~/contexts/LocalStorage'
import { useIsClient } from '~/hooks/useIsClient'
import { useNowSeconds } from '~/hooks/useNowSeconds'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { MetaLine } from '~/ui/MetaLine'
import { PopoverSurface } from '~/ui/PopoverSurface'
import { ErrorLine } from '~/ui/Status'
import { Tooltip } from '~/ui/Tooltip'
import { trackUmamiEvent } from '~/utils/analytics/umami'
import { formatDateTime, formatLocalTime } from '~/utils/dateFormat'
import { formatNumber } from '~/utils/numberFormat'

interface ResponseControlsProps {
	timestamp?: number
	messageId?: string
	content?: string
	copyContext?: () => { artifacts: ArtifactRegistry; citations?: Array<UnifiedCitationReference> }
	articleExportRequest?: () => ArticleExportRequest
	initialRating?: 'good' | 'bad' | null
	sessionId?: string | null
	readOnly?: boolean
	messageMetadata?: MessageMetadata
	isLatest?: boolean
	onShare?: (messageId?: string) => void
}

type Rating = 'good' | 'bad' | null

const ARTIFACT_FETCH_TIMEOUT_MS = 10_000

// Mounts only after hydration: "today" is the reader's local day, which the server cannot know.
function CompletedTime({ completedAt }: { completedAt: Date }) {
	const nowSeconds = useNowSeconds()
	const completedToday = completedAt.toDateString() === new Date(nowSeconds * 1000).toDateString()
	return (
		<time dateTime={completedAt.toISOString()} title="Response completed at">
			{completedToday ? formatLocalTime(completedAt) : formatDateTime(completedAt, { timeZone: 'local' })}
		</time>
	)
}

export function ResponseControls({
	timestamp,
	messageId,
	content,
	copyContext,
	initialRating,
	sessionId,
	readOnly = false,
	isLatest = false,
	messageMetadata,
	onShare,
	articleExportRequest
}: ResponseControlsProps) {
	const isClient = useIsClient()
	const completedAt = timestamp != null ? new Date(timestamp) : null
	const openArticleExport = useArticleExport()
	const detailsPopover = Ariakit.usePopoverStore({ placement: 'top' })
	const [isDarkMode] = useDarkModeManager()
	// `retrying` is a copy that runs after a failure: the failure stays on screen until it succeeds.
	const [copyStatus, setCopyStatus] = useState<'idle' | 'pending' | 'retrying' | 'copied' | 'error'>('idle')
	const copying = copyStatus === 'pending' || copyStatus === 'retrying'
	const [submittedRating, setSubmittedRating] = useState<Rating>(initialRating ?? null)
	// The rating the open feedback dialog started from; it stays through the dialog's fade-out.
	const [feedback, setFeedback] = useState<{ open: boolean; rating: Rating }>({ open: false, rating: null })

	// "Copied" reverts to the copy label after two seconds.
	useEffect(() => {
		if (copyStatus !== 'copied') return
		const timer = setTimeout(() => setCopyStatus('idle'), 2000)
		return () => clearTimeout(timer)
	}, [copyStatus])

	const copyLabel = copying
		? 'Copying…'
		: copyStatus === 'copied'
			? 'Copied'
			: copyStatus === 'error'
				? 'Retry copy'
				: 'Copy'

	const isRatedAsGood = submittedRating === 'good'
	const isRatedAsBad = submittedRating === 'bad'

	const rate = (rating: 'good' | 'bad') => {
		if (submittedRating) return
		trackUmamiEvent('llamaai-feedback-submit', { rating })
		setFeedback({ open: true, rating })
	}

	const handleCopy = async () => {
		if (!content || copying) return
		setCopyStatus(copyStatus === 'error' ? 'retrying' : 'pending')
		trackUmamiEvent('llamaai-copy-response')
		const context = copyContext?.()
		const source: CopyMessageSource = {
			artifacts: context?.artifacts ?? new Map(),
			...(context?.citations === undefined ? {} : { citations: context.citations }),
			// The cache lets both flavors (and the plain-text fallback) share one
			// request per artifact; the timeout keeps a hung fetch from leaving the
			// clipboard write pending forever — builders degrade to artifact links.
			fetchText: withFetchCache(async (url: string) => {
				const res = await fetch(url, { signal: AbortSignal.timeout(ARTIFACT_FETCH_TIMEOUT_MS) })
				if (!res.ok) throw new Error(`fetch failed (${res.status})`)
				return res.text()
			}),
			captureChart: (chartId: string) => captureChartImage(chartId, isDarkMode)
		}
		// A logical test with an optional chain cannot be lowered inside a try. Decided before it, which is
		// still synchronous and so still inside the user gesture.
		const canWriteRichClipboard = typeof ClipboardItem !== 'undefined' && !!navigator.clipboard?.write
		try {
			// Both flavors go up together: rich targets (Docs, Sheets, Notion) read text/html
			// and get real tables and charts; plain targets keep the markdown text.
			// ClipboardItem accepts promise values, so write() stays inside the user gesture
			// while artifacts resolve (Safari requires this).
			if (canWriteRichClipboard) {
				await navigator.clipboard.write([
					new ClipboardItem({
						'text/plain': buildCopyMarkdown(content, source).then(
							(markdown) => new Blob([markdown], { type: 'text/plain' })
						),
						'text/html': buildCopyHtml(content, source).then((html) => new Blob([html], { type: 'text/html' }))
					})
				])
			} else {
				await navigator.clipboard.writeText(await buildCopyMarkdown(content, source))
			}
			setCopyStatus('copied')
		} catch {
			try {
				await navigator.clipboard.writeText(await buildCopyMarkdown(content, source))
				setCopyStatus('copied')
			} catch {
				setCopyStatus('error')
			}
		}
	}

	if (!messageId) return null

	return (
		<>
			<div className="-ml-2 flex flex-wrap items-center gap-0.5 pb-3">
				<div
					className={`flex flex-wrap items-center gap-0.5${isLatest || copyStatus !== 'idle' ? '' : ' opacity-0 group-hover/msg:opacity-100 group-has-focus-visible/msg:opacity-100 pointer-coarse:group-focus-within/msg:opacity-100'}`}
				>
					{content ? (
						<Tooltip
							content={copyLabel}
							render={
								<Button
									variant="ghost"
									size="md"
									square
									aria-label={copyLabel}
									pendingLabel={copyLabel}
									pending={copying}
									onClick={() => {
										void handleCopy()
									}}
								/>
							}
						>
							{copyStatus === 'copied' ? (
								<Icon name="check-circle" className="size-4" />
							) : (
								<Icon name="clipboard" className="size-4" />
							)}
						</Tooltip>
					) : null}
					{copyStatus === 'error' || copyStatus === 'retrying' ? (
						<ErrorLine inset="none">Couldn&apos;t copy. Use Retry copy to try again.</ErrorLine>
					) : null}
					<span role="status" className="sr-only">
						{copying ? 'Copying response…' : copyStatus === 'copied' ? 'Response copied' : ''}
					</span>

					{!readOnly ? (
						<>
							<Tooltip
								content={isRatedAsGood ? 'Rated as good' : 'Rate as good'}
								render={
									<Button
										variant="ghost"
										size="md"
										square
										onClick={() => rate('good')}
										aria-pressed={isRatedAsGood}
										disabled={submittedRating !== null}
										accessibleWhenDisabled
									/>
								}
							>
								<Icon name="thumbs-up" className={isRatedAsGood ? 'size-4 text-success' : 'size-4'} />
								<span className="sr-only">Thumbs up</span>
							</Tooltip>
							<Tooltip
								content={isRatedAsBad ? 'Rated as bad' : 'Rate as bad'}
								render={
									<Button
										variant="ghost"
										size="md"
										square
										onClick={() => rate('bad')}
										aria-pressed={isRatedAsBad}
										disabled={submittedRating !== null}
										accessibleWhenDisabled
									/>
								}
							>
								<Icon name="thumbs-down" className={isRatedAsBad ? 'size-4 text-error' : 'size-4'} />
								<span className="sr-only">Thumbs down</span>
							</Tooltip>
						</>
					) : null}
					{content && sessionId && !readOnly ? <PDFExportButton sessionId={sessionId} messageId={messageId} /> : null}
					{messageMetadata?.outputTokens != null ? (
						<Ariakit.PopoverProvider store={detailsPopover}>
							<Tooltip
								content="Response details"
								render={
									<Ariakit.PopoverDisclosure
										store={detailsPopover}
										aria-label="Response details"
										render={<Button variant="ghost" size="md" square />}
									/>
								}
							>
								<Icon name="help-circle" className="size-4" />
							</Tooltip>
							<PopoverSurface variant="panel" heading="Response details" gutter={8}>
								<div className="flex justify-between gap-4 p-3 body-sm text-primary">
									<span className="text-tertiary">Output</span>
									<span className="tabular-nums">{formatNumber(messageMetadata.outputTokens)} tokens</span>
								</div>
							</PopoverSurface>
						</Ariakit.PopoverProvider>
					) : null}
					{!readOnly ? (
						<Tooltip
							content="Provide feedback"
							render={
								<Button
									variant="ghost"
									size="md"
									square
									onClick={() => {
										if (!submittedRating) setFeedback({ open: true, rating: null })
									}}
									disabled={submittedRating !== null}
									accessibleWhenDisabled
								/>
							}
						>
							<Icon name="message-square-warning" className="size-4" />
							<span className="sr-only">Provide feedback</span>
						</Tooltip>
					) : null}
					{sessionId && !readOnly && onShare ? (
						<Tooltip
							content="Make public and share"
							render={<Button variant="ghost" size="md" square onClick={() => onShare(messageId)} />}
						>
							<Icon name="share" className="size-4" />
							<span className="sr-only">Make public and share</span>
						</Tooltip>
					) : null}
					{openArticleExport && articleExportRequest && !readOnly ? (
						<Tooltip
							content="Export to research article"
							render={
								<Button variant="ghost" size="md" square onClick={() => openArticleExport(articleExportRequest())} />
							}
						>
							<Icon name="file-plus" className="size-4" />
							<span className="sr-only">Export to research article</span>
						</Tooltip>
					) : null}
				</div>
				<MetaLine className="ml-2 tabular-nums">
					{messageMetadata?.x402CostUsd != null
						? `External data ${formatResponseCost(Number(messageMetadata.x402CostUsd))}`
						: null}
					{messageMetadata?.executionTimeMs != null ? formatResponseDuration(messageMetadata.executionTimeMs) : null}
					{completedAt && isClient ? <CompletedTime completedAt={completedAt} /> : null}
				</MetaLine>
			</div>
			<FeedbackDialog
				open={feedback.open}
				setOpen={(open) => setFeedback((current) => ({ ...current, open }))}
				messageId={messageId}
				initialRating={feedback.rating}
				onRatingSubmitted={setSubmittedRating}
			/>
		</>
	)
}
