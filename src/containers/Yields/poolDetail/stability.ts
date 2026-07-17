import { resolveVariant, stabilityRatingFromScore } from '../data/apy'
import type { ApyComponent } from '../data/types'
import type { StabilityInfo } from './PoolDetailView'
import type { PoolDetail } from './types'

const DETAIL_APY_COMPONENTS: ApyComponent[] = ['base', 'reward', 'intrinsic']

export function getPoolStability(detail: Pick<PoolDetail, 'stability_30d'>): StabilityInfo | null {
	const score = resolveVariant<number>(detail.stability_30d, DETAIL_APY_COMPONENTS)
	return score == null ? null : { score, rating: stabilityRatingFromScore(score) }
}
