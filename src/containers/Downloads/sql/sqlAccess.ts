export type SqlAccess = 'loading' | 'unknown' | 'upsell' | 'allowed'

/** What the SQL workspace shows. A failed refresh that still holds an active API plan keeps the workspace: only a read
    that never confirmed access is unknown, so a network blip does not unmount the open editor and its dialogs. */
export function sqlWorkspaceAccess({
	userLoading,
	isAuthenticated,
	subscriptionLoading,
	subscriptionError,
	isApiPlan,
	isLlama
}: {
	userLoading: boolean
	isAuthenticated: boolean
	subscriptionLoading: boolean
	subscriptionError: boolean
	isApiPlan: boolean
	isLlama: boolean
}): SqlAccess {
	if (userLoading || (isAuthenticated && subscriptionLoading && !isLlama)) return 'loading'
	if (isAuthenticated && (isApiPlan || isLlama)) return 'allowed'
	// A failed read is unknown: a retry state, not an upsell.
	if (isAuthenticated && subscriptionError) return 'unknown'
	return 'upsell'
}
