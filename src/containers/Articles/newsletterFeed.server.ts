import type { ResearchNewsletterItem, ResearchNewsletterListResponse } from '~/containers/Articles/newsletterFeed'
import { cachedResult } from '~/server/api/resultCache'

const DEFAULT_RESEARCH_NEWSLETTER_FEED_URL = 'https://rss.beehiiv.com/feeds/yFIFdSjo5o.xml'
const FEED_CACHE_TTL_MS = 10 * 60 * 1000
const FEED_STALE_WHILE_REVALIDATE_MS = 6 * 60 * 60 * 1000
const FEED_FETCH_TIMEOUT_MS = 8000
const MAX_FEED_BYTES = 2 * 1024 * 1024
const MAX_LANDING_ITEMS = 5

function asTrimmedString(value: string | null | undefined): string | null {
	if (typeof value !== 'string') return null
	const trimmed = value.trim()
	return trimmed.length > 0 ? trimmed : null
}

function decodeXmlEntities(value: string): string {
	const namedEntities: Record<string, string> = {
		amp: '&',
		apos: "'",
		gt: '>',
		lt: '<',
		quot: '"'
	}

	return value.replace(
		/&(?:#(\d+)|#[xX]([0-9a-fA-F]+)|(amp|apos|gt|lt|quot));/g,
		(entity: string, decimal: string | undefined, hexadecimal: string | undefined, named: string | undefined) => {
			if (named) return namedEntities[named] ?? entity

			const codePoint = decimal ? Number.parseInt(decimal, 10) : Number.parseInt(hexadecimal ?? '', 16)
			if (
				!Number.isInteger(codePoint) ||
				codePoint <= 0 ||
				codePoint > 0x10_ff_ff ||
				(codePoint >= 0xd8_00 && codePoint <= 0xdf_ff)
			) {
				return entity
			}
			return String.fromCodePoint(codePoint)
		}
	)
}

function readElementText(xml: string, tagName: string): string | null {
	const element = xml.match(new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}\\s*>`, 'i'))
	const rawValue = asTrimmedString(element?.[1])
	if (!rawValue) return null

	const cdata = rawValue.match(/^<!\[CDATA\[([\s\S]*)\]\]>$/)
	return asTrimmedString(cdata ? cdata[1] : decodeXmlEntities(rawValue))
}

function readEnclosureUrl(xml: string): string | null {
	const enclosure = xml.match(/<enclosure\b([^>]*)\/?\s*>/i)
	const attributes = enclosure?.[1]
	if (!attributes) return null

	const urlAttribute = attributes.match(/\burl\s*=\s*(?:"([^"]*)"|'([^']*)')/i)
	const rawUrl = urlAttribute?.[1] ?? urlAttribute?.[2]
	return rawUrl ? decodeXmlEntities(rawUrl) : null
}

function asSafeHttpUrl(value: string | null | undefined): string | null {
	const rawUrl = asTrimmedString(value)
	if (!rawUrl) return null

	try {
		const url = new URL(rawUrl)
		return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
	} catch {
		return null
	}
}

function asIsoDate(value: string | null | undefined): string | null {
	const rawDate = asTrimmedString(value)
	if (!rawDate) return null
	const date = new Date(rawDate)
	return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function parseResearchNewsletterFeed(xml: string): Array<ResearchNewsletterItem> {
	const items: Array<ResearchNewsletterItem> = []
	for (const match of xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item\s*>/gi)) {
		const itemXml = match[1]
		if (!itemXml) continue

		const title = readElementText(itemXml, 'title')
		const href = asSafeHttpUrl(readElementText(itemXml, 'link'))
		if (!title || !href) continue

		items.push({
			id: readElementText(itemXml, 'guid') ?? href,
			title,
			description: readElementText(itemXml, 'description'),
			href,
			imageUrl: asSafeHttpUrl(readEnclosureUrl(itemXml)),
			publishedAt: asIsoDate(readElementText(itemXml, 'pubDate') ?? readElementText(itemXml, 'atom:published'))
		})
	}

	return items
}

async function fetchResearchNewsletterItems(feedUrl: string): Promise<Array<ResearchNewsletterItem>> {
	const response = await fetch(feedUrl, {
		headers: {
			Accept: 'application/rss+xml, application/xml;q=0.9, text/xml;q=0.8',
			'User-Agent': 'DefiLlama-Research/1.0'
		},
		signal: AbortSignal.timeout(FEED_FETCH_TIMEOUT_MS)
	})

	if (!response.ok) {
		throw new Error(`Beehiiv RSS request failed with status ${response.status}`)
	}

	const contentLength = Number(response.headers.get('content-length') ?? 0)
	if (contentLength > MAX_FEED_BYTES) {
		throw new Error('Beehiiv RSS response is larger than expected')
	}

	const xml = await response.text()
	if (Buffer.byteLength(xml) > MAX_FEED_BYTES) {
		throw new Error('Beehiiv RSS response is larger than expected')
	}

	return parseResearchNewsletterFeed(xml)
}

function getCachedResearchNewsletterItems(): Promise<Array<ResearchNewsletterItem>> {
	const feedUrl = process.env.BEEHIIV_RESEARCH_RSS_URL?.trim() || DEFAULT_RESEARCH_NEWSLETTER_FEED_URL

	return cachedResult(
		'research-newsletter-feed-v2',
		feedUrl,
		{
			ttlMs: FEED_CACHE_TTL_MS,
			staleWhileRevalidateMs: FEED_STALE_WHILE_REVALIDATE_MS,
			maxEntries: 2
		},
		() => fetchResearchNewsletterItems(feedUrl)
	)
}

export async function getResearchNewsletterItems(): Promise<Array<ResearchNewsletterItem>> {
	return (await getCachedResearchNewsletterItems()).slice(0, MAX_LANDING_ITEMS)
}

export function getResearchNewsletterArchiveItems(): Promise<Array<ResearchNewsletterItem>> {
	return getCachedResearchNewsletterItems()
}

export function searchResearchNewsletterItems(
	items: Array<ResearchNewsletterItem>,
	query: string,
	limit: number
): ResearchNewsletterListResponse {
	const normalizedQuery = query.trim().toLocaleLowerCase()
	const matches = normalizedQuery
		? items.filter((item) => `${item.title} ${item.description ?? ''}`.toLocaleLowerCase().includes(normalizedQuery))
		: items

	return {
		items: matches.slice(0, limit),
		totalItems: matches.length
	}
}
