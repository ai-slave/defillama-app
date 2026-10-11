import type { IChainOverviewData } from '~/containers/ChainOverview/types'
import type { MultiSelectOption } from '~/ui/MultiSelectCombobox'

export type CompareProtocolsProps = {
	protocols: IChainOverviewData['protocols']
	protocolsList: Array<MultiSelectOption & { score: number }>
}
