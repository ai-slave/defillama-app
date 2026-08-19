import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { normalizeLocalArticleDocument } from '../document'
import { ArticleRenderer } from '../renderer/ArticleRenderer'

describe('ArticleRenderer', () => {
	it('renders visible co-authors in the article byline', () => {
		const normalized = normalizeLocalArticleDocument({
			title: 'Aave fees after the exploit',
			status: 'published',
			author: 'Jane Doe',
			authorProfile: {
				id: 'profile-1',
				pbUserId: 'pb-user-1',
				slug: 'jane-doe',
				displayName: 'Jane Doe',
				socials: {},
				createdAt: '2026-01-01T00:00:00.000Z',
				updatedAt: '2026-01-01T00:00:00.000Z'
			},
			section: 'report',
			contentJson: {
				type: 'doc',
				content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Body text.' }] }]
			}
		})

		expect(normalized.ok).toBe(true)
		if (!normalized.ok) return
		const client = new QueryClient()
		const html = renderToStaticMarkup(
			<QueryClientProvider client={client}>
				<ArticleRenderer
					article={{
						...normalized.value,
						coAuthors: [
							{
								slug: 'john-doe',
								displayName: 'John Doe',
								socials: {},
								createdAt: '2026-01-01T00:00:00.000Z',
								updatedAt: '2026-01-01T00:00:00.000Z'
							}
						]
					}}
				/>
			</QueryClientProvider>
		)

		expect(html).toContain('Jane Doe')
		expect(html).toContain('John Doe')
		expect(html).toContain('/research/authors/jane-doe')
		expect(html).toContain('/research/authors/john-doe')
	})

	it('links the DefiLlama Research brand byline to the research author page', () => {
		const normalized = normalizeLocalArticleDocument({
			title: 'Market structure report',
			status: 'published',
			author: 'DefiLlama Research',
			brandByline: true,
			section: 'interview',
			contentJson: {
				type: 'doc',
				content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Body text.' }] }]
			}
		})

		expect(normalized.ok).toBe(true)
		if (!normalized.ok) return
		const client = new QueryClient()
		const html = renderToStaticMarkup(
			<QueryClientProvider client={client}>
				<ArticleRenderer article={normalized.value} />
			</QueryClientProvider>
		)

		expect(html).toContain('Interviewer')
		expect(html).toContain('DefiLlama Research')
		expect(html).toContain('href="/research/authors/defillama-research"')
		expect(html).not.toContain('href="/research"')
	})

	it('renders custom article primitives without the editor', () => {
		const normalized = normalizeLocalArticleDocument({
			title: 'Aave fees after the exploit',
			subtitle: 'A local research draft',
			status: 'draft',
			contentJson: {
				type: 'doc',
				content: [
					{
						type: 'heading',
						attrs: { level: 2 },
						content: [{ type: 'text', text: 'Fees moved' }]
					},
					{
						type: 'paragraph',
						content: [
							{
								type: 'text',
								text: 'Aave',
								marks: [{ type: 'entityLink', attrs: { entityType: 'protocol', slug: 'aave' } }]
							},
							{ type: 'text', text: ' became more expensive ' },
							{ type: 'citation', attrs: { id: '1', label: '1', url: 'https://example.com' } }
						]
					},
					{
						type: 'callout',
						attrs: { tone: 'data' },
						content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Watch the revenue line.' }] }]
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
		})

		expect(normalized.ok).toBe(true)
		if (!normalized.ok) return
		const client = new QueryClient()
		const html = renderToStaticMarkup(
			<QueryClientProvider client={client}>
				<ArticleRenderer article={normalized.value} />
			</QueryClientProvider>
		)
		expect(html).toContain('Aave fees after the exploit')
		expect(html).toContain('/protocol/aave')
		expect(html).toContain('Watch the revenue line.')
		expect(html).toContain('Fees · All time')
		expect(html).not.toContain('ProseMirror')
	})

	it('flattens nested Q&A blocks before rendering published content', () => {
		const normalized = normalizeLocalArticleDocument({
			id: 'nested-interview',
			title: 'Nested interview',
			status: 'published',
			contentJson: { type: 'doc', content: [] }
		})

		expect(normalized.ok).toBe(true)
		if (!normalized.ok) return

		const nestedContentJson = {
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

		const client = new QueryClient()
		const html = renderToStaticMarkup(
			<QueryClientProvider client={client}>
				<ArticleRenderer article={{ ...normalized.value, contentJson: nestedContentJson }} />
			</QueryClientProvider>
		)

		expect(html.match(/data-article-qa="true"/g)).toHaveLength(3)
		expect(html).toContain('Question one?')
		expect(html).toContain('Question two?')
		expect(html).toContain('Question three?')
		expect(html).not.toMatch(/data-article-qa-answer="true"[^>]*>(?:(?!<\/dd>)[\s\S])*<dl data-article-qa="true"/)
	})

	it('renders an editor-defined Q&A question number', () => {
		const normalized = normalizeLocalArticleDocument({
			id: 'custom-question-number',
			title: 'Numbered interview',
			status: 'published',
			contentJson: {
				type: 'doc',
				content: [
					{
						type: 'qa',
						attrs: { questionNumber: '07' },
						content: [
							{ type: 'qaQuestion', content: [{ type: 'text', text: 'Why seven?' }] },
							{
								type: 'qaAnswer',
								content: [{ type: 'paragraph', content: [{ type: 'text', text: 'It is intentional.' }] }]
							}
						]
					}
				]
			}
		})

		expect(normalized.ok).toBe(true)
		if (!normalized.ok) return

		const client = new QueryClient()
		const html = renderToStaticMarkup(
			<QueryClientProvider client={client}>
				<ArticleRenderer article={normalized.value} />
			</QueryClientProvider>
		)

		expect(html).toContain('data-qa-number="07"')
	})
})

describe('llamaaiChart figure captions', () => {
	const chartNode = (caption: string) => ({
		type: 'llamaaiChart',
		attrs: {
			chartConfig: {
				id: 'c1',
				type: 'bar',
				title: 'Top 10 Chains by TVL',
				description: '',
				axes: {
					x: { field: 'chain', label: 'Chain', type: 'category' },
					yAxes: [{ id: 'tvl', fields: ['tvl'], label: 'TVL', position: 'left' }]
				},
				series: [
					{
						name: 'TVL',
						type: 'bar',
						yAxisId: 'tvl',
						metricClass: 'stock',
						dataMapping: { xField: 'chain', yField: 'tvl' },
						styling: {}
					}
				],
				dataTransformation: { timeField: 'chain', metrics: ['tvl'] }
			},
			chartData: [{ chain: 'eth', tvl: 1 }],
			caption,
			savedChartId: null
		}
	})

	function renderWithCharts(nodes: unknown[]) {
		const normalized = normalizeLocalArticleDocument(
			{
				title: 'Chart article',
				slug: 'chart-article',
				status: 'draft',
				coverImage: null,
				tags: [],
				createdAt: '2026-01-01T00:00:00.000Z',
				updatedAt: '2026-01-01T00:00:00.000Z',
				publishedAt: null,
				contentJson: { type: 'doc', content: nodes }
			},
			null,
			'2026-01-01T00:00:00.000Z'
		)
		expect(normalized.ok).toBe(true)
		if (!normalized.ok) throw new Error('normalize failed')
		const client = new QueryClient()
		return renderToStaticMarkup(
			<QueryClientProvider client={client}>
				<ArticleRenderer article={normalized.value} />
			</QueryClientProvider>
		)
	}

	it('renders no figcaption or figure number when the author wrote no caption', () => {
		const html = renderWithCharts([chartNode('')])
		expect(html).not.toContain('Figure 1')
		expect(html).not.toContain('Source')
	})

	it('numbers only captioned charts, so published numbering has no gaps', () => {
		const html = renderWithCharts([chartNode(''), chartNode('Weekly fees by chain')])
		expect(html).toContain('Figure 1.')
		expect(html).toContain('Weekly fees by chain')
		expect(html).not.toContain('Figure 2.')
	})
})
