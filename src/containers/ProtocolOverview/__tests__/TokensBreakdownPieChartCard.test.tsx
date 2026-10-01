// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { IPieChartProps } from '~/components/ECharts/PieChart/types'
import { installDownloadSink } from '~/utils/testing/downloadSink'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import { TokensBreakdownPieChartCard } from '../BreakdownCards'

const pie = vi.hoisted(() => ({
	// Suspends the pie's render of matching slices, holding the deferred chart on the slices already on screen.
	holdWhen: (_chartData: IPieChartProps['chartData']): boolean => false,
	pending: new Promise<never>(() => {})
}))

vi.mock('next/router', () => ({ useRouter: () => ({ query: {}, pathname: '/protocol/tvl/aave', push: vi.fn() }) }))
// ECharts cannot draw in happy-dom; the stub only suspends, and nothing asserts what it draws.
vi.mock('~/components/ECharts/PieChart', () => ({
	default: ({ chartData }: IPieChartProps) => {
		if (pie.holdWhen(chartData)) throw pie.pending
		return null
	}
}))

const { Wrapper } = installSubscriberSession('subscriber', { resolved: true })
const downloads = installDownloadSink()
let container: HTMLDivElement
let root: Root

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	pie.holdWhen = () => false
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

async function renderCard(limit: number) {
	await act(async () =>
		root.render(
			<Wrapper>
				<TokensBreakdownPieChartCard
					title="Tokens Breakdown"
					tokenBreakdownPieSeries={{
						peers: [
							{ name: 'USDC', value: 60 },
							{ name: 'WETH', value: 30 },
							{ name: 'DAI', value: 10 }
						],
						limit,
						upstreamOthersValue: 0
					}}
					exportFilenameBase="aave-tokens"
					exportTitle="Aave Tokens"
					exportIconUrl={undefined}
				/>
			</Wrapper>
		)
	)
}

function csvButton() {
	return [...container.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
		button.textContent?.includes('.csv')
	)!
}

async function click(element: HTMLElement) {
	await act(async () => {
		element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }))
		element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, button: 0 }))
		element.click()
		await Promise.resolve()
	})
}

async function toggleToken(name: string) {
	await click(document.querySelector<HTMLButtonElement>('button[role="combobox"]')!)
	const option = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find((element) =>
		element.textContent?.includes(name)
	)!
	await click(option)
	await act(async () =>
		document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
	)
}

async function exportCsv() {
	const button = csvButton()
	await waitForUi(() => expect(button.disabled).toBe(false))
	await act(async () => button.click())
	await waitForUi(() => expect(downloads).toHaveLength(1))
	return downloads[0]!.blob.text()
}

test('exports the slices the pie still draws while a new token selection renders', async () => {
	await renderCard(10)
	pie.holdWhen = (chartData) => chartData.some((slice) => slice.name === 'Others')

	await toggleToken('DAI')

	expect(await exportCsv()).toBe('Name,Value\nUSDC,60\nWETH,30\nDAI,10')
})

test('exports every picked token, beyond the pie fold, once the selection renders', async () => {
	await renderCard(1)

	await toggleToken('DAI')

	expect(await exportCsv()).toBe('Name,Value\nUSDC,60\nWETH,30\nOthers,10')
})

test('exports the table rows with their shares in the table view', async () => {
	await renderCard(10)

	await toggleToken('DAI')
	await click(container.querySelector<HTMLElement>('input[type="radio"][value="table"]')!)

	expect(await exportCsv()).toBe('Token,Value,% of TVL\nUSDC,60,60\nWETH,30,30\nOthers,10,10')
})
