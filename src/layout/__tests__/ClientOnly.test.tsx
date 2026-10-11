// @vitest-environment happy-dom

import { describe, expect, test } from 'vitest'
import { renderHydrated } from '~/utils/testing/hydration'
import { ClientOnly } from '../ClientOnly'

describe('ClientOnly', () => {
	test('the server sends no children and the browser renders them while hydrating, without a hydration error', async () => {
		const page = await renderHydrated(
			<ClientOnly>
				<p>Wallet settings</p>
			</ClientOnly>,
			{ pageClockSec: 1_780_000_000 }
		)

		expect(page.errors).toEqual([])
		expect(page.serverHtml).not.toContain('Wallet settings')
		expect(page.container.textContent).toBe('Wallet settings')
		await page.unmount()
	})
})
