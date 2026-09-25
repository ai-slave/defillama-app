import { describe, expect, test } from 'vitest'
import type { UnifiedCitationReference } from '~/containers/LlamaAI/types'
import {
	computedSummaryLabel,
	describeFigure,
	domainFromUrl,
	friendlyToolName,
	isPrivacySentinel,
	citationHeadline,
	metricLabel,
	panelViewFor,
	sanitizeExcerpt,
	shouldFlagMismatch,
	shouldFlagUnverified,
	toolArgRows,
	xHandleLabel
} from '../citationPillHelpers'

const panelRef = (over: Partial<UnifiedCitationReference>) =>
	({ id: 1, label: 'x', ...over }) as UnifiedCitationReference

describe('citationHeadline', () => {
	test('headlines a search-result set with its query, never the loose value beside the marker', () => {
		// `value` is scraped from the prose next to the marker, so for a whole-search citation it is
		// an unrelated token — it rendered as a giant "$0" above the list of articles.
		const searchSet = panelRef({
			sourceType: 'web',
			value: '$0',
			label: 'Web search: EigenLayer slashing adoption',
			sources: [{ id: 1, sourceType: 'web', label: 'Slashing Goes Live', url: 'https://blog.eigenlayer.xyz/s' }]
		})
		expect(citationHeadline(searchSet)).toBe('Web search: EigenLayer slashing adoption')
	})

	test('still headlines a figure-bearing data citation with the figure', () => {
		expect(citationHeadline(panelRef({ sourceType: 'data', value: '$328.6M', rows: [{ tvl: 1 }] }))).toBe('$328.6M')
	})

	test('keeps the value for a web citation bound to one article', () => {
		expect(citationHeadline(panelRef({ sourceType: 'web', value: '$4.2M', url: 'https://protos.com/a' }))).toBe('$4.2M')
	})
})

describe('panelViewFor', () => {
	test('falls back to the data view for web/x refs that carry sources instead of their own url', () => {
		// web_search citations that could not be bound to one result row have no url of their own —
		// their links live in `sources`, which only the data view renders. Routing them to the web
		// view left the detail panel blank and the sources unreachable.
		const websearch = panelRef({
			sourceType: 'web',
			sources: [{ id: 1, sourceType: 'web', label: 'Protos', url: 'https://protos.com' }]
		})
		expect(panelViewFor(websearch)).toBe('data')
		expect(panelViewFor(panelRef({ sourceType: 'x', rows: [{ text: 'gm' }] }))).toBe('data')
	})

	test('keeps the link view when the ref has its own url', () => {
		expect(panelViewFor(panelRef({ sourceType: 'web', url: 'https://protos.com' }))).toBe('web')
		expect(panelViewFor(panelRef({ sourceType: 'x', url: 'https://x.com/a/1' }))).toBe('x')
	})

	test('renders nothing rather than an empty data view when there is no payload at all', () => {
		expect(panelViewFor(panelRef({ sourceType: 'web' }))).toBe(null)
		expect(panelViewFor(panelRef({ sourceType: 'unknown' }))).toBe(null)
	})

	test('passes every other source type straight through', () => {
		for (const t of ['data', 'computed', 'tool', 'file'] as const) {
			expect(panelViewFor(panelRef({ sourceType: t }))).toBe(t)
		}
	})
})

describe('metricLabel', () => {
	test('composes base + time window', () => {
		expect(metricLabel('fees_30d')).toBe('fees (30 days)')
		expect(metricLabel('fees_365d')).toBe('fees (1 year)')
		expect(metricLabel('app_fees_7d')).toBe('app fees (7 days)')
		expect(metricLabel('volume_derivatives_30d')).toBe('derivatives (perps) volume (30 days)')
		expect(metricLabel('chain_holder_revenue_30d')).toBe('chain holder revenue (30 days)')
	})
	test('handles pct_change as a change label', () => {
		expect(metricLabel('tvl_base_30d_pct_change')).toBe('total value locked change (30 days)')
		expect(metricLabel('mcap_7d_pct_change')).toBe('market cap change (7 days)')
		expect(metricLabel('tvl_30d_pct')).toBe('total value locked change (30 days)')
	})
	test('does not greedy-split multi-word bases', () => {
		expect(metricLabel('volume_options_notional')).toBe('options notional volume')
		expect(metricLabel('fdv_outstanding')).toBe('FDV (outstanding supply)')
	})
})

describe('describeFigure', () => {
	test('names the metric and entity from the cited row', () => {
		const ref = {
			id: 1,
			sourceType: 'data',
			label: 'DefiLlama warehouse',
			value: '2.5×',
			field: 'pf_ratio',
			rows: [{ name: 'uniswap', pf_ratio: 2.5 }],
			columns: ['name', 'pf_ratio']
		} as unknown as UnifiedCitationReference
		expect(describeFigure(ref, { rowIndex: 0, column: 'pf_ratio' })).toBe(
			'Uniswap · P/F ratio (market cap ÷ annualized fees)'
		)
	})

	test('keeps digit-bearing entity names', () => {
		const ref = {
			id: 1,
			sourceType: 'data',
			label: 'DefiLlama warehouse',
			value: '2.5×',
			field: 'pf_ratio',
			rows: [{ name: 'Uniswap V3', pf_ratio: 2.5 }],
			columns: ['name', 'pf_ratio']
		} as unknown as UnifiedCitationReference
		expect(describeFigure(ref, { rowIndex: 0, column: 'pf_ratio' })).toBe(
			'Uniswap V3 · P/F ratio (market cap ÷ annualized fees)'
		)
	})

	test('returns null when there is no field', () => {
		const ref = { id: 1, sourceType: 'computed', label: 'Calculated' } as UnifiedCitationReference
		expect(describeFigure(ref, null)).toBeNull()
	})
})

describe('sanitizeExcerpt', () => {
	test('returns empty for non-strings', () => {
		expect(sanitizeExcerpt(undefined)).toBe('')
		expect(sanitizeExcerpt(null)).toBe('')
		expect(sanitizeExcerpt(42)).toBe('')
	})

	test('strips a leading bracketed prefix', () => {
		expect(sanitizeExcerpt('[posted Jun 3] Aave hit a new high')).toBe('Aave hit a new high')
	})

	test('strips multiple leading bracket groups', () => {
		expect(sanitizeExcerpt('[a] [b]   real text')).toBe('real text')
	})

	test('strips a trailing bare URL', () => {
		expect(sanitizeExcerpt('Read more here https://t.co/abc123')).toBe('Read more here')
	})

	test('collapses whitespace', () => {
		expect(sanitizeExcerpt('a\n\n  b\t c')).toBe('a b c')
	})

	test('clamps to the max length with an ellipsis on a word boundary', () => {
		// The 20-character cut lands inside "approved"; the partial word is dropped.
		expect(sanitizeExcerpt('Aave governance approved treasury diversification', 20)).toBe('Aave governance…')
	})

	test('leaves clean short text untouched', () => {
		expect(sanitizeExcerpt('A clean tweet.')).toBe('A clean tweet.')
	})
})

describe('domainFromUrl', () => {
	test('extracts a bare domain and drops www', () => {
		expect(domainFromUrl('https://www.example.com/path?q=1')).toBe('example.com')
	})

	test('handles urls without a scheme', () => {
		expect(domainFromUrl('blog.defillama.com/post')).toBe('blog.defillama.com')
	})

	test('returns null for empty or non-string input', () => {
		expect(domainFromUrl('')).toBeNull()
		expect(domainFromUrl(undefined)).toBeNull()
		expect(domainFromUrl(123)).toBeNull()
	})
})

describe('xHandleLabel', () => {
	test('keeps an existing handle', () => {
		expect(xHandleLabel('@defillama')).toBe('@defillama')
	})

	test('prefixes a bare handle', () => {
		expect(xHandleLabel('defillama')).toBe('@defillama')
	})

	test('normalizes extra leading @', () => {
		expect(xHandleLabel('@@x')).toBe('@x')
	})

	test('returns null for empty input', () => {
		expect(xHandleLabel('')).toBeNull()
		expect(xHandleLabel(undefined)).toBeNull()
	})
})

describe('friendlyToolName', () => {
	test('prefers the provided label', () => {
		expect(friendlyToolName({ sourceType: 'tool', label: 'Onchain call' } as UnifiedCitationReference)).toBe(
			'Onchain call'
		)
	})

	test('falls back to a humanized tool name', () => {
		expect(
			friendlyToolName({ sourceType: 'tool', label: '', toolName: 'call_contract' } as UnifiedCitationReference)
		).toBe('Calling contract')
	})

	test('falls back to Tool when nothing is available', () => {
		expect(friendlyToolName({ sourceType: 'tool', label: '' } as UnifiedCitationReference)).toBe('Tool')
	})
})

describe('isPrivacySentinel', () => {
	test('matches the sentinel', () => {
		expect(isPrivacySentinel('[value omitted — sensitive]')).toBe(true)
		expect(isPrivacySentinel('  [value omitted — sensitive]  ')).toBe(true)
	})

	test('does not match other text', () => {
		expect(isPrivacySentinel('some value')).toBe(false)
		expect(isPrivacySentinel(undefined)).toBe(false)
	})
})

describe('toolArgRows', () => {
	test('humanizes keys and formats values', () => {
		expect(toolArgRows({ chain_id: 1, address: '0xabc' })).toEqual([
			{ key: 'Chain Id', value: '1' },
			{ key: 'Address', value: '0xabc' }
		])
	})

	test('drops empty values', () => {
		expect(toolArgRows({ a: '', b: null, c: 'x' })).toEqual([{ key: 'C', value: 'x' }])
	})

	test('joins arrays', () => {
		expect(toolArgRows({ ids: ['a', 'b'] })).toEqual([{ key: 'Ids', value: 'a, b' }])
	})

	test('returns empty for missing args', () => {
		expect(toolArgRows(undefined)).toEqual([])
	})
})

describe('computedSummaryLabel', () => {
	test('pluralizes by source count', () => {
		expect(
			computedSummaryLabel({ sourceType: 'computed', sources: [{}, {}] } as unknown as UnifiedCitationReference)
		).toBe('Calculated from 2 sources')
		expect(computedSummaryLabel({ sourceType: 'computed', sources: [{}] } as unknown as UnifiedCitationReference)).toBe(
			'Calculated from 1 source'
		)
	})

	test('returns null with no sources', () => {
		expect(computedSummaryLabel({ sourceType: 'computed' } as UnifiedCitationReference)).toBeNull()
	})
})

describe('verification flags', () => {
	test('flags only quantitative mismatch', () => {
		expect(shouldFlagMismatch({ claimType: 'quantitative', valueMatch: 'mismatch' } as any)).toBe(true)
		expect(shouldFlagMismatch({ claimType: 'quantitative', valueMatch: 'unverified' } as any)).toBe(false)
		expect(shouldFlagMismatch({ claimType: 'qualitative', valueMatch: 'mismatch' } as any)).toBe(false)
		expect(shouldFlagMismatch(undefined)).toBe(false)
	})
	test('flags only quantitative unverified', () => {
		expect(shouldFlagUnverified({ claimType: 'quantitative', valueMatch: 'unverified' } as any)).toBe(true)
		expect(shouldFlagUnverified({ claimType: 'quantitative', valueMatch: 'match' } as any)).toBe(false)
		expect(shouldFlagUnverified({ claimType: 'qualitative', valueMatch: 'unverified' } as any)).toBe(false)
		expect(shouldFlagUnverified(undefined)).toBe(false)
	})
})
