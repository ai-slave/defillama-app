// @vitest-environment happy-dom
import { act, type ComponentType, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import { DownloadsCatalog } from '../DownloadsCatalog'

// Like the real router, a replace swaps the query, and each render gets a fresh router object.
const router = vi.hoisted(() => ({
	isReady: true,
	pathname: '/downloads',
	query: {} as Record<string, string>,
	replace: vi.fn(async ({ query }: { query: Record<string, string> }) => {
		router.query = query
		return true
	})
}))
vi.mock('next/router', () => ({ useRouter: () => ({ ...router }) }))

const CHAINS_CSV = 'name,tokenSymbol,tvl,chainId\nEthereum,ETH,100,1\nSolana,SOL,50,0'
let writeClipboard: ReturnType<typeof vi.fn<(text: string) => Promise<void>>>
beforeEach(() => {
	router.query = {}
	router.replace.mockClear()
	writeClipboard = vi.fn(async () => {})
	Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: writeClipboard } })
})

// Each test unmounts before its session signs out, so the sign-out cannot re-render a link left in the URL.
async function renderCatalog(Wrapper: ComponentType<{ children: ReactNode }>) {
	const container = document.body.appendChild(document.createElement('div'))
	const root = createRoot(container)
	const render = () =>
		act(async () =>
			root.render(
				<Wrapper>
					<DownloadsCatalog chartOptionsMap={{}} />
				</Wrapper>
			)
		)
	await render()
	return {
		rerender: render,
		unmount: async () => {
			await act(async () => root.unmount())
			container.remove()
		}
	}
}
function button(name: string) {
	const found = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
		(el) => el.textContent?.trim() === name || el.title === name || el.getAttribute('aria-label') === name
	)
	expect(found).toBeDefined()
	return found!
}
async function click(el: HTMLElement) {
	await act(async () => el.click())
}
function selectedColumns() {
	return [...document.querySelectorAll<HTMLInputElement>('input[type="checkbox"][aria-label^="Include "]')]
		.filter((input) => input.checked)
		.map((input) => input.getAttribute('aria-label')!.slice('Include '.length, -' column'.length))
}
async function copiedLink() {
	await click(button('Copy shareable link'))
	return writeClipboard.mock.calls.at(-1)![0]
}

describe('a subscriber', () => {
	const session = installSubscriberSession('sharer', { resolved: true })

	test('opens a copied preview link with the same columns and sort, and closing it drops the link from the URL', async () => {
		session.serve({ '/api/private/downloads/chains': () => new Response(CHAINS_CSV) })
		let link = ''
		const sharer = await renderCatalog(session.Wrapper)
		try {
			await click(
				[...document.querySelectorAll<HTMLButtonElement>('button')].find((el) =>
					el.textContent!.includes('Chains TVL')
				)!
			)
			await waitForUi(() => expect(selectedColumns()).toEqual(['name', 'tokenSymbol', 'tvl', 'chainId']))
			await click(document.querySelector<HTMLInputElement>('input[aria-label="Include tokenSymbol column"]')!)
			await click(button('tvl'))
			link = await copiedLink()
			expect(link).toBe('http://localhost:3000/downloads?k=dataset&s=chains&c=name%2Ctvl%2CchainId&sort=tvl%3Aasc')
		} finally {
			await sharer.unmount()
		}

		router.query = Object.fromEntries(new URL(link).searchParams)
		const recipient = await renderCatalog(session.Wrapper)
		try {
			await waitForUi(() => expect(selectedColumns()).toEqual(['name', 'tvl', 'chainId']))
			expect(await copiedLink()).toBe(link)
			expect(router.replace).not.toHaveBeenCalled()
			await click(button('Close dialog'))
			expect(router.replace).toHaveBeenCalledExactlyOnceWith({ pathname: '/downloads', query: {} }, undefined, {
				shallow: true
			})
			await recipient.rerender()
			await waitForUi(() => expect(selectedColumns()).toEqual([]))
		} finally {
			await recipient.unmount()
		}
	})
})

describe('a trial account', () => {
	const session = installSubscriberSession('trialist', { resolved: true, record: { flags: { is_trial: true } } })

	test('opening a preview link shows the trial limit instead of the preview', async () => {
		session.serve({ '/subscription/trial-available': { trialAvailable: false } })
		router.query = { k: 'dataset', s: 'chains', c: 'name,tvl' }
		const page = await renderCatalog(session.Wrapper)
		try {
			await waitForUi(() => expect(document.body.textContent).toContain('CSV downloads require Pro'))
			expect(document.querySelector('input[aria-label="Include name column"]')).toBeNull()
		} finally {
			await page.unmount()
		}
	})
})
