import type { IYieldTableRow } from '~/containers/Yields/Tables/types'

export type YieldPoolPageData = {
	pool: IYieldTableRow
	config: any | null
	poolId: string
}

export type YieldPoolPageDataResult = {
	source: 'snapshot'
	data: YieldPoolPageData | null
}
