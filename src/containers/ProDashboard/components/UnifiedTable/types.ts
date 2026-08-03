import type { UnifiedTableConfig } from '../../unifiedTable/config/current'
import type { FilteredShareMetricKey } from '../../unifiedTable/config/filteredShareColumns'
import type { UnifiedRowHeaderType } from '../../unifiedTable/config/types'
import type { ProtocolTableMetrics, ProtocolTableSourceRow } from '../../unifiedTable/contracts'

export type UnifiedTableFocusSection = 'strategy' | 'columns' | 'filters' | 'preview'

export interface UnifiedTableProps {
	config: UnifiedTableConfig
	onEdit?: (focusSection?: UnifiedTableFocusSection) => void
}

export type ProtocolTableFilteredShares = Partial<Record<FilteredShareMetricKey, number | null>>

interface ProtocolTableReadModelBase {
	id: string
	name: string
	displayName: string
	logo: string | null
	category: string | null
	chains: string[]
	oracles: string[]
	metrics: ProtocolTableMetrics
	filteredShares: ProtocolTableFilteredShares
	customValues: Record<string, number | null>
}

export type ProtocolTableLeafRow = ProtocolTableSourceRow &
	ProtocolTableReadModelBase & {
		nodeType: 'leaf'
	}

export interface ProtocolTableGroupRow extends ProtocolTableReadModelBase {
	nodeType: 'group'
	header: UnifiedRowHeaderType
	groupKind: 'parent' | 'protocol' | 'chain' | 'category'
	isSelfGroup: boolean
	subRows: ProtocolTableRow[]
}

export type ProtocolTableRow = ProtocolTableLeafRow | ProtocolTableGroupRow
