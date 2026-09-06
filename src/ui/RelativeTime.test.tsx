import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { RelativeTime } from './RelativeTime'

describe('RelativeTime', () => {
	test('renders a deterministic absolute fallback with the exact instant during SSR', () => {
		const html = renderToStaticMarkup(
			<RelativeTime value="2026-07-24T16:30:00Z" prefix="Updated" className="freshness" />
		)

		expect(html).toContain('Updated Jul 24, 2026')
		expect(html).toContain('title="Jul 24, 2026, 4:30 PM UTC"')
		expect(html).toContain('class="freshness"')
	})

	test('requires an explicit unit before formatting numeric timestamps', () => {
		expect(renderToStaticMarkup(<RelativeTime value={1_753_371_000_000} />)).toBe('<span>-</span>')
		expect(renderToStaticMarkup(<RelativeTime value={1_753_371_000_000} input="milliseconds" />)).toContain(
			'Jul 24, 2025'
		)
	})
})
