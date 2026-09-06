// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { RWAPlatformPeerRow } from './types'

const mocks = vi.hoisted(() => ({ fetchJson: vi.fn() }))

let queryState: {
	data: Array<RWAPlatformPeerRow> | undefined
	isLoading: boolean
	error: Error | null
}

vi.mock('@tanstack/react-query', () => ({
	useQuery: () => queryState
}))
vi.mock('~/utils/async', () => ({ fetchJson: mocks.fetchJson }))
vi.mock('~/components/Link', () => ({
	BasicLink: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
		<a href={href} {...props}>
			{children}
		</a>
	)
}))
vi.mock('~/components/TokenLogo', () => ({ TokenLogo: () => <span /> }))

import { PeerRanking, fetchRWAPlatformPeers } from './PeerRanking'

const peers: Array<RWAPlatformPeerRow> = [
	{
		rank: 1,
		name: 'First',
		slug: 'first',
		logo: null,
		onchainAum: 2000,
		assetCount: 2,
		holderTotalFeeBps: null,
		mintFeeBps: null,
		redemptionFeeBps: null
	},
	{
		rank: 2,
		name: 'Selected',
		slug: 'selected',
		logo: null,
		onchainAum: 1000,
		assetCount: 1,
		holderTotalFeeBps: 0,
		mintFeeBps: 5,
		redemptionFeeBps: 0
	}
]

describe('RWA platform peer ranking', () => {
	let container: HTMLDivElement
	let root: Root

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		queryState = { data: undefined, isLoading: true, error: null }
		mocks.fetchJson.mockReset()
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
		vi.restoreAllMocks()
	})

	test('fetches the slim peer dataset through the browser-safe proxy route', async () => {
		mocks.fetchJson.mockResolvedValue(peers)

		await expect(fetchRWAPlatformPeers()).resolves.toBe(peers)
		expect(mocks.fetchJson).toHaveBeenCalledWith('/api/public/rwa/platform-peers')
	})

	test('reveals the selected row after client data arrives', async () => {
		vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (this: HTMLElement) {
			return this.classList.contains('overflow-auto') ? 200 : 0
		})
		vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
			if (this.classList.contains('overflow-auto')) return new DOMRect(0, 0, 800, 200)
			if (this.tagName === 'THEAD') return new DOMRect(0, 0, 800, 40)
			if (this.tagName === 'TR' && this.querySelector('[aria-current="page"]')) {
				return new DOMRect(0, 400, 800, 40)
			}
			return new DOMRect(0, 0, 0, 0)
		})

		await act(async () => root.render(<PeerRanking selectedSlug="selected" />))
		queryState = { data: peers, isLoading: false, error: null }
		await act(async () => root.render(<PeerRanking selectedSlug="selected" />))

		const scrollContainer = container.querySelector<HTMLDivElement>('.overflow-auto')
		expect(scrollContainer?.scrollTop).toBe(320)
		expect(container.querySelector('[aria-current="page"]')?.textContent).toBe('Selected')
	})

	test('does not move the table when the selected row is already visible', async () => {
		queryState = { data: peers, isLoading: false, error: null }
		vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (this: HTMLElement) {
			return this.classList.contains('overflow-auto') ? 200 : 0
		})
		vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
			if (this.classList.contains('overflow-auto')) return new DOMRect(0, 0, 800, 200)
			if (this.tagName === 'THEAD') return new DOMRect(0, 0, 800, 40)
			if (this.tagName === 'TR' && this.querySelector('[aria-current="page"]')) {
				return new DOMRect(0, 100, 800, 40)
			}
			return new DOMRect(0, 0, 0, 0)
		})

		await act(async () => root.render(<PeerRanking selectedSlug="selected" />))

		expect(container.querySelector<HTMLDivElement>('.overflow-auto')?.scrollTop).toBe(0)
	})
})
