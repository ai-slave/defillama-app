import {
	describeFigure,
	findCitedCell,
	sanitizeExcerpt,
	type CitedCellRef
} from '~/containers/LlamaAI/components/messages/citationPillHelpers'
import type { ArtifactRegistry } from '~/containers/LlamaAI/renderModel'
import type { UnifiedCitationReference } from '~/containers/LlamaAI/types'
import { convertLlamaLinksToDefillama } from '~/containers/LlamaAI/utils/entityLinks'
import {
	normalizeCitationMarkerWhitespace,
	normalizeSourceUrl,
	parseArtifactPlaceholders,
	replaceCitationMarkers,
	sanitizeUrl,
	type ContentPart
} from '~/containers/LlamaAI/utils/markdownHelpers'
import { removeReportStartMarkers } from '~/containers/LlamaAI/utils/reportMarkers'

export const CSV_INLINE_ROW_LIMIT = 200

export interface CopyMessageSource {
	artifacts: ArtifactRegistry
	fetchText: (url: string) => Promise<string>
	captureChart?: (chartId: string) => Promise<string | null>
	citations?: Array<UnifiedCitationReference>
}

function escapeHtml(value: string): string {
	return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
}

/**
 * Deduplicate artifact fetches: the markdown and HTML flavors resolve the same
 * URLs, and the plain-text fallback re-runs the markdown build. Cache lifetime
 * is one wrapper instance — create a fresh one per copy action.
 */
export function withFetchCache(fetchText: (url: string) => Promise<string>): (url: string) => Promise<string> {
	const cache = new Map<string, Promise<string>>()
	return (url) => {
		let pending = cache.get(url)
		if (!pending) {
			pending = fetchText(url)
			cache.set(url, pending)
		}
		return pending
	}
}

// Artifact and citation URLs come from the model/server; only safe https links
// make it into the copied output, matching the renderer (CitationPill,
// MarkdownExportArtifact). Unsafe URLs degrade to plain text.
function markdownLink(title: string, url: string): string {
	const safe = sanitizeUrl(url)
	return safe ? `[${title}](${safe})` : title
}

function htmlLink(title: string, url: string): string {
	const safe = sanitizeUrl(url)
	return safe ? `<a href="${escapeHtml(safe)}">${escapeHtml(title)}</a>` : escapeHtml(title)
}

// Minimal CSV parser: quoted fields with embedded commas/newlines and "" escapes.
function parseCsv(text: string): Array<Array<string>> {
	const rows: Array<Array<string>> = []
	let row: Array<string> = []
	let field = ''
	let inQuotes = false
	for (let i = 0; i < text.length; i++) {
		const char = text[i]
		if (inQuotes) {
			if (char === '"' && text[i + 1] === '"') {
				field += '"'
				i++
			} else if (char === '"') {
				inQuotes = false
			} else {
				field += char
			}
		} else if (char === '"') {
			inQuotes = true
		} else if (char === ',') {
			row.push(field)
			field = ''
		} else if (char === '\n' || char === '\r') {
			if (char === '\r' && text[i + 1] === '\n') i++
			row.push(field)
			field = ''
			if (row.some((cell) => cell.length > 0)) rows.push(row)
			row = []
		} else {
			field += char
		}
	}
	row.push(field)
	if (row.some((cell) => cell.length > 0)) rows.push(row)
	return rows
}

function csvToMarkdownTable(rows: Array<Array<string>>): string {
	const header = rows[0]
	if (!header) return ''
	const escapeCell = (cell: string) => cell.replaceAll('|', '\\|').replaceAll('\n', ' ')
	const body = rows.slice(1)
	const lines = [
		`| ${header.map(escapeCell).join(' | ')} |`,
		`| ${header.map(() => '---').join(' | ')} |`,
		...body.map((cells) => `| ${cells.map(escapeCell).join(' | ')} |`)
	]
	return lines.join('\n')
}

function csvToHtmlTable(rows: Array<Array<string>>): string {
	const header = rows[0]
	if (!header) return ''
	const body = rows.slice(1)
	const headerHtml = `<tr>${header.map((cell) => `<th>${escapeHtml(cell)}</th>`).join('')}</tr>`
	const bodyHtml = body
		.map((cells) => `<tr>${cells.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
		.join('')
	return `<table><thead>${headerHtml}</thead><tbody>${bodyHtml}</tbody></table>`
}

function chartTitle(artifacts: ArtifactRegistry, chartId: string): string {
	const record = artifacts.get(chartId)
	if (record?.type !== 'chart') return 'Chart'
	return record.charts[0]?.title || 'Chart'
}

type CsvResolution = { kind: 'table'; rows: Array<Array<string>> } | { kind: 'link'; title: string; url: string } | null

async function resolveCsv(source: CopyMessageSource, csvId: string): Promise<CsvResolution> {
	const record = source.artifacts.get(csvId)
	if (record?.type !== 'csv') return null
	if (record.rowCount > CSV_INLINE_ROW_LIMIT) return { kind: 'link', title: record.title, url: record.url }
	try {
		const rows = parseCsv(await source.fetchText(record.url))
		if (rows.length === 0) return { kind: 'link', title: record.title, url: record.url }
		return { kind: 'table', rows }
	} catch {
		return { kind: 'link', title: record.title, url: record.url }
	}
}

async function resolveMd(source: CopyMessageSource, mdId: string): Promise<string | null> {
	const record = source.artifacts.get(mdId)
	if (record?.type !== 'md') return null
	try {
		return await source.fetchText(record.url)
	} catch {
		return markdownLink(record.title, record.url)
	}
}

function cleanText(content: string): string {
	return removeReportStartMarkers(convertLlamaLinksToDefillama(content)).trim()
}

// Citation markers copy as normalized `[n]` references backed by a trailing
// Sources section; when the message carries no references they are stripped,
// matching the chat renderer.
function citationState(source: CopyMessageSource) {
	const byId = new Map<number, UnifiedCitationReference>()
	for (const ref of source.citations ?? []) if (typeof ref.id === 'number') byId.set(ref.id, ref)
	const cited = new Set<number>()
	const processText = (text: string): string =>
		normalizeCitationMarkerWhitespace(
			replaceCitationMarkers(text, (ids) => {
				const valid = ids.filter((id) => byId.has(id))
				for (const id of valid) cited.add(id)
				return valid.map((id) => `[${id}]`).join('')
			})
		)
	const citedRefs = () => {
		const refs: Array<UnifiedCitationReference> = []
		for (const id of [...cited].sort((a, b) => a - b)) {
			const ref = byId.get(id)
			if (ref) refs.push(ref)
		}
		return refs
	}
	return { processText, citedRefs }
}

// Mirror the provenance panel: a data citation reads as its figure
// ("Edgex · Pct Change = -68.13"), not the internal result name ("returns").
function describeCitation(ref: UnifiedCitationReference): string {
	if (ref.sourceType === 'data' || ref.sourceType === 'computed') {
		const cellRef: CitedCellRef = {
			...(ref.field === undefined ? {} : { field: ref.field }),
			...(ref.rowIndex === undefined ? {} : { rowIndex: ref.rowIndex }),
			...(ref.value === undefined ? {} : { value: ref.value })
		}
		const citedCell = findCitedCell(ref.rows, ref.columns, cellRef)
		const figure = describeFigure(ref, citedCell) ?? ref.label
		const value = ref.value ? ` = ${ref.value}` : ''
		const asOf = ref.asOf ? ` (as of ${ref.asOf})` : ''
		const formula = ref.formula ? ` — formula: ${ref.formula}` : ''
		return `DefiLlama data: ${figure}${value}${asOf}${formula}`
	}
	if (ref.sourceType === 'file' && ref.fileName) {
		return ref.locator ? `${ref.fileName}, ${ref.locator}` : ref.fileName
	}
	const excerpt = sanitizeExcerpt(ref.excerpt, 120)
	return excerpt ? `${ref.label} — “${excerpt}”` : ref.label
}

// Same normalization the renderer applies: internal preview hosts are rewritten
// to defillama.com and unsafe URLs (e.g. `javascript:`) are dropped.
function citationUrl(ref: UnifiedCitationReference): string | null {
	const raw = ref.url ?? ref.fileUrl
	return raw ? normalizeSourceUrl(raw) : null
}

function sourcesMarkdown(refs: Array<UnifiedCitationReference>): string {
	const lines = refs.map((ref) => {
		const url = citationUrl(ref)
		return `[${ref.id}] ${describeCitation(ref)}${url ? ` — ${url}` : ''}`
	})
	return `**Sources**\n\n${lines.join('\n')}`
}

function sourcesHtml(refs: Array<UnifiedCitationReference>): string {
	const lines = refs
		.map((ref) => {
			const url = citationUrl(ref)
			const description = url
				? `<a href="${escapeHtml(url)}">${escapeHtml(describeCitation(ref))}</a>`
				: escapeHtml(describeCitation(ref))
			return `<p>[${ref.id}] ${description}</p>`
		})
		.join('')
	return `<p><strong>Sources</strong></p>${lines}`
}

// Rendered code keeps its literal text: a `[1]` inside <pre>/<code> is source
// code, not a citation marker.
const HTML_CODE_REGION = /<pre[^>]*>[\s\S]*?<\/pre>|<code[^>]*>[\s\S]*?<\/code>/g

// Markers survive markdown rendering as literal text, so the sup links are
// injected after conversion; by then only valid citation ids remain.
function citationsToHtmlLinks(html: string, refs: Map<number, UnifiedCitationReference>): string {
	const inject = (segment: string) =>
		replaceCitationMarkers(segment, (ids) =>
			ids
				.filter((id) => refs.has(id))
				.map((id) => {
					const url = citationUrl(refs.get(id)!)
					return url ? `<sup>[<a href="${escapeHtml(url)}">${id}</a>]</sup>` : `<sup>[${id}]</sup>`
				})
				.join('')
		)
	let out = ''
	let lastIndex = 0
	for (const match of html.matchAll(HTML_CODE_REGION)) {
		out += inject(html.slice(lastIndex, match.index))
		out += match[0]
		lastIndex = match.index + match[0].length
	}
	out += inject(html.slice(lastIndex))
	return out
}

function contentParts(content: string): Array<ContentPart> {
	return parseArtifactPlaceholders(content).parts
}

export async function buildCopyMarkdown(content: string, source: CopyMessageSource): Promise<string> {
	const citations = citationState(source)
	const pieces: Array<string> = []
	for (const part of contentParts(content)) {
		switch (part.type) {
			case 'text': {
				const text = citations.processText(cleanText(part.content)).trim()
				if (text) pieces.push(text)
				break
			}
			case 'chart':
				pieces.push(`*📊 ${chartTitle(source.artifacts, part.chartId)}*`)
				break
			case 'csv': {
				const resolved = await resolveCsv(source, part.csvId)
				if (resolved?.kind === 'table') pieces.push(csvToMarkdownTable(resolved.rows))
				else if (resolved?.kind === 'link') pieces.push(markdownLink(resolved.title, resolved.url))
				break
			}
			case 'md': {
				const inlined = await resolveMd(source, part.mdId)
				if (inlined) pieces.push(inlined.trim())
				break
			}
			case 'image': {
				const record = source.artifacts.get(part.imageId)
				if (record?.type === 'image') {
					const safe = sanitizeUrl(record.image.url)
					if (safe) pieces.push(`![${record.image.prompt ?? 'Image'}](${safe})`)
				}
				break
			}
			default:
				break
		}
	}
	const citedRefs = citations.citedRefs()
	if (citedRefs.length > 0) pieces.push(sourcesMarkdown(citedRefs))
	return pieces.join('\n\n')
}

// react-markdown + the server renderer are loaded lazily so the copy path adds
// nothing to the initial bundle; both are already dependencies of the chat view.
async function markdownToHtml(markdown: string): Promise<string> {
	const [{ renderToStaticMarkup }, { default: ReactMarkdown }, { default: remarkGfm }, { createElement }] =
		await Promise.all([import('react-dom/server'), import('react-markdown'), import('remark-gfm'), import('react')])
	return renderToStaticMarkup(createElement(ReactMarkdown, { remarkPlugins: [remarkGfm] }, markdown))
}

export async function buildCopyHtml(content: string, source: CopyMessageSource): Promise<string> {
	const citations = citationState(source)
	const refsById = new Map<number, UnifiedCitationReference>()
	for (const ref of source.citations ?? []) if (typeof ref.id === 'number') refsById.set(ref.id, ref)
	const pieces: Array<string> = []
	for (const part of contentParts(content)) {
		switch (part.type) {
			case 'text': {
				const text = citations.processText(cleanText(part.content)).trim()
				if (text) pieces.push(citationsToHtmlLinks(await markdownToHtml(text), refsById))
				break
			}
			case 'chart': {
				const title = chartTitle(source.artifacts, part.chartId)
				const captured = (await source.captureChart?.(part.chartId).catch(() => null)) ?? null
				pieces.push(
					captured
						? `<img src="${captured}" alt="${escapeHtml(title)}" style="max-width:100%">`
						: `<p><em>📊 ${escapeHtml(title)}</em></p>`
				)
				break
			}
			case 'csv': {
				const resolved = await resolveCsv(source, part.csvId)
				if (resolved?.kind === 'table') pieces.push(csvToHtmlTable(resolved.rows))
				else if (resolved?.kind === 'link') pieces.push(`<p>${htmlLink(resolved.title, resolved.url)}</p>`)
				break
			}
			case 'md': {
				const inlined = await resolveMd(source, part.mdId)
				if (inlined) pieces.push(await markdownToHtml(inlined))
				break
			}
			case 'image': {
				const record = source.artifacts.get(part.imageId)
				if (record?.type === 'image') {
					const safe = sanitizeUrl(record.image.url)
					if (safe)
						pieces.push(
							`<img src="${escapeHtml(safe)}" alt="${escapeHtml(record.image.prompt ?? 'Image')}" style="max-width:100%">`
						)
				}
				break
			}
			default:
				break
		}
	}
	const citedRefs = citations.citedRefs()
	if (citedRefs.length > 0) pieces.push(sourcesHtml(citedRefs))
	return pieces.join('\n')
}
