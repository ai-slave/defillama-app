export interface IBridgedRow {
	name: string
	deprecated?: boolean
	total?: { total?: string }
	thirdParty?: { total?: string }
	canonical?: { total?: string }
	ownTokens?: { total?: string }
	native?: { total?: string }
	change_24h: number
}
