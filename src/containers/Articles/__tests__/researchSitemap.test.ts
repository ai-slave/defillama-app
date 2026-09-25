import { describe, expect, test } from 'vitest'
import type { ArticlePathItem } from '~/containers/Articles/api'
import { articlePathToSitemapPath, buildResearchSitemapEntries } from '~/containers/Articles/researchSitemap'
import { ARTICLE_SECTIONS, ARTICLE_SECTION_SLUGS } from '~/containers/Articles/types'

describe('researchSitemap', () => {
	test('maps article paths to canonical research URLs', () => {
		expect(
			articlePathToSitemapPath({
				slug: 'example-slug',
				section: 'report',
				updatedAt: '2026-03-25T11:30:03.333Z'
			})
		).toBe('research/report/example-slug')
	})

	test('returns null for unknown sections', () => {
		expect(
			articlePathToSitemapPath({
				slug: 'example-slug',
				section: 'unknown' as ArticlePathItem['section'],
				updatedAt: '2026-03-25T11:30:03.333Z'
			})
		).toBeNull()
	})

	test('includes hub, section landings and article lastmod', () => {
		const entries = buildResearchSitemapEntries([
			{
				slug: 'example-slug',
				section: 'report',
				updatedAt: '2026-03-25T11:30:03.333Z'
			}
		])

		expect(entries[0]).toEqual({ path: 'research' })

		for (const section of ARTICLE_SECTIONS) {
			expect(entries).toContainEqual({
				path: `research/${ARTICLE_SECTION_SLUGS[section]}`
			})
		}

		expect(entries).toContainEqual({
			path: 'research/report/example-slug',
			lastmod: '2026-03-25T11:30:03.333Z'
		})
	})
})
