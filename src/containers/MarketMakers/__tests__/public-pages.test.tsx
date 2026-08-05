import type { ComponentType, ReactNode } from 'react'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import defillamaPages from '~/public/pages.json'

vi.mock('~/layout', () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock('~/containers/MarketMakers/PerformanceIndex', () => ({
	PerformanceIndex: () => <div>Performance Index</div>
}))
vi.mock('~/containers/MarketMakers/Documentation', () => ({
	MarketMakersDocumentation: () => <div>Documentation</div>
}))
vi.mock('~/containers/MarketMakers/Leaderboard', () => ({
	Leaderboard: ({ title }: { title: string }) => <div>{title}</div>
}))

import DepthLeaderboard from '~/pages/market-makers/depth'
import MarketMakersDocumentationPage from '~/pages/market-makers/documentation'
import MarketMakersPerformanceIndex from '~/pages/market-makers/index'
import KpiLeaderboard from '~/pages/market-makers/kpi'
import SpreadLeaderboard from '~/pages/market-makers/spread'
import VolumeLeaderboard from '~/pages/market-makers/volume'

function renderPage(Page: unknown, props: Record<string, unknown> = {}) {
	return renderToStaticMarkup(createElement(Page as ComponentType<Record<string, unknown>>, props))
}

describe('public Market Makers pages', () => {
	it('renders every route without an auth or preview access gate', () => {
		expect(renderPage(MarketMakersPerformanceIndex)).toContain('Performance Index')
		expect(renderPage(MarketMakersDocumentationPage)).toContain('Documentation')
		expect(renderPage(DepthLeaderboard)).toContain('Depth Leaderboard')
		expect(renderPage(VolumeLeaderboard)).toContain('Volume Leaderboard')
		expect(renderPage(SpreadLeaderboard)).toContain('Spread Leaderboard')
		expect(renderPage(KpiLeaderboard)).toContain('KPI Adherence Leaderboard')
	})

	it('shows Market Makers in navigation without a user flag requirement', () => {
		const entry = Object.values(defillamaPages)
			.flat()
			.find((page) => page.route === '/market-makers') as Record<string, unknown> | undefined

		expect(entry).toBeDefined()
		expect(entry).not.toHaveProperty('requireForgdPreview')
		expect(entry).not.toHaveProperty('requireLlama')
	})
})
