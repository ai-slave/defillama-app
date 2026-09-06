import { V2_SERVER_URL } from '~/constants'
import { normalizeHack } from '~/containers/Hacks/model'
import { normalizeRaisesApiItem } from '~/containers/Raises/model'
import { fetchJson } from '~/utils/async'
import type {
	IProtocolChainBreakdownChart,
	IProtocolChainBreakdownChartRaw,
	IProtocolExpenses,
	IProtocolMetricsV2,
	IProtocolMetricsV2Api,
	IProtocolTokenBreakdownChart,
	IProtocolTokenBreakdownChartRaw,
	IProtocolTreasuryChartParams,
	IProtocolTvlChartParams,
	IProtocolTvlTokenBreakdownChartParams,
	IProtocolValueChart,
	IProtocolValueChartRaw,
	ProtocolChartSelector,
	ProtocolTreasuryKey,
	ProtocolTvlKey
} from './api.types'
import { canonicalizeTokensToExclude } from './valueChartSources'

type ProtocolChartUrlParams = {
	protocol: string
} & ProtocolChartSelector &
	(
		| { namespace: 'tvl'; key?: ProtocolTvlKey; tokensToExclude?: Array<string> }
		| { namespace: 'treasury'; key?: ProtocolTreasuryKey; tokensToExclude?: never }
	)

const buildProtocolChartUrl = (params: ProtocolChartUrlParams) => {
	const suffix = params.breakdownType ? `/${params.breakdownType}` : ''
	const url = new URL(
		`${V2_SERVER_URL}/chart/${params.namespace}/protocol/${params.protocol}${suffix}`.replaceAll('#', '$')
	)
	if (params.key) url.searchParams.set('key', params.key)
	if (params.currency) url.searchParams.set('currency', params.currency)
	if (params.namespace === 'tvl') {
		const tokenExclusions = canonicalizeTokensToExclude(params.tokensToExclude)
		if (tokenExclusions) url.searchParams.set('tokensToExclude', tokenExclusions.queryValue)
	}
	return url.toString()
}

const normalizeProtocolValueChart = (values: IProtocolValueChartRaw): IProtocolValueChart =>
	values.map(([timestamp, value]) => [timestamp * 1e3, value])

const normalizeProtocolChainBreakdownChart = (values: IProtocolChainBreakdownChartRaw): IProtocolChainBreakdownChart =>
	values.map(([timestamp, value]) => [timestamp * 1e3, value])

const normalizeProtocolTokenBreakdownChart = (values: IProtocolTokenBreakdownChartRaw): IProtocolTokenBreakdownChart =>
	values.map(([timestamp, value]) => [timestamp * 1e3, value])

/** Fetch aggregate TVL metrics for a protocol. */
export const fetchProtocolOverviewMetrics = async (protocol: string): Promise<IProtocolMetricsV2> => {
	const metrics = await fetchJson<IProtocolMetricsV2Api>(`${V2_SERVER_URL}/metrics/tvl/protocol/${protocol}`)
	const { hacks, raises, ...protocolMetrics } = metrics
	return {
		...protocolMetrics,
		hacks: hacks.map(normalizeHack),
		raises: raises.map(normalizeRaisesApiItem)
	}
}

export function fetchProtocolTvlChart(
	params: IProtocolTvlChartParams & { breakdownType: 'chain-breakdown' }
): Promise<IProtocolChainBreakdownChart>
export function fetchProtocolTvlChart(
	params: IProtocolTvlChartParams & { breakdownType: 'token-breakdown' }
): Promise<IProtocolTokenBreakdownChart>
export function fetchProtocolTvlChart(
	params: IProtocolTvlChartParams & { breakdownType?: never }
): Promise<IProtocolValueChart>
export function fetchProtocolTvlChart(
	params: IProtocolTvlChartParams
): Promise<IProtocolValueChart | IProtocolChainBreakdownChart | IProtocolTokenBreakdownChart>
export async function fetchProtocolTvlChart(
	params: IProtocolTvlChartParams
): Promise<IProtocolValueChart | IProtocolChainBreakdownChart | IProtocolTokenBreakdownChart> {
	const common: {
		namespace: 'tvl'
		protocol: string
		key?: ProtocolTvlKey
		tokensToExclude?: Array<string>
	} = {
		namespace: 'tvl',
		protocol: params.protocol,
		...(params.key ? { key: params.key } : {}),
		...(params.tokensToExclude?.length ? { tokensToExclude: params.tokensToExclude } : {})
	}
	const url =
		params.breakdownType === 'chain-breakdown'
			? buildProtocolChartUrl({ ...common, breakdownType: 'chain-breakdown' })
			: params.breakdownType === 'token-breakdown'
				? buildProtocolChartUrl({
						...common,
						breakdownType: 'token-breakdown',
						...(params.currency ? { currency: params.currency } : {})
					})
				: buildProtocolChartUrl(common)
	const options = params.timeout === undefined ? undefined : { timeout: params.timeout }

	if (params.breakdownType === 'chain-breakdown') {
		return normalizeProtocolChainBreakdownChart(await fetchJson<IProtocolChainBreakdownChartRaw>(url, options))
	}
	if (params.breakdownType === 'token-breakdown') {
		return normalizeProtocolTokenBreakdownChart(await fetchJson<IProtocolTokenBreakdownChartRaw>(url, options))
	}
	return normalizeProtocolValueChart(await fetchJson<IProtocolValueChartRaw>(url, options))
}

export function fetchProtocolTreasuryChart(
	params: IProtocolTreasuryChartParams & { breakdownType: 'chain-breakdown' }
): Promise<IProtocolChainBreakdownChart>
export function fetchProtocolTreasuryChart(
	params: IProtocolTreasuryChartParams & { breakdownType: 'token-breakdown' }
): Promise<IProtocolTokenBreakdownChart>
export function fetchProtocolTreasuryChart(
	params: IProtocolTreasuryChartParams & { breakdownType?: never }
): Promise<IProtocolValueChart>
export function fetchProtocolTreasuryChart(
	params: IProtocolTreasuryChartParams
): Promise<IProtocolValueChart | IProtocolChainBreakdownChart | IProtocolTokenBreakdownChart>
export async function fetchProtocolTreasuryChart(
	params: IProtocolTreasuryChartParams
): Promise<IProtocolValueChart | IProtocolChainBreakdownChart | IProtocolTokenBreakdownChart> {
	const common: { namespace: 'treasury'; protocol: string; key?: ProtocolTreasuryKey } = {
		namespace: 'treasury',
		protocol: params.protocol,
		...(params.key ? { key: params.key } : {})
	}
	const url =
		params.breakdownType === 'chain-breakdown'
			? buildProtocolChartUrl({ ...common, breakdownType: 'chain-breakdown' })
			: params.breakdownType === 'token-breakdown'
				? buildProtocolChartUrl({
						...common,
						breakdownType: 'token-breakdown',
						...(params.currency ? { currency: params.currency } : {})
					})
				: buildProtocolChartUrl(common)
	const options = params.timeout === undefined ? undefined : { timeout: params.timeout }

	if (params.breakdownType === 'chain-breakdown') {
		return normalizeProtocolChainBreakdownChart(await fetchJson<IProtocolChainBreakdownChartRaw>(url, options))
	}
	if (params.breakdownType === 'token-breakdown') {
		return normalizeProtocolTokenBreakdownChart(await fetchJson<IProtocolTokenBreakdownChartRaw>(url, options))
	}
	return normalizeProtocolValueChart(await fetchJson<IProtocolValueChartRaw>(url, options))
}

export const fetchProtocolTvlTokenBreakdownChart = (
	params: IProtocolTvlTokenBreakdownChartParams
): Promise<IProtocolTokenBreakdownChart> => fetchProtocolTvlChart({ ...params, breakdownType: 'token-breakdown' })

/** Fetch protocol expense entries from the public expenses dataset. */
export async function fetchProtocolExpenses(): Promise<Array<IProtocolExpenses>> {
	return fetchJson<Array<IProtocolExpenses>>('https://api.llama.fi/_internal/operational-costs/expenses')
}
