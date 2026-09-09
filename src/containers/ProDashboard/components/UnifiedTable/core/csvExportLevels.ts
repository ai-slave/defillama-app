import type { UnifiedRowHeaderType } from '../../../unifiedTable/config/types'
export type CsvExportLevel = 'all' | UnifiedRowHeaderType

export const EXPORT_LEVEL_LABELS: Record<CsvExportLevel, string> = {
	all: 'All Protocols',
	chain: 'Chains Only',
	category: 'Categories Only',
	'parent-protocol': 'Protocol Groups Only',
	protocol: 'Protocols Only'
}
