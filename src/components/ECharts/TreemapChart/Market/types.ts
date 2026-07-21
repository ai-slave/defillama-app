export interface MarketTreemapLeaf {
	name: string
	value: [number, number | null]
	iconKey: number
	iconUrl: string
	itemStyle: { color: string }
	companyName: string
	marketCap: number | null
	country?: string
	sector?: string
	industry?: string
}

export interface MarketTreemapGroup {
	name: string
	value: [number, null]
	children: MarketTreemapLeaf[]
}

export type MarketTreemapNode = MarketTreemapLeaf | MarketTreemapGroup
