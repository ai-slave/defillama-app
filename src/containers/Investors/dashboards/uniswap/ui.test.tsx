// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { createStackTooltipFormatter, KpiGrid } from './ui'

const NOTE = 'Distinct wallets with a trade of $100 or more.'
const DEF = 'Definition from ir-server metadata.'

describe('uniswap KPI definition tooltip', () => {
	let container: HTMLDivElement
	let root: Root

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
	})

	test('falls back to the KPI payload note when no definition is passed', async () => {
		await act(async () =>
			root.render(
				<KpiGrid kpis={{ wallets: { value: 1, formatted: '26M', note: NOTE } }} items={[['wallets', 'Wallets']]} />
			)
		)

		expect(container.querySelector('[aria-label]')?.getAttribute('aria-label')).toBe(NOTE)
	})

	test('prefers an explicit definition over the payload note', async () => {
		await act(async () =>
			root.render(
				<KpiGrid kpis={{ wallets: { value: 1, formatted: '26M', note: NOTE } }} items={[['wallets', 'Wallets', DEF]]} />
			)
		)

		expect(container.querySelector('[aria-label]')?.getAttribute('aria-label')).toBe(DEF)
	})
})

describe('uniswap stack tooltip', () => {
	const item = (name: string, value: number) => ({
		seriesName: name,
		marker: '',
		data: { timestamp: 0, [name]: value }
	})

	test('keeps Others in the list, folds the tail into it and puts Total under the divider', () => {
		const html = createStackTooltipFormatter({ groupBy: 'daily', valueSymbol: '$', maxItems: 3, showTotal: true })([
			item('Others', 5),
			item('A', 40),
			item('B', 30),
			item('C', 20)
		])
		const rows = [...html.matchAll(/<li style="([^"]*)">([^&]*)&nbsp;&nbsp;([^<]*)<\/li>/g)].map((m) => [
			m[2],
			m[3],
			m[1].includes('border-top')
		])
		expect(rows).toEqual([
			['A', '$40', false],
			['B', '$30', false],
			['Others', '$25', false],
			['Total', '$95', true]
		])
	})

	test('omits Total for overlaid series', () => {
		const html = createStackTooltipFormatter({ groupBy: 'daily', valueSymbol: '$', maxItems: 20, showTotal: false })([
			item('A', 1),
			item('B', 2)
		])
		expect(html).not.toContain('Total')
	})
})
