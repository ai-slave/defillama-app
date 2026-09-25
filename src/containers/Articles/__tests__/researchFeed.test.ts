// @vitest-environment happy-dom
import { describe, expect, test } from 'vitest'
import { buildResearchRssFeed } from '~/containers/Articles/researchFeed'
import type { ArticleAuthorProfile, ArticleDocument } from '~/containers/Articles/types'

const author: ArticleAuthorProfile = {
	id: 'u1',
	pbUserId: 'pb1',
	slug: 'jane-doe',
	displayName: 'Jane Doe',
	socials: {},
	createdAt: '2026-01-01T00:00:00.000Z',
	updatedAt: '2026-01-01T00:00:00.000Z'
}

const coAuthor: ArticleAuthorProfile = {
	...author,
	id: 'u2',
	pbUserId: 'pb2',
	slug: 'john-doe',
	displayName: 'John Doe'
}

function makeArticle(overrides: Partial<ArticleDocument> = {}): ArticleDocument {
	return {
		id: 'a1',
		contentVersion: 1,
		rendererVersion: 1,
		editorSchemaVersion: 1,
		title: 'Sample Article',
		slug: 'sample-article',
		status: 'published',
		author: 'Jane Doe',
		authorProfile: author,
		contentJson: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Body text.' }] }] },
		plainText: 'Body text.',
		entities: [],
		charts: [],
		citations: [],
		embeds: [],
		tags: ['defi', 'lending'],
		section: 'report',
		excerpt: 'A short summary.',
		createdAt: '2026-03-01T00:00:00.000Z',
		updatedAt: '2026-03-01T00:00:00.000Z',
		publishedAt: '2026-03-25T11:30:03.333Z',
		firstPublishedAt: '2026-03-20T08:00:00.000Z',
		...overrides
	}
}

describe('buildResearchRssFeed', () => {
	test('emits a well-formed RSS 2.0 document with every namespace prefix declared', () => {
		// happy-dom's XML parser rejects CDATA sections, so the HTML payloads are removed before parsing
		const xml = buildResearchRssFeed([makeArticle()]).replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '')
		const doc = new DOMParser().parseFromString(xml, 'application/xml')
		expect(doc.getElementsByTagName('parsererror')[0]?.textContent).toBeUndefined()
		expect(doc.documentElement.getAttribute('version')).toBe('2.0')
		const selfLink = [...doc.getElementsByTagName('atom:link')].find((link) => link.getAttribute('rel') === 'self')
		expect(selfLink?.getAttribute('href')).toBe('https://defillama.com/research/feed.xml')
	})

	test('renders item link, guid and pubDate from firstPublishedAt', () => {
		const xml = buildResearchRssFeed([makeArticle()])
		expect(xml).toContain('<link>https://defillama.com/research/report/sample-article</link>')
		expect(xml).toContain('<guid isPermaLink="true">https://defillama.com/research/report/sample-article</guid>')
		expect(xml).toContain(`<pubDate>${new Date('2026-03-20T08:00:00.000Z').toUTCString()}</pubDate>`)
	})

	test('maps tags to categories and the byline to dc:creator', () => {
		const xml = buildResearchRssFeed([makeArticle()])
		expect(xml).toContain('<category>defi</category>')
		expect(xml).toContain('<category>lending</category>')
		expect(xml).toContain('<dc:creator>Jane Doe</dc:creator>')
	})

	test('lists co-authors in the dc:creator byline', () => {
		const xml = buildResearchRssFeed([makeArticle({ coAuthors: [coAuthor] })])
		expect(xml).toContain('<dc:creator>Jane Doe, John Doe</dc:creator>')
	})

	test('uses the brand byline when set', () => {
		const xml = buildResearchRssFeed([makeArticle({ brandByline: true })])
		expect(xml).toContain('<dc:creator>DefiLlama Research</dc:creator>')
	})

	test('lists visible co-authors with the brand byline', () => {
		const xml = buildResearchRssFeed([makeArticle({ brandByline: true, coAuthors: [coAuthor] })])
		expect(xml).toContain('<dc:creator>DefiLlama Research, John Doe</dc:creator>')
	})

	test('embeds full article HTML inside a CDATA content:encoded block', () => {
		const xml = buildResearchRssFeed([makeArticle()])
		expect(xml).toContain('<content:encoded><![CDATA[')
		expect(xml).toContain('<p>Body text.</p>')
	})

	test('falls back to the excerpt when the body has no renderable content', () => {
		const xml = buildResearchRssFeed([makeArticle({ contentJson: { type: 'doc', content: [] } })])
		expect(xml).toContain('<p>A short summary.</p>')
	})

	test('skips articles without a section', () => {
		const xml = buildResearchRssFeed([makeArticle({ section: null, slug: 'no-section' })])
		expect(xml).not.toContain('no-section')
		expect(xml).not.toContain('<item>')
	})

	test('produces a valid channel with no items for empty input', () => {
		const xml = buildResearchRssFeed([])
		expect(xml).toContain('<channel>')
		expect(xml).not.toContain('<item>')
		expect(xml).not.toContain('<lastBuildDate>')
	})

	test('emits the section label as dc:type', () => {
		const xml = buildResearchRssFeed([makeArticle({ section: 'interview' })])
		expect(xml).toContain('<dc:type>Interview</dc:type>')
	})

	test('emits the updated date as an ISO-8601 dc:date distinct from pubDate', () => {
		const xml = buildResearchRssFeed([makeArticle({ lastPublishedAt: '2026-04-02T15:10:00.000Z' })])
		expect(xml).toContain('<dc:date>2026-04-02T15:10:00.000Z</dc:date>')
		const dcDate = xml.match(/<dc:date>([^<]+)<\/dc:date>/)?.[1] ?? ''
		expect(dcDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
		const pubDate = xml.match(/<pubDate>([^<]+)<\/pubDate>/)?.[1] ?? ''
		expect(dcDate).not.toBe(pubDate)
	})

	test('emits reading time rounded up at 220 words per minute', () => {
		const xml = buildResearchRssFeed([makeArticle({ plainText: Array(420).fill('word').join(' ') })])
		expect(xml).toContain('<dl:readingTime>2</dl:readingTime>')
	})

	test('emits an explicit canonical atom:link and the excerpt as atom:summary', () => {
		const xml = buildResearchRssFeed([makeArticle()])
		expect(xml).toContain(
			'<atom:link rel="alternate" href="https://defillama.com/research/report/sample-article" type="text/html" />'
		)
		expect(xml).toContain('<atom:summary>A short summary.</atom:summary>')
	})

	test('emits a featured-image enclosure with an inferred MIME type', () => {
		const xml = buildResearchRssFeed([makeArticle({ coverImage: { url: 'https://cdn.defillama.com/cover.png' } })])
		expect(xml).toContain('<enclosure url="https://cdn.defillama.com/cover.png" type="image/png" length="0" />')
	})

	test('derives person and protocol entities, mapping cex to organization without duplicates', () => {
		const xml = buildResearchRssFeed([
			makeArticle({
				interviewees: [{ name: 'Felix Fan' }, { name: 'Felix Fan' }],
				entities: [
					{ entityType: 'protocol', slug: 'hyperliquid', label: 'Hyperliquid', route: '/protocol/hyperliquid' },
					{ entityType: 'cex', slug: 'trust-wallet', label: 'Trust Wallet', route: '/cex/trust-wallet' }
				]
			})
		])
		expect(xml).toContain('<dl:entity type="person">Felix Fan</dl:entity>')
		expect(xml).toContain('<dl:entity type="protocol">Hyperliquid</dl:entity>')
		expect(xml).toContain('<dl:entity type="organization">Trust Wallet</dl:entity>')
		expect(xml.match(/<dl:entity type="person">Felix Fan<\/dl:entity>/g)).toHaveLength(1)
	})

	test('lists guest authors as structured entities but keeps them out of the dc:creator byline', () => {
		const xml = buildResearchRssFeed([
			makeArticle({
				guestAuthors: [
					{ name: 'Person A', type: 'Person', url: 'https://person-a.com' },
					{ name: 'Company B', type: 'Organization' }
				]
			})
		])
		expect(xml).toContain('<dl:entity type="person">Person A</dl:entity>')
		expect(xml).toContain('<dl:entity type="organization">Company B</dl:entity>')
		expect(xml).toContain('<dc:creator>Jane Doe</dc:creator>')
		expect(xml).not.toContain('Person A</dc:creator>')
	})
})
