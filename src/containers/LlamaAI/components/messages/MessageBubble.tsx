import { Suspense, useMemo, useState, type RefCallback } from 'react'
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
import { ToolExecutionPanel } from '~/containers/LlamaAI/components/messages/ToolExecutionPanel'
import { PastedContentModal } from '~/containers/LlamaAI/components/PastedContentModal'
import { ResponseControls } from '~/containers/LlamaAI/components/ResponseControls'
import { ThinkingPanel } from '~/containers/LlamaAI/components/status/ThinkingPanel'
import { useHackerMode } from '~/containers/LlamaAI/components/status/useHackerMode'
import { useAdvancedProvenance } from '~/containers/LlamaAI/hooks/useLlamaAISettings'
import {
	parseMessageToRenderModel,
	type ArtifactRecord,
	type MessageRenderBlock
} from '~/containers/LlamaAI/renderModel'
import type { DashboardArtifact, Message, ToolExecution } from '~/containers/LlamaAI/types'
import { buildMessageExportRequest } from '~/containers/LlamaAI/utils/articleExport'
import { getOwnRegistryValue } from '~/containers/LlamaAI/utils/getOwnRegistryValue'
import { wrapLegacyUrlCitations } from '~/containers/LlamaAI/utils/markdownHelpers'
import { Icon } from '~/ui/Icon'
import { Tooltip } from '~/ui/Tooltip'

function StreamingChartPlaceholder() {
	return (
		<div className="my-4 flex h-[360px] animate-pulse items-center justify-center rounded-lg bg-ai-skeleton">
			<p className="text-sm text-ai-muted">Loading chart...</p>
		</div>
	)
}

function StreamingImagePlaceholder() {
	return (
		<div
			className="my-2 flex w-full max-w-[220px] animate-pulse items-center justify-center overflow-hidden rounded-lg border border-brand/20 bg-brand/5"
			style={{ aspectRatio: '1 / 1' }}
		>
			<div className="flex flex-col items-center gap-1.5 text-brand">
				<Icon name="image-plus" height={24} width={24} />
				<p className="text-xs">Generating image…</p>
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
				className="my-2 flex w-full max-w-sm flex-col items-center justify-center gap-2 rounded-lg border border-ai-error-vivid/20 bg-ai-error-vivid/5 p-6 text-ai-error"
				style={aspect ? { aspectRatio: aspect } : undefined}
			>
				<Icon name="alert-triangle" height={24} width={24} />
				<p className="text-sm font-medium">Image failed to load</p>
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
			className={`group/genimg relative my-2 block w-full max-w-sm overflow-hidden rounded-lg border border-ai-line-medium bg-ai-hover transition focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden ${interactive ? 'cursor-pointer hover:border-ai-line-strong dark:hover:border-ai-inverse/20' : 'cursor-default'}`}
			style={aspect ? { aspectRatio: aspect } : undefined}
		>
			{!loaded ? (
				<div
					aria-hidden="true"
					className="absolute inset-0 animate-pulse bg-linear-to-br from-brand/10 via-brand/5 to-transparent"
				/>
			) : null}
			<img
				src={url}
				alt={prompt || 'Generated image'}
				loading="lazy"
				decoding="async"
				onLoad={() => setLoaded(true)}
				onError={() => setErrored(true)}
				className={`block h-auto w-full transition-all duration-500 ease-out ${loaded ? 'blur-0 scale-100 opacity-100' : 'scale-[1.02] opacity-0 blur-sm'}`}
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
	toolExecutions,
	isStreaming = false,
	sessionId,
	onActionClick,
	nextUserMessage,
	hackerMode,
	advancedProvenance,
	showToolDetails = false,
	onTableFullscreenOpen,
	onImageClick,
	readOnly
}: {
	message: Message
	toolExecutions?: Array<ToolExecution>
	isStreaming?: boolean
	sessionId?: string | null
	onActionClick?: (message: string) => void
	nextUserMessage?: string
	hackerMode?: boolean
	advancedProvenance?: boolean
	showToolDetails?: boolean
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
			{blocks.map((block) => (
				<div key={block.key}>
					<MessageContentBlock
						block={block}
						artifact={'artifactId' in block ? artifactsById.get(block.artifactId) : undefined}
						isStreaming={isStreaming}
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

			{isStreaming && message.content ? <span className="inline-block h-4 w-0.5 animate-pulse bg-brand" /> : null}

			{!isStreaming && toolExecutions && toolExecutions.length > 0 ? (
				<ToolExecutionPanel toolExecutions={toolExecutions} showDetails={showToolDetails} />
			) : null}

			{message.freeLimitOffer ? <FreeLimitCard offer={message.freeLimitOffer} /> : null}
		</div>
	)
}

export function MessageBubble({
	message,
	sessionId,
	isDraft = false,
	readOnly = false,
	hideControls = false,
	isSharedView = false,
	isLlama = false,
	isLatestAssistant = false,
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
	readOnly?: boolean
	hideControls?: boolean
	isSharedView?: boolean
	isLlama?: boolean
	isLatestAssistant?: boolean
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
	const [pastedPreview, setPastedPreview] = useState<{ content: string; filename: string; isPasted?: boolean } | null>(
		null
	)
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
		try {
			await onEditMessage?.(message.id, next, message)
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
				className={`group/msg ml-auto flex w-full max-w-[80%] flex-col items-end ${anchorClassName ?? ''}`}
			>
				<div
					className={`${isEditing ? 'w-full' : 'w-fit max-w-full'} rounded-lg rounded-tr-none px-3.5 py-2.5 wrap-break-word transition-[background-color,box-shadow] duration-150 ${
						isEditing
							? 'bg-ai-white shadow-ai-focus-inset dark:bg-ai-ink'
							: 'bg-ai-surface-muted dark:bg-ai-surface-muted'
					}`}
				>
					{message.quotedText ? (
						<div className="mb-2 border-l-2 border-ai-line-strong py-1 pl-2.5">
							<p className="line-clamp-3 text-[13px] text-ai-tertiary">{message.quotedText}</p>
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
									return (
										<TextChip
											key={`sent-file-${image.url}`}
											name={displayName}
											sizeBytes={image.size ?? 0}
											textContent={image.textContent ?? ''}
											isPasted={isPasted}
											onOpen={async () => {
												let content = image.textContent
												if (typeof content !== 'string') {
													try {
														const res = await fetch(image.url)
														content = res.ok ? await res.text() : ''
													} catch {
														content = ''
													}
												}
												setPastedPreview({ content, filename: displayName, isPasted })
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
										className="flex h-16 items-center gap-2 rounded-lg bg-ai-hover-strong px-3 hover:bg-ai-black/15 dark:bg-ai-white/15"
									>
										<Icon name="file-text" height={18} width={18} />
										<span className="max-w-[120px] truncate text-xs">{displayName}</span>
										<Icon name="external-link" height={12} width={12} className="opacity-50" />
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
						<p className="mr-auto text-[11px] text-ai-muted">
							{isPersistedId ? 'Saving creates a new branch' : 'This will replace your message'}
							<span className="hidden sm:inline">
								{' · '}
								{enterToSend ? (
									<kbd className="rounded-sm border border-ai-line-medium bg-ai-white/70 px-1 py-px font-mono text-[10px] text-ai-tertiary dark:bg-ai-white/5">
										Enter
									</kbd>
								) : (
									<>
										<kbd className="rounded-sm border border-ai-line-medium bg-ai-white/70 px-1 py-px font-mono text-[10px] text-ai-tertiary dark:bg-ai-white/5">
											Shift
										</kbd>
										<span className="mx-0.5">+</span>
										<kbd className="rounded-sm border border-ai-line-medium bg-ai-white/70 px-1 py-px font-mono text-[10px] text-ai-tertiary dark:bg-ai-white/5">
											Enter
										</kbd>
									</>
								)}
								<span className="mx-1">save</span>
								<kbd className="rounded-sm border border-ai-line-medium bg-ai-white/70 px-1 py-px font-mono text-[10px] text-ai-tertiary dark:bg-ai-white/5">
									esc
								</kbd>
								<span className="ml-1">cancel</span>
							</span>
						</p>
						<button
							type="button"
							onClick={handleCancelEdit}
							disabled={isSaving}
							className="rounded-md px-2.5 py-1 text-xs text-ai-tertiary transition-colors hover:bg-ai-hover hover:text-ai-primary disabled:cursor-not-allowed disabled:opacity-40"
						>
							Cancel
						</button>
						<button
							type="button"
							onClick={handleSaveEdit}
							disabled={isSaving || !draftText.trim() || draftText.trim() === message.content?.trim()}
							className="rounded-md bg-ai-accent-blue px-3 py-1 text-xs font-medium text-ai-white transition-colors hover:bg-ai-accent-blue-bright disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-ai-accent-blue"
						>
							{isSaving ? 'Saving…' : 'Save'}
						</button>
					</div>
				) : hasControls ? (
					<div className="mt-1 flex min-h-[26px] items-center gap-0.5 opacity-100 transition-opacity duration-150 sm:opacity-0 sm:group-hover/msg:opacity-100 sm:focus-within:opacity-100">
						{canSwitchBranch && message.siblingInfo && message.siblingInfo.totalVersions > 1 && onBranchSwitch ? (
							<BranchArrows info={message.siblingInfo} onSwitch={onBranchSwitch} disabled={isBranchSwitching} />
						) : null}
						{canEdit ? (
							<Tooltip
								content="Edit message"
								render={
									<button
										type="button"
										onClick={() => {
											setIsEditing(true)
											setDraftText(message.content || '')
										}}
										aria-label="Edit message"
									/>
								}
								className="rounded-md p-1.5 text-ai-muted transition-colors hover:bg-ai-hover hover:text-ai-secondary"
							>
								<Icon name="pencil" height={14} width={14} />
							</Tooltip>
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
		<div id={anchorId} ref={anchorRef} className={`group/msg flex flex-col gap-2.5 ${anchorClassName ?? ''}`}>
			{message.thinking ? <ThinkingPanel thinking={message.thinking} defaultOpen={isDraft} /> : null}
			<InlineContent
				message={readOnly ? { ...message, alerts: undefined } : message}
				toolExecutions={message.toolExecutions}
				isStreaming={isDraft}
				sessionId={sessionId}
				onActionClick={onActionClick}
				nextUserMessage={nextUserMessage}
				hackerMode={hackerMode}
				advancedProvenance={advancedProvenance}
				showToolDetails={isLlama}
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
				<div className="mt-1 flex items-center gap-0.5">
					<BranchArrows info={message.siblingInfo} onSwitch={onBranchSwitch} disabled={isBranchSwitching} />
				</div>
			) : null}
			{message.id && !isDraft && !hideControls ? (
				<ResponseControls
					messageId={message.id}
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
					isLatest={isLatestAssistant}
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
			className="my-2 flex w-full items-center gap-3 rounded-lg border border-ai-action/30 bg-ai-action/5 px-3.5 py-2.5 text-left transition-all hover:border-ai-action/50 hover:bg-ai-action/10"
		>
			<Icon name="layout-grid" className="size-4 shrink-0 text-ai-action" />
			<div className="min-w-0 flex-1">
				<div className="flex items-center gap-2">
					<span className="truncate text-sm font-semibold text-ai-action">{dashboard.dashboardName}</span>
					<span className="shrink-0 text-xs text-ai-tertiary">{dashboard.items.length} items</span>
				</div>
				<div className="truncate text-xs text-ai-tertiary">{summary}</div>
			</div>
			<Icon
				name={isDashboardPanelOpen ? 'chevron-right' : 'chevron-left'}
				className="size-4 shrink-0 text-ai-tertiary"
			/>
		</button>
	)
}
