/** Schema.org nodes without `@context`. `jsonLdDocument` adds the context once. */

export function faqPageNode(questions: ReadonlyArray<{ question: string; answer: string }>): Record<string, unknown> {
	return {
		'@type': 'FAQPage',
		mainEntity: questions.map((item) => ({
			'@type': 'Question',
			name: item.question,
			acceptedAnswer: { '@type': 'Answer', text: item.answer }
		}))
	}
}

export function datasetNode(input: { name: string; description: string; url: string }): Record<string, unknown> {
	return {
		'@type': 'Dataset',
		name: input.name,
		description: input.description,
		url: input.url,
		creator: { '@type': 'Organization', name: 'DefiLlama', url: 'https://defillama.com' },
		isAccessibleForFree: true
	}
}

/** One script. A single node stays a typed object; several nodes share one `@graph`. */
export function jsonLdDocument(nodes: ReadonlyArray<Record<string, unknown>>): Record<string, unknown> {
	if (nodes.length === 1) return { '@context': 'https://schema.org', ...nodes[0] }
	return { '@context': 'https://schema.org', '@graph': nodes }
}
