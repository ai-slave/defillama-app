import * as Ariakit from '@ariakit/react'
import { memo, useCallback, useEffect, useReducer, useRef } from 'react'
import { useArticleExport } from '~/containers/LlamaAI/components/AddToArticle/useArticleExport'
import { FeedbackForm } from '~/containers/LlamaAI/components/FeedbackForm'
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
import { useDarkModeManager } from '~/contexts/LocalStorage'
import { Icon } from '~/ui/Icon'
import { Tooltip } from '~/ui/Tooltip'
import { trackUmamiEvent } from '~/utils/analytics/umami'
import { formatNumber, formatUsd, formatFixedNumber } from '~/utils/numberFormat'

interface ResponseControlsProps {
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

interface ResponseControlsState {
	copied: boolean
	showFeedback: boolean
	selectedRating: Rating
	submittedRating: Rating
}

type ResponseControlsAction =
	| { type: 'setCopied'; value: boolean }
	| { type: 'setShowFeedback'; value: boolean }
	| { type: 'setSelectedRating'; value: Rating }
	| { type: 'setSubmittedRating'; value: Rating }
	| { type: 'openFeedbackWithRating'; value: Rating }

const createInitialState = (initialRating: Rating): ResponseControlsState => ({
	copied: false,
	showFeedback: false,
	selectedRating: initialRating,
	submittedRating: initialRating
})

function responseControlsReducer(state: ResponseControlsState, action: ResponseControlsAction): ResponseControlsState {
	switch (action.type) {
		case 'setCopied':
			return { ...state, copied: action.value }
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

interface FeedbackDialogProps {
	open: boolean
	setOpen: (value: boolean) => void
	messageId: string
	selectedRating: Rating
	setSelectedRating: (value: Rating) => void
	onRatingSubmitted: (value: Rating) => void
}

const FeedbackDialog = memo(function FeedbackDialog({
	open,
	setOpen,
	messageId,
	selectedRating,
	setSelectedRating,
	onRatingSubmitted
}: FeedbackDialogProps) {
	return (
		<Ariakit.DialogProvider open={open} setOpen={setOpen}>
			<Ariakit.Dialog
				className="dialog w-full gap-0 border border-medium bg-surface p-4 shadow-2xl max-sm:drawer sm:max-w-md"
				unmountOnHide
				portal
				hideOnInteractOutside
			>
				<div className="mb-4 flex items-center justify-between">
					<Ariakit.DialogHeading className="text-lg font-semibold">Provide Feedback</Ariakit.DialogHeading>
					<Ariakit.DialogDismiss className="-m-2 rounded-sm p-2 hover:bg-ai-surface-muted">
						<Icon name="x" height={16} width={16} />
					</Ariakit.DialogDismiss>
				</div>
				<FeedbackForm
					messageId={messageId}
					selectedRating={selectedRating}
					setSelectedRating={setSelectedRating}
					setShowFeedback={setOpen}
					onRatingSubmitted={onRatingSubmitted}
				/>
			</Ariakit.Dialog>
		</Ariakit.DialogProvider>
	)
})

export function ResponseControls({
	messageId,
	content,
	copyContext,
	initialRating,
	sessionId,
	readOnly = false,
	messageMetadata,
	isLatest = false,
	onShare,
	articleExportRequest
}: ResponseControlsProps) {
	const openArticleExport = useArticleExport()
	const [isDarkMode] = useDarkModeManager()
	const [state, dispatch] = useReducer(responseControlsReducer, initialRating || null, createInitialState)
	const { copied, showFeedback, selectedRating, submittedRating } = state
	const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	useEffect(() => {
		return () => {
			if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current)
		}
	}, [])

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
		if (!content) return
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
			dispatch({ type: 'setCopied', value: true })
			if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current)
			copiedTimeoutRef.current = setTimeout(() => dispatch({ type: 'setCopied', value: false }), 2000)
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
			} catch (error) {
				console.log('Failed to copy content:', error)
			}
		}
	}, [content, copyContext, isDarkMode])

	if (!messageId) return null

	return (
		<>
			<div
				className={`flex items-center gap-0.5 pb-3${isLatest ? '' : ' opacity-0 transition-opacity duration-150 group-hover/msg:opacity-100 focus-within:opacity-100'}`}
			>
				{content ? (
					<Tooltip
						content={copied ? 'Copied' : 'Copy'}
						render={
							<button
								type="button"
								onClick={() => {
									void handleCopy()
								}}
							/>
						}
						className="rounded-md p-1.5 text-ai-muted transition-colors hover:bg-ai-hover hover:text-ai-secondary"
					>
						{copied ? (
							<Icon name="check-circle" height={16} width={16} />
						) : (
							<Icon name="clipboard" height={16} width={16} />
						)}
					</Tooltip>
				) : null}
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
							className={`rounded-md p-1.5 transition-colors hover:bg-ai-hover hover:text-ai-secondary ${isRatedAsGood ? 'text-success' : 'text-ai-muted'}`}
						>
							<Icon name="thumbs-up" height={16} width={16} />
							<span className="sr-only">Thumbs Up</span>
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
							className={`rounded-md p-1.5 transition-colors hover:bg-ai-hover hover:text-ai-secondary ${isRatedAsBad ? 'text-error' : 'text-ai-muted'}`}
						>
							<Icon name="thumbs-down" height={16} width={16} />
							<span className="sr-only">Thumbs Down</span>
						</Tooltip>
					</>
				) : null}
				{content && sessionId && !readOnly ? (
					<PDFExportButton
						sessionId={sessionId}
						messageId={messageId}
						exportType="single_message"
						className="flex items-center gap-1 rounded-md p-1.5 text-ai-muted transition-colors hover:bg-ai-hover hover:text-ai-secondary"
					/>
				) : null}
				{messageMetadata && (messageMetadata.outputTokens != null || messageMetadata.x402CostUsd) ? (
					<Ariakit.PopoverProvider placement="top">
						<Ariakit.PopoverDisclosure className="rounded-md p-1.5 text-ai-muted transition-colors hover:bg-ai-hover hover:text-ai-secondary">
							<Icon name="circle-help" height={16} width={16} />
						</Ariakit.PopoverDisclosure>
						<Ariakit.Popover
							className="z-50 rounded-lg border border-ai-line bg-surface p-3 shadow-lg"
							portal
							gutter={8}
						>
							<div className="flex flex-col gap-1.5 text-xs text-ai-secondary">
								{messageMetadata.outputTokens != null ? (
									<div className="flex justify-between gap-4">
										<span className="text-ai-muted">Output</span>
										<span className="font-mono tabular-nums">{formatNumber(messageMetadata.outputTokens)} tokens</span>
									</div>
								) : null}
								{messageMetadata.executionTimeMs ? (
									<div className="flex justify-between gap-4">
										<span className="text-ai-muted">Time</span>
										<span className="font-mono tabular-nums">
											{formatFixedNumber(messageMetadata.executionTimeMs / 1000, 1)}s
										</span>
									</div>
								) : null}
								{messageMetadata.x402CostUsd ? (
									<div className="flex justify-between gap-4">
										<span className="text-ai-muted">Premium data</span>
										<span className="font-mono text-ai-warning tabular-nums">
											{formatUsd(parseFloat(messageMetadata.x402CostUsd), {
												minimumFractionDigits: 3,
												maximumFractionDigits: 3
											})}
										</span>
									</div>
								) : null}
							</div>
						</Ariakit.Popover>
					</Ariakit.PopoverProvider>
				) : null}
				{!readOnly ? (
					<Tooltip
						content="Provide Feedback"
						render={
							<button type="button" onClick={handleOpenGeneralFeedback} disabled={showFeedback || !!submittedRating} />
						}
						className="rounded-md p-1.5 text-ai-muted transition-colors hover:bg-ai-hover hover:text-ai-secondary"
					>
						<Icon name="message-square-warning" height={16} width={16} />
						<span className="sr-only">Provide Feedback</span>
					</Tooltip>
				) : null}
				{sessionId && !readOnly && onShare ? (
					<Tooltip
						content="Share"
						render={<button type="button" onClick={() => onShare(messageId)} />}
						className="rounded-md p-1.5 text-ai-muted transition-colors hover:bg-ai-hover hover:text-ai-secondary"
					>
						<Icon name="share" height={16} width={16} />
						<span className="sr-only">Share</span>
					</Tooltip>
				) : null}
				{openArticleExport && articleExportRequest && !readOnly ? (
					<Tooltip
						content="Export to research article"
						render={<button type="button" onClick={() => openArticleExport(articleExportRequest())} />}
						className="rounded-md p-1.5 text-ai-muted transition-colors hover:bg-ai-hover hover:text-ai-secondary"
					>
						<Icon name="file-plus" height={16} width={16} />
						<span className="sr-only">Export to research article</span>
					</Tooltip>
				) : null}
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
