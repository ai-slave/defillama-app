// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { DashboardTestProvider } from '~/utils/testing/dashboardContext'
import { alertTexts } from '~/utils/testing/fieldErrors'
import { SeparateChartsPreview } from '../SeparateChartsPreview'

let root: Root
let container: HTMLDivElement
beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

test('a series that failed to load says so and offers a retry instead of "No data"', async () => {
	const refetch = vi.fn()
	await act(async () =>
		root.render(
			<DashboardTestProvider>
				<SeparateChartsPreview
					composerItems={[
						{
							id: 'ethereum-tvl',
							kind: 'chart',
							subjectType: 'chain',
							chain: 'Ethereum',
							type: 'tvl',
							data: [],
							isLoading: false,
							hasError: true,
							canRetry: true,
							isFetching: false,
							refetch
						}
					]}
				/>
			</DashboardTestProvider>
		)
	)
	expect(alertTexts(container)).toHaveLength(1)
	expect(container.textContent).not.toContain('No data')
	await act(async () => [...container.querySelectorAll('button')].find((b) => b.textContent === 'Try again')!.click())
	expect(refetch).toHaveBeenCalledOnce()
})
