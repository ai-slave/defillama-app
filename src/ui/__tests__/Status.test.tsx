import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { PanelLoadingStatus } from '../Status'

describe('loading statuses', () => {
	test('keeps the contextual label available to assistive technology with custom content', () => {
		const html = renderToStaticMarkup(
			<PanelLoadingStatus label="Loading routes">
				<span>Custom spinner</span>
			</PanelLoadingStatus>
		)

		expect(html).toContain('Custom spinner')
		expect(html).toContain('role="status"')
		expect(html).toContain('aria-label="Loading routes"')
	})
})
