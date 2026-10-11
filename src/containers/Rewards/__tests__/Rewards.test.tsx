import type { ParsedUrlQuery } from 'node:querystring'
// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import RewardsPage from '..'
import type { RewardProgram } from '../types'
import { program } from './fixtures'

function Rewards({ programs }: { programs: Array<RewardProgram> }) {
	return <RewardsPage programs={programs} popularityOrder={programs.map((p) => p.programId)} featuredCardIds={[]} />
}

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
		document.cookie = 'defillama-ab-group=a; path=/'
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

	test.each([null, 'Referrers earn points.'])(
		'renders the referrer section only with benefit copy: %j',
		async (benefit) => {
			await act(async () => root.render(<Rewards programs={[program({ referrerBenefit: benefit })]} />))
			await act(async () => element<HTMLButtonElement>('[aria-label="Details for Example"]').click())
			const details = element<HTMLElement>('[id^="reward-details-"]')
			expect(details.textContent).toContain('For invited users')
			expect(details.textContent).toContain('Earn points on deposits.')
			expect(details.textContent?.includes('For users who invite others')).toBe(benefit !== null)
			expect(details.querySelector('dl > div:nth-child(2) dd')?.textContent ?? null).toBe(benefit)
		}
	)

	test('sorts headers locally, ignores sort URLs, and restores server order on Reset', async () => {
		const programs = [
			program({ programId: 'popular', protocol: 'Popular' }),
			program({ programId: 'zero', protocol: 'Zero' }),
			program({ programId: 'missing', protocol: 'Missing' })
		]
		const order = () =>
			[...container.querySelectorAll<HTMLAnchorElement>('tbody a[data-reward-program-id]')].map(
				(link) => link.dataset.rewardProgramId
			)
		await act(async () => root.render(<Rewards programs={programs} />))
		const links = [...container.querySelectorAll<HTMLAnchorElement>('tbody a[data-reward-program-id]')]
		expect(order()).toEqual(['popular', 'zero', 'missing'])
		expect(links[0]?.getAttribute('href')).toBe(programs[0]?.referralUrl)
		expect(links[0]?.getAttribute('target')).toBe('_blank')
		router.query = { sort: 'protocol', order: 'asc' }
		await act(async () => root.render(<Rewards programs={programs} />))
		expect(order()).toEqual(['popular', 'zero', 'missing'])
		await act(async () => element<HTMLButtonElement>('thead button').click())
		expect(order()).toEqual(['missing', 'popular', 'zero'])
		expect(router.push).not.toHaveBeenCalled()
		router.query = { reward: 'Points' }
		await act(async () => root.render(<Rewards programs={programs} />))
		expect(order()).toEqual(['missing', 'popular', 'zero'])
		const reset = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
			(button) => button.textContent === 'Reset'
		)
		if (!reset) throw new Error('Missing Reset button')
		await act(async () => reset.click())
		expect(order()).toEqual(['popular', 'zero', 'missing'])
	})

	test('bounds rendered rows and resets pagination after filtering', async () => {
		const programs = Array.from({ length: 65 }, (_, i) =>
			program({
				programId: String(64 - i),
				protocol: `Protocol ${64 - i}`,
				rewardTypes: i === 0 ? ['Commission'] : ['Points']
			})
		)
		await act(async () => root.render(<Rewards programs={programs} />))
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
		await act(async () => root.render(<Rewards programs={programs} />))
		expect(tableRows()).toHaveLength(1)
		expect(tableRows()[0]?.textContent).toContain('Protocol 64')
	})

	test('shows only benefits available to users who follow the link', async () => {
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
		await act(async () => root.render(<Rewards programs={programs} />))
		const rows = tableRows()
		const referrerRow = rows.find((row) => row.textContent?.includes('Referrer Program'))
		const bothRow = rows.find((row) => row.textContent?.includes('Both Program'))
		expect(referrerRow?.textContent).not.toContain('Referrers earn a share of fees.')
		expect(referrerRow?.textContent).not.toContain('Visitors receive no direct benefit.')
		expect(bothRow?.textContent).toContain('Visitors receive a discount.')
		expect(bothRow?.textContent).not.toContain('Referrers earn a commission.')
	})
	test.each(['a', 'b'] as const)(
		'renders variant %s and resets to its own order and hides cards while filtering',
		async (variant) => {
			document.cookie = `defillama-ab-group=${variant}; path=/`
			const programs = [
				program({ programId: 'featured', protocol: 'Z Featured' }),
				program({ programId: 'popular', protocol: 'A Popular' })
			]
			const render = () =>
				root.render(
					<RewardsPage programs={programs} popularityOrder={['popular', 'featured']} featuredCardIds={['featured']} />
				)
			await act(async () => render())
			const order = () =>
				[...container.querySelectorAll<HTMLAnchorElement>('tbody a[data-reward-program-id]')].map(
					(link) => link.dataset.rewardProgramId
				)
			const expected = variant === 'a' ? ['featured', 'popular'] : ['popular', 'featured']
			expect(order()).toEqual(expected)
			expect(
				container.querySelectorAll('[aria-label="Featured rewards"] a[data-reward-placement="card"]')
			).toHaveLength(variant === 'b' ? 1 : 0)
			await act(async () => element<HTMLButtonElement>('thead button').click())
			if (variant === 'b') {
				await act(async () => element<HTMLButtonElement>('thead button').click())
			}
			expect(order()).toEqual([...expected].reverse())
			const reset = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
				(button) => button.textContent === 'Reset'
			)!
			await act(async () => reset.click())
			expect(order()).toEqual(expected)
			router.query = { status: 'Ended', hideUnverified: 'true', reward: 'Cashback' }
			await act(async () => render())
			expect(order()).toEqual([])
			expect(container.querySelector('[aria-label="Featured rewards"]')).toBeNull()
			await act(async () => reset.click())
			router.query = {}
			await act(async () => render())
			expect(container.querySelectorAll('a[data-reward-placement="card"]')).toHaveLength(variant === 'b' ? 1 : 0)
		}
	)
	test.each([{ status: 'Live' }, { reward: 'Points' }, { hideUnverified: 'true' }])(
		'hides all cards for an active filter even when its program still matches: %j',
		async (query) => {
			document.cookie = 'defillama-ab-group=b; path=/'
			const programs = [program({ programId: 'featured' })]
			const render = () =>
				root.render(<RewardsPage programs={programs} popularityOrder={['featured']} featuredCardIds={['featured']} />)
			await act(async () => render())
			expect(container.querySelectorAll('a[data-reward-placement="card"]')).toHaveLength(1)
			router.query = query
			await act(async () => render())
			expect(tableRows()).toHaveLength(1)
			expect(container.querySelector('[aria-label="Featured rewards"]')).toBeNull()
			router.query = {}
			await act(async () => render())
			expect(container.querySelectorAll('a[data-reward-placement="card"]')).toHaveLength(1)
		}
	)
	test('hides cards for search and restores them when search is cleared', async () => {
		document.cookie = 'defillama-ab-group=b; path=/'
		await act(async () =>
			root.render(
				<RewardsPage
					programs={[program({ programId: 'featured' })]}
					popularityOrder={['featured']}
					featuredCardIds={['featured']}
				/>
			)
		)
		const input = element<HTMLInputElement>('input[aria-label="Search protocols or programs"]')
		await act(async () => {
			Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Example')
			input.dispatchEvent(new Event('input', { bubbles: true }))
		})
		expect(tableRows()).toHaveLength(1)
		expect(container.querySelector('[aria-label="Featured rewards"]')).toBeNull()
		await act(async () => {
			Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '   ')
			input.dispatchEvent(new Event('input', { bubbles: true }))
		})
		expect(container.querySelectorAll('a[data-reward-placement="card"]')).toHaveLength(1)
	})
})
