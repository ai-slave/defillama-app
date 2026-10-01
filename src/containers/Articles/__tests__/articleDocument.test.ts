import { describe, expect, test } from 'vitest'
import { normalizeLocalArticleDocument } from '../document'

const ARTICLE_NOW = '2026-07-14T00:00:00.000Z'

const now = '2026-05-01T10:00:00.000Z'

describe('local article documents', () => {
	test('normalizes metadata and extracts article primitives', () => {
		const result = normalizeLocalArticleDocument(
			{
				title: 'Aave fees after the exploit',
				status: 'published',
				contentJson: {
					type: 'doc',
					content: [
						{
							type: 'paragraph',
							content: [
								{
									type: 'text',
									text: 'Aave',
									marks: [
										{
											type: 'entityLink',
											attrs: { entityType: 'protocol', slug: 'aave', label: 'Aave' }
										}
									]
								},
								{ type: 'text', text: ' fees moved.' },
								{ type: 'citation', attrs: { id: '1', label: '1', url: 'https://example.com/source' } }
							]
						},
						{
							type: 'defillamaChart',
							attrs: {
								config: {
									entities: [{ entityType: 'protocol', slug: 'aave', name: 'Aave' }],
									chartType: 'fees'
								}
							}
						}
					]
				}
			},
			null,
			now
		)

		expect(result.ok).toBe(true)
		if (!result.ok) return
		expect(result.value.contentVersion).toBe(1)
		expect(result.value.rendererVersion).toBe(1)
		expect(result.value.editorSchemaVersion).toBe(1)
		expect(result.value.slug).toBe('aave-fees-after-the-exploit')
		expect(result.value.publishedAt).toBe(now)
		expect(result.value.plainText).toContain('Aave fees moved')
		expect(result.value.entities).toEqual([
			{ entityType: 'protocol', slug: 'aave', label: 'Aave', route: '/protocol/aave' }
		])
		expect(result.value.charts).toHaveLength(1)
		expect(result.value.charts[0]).toMatchObject({
			series: [{ entityType: 'protocol', slug: 'aave', name: 'Aave', chartType: 'fees' }],
			entities: [{ entityType: 'protocol', slug: 'aave', name: 'Aave' }],
			chartType: 'fees'
		})
		expect(result.value.citations).toEqual([{ id: '1', label: '1', url: 'https://example.com/source' }])
	})

	test('rejects dashboard embed nodes', () => {
		const result = normalizeLocalArticleDocument(
			{
				title: 'Dashboard embed',
				contentJson: {
					type: 'doc',
					content: [{ type: 'dashboardEmbed', attrs: { items: [] } }]
				}
			},
			null,
			ARTICLE_NOW
		)

		expect(result.ok).toBe(false)
	})

	test('normalizes interviewees and strips empty entries', () => {
		const result = normalizeLocalArticleDocument(
			{
				title: 'An interview',
				section: 'interview',
				contentJson: { type: 'doc', content: [] },
				interviewees: [
					{ name: '  Stani  ', role: 'Founder, Aave', externalUrl: 'twitter.com/stani' },
					{ name: '' },
					{ name: 'Hayden', authorSlug: 'hayden' }
				]
			},
			null,
			now
		)

		expect(result.ok).toBe(true)
		if (!result.ok) return
		expect(result.value.section).toBe('interview')
		expect(result.value.interviewees).toEqual([
			{ name: 'Stani', role: 'Founder, Aave', externalUrl: 'https://twitter.com/stani' },
			{ name: 'Hayden', authorSlug: 'hayden' }
		])
	})

	test('flattens nested Q&A blocks while normalizing article content', () => {
		const result = normalizeLocalArticleDocument(
			{
				title: 'Nested interview',
				contentJson: {
					type: 'doc',
					content: [
						{
							type: 'qa',
							content: [
								{ type: 'qaQuestion', content: [{ type: 'text', text: 'Question one?' }] },
								{
									type: 'qaAnswer',
									content: [
										{ type: 'paragraph', content: [{ type: 'text', text: 'Answer one.' }] },
										{
											type: 'qa',
											content: [
												{ type: 'qaQuestion', content: [{ type: 'text', text: 'Question two?' }] },
												{
													type: 'qaAnswer',
													content: [
														{ type: 'paragraph', content: [{ type: 'text', text: 'Answer two.' }] },
														{
															type: 'qa',
															content: [
																{ type: 'qaQuestion', content: [{ type: 'text', text: 'Question three?' }] },
																{
																	type: 'qaAnswer',
																	content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Answer three.' }] }]
																}
															]
														}
													]
												}
											]
										}
									]
								}
							]
						}
					]
				}
			},
			null,
			ARTICLE_NOW
		)

		expect(result.ok).toBe(true)
		if (!result.ok) return
		const qaBlock = (question: string, answer: string) => ({
			type: 'qa',
			content: [
				{ type: 'qaQuestion', content: [{ type: 'text', text: question }] },
				{ type: 'qaAnswer', content: [{ type: 'paragraph', content: [{ type: 'text', text: answer }] }] }
			]
		})
		expect(result.value.contentJson.content).toEqual([
			qaBlock('Question one?', 'Answer one.'),
			qaBlock('Question two?', 'Answer two.'),
			qaBlock('Question three?', 'Answer three.')
		])
	})

	test('preserves existing createdAt while updating updatedAt', () => {
		const result = normalizeLocalArticleDocument(
			{
				title: 'Draft',
				status: 'draft',
				contentJson: { type: 'doc', content: [] }
			},
			{
				contentVersion: 1,
				rendererVersion: 1,
				editorSchemaVersion: 1,
				title: 'Old',
				slug: 'old',
				status: 'draft',
				coverImage: null,
				contentJson: { type: 'doc', content: [] },
				plainText: '',
				entities: [],
				charts: [],
				citations: [],
				embeds: [],
				tags: [],
				createdAt: '2026-04-01T00:00:00.000Z',
				updatedAt: '2026-04-02T00:00:00.000Z',
				publishedAt: null
			},
			now
		)

		expect(result.ok).toBe(true)
		if (!result.ok) return
		expect(result.value.createdAt).toBe('2026-04-01T00:00:00.000Z')
		expect(result.value.updatedAt).toBe(now)
		expect(result.value.publishedAt).toBeNull()
	})
})
