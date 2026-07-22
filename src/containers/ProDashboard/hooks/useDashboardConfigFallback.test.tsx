// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDashboardConfigFallback } from './useDashboardConfigFallback'

describe('useDashboardConfigFallback', () => {
	let container: HTMLDivElement
	let root: Root

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
	})

	it('does not fetch on the healthy stream path and fetches once after fallback is enabled', async () => {
		const refetch = vi.fn()

		function Harness({ enabled }: { enabled: boolean }) {
			useDashboardConfigFallback(enabled, refetch)
			return null
		}

		await act(async () => root.render(<Harness enabled={false} />))
		expect(refetch).not.toHaveBeenCalled()

		await act(async () => root.render(<Harness enabled />))
		expect(refetch).toHaveBeenCalledOnce()

		await act(async () => root.render(<Harness enabled />))
		expect(refetch).toHaveBeenCalledOnce()
	})
})
