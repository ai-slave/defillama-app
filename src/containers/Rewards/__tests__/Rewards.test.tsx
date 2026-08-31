import type { ParsedUrlQuery } from 'querystring'
// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Rewards from '..'
import { program } from './fixtures'

const router = vi.hoisted(() => {
	const query: ParsedUrlQuery = {}
	return { query, pathname: '/rewards', asPath: '/rewards', push: vi.fn() }
})
vi.mock('next/router', () => ({ useRouter: () => router }))

describe('Rewards dashboard', () => {
	let container: HTMLDivElement
	let root: Root
	beforeEach(() => {
		router.query = {}
		router.push.mockClear()
		router.push.mockResolvedValue(true)
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})
	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
	})
	function element<T extends Element>(selector: string): T {
		const result = container.querySelector<T>(selector)
		if (!result) throw new Error(`Missing element: ${selector}`)
		return result
	}
	async function choose(group: string, label: string) {
		const buttons = container.querySelectorAll<HTMLButtonElement>(`[aria-label="${group}"] button`)
		const button = [...buttons].find((item) => item.textContent?.startsWith(label))
		if (!button) throw new Error(`Missing ${group} choice: ${label}`)
		await act(async () => button.click())
	}
	const tableRows = () => [...container.querySelectorAll('tbody tr')]

	it('sorts headers locally, ignores sort URLs, and restores server order on Reset', async () => {
		const programs = [
			program({ programId: 'popular', protocol: 'Popular' }),
			program({ programId: 'zero', protocol: 'Zero' }),
			program({ programId: 'missing', protocol: 'Missing' })
		]
		const order = () =>
			[...container.querySelectorAll<HTMLAnchorElement>('tbody a[data-reward-program-id]')].map(
				(link) => link.dataset.rewardProgramId
			)
		await act(async () => root.render(<Rewards programs={programs} analyticsMode="off" />))
		const links = [...container.querySelectorAll<HTMLAnchorElement>('tbody a[data-reward-program-id]')]
		expect(order()).toEqual(['popular', 'zero', 'missing'])
		expect(links[0]?.getAttribute('href')).toBe(programs[0]?.referralUrl)
		expect(links[0]?.getAttribute('target')).toBe('_blank')
		router.query = { sort: 'protocol', order: 'asc' }
		await act(async () => root.render(<Rewards programs={programs} analyticsMode="off" />))
		expect(order()).toEqual(['popular', 'zero', 'missing'])
		await act(async () => element<HTMLButtonElement>('thead button').click())
		expect(order()).toEqual(['missing', 'popular', 'zero'])
		expect(router.push).not.toHaveBeenCalled()
		router.query = { reward: 'Points' }
		await act(async () => root.render(<Rewards programs={programs} analyticsMode="off" />))
		expect(order()).toEqual(['missing', 'popular', 'zero'])
		const reset = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
			(button) => button.textContent === 'Reset'
		)
		if (!reset) throw new Error('Missing Reset button')
		await act(async () => reset.click())
		expect(order()).toEqual(['popular', 'zero', 'missing'])
	})

	it('bounds rendered rows and resets pagination after filtering', async () => {
		const programs = Array.from({ length: 65 }, (_, i) =>
			program({
				programId: String(64 - i),
				protocol: `Protocol ${64 - i}`,
				rewardTypes: i === 0 ? ['Commission'] : ['Points']
			})
		)
		await act(async () => root.render(<Rewards programs={programs} analyticsMode="off" />))
		expect(tableRows()).toHaveLength(50)
		expect(tableRows()[0]?.textContent).toContain('Protocol 64')
		await act(async () => element<HTMLButtonElement>('[aria-label="Go to next page"]').click())
		expect(tableRows()).toHaveLength(15)
		await choose('Reward type', 'Commission')
		expect(router.push).toHaveBeenLastCalledWith(
			{ pathname: '/rewards', query: { reward: ['Commission'] } },
			undefined,
			{ shallow: true }
		)
		// The router owns selection; render the navigation result rather than
		// letting a second local filter state mask a URL synchronization bug.
		router.query = { reward: 'Commission' }
		await act(async () => root.render(<Rewards programs={programs} analyticsMode="off" />))
		expect(tableRows()).toHaveLength(1)
		expect(tableRows()[0]?.textContent).toContain('Protocol 64')
	})

	it('shows only benefits available to users who follow the link', async () => {
		const programs = [
			program({
				programId: 'referrer-only',
				protocol: 'Referrer Program',
				benefitAudience: 'Referrer only',
				visitorBenefit: 'Visitors receive no direct benefit.',
				referrerBenefit: 'Referrers earn a share of fees.'
			}),
			program({
				programId: 'both',
				protocol: 'Both Program',
				benefitAudience: 'Both',
				visitorBenefit: 'Visitors receive a discount.',
				referrerBenefit: 'Referrers earn a commission.'
			})
		]
		await act(async () => root.render(<Rewards programs={programs} analyticsMode="off" />))
		const rows = tableRows()
		const referrerRow = rows.find((row) => row.textContent?.includes('Referrer Program'))
		const bothRow = rows.find((row) => row.textContent?.includes('Both Program'))
		expect(referrerRow?.textContent).not.toContain('Referrers earn a share of fees.')
		expect(referrerRow?.textContent).not.toContain('Visitors receive no direct benefit.')
		expect(bothRow?.textContent).toContain('Visitors receive a discount.')
		expect(bothRow?.textContent).not.toContain('Referrers earn a commission.')
	})
})
