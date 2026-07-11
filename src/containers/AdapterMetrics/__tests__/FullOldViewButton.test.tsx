import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { FullOldViewButton } from '../FullOldViewButton'

vi.mock('~/containers/ProDashboard/hooks/useDashboardCreation', () => ({
	useDashboardCreation: () => ({ createDashboardWithDataset: vi.fn(), isLoading: false })
}))

vi.mock('~/containers/Subscription/auth', () => ({
	useAuthContext: () => ({ loaders: { userLoading: false }, isAuthenticated: true, hasActiveSubscription: true })
}))

vi.mock('~/containers/Subscription/signupSource', () => ({ setSignupSource: vi.fn() }))
vi.mock('~/hooks/useIsClient', () => ({ useIsClient: () => true }))

describe('FullOldViewButton', () => {
	it('renders dashboard action and feature help as separate buttons', () => {
		const html = renderToStaticMarkup(<FullOldViewButton />)

		expect(html).toMatch(/<button[^>]*>.*Open in Dashboard.*<\/button>/)
		expect(html).toContain('aria-label="What Full View includes"')
	})
})
