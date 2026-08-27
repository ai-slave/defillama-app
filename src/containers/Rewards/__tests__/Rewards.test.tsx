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

	it('bounds rendered rows and resets pagination after filtering', async () => {
		const programs = Array.from({ length: 65 }, (_, i) =>
			program({
				programId: String(i),
				protocol: `Protocol ${i}`,
				fees30d: i === 0 ? null : i,
				rewardTypes: i === 64 ? ['Commission'] : ['Points']
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
})
