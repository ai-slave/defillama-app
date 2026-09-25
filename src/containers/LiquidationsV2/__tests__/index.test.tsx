import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test, vi } from 'vitest'
import { AuthProvider } from '~/auth'
import { LiquidationsOverview } from '../index'

vi.mock('next/router', () => ({
	useRouter: () => ({ query: {}, pathname: '/liquidations', asPath: '/liquidations', push() {} })
}))
test('shows the snapshot population and collateral total', () => {
	const client = new QueryClient()
	const html = renderToStaticMarkup(
		<QueryClientProvider client={client}>
			<AuthProvider>
				<LiquidationsOverview
					protocolLinks={[{ label: 'Overview', to: '/liquidations' }]}
					timestamp={100}
					protocolCount={12}
					chainCount={23}
					positionCount={34}
					totalCollateralUsd={5_000_000}
					distributionChart={{ tokens: [] }}
					protocolRows={[]}
					chainRows={[]}
				/>
			</AuthProvider>
		</QueryClientProvider>
	)
	const text = html.replace(/<[^>]*>/g, '')
	for (const metric of ['Protocols12', 'Chains23', 'Positions34', 'Collateral USD$5m']) expect(text).toContain(metric)
	client.clear()
})
