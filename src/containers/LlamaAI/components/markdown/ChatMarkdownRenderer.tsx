import * as Ariakit from '@ariakit/react'
import {
	type ComponentPropsWithoutRef,
	type ReactNode,
	createContext,
	createElement,
	useContext,
	useMemo,
	useRef,
	useState,
	useSyncExternalStore
} from 'react'
import type { Components } from 'react-markdown'
import { CSVDownloadButton } from '~/components/CsvDownloadButton'
import { readTableRows, TableImageButtons } from '~/components/TableImage/TableImageButtons'
import { EntityPreviewLink } from '~/containers/Articles/renderer/EntityPreviewLink'
import type { ArticleEntityType } from '~/containers/Articles/types'
import { CitationPill, PendingCitationMarker } from '~/containers/LlamaAI/components/messages/CitationPill'
import type { UnifiedCitationReference } from '~/containers/LlamaAI/types'
import { getEntityUrl } from '~/containers/LlamaAI/utils/entityLinks'
import {
	allowLlamaAIExternalHostname,
	getLlamaAIExternalAllowlistSnapshot,
	isLlamaAIExternalLink,
	parseLlamaAIExternalAllowlistSnapshot
} from '~/containers/LlamaAI/utils/externalLinks'
import { getOwnRegistryValue } from '~/containers/LlamaAI/utils/getOwnRegistryValue'
import {
	escapeBareOrderedListMarkers,
	extractLlamaLinks,
	normalizeSourceUrl,
	wrapLegacyUrlCitations
} from '~/containers/LlamaAI/utils/markdownHelpers'
import { ExternalLinkInterstitial } from '~/containers/ProDashboard/components/ExternalLinkInterstitial'
import { subscribeToLocalStorage } from '~/contexts/LocalStorage'
import { Button, buttonStyles } from '~/ui/Button'
import { DialogCloseButton } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'
import { popoverMenuItemStyles } from '~/ui/Popover'
import { trackUmamiEvent } from '~/utils/analytics/umami'
import { equityIconUrl } from '~/utils/icons'
import styles from '../../LlamaAIChat.module.css'
import { MarkdownOrderedList } from './MarkdownOrderedList'
import { createSegmentProcessors, createSegmentRenderer } from './markdownSegments'
import { rehypeCitationMarkers } from './rehypeCitationMarkers'
import { rehypeHeadingIds } from './rehypeHeadingIds'
import { rehypeStreamingCaret } from './rehypeStreamingCaret'
import { SANITIZE_REHYPE_PLUGINS } from './sanitizeConfig'
import { useStreamReveal } from './useStreamReveal'

function extractText(children: ReactNode): string {
	if (typeof children === 'string') return children
	if (typeof children === 'number') return String(children)
	if (Array.isArray(children)) return children.map(extractText).join('')
	if (children && typeof children === 'object' && 'props' in children) {
		return extractText((children as any).props.children)
	}
	return ''
}

function HeadingWithId({
	level,
	messageId,
	id,
	children,
	...props
}: {
	level: number
	messageId?: string
	id: string
	children?: ReactNode
} & Record<string, any>) {
	const attrs: Record<string, any> = { ...props, id, 'data-section-heading': true }
	if (level === 2 && messageId) {
		attrs['data-section-msg'] = messageId
	}
	return createElement(`h${level}`, attrs, children)
}

/** Match `HBarChart` / `TreemapChart` graphic watermark sizing */
// Matches the chat chart toolbar so a table and a chart in the same message read alike.
const TABLE_TOOLBAR_ICON_BUTTON = buttonStyles({ size: 'md', square: true })
const TABLE_TOOLBAR_BUTTON = buttonStyles({ size: 'md' })

const TABLE_WATERMARK_HEIGHT = 40
const TABLE_WATERMARK_WIDTH = Math.round((389 / 133) * TABLE_WATERMARK_HEIGHT)

type EntityLinkProps = ComponentPropsWithoutRef<'a'> & {
	onExternalLinkClick?: (href: string) => void
	allowedExternalHosts?: ReadonlySet<string>
}
type MarkdownAnchorProps = EntityLinkProps & { node?: unknown }
type MarkdownTableProps = ComponentPropsWithoutRef<'table'> & { node?: unknown }
type MarkdownCellProps = ComponentPropsWithoutRef<'th'> & { node?: unknown }
type MarkdownDataCellProps = ComponentPropsWithoutRef<'td'> & { node?: unknown }
type MarkdownListProps = ComponentPropsWithoutRef<'ul'> & { node?: unknown }

const LLAMA_PREVIEW_ENTITY_TYPES = {
	protocol: 'protocol',
	subprotocol: 'protocol',
	chain: 'chain',
	category: 'category',
	stablecoin: 'stablecoin',
	cex: 'cex'
} satisfies Record<string, ArticleEntityType>

function TableWrapper({
	children,
	isStreaming = false,
	tableProps,
	onTableFullscreenOpen,
	messageId
}: {
	children: ReactNode
	isStreaming: boolean
	tableProps?: ComponentPropsWithoutRef<'table'>
	onTableFullscreenOpen?: () => void
	messageId?: string
}) {
	const tableRef = useRef<HTMLDivElement>(null)
	const fullscreenDialogStore = Ariakit.useDialogStore()

	const mergedTableClassName = `z-10 w-full border-collapse border border-medium body-sm ${tableProps?.className ?? ''}`
	const inlineTableClassName = `llamaai-table-inline ${mergedTableClassName}`
	const fullscreenTableClassName = `llamaai-table-fullscreen ${mergedTableClassName}`

	const openTableFullscreen = () => {
		onTableFullscreenOpen?.()
		fullscreenDialogStore.show()
	}

	const prepareCsv = () => {
		const table = tableRef.current?.querySelector('table')
		if (!table) return { filename: 'table', rows: [] }

		const rows: Array<Array<string>> = []
		const tableRows = Array.from(table.querySelectorAll('tr'))

		for (const row of tableRows) {
			const cells = Array.from(row.querySelectorAll('th, td'))
			rows.push(cells.map((cell) => cell.textContent || ''))
		}

		const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
		const filename = `table-${timestamp}`
		const headerRow = rows[0] ?? []
		trackUmamiEvent('llamaai-download', {
			kind: 'table-csv',
			filename,
			rowCount: Math.max(0, rows.length - 1),
			columns: headerRow.join('|').slice(0, 480),
			messageId: messageId ?? ''
		})
		return { filename, rows }
	}

	const getImageSource = () => {
		const table = tableRef.current?.querySelector('table')
		const rows = readTableRows(table ?? null)
		if (rows.length === 0) return null
		trackUmamiEvent('llamaai-download', {
			kind: 'table-png',
			rowCount: Math.max(0, rows.length - 1),
			columns: (rows[0] ?? []).join('|').slice(0, 480),
			messageId: messageId ?? ''
		})
		return { rows }
	}

	return (
		<div className="flex flex-col gap-2 rounded-lg border border-subtle p-2">
			<Ariakit.DialogProvider store={fullscreenDialogStore}>
				<Ariakit.Dialog
					modal
					portal
					unmountOnHide
					aria-label="Table"
					className="fixed inset-0 z-50 m-auto flex max-h-[80dvh] w-[calc(100vw-1rem)] max-w-7xl flex-col gap-3 overflow-hidden rounded-xl border border-medium bg-overlay shadow-dialog sm:w-[calc(100vw-2rem)] dark:shadow-dialog-deep"
				>
					<div className="flex shrink-0 items-center justify-end gap-2 border-b border-subtle px-2 py-1">
						<DialogCloseButton ariaLabel="Close fullscreen table" />
					</div>
					<div className="min-h-0 flex-1 overflow-auto overscroll-contain">
						<div className="relative">
							<div className="pointer-events-none sticky left-0 z-0 h-0 w-full max-sm:hidden" style={{ top: '50%' }}>
								<img
									src="/assets/defillama-dark-neutral.webp"
									alt=""
									height={TABLE_WATERMARK_HEIGHT}
									width={TABLE_WATERMARK_WIDTH}
									className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-30 dark:hidden"
								/>
								<img
									src="/assets/defillama-light-neutral.webp"
									alt=""
									height={TABLE_WATERMARK_HEIGHT}
									width={TABLE_WATERMARK_WIDTH}
									className="absolute left-1/2 hidden -translate-x-1/2 -translate-y-1/2 opacity-30 dark:block"
								/>
							</div>
							<table {...tableProps} className={fullscreenTableClassName}>
								{children}
							</table>
						</div>
					</div>
				</Ariakit.Dialog>
			</Ariakit.DialogProvider>
			<div className="ml-auto flex flex-nowrap items-center justify-end gap-2" id="ai-table-download">
				{isStreaming ? (
					<button type="button" className={TABLE_TOOLBAR_ICON_BUTTON} disabled aria-label="View table fullscreen">
						<Icon name="expand" className="size-4 shrink-0" />
					</button>
				) : (
					<button
						type="button"
						onClick={openTableFullscreen}
						className={TABLE_TOOLBAR_ICON_BUTTON}
						aria-label="View table fullscreen"
					>
						<Icon name="expand" className="size-4 shrink-0" />
					</button>
				)}
				<TableImageButtons
					getSource={getImageSource}
					disabled={isStreaming}
					buttonClassName={TABLE_TOOLBAR_BUTTON}
					triggerLabel="Export"
					csvSlot={
						isStreaming ? null : (
							<CSVDownloadButton prepareCsv={prepareCsv} replaceClassName className={popoverMenuItemStyles}>
								<span>Download CSV</span>
							</CSVDownloadButton>
						)
					}
				/>
			</div>
			<div ref={tableRef} className="relative overflow-x-auto">
				<div className="pointer-events-none sticky left-0 z-0 h-0 w-full max-sm:hidden" style={{ top: '50%' }}>
					<img
						src="/assets/defillama-dark-neutral.webp"
						alt="defillama"
						height={TABLE_WATERMARK_HEIGHT}
						width={TABLE_WATERMARK_WIDTH}
						className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-30 dark:hidden"
					/>
					<img
						src="/assets/defillama-light-neutral.webp"
						alt="defillama"
						height={TABLE_WATERMARK_HEIGHT}
						width={TABLE_WATERMARK_WIDTH}
						className="absolute left-1/2 hidden -translate-x-1/2 -translate-y-1/2 opacity-30 dark:block"
					/>
				</div>
				<table {...tableProps} className={inlineTableClassName}>
					{children}
				</table>
			</div>
		</div>
	)
}

function EntityLinkRenderer({
	href,
	children,
	onClick,
	onExternalLinkClick,
	allowedExternalHosts,
	...props
}: EntityLinkProps) {
	if (href?.startsWith('llama://')) {
		const [type, slug] = href.replace('llama://', '').split('/')

		if (
			!type ||
			!slug ||
			!['protocol', 'subprotocol', 'chain', 'pool', 'category', 'stablecoin', 'cex', 'equity'].includes(type)
		) {
			return <span>{children}</span>
		}

		const entityUrl = getEntityUrl(type, slug)
		const articleEntityType = getOwnRegistryValue(LLAMA_PREVIEW_ENTITY_TYPES, type)

		if (articleEntityType) {
			return (
				<EntityPreviewLink
					entity={{
						entityType: articleEntityType,
						slug,
						label: extractText(children) || slug,
						route: entityUrl
					}}
				>
					{children}
				</EntityPreviewLink>
			)
		}

		const [equityTicker, equityCountry] = type === 'equity' ? slug.split(':') : []
		const logoUrl = type === 'equity' ? equityIconUrl(equityTicker, equityCountry || 'US') : null
		return (
			<a
				href={entityUrl}
				className="text-link no-underline hover:underline"
				target="_blank"
				rel="noreferrer noopener"
				onClick={onClick}
				{...props}
			>
				{logoUrl ? (
					<img
						src={logoUrl}
						alt=""
						height={14}
						width={14}
						className="relative top-[-0.1em] mr-1 inline-block shrink-0 rounded-full"
					/>
				) : null}
				<span className="min-w-0">{children}</span>
			</a>
		)
	}
	const external = isLlamaAIExternalLink(href, allowedExternalHosts)
	return (
		<a
			href={href}
			target="_blank"
			rel={external ? 'noopener noreferrer nofollow ugc' : 'noreferrer noopener'}
			className="text-link no-underline hover:underline"
			onClick={(event) => {
				onClick?.(event)
				if (event.defaultPrevented) return
				if (external) {
					event.preventDefault()
					onExternalLinkClick?.(href)
				}
			}}
			{...props}
		>
			{children}
		</a>
	)
}

function getSingleTextChild(children: ReactNode): string | null {
	return typeof children === 'string' ? children : null
}

function getCodeLanguage(children: ReactNode): string | null {
	if (!children || typeof children !== 'object' || !('props' in children)) return null
	const className = (children as any).props?.className
	if (typeof className !== 'string') return null
	const match = className.match(/language-(\S+)/)
	return match ? match[1] : null
}

type MarkdownPreProps = ComponentPropsWithoutRef<'pre'> & { node?: unknown }

function CodeBlock({ children, node: _node, className, ...props }: MarkdownPreProps) {
	const [copied, setCopied] = useState(false)
	const language = getCodeLanguage(children)

	const handleCopy = async () => {
		const text = extractText(children)
		if (!text) return
		try {
			await navigator.clipboard.writeText(text)
			setCopied(true)
			setTimeout(() => setCopied(false), 1500)
		} catch {
			// silent
		}
	}

	return (
		<div className="group relative">
			{language ? (
				<span className="pointer-events-none absolute top-2 left-3 z-10 mono-sm text-tertiary select-none">
					{language}
				</span>
			) : null}
			<Button
				type="button"
				size="sm"
				variant="ghost"
				square
				onClick={handleCopy}
				aria-label={copied ? 'Copied' : 'Copy code'}
				data-copied={copied || undefined}
				className="absolute top-1.5 right-1.5 z-10 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-copied:opacity-100"
			>
				<Icon name={copied ? 'check' : 'copy'} height={16} width={16} />
			</Button>
			<pre {...props} className={`${language ? 'pt-8!' : ''} ${className ?? ''}`}>
				{children}
			</pre>
		</div>
	)
}

export function SourcesList({ citations, isStreaming = false }: { citations: Array<string>; isStreaming?: boolean }) {
	const sourceEntries = useMemo(() => {
		const seen = new Map<string, number>()
		const unique: Array<{ normalizedUrl: string; citationNumber: number }> = []
		for (let i = 0; i < citations.length; i++) {
			const normalizedUrl = normalizeSourceUrl(citations[i])
			if (!normalizedUrl) continue
			if (!seen.has(normalizedUrl)) {
				seen.set(normalizedUrl, i + 1)
				unique.push({ normalizedUrl, citationNumber: i + 1 })
			}
		}
		return unique
	}, [citations])

	if (citations.length === 0 || isStreaming) {
		return null
	}

	return (
		<details className="flex flex-col text-sm">
			<summary className="mr-auto flex items-center gap-1 rounded-sm bg-surface-elevated-2 px-2 py-1 text-brand">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
				>
					<path d="M9 17H7A5 5 0 0 1 7 7h2" />
					<path d="M15 7h2a5 5 0 1 1 0 10h-2" />
					<line x1="8" x2="16" y1="12" y2="12" />
				</svg>
				<span>Sources</span>
				<Icon name="chevron-down" height={14} width={14} />
			</summary>
			<div className="flex flex-col gap-2.5 pt-2.5">
				{sourceEntries.map(({ normalizedUrl, citationNumber }) => (
					<a
						key={`citation-${citationNumber}`}
						href={normalizedUrl}
						target="_blank"
						rel="noopener noreferrer"
						className="group flex items-start gap-2.5 rounded-lg border border-subtle p-2 hover:border-brand hover:bg-brand/12 focus-visible:border-brand focus-visible:bg-brand/12"
					>
						<span className="rounded-sm bg-surface-elevated-2 px-1.5 text-brand">{citationNumber}</span>
						<span className="truncate">{normalizedUrl}</span>
					</a>
				))}
			</div>
		</details>
	)
}

interface MarkdownRenderContext {
	allowedExternalHosts: ReadonlySet<string>
	advancedProvenance?: boolean
	citationRefsById: Map<number, UnifiedCitationReference> | null
	isStreaming: boolean
	linkMap: Map<string, string>
	messageId?: string
	onTableFullscreenOpen?: () => void
	setPendingExternalHref: (href: string) => void
}

// react-markdown renders these components in the same pass as ChatMarkdownRenderer, so they read the
// message's render context rather than take it as props: `markdownComponents` below has to stay one
// module-level constant, because react-markdown gets it as a prop on every message in the thread.
const MarkdownRenderContextProvider = createContext<MarkdownRenderContext | null>(null)

// Set inside a table only. A citation marker in a cell reserves its width while its reference is
// pending; in ordinary prose an unresolved marker still shows nothing, and a resolved one still
// shows its domain or handle.
const InTableContext = createContext(false)

function MarkdownHeading({
	level,
	id,
	children,
	...props
}: { level: number; id: string; children: ReactNode } & Record<string, any>) {
	const current = useContext(MarkdownRenderContextProvider)
	if (!current) return createElement(`h${level}`, props, children)
	return (
		<HeadingWithId level={level} messageId={current.messageId} id={id} {...props}>
			{children}
		</HeadingWithId>
	)
}

function MarkdownAnchor(props: EntityLinkProps) {
	const current = useContext(MarkdownRenderContextProvider)
	const textChild = getSingleTextChild(props.children)
	// A bare link whose text names an entity resolves through the message's link map.
	if (current && !props.href && textChild && current.linkMap.has(textChild)) {
		return (
			<EntityLinkRenderer
				{...props}
				href={current.linkMap.get(textChild)}
				onExternalLinkClick={current.setPendingExternalHref}
				allowedExternalHosts={current.allowedExternalHosts}
			/>
		)
	}
	return (
		<EntityLinkRenderer
			{...props}
			onExternalLinkClick={current?.setPendingExternalHref}
			allowedExternalHosts={current?.allowedExternalHosts}
		/>
	)
}

function MarkdownTable({ children, ...props }: ComponentPropsWithoutRef<'table'> & { children?: ReactNode }) {
	const current = useContext(MarkdownRenderContextProvider)
	return (
		<InTableContext.Provider value>
			<TableWrapper
				isStreaming={current?.isStreaming ?? false}
				tableProps={props}
				onTableFullscreenOpen={current?.onTableFullscreenOpen}
				messageId={current?.messageId}
			>
				{children}
			</TableWrapper>
		</InTableContext.Provider>
	)
}

function MarkdownFactCheckPill(props: Record<string, any>) {
	const current = useContext(MarkdownRenderContextProvider)
	const inTable = useContext(InTableContext)
	const raw = props.dataRef ?? props['data-ref']
	if (raw == null) return null
	const numericId = Number(raw)
	if (!Number.isFinite(numericId)) return null
	const ref = current?.citationRefsById?.get(numericId)
	if (!ref) {
		// Only while the answer streams: a marker whose reference never arrives was not a citation, and
		// holding a slot for it forever would show a source that does not exist. Citation ids start at
		// 1, so `[0]` is array syntax in a data cell rather than a reference waiting to land.
		if (!inTable || !current?.isStreaming || numericId < 1) return null
		return <PendingCitationMarker id={numericId} />
	}
	return <CitationPill reference={ref} advancedProvenance={current?.advancedProvenance} numberOnlyMarker={inTable} />
}

// `fact-check-pill` is a custom element the citation remark step emits; `Components` only types the
// standard HTML keys, so the whole map is asserted rather than annotated.
const markdownComponents = {
	h1: ({ node: _node, children, ...props }: any) => (
		<MarkdownHeading level={1} {...props}>
			{children}
		</MarkdownHeading>
	),
	h2: ({ node: _node, children, ...props }: any) => (
		<MarkdownHeading level={2} {...props}>
			{children}
		</MarkdownHeading>
	),
	h3: ({ node: _node, children, ...props }: any) => (
		<MarkdownHeading level={3} {...props}>
			{children}
		</MarkdownHeading>
	),
	a: ({ node: _node, ...props }: MarkdownAnchorProps) => <MarkdownAnchor {...props} />,
	table: ({ children, node: _node, ...props }: MarkdownTableProps) => (
		<MarkdownTable {...props}>{children}</MarkdownTable>
	),
	th: ({ children, node: _node, ...props }: MarkdownCellProps) => (
		<th
			{...props}
			className={`border border-medium bg-surface-elevated-1 px-3 py-2 text-left align-top label-sm whitespace-nowrap text-secondary [.llamaai-table-fullscreen_&]:[overflow-wrap:anywhere] [.llamaai-table-fullscreen_&]:break-words [.llamaai-table-fullscreen_&]:whitespace-normal ${props.className ?? ''}`}
		>
			{children}
		</th>
	),
	td: ({ children, node: _node, ...props }: MarkdownDataCellProps) => (
		<td
			{...props}
			className={`border border-medium bg-surface px-3 py-2 align-top whitespace-nowrap text-primary [.llamaai-table-fullscreen_&]:[overflow-wrap:anywhere] [.llamaai-table-fullscreen_&]:break-words [.llamaai-table-fullscreen_&]:whitespace-normal ${props.className ?? ''}`}
		>
			{children}
		</td>
	),
	ul: ({ children, node: _node, ...props }: MarkdownListProps) => (
		<ul {...props} className={`grid list-disc gap-1 pl-5 ${props.className ?? ''}`}>
			{children}
		</ul>
	),
	ol: MarkdownOrderedList,
	pre: ({ children, ...props }: MarkdownPreProps) => <CodeBlock {...props}>{children}</CodeBlock>,
	'fact-check-pill': MarkdownFactCheckPill
} as Components

export function ChatMarkdownRenderer({
	content,
	citations,
	legacyUrlCitations,
	advancedProvenance,
	isStreaming = false,
	showStreamingCaret = false,
	paceReveal = false,
	hackerMode = false,
	onTableFullscreenOpen,
	messageId
}: {
	content: string
	citations?: Array<UnifiedCitationReference>
	legacyUrlCitations?: Array<string>
	advancedProvenance?: boolean
	isStreaming?: boolean
	showStreamingCaret?: boolean
	/** Type the text out a few characters per frame as it arrives, instead of a chunk at a time. */
	paceReveal?: boolean
	hackerMode?: boolean
	onTableFullscreenOpen?: () => void
	messageId?: string
}) {
	const segments = useMemo(() => createSegmentRenderer(markdownComponents), [])
	const reveal = useStreamReveal(content, paceReveal && isStreaming, segments.lastCostMs)
	const caretActive = showStreamingCaret || reveal.revealing
	// Unfinished text can end mid-marker; finished text is rendered exactly as written.
	const unfinished = isStreaming || reveal.revealing
	const text = reveal.text
	const [pendingExternalHref, setPendingExternalHref] = useState<string | null>(null)
	const externalAllowlistSnapshot = useSyncExternalStore(
		subscribeToLocalStorage,
		getLlamaAIExternalAllowlistSnapshot,
		() => '[]'
	)
	const allowedExternalHosts = useMemo(
		() => parseLlamaAIExternalAllowlistSnapshot(externalAllowlistSnapshot),
		[externalAllowlistSnapshot]
	)
	const renderCitationRefs: Array<UnifiedCitationReference> | undefined = useMemo(() => {
		if (citations && citations.length > 0) return citations
		if (legacyUrlCitations && legacyUrlCitations.length > 0) return wrapLegacyUrlCitations(legacyUrlCitations)
		if (legacyUrlCitations && legacyUrlCitations.length === 0) return []
		return undefined
	}, [citations, legacyUrlCitations])
	const citationRefsById = useMemo(() => {
		if (!renderCitationRefs || renderCitationRefs.length === 0) return null
		const byId = new Map<number, UnifiedCitationReference>()
		for (const ref of renderCitationRefs) byId.set(ref.id, ref)
		return byId
	}, [renderCitationRefs])
	const linkMap = useMemo(() => extractLlamaLinks(text), [text])
	const processedContent = useMemo(() => escapeBareOrderedListMarkers(text), [text])
	// After the sanitize plugins: its schema drops ids it does not know about.
	const processors = useMemo(() => {
		const plugins = [
			...SANITIZE_REHYPE_PLUGINS,
			// Before the heading and caret plugins, which read the finished tree: a marker sitting in a
			// heading or at the end of an answer has to be a pill by the time they walk it.
			[
				rehypeCitationMarkers,
				{ resolvedIds: citationRefsById ? new Set(citationRefsById.keys()) : undefined, reserveInTables: isStreaming }
			],
			[rehypeHeadingIds, { messageId }]
		]
		return {
			...createSegmentProcessors(plugins, [...plugins, [rehypeStreamingCaret, { active: caretActive }]]),
			cacheTableRows: true as const
		}
	}, [caretActive, citationRefsById, isStreaming, messageId])
	const renderContext = useMemo<MarkdownRenderContext>(
		() => ({
			allowedExternalHosts,
			advancedProvenance,
			citationRefsById,
			isStreaming,
			linkMap,
			messageId,
			onTableFullscreenOpen,
			setPendingExternalHref
		}),
		[allowedExternalHosts, advancedProvenance, citationRefsById, isStreaming, linkMap, messageId, onTableFullscreenOpen]
	)

	if (!processedContent.trim()) {
		return null
	}

	return (
		<div
			data-llamaai-prose
			className={`${styles.prose} prose prose-sm flex max-w-none flex-col gap-2.5 overflow-x-auto leading-normal prose-neutral dark:prose-invert prose-headings:font-semibold prose-headings:text-primary prose-p:text-primary prose-a:text-link prose-a:no-underline hover:prose-a:underline prose-blockquote:border-l-2 prose-blockquote:border-brand prose-blockquote:px-3 prose-blockquote:py-0.5 prose-blockquote:text-secondary prose-blockquote:not-italic prose-strong:text-primary prose-code:rounded-sm prose-code:bg-surface-elevated-1 prose-code:px-1 prose-code:py-0.5 prose-code:font-normal prose-code:text-primary prose-code:before:hidden prose-code:after:hidden prose-pre:rounded-lg prose-pre:border prose-pre:border-medium prose-pre:bg-surface-elevated-1 prose-pre:p-3 prose-pre:text-primary prose-li:text-primary prose-img:rounded-lg prose-hr:border-medium [&_pre]:mono-sm [&_pre_code]:bg-transparent [&_pre_code]:p-0${hackerMode ? ` ${styles.hackerMode}` : ''}`}
		>
			<MarkdownRenderContextProvider.Provider value={renderContext}>
				{segments.render(processedContent, processors, unfinished)}
			</MarkdownRenderContextProvider.Provider>
			<ExternalLinkInterstitial
				href={pendingExternalHref}
				onClose={() => setPendingExternalHref(null)}
				onAllowPermanently={(hostname, href) => {
					allowLlamaAIExternalHostname(hostname)
					setPendingExternalHref(null)
					window.open(href, '_blank', 'noopener,noreferrer')
				}}
			/>
		</div>
	)
}
