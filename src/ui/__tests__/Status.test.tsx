import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { PanelLoadingStatus, SurfaceBodyLoadingStatus } from '../Status'

describe('loading statuses', () => {
	test('renders the contextual label with the default indicator', () => {
		const panel = renderToStaticMarkup(<PanelLoadingStatus label="Loading borrow markets" />)
		const surface = renderToStaticMarkup(<SurfaceBodyLoadingStatus label="Loading saved pools" />)

		expect(panel).toContain('Loading borrow markets')
		expect(surface).toContain('Loading saved pools')
	})

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
