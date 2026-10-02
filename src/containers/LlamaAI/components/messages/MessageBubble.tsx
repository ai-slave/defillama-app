import { Suspense, useMemo, useState, type ComponentProps, type RefCallback } from 'react'
import { stepsForMessage } from '~/containers/LlamaAI/agentSteps'
import { useLlamaAIChrome } from '~/containers/LlamaAI/chrome'
import { AlertArtifact, AlertArtifactLoading } from '~/containers/LlamaAI/components/AlertArtifact'
import { DeferredChartRenderer } from '~/containers/LlamaAI/components/charts/DeferredChartRenderer'
import { CSVExportArtifact } from '~/containers/LlamaAI/components/CSVExportArtifact'
import { FreeLimitCard } from '~/containers/LlamaAI/components/FreeLimitCard'
import { ImagePreviewModal } from '~/containers/LlamaAI/components/ImagePreviewModal'
import { TextChip } from '~/containers/LlamaAI/components/input/ImageUpload'
import { ChatMarkdownRenderer, SourcesList } from '~/containers/LlamaAI/components/markdown/ChatMarkdownRenderer'
import { MarkdownExportArtifact } from '~/containers/LlamaAI/components/MarkdownExportArtifact'
import { BranchArrows } from '~/containers/LlamaAI/components/messages/BranchControls'
import { ActionButtonGroup } from '~/containers/LlamaAI/components/messages/MessageActionGroup'
import { ResponseErrorBoundary } from '~/containers/LlamaAI/components/messages/ResponseErrorBoundary'
import { PastedContentModal } from '~/containers/LlamaAI/components/PastedContentModal'
import { UsageLimitActions } from '~/containers/LlamaAI/components/ResearchLimitModal'
import { ResponseControls } from '~/containers/LlamaAI/components/ResponseControls'
import { AgentTimeline } from '~/containers/LlamaAI/components/status/AgentTimeline'
import { useHackerMode } from '~/containers/LlamaAI/components/status/useHackerMode'
import { useAdvancedProvenance } from '~/containers/LlamaAI/hooks/useLlamaAISettings'
import {
	parseMessageToRenderModel,
	type ArtifactRecord,
	type MessageRenderBlock
} from '~/containers/LlamaAI/renderModel'
import type { DashboardArtifact, Message } from '~/containers/LlamaAI/types'
import { buildMessageExportRequest } from '~/containers/LlamaAI/utils/articleExport'
import { readFilePreview, readUrlPreview, type AttachmentPreview } from '~/containers/LlamaAI/utils/attachmentPreview'
import { getOwnRegistryValue } from '~/containers/LlamaAI/utils/getOwnRegistryValue'
import { wrapLegacyUrlCitations } from '~/containers/LlamaAI/utils/markdownHelpers'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import { Tooltip } from '~/ui/Tooltip'

// Keyboard hints under the edit box.
const KBD = 'rounded-sm border border-medium bg-surface-elevated-1 px-1 py-px mono-sm text-secondary'

// Every state of a chart takes the finished chart's box (its card and 360px body), so nothing jumps when it lands.
function StreamingChartPlaceholder() {
	return (
		<div
			role="status"
			className="flex h-[360px] flex-col items-center justify-center gap-2 rounded-lg border border-subtle bg-surface body-sm text-tertiary"
		>
			<LoadingSpinner size={16} />
			<p>Loading chart…</p>
		</div>
	)
}

// Every state of a generated image takes the finished image's frame (max-w-sm, its aspect ratio or square).
const IMAGE_FRAME =
	'relative my-2 w-full max-w-sm overflow-hidden rounded-lg border border-medium bg-surface-elevated-2'

function StreamingImagePlaceholder() {
	return (
		<div className={`${IMAGE_FRAME} flex items-center justify-center`} style={{ aspectRatio: '1 / 1' }}>
			<div
				aria-hidden="true"
				className="absolute inset-0 bg-linear-to-br from-brand/10 via-brand/5 to-transparent motion-safe:animate-pulse"
			/>
			<div role="status" className="relative flex flex-col items-center gap-1.5 body-sm text-tertiary">
				<Icon name="image-plus" height={20} width={20} />
				<p>Generating image…</p>
			</div>
		</div>
	)
}

function parseAspectRatio(size?: string): string | undefined {
	if (!size) return undefined
	const match = size.match(/^(\d+)x(\d+)$/)
	if (!match) return undefined
	return `${match[1]} / ${match[2]}`
}

function GeneratedImageBlock({
	url,
	prompt,
	size,
	onImageClick
}: {
	url: string
	prompt?: string
	size?: string
	onImageClick?: (url: string) => void
}) {
	const [loaded, setLoaded] = useState(false)
	const [errored, setErrored] = useState(false)
	const aspect = parseAspectRatio(size)
	const interactive = !errored && !!onImageClick

	if (errored) {
		return (
			<div
				role="img"
				aria-label={prompt ? `Failed to load generated image for prompt: ${prompt}` : 'Failed to load generated image'}
				className={`${IMAGE_FRAME} flex flex-col items-center justify-center gap-2 p-6 text-center text-secondary`}
				style={{ aspectRatio: aspect ?? '1 / 1' }}
			>
				<Icon name="alert-triangle" height={20} width={20} className="text-data-down" />
				<p className="label-md text-data-down">Image failed to load</p>
				<a
					href={url}
					target="_blank"
					rel="noopener noreferrer"
					className="text-xs underline opacity-80 hover:opacity-100"
				>
					Open original
				</a>
			</div>
		)
	}

	return (
		<button
			type="button"
			onClick={() => (interactive && url ? onImageClick?.(url) : undefined)}
			title={prompt}
			aria-label={prompt || 'Generated image'}
			disabled={!interactive}
			className={`group/genimg ${IMAGE_FRAME} block focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden ${interactive ? 'cursor-pointer not-disabled:not-aria-disabled:hover:border-strong' : 'cursor-default'}`}
			style={aspect ? { aspectRatio: aspect } : undefined}
		>
			{!loaded ? (
				<div
					aria-hidden="true"
					className="absolute inset-0 bg-linear-to-br from-brand/10 via-brand/5 to-transparent motion-safe:animate-pulse"
				/>
			) : null}
			<img
				src={url}
				alt={prompt || 'Generated image'}
				loading="lazy"
				decoding="async"
				onLoad={() => setLoaded(true)}
				onError={() => setErrored(true)}
				className={`block h-auto w-full motion-safe:transition-opacity motion-safe:duration-150 ${loaded ? 'opacity-100' : 'opacity-0'}`}
			/>
		</button>
	)
}

function ArtifactBlockRenderer({
	block,
	artifact,
	isStreaming,
	sessionId,
	messageId,
	readOnly,
	onImageClick
}: {
	block: Extract<MessageRenderBlock, { type: 'chart' | 'csv' | 'md' | 'alert' | 'dashboard' | 'image' }>
	artifact?: ArtifactRecord
	isStreaming: boolean
	sessionId?: string | null
	messageId?: string
	readOnly?: boolean
	onImageClick?: (url: string) => void
}) {
	if (block.type === 'chart') {
		// Inline chart placeholders may arrive before the chart event, so keep rendering a skeleton until the artifact resolves.
		if (!artifact) {
			return isStreaming ? <StreamingChartPlaceholder /> : null
		}
		if (artifact.type !== 'chart') return null
		return (
			<Suspense fallback={<StreamingChartPlaceholder />}>
				<DeferredChartRenderer
					charts={artifact.charts}
					chartData={artifact.chartData}
					sessionId={sessionId}
					messageId={messageId}
					readOnly={readOnly}
					artifactRefs={artifact.artifactRef ? { [artifact.id]: artifact.artifactRef } : undefined}
				/>
			</Suspense>
		)
	}

	if (block.type === 'csv') {
		if (!artifact || isStreaming) return null
		if (artifact.type !== 'csv') return null
		return (
			<CSVExportArtifact
				csvExport={{
					id: artifact.id,
					title: artifact.title,
					url: artifact.url,
					rowCount: artifact.rowCount,
					filename: artifact.filename
				}}
				sessionId={sessionId}
				messageId={messageId}
			/>
		)
	}

	if (block.type === 'md') {
		if (!artifact || isStreaming) return null
		if (artifact.type !== 'md') return null
		return (
			<MarkdownExportArtifact
				mdExport={{
					id: artifact.id,
					title: artifact.title,
					url: artifact.url,
					filename: artifact.filename
				}}
				sessionId={sessionId}
				messageId={messageId}
			/>
		)
	}

	if (block.type === 'dashboard') {
		if (!artifact || artifact.type !== 'dashboard') return null
		return <DashboardInlineCard dashboard={artifact.dashboard} />
	}

	if (block.type === 'image') {
		if (!artifact) {
			return isStreaming ? <StreamingImagePlaceholder /> : null
		}
		if (artifact.type !== 'image') return null
		return (
			<GeneratedImageBlock
				url={artifact.image.url}
				prompt={artifact.image.prompt}
				size={artifact.image.size}
				onImageClick={onImageClick}
			/>
		)
	}

	if (!artifact) {
		return isStreaming ? <AlertArtifactLoading /> : null
	}
	if (artifact.type !== 'alert') return null

	return (
		<AlertArtifact
			alertId={artifact.id}
			defaultTitle={artifact.title}
			alertIntent={{ ...artifact.alert.alertIntent, detected: true, toolExecutions: [] }}
			messageId={artifact.messageId}
			savedAlertIds={artifact.savedAlertIds}
			prompt={artifact.alert.prompt}
		/>
	)
}

function MessageContentBlock({
	block,
	artifact,
	isStreaming,
	showStreamingCaret,
	sessionId,
	onActionClick,
	nextUserMessage,
	hackerMode,
	advancedProvenance,
	onTableFullscreenOpen,
	messageId,
	readOnly,
	onImageClick
}: {
	block: MessageRenderBlock
	artifact?: ArtifactRecord
	isStreaming: boolean
	showStreamingCaret: boolean
	sessionId?: string | null
	onActionClick?: (message: string) => void
	nextUserMessage?: string
	hackerMode?: boolean
	advancedProvenance?: boolean
	onTableFullscreenOpen?: () => void
	messageId?: string
	readOnly?: boolean
	onImageClick?: (url: string) => void
}) {
	if (block.type === 'action-group') {
		return <ActionButtonGroup actions={block.actions} onActionClick={onActionClick} nextUserMessage={nextUserMessage} />
	}

	if (block.type === 'markdown') {
		return (
			<ChatMarkdownRenderer
				content={block.content}
				citations={block.citations}
				legacyUrlCitations={block.legacyUrlCitations}
				isStreaming={isStreaming}
				showStreamingCaret={showStreamingCaret}
				paceReveal
				hackerMode={hackerMode}
				advancedProvenance={advancedProvenance}
				onTableFullscreenOpen={onTableFullscreenOpen}
				messageId={messageId}
			/>
		)
	}

	if (block.type === 'sources') {
		return <SourcesList citations={block.citations} isStreaming={isStreaming} />
	}

	return (
		<ArtifactBlockRenderer
			block={block}
			artifact={artifact}
			isStreaming={isStreaming}
			sessionId={sessionId}
			messageId={messageId}
			readOnly={readOnly}
			onImageClick={onImageClick}
		/>
	)
}

function InlineContent({
	message,
	isStreaming = false,
	sessionId,
	onActionClick,
	nextUserMessage,
	hackerMode,
	advancedProvenance,
	onTableFullscreenOpen,
	onImageClick,
	readOnly
}: {
	message: Message
	isStreaming?: boolean
	sessionId?: string | null
	onActionClick?: (message: string) => void
	nextUserMessage?: string
	hackerMode?: boolean
	advancedProvenance?: boolean
	readOnly?: boolean
	onTableFullscreenOpen?: () => void
	onImageClick?: (url: string) => void
}) {
	const includeFallbackArtifacts = !isStreaming
	const { artifactsById, blocks } = useMemo(
		() => parseMessageToRenderModel(message, { includeFallbackArtifacts }),
		[includeFallbackArtifacts, message]
	)

	return (
		<div className="flex flex-col gap-2.5" style={isStreaming ? { overflowAnchor: 'none' } : undefined}>
			{blocks.map((block, index) => (
				<div key={block.key}>
					<MessageContentBlock
						block={block}
						artifact={'artifactId' in block ? artifactsById.get(block.artifactId) : undefined}
						isStreaming={isStreaming}
						showStreamingCaret={isStreaming && index === blocks.length - 1}
						sessionId={sessionId}
						onActionClick={onActionClick}
						nextUserMessage={nextUserMessage}
						hackerMode={hackerMode}
						advancedProvenance={advancedProvenance}
						onTableFullscreenOpen={onTableFullscreenOpen}
						messageId={message.id}
						readOnly={readOnly}
						onImageClick={onImageClick}
					/>
				</div>
			))}

			{message.freeLimitOffer ? <FreeLimitCard offer={message.freeLimitOffer} /> : null}
			{message.usageLimitOffer ? <UsageLimitActions offer={message.usageLimitOffer} /> : null}
		</div>
	)
}

export function MessageBubble(props: ComponentProps<typeof MessageBubbleContent>) {
	if (props.message.role === 'user') return <MessageBubbleContent {...props} />
	return (
		<ResponseErrorBoundary key={props.message.id}>
			<MessageBubbleContent {...props} />
		</ResponseErrorBoundary>
	)
}

function MessageBubbleContent({
	message,
	sessionId,
	isDraft = false,
	hideTimeline = false,
	readOnly = false,
	hideControls = false,
	isSharedView = false,
	isLlama = false,
	isLatest = false,
	onActionClick,
	onEditMessage,
	onBranchSwitch,
	isBranchSwitching = false,
	nextUserMessage,
	onShare,
	onTableFullscreenOpen,
	anchorId,
	anchorRef,
	anchorClassName,
	enterToSend = true
}: {
	message: Message
	sessionId: string | null
	isDraft?: boolean
	/** The conversation's live status already shows this draft's steps above it. */
	hideTimeline?: boolean
	readOnly?: boolean
	hideControls?: boolean
	isSharedView?: boolean
	isLlama?: boolean
	/** The newest message of its role keeps its controls on screen; older ones reveal them on hover, tap or focus. */
	isLatest?: boolean
	onActionClick?: (message: string) => void
	onEditMessage?: (messageId: string, newText: string, original: Message) => Promise<void>
	onBranchSwitch?: (leafMessageId: string) => void
	isBranchSwitching?: boolean
	nextUserMessage?: string
	onShare?: (messageId?: string) => void
	onTableFullscreenOpen?: () => void
	anchorId?: string
	anchorRef?: RefCallback<HTMLDivElement>
	anchorClassName?: string
	enterToSend?: boolean
}) {
	const [previewImage, setPreviewImage] = useState<string | null>(null)
	const [pastedPreview, setPastedPreview] = useState<AttachmentPreview | null>(null)
	const [isEditing, setIsEditing] = useState(false)
	const [isSaving, setIsSaving] = useState(false)
	const [draftText, setDraftText] = useState(message.content || '')
	const hackerMode = useHackerMode()
	const advancedProvenance = useAdvancedProvenance()
	const handleCancelEdit = () => {
		if (isSaving) return
		setIsEditing(false)
		setDraftText(message.content || '')
	}
	const handleSaveEdit = async () => {
		const next = draftText.trim()
		if (!message.id || !next || next === message.content?.trim() || isSaving) return
		setIsSaving(true)
		// An optional call cannot be lowered inside a try.
		const submitEdit = () => onEditMessage?.(message.id, next, message)
		try {
			await submitEdit()
			setIsEditing(false)
		} catch {
			// textarea stays open with draft preserved; parent rolled back state and surfaced an error
		}
		setIsSaving(false)
	}
	if (message.role === 'user') {
		const isPersistedId = !!message.id && !/^(local|persisted|shared)-/.test(message.id)
		const canEdit = isPersistedId && !!onEditMessage
		const canSwitchBranch = isPersistedId && !!onBranchSwitch
		// Render the controls row before the optimistic id is persisted so the row's
		// height is reserved from the first frame and the response below does not jump.
		const hasControls = !isDraft && !readOnly && (!!onEditMessage || !!onBranchSwitch)
		return (
			<div
				id={anchorId}
				ref={anchorRef}
				// Focusable so a tap on a phone, which has no hover, reveals the message's controls.
				tabIndex={-1}
				className={`group/msg ml-auto flex w-full max-w-[80%] flex-col items-end ${anchorClassName ?? ''}`}
			>
				<div
					className={`${isEditing ? 'w-full' : 'w-fit max-w-full'} rounded-lg rounded-tr-none px-3.5 py-2.5 body-md wrap-break-word text-primary ${
						isEditing ? 'bg-page ring-1 ring-brand' : 'bg-surface-elevated-1'
					}`}
				>
					{message.quotedText ? (
						<div className="mb-2 border-l-2 border-medium py-0.5 pl-2.5">
							<p className="line-clamp-3 body-sm text-secondary">{message.quotedText}</p>
						</div>
					) : null}
					{message.images && message.images.length > 0 ? (
						<div className="mb-2.5 flex flex-wrap gap-3">
							{message.images.map((image) => {
								const isImage = image.mimeType?.startsWith('image/')
								const displayName = image.originalFilename || image.filename || 'File'
								if (isImage) {
									return (
										<button
											key={`sent-image-${image.url}`}
											type="button"
											onClick={() => setPreviewImage(image.url)}
											className="size-16 cursor-pointer overflow-hidden rounded-lg"
										>
											<img src={image.url} alt={displayName} className="size-full object-cover" />
										</button>
									)
								}
								const normalizedMime = image.mimeType?.split(';')[0].trim().toLowerCase()
								const isTextMime =
									normalizedMime === 'text/plain' || normalizedMime === 'text/markdown' || normalizedMime === 'text/csv'
								if (isTextMime) {
									const isPasted = !!image.originalFilename && /^Pasted-\d+/.test(image.originalFilename)
									// The server stores 0 for workspace files whose size it does not retain.
									const sizeBytes = image.size === 0 ? undefined : image.size
									return (
										<TextChip
											key={`sent-file-${image.url}`}
											name={displayName}
											sizeBytes={sizeBytes}
											textContent={image.textContent ?? ''}
											isPasted={isPasted}
											onOpen={async () => {
												const preview =
													typeof image.textContent === 'string'
														? await readFilePreview(
																new File([image.textContent], displayName, { type: image.mimeType })
															)
														: await readUrlPreview(image.url, displayName)
												setPastedPreview({ ...preview, isPasted })
											}}
										/>
									)
								}
								return (
									<a
										key={`sent-file-${image.url}`}
										href={image.url}
										target="_blank"
										rel="noopener noreferrer"
										className="flex h-16 items-center gap-2 rounded-lg border border-medium bg-page px-3 body-sm text-primary hover:bg-hover-row"
									>
										<Icon name="file-text" height={16} width={16} className="text-secondary" />
										<span className="max-w-[120px] truncate">{displayName}</span>
										<Icon name="external-link" height={14} width={14} className="text-tertiary" />
									</a>
								)
							})}
						</div>
					) : null}
					{isEditing ? (
						<textarea
							value={draftText}
							onChange={(event) => setDraftText(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === 'Enter' && event.shiftKey !== enterToSend && !event.nativeEvent.isComposing) {
									event.preventDefault()
									event.stopPropagation()
									void handleSaveEdit()
									return
								}
								if (event.key === 'Escape') {
									event.preventDefault()
									event.stopPropagation()
									handleCancelEdit()
								}
							}}
							className="block w-full resize-none bg-transparent leading-snug focus:outline-hidden"
							rows={Math.min(10, Math.max(2, draftText.split('\n').length + 1))}
							autoFocus
						/>
					) : (
						<p className="whitespace-pre-wrap">{message.content}</p>
					)}
				</div>

				{isEditing ? (
					<div className="mt-2 flex w-full items-center gap-3">
						<p className="mr-auto body-sm text-tertiary">
							{isPersistedId ? 'Saving creates a new branch' : 'This will replace your message'}
							<span className="hidden sm:inline">
								{' · '}
								{enterToSend ? (
									<kbd className={KBD}>Enter</kbd>
								) : (
									<>
										<kbd className={KBD}>Shift</kbd>
										<span className="mx-0.5">+</span>
										<kbd className={KBD}>Enter</kbd>
									</>
								)}
								<span className="mx-1">save</span>
								<kbd className={KBD}>esc</kbd>
								<span className="ml-1">cancel</span>
							</span>
						</p>
						<Button type="button" size="sm" variant="ghost" onClick={handleCancelEdit} disabled={isSaving}>
							Cancel
						</Button>
						<Button
							type="button"
							size="sm"
							variant="primary"
							onClick={handleSaveEdit}
							disabled={isSaving || !draftText.trim() || draftText.trim() === message.content?.trim()}
						>
							{isSaving ? <LoadingSpinner size={12} /> : null}
							{isSaving ? 'Saving…' : 'Save'}
						</Button>
					</div>
				) : hasControls ? (
					<div className="mt-1 flex min-h-[26px] items-center gap-0.5">
						{canSwitchBranch && message.siblingInfo && message.siblingInfo.totalVersions > 1 && onBranchSwitch ? (
							<BranchArrows info={message.siblingInfo} onSwitch={onBranchSwitch} disabled={isBranchSwitching} />
						) : null}
						{canEdit ? (
							// Branch arrows show which version is on screen, so only the edit action hides.
							<span
								className={
									isLatest ? 'flex' : 'flex opacity-0 group-focus-within/msg:opacity-100 group-hover/msg:opacity-100'
								}
							>
								<Tooltip
									content="Edit message"
									render={
										<Button
											type="button"
											size="sm"
											variant="ghost"
											square
											onClick={() => {
												setIsEditing(true)
												setDraftText(message.content || '')
											}}
											aria-label="Edit message"
										/>
									}
								>
									<Icon name="pencil" height={16} width={16} />
								</Tooltip>
							</span>
						) : null}
					</div>
				) : null}

				<ImagePreviewModal
					imageUrl={previewImage}
					onClose={() => setPreviewImage(null)}
					source="user-upload"
					sessionId={sessionId}
					messageId={message.id}
				/>
				<PastedContentModal preview={pastedPreview} onClose={() => setPastedPreview(null)} />
			</div>
		)
	}

	return (
		<div
			id={anchorId}
			ref={anchorRef}
			// Focusable so a tap on a phone, which has no hover, reveals the response's controls.
			tabIndex={-1}
			className={`group/msg flex flex-col gap-2.5 ${anchorClassName ?? ''}`}
		>
			{hideTimeline ? null : (
				<AgentTimeline steps={stepsForMessage(message)} streaming={isDraft} showToolDetails={isLlama} />
			)}
			<InlineContent
				message={readOnly ? { ...message, alerts: undefined } : message}
				isStreaming={isDraft}
				sessionId={sessionId}
				onActionClick={onActionClick}
				nextUserMessage={nextUserMessage}
				hackerMode={hackerMode}
				advancedProvenance={advancedProvenance}
				onTableFullscreenOpen={onTableFullscreenOpen}
				onImageClick={setPreviewImage}
				readOnly={readOnly || isSharedView}
			/>
			<ImagePreviewModal
				imageUrl={previewImage}
				onClose={() => setPreviewImage(null)}
				source="generated"
				sessionId={sessionId}
				messageId={message.id}
			/>
			{message.id &&
			!isDraft &&
			!readOnly &&
			!hideControls &&
			onBranchSwitch &&
			message.siblingInfo &&
			message.siblingInfo.totalVersions > 1 ? (
				<div className="mt-1 -ml-1 flex items-center gap-0.5">
					<BranchArrows info={message.siblingInfo} onSwitch={onBranchSwitch} disabled={isBranchSwitching} />
				</div>
			) : null}
			{message.id && !isDraft && !hideControls ? (
				<ResponseControls
					messageId={message.id}
					timestamp={message.timestamp}
					{...(message.content === undefined ? {} : { content: message.content })}
					copyContext={() => {
						const citations = message.citations?.length
							? message.citations
							: message.legacyUrlCitations?.length
								? wrapLegacyUrlCitations(message.legacyUrlCitations)
								: undefined
						return {
							artifacts: parseMessageToRenderModel(message).artifactsById,
							...(citations === undefined ? {} : { citations })
						}
					}}
					{...(onShare === undefined ? {} : { onShare })}
					sessionId={sessionId}
					readOnly={readOnly}
					{...(message.messageMetadata === undefined ? {} : { messageMetadata: message.messageMetadata })}
					isLatest={isLatest}
					{...(message.content
						? {
								articleExportRequest: () =>
									buildMessageExportRequest({
										markdown: message.content ?? '',
										messageId: message.id as string,
										sessionId,
										chartGroups: message.charts,
										generatedImages: message.generatedImages
									})
							}
						: {})}
				/>
			) : null}
		</div>
	)
}

const KIND_LABELS = {
	chart: 'chart',
	multi: 'multi-chart',
	metric: 'metric',
	builder: 'chart builder',
	text: 'text',
	table: 'table',
	'unified-table': 'table',
	yields: 'yield chart',
	stablecoins: 'stablecoin chart',
	'stablecoin-asset': 'stablecoin chart',
	'advanced-tvl': 'TVL breakdown',
	'advanced-borrowed': 'borrowed chart',
	'income-statement': 'income statement',
	'unlocks-schedule': 'unlock schedule',
	'unlocks-pie': 'unlock pie',
	'llamaai-chart': 'AI chart'
} satisfies Record<string, string>

function DashboardInlineCard({ dashboard }: { dashboard: DashboardArtifact }) {
	const { toggleDashboardPanel, isDashboardPanelOpen } = useLlamaAIChrome()
	const kindCounts: Record<string, number> = {}
	for (const item of dashboard.items) {
		const label = getOwnRegistryValue(KIND_LABELS, item.kind) || item.kind
		kindCounts[label] = (kindCounts[label] || 0) + 1
	}
	const summary = Object.entries(kindCounts)
		.map(([label, count]) => `${count} ${label}${count > 1 ? 's' : ''}`)
		.join(' · ')

	return (
		<button
			type="button"
			onClick={toggleDashboardPanel}
			className="my-2 flex w-full items-center gap-3 rounded-lg border border-subtle bg-surface px-3 py-2.5 text-left not-disabled:not-aria-disabled:hover:bg-hover-row"
		>
			<Icon name="layout-grid" className="size-4 shrink-0 text-link" />
			<div className="min-w-0 flex-1">
				<div className="flex items-center gap-2">
					<span className="truncate label-md text-primary">{dashboard.dashboardName}</span>
					<span className="shrink-0 body-sm text-tertiary">{dashboard.items.length} items</span>
				</div>
				<div className="truncate body-sm text-secondary">{summary}</div>
			</div>
			<Icon name={isDashboardPanelOpen ? 'chevron-right' : 'chevron-left'} className="size-4 shrink-0 text-tertiary" />
		</button>
	)
}
