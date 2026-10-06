// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { ProtocolTokenUsageData } from '~/containers/TokenUsage/api.types'
import { DashboardTestProvider } from '~/utils/testing/dashboardContext'
import { installDownloadSink } from '~/utils/testing/downloadSink'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import type { TokenUsageDatasetTableConfig } from '../../../../types'

vi.mock('next/router', () => ({ useRouter: () => ({ pathname: '/pro/test', query: {} }) }))
const http = installSubscriberSession('u1', { resolved: true })
const downloads = installDownloadSink()
vi.mock('../../../Table/TablePagination', () => ({ TablePagination: () => null }))

import { TokenUsageDataset } from '../index'

const USAGE_PATH = '/api/public/pro-dashboard/dashboard-token-usage'
const config: TokenUsageDatasetTableConfig = {
	id: 'token-usage',
	kind: 'dataset-table',
	datasetType: 'token-usage',
	tokenSymbols: ['usdc'],
	includeCex: false
}
const rows: Array<ProtocolTokenUsageData> = [
	{ name: 'Excluded', category: 'Other', amountUsd: 1000, tokens: { usdc: 1000 } },
	...Array.from({ length: 12 }, (_, index) => {
		const amountUsd = index + 1
		return {
			name: `Keep, ${amountUsd}`,
			category: 'Category "Quoted"',
			amountUsd,
			tokens: { usdc: amountUsd }
		}
	})
]

describe('TokenUsageDataset CSV export', () => {
	let container: HTMLDivElement
	let root: Root

	beforeEach(() => {
		Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})

	async function render() {
		await act(async () =>
			root.render(
				<http.Wrapper>
					<DashboardTestProvider mode="view" dashboard={{ dashboardId: 'dash-1' }}>
						<TokenUsageDataset editable={false} config={config} />
					</DashboardTestProvider>
				</http.Wrapper>
			)
		)
	}

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
	})

	test('announces the loading state without flashing zero totals', async () => {
		const pending = Promise.withResolvers<Response>()
		http.serve({ [USAGE_PATH]: () => pending.promise })
		await render()

		expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
		expect(container.textContent).not.toMatch(/\d/)
		await act(async () => pending.resolve(Response.json([])))
	})

	test('exports every filtered row in sorted order before pagination', async () => {
		http.serve({ [USAGE_PATH]: rows })
		await render()

		await waitForUi(() => expect(container.querySelectorAll('tbody tr').length).toBeGreaterThan(0))
		const search = container.querySelector<HTMLInputElement>('input[placeholder="Search protocols..."]')
		if (!search) throw new Error('Expected protocol search input')
		search.value = 'Keep'
		await act(async () => search.dispatchEvent(new InputEvent('input', { bubbles: true })))

		expect(container.querySelectorAll('tbody tr')).toHaveLength(10)
		const csvButton = [...container.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
			button.textContent?.includes('.csv')
		)
		if (!csvButton) throw new Error('Expected CSV button')
		await act(async () => csvButton.click())

		const expected = ['Protocol,Category,Total Amount (USD)']
		for (let amountUsd = 12; amountUsd >= 1; amountUsd -= 1) {
			expected.push(`"Keep, ${amountUsd}","Category ""Quoted""",${amountUsd}`)
		}
		expect(downloads.map((download) => download.filename)).toEqual(['token-usage-USDC.csv'])
		expect(await downloads[0]!.blob.text()).toBe(expected.join('\n'))
	})

	test('an empty editable card searches tokens on the server and adds the picked one', async () => {
		http.serve({
			'/api/dynamic/pro-dashboard/tokens/search': [
				{ value: 'usdc', label: 'USD Coin (USDC)', logo: null, id: 'usd-coin', price: 1 }
			]
		})
		const onConfigChange = vi.fn()
		await act(async () =>
			root.render(
				<http.Wrapper>
					<DashboardTestProvider mode="edit" dashboard={{ dashboardId: 'dash-1' }}>
						<TokenUsageDataset editable config={{ ...config, tokenSymbols: [] }} onConfigChange={onConfigChange} />
					</DashboardTestProvider>
				</http.Wrapper>
			)
		)
		const search = container.querySelector<HTMLInputElement>('input[aria-label="Tokens"]')!
		await act(async () => {
			search.focus()
			Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(search, 'usd')
			search.dispatchEvent(new Event('input', { bubbles: true }))
		})
		const option = await waitForUi(() => {
			const match = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(
				(row) => row.textContent === 'USD Coin (USDC)'
			)
			expect(match).toBeDefined()
			return match!
		})
		await act(async () => option.click())

		expect(http.requests.map((request) => request.url.searchParams.get('query'))).toContain('usd')
		expect(onConfigChange.mock.calls).toEqual([[{ ...config, tokenSymbols: ['usdc'] }]])
	})
})
