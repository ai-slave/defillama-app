import type { ParsedUrlQuery } from 'querystring'
import { isTrueQueryParam, readSingleQueryValue, toNonEmptyArrayParam } from '~/utils/routerQuery'
import { LIFECYCLES, REWARD_TYPES } from './types'

const SORT_KEYS = ['fees30d', 'tvl', 'protocol', 'lifecycle', 'dates'] as const

export function readRewardsQuery(query: ParsedUrlQuery) {
	const status = readSingleQueryValue(query.status)
	const rewards = toNonEmptyArrayParam(query.reward)
	const sort = SORT_KEYS.find((key) => key === readSingleQueryValue(query.sort)) ?? 'fees30d'
	const order = readSingleQueryValue(query.order)
	return {
		lifecycle: LIFECYCLES.find((value) => value === status) ?? ('All' as const),
		rewardTypes: REWARD_TYPES.filter((value) => rewards.includes(value)),
		hideUnverified: isTrueQueryParam(query.hideUnverified),
		sort,
		desc: order === 'asc' ? false : order === 'desc' ? true : sort === 'fees30d' || sort === 'tvl'
	}
}

export function serializeRewardsQuery(query: ReturnType<typeof readRewardsQuery>) {
	const defaultDescending = query.sort === 'fees30d' || query.sort === 'tvl'
	return {
		status: query.lifecycle === 'All' ? undefined : query.lifecycle,
		reward: query.rewardTypes.length ? query.rewardTypes : undefined,
		hideUnverified: query.hideUnverified ? 'true' : undefined,
		sort: query.sort === 'fees30d' ? undefined : query.sort,
		order: query.desc === defaultDescending ? undefined : query.desc ? 'desc' : 'asc'
	}
}
