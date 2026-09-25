// @vitest-environment happy-dom
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import type { UnifiedCitationReference } from '~/containers/LlamaAI/types'
import { PillBody } from '../CitationPill'

// A web_search citation whose claim could not be bound to one result row: no `url`, no `excerpt`,
// no `rows` — the searched-set links live in `sources`. Shape copied from a stored session ref.
const unboundWebSearch: UnifiedCitationReference = {
	id: 29,
	handle: 'websearch_7d8f99',
	sourceType: 'web',
	label: 'Web search: Cap app airdrop rug depositors drama',
	sql: [],
	columns: ['_n', 'title', 'url', 'trust', 'highlights'],
	sources: [
		{
			id: 1,
			sourceType: 'web',
			label: 'Cap Labs slashes Stabledrop rewards',
			url: 'https://protos.com/cap-labs-slashes-stabledrop/',
			excerpt: 'cUSD supply/TVL dropped from $80M to $57M in the following days.',
			verification: { claimType: 'qualitative', grounded: true }
		},
		{
			id: 2,
			sourceType: 'web',
			label: 'Cap founder apologises for airdrop cut',
			url: 'https://thedefiant.io/cap-founder-apologises/',
			verification: { claimType: 'qualitative', grounded: true }
		}
	],
	verification: { claimType: 'qualitative', grounded: true }
} as UnifiedCitationReference

function render(reference: UnifiedCitationReference) {
	const container = document.createElement('div')
	container.innerHTML = renderToStaticMarkup(
		<PillBody reference={reference} citedCell={null} advancedProvenance={false} />
	)
	return container
}
const links = (container: HTMLElement) =>
	Array.from(container.querySelectorAll('a'), (a) => ({ href: a.getAttribute('href'), text: a.textContent?.trim() }))

// The panel is the only way to reach these links: the pill has no url of its own, so it opens the
// panel instead of a direct anchor. An empty body would make every searched source unreachable.
describe('PillBody — web citation without a bound url', () => {
	test('links each searched source by its title, not by a separate "Open source" line', () => {
		expect(links(render(unboundWebSearch))).toEqual([
			{ href: 'https://protos.com/cap-labs-slashes-stabledrop/', text: 'Cap Labs slashes Stabledrop rewards ↗' },
			{ href: 'https://thedefiant.io/cap-founder-apologises/', text: 'Cap founder apologises for airdrop cut ↗' }
		])
	})

	// web_search rows carry a ~1,500-char snippet; without it the panel is a wall of titles with
	// nothing to judge relevance by.
	test('shows each source snippet and domain as text', () => {
		const text = render(unboundWebSearch).textContent
		expect(text).toContain('cUSD supply/TVL dropped from $80M to $57M')
		expect(text).toContain('protos.com')
		expect(text).toContain('thedefiant.io')
	})

	test('still exposes a link when a source arrives without a title', () => {
		const untitled = {
			...unboundWebSearch,
			sources: [{ id: 1, sourceType: 'web', label: '', url: 'https://protos.com/untitled/' }]
		} as UnifiedCitationReference
		expect(links(render(untitled))).toEqual([{ href: 'https://protos.com/untitled/', text: 'Open source ↗' }])
	})
})

test('a web citation with a bound url shows its domain, excerpt and direct link', () => {
	const container = render({
		id: 3,
		sourceType: 'web',
		label: 'Protos',
		url: 'https://protos.com/cap-labs-slashes-stabledrop/',
		excerpt: 'cUSD supply dropped from $80M to $57M',
		verification: { claimType: 'qualitative', grounded: true }
	} as UnifiedCitationReference)
	expect(container.textContent).toContain('protos.com')
	expect(container.textContent).toContain('cUSD supply dropped from $80M to $57M')
	expect(links(container)).toEqual([{ href: 'https://protos.com/cap-labs-slashes-stabledrop/', text: 'Open link ↗' }])
})
