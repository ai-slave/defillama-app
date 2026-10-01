import * as Ariakit from '@ariakit/react'
import { useCallback, useEffect, useReducer, useRef } from 'react'
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
import { buttonStyles } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import { popoverHovercardSurfaceStyles } from '~/ui/Popover'
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
// Every control in the row is an icon-only ghost button so the row reads as one toolbar.
const CONTROL = buttonStyles({ variant: 'ghost', size: 'md', square: true })

interface ResponseControlsState {
	copyStatus: 'idle' | 'pending' | 'copied' | 'error'
	showFeedback: boolean
	selectedRating: Rating
	submittedRating: Rating
}

type ResponseControlsAction =
	| { type: 'setCopyStatus'; value: ResponseControlsState['copyStatus'] }
	| { type: 'setShowFeedback'; value: boolean }
	| { type: 'setSelectedRating'; value: Rating }
	| { type: 'setSubmittedRating'; value: Rating }
	| { type: 'openFeedbackWithRating'; value: Rating }

const createInitialState = (initialRating: Rating): ResponseControlsState => ({
	copyStatus: 'idle',
	showFeedback: false,
	selectedRating: initialRating,
	submittedRating: initialRating
})

function responseControlsReducer(state: ResponseControlsState, action: ResponseControlsAction): ResponseControlsState {
	switch (action.type) {
		case 'setCopyStatus':
			return { ...state, copyStatus: action.value }
		case 'setShowFeedback':
			return { ...state, showFeedback: action.value }
		case 'setSelectedRating':
			return { ...state, selectedRating: action.value }
		case 'setSubmittedRating':
			return { ...state, submittedRating: action.value }
		case 'openFeedbackWithRating':
			return { ...state, selectedRating: action.value, showFeedback: true }
		default:
			return state
	}
}

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
	const [state, dispatch] = useReducer(responseControlsReducer, initialRating || null, createInitialState)
	const { copyStatus, showFeedback, selectedRating, submittedRating } = state
	const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	useEffect(() => {
		return () => {
			if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current)
		}
	}, [])

	const copyLabel =
		copyStatus === 'pending'
			? 'Copying…'
			: copyStatus === 'copied'
				? 'Copied'
				: copyStatus === 'error'
					? 'Retry copy'
					: 'Copy'

	const isRatedAsGood = submittedRating === 'good'
	const isRatedAsBad = submittedRating === 'bad'

	const setShowFeedback = useCallback((value: boolean) => {
		dispatch({ type: 'setShowFeedback', value })
	}, [])

	const setSelectedRating = useCallback((value: Rating) => {
		dispatch({ type: 'setSelectedRating', value })
	}, [])

	const setSubmittedRating = useCallback((value: Rating) => {
		dispatch({ type: 'setSubmittedRating', value })
	}, [])

	const handleOpenFeedbackWithRating = useCallback((value: Rating) => {
		dispatch({ type: 'openFeedbackWithRating', value })
	}, [])

	const handleRateGood = useCallback(() => {
		trackUmamiEvent('llamaai-feedback-submit', { rating: 'good' })
		handleOpenFeedbackWithRating('good')
	}, [handleOpenFeedbackWithRating])

	const handleRateBad = useCallback(() => {
		trackUmamiEvent('llamaai-feedback-submit', { rating: 'bad' })
		handleOpenFeedbackWithRating('bad')
	}, [handleOpenFeedbackWithRating])

	const handleOpenGeneralFeedback = useCallback(() => {
		handleOpenFeedbackWithRating(null)
	}, [handleOpenFeedbackWithRating])

	const handleCopy = useCallback(async () => {
		if (!content || copyStatus === 'pending') return
		if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current)
		dispatch({ type: 'setCopyStatus', value: 'pending' })
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
		const markCopied = () => {
			dispatch({ type: 'setCopyStatus', value: 'copied' })
			if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current)
			copiedTimeoutRef.current = setTimeout(() => dispatch({ type: 'setCopyStatus', value: 'idle' }), 2000)
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
			markCopied()
		} catch {
			try {
				await navigator.clipboard.writeText(await buildCopyMarkdown(content, source))
				markCopied()
			} catch {
				dispatch({ type: 'setCopyStatus', value: 'error' })
			}
		}
	}, [content, copyContext, isDarkMode, copyStatus])

	if (!messageId) return null

	return (
		<>
			<div className="-ml-2 flex flex-wrap items-center gap-0.5 pb-3">
				<div
					className={`flex flex-wrap items-center gap-0.5${isLatest || copyStatus !== 'idle' ? '' : ' opacity-0 group-focus-within/msg:opacity-100 group-hover/msg:opacity-100'}`}
				>
					{content ? (
						<Tooltip
							content={copyLabel}
							render={
								<button
									type="button"
									disabled={copyStatus === 'pending'}
									aria-label={copyLabel}
									aria-busy={copyStatus === 'pending'}
									onClick={() => {
										void handleCopy()
									}}
								/>
							}
							className={CONTROL}
						>
							{copyStatus === 'pending' ? (
								<LoadingSpinner size={16} />
							) : copyStatus === 'copied' ? (
								<Icon name="check-circle" height={16} width={16} />
							) : (
								<Icon name="clipboard" height={16} width={16} />
							)}
						</Tooltip>
					) : null}
					{copyStatus === 'error' ? (
						<span role="alert" className="body-sm text-error">
							Couldn&apos;t copy. Use Retry copy to try again.
						</span>
					) : null}
					<span role="status" className="sr-only">
						{copyStatus === 'pending' ? 'Copying response…' : copyStatus === 'copied' ? 'Response copied' : ''}
					</span>

					{!readOnly ? (
						<>
							<Tooltip
								content={isRatedAsGood ? 'Rated as good' : 'Rate as good'}
								render={
									<button
										type="button"
										onClick={handleRateGood}
										disabled={showFeedback || isRatedAsGood || isRatedAsBad}
									/>
								}
								className={CONTROL}
							>
								<Icon name="thumbs-up" height={16} width={16} className={isRatedAsGood ? 'text-success' : undefined} />
								<span className="sr-only">Thumbs up</span>
							</Tooltip>
							<Tooltip
								content={isRatedAsBad ? 'Rated as bad' : 'Rate as bad'}
								render={
									<button
										type="button"
										onClick={handleRateBad}
										disabled={showFeedback || isRatedAsGood || isRatedAsBad}
									/>
								}
								className={CONTROL}
							>
								<Icon name="thumbs-down" height={16} width={16} className={isRatedAsBad ? 'text-error' : undefined} />
								<span className="sr-only">Thumbs down</span>
							</Tooltip>
						</>
					) : null}
					{content && sessionId && !readOnly ? (
						<PDFExportButton
							sessionId={sessionId}
							messageId={messageId}
							exportType="single_message"
							className={CONTROL}
						/>
					) : null}
					{messageMetadata?.outputTokens != null ? (
						<Ariakit.PopoverProvider store={detailsPopover}>
							<Tooltip
								content="Response details"
								render={<Ariakit.PopoverDisclosure store={detailsPopover} aria-label="Response details" />}
								className={CONTROL}
							>
								<Icon name="circle-help" height={16} width={16} />
							</Tooltip>
							<Ariakit.Popover className={`${popoverHovercardSurfaceStyles} p-3`} portal gutter={8}>
								<div className="flex flex-col gap-1.5 text-primary">
									<div className="flex justify-between gap-4">
										<span className="text-tertiary">Output</span>
										<span className="font-mono tabular-nums">{formatNumber(messageMetadata.outputTokens)} tokens</span>
									</div>
								</div>
							</Ariakit.Popover>
						</Ariakit.PopoverProvider>
					) : null}
					{!readOnly ? (
						<Tooltip
							content="Provide feedback"
							render={
								<button
									type="button"
									onClick={handleOpenGeneralFeedback}
									disabled={showFeedback || !!submittedRating}
								/>
							}
							className={CONTROL}
						>
							<Icon name="message-square-warning" height={16} width={16} />
							<span className="sr-only">Provide feedback</span>
						</Tooltip>
					) : null}
					{sessionId && !readOnly && onShare ? (
						<Tooltip
							content="Share"
							render={<button type="button" onClick={() => onShare(messageId)} />}
							className={CONTROL}
						>
							<Icon name="share" height={16} width={16} />
							<span className="sr-only">Share</span>
						</Tooltip>
					) : null}
					{openArticleExport && articleExportRequest && !readOnly ? (
						<Tooltip
							content="Export to research article"
							render={<button type="button" onClick={() => openArticleExport(articleExportRequest())} />}
							className={CONTROL}
						>
							<Icon name="file-plus" height={16} width={16} />
							<span className="sr-only">Export to research article</span>
						</Tooltip>
					) : null}
				</div>
				<div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-2 body-sm text-tertiary tabular-nums">
					{messageMetadata?.x402CostUsd != null ? (
						<span>External data {formatResponseCost(Number(messageMetadata.x402CostUsd))}</span>
					) : null}
					{messageMetadata?.executionTimeMs != null && messageMetadata.x402CostUsd != null ? (
						<span aria-hidden="true">·</span>
					) : null}
					{messageMetadata?.executionTimeMs != null ? (
						<span>{formatResponseDuration(messageMetadata.executionTimeMs)}</span>
					) : null}
					{completedAt &&
					isClient &&
					(messageMetadata?.executionTimeMs != null || messageMetadata?.x402CostUsd != null) ? (
						<span aria-hidden="true">·</span>
					) : null}
					{completedAt && isClient ? <CompletedTime completedAt={completedAt} /> : null}
				</div>
			</div>
			<FeedbackDialog
				open={showFeedback}
				setOpen={setShowFeedback}
				messageId={messageId}
				selectedRating={selectedRating}
				setSelectedRating={setSelectedRating}
				onRatingSubmitted={setSubmittedRating}
			/>
		</>
	)
}
