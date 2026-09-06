import { describe, expect, test } from 'vitest'
import { buildSitemapXml, encodeSitemapPath, escapeXml } from '../sitemapXml'

describe('sitemapXml', () => {
	test('escapes XML special characters', () => {
		expect(escapeXml(`a&b<c>d"e'f`)).toBe('a&amp;b&lt;c&gt;d&quot;e&apos;f')
	})

	test('omits lastmod when metadata is absent', () => {
		const xml = buildSitemapXml('https://defillama.com', [{ path: 'research' }])

		expect(xml).toContain('<loc>https://defillama.com/research</loc>')
		expect(xml).not.toContain('<lastmod>')
	})

	test('renders lastmod when provided', () => {
		const xml = buildSitemapXml('https://defillama.com', [
			{
				path: 'research/report/example-slug',
				lastmod: '2026-03-25T11:30:03.333Z'
			}
		])

		expect(xml).toContain('<loc>https://defillama.com/research/report/example-slug</loc>')
		expect(xml).toContain('<lastmod>2026-03-25T11:30:03.333Z</lastmod>')
	})

	test('omits lastmod when the date is not parseable', () => {
		const xml = buildSitemapXml('https://defillama.com', [
			{
				path: 'research/report/example-slug',
				lastmod: 'not-a-date'
			}
		])

		expect(xml).not.toContain('<lastmod>')
	})

	test('does not double-encode pre-encoded path segments', () => {
		expect(encodeSitemapPath('rwa/asset/ondo%2Fusdy')).toBe('rwa/asset/ondo%2Fusdy')
	})

	test('encodes raw special characters in path segments', () => {
		expect(encodeSitemapPath('rwa/asset/foo bar')).toBe('rwa/asset/foo%20bar')
	})

	test('encodes malformed percent sequences without throwing', () => {
		expect(encodeSitemapPath('rwa/asset/100%')).toBe('rwa/asset/100%25')
	})

	test('renders pre-encoded RWA asset paths in sitemap loc', () => {
		const xml = buildSitemapXml('https://defillama.com', [{ path: 'rwa/asset/ondo%2Fusdy' }])

		expect(xml).toContain('<loc>https://defillama.com/rwa/asset/ondo%2Fusdy</loc>')
		expect(xml).not.toContain('ondo%252Fusdy')
	})
})
