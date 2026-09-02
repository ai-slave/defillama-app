export const UTR_CLAIM_ERROR_SELECTOR = '[data-utr-claim-error]'

export function scrollToFirstUtrClaimError(root: ParentNode | null): void {
	const error = root?.querySelector<HTMLElement>(UTR_CLAIM_ERROR_SELECTOR)
	if (!error) return

	const reduceMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
	error.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' })
}
