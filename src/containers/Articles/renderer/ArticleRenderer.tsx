import { common, createLowlight } from 'lowlight'
import Link from 'next/link'
import { createElement, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { ResearchIcon } from '~/components/ResearchIcon'
import { Button } from '~/ui/Button'
import { useCopy } from '~/ui/Copy'
import { Icon } from '~/ui/Icon'
import { Tooltip } from '~/ui/Tooltip'
import { keyedOccurrences } from '~/utils/keyedOccurrences'
import styles from '../ArticleStyles.module.css'
import { validateArticleChartConfig } from '../chartAdapters'
import { articleClientLabel, researchClientHref } from '../clientLabel'
import { normalizeArticleContentJson } from '../document'
import { validateArticlePeoplePanel } from '../editor/peoplePanel'
import { validateEmbedConfig } from '../embedProviders'
import { createArticleEntityRef, isValidArticleEntityType } from '../entityLinks'
import { getTiptapNodeText } from '../extractors'
import { pushResearchAnalyticsEvent } from '../landing/Analytics'
import { DownloadPdfLink } from '../landing/DownloadPdfLink'
import { getArticleBylineAuthorEntries } from '../landing/utils'
import { normalizeQAQuestionNumber } from '../qa'
import type {
	ArticleCalloutTone,
	ArticleCitation,
	ArticleDocument,
	ArticleEntityType,
	LocalArticleDocument,
	TiptapJson,
	TiptapMark
} from '../types'
import { ARTICLE_SECTION_LABELS, ARTICLE_SECTION_SLUGS } from '../types'
import { ArticleChartBlock } from './ArticleChartBlock'
import { ArticleEmbedBlock } from './ArticleEmbedBlock'
import { ArticleImageBanner } from './ArticleImageBanner'
import { ArticleImageBannerHorizontal } from './ArticleImageBannerHorizontal'
import { ArticleImageBlock } from './ArticleImageBlock'
import { ArticlePageAssets } from './ArticlePageAssets'
import { ArticlePeoplePanelBlock } from './ArticlePeoplePanelBlock'
import {
	ArticlePromoBannerMobile,
	ArticlePromoCard,
	cardPromoImageUrl,
	mobilePromoImageUrl,
	usePromoBanner
} from './ArticlePromoBanner'
import { ArticleQAAnswer, ArticleQABlock, ArticleQAQuestion } from './ArticleQABlock'
import { hasStoredColumnWidths, tableCellAttrs } from './articleTable'
import { ArticleTableFrame } from './ArticleTableFrame'
import { EntityPreviewLink } from './EntityPreviewLink'
import { LlamaAIChartBlock } from './LlamaAIChartBlock'

const lowlight = createLowlight(common)

type RenderContext = {
	figureCount: { value: number }
}

function isPdfLink(href: string) {
	return /\.pdf($|[?#])/i.test(href)
}

function stringAttr(attrs: Record<string, unknown> | null | undefined, key: string) {
	const value = attrs?.[key]
	return typeof value === 'string' ? value : undefined
}

function headingSlug(text: string) {
	return (
		text
			.toLowerCase()
			.replace(/[^\w\s-]/g, '')
			.replace(/\s+/g, '-')
			.replace(/-+/g, '-')
			.replace(/^-|-$/g, '') || 'section'
	)
}

function bannerSlotHash(articleId: string): number {
	let hash = 0
	for (let i = 0; i < articleId.length; i++) {
		hash = ((hash << 5) - hash + articleId.charCodeAt(i)) | 0
	}
	return Math.abs(hash)
}

function horizontalBannerSlot(articleId: string, blockCount: number): number {
	if (blockCount < 2) return blockCount
	const maxSlot = Math.min(3, blockCount)
	return (bannerSlotHash(articleId) % maxSlot) + 1
}

function horizontalBannerSecondSlot(articleId: string, blockCount: number, firstSlot: number): number {
	const offset = 4 + (bannerSlotHash(articleId + '#') % 3)
	return Math.min(firstSlot + offset, blockCount)
}

type HastNode =
	| { type: 'text'; value: string }
	| { type: 'element'; tagName: string; properties?: { className?: Array<string> }; children: Array<HastNode> }
	| { type: 'root'; children: Array<HastNode> }

function hastToReact(node: HastNode, key: string): ReactNode {
	if (node.type === 'text') return node.value
	if (node.type === 'root') return node.children.map((c, i) => hastToReact(c, `${key}-${i}`))
	if (node.type === 'element') {
		const className = (node.properties?.className ?? []).join(' ') || undefined
		return createElement(
			node.tagName,
			{ key, className },
			node.children.map((c, i) => hastToReact(c, `${key}-${i}`))
		)
	}
	return null
}

function renderCodeBlock(node: TiptapJson, key: string) {
	const language = stringAttr(node.attrs, 'language') || 'plaintext'
	const code = getTiptapNodeText(node)
	let body: ReactNode = code
	if (language && language !== 'plaintext' && lowlight.registered(language)) {
		try {
			const tree = lowlight.highlight(language, code) as unknown as HastNode
			body = hastToReact(tree, `${key}-hl`)
		} catch {
			// Unknown languages render as plain text.
		}
	}
	return (
		<pre key={key} className="hljs">
			<code className={`language-${language}`}>{body}</code>
		</pre>
	)
}

function applyMark(children: ReactNode, mark: TiptapMark, key: string) {
	if (mark.type === 'bold') return <strong key={key}>{children}</strong>
	if (mark.type === 'italic') return <em key={key}>{children}</em>
	if (mark.type === 'strike') return <s key={key}>{children}</s>
	if (mark.type === 'underline') return <u key={key}>{children}</u>
	if (mark.type === 'highlight')
		return (
			<mark key={key} className="rounded-sm bg-research-highlight px-0.5 text-research-black dark:text-research-gold">
				{children}
			</mark>
		)
	if (mark.type === 'code') return <code key={key}>{children}</code>
	if (mark.type === 'link') {
		const href = stringAttr(mark.attrs, 'href')
		if (!href) return children
		const sameTab = stringAttr(mark.attrs, 'target') === '_self'
		const onClick = isPdfLink(href)
			? () => pushResearchAnalyticsEvent(null, 'export-pdf-research', 'Article body link')
			: undefined
		if (sameTab) {
			return (
				<a key={key} href={href} onClick={onClick}>
					{children}
				</a>
			)
		}
		return (
			<a key={key} href={href} target="_blank" rel="noreferrer noopener" onClick={onClick}>
				{children}
			</a>
		)
	}
	if (mark.type === 'entityLink') {
		const entityType = stringAttr(mark.attrs, 'entityType')
		const slug = stringAttr(mark.attrs, 'slug')
		if (!entityType || !slug || !isValidArticleEntityType(entityType)) return children
		const entity = createArticleEntityRef({
			entityType: entityType as ArticleEntityType,
			slug,
			label: stringAttr(mark.attrs, 'label') || getTiptapNodeText({ type: 'text', text: String(children) }),
			route: stringAttr(mark.attrs, 'route')
		})
		const snapshot =
			mark.attrs && typeof mark.attrs === 'object' ? (mark.attrs as { snapshot?: unknown }).snapshot : null
		return (
			<EntityPreviewLink
				key={key}
				entity={entity}
				snapshot={
					snapshot && typeof snapshot === 'object'
						? (snapshot as Parameters<typeof EntityPreviewLink>[0]['snapshot'])
						: null
				}
			>
				{children}
			</EntityPreviewLink>
		)
	}
	return children
}

function renderInlineText(node: TiptapJson, key: string) {
	let children: ReactNode = node.text ?? ''
	for (const [index, mark] of (node.marks ?? []).entries()) {
		children = applyMark(children, mark, `${key}-mark-${index}`)
	}
	return <span key={key}>{children}</span>
}

function renderChildren(node: TiptapJson, key: string, ctx: RenderContext) {
	return (node.content ?? []).map((child, index) => renderNode(child, `${key}-${index}`, ctx))
}

function renderCitation(node: TiptapJson, key: string) {
	const citation: ArticleCitation = {
		id: stringAttr(node.attrs, 'id') || key,
		label: stringAttr(node.attrs, 'label') || stringAttr(node.attrs, 'id') || key,
		...(stringAttr(node.attrs, 'url') ? { url: stringAttr(node.attrs, 'url') } : {}),
		...(stringAttr(node.attrs, 'title') ? { title: stringAttr(node.attrs, 'title') } : {})
	}
	const className =
		'mx-0.5 inline-flex items-baseline rounded-[3px] border border-medium bg-research-tint px-1 body-sm text-link no-underline'
	if (citation.url) {
		const link = <a href={citation.url} target="_blank" rel="noreferrer noopener" className={className} />
		// Tooltip renders only its children when content is empty, which would drop the link.
		if (!citation.title) {
			return (
				<a key={key} href={citation.url} target="_blank" rel="noreferrer noopener" className={className}>
					[{citation.label}]
				</a>
			)
		}
		return (
			<Tooltip key={key} content={citation.title} render={link}>
				[{citation.label}]
			</Tooltip>
		)
	}
	return (
		<span key={key} title={citation.title} className={className}>
			[{citation.label}]
		</span>
	)
}

function renderCallout(node: TiptapJson, key: string, ctx: RenderContext) {
	const tone = (stringAttr(node.attrs, 'tone') as ArticleCalloutTone | undefined) || 'note'
	if (tone === 'pullquote') {
		return (
			<aside
				key={key}
				className="article-pullquote my-8 border-y border-link/30 px-2 py-6 text-center text-xl leading-snug font-medium text-primary [&_p]:my-0"
			>
				{renderChildren(node, key, ctx)}
			</aside>
		)
	}
	if (tone === 'bio') {
		return (
			<aside
				key={key}
				className="article-bio my-6 rounded-md rounded-l-none border-l-4 border-link bg-research-tint px-5 py-4 leading-[1.65] text-secondary [&_p]:my-0 [&_p+p]:mt-2"
			>
				{renderChildren(node, key, ctx)}
			</aside>
		)
	}
	const wrap =
		tone === 'warning'
			? 'border-callout-border/60 bg-callout-bg text-callout-text dark:text-research-gold'
			: tone === 'data'
				? 'border-link/40 bg-research-tint'
				: 'border-medium bg-surface'
	const toneText =
		tone === 'warning' ? 'text-callout-accent dark:text-research-gold' : tone === 'data' ? 'text-link' : 'text-tertiary'
	return (
		<aside key={key} className={`my-6 rounded-md border p-4 ${wrap}`}>
			<div className={`mb-1.5 label-sm capitalize ${toneText}`}>{tone}</div>
			<div className="article-callout-body">{renderChildren(node, key, ctx)}</div>
		</aside>
	)
}

function renderTaskItem(node: TiptapJson, key: string, ctx: RenderContext) {
	const checked = !!node.attrs?.checked
	return (
		<li key={key} className="article-task-item not-prose flex items-start gap-2 pl-0" data-checked={checked}>
			<input type="checkbox" checked={checked} readOnly className="mt-1.5 size-3.5 shrink-0 accent-link" />
			<div className={`min-w-0 flex-1 ${checked ? 'text-tertiary line-through' : 'text-primary'}`}>
				{renderChildren(node, key, ctx)}
			</div>
		</li>
	)
}

function renderNode(node: TiptapJson, key: string, ctx: RenderContext): ReactNode {
	if (node.type === 'text') return renderInlineText(node, key)
	if (node.type === 'hardBreak') return <br key={key} />
	if (node.type === 'doc') return <div key={key}>{renderChildren(node, key, ctx)}</div>
	if (node.type === 'paragraph') return <p key={key}>{renderChildren(node, key, ctx)}</p>
	if (node.type === 'heading') {
		const level = Number(node.attrs?.level) || 2
		const id = headingSlug(getTiptapNodeText(node))
		if (level === 3) {
			return (
				<h3 key={key} id={id}>
					{renderChildren(node, key, ctx)}
				</h3>
			)
		}
		if (level === 4) {
			return (
				<h4 key={key} id={id}>
					{renderChildren(node, key, ctx)}
				</h4>
			)
		}
		if (level === 5) {
			return (
				<h5 key={key} id={id}>
					{renderChildren(node, key, ctx)}
				</h5>
			)
		}
		if (level === 6) {
			return (
				<h6 key={key} id={id}>
					{renderChildren(node, key, ctx)}
				</h6>
			)
		}
		return (
			<h2 key={key} id={id}>
				{renderChildren(node, key, ctx)}
			</h2>
		)
	}
	if (node.type === 'bulletList') return <ul key={key}>{renderChildren(node, key, ctx)}</ul>
	if (node.type === 'orderedList') return <ol key={key}>{renderChildren(node, key, ctx)}</ol>
	if (node.type === 'taskList')
		return (
			<ul key={key} className="article-task-list grid list-none gap-1.5 pl-0">
				{renderChildren(node, key, ctx)}
			</ul>
		)
	if (node.type === 'taskItem') return renderTaskItem(node, key, ctx)
	if (node.type === 'listItem') return <li key={key}>{renderChildren(node, key, ctx)}</li>
	if (node.type === 'blockquote') return <blockquote key={key}>{renderChildren(node, key, ctx)}</blockquote>
	if (node.type === 'horizontalRule') return <hr key={key} />
	if (node.type === 'codeBlock') return renderCodeBlock(node, key)
	if (node.type === 'callout') return renderCallout(node, key, ctx)
	if (node.type === 'citation') return renderCitation(node, key)
	if (node.type === 'defillamaChart') {
		const config = validateArticleChartConfig(node.attrs?.config)
		if (!config) return null
		ctx.figureCount.value += 1
		return <ArticleChartBlock key={key} config={config} index={ctx.figureCount.value} />
	}
	if (node.type === 'llamaaiChart') {
		// Caption presence is the figure toggle: uncaptioned charts render bare and
		// consume no figure number, so published numbering never shows gaps.
		const hasCaption = typeof node.attrs?.caption === 'string' && node.attrs.caption.trim().length > 0
		if (hasCaption) ctx.figureCount.value += 1
		return <LlamaAIChartBlock key={key} attrs={node.attrs ?? {}} index={hasCaption ? ctx.figureCount.value : null} />
	}
	if (node.type === 'articleEmbed') {
		const config = validateEmbedConfig(node.attrs?.config)
		if (!config) return null
		ctx.figureCount.value += 1
		return <ArticleEmbedBlock key={key} config={config} index={ctx.figureCount.value} />
	}
	if (node.type === 'articleImage') {
		return <ArticleImageBlock key={key} attrs={node.attrs as Parameters<typeof ArticleImageBlock>[0]['attrs']} />
	}
	if (node.type === 'articlePeoplePanel') {
		const config = validateArticlePeoplePanel(node.attrs?.config)
		if (!config) return null
		return <ArticlePeoplePanelBlock key={key} config={config} />
	}
	if (node.type === 'qa') {
		const questionNode = (node.content ?? []).find((child) => child?.type === 'qaQuestion')
		const questionText = questionNode ? getTiptapNodeText(questionNode).trim() : ''
		const qaId = questionText ? `qa-${headingSlug(questionText)}` : undefined
		const questionNumber = normalizeQAQuestionNumber(node.attrs?.questionNumber) ?? undefined
		return (
			<ArticleQABlock key={key} id={qaId} questionNumber={questionNumber}>
				{renderChildren(node, key, ctx)}
			</ArticleQABlock>
		)
	}
	if (node.type === 'qaQuestion') {
		return <ArticleQAQuestion key={key}>{renderChildren(node, key, ctx)}</ArticleQAQuestion>
	}
	if (node.type === 'qaAnswer') {
		return <ArticleQAAnswer key={key}>{renderChildren(node, key, ctx)}</ArticleQAAnswer>
	}
	if (node.type === 'table') return renderTable(node, key, ctx)
	if (node.type === 'tableRow') return renderTableRow(node, key, ctx)
	if (node.type === 'tableHeader') {
		const { colSpan, rowSpan, style } = tableCellAttrs(node)
		return (
			<th key={key} colSpan={colSpan} rowSpan={rowSpan} style={style}>
				{renderChildren(node, key, ctx)}
			</th>
		)
	}
	if (node.type === 'tableCell') {
		const { colSpan, rowSpan, style } = tableCellAttrs(node)
		return (
			<td key={key} colSpan={colSpan} rowSpan={rowSpan} style={style}>
				{renderChildren(node, key, ctx)}
			</td>
		)
	}
	return <div key={key}>{renderChildren(node, key, ctx)}</div>
}

function renderTable(node: TiptapJson, key: string, ctx: RenderContext) {
	const rows = node.content ?? []
	const headerRows: Array<TiptapJson> = []
	const bodyRows: Array<TiptapJson> = []
	let inHeader = true
	for (const row of rows) {
		if (row.type !== 'tableRow') continue
		const cells = row.content ?? []
		const allHeader = cells.length > 0 && cells.every((c) => c.type === 'tableHeader')
		if (inHeader && allHeader) headerRows.push(row)
		else {
			inHeader = false
			bodyRows.push(row)
		}
	}
	const hasColWidths = hasStoredColumnWidths(node)

	return (
		<ArticleTableFrame key={key}>
			<table
				className={`article-table relative z-10 w-full border-collapse body-md ${hasColWidths ? 'table-fixed' : ''}`}
			>
				{headerRows.length > 0 ? (
					<thead className="bg-page">{headerRows.map((row, i) => renderNode(row, `${key}-thead-${i}`, ctx))}</thead>
				) : null}
				<tbody>{bodyRows.map((row, i) => renderNode(row, `${key}-tbody-${i}`, ctx))}</tbody>
			</table>
		</ArticleTableFrame>
	)
}

function renderTableRow(node: TiptapJson, key: string, ctx: RenderContext) {
	return (
		<tr key={key} className="border-b border-medium last:border-b-0">
			{renderChildren(node, key, ctx)}
		</tr>
	)
}

function formatHeaderDate(iso: string | null | undefined) {
	if (!iso) return null
	const date = new Date(iso)
	if (Number.isNaN(date.getTime())) return null
	// UTC and a fixed locale: the server and every visitor must render the same label.
	const day = date.getUTCDate()
	const month = date.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })
	const year = date.getUTCFullYear()
	let hours = date.getUTCHours()
	const ampm = hours >= 12 ? 'PM' : 'AM'
	hours = hours % 12 || 12
	const hh = hours.toString().padStart(2, '0')
	const mm = date.getUTCMinutes().toString().padStart(2, '0')
	return `${day} ${month} ${year} at ${hh}:${mm} ${ampm} UTC`
}

const metaChipClassName =
	'inline-flex items-center rounded-[3px] bg-link px-2 py-0.75 label-xs tracking-tight whitespace-nowrap text-on-brand transition-opacity hover:opacity-90'

function MetaChip({ children, href }: { children: ReactNode; href?: string }) {
	if (href) {
		return (
			<Link href={href} className={metaChipClassName}>
				{children}
			</Link>
		)
	}
	return <span className={metaChipClassName}>{children}</span>
}

type TocEntry = { id: string; text: string; level: number }
type TocGroup = { id: string; text: string; children: Array<TocEntry> }

function groupToc(toc: Array<TocEntry>): Array<TocGroup> {
	const groups: Array<TocGroup> = []
	let current: TocGroup | null = null
	for (const entry of toc) {
		if (entry.level === 2) {
			current = { id: entry.id, text: entry.text, children: [] }
			groups.push(current)
		} else if (entry.level === 3) {
			if (current) current.children.push(entry)
			else groups.push({ id: entry.id, text: entry.text, children: [] })
		}
	}
	return groups
}

function subscribeToLocation(onChange: () => void) {
	window.addEventListener('popstate', onChange)
	window.addEventListener('hashchange', onChange)
	return () => {
		window.removeEventListener('popstate', onChange)
		window.removeEventListener('hashchange', onChange)
	}
}

function readLocationHref() {
	return window.location.href
}

function collectToc(node: TiptapJson | null | undefined, out: Array<TocEntry>) {
	if (!node) return
	if (node.type === 'heading') {
		const level = Number(node.attrs?.level) || 2
		if (level === 2 || level === 3) {
			const text = getTiptapNodeText(node).trim()
			if (text) out.push({ id: headingSlug(text), text, level })
		}
	}
	if (node.type === 'qa') {
		const questionNode = (node.content ?? []).find((child) => child?.type === 'qaQuestion')
		const text = questionNode ? getTiptapNodeText(questionNode).trim() : ''
		if (text) {
			const qIndex = out.filter((entry) => entry.id.startsWith('qa-')).length + 1
			const questionNumber = normalizeQAQuestionNumber(node.attrs?.questionNumber) ?? String(qIndex)
			out.push({ id: `qa-${headingSlug(text)}`, text: `Q${questionNumber}. ${text}`, level: 3 })
		}
		return
	}
	for (const child of node.content ?? []) collectToc(child, out)
}

function useActiveHeading(toc: Array<TocEntry>): [string | null, (id: string) => void] {
	const [active, setActive] = useState<string | null>(toc[0]?.id ?? null)

	useEffect(() => {
		if (typeof IntersectionObserver === 'undefined') return
		if (toc.length === 0) return
		const ids = toc.map((t) => t.id)
		const visible = new Set<string>()
		const observer = new IntersectionObserver(
			(entries) => {
				for (const e of entries) {
					const id = (e.target as HTMLElement).id
					if (e.isIntersecting) visible.add(id)
					else visible.delete(id)
				}
				const first = ids.find((id) => visible.has(id))
				if (first) setActive(first)
			},
			{ rootMargin: '-88px 0px -40% 0px', threshold: 0 }
		)
		for (const id of ids) {
			const el = document.getElementById(id)
			if (el) observer.observe(el)
		}
		return () => observer.disconnect()
	}, [toc])

	useEffect(() => {
		const onHash = () => {
			const id = window.location.hash.slice(1)
			if (id && toc.some((t) => t.id === id)) setActive(id)
		}
		onHash()
		window.addEventListener('hashchange', onHash)
		return () => window.removeEventListener('hashchange', onHash)
	}, [toc])

	return [active, setActive]
}

function ActivePill() {
	return (
		<span
			aria-hidden
			className="pointer-events-none absolute top-1/2 right-0 h-5 w-1 -translate-y-1/2 rounded-[2px] bg-tertiary"
		/>
	)
}

function useReadingProgress() {
	const [progress, setProgress] = useState(0)
	useEffect(() => {
		let raf = 0
		const update = () => {
			const doc = document.documentElement
			const max = doc.scrollHeight - window.innerHeight
			const next = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0
			setProgress(next)
		}
		const onScroll = () => {
			cancelAnimationFrame(raf)
			raf = requestAnimationFrame(update)
		}
		update()
		window.addEventListener('scroll', onScroll, { passive: true })
		window.addEventListener('resize', onScroll)
		return () => {
			cancelAnimationFrame(raf)
			window.removeEventListener('scroll', onScroll)
			window.removeEventListener('resize', onScroll)
		}
	}, [])
	return progress
}

const onJumpToTop = () => {
	window.scrollTo({ top: 0, behavior: 'smooth' })
}

function CompactTocBar({
	toc,
	groups,
	active
}: {
	toc: Array<TocEntry>
	groups: Array<TocGroup>
	active: string | null
}) {
	const progress = useReadingProgress()
	const currentGroupIndex = useMemo(() => {
		if (!active) return 0
		const idx = groups.findIndex((g) => g.id === active || g.children.some((c) => c.id === active))
		return idx < 0 ? 0 : idx
	}, [active, groups])
	const currentEntry = useMemo(() => {
		if (!active) return groups[0] ?? toc[0] ?? null
		return toc.find((t) => t.id === active) ?? groups[currentGroupIndex] ?? toc[0] ?? null
	}, [active, toc, groups, currentGroupIndex])
	const totalGroups = Math.max(groups.length, 1)
	const displayNumber = String(Math.min(currentGroupIndex + 1, totalGroups)).padStart(2, '0')
	const displayTotal = String(totalGroups).padStart(2, '0')
	const pct = Math.round(progress * 100)

	return (
		<button
			type="button"
			onClick={onJumpToTop}
			aria-label={`Currently reading: ${currentEntry?.text ?? 'article'}. Return to top of article.`}
			className="group relative flex w-full flex-col gap-3 border-y border-medium py-3.5 text-left transition-colors hover:bg-surface/40"
		>
			<div className="flex items-center justify-between gap-3">
				<span className="label-xs tracking-[0.18em] text-tertiary uppercase">On this page</span>
				<span className="flex items-center gap-1 label-xs tracking-[0.12em] text-tertiary uppercase transition-colors group-hover:text-link">
					<span>Top</span>
					<Icon name="arrow-up" className="size-3" />
				</span>
			</div>
			<div className="flex items-baseline gap-3">
				<span className="mono-sm tracking-tight text-tertiary tabular-nums">
					{displayNumber}
					<span className="text-tertiary/50">/{displayTotal}</span>
				</span>
				<span className="min-w-0 flex-1 truncate label-md text-primary">{currentEntry?.text ?? '—'}</span>
			</div>
			<div className="relative h-px w-full bg-border-medium">
				<span
					aria-hidden
					className="absolute inset-y-0 left-0 bg-link transition-[width] duration-300 ease-out"
					style={{ width: `${pct}%` }}
				/>
			</div>
		</button>
	)
}

function ArticleToc({ toc, compactMode = false }: { toc: Array<TocEntry>; compactMode?: boolean }) {
	const [active, setActive] = useActiveHeading(toc)
	const groups = useMemo(() => groupToc(toc), [toc])

	if (compactMode) {
		return <CompactTocBar toc={toc} groups={groups} active={active} />
	}

	// The full list unmounts while compact, so scrolling back above the header shows every group collapsed again.
	return <TocList groups={groups} active={active} setActive={setActive} />
}

function TocList({
	groups,
	active,
	setActive
}: {
	groups: Array<TocGroup>
	active: string | null
	setActive: (id: string) => void
}) {
	const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(groups.map((g) => g.id)))

	const toggle = (id: string) => {
		setCollapsed((prev) => {
			const next = new Set(prev)
			if (next.has(id)) next.delete(id)
			else next.add(id)
			return next
		})
	}

	return (
		<nav aria-label="On this page" className="grid">
			<ol className="m-0 grid list-none gap-px p-0">
				{groups.map((group) => {
					const isCollapsed = collapsed.has(group.id)
					const hasChildren = group.children.length > 0
					const isParentActive = active === group.id
					return (
						<li key={group.id} className="relative">
							{hasChildren ? (
								// The link and its disclosure are siblings: a link inside a button is unreachable by keyboard.
								<div className="flex w-full items-center justify-between gap-2 pr-3 pl-5 title-md text-primary">
									<a
										href={`#${group.id}`}
										onClick={() => setActive(group.id)}
										aria-current={isParentActive ? 'location' : undefined}
										className={`min-w-0 flex-1 truncate py-1.5 hover:text-link ${isParentActive ? 'underline' : ''}`}
									>
										{group.text}
									</a>
									<Button
										variant="ghost"
										size="sm"
										square
										onClick={() => toggle(group.id)}
										aria-expanded={!isCollapsed}
										aria-label={`${group.text} subsections`}
									>
										<Icon name={isCollapsed ? 'chevron-right' : 'chevron-down'} className="size-4" />
									</Button>
								</div>
							) : (
								<a
									href={`#${group.id}`}
									onClick={() => setActive(group.id)}
									aria-current={isParentActive ? 'location' : undefined}
									className={`flex items-center px-5 py-1.5 title-md text-primary hover:text-link ${
										isParentActive ? 'underline' : ''
									}`}
								>
									<span className="truncate">{group.text}</span>
								</a>
							)}
							{isParentActive ? <ActivePill /> : null}
							{!isCollapsed && hasChildren ? (
								<ol className="m-0 grid list-none gap-px p-0">
									{group.children.map((child) => {
										const isActive = active === child.id
										return (
											<li key={child.id} className="relative">
												<a
													href={`#${child.id}`}
													onClick={() => setActive(child.id)}
													aria-current={isActive ? 'location' : undefined}
													className={`block truncate py-1.5 pr-3 pl-10 transition-colors ${
														isActive ? 'title-md text-primary underline' : 'body-md text-secondary hover:text-primary'
													}`}
												>
													{child.text}
												</a>
												{isActive ? <ActivePill /> : null}
											</li>
										)
									})}
								</ol>
							) : null}
						</li>
					)
				})}
			</ol>
		</nav>
	)
}

function ShareIcons({ url, title, size = 'md' }: { url: string; title: string; size?: 'sm' | 'md' }) {
	const { copied, copy } = useCopy()
	const tweetUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`
	const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`
	const dim = size === 'sm' ? 'size-9' : 'size-11'
	const iconDim = size === 'sm' ? 'size-4' : 'size-5'
	const buttonClass = `flex ${dim} items-center justify-center rounded-full border border-medium bg-surface text-primary transition-colors hover:border-link/50 hover:text-link`
	return (
		<div className="flex items-center gap-1.5">
			<Tooltip
				content="Share on X"
				render={
					<a
						href={tweetUrl}
						target="_blank"
						rel="noreferrer noopener"
						aria-label="Share on X/Twitter"
						className={buttonClass}
					/>
				}
			>
				<Icon name="twitter" className={iconDim} />
			</Tooltip>
			<Tooltip
				content="Share on LinkedIn"
				render={
					<a
						href={linkedInUrl}
						target="_blank"
						rel="noreferrer noopener"
						aria-label="Share on LinkedIn"
						className={buttonClass}
					/>
				}
			>
				<ResearchIcon name="linkedin-square" className={iconDim} aria-hidden="true" />
			</Tooltip>
			<Tooltip
				content={copied ? 'Copied' : 'Copy link'}
				render={<button type="button" onClick={() => void copy(url)} aria-label="Copy link" className={buttonClass} />}
			>
				<Icon name={copied ? 'check-circle' : 'link'} className={iconDim} />
			</Tooltip>
			<span role="status" className="sr-only">
				{copied ? 'Link copied' : ''}
			</span>
		</div>
	)
}

function ShareBlock({ url, title, compactMode = false }: { url: string; title: string; compactMode?: boolean }) {
	if (compactMode) {
		return (
			<div className="flex items-center justify-between gap-3 border-y border-medium py-3.5">
				<span className="flex items-center gap-1.5 label-xs tracking-[0.18em] text-tertiary uppercase">
					Share
					<Icon name="share" className="size-3" />
				</span>
				<ShareIcons url={url} title={title} size="sm" />
			</div>
		)
	}
	return (
		<div className="grid gap-8">
			<div role="separator" className="h-px bg-border-medium" />
			<div className="flex flex-col items-center gap-5">
				<div className="flex items-center gap-1.5">
					<span className="text-lg leading-none font-semibold tracking-wide text-primary">SHARE</span>
					<Icon name="share" className="size-4 text-primary" />
				</div>
				<ShareIcons url={url} title={title} />
			</div>
			<div role="separator" className="h-px bg-border-medium" />
		</div>
	)
}

export function ArticleRenderer({
	article,
	hideSidePanel = false,
	shareUrlOverride,
	sidePanelAction
}: {
	article: LocalArticleDocument
	hideSidePanel?: boolean
	shareUrlOverride?: string
	sidePanelAction?: ReactNode
}) {
	const visibleDateIso =
		article.displayDate ??
		(article.status === 'published' ? (article.publishedAt ?? article.lastPublishedAt ?? null) : article.updatedAt)
	const publishedLabel = visibleDateIso
		? formatHeaderDate(visibleDateIso)
		: article.status === 'published'
			? null
			: 'Draft'
	const ctx: RenderContext = { figureCount: { value: 0 } }
	const contentJson = useMemo(() => normalizeArticleContentJson(article.contentJson), [article.contentJson])
	const promoBanner = usePromoBanner(article.id)
	const mobilePromoVisible = !!mobilePromoImageUrl(promoBanner)

	const toc: Array<TocEntry> = []
	collectToc(contentJson, toc)

	const sectionLabel = article.section ? ARTICLE_SECTION_LABELS[article.section] : null
	const sectionHref = article.section ? `/research/${ARTICLE_SECTION_SLUGS[article.section]}` : null
	const tagChips = (article.tags ?? []).filter((tag) => typeof tag === 'string' && tag.trim().length > 0)

	const sectionPath = article.section ? `/research/${ARTICLE_SECTION_SLUGS[article.section]}/${article.slug}` : null
	const articlePath = sectionPath ?? `/research/${article.slug}`
	// The server and hydration render the article path; the client then shares its live location.
	const locationHref = useSyncExternalStore(subscribeToLocation, readLocationHref, () => articlePath)
	const shareUrl = shareUrlOverride ?? locationHref

	const sentinelRef = useRef<HTMLDivElement>(null)
	const [pastHeader, setPastHeader] = useState(false)
	useEffect(() => {
		const el = sentinelRef.current
		if (!el) return
		let raf = 0
		const update = () => {
			const top = el.getBoundingClientRect().top
			setPastHeader(top < 24)
		}
		const onScroll = () => {
			cancelAnimationFrame(raf)
			raf = requestAnimationFrame(update)
		}
		update()
		window.addEventListener('scroll', onScroll, { passive: true })
		window.addEventListener('resize', onScroll)
		return () => {
			cancelAnimationFrame(raf)
			window.removeEventListener('scroll', onScroll)
			window.removeEventListener('resize', onScroll)
		}
	}, [])

	const cover = article.coverImage ?? null
	const coverHeadline = cover ? (cover.headline ?? '').trim() : ''
	const coverCaption = cover ? (cover.caption ?? '').trim() : ''
	const coverCredit = cover ? (cover.credit ?? '').trim() : ''
	const coverCopyright = cover ? (cover.copyright ?? '').trim() : ''
	const coverMetaParts = cover
		? [coverCredit ? `Credit: ${coverCredit}` : '', coverCopyright ? `© ${coverCopyright}` : ''].filter(Boolean)
		: []
	const hasCoverMeta = !!cover && (coverHeadline || coverCaption || coverMetaParts.length > 0)
	const articlePageClassName = hideSidePanel
		? `${styles.root} article-page mx-auto grid w-full max-w-[760px] animate-fadein gap-10 px-4 pb-8 sm:px-6`
		: `${styles.root} article-page mx-auto grid w-full max-w-[1300px] animate-fadein gap-10 px-4 pb-8 sm:px-6 lg:grid-cols-[minmax(0,700px)_401px] lg:gap-31.25`

	const isInterview = article.section === 'interview'
	const bylineLabel = isInterview ? 'Interviewer' : 'By'
	const bylineAuthorEntries = getArticleBylineAuthorEntries(article)
	const bylineNode = bylineAuthorEntries ? (
		<span className="flex flex-wrap items-center gap-1 body-sm text-secondary">
			<span className="font-normal">{bylineLabel}</span>
			{bylineAuthorEntries.map((entry, index) => (
				<span key={entry.key} className="flex items-center gap-1">
					{entry.href ? (
						<Link href={entry.href} className="font-semibold text-primary hover:text-link">
							{entry.name}
						</Link>
					) : (
						<span className="font-semibold text-primary">{entry.name}</span>
					)}
					{index < bylineAuthorEntries.length - 2 ? <span>,</span> : null}
					{index === bylineAuthorEntries.length - 2 ? <span>and</span> : null}
				</span>
			))}
		</span>
	) : null

	const intervieweesList = isInterview ? (article.interviewees ?? []).filter((p) => p?.name?.trim()) : []
	const intervieweeNode =
		intervieweesList.length > 0 ? (
			<span className="flex flex-wrap items-center gap-x-2 gap-y-1 body-sm text-secondary">
				<span className="font-normal">Interviewee{intervieweesList.length > 1 ? 's' : ''}</span>
				{keyedOccurrences(intervieweesList, (person) =>
					JSON.stringify([person.authorSlug, person.externalUrl, person.name])
				).map(({ item: person, key }, index) => {
					const labelNode = (
						<span className="inline-flex items-center gap-1.5">
							{person.avatarUrl ? (
								// eslint-disable-next-line @next/next/no-img-element
								<img
									src={person.avatarUrl}
									alt=""
									className="size-5 shrink-0 rounded-full border border-medium object-cover"
								/>
							) : null}
							<span className="font-semibold text-primary">{person.name}</span>
							{person.role ? <span className="text-tertiary">· {person.role}</span> : null}
						</span>
					)
					const href = person.authorSlug
						? `/research/authors/${person.authorSlug}`
						: person.externalUrl
							? person.externalUrl
							: null
					const linked = href ? (
						person.authorSlug ? (
							<Link href={href} className="hover:text-link">
								{labelNode}
							</Link>
						) : (
							<a href={href} target="_blank" rel="noreferrer noopener" className="hover:text-link">
								{labelNode}
							</a>
						)
					) : (
						labelNode
					)
					return (
						<span key={key} className="flex items-center gap-1">
							{linked}
							{index < intervieweesList.length - 2 ? <span>,</span> : null}
							{index === intervieweesList.length - 2 ? <span>and</span> : null}
						</span>
					)
				})}
			</span>
		) : null

	return (
		<div className={articlePageClassName}>
			<article className="article-published min-w-0">
				<header className="grid gap-4 pt-6 sm:pt-10 lg:gap-5">
					<h1 className="text-[26px] leading-[1.2] font-bold tracking-tight text-primary sm:text-3xl sm:leading-[1.15] md:text-4xl md:leading-[1.32]">
						{article.title}
					</h1>
					{article.subtitle ? <p className="body-lg text-secondary md:body-xl">{article.subtitle}</p> : null}
					{article.client ? (
						<Link
							href={researchClientHref(article.client.id)}
							className="w-fit label-sm tracking-[0.08em] text-link uppercase hover:underline"
						>
							{articleClientLabel(article.client)}
						</Link>
					) : null}
					{article.section === 'report' && article.reportPdf ? (
						<div>
							<DownloadPdfLink
								article={article as ArticleDocument}
								pdfUrl={article.reportPdf.url}
								widgetLabel="Article page"
								className="inline-flex items-center gap-2 rounded-md bg-link px-3.5 py-2 label-md text-on-brand transition-opacity hover:opacity-90"
							>
								<Icon name="download-cloud" className="size-4" />
								Download PDF
							</DownloadPdfLink>
						</div>
					) : null}
				</header>

				{cover ? (
					<figure className="mt-5 grid gap-2">
						<div className="aspect-[700/400] w-full overflow-hidden">
							<img src={cover.url} alt={cover.alt || ''} className="block size-full object-cover" />
						</div>
						{hasCoverMeta ? (
							<figcaption className="grid gap-1 body-sm text-tertiary">
								{coverHeadline ? <span className="font-medium text-secondary">{coverHeadline}</span> : null}
								{coverCaption ? <span>{coverCaption}</span> : null}
								{coverMetaParts.length > 0 ? (
									<span className="text-tertiary/80">{coverMetaParts.join(' · ')}</span>
								) : null}
							</figcaption>
						) : null}
					</figure>
				) : null}

				<div className={`hidden flex-wrap items-center justify-between gap-3 lg:flex ${cover ? 'mt-5' : 'mt-6'} pb-8`}>
					<div className="flex flex-wrap items-center gap-x-5 gap-y-2">
						<div className="grid gap-1">
							{bylineNode}
							{intervieweeNode}
						</div>
						{(sectionLabel || tagChips.length > 0) && (
							<div className="flex flex-wrap items-center gap-1.5">
								{sectionLabel && sectionHref ? <MetaChip href={sectionHref}>{sectionLabel}</MetaChip> : null}
								{tagChips.map((tag) => (
									<MetaChip key={tag} href={`/research/topics/${encodeURIComponent(tag)}`}>
										{tag}
									</MetaChip>
								))}
							</div>
						)}
					</div>
					{publishedLabel ? <span className="body-sm whitespace-nowrap text-secondary">{publishedLabel}</span> : null}
				</div>

				<div className={`grid gap-3 lg:hidden ${cover ? 'mt-5' : 'mt-6'} pb-6`}>
					<div className="flex flex-wrap items-center justify-between gap-3">
						<div className="grid gap-1">
							{bylineNode}
							{intervieweeNode}
						</div>
						{publishedLabel ? <span className="body-sm whitespace-nowrap text-secondary">{publishedLabel}</span> : null}
					</div>
					{(sectionLabel || tagChips.length > 0) && (
						<div className="flex flex-wrap items-center gap-1.5">
							{sectionLabel && sectionHref ? <MetaChip href={sectionHref}>{sectionLabel}</MetaChip> : null}
							{tagChips.map((tag) => (
								<MetaChip key={tag} href={`/research/topics/${encodeURIComponent(tag)}`}>
									{tag}
								</MetaChip>
							))}
						</div>
					)}
					<div className="flex items-center gap-2">
						<span className="title-md tracking-wide text-primary">SHARE</span>
						<Icon name="share" className="size-3.5 text-primary" />
						<div className="ml-1">
							<ShareIcons url={shareUrl} title={article.title} size="sm" />
						</div>
					</div>
				</div>

				{toc.length > 1 ? (
					<div className="grid gap-6 pb-2 lg:hidden">
						<div role="separator" className="h-px bg-border-medium" />
						<ArticleToc toc={toc} />
						<div role="separator" className="h-px bg-border-medium" />
					</div>
				) : null}

				{article.pageAssets && article.pageAssets.length > 0 ? (
					<div className="pb-2 lg:hidden">
						<ArticlePageAssets pageAssets={article.pageAssets} />
					</div>
				) : null}

				<div ref={sentinelRef} aria-hidden className="h-0 w-full" />

				<div className="article-prose [overflow-wrap:anywhere] break-words">
					<div className="prose max-w-none prose-neutral dark:prose-invert prose-headings:font-semibold prose-headings:tracking-tight prose-h1:mt-8 prose-h1:mb-3 prose-h2:mt-6 prose-h2:mb-2 prose-h2:text-2xl prose-h3:mt-5 prose-h3:mb-1.5 prose-h3:text-lg prose-h4:mt-4 prose-h4:mb-1.5 prose-h4:text-base prose-h5:mt-3 prose-h5:mb-1 prose-h5:text-sm prose-h6:mt-3 prose-h6:mb-1 prose-h6:text-sm prose-p:my-3 prose-p:leading-[1.65] prose-a:font-medium prose-a:text-link prose-a:no-underline hover:prose-a:underline prose-blockquote:my-4 prose-blockquote:border-l-2 prose-blockquote:border-link prose-blockquote:bg-transparent prose-blockquote:px-4 prose-blockquote:py-1 prose-blockquote:text-secondary prose-blockquote:not-italic prose-figure:my-4 prose-strong:text-primary prose-code:rounded prose-code:bg-research-tint prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[0.92em] prose-code:text-link prose-code:before:hidden prose-code:after:hidden prose-pre:my-4 prose-pre:border prose-pre:border-medium prose-pre:bg-surface prose-pre:text-primary prose-ol:my-3 prose-ul:my-3 prose-li:my-1 prose-img:my-4 prose-hr:my-6 prose-hr:border-medium [&_.article-table_p]:my-0 [&_.article-table_td]:border [&_.article-table_td]:border-medium [&_.article-table_td]:px-3 [&_.article-table_td]:py-2 [&_.article-table_td]:align-top [&_.article-table_td]:text-secondary [&_.article-table_th]:border [&_.article-table_th]:border-medium [&_.article-table_th]:bg-page [&_.article-table_th]:px-3 [&_.article-table_th]:py-2 [&_.article-table_th]:text-left [&_.article-table_th]:font-semibold [&_.article-table_th]:text-primary [&_:where(h1,h2,h3,h4,h5,h6):first-child]:mt-0 [&_li>p]:my-0 [&_li>p]:leading-[1.55]">
						{(() => {
							const docContent = contentJson.content ?? []
							const nodes = docContent.map((child, idx) => renderNode(child, `article-root-${idx}`, ctx))
							if (docContent.length === 0) return nodes
							const slot = horizontalBannerSlot(article.id ?? '', docContent.length)
							const promo = <ArticlePromoBannerMobile key="article-mobile-promo-banner" articleId={article.id} />
							const banner = (
								<ArticleImageBannerHorizontal
									key="article-mobile-banner"
									articleId={article.id ?? ''}
									section={article.section ?? null}
								/>
							)
							const out = [...nodes]
							if (mobilePromoVisible) {
								const secondSlot = horizontalBannerSecondSlot(article.id ?? '', docContent.length, slot)
								out.splice(slot, 0, promo)
								out.splice(secondSlot + 1, 0, banner)
							} else {
								out.splice(slot, 0, banner)
							}
							return out
						})()}
					</div>
				</div>
			</article>

			{hideSidePanel ? null : (
				<aside className="hidden lg:sticky lg:top-6 lg:block lg:self-start">
					<div className={sidePanelAction ? 'grid gap-6 pt-4' : undefined}>
						{sidePanelAction ? <div className="flex justify-end">{sidePanelAction}</div> : null}
						<div className="flex flex-col gap-8 border-l border-medium pt-10 pr-1 pb-6 pl-5">
							{toc.length > 1 ? (
								<div className="pr-2">
									<ArticleToc toc={toc} compactMode={pastHeader} />
								</div>
							) : null}
							{article.pageAssets && article.pageAssets.length > 0 ? (
								<div className="pr-2 transition-[margin] duration-300 ease-out has-[[aria-expanded=false]]:-my-8">
									<ArticlePageAssets pageAssets={article.pageAssets} />
								</div>
							) : null}
							<div className="pr-2">
								<ShareBlock url={shareUrl} title={article.title} compactMode={pastHeader} />
							</div>
							{cardPromoImageUrl(promoBanner) ? (
								<div className="pr-2">
									<ArticlePromoCard articleId={article.id} />
								</div>
							) : null}
							<ArticleImageBanner articleId={article.id} section={article.section ?? null} />
						</div>
					</div>
				</aside>
			)}
		</div>
	)
}
