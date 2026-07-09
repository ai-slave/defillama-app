export const TOKEN_SEARCH_LIMIT = 20

export interface TokenSearchResult {
	id: string
	searchId: string
	coinKey: string
	name: string
	symbol: string
	logo: string
	rank: number
}
