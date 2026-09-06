import { describe, expect, test } from 'vitest'
import type { UnifiedCitationReference } from '~/containers/LlamaAI/types'
import {
	normalizeSourceUrl,
	prepareAlertSummaryMarkdown,
	processUnifiedCitations,
	wrapLegacyUrlCitations
} from '../markdownHelpers'

const refs = (ids: Array<number>): Array<UnifiedCitationReference> =>
	ids.map((id) => ({ id, sourceType: 'data', label: 'DefiLlama warehouse' }))

const modelStyleCitation = '【5†source】'

describe('processUnifiedCitations', () => {
	test('renders a single [1] as one pill placeholder keyed by id', () => {
		expect(processUnifiedCitations('Aave is $13.55B [1].', refs([1]))).toBe(
			'Aave is $13.55B <fact-check-pill data-ref="1"></fact-check-pill>.'
		)
	})

	test('splits [1,2] into two adjacent pills', () => {
		expect(processUnifiedCitations('X [1,2].', refs([1, 2]))).toBe(
			'X <fact-check-pill data-ref="1"></fact-check-pill><fact-check-pill data-ref="2"></fact-check-pill>.'
		)
	})

	test('splits [1, 2] with whitespace too', () => {
		expect(processUnifiedCitations('X [1, 2].', refs([1, 2]))).toBe(
			'X <fact-check-pill data-ref="1"></fact-check-pill><fact-check-pill data-ref="2"></fact-check-pill>.'
		)
	})

	test('renders adjacent [1][2] as two pills', () => {
		expect(processUnifiedCitations('X [1][2].', refs([1, 2]))).toBe(
			'X <fact-check-pill data-ref="1"></fact-check-pill><fact-check-pill data-ref="2"></fact-check-pill>.'
		)
	})

	test('keeps the valid id and drops the missing one in [1,9]', () => {
		expect(processUnifiedCitations('X [1,9].', refs([1]))).toBe('X <fact-check-pill data-ref="1"></fact-check-pill>.')
	})

	test('strips a marker when no id resolves', () => {
		expect(processUnifiedCitations('X [9].', refs([1]))).toBe('X.')
	})

	test('strips markers when refs are unavailable', () => {
		expect(processUnifiedCitations('X [1] and [2].', undefined)).toBe('X and.')
		expect(processUnifiedCitations('X [1] and [2].')).toBe('X and.')
	})

	test('strips all markers when refs are an explicit empty array', () => {
		expect(processUnifiedCitations('X [1].', [])).toBe('X.')
		expect(processUnifiedCitations(`One [1], two [^2], three ${modelStyleCitation}.`, [])).toBe('One, two, three.')
	})

	test('auto-wraps legacy URL-string citations into web refs by index', () => {
		expect(processUnifiedCitations('See [2].', ['https://a.test', 'https://b.test'])).toBe(
			'See <fact-check-pill data-ref="2"></fact-check-pill>.'
		)
	})

	test('resolves footnote and model-style markers against legacy URL refs', () => {
		expect(
			processUnifiedCitations(`Catalyst[^2] and confirmation ${modelStyleCitation}.`, [
				'https://one.test',
				'https://two.test',
				'https://three.test',
				'https://four.test',
				'https://five.test'
			])
		).toBe(
			'Catalyst<fact-check-pill data-ref="2"></fact-check-pill> and confirmation <fact-check-pill data-ref="5"></fact-check-pill>.'
		)
	})

	test('expands a legacy range [1-2] when refs cover it', () => {
		expect(processUnifiedCitations('R [1-2].', refs([1, 2]))).toBe(
			'R <fact-check-pill data-ref="1"></fact-check-pill><fact-check-pill data-ref="2"></fact-check-pill>.'
		)
	})
})

describe('wrapLegacyUrlCitations', () => {
	test('assigns 1-based ids and web sourceType with hostname label', () => {
		expect(wrapLegacyUrlCitations(['https://www.example.com/path'])).toEqual([
			{ id: 1, sourceType: 'web', label: 'example.com', url: 'https://www.example.com/path' }
		])
	})

	test('marks x.com and twitter.com hosts as the x sourceType', () => {
		const [x, twitter] = wrapLegacyUrlCitations(['https://x.com/a', 'https://twitter.com/b'])
		expect(x.sourceType).toBe('x')
		expect(twitter.sourceType).toBe('x')
	})

	test('falls back to a Web label when the url is unsafe', () => {
		expect(wrapLegacyUrlCitations(['javascript:alert(1)'])).toEqual([
			{ id: 1, sourceType: 'web', label: 'Web', url: undefined }
		])
	})
})

describe('normalizeSourceUrl', () => {
	test('passes through safe https source URLs', () => {
		expect(normalizeSourceUrl('https://example.com/article')).toBe('https://example.com/article')
	})

	test('rewrites internal preview hosts to defillama.com', () => {
		expect(normalizeSourceUrl('https://preview.dl.llama.fi/protocol/aave')).toBe('https://defillama.com/protocol/aave')
	})

	test('drops unsafe protocols so they cannot become a clickable href', () => {
		expect(normalizeSourceUrl('javascript:alert(1)')).toBeNull()
		expect(normalizeSourceUrl('data:text/html,<script>alert(1)</script>')).toBeNull()
	})

	test('drops URLs with embedded credentials', () => {
		expect(normalizeSourceUrl('https://user:pass@evil.com')).toBeNull()
	})
})

describe('prepareAlertSummaryMarkdown', () => {
	const charts = [{ id: 'c1', url: 'https://charts.llama.fi/c1.png', title: 'BTC [60D] (daily)' }]

	test('replaces chart placeholders with markdown images on their own block', () => {
		expect(prepareAlertSummaryMarkdown('before [CHART:c1] after', charts)).toBe(
			'before \n\n![BTC 60D daily](https://charts.llama.fi/c1.png)\n\n after'
		)
	})

	test('drops placeholders for unknown or unsafe chart urls', () => {
		expect(prepareAlertSummaryMarkdown('[CHART:missing]', charts)).toBe('')
		expect(prepareAlertSummaryMarkdown('[CHART:bad]', [{ id: 'bad', url: 'javascript:alert(1)', title: 'x' }])).toBe('')
	})

	test('converts slack-style single-asterisk emphasis to markdown bold', () => {
		expect(prepareAlertSummaryMarkdown('*Price & Range* is up (↑ *14.16%* from start)', [])).toBe(
			'**Price & Range** is up (↑ **14.16%** from start)'
		)
	})

	test('leaves existing double-asterisk bold and multiplication untouched', () => {
		expect(prepareAlertSummaryMarkdown('**bold** stays, 5 * 3 stays, 5*3 stays', [])).toBe(
			'**bold** stays, 5 * 3 stays, 5*3 stays'
		)
	})

	test('turns inline bullet separators into list items', () => {
		expect(prepareAlertSummaryMarkdown('*Current:* $75,710 • *High:* $82,752 • *Low:* $65,033', [])).toBe(
			'**Current:** $75,710\n- **High:** $82,752\n- **Low:** $65,033'
		)
	})

	test('normalizes leading bullet characters to markdown list markers', () => {
		expect(prepareAlertSummaryMarkdown('• first\n• second', [])).toBe('- first\n- second')
	})
})
