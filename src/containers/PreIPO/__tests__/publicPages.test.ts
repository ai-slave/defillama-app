import { describe, expect, it } from 'vitest'
import pages from '~/public/pages.json'

describe('pre-IPO public navigation', () => {
	it('publishes the dashboard in the catalog and main sidebar with a New tag', () => {
		const metric = pages.Metrics.find((page) => page.route === '/pre-ipo')
		const sidebar = pages.Main.find((page) => page.route === '/pre-ipo')

		expect(metric).toMatchObject({ name: 'Pre-IPO', category: 'Equities, ETFs & DATs', isNew: true })
		expect(sidebar).toMatchObject({ name: 'Pre-IPO', icon: 'briefcase-business', isNew: true })
	})
})
