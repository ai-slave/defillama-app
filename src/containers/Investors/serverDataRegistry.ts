type Fetcher = () => Promise<Record<string, unknown>>

const SERVER_DATA_FETCHERS: Record<string, Fetcher> = {
	t62luatlj9thwx2: () =>
		import('./dashboards/berachain/api').then((m) =>
			m.fetchBerachainIncomeServerData().then((d) => ({ berachainIncome: d }))
		),
	bfqwxro9m0xnc9z: () =>
		import('./dashboards/thorchain/serverData').then((m) =>
			m.fetchThorchainServerData().then((d) => ({
				thorchainUnlocks: { emissions: d.emissions, initialTokenMarketData: d.initialTokenMarketData }
			}))
		),
	un1swapd4shb0rd: () =>
		import('./dashboards/uniswap/serverData').then((m) =>
			m.fetchUniswapServerData().then((d) => ({
				uniswapUnlocks: { emissions: d.emissions, initialTokenMarketData: d.initialTokenMarketData }
			}))
		)
}

export async function fetchCustomServerData(dashboardId: string): Promise<Record<string, unknown>> {
	const fetcher = SERVER_DATA_FETCHERS[dashboardId]
	if (!fetcher) return {}
	try {
		return await fetcher()
	} catch {
		return {}
	}
}
