import { describe, expect, test } from 'vitest'
import { datasetNode, faqPageNode, jsonLdDocument } from '../jsonLd'

describe('jsonLdDocument', () => {
	test('a FAQ answer is the same text the page shows', () => {
		const document = jsonLdDocument([
			faqPageNode([{ question: 'What is a DEX aggregator?', answer: 'A DEX aggregator routes swaps.' }])
		])

		expect(document).toEqual({
			'@context': 'https://schema.org',
			'@type': 'FAQPage',
			mainEntity: [
				{
					'@type': 'Question',
					name: 'What is a DEX aggregator?',
					acceptedAnswer: { '@type': 'Answer', text: 'A DEX aggregator routes swaps.' }
				}
			]
		})
	})

	test('a dataset and a FAQ share one graph', () => {
		const document = jsonLdDocument([
			datasetNode({
				name: 'Top stablecoins by market cap',
				description: 'USDT is 60% of the market.',
				url: 'https://defillama.com/stablecoins'
			}),
			faqPageNode([{ question: 'What is USDT dominance?', answer: 'USDT is 60% of the market.' }])
		])

		expect(document['@context']).toBe('https://schema.org')
		expect(document['@graph']).toEqual([
			{
				'@type': 'Dataset',
				name: 'Top stablecoins by market cap',
				description: 'USDT is 60% of the market.',
				url: 'https://defillama.com/stablecoins',
				creator: { '@type': 'Organization', name: 'DefiLlama', url: 'https://defillama.com' },
				isAccessibleForFree: true
			},
			{
				'@type': 'FAQPage',
				mainEntity: [
					{
						'@type': 'Question',
						name: 'What is USDT dominance?',
						acceptedAnswer: { '@type': 'Answer', text: 'USDT is 60% of the market.' }
					}
				]
			}
		])
	})
})
