import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../Drawer', () => ({ Drawer: ({ children }: { children: ReactNode }) => <div>{children}</div> }))
vi.mock('~/components/Link', () => ({
	BasicLink: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>
}))

import { DocsDrawer } from '../DocsDrawer'

describe('DocsDrawer', () => {
	it('renders the four table-of-contents labels and matching section anchors', () => {
		const html = renderToStaticMarkup(<DocsDrawer open onClose={() => {}} />)

		expect(html).toContain('1. Overview')
		expect(html).toContain('2. Calculation Methodology')
		expect(html).toContain('3. How to Interpret')
		expect(html).toContain('4. Filtering')

		expect(html).toContain('id="overview"')
		expect(html).toContain('id="calculation-methodology"')
		expect(html).toContain('id="how-to-interpret"')
		expect(html).toContain('id="filtering"')
	})
})
