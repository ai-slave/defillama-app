import { expect, test } from 'vitest'
import { splitSparkPosts, type ParagraphPost } from '../PressReleases'

function post(id: string, title: string, publishedAt: Date, slug = id): ParagraphPost {
	return { id, title, slug, publishedAt: String(publishedAt.getTime()) }
}

test('lists every financial report and only press releases from the last three months, once each', () => {
	// Local dates on both sides: the cutoff is the visitor's calendar day three months back.
	const now = new Date(2026, 8, 15, 12)
	const result = splitSparkPosts(
		[
			post('q1', 'Q1 2025 Financial Report', new Date(2025, 3, 1)),
			post('edge', 'Launch day', new Date(2026, 5, 15)),
			post('before-edge', 'Old announcement', new Date(2026, 5, 14, 23, 59)),
			post('recent', 'New vault', new Date(2026, 8, 1)),
			post('recent-copy', 'New vault', new Date(2026, 8, 1), 'recent')
		],
		now
	)
	expect(result.financialReports.map((entry) => entry.id)).toEqual(['q1'])
	expect(result.pressReleases.map((entry) => entry.id)).toEqual(['edge', 'recent'])
})
