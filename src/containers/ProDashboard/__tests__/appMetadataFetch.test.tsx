// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { appMetadataFixtures } from '~/utils/testing/appMetadata'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { waitForUi } from '~/utils/testing/waitForUi'
import { AppMetadataProvider, useAppMetadata } from '../AppMetadataContext'
import { StreamDoneContext } from '../queries'

const http = installFixtureFetch()
const PROTOCOLS_URL = 'https://api.llama.fi/config/smol/appMetadata-protocols.json'

let root: Root
let container: HTMLDivElement
let client: QueryClient
beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	http.serve(appMetadataFixtures({ protocols: { one: { name: 'aave', tvl: true, fees: true } } }))
	client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	client.clear()
})

function ChartTypes({ label }: { label: string }) {
	const { loading, availableProtocolChartTypes } = useAppMetadata()
	return <p aria-label={label}>{loading ? 'loading' : availableProtocolChartTypes('aave').join(',')}</p>
}

async function render({ streamDone, consumers }: { streamDone: boolean; consumers: Array<string> }) {
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<StreamDoneContext.Provider value={streamDone}>
					<AppMetadataProvider>
						{consumers.map((label) => (
							<ChartTypes key={label} label={label} />
						))}
					</AppMetadataProvider>
				</StreamDoneContext.Provider>
			</QueryClientProvider>
		)
	)
}
const shown = (label: string) => container.querySelector(`[aria-label="${label}"]`)?.textContent
const metadataRequests = () => http.urls().filter((url) => url === PROTOCOLS_URL).length

test('downloads metadata once, only after a consumer mounts and the dashboard stream is done', async () => {
	await render({ streamDone: true, consumers: [] })
	expect(metadataRequests()).toBe(0)

	await render({ streamDone: false, consumers: ['first'] })
	expect(shown('first')).toBe('loading')
	expect(metadataRequests()).toBe(0)

	await render({ streamDone: true, consumers: ['first', 'second'] })
	await waitForUi(() => expect(shown('second')).toBe('tvl,fees'))
	expect(shown('first')).toBe('tvl,fees')
	expect(metadataRequests()).toBe(1)
})

test('metadata the stream delivered is used without a request', async () => {
	client.setQueryData(['pro-dashboard', 'app-metadata'], {
		protocols: { one: { name: 'aave', tvl: true } },
		chains: {},
		pfPs: { pf: ['aave'], ps: [] }
	})
	await render({ streamDone: true, consumers: ['card'] })
	expect(shown('card')).toBe('tvl,pfRatio')
	expect(metadataRequests()).toBe(0)
})

test('a card that is ready while the dashboard still streams waits for the stream before requesting metadata', async () => {
	// ChartGrid re-provides StreamDoneContext per card with that card's own readiness.
	const renderReadyCard = (dashboardStreamDone: boolean) =>
		act(async () =>
			root.render(
				<QueryClientProvider client={client}>
					<StreamDoneContext.Provider value={dashboardStreamDone}>
						<AppMetadataProvider>
							<StreamDoneContext.Provider value>
								<ChartTypes label="ready card" />
							</StreamDoneContext.Provider>
						</AppMetadataProvider>
					</StreamDoneContext.Provider>
				</QueryClientProvider>
			)
		)
	await renderReadyCard(false)
	expect(shown('ready card')).toBe('loading')
	expect(metadataRequests()).toBe(0)

	await renderReadyCard(true)
	await waitForUi(() => expect(shown('ready card')).toBe('tvl,fees'))
	expect(metadataRequests()).toBe(1)
})
