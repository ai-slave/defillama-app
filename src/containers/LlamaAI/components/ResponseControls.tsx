import * as Ariakit from '@ariakit/react'
import { memo, useCallback, useEffect, useReducer, useRef } from 'react'
import { useArticleExport } from '~/containers/LlamaAI/components/AddToArticle/useArticleExport'
import { FeedbackForm } from '~/containers/LlamaAI/components/FeedbackForm'
import { PDFExportButton } from '~/containers/LlamaAI/components/PDFExportButton'
import type { MessageMetadata } from '~/containers/LlamaAI/types'
import type { ArticleExportRequest } from '~/containers/LlamaAI/utils/articleExport'
import { convertLlamaLinksToDefillama } from '~/containers/LlamaAI/utils/entityLinks'
import { removeReportStartMarkers } from '~/containers/LlamaAI/utils/reportMarkers'
import { Icon } from '~/ui/Icon'
import { Tooltip } from '~/ui/Tooltip'
import { trackUmamiEvent } from '~/utils/analytics/umami'

interface ResponseControlsProps {
	messageId?: string
	content?: string
	articleExportRequest?: () => ArticleExportRequest
	initialRating?: 'good' | 'bad' | null
	sessionId?: string | null
	readOnly?: boolean
	messageMetadata?: MessageMetadata
	isLatest?: boolean
	onShare?: (messageId?: string) => void
}

type Rating = 'good' | 'bad' | null

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
	initialRating,
	sessionId,
	readOnly = false,
	messageMetadata,
	isLatest = false,
	onShare,
	articleExportRequest
}: ResponseControlsProps) {
	const openArticleExport = useArticleExport()
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
		try {
			let convertedContent = convertLlamaLinksToDefillama(content)
			convertedContent = convertedContent
				.replace(/\[CHART:[^\]]+\]\n?/g, '')
				.replace(/\[CSV:[^\]]+\]\n?/g, '')
				.replace(/\[MD:[^\]]+\]\n?/g, '')
				.replace(/\[ACTION:[^\]]+\]\n?/g, '')
				.replace(/\[ALERT:[^\]]+\]\n?/g, '')
				.replace(/\[DASHBOARD:[^\]]+\]\n?/g, '')
				.trim()
			convertedContent = removeReportStartMarkers(convertedContent).trim()
			await navigator.clipboard.writeText(convertedContent)
			dispatch({ type: 'setCopied', value: true })
			if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current)
			copiedTimeoutRef.current = setTimeout(() => dispatch({ type: 'setCopied', value: false }), 2000)
		} catch (error) {
			console.log('Failed to copy content:', error)
		}
	}, [content])

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
							render={<button onClick={handleRateGood} disabled={showFeedback || isRatedAsGood || isRatedAsBad} />}
							className={`rounded-md p-1.5 transition-colors hover:bg-ai-hover hover:text-ai-secondary ${isRatedAsGood ? 'text-success' : 'text-ai-muted'}`}
						>
							<Icon name="thumbs-up" height={16} width={16} />
							<span className="sr-only">Thumbs Up</span>
						</Tooltip>
						<Tooltip
							content={isRatedAsBad ? 'Rated as bad' : 'Rate as bad'}
							render={<button onClick={handleRateBad} disabled={showFeedback || isRatedAsGood || isRatedAsBad} />}
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
										<span className="font-mono tabular-nums">
											{messageMetadata.outputTokens.toLocaleString()} tokens
										</span>
									</div>
								) : null}
								{messageMetadata.executionTimeMs ? (
									<div className="flex justify-between gap-4">
										<span className="text-ai-muted">Time</span>
										<span className="font-mono tabular-nums">
											{(messageMetadata.executionTimeMs / 1000).toFixed(1)}s
										</span>
									</div>
								) : null}
								{messageMetadata.x402CostUsd ? (
									<div className="flex justify-between gap-4">
										<span className="text-ai-muted">Premium data</span>
										<span className="font-mono text-ai-warning tabular-nums">
											${parseFloat(messageMetadata.x402CostUsd).toFixed(3)}
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
						render={<button onClick={handleOpenGeneralFeedback} disabled={showFeedback || !!submittedRating} />}
						className="rounded-md p-1.5 text-ai-muted transition-colors hover:bg-ai-hover hover:text-ai-secondary"
					>
						<Icon name="message-square-warning" height={16} width={16} />
						<span className="sr-only">Provide Feedback</span>
					</Tooltip>
				) : null}
				{sessionId && !readOnly && onShare ? (
					<Tooltip
						content="Share"
						render={<button onClick={() => onShare(messageId)} />}
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
