// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { Announcement } from '~/components/Announcement'
import { ANNOUNCEMENT_DISMISSALS_COOKIE_NAME } from '~/utils/cookies'

describe('Announcement dismissal', () => {
	let container: HTMLDivElement
	let root: Root

	function render(node: React.ReactNode) {
		return act(async () => root.render(node))
	}

	function dismissButton() {
		return container.querySelector<HTMLButtonElement>('button[aria-label="Close"]') ?? undefined
	}

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
		document.cookie = `${ANNOUNCEMENT_DISMISSALS_COOKIE_NAME}=; expires=${new Date(0).toUTCString()}; path=/`
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
		document.cookie = `${ANNOUNCEMENT_DISMISSALS_COOKIE_NAME}=; expires=${new Date(0).toUTCString()}; path=/`
	})

	test('renders until dismissed, then hides every banner for that announcement', async () => {
		await render(
			<>
				<Announcement announcementId="test-announcement" version="v1">
					Heads up
				</Announcement>
				<Announcement announcementId="test-announcement" version="v1">
					Heads up again
				</Announcement>
			</>
		)
		expect(container.textContent).toContain('Heads up')

		await act(async () => dismissButton()!.dispatchEvent(new MouseEvent('click', { bubbles: true })))
		expect(container.textContent).not.toContain('Heads up')
	})

	test('a banner that was already dismissed does not render after mount', async () => {
		await render(
			<Announcement announcementId="test-announcement" version="v1">
				Heads up
			</Announcement>
		)
		await act(async () => dismissButton()!.dispatchEvent(new MouseEvent('click', { bubbles: true })))

		await act(async () => root.unmount())
		root = createRoot(container)
		await render(
			<Announcement announcementId="test-announcement" version="v1">
				Heads up
			</Announcement>
		)
		expect(container.textContent).not.toContain('Heads up')
	})

	test('closing the banner hands focus to the page content', async () => {
		await render(
			<main>
				<Announcement announcementId="test-announcement" version="v1">
					Heads up
				</Announcement>
			</main>
		)
		const button = dismissButton()!
		button.focus()
		await act(async () => button.click())
		expect(container.textContent).not.toContain('Heads up')
		expect(document.activeElement).toBe(container.querySelector('main'))
	})

	test('a non-cancellable announcement has no dismiss control', async () => {
		await render(<Announcement notCancellable>Permanent</Announcement>)
		expect(container.textContent).toContain('Permanent')
		expect(dismissButton()).toBeUndefined()
	})
})
