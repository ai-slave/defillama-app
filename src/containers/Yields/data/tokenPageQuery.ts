// Token pages include their own meme pools; Earn also includes pools holding the asset.
export const TOKEN_PAGE_EARN_QUERY = {
	tokenMatch: 'contains',
	tokenOn: 'both',
	pageSize: 'all',
	includeMemeTokens: 'true'
} as const

export const TOKEN_PAGE_BORROW_QUERY = {
	sortBy: 'net_apy',
	sortDesc: 'true',
	pageSize: 'all',
	includeMemeTokens: 'true'
} as const
