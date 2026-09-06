import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'

vi.mock('next/router', () => ({ useRouter: () => ({ asPath: '/market-makers', push: () => {} }) }))

import { MarketMakersTabs } from '../MarketMakersTabs'

describe('MarketMakersTabs', () => {
	test('renders all six section links inline (no Others dropdown) with the active one marked', () => {
		const html = renderToStaticMarkup(<MarketMakersTabs active="Volume" />)
		expect(html).toContain('Performance Index')
		expect(html).toContain('KPI Adherence')
		expect(html).toContain('href="/market-makers/depth"')
		expect(html).toContain('data-active="true"')
		expect(html).not.toContain('Others')
	})
})
