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

describe('PillBody — web citation without a bound url', () => {
	const html = renderToStaticMarkup(
		<PillBody reference={unboundWebSearch} citedCell={null} advancedProvenance={false} />
	)

	// The panel is the ONLY way to reach these links: the pill renders "Click to see the source →"
	// instead of a direct anchor precisely because the ref has no url of its own. An empty body
	// makes every searched source unreachable.
	test('renders the searched sources so the panel is never empty', () => {
		expect(html).not.toBe('')
		expect(html).toContain('https://protos.com/cap-labs-slashes-stabledrop/')
		expect(html).toContain('https://thedefiant.io/cap-founder-apologises/')
	})

	test('keeps each source labelled so the list is readable', () => {
		expect(html).toContain('Cap Labs slashes Stabledrop rewards')
		expect(html).toContain('Cap founder apologises for airdrop cut')
	})

	// The title is the thing a reader scans; a separate 12px "Open source" line under it reads as
	// decoration, so the headline itself has to be the click target.
	test('makes each source title the link, not a separate line under it', () => {
		const anchors = [...html.matchAll(/<a [^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/g)].map((m) => ({
			href: m[1],
			text: m[2]
		}))
		expect(anchors).toHaveLength(2)
		expect(anchors[0]).toMatchObject({ href: 'https://protos.com/cap-labs-slashes-stabledrop/' })
		expect(anchors[0].text).toContain('Cap Labs slashes Stabledrop rewards')
		expect(anchors[1].text).toContain('Cap founder apologises for airdrop cut')
		expect(html).not.toContain('Open source')
	})

	// web_search rows carry a ~1,500-char snippet; without it the panel is a wall of blue titles
	// with nothing to judge relevance by.
	test('shows each source snippet and domain, not just the title', () => {
		expect(html).toContain('cUSD supply/TVL dropped from $80M to $57M')
		expect(html).toContain('protos.com')
	})

	test('still exposes a link when a source arrives without a title', () => {
		const untitled = {
			...unboundWebSearch,
			sources: [{ id: 1, sourceType: 'web', label: '', url: 'https://protos.com/untitled/' }]
		} as UnifiedCitationReference
		const out = renderToStaticMarkup(<PillBody reference={untitled} citedCell={null} advancedProvenance={false} />)
		expect(out).toContain('https://protos.com/untitled/')
		expect(out).toContain('Open source')
	})
})

describe('PillBody — web citation with a bound url', () => {
	test('still renders the direct link view', () => {
		const bound: UnifiedCitationReference = {
			id: 3,
			sourceType: 'web',
			label: 'Protos',
			url: 'https://protos.com/cap-labs-slashes-stabledrop/',
			excerpt: 'cUSD supply dropped from $80M to $57M',
			verification: { claimType: 'qualitative', grounded: true }
		} as UnifiedCitationReference
		const html = renderToStaticMarkup(<PillBody reference={bound} citedCell={null} advancedProvenance={false} />)
		expect(html).toContain('protos.com')
		expect(html).toContain('cUSD supply dropped from $80M to $57M')
		expect(html).toContain('https://protos.com/cap-labs-slashes-stabledrop/')
	})
})
