import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, test, vi } from 'vitest'

const { DynamicUnlocksCharts, unlocksChartsCalls } = vi.hoisted(() => {
	const unlocksChartsCalls: Array<{ hideTokenStats?: boolean; protocolName: string }> = []
	function DynamicUnlocksCharts(props: { protocolName: string; hideTokenStats?: boolean }) {
		unlocksChartsCalls.push(props)
		return <div>Unlock charts</div>
	}

	return { DynamicUnlocksCharts, unlocksChartsCalls }
})

let authState = {
	authorizedFetch: vi.fn(),
	hasActiveSubscription: true,
	isAuthenticated: true,
	loaders: { userLoading: false }
}

let queryState: {
	data?: any
	error?: Error | null
	isLoading: boolean
} = {
	data: null,
	error: null,
	isLoading: false
}
vi.mock('next/router', () => ({
	useRouter: () => ({ asPath: '/token/sol' })
}))

vi.mock('@ariakit/react', () => ({
	useDialogStore: () => ({ show: vi.fn() })
}))

vi.mock('~/ui/Icon', () => ({
	Icon: () => <span>icon</span>
}))

vi.mock('next/dynamic', () => ({
	default: (_loader: () => Promise<unknown>, options?: { loading?: (props: any) => React.ReactNode }) => {
		return (props: any) => {
			if ('protocolName' in (props ?? {})) {
				return <DynamicUnlocksCharts {...props} />
			}

			return options?.loading?.(props) ?? null
		}
	}
}))

vi.mock('@tanstack/react-query', () => ({
	useQuery: () => queryState
}))

vi.mock('~/components/Link', () => ({
	BasicLink: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
		<a href={href} className={className}>
			{children}
		</a>
	)
}))

vi.mock('~/ui/Loaders', () => ({
	LocalLoader: () => <div>loader</div>,
	LoadingDots: () => <span>...</span>
}))

vi.mock('~/containers/Subscription/SignInModal', () => ({
	SignInModal: () => <div>sign-in-modal</div>
}))

vi.mock('~/auth', () => ({
	useAuthContext: () => authState
}))

import { TokenUnlocksSection } from '../TokenUnlocksSection'

describe('TokenUnlocksSection', () => {
	afterEach(() => {
		authState = {
			authorizedFetch: vi.fn(),
			hasActiveSubscription: true,
			isAuthenticated: true,
			loaders: { userLoading: false }
		}
		queryState = {
			data: null,
			error: null,
			isLoading: false
		}
		unlocksChartsCalls.length = 0
		vi.clearAllMocks()
	})

	test('renders nothing when the token page has no resolved unlock slug', () => {
		expect(renderToStaticMarkup(<TokenUnlocksSection resolvedUnlocksSlug={null} />)).toBe('')
	})

	test('shows a loader while auth or unlocks data is loading', () => {
		queryState = {
			data: null,
			error: null,
			isLoading: true
		}

		const html = renderToStaticMarkup(<TokenUnlocksSection resolvedUnlocksSlug="solana" />)

		expect(html).toContain('Loading')
		expect(html).toContain('Unlocks')
	})

	test('shows a sign-in gate for unauthenticated users', () => {
		authState = {
			authorizedFetch: vi.fn(),
			hasActiveSubscription: false,
			isAuthenticated: false,
			loaders: { userLoading: false }
		}

		const html = renderToStaticMarkup(<TokenUnlocksSection resolvedUnlocksSlug="solana" />)

		expect(html).toContain('active subscription')
		expect(html).toContain('Unlocks')
	})

	test('shows a subscription link for authenticated users without a subscription', () => {
		authState = {
			authorizedFetch: vi.fn(),
			hasActiveSubscription: false,
			isAuthenticated: true,
			loaders: { userLoading: false }
		}

		const html = renderToStaticMarkup(<TokenUnlocksSection resolvedUnlocksSlug="solana" />)

		expect(html).toContain('/subscription?returnUrl=%2Ftoken%2Fsol')
		expect(html).toContain('active subscription')
		expect(html).toContain('Unlocks')
	})

	test('shows the query error message when the unlock fetch fails', () => {
		queryState = {
			data: null,
			error: new Error('Failed to fetch token unlocks'),
			isLoading: false
		}

		const html = renderToStaticMarkup(<TokenUnlocksSection resolvedUnlocksSlug="solana" />)

		expect(html).toContain('Failed to fetch token unlocks')
		expect(html).toContain('Unlocks')
	})

	test('renders the shared unlock charts for subscribers when data is available', () => {
		queryState = {
			data: { categories: { documented: ['Team'], realtime: [] }, events: [] },
			error: null,
			isLoading: false
		}

		const html = renderToStaticMarkup(<TokenUnlocksSection resolvedUnlocksSlug="solana" />)

		expect(html).toContain('Unlocks')
		expect(unlocksChartsCalls).toMatchObject([{ hideTokenStats: true, protocolName: 'solana' }])
	})
})
