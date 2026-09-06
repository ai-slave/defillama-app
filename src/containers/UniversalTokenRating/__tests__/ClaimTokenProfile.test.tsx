import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { ClaimTokenProfile } from '../ClaimTokenProfile'
import { resolveRequestedProjectId } from '../navigation'

const projects = [
	{
		arcticId: 'ee2e1b0a-6618-4e8e-8096-28f6fc959929',
		projectName: 'Ethereum',
		symbol: 'ETH',
		coingeckoId: 'ethereum',
		tgeStatus: 'post' as const,
		disclosureScore: 8.72,
		gradedCount: 13,
		criteriaCount: 13
	},
	{
		arcticId: 'project-pre',
		projectName: 'Upcoming',
		symbol: 'UP',
		coingeckoId: null,
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
	test('resolves claim links by Arctic id, CoinGecko id, name, or ticker', () => {
		expect(resolveRequestedProjectId(projects, 'ethereum')).toBe(projects[0].arcticId)
		expect(resolveRequestedProjectId(projects, 'ETH')).toBe(projects[0].arcticId)
		expect(resolveRequestedProjectId(projects, 'project-pre')).toBe('project-pre')
		expect(resolveRequestedProjectId(projects, 'missing')).toBeNull()
	})

	test('renders live project options and disclosure coverage', () => {
		const html = renderClaim({
			projects,
			exchangeOptions: [
				{ id: 'binance', displayName: 'Binance' },
				{ id: 'kraken', displayName: 'Kraken' }
			],
			marketMakerOptions: [{ marketMakerId: 'keyrock', marketMakerName: 'Keyrock' }]
		})

		expect(html).toContain('Ethereum (ETH)')
		expect(html).toContain('Upcoming (UP)')
		expect(html).toContain('13/13 criteria scored')
		expect(html).toContain('Disclosure 8.72/10')
		expect(html).toContain('Submit Disclosure Details')
		expect(html).toContain('Attach Documents')
		expect(html).toContain('Disclosures Details')
		expect(html).toContain('Distribution &amp; Vesting Schedule')
		expect(html).toContain('Market Maker Engagements')
		expect(html).toContain('Add More')
		expect(html).not.toContain('<table')
		expect(html).not.toContain('Do you have direct contact with a Forgd team member?')
		expect(html).not.toContain('NO DATA YET')
		expect(html).not.toContain('Fableborne (FAB)')
		expect(html).not.toContain('Alice Adams')
		expect(html).not.toContain('Selini')
	})

	test('renders an unavailable state without falling back to mock tokens', () => {
		const html = renderClaim({ projects: [] })

		expect(html).toContain('Token list unavailable')
		expect(html).not.toContain('Abeezee (ABC)')
	})

	test('uses the Forgd reference language for the join variant', () => {
		const html = renderClaim({ variant: 'join' })

		expect(html).toContain('Join the Universal Token Rating profile')
		expect(html).toContain('Token to claim*')
	})
})
