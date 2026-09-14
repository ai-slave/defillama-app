// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { DemoPreview } from './DemoPreview'

vi.mock('next/router', () => ({ useRouter: () => ({ asPath: '/pro/preview', query: {} }) }))
vi.mock('next/link', () => ({
	default: ({
		children,
		href,
		prefetch: _prefetch,
		...props
	}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { prefetch?: boolean }) => (
		<a href={href} {...props}>
			{children}
		</a>
	)
}))
vi.mock('~/components/ECharts/MultiSeriesChart', () => ({ default: () => <div data-demo-chart /> }))
vi.mock('./UnifiedTable', () => ({ default: () => <div data-demo-table /> }))
vi.mock('./TextCard', () => ({ TextCard: () => null }))

describe('DemoPreview', () => {
	let container: HTMLDivElement
	let root: Root

	beforeEach(async () => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
		await act(async () => root.render(<DemoPreview />))
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
	})

	test('leads with the build-your-own headline instead of the old preview title', () => {
		expect(container.querySelector('h1')?.textContent).toBe('Build your own DeFi dashboard')
		expect(container.textContent).not.toContain('Pro Dashboard Preview')
	})

	test('labels sample charts and the live table separately instead of one simulated-data disclaimer', () => {
		const text = container.textContent ?? ''
		expect(text).not.toContain('All data shown below is simulated')
		expect(text).toContain('Sample charts use illustrative data')
		expect(text).toContain('Live data from DefiLlama')

		const captions = Array.from(container.querySelectorAll('p'))
		const chartsCaption = captions.find((node) => node.textContent?.trim() === 'Sample charts use illustrative data')!
		const liveCaption = captions.find((node) => node.textContent?.trim() === 'Live data from DefiLlama')!
		const table = container.querySelector('[data-demo-table]')!
		const firstChart = container.querySelector('[data-demo-chart]')!
		expect(chartsCaption.compareDocumentPosition(firstChart) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
		expect(liveCaption.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
		expect(firstChart.compareDocumentPosition(liveCaption) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
	})

	test('offers account creation and community dashboards from the sticky strip', () => {
		const links = Array.from(container.querySelectorAll('a'))
		const createAccount = links.find((link) => link.textContent?.trim() === 'Create a free account')
		const discover = links.find((link) => link.textContent?.trim() === 'See community dashboards')
		expect(createAccount?.getAttribute('href')).toBe('/subscription?returnUrl=%2Fpro%2Fpreview')
		expect(discover?.getAttribute('href')).toBe('/pro?tab=discover')
		expect(createAccount?.closest('.sticky')).not.toBeNull()
		expect(discover?.closest('.sticky')).toBe(createAccount?.closest('.sticky'))
	})
})
