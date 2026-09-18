// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { TierComparisonTable } from '../TierComparisonPopover'
import { cardTierRow } from './fixtures'

describe('TierComparisonTable', () => {
	let container: HTMLDivElement
	let root: Root

	beforeEach(() => {
		container = document.createElement('div')
		document.body.append(container)
		root = createRoot(container)
	})

	afterEach(() => {
		act(() => root.unmount())
		container.remove()
	})

	test('keeps repeated tier names distinct with region context', () => {
		act(() => {
			root.render(
				<TierComparisonTable
					cardName="Plasma One"
					field="cashbackRate"
					tiers={[
						cardTierRow('plasma-one', {
							tierId: 'plasma-one--lite--international',
							tierName: 'Lite',
							region: 'International',
							cashbackRate: '2% first $500/month; 0.1% thereafter'
						}),
						cardTierRow('plasma-one', {
							tierId: 'plasma-one--lite--united-states',
							tierName: 'Lite',
							region: 'United States',
							cashbackRate: '1%'
						})
					]}
				/>
			)
		})

		expect(container.querySelector('caption')?.textContent).toBe('Cashback by tier and region for Plasma One')
		expect([...container.querySelectorAll('thead th')].map((cell) => cell.textContent)).toEqual([
			'Tier',
			'Region',
			'Cashback'
		])
		expect([...container.querySelectorAll('tbody th[scope="row"]')].map((cell) => cell.textContent)).toEqual([
			'Lite',
			'Lite'
		])
		expect([...container.querySelectorAll('tbody tr')].map((row) => row.textContent)).toEqual([
			'LiteInternational2% first $500/month; 0.1% thereafter',
			'LiteUnited States1%'
		])
	})

	test('shows boolean disagreement and undisclosed values explicitly', () => {
		act(() => {
			root.render(
				<TierComparisonTable
					cardName="Example Card"
					field="applePay"
					tiers={[
						cardTierRow('example', { tierId: 'example--yes', applePay: true }),
						cardTierRow('example', { tierId: 'example--no', applePay: false }),
						cardTierRow('example', { tierId: 'example--unknown', applePay: null })
					]}
				/>
			)
		})

		expect([...container.querySelectorAll('tbody td:last-child')].map((cell) => cell.textContent)).toEqual([
			'Yes',
			'No',
			'Not disclosed'
		])
		expect(container.querySelectorAll('tbody td:last-child svg')).toHaveLength(2)
	})
})
