// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import {
	readAppStorage,
	updateAllSettingsInLsAndUrl,
	useLocalStorageSettingsManager,
	writeAppStorage
} from '../LocalStorage'

async function settleStorage() {
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 10))
	})
}

describe('settings shared between URL and local storage', () => {
	let container: HTMLDivElement
	let root: Root
	function Settings() {
		const [settings, toggle] = useLocalStorageSettingsManager('tvl_chains')
		return (
			<button type="button" onClick={() => toggle('L2')}>
				{String(settings.L2)}
			</button>
		)
	}
	beforeEach(() => {
		localStorage.clear()
		window.history.replaceState({}, '', '/')
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})
	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
		localStorage.clear()
		window.history.replaceState({}, '', '/')
	})
	test.each([true, false])(
		'reconciles a URL override opposite to stored %s and toggles both directions',
		async (stored) => {
			writeAppStorage({ L2: stored })
			window.history.replaceState({}, '', `/?L2=${!stored}`)
			await act(async () => root.render(<Settings />))
			await settleStorage()
			expect(container.textContent).toBe(String(!stored))
			await act(async () => container.querySelector('button')!.click())
			await settleStorage()
			expect(container.textContent).toBe(String(stored))
			expect(readAppStorage().L2).toBe(stored)
			expect(new URLSearchParams(window.location.search).get('L2')).toBe(String(stored))
			await act(async () => container.querySelector('button')!.click())
			await settleStorage()
			expect(container.textContent).toBe(String(!stored))
			expect(readAppStorage().L2).toBe(!stored)
		}
	)
	test.each([true, false])('notifies after bulk updates when stored %s is already correct', async (stored) => {
		writeAppStorage({ L2: stored })
		window.history.replaceState({}, '', `/?L2=${!stored}`)
		await act(async () => root.render(<Settings />))
		await settleStorage()
		expect(container.textContent).toBe(String(!stored))
		await act(async () => updateAllSettingsInLsAndUrl({ L2: stored }))
		await settleStorage()
		expect(container.textContent).toBe(String(stored))
		expect(new URLSearchParams(window.location.search).get('L2')).toBe(stored ? 'true' : null)
	})
	test('reconciles the checkbox with URL overrides on browser history navigation', async () => {
		writeAppStorage({ L2: false })
		await act(async () => root.render(<Settings />))
		await settleStorage()
		expect(container.textContent).toBe('false')
		await act(async () => {
			window.history.replaceState({}, '', '/?L2=true')
			window.dispatchEvent(new PopStateEvent('popstate'))
		})
		expect(container.textContent).toBe('true')
		await act(async () => {
			window.history.replaceState({}, '', '/')
			window.dispatchEvent(new PopStateEvent('popstate'))
		})
		expect(container.textContent).toBe('false')
	})
})
