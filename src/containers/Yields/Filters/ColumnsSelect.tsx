import { useRouter } from 'next/router'
import { getSelectOptionLabel, SelectWithCombobox } from '~/ui/SelectWithCombobox'
import { trackYieldsEvent, YIELDS_EVENTS } from '~/utils/analytics/yields'
import { pushYieldsQuery } from '../queryUpdates.client'
import {
	EARN_COLUMN_OPTION_KEYS,
	EARN_COLUMN_OPTIONS,
	EARN_NO_COLUMNS,
	NO_DEFAULT_EARN_COLUMNS,
	parseSelectedEarnColumns
} from './columnOptions'

const isOurs = (value: string) => EARN_COLUMN_OPTION_KEYS.has(value) || value === EARN_NO_COLUMNS

export function ColumnsSelect({
	nestedMenu,
	defaultColumns = NO_DEFAULT_EARN_COLUMNS
}: {
	nestedMenu?: boolean
	defaultColumns?: ReadonlyArray<string>
}) {
	const router = useRouter()
	const { column } = router.query

	const selectedColumns = parseSelectedEarnColumns(
		typeof column === 'string' || Array.isArray(column) ? column : undefined,
		defaultColumns
	)

	// Drive the `column` param directly (state mode): preserve any values owned by other
	// controls/pages, then append the current selection.
	const setSelectedValues = (values: Array<string>) => {
		const prevSet = new Set(selectedColumns)
		const nextSet = new Set(values)
		for (const value of values) {
			if (!prevSet.has(value)) trackYieldsEvent(YIELDS_EVENTS.FILTER_COLUMN, { column: value, enabled: true })
		}
		for (const value of selectedColumns) {
			if (!nextSet.has(value)) trackYieldsEvent(YIELDS_EVENTS.FILTER_COLUMN, { column: value, enabled: false })
		}
		const foreign = Array.isArray(column)
			? column.filter((value) => !isOurs(value))
			: typeof column === 'string' && !isOurs(column)
				? [column]
				: []
		// Clearing every column must outlive a non-empty default set, so it is written explicitly.
		const own = values.length > 0 ? values : defaultColumns.length > 0 ? [EARN_NO_COLUMNS] : []
		const next = [...foreign, ...own]
		void pushYieldsQuery(router, { column: next.length > 0 ? next : undefined })
	}

	return (
		<SelectWithCombobox
			variant="default"
			size="sm"
			allValues={EARN_COLUMN_OPTIONS}
			selectedValues={selectedColumns}
			selectedLabels={selectedColumns.map((key) => getSelectOptionLabel(EARN_COLUMN_OPTIONS, key))}
			setSelectedValues={setSelectedValues}
			label="Columns"
			labelType="regular"
			{...(nestedMenu !== undefined ? { nestedMenu } : {})}
		/>
	)
}
