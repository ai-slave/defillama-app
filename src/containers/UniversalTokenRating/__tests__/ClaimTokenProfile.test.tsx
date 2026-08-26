import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
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

function renderClaim(props: Parameters<typeof ClaimTokenProfile>[0]) {
	const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
	return renderToStaticMarkup(
		<QueryClientProvider client={queryClient}>
			<ClaimTokenProfile {...props} />
		</QueryClientProvider>
	)
}

describe('ClaimTokenProfile', () => {
	it('renders live project options and disclosure coverage', () => {
		const html = renderClaim({ projects, exchangeOptions: ['Binance', 'Kraken'] })

		expect(html).toContain('Ethereum (ETH)')
		expect(html).toContain('Upcoming (UP)')
		expect(html).toContain('13/13 criteria scored')
		expect(html).toContain('Disclosure 8.72/10')
		expect(html).toContain('Submit Claim Request')
		expect(html).toContain('Do you have direct contact with a Forgd team member?')
		expect(html).not.toContain('Attach Documents')
		expect(html).not.toContain('Disclosures Details')
		expect(html).not.toContain('NO DATA YET')
		expect(html).not.toContain('Fableborne (FAB)')
		expect(html).not.toContain('Alice Adams')
		expect(html).not.toContain('Selini')
	})

	it('renders an unavailable state without falling back to mock tokens', () => {
		const html = renderClaim({ projects: [] })

		expect(html).toContain('Token list unavailable')
		expect(html).not.toContain('Abeezee (ABC)')
	})

	it('uses application language for the join variant', () => {
		const html = renderClaim({ variant: 'join' })

		expect(html).toContain('Apply for the Universal Token Rating')
		expect(html).not.toContain('Join the Universal Token Rating')
	})
})
