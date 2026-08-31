import type { ParsedUrlQuery } from 'querystring'
import { isTrueQueryParam, readSingleQueryValue, toNonEmptyArrayParam } from '~/utils/routerQuery'
import { LIFECYCLES, REWARD_TYPES } from './types'

export function readRewardsQuery(query: ParsedUrlQuery) {
	const status = readSingleQueryValue(query.status)
	const rewards = toNonEmptyArrayParam(query.reward)
	return {
		lifecycle: LIFECYCLES.find((value) => value === status) ?? ('All' as const),
		rewardTypes: REWARD_TYPES.filter((value) => rewards.includes(value)),
		hideUnverified: isTrueQueryParam(query.hideUnverified)
	}
}

export function serializeRewardsQuery(query: ReturnType<typeof readRewardsQuery>) {
	return {
		status: query.lifecycle === 'All' ? undefined : query.lifecycle,
		reward: query.rewardTypes.length ? query.rewardTypes : undefined,
		hideUnverified: query.hideUnverified ? 'true' : undefined
	}
}
