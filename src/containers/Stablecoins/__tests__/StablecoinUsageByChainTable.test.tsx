// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { groupBridgeData } from '../hooks'
import { StablecoinByChainUsageTable } from '../StablecoinUsageByChainTable'

vi.mock('next/router', () => ({
	useRouter: () => ({ query: {}, pathname: '/stablecoin/usdt', asPath: '/stablecoin/usdt', push: vi.fn() })
}))

const baseChain = {
	symbol: 'USD',
	circulating: 100,
	unreleased: 0,
	change_1d: null,
	change_7d: null,
	change_1m: null,
	circulatingPrevDay: null,
	circulatingPrevWeek: null,
	circulatingPrevMonth: null
}

describe('StablecoinByChainUsageTable', () => {
	let container: HTMLDivElement
	let root: Root

	beforeEach(() => {
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
	})

	test('sorts bridged percentages numerically in both directions with unknown values last', async () => {
		const data = groupBridgeData(
			[100, null, 9.1234, 0, 50].map((bridgedAmount, index) => ({
				...baseChain,
				name: `chain-${index}`,
				bridgedAmount,
				bridges: index === 0 ? { bridge: [{ amount: 100, sourceChain: 'ethereum' }] } : {}
			})),
			{ bridge: { name: 'Bridge' } }
		)
		await act(async () => root.render(<StablecoinByChainUsageTable data={data} />))

		const headers = () => [...container.querySelectorAll('thead th')]
		const bridgedHeader = () => headers().find((header) => header.textContent?.includes('Bridged %'))!
		const bridgedCells = () => {
			const column = headers().indexOf(bridgedHeader())
			return [...container.querySelectorAll('tbody tr:not([aria-hidden="true"])')].map(
				(row) => row.querySelectorAll('td')[column]?.textContent
			)
		}

		await act(async () => bridgedHeader().querySelector('button')!.click())
		expect(bridgedCells()).toEqual(['100%', '50.00%', '9.12%', '0.00%', ''])
		await act(async () => bridgedHeader().querySelector('button')!.click())
		expect(bridgedCells()).toEqual(['0.00%', '9.12%', '50.00%', '100%', ''])
	})
})
