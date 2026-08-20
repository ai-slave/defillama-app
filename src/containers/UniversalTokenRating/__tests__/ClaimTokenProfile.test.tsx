import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ClaimTokenProfile } from '../ClaimTokenProfile'

const projects = [
	{
		arcticId: 'ee2e1b0a-6618-4e8e-8096-28f6fc959929',
		projectName: 'Ethereum',
		symbol: 'ETH',
		tgeStatus: 'post' as const,
		disclosureScore: 8.72,
		gradedCount: 13,
		criteriaCount: 13
	},
	{
		arcticId: 'project-pre',
		projectName: 'Upcoming',
		symbol: 'UP',
		tgeStatus: 'pre' as const,
		disclosureScore: null,
		gradedCount: 0,
		criteriaCount: 13
	}
]

describe('ClaimTokenProfile', () => {
	it('renders live project options and disclosure coverage', () => {
		const html = renderToStaticMarkup(<ClaimTokenProfile projects={projects} exchangeOptions={['Binance', 'Kraken']} />)

		expect(html).toContain('Ethereum (ETH)')
		expect(html).toContain('Upcoming (UP)')
		expect(html).toContain('Binance')
		expect(html).toContain('Kraken')
		expect(html).toContain('13/13 criteria scored')
		expect(html).toContain('Disclosure 8.72/10')
		expect(html).toContain('NO DATA YET')
		expect(html).not.toContain('Fableborne (FAB)')
		expect(html).not.toContain('Alice Adams')
		expect(html).not.toContain('Selini')
	})

	it('renders an unavailable state without falling back to mock tokens', () => {
		const html = renderToStaticMarkup(<ClaimTokenProfile projects={[]} />)

		expect(html).toContain('Token list unavailable')
		expect(html).not.toContain('Abeezee (ABC)')
	})
})
