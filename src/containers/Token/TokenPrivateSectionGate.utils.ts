export type TokenPrivateSectionView = 'loading' | 'sign-in' | 'subscribe' | 'error' | 'empty' | 'content'

/** Subscriber-only Token sections reveal their content only after auth resolves to an active subscription. */
export function getTokenPrivateSectionView({
	isAuthenticated,
	hasActiveSubscription,
	isLoading,
	hasError,
	hasEmptyMessage
}: {
	isAuthenticated: boolean
	hasActiveSubscription: boolean
	/** Auth or the section's own data is still loading. */
	isLoading: boolean
	hasError: boolean
	hasEmptyMessage: boolean
}): TokenPrivateSectionView {
	if (isLoading) return 'loading'
	if (!isAuthenticated) return 'sign-in'
	if (!hasActiveSubscription) return 'subscribe'
	if (hasError) return 'error'
	if (hasEmptyMessage) return 'empty'
	return 'content'
}
