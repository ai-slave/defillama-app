import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, test, vi } from 'vitest'

let authState = {
	hasActiveSubscription: false,
	isAuthenticated: false,
	loaders: { userLoading: false }
}

vi.mock('next/router', () => ({
	useRouter: () => ({ asPath: '/liquidations/sky/arbitrum-one' })
}))

vi.mock('@ariakit/react', () => ({
	useDialogStore: () => ({ show: vi.fn() })
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

vi.mock('~/components/RowLinksWithDropdown', () => ({
	RowLinksWithDropdown: ({ activeLink, links }: { activeLink?: string; links: Array<{ label: string }> }) => (
		<div>
			<div>{activeLink}</div>
			<div>{links.map((link) => link.label).join(', ')}</div>
		</div>
	)
}))

vi.mock('~/auth', () => ({
	useAuthContext: () => authState
}))

vi.mock('~/containers/Subscription/SignInModal', () => ({
	SignInModal: () => <div>sign-in-modal</div>
}))

import { LiquidationsAccessGate, LiquidationsShellLoader } from '../AccessGate'

afterEach(() => {
	authState = {
		hasActiveSubscription: false,
		isAuthenticated: false,
		loaders: { userLoading: false }
	}
	vi.clearAllMocks()
})

describe('LiquidationsAccessGate', () => {
	test('shows the public protocol shell and sign-in CTA for unauthenticated users', () => {
		const html = renderToStaticMarkup(
			<LiquidationsAccessGate
				protocolLinks={[
					{ label: 'Overview', to: '/liquidations' },
					{ label: 'Sky', to: '/liquidations/sky' }
				]}
				activeProtocolLink="Sky"
				chainLinks={[
					{ label: 'All Chains', to: '/liquidations/sky' },
					{ label: 'Base', to: '/liquidations/sky/base' },
					{ label: 'Arbitrum One', to: '/liquidations/sky/arbitrum-one' }
				]}
				activeChainLink="All Chains"
			/>
		)

		expect(html).toContain('Sky')
		expect(html).toContain('Arbitrum One')
		expect(html).toContain('active subscription')
		expect(html).toContain('sign-in-modal')
	})

	test('hides the chain row when there is only all chains plus one chain', () => {
		const html = renderToStaticMarkup(
			<LiquidationsAccessGate
				protocolLinks={[
					{ label: 'Overview', to: '/liquidations' },
					{ label: 'Sky', to: '/liquidations/sky' }
				]}
				activeProtocolLink="Sky"
				chainLinks={[
					{ label: 'All Chains', to: '/liquidations/sky' },
					{ label: 'Tron', to: '/liquidations/sky/tron' }
				]}
				activeChainLink="All Chains"
			/>
		)

		expect(html).toContain('Sky')
		expect(html).not.toContain('Tron')
	})

	test('shows the subscribe link for authenticated users without a subscription', () => {
		authState = {
			hasActiveSubscription: false,
			isAuthenticated: true,
			loaders: { userLoading: false }
		}

		const html = renderToStaticMarkup(
			<LiquidationsAccessGate
				protocolLinks={[{ label: 'Sky', to: '/liquidations/sky' }]}
				activeProtocolLink="Sky"
				chainLinks={[{ label: 'Arbitrum One', to: '/liquidations/sky/arbitrum-one' }]}
				activeChainLink="Arbitrum One"
			/>
		)

		expect(html).toContain('/subscription?returnUrl=%2Fliquidations%2Fsky%2Farbitrum-one')
	})
})

describe('LiquidationsShellLoader', () => {
	test('shows the loader while preserving the shell chrome', () => {
		const html = renderToStaticMarkup(
			<LiquidationsShellLoader
				protocolLinks={[{ label: 'Overview', to: '/liquidations' }]}
				activeProtocolLink="Overview"
			/>
		)

		expect(html).toContain('Overview')
		expect(html).toContain('Loading')
	})
})
