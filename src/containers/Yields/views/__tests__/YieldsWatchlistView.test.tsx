// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useWatchlistManager } from '~/contexts/LocalStorage'
import { accessibleName } from '~/utils/testing/accessibleName'
import { fixtureStatus } from '~/utils/testing/fixtureFetch'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import { YieldsWatchlistContainer } from '../YieldsWatchlistView'

vi.mock('next/router', () => ({
	useRouter: () => ({ pathname: '/yields/watchlist', query: {}, asPath: '/yields/watchlist', push: vi.fn() })
}))

const session = installSubscriberSession('reader', { account: 'signed-out' })
let root: Root
let container: HTMLDivElement
beforeEach(() => {
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

// Saves through the watchlist's own writers, so the page reads what the bookmark buttons write.
function Seed({ portfolio, pool }: { portfolio?: string; pool?: string }) {
	const watchlist = useWatchlistManager('yields')
	return (
		<button
			type="button"
			onClick={() => {
				if (portfolio) watchlist.addPortfolio(portfolio)
				if (pool) watchlist.addProtocol(pool)
			}}
		>
			Seed
		</button>
	)
}

async function render(seed: { portfolio?: string; pool?: string }) {
	await act(async () => root.render(<Seed {...seed} />))
	await act(async () => container.querySelector('button')!.click())
	await act(async () =>
		root.render(
			<session.Wrapper>
				<YieldsWatchlistContainer />
			</session.Wrapper>
		)
	)
}
const button = (name: string) =>
	[...document.querySelectorAll<HTMLButtonElement>('button')].find((el) => accessibleName(el) === name)

test('a failed read of the saved pools says so instead of claiming none are saved', async () => {
	session.serve({ '/api/public/yields/earn': fixtureStatus(500, { message: 'Down' }) })
	await render({ pool: 'pool-1' })
	// The hook retries once, a second after the first failure.
	await waitForUi(
		() => expect(document.querySelector('[role="alert"]')?.textContent).toContain("Couldn't load your saved pools"),
		{
			timeout: 2500
		}
	)
	expect(document.body.textContent).not.toContain('You have not saved any pools.')
	expect(button('Try again')).toBeDefined()
}, 4000)

test('Delete asks before removing the portfolio, then hands focus to New', async () => {
	await render({ portfolio: 'Stables' })
	await waitForUi(() => expect(button('Delete')).toBeDefined())

	await act(async () => button('Delete')!.click())
	await waitForUi(() => expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain('"Stables"'))
	expect(button('Stables')).toBeDefined()

	const dialog = document.querySelector('[role="alertdialog"]')!
	const confirm = [...dialog.querySelectorAll('button')].find((el) => accessibleName(el) === 'Delete')!
	await act(async () => confirm.click())
	await waitForUi(() => expect(document.querySelector('[role="alertdialog"]')).toBeNull())
	expect(button('Stables')).toBeUndefined()
	expect(button('main')).toBeDefined()
	expect(document.activeElement).toBe(button('New'))
})

test('cancelling the portfolio delete returns focus to Delete', async () => {
	await render({ portfolio: 'Stables' })
	await waitForUi(() => expect(button('Delete')).toBeDefined())

	await act(async () => {
		button('Delete')!.focus()
		button('Delete')!.click()
	})
	const dialog = await waitForUi(() => {
		const element = document.querySelector('[role="alertdialog"]')
		expect(element).not.toBeNull()
		return element!
	})
	await act(async () => [...dialog.querySelectorAll('button')].find((el) => accessibleName(el) === 'Cancel')!.click())
	await waitForUi(() => expect(document.querySelector('[role="alertdialog"]')).toBeNull())
	expect(button('Stables')).toBeDefined()
	await waitForUi(() => expect(document.activeElement).toBe(button('Delete')))
})
