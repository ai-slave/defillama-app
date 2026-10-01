import type { ArticleStatus } from './types'

/** A draft waiting for its go-live time. Callers pass the clock, so a decision made in render follows it. */
export function isScheduled(
	article: { status: ArticleStatus | string; goLiveAt?: string | null },
	nowMs: number
): boolean {
	return article.status === 'draft' && article.goLiveAt != null && Date.parse(article.goLiveAt) > nowMs
}
