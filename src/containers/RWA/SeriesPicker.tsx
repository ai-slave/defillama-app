import { useRouter } from 'next/router'
import { SelectWithCombobox } from '~/ui/SelectWithCombobox'
import { pushShallowQuery } from '~/utils/routerQuery'
import { getRwaSeriesPickQuery } from './seriesPick'

/**
 * The series picker of a perps breakdown chart, the /dexs chain chart's Protocols picker: the members of the Group by,
 * largest first. An unpicked member leaves the chart. The panel resolves the pick from the URL (seriesPick.ts) so the
 * checks show exactly what the chart draws.
 */
export function RWASeriesPicker({
	label,
	options,
	picked
}: {
	label: string
	options: Array<string>
	picked: Array<string>
}) {
	const router = useRouter()
	if (options.length < 2) return null
	return (
		<SelectWithCombobox
			allValues={options}
			selectedValues={picked}
			setSelectedValues={(values: Array<string>) =>
				void pushShallowQuery(router, getRwaSeriesPickQuery(options, values))
			}
			label={label}
			labelType="smol"
			variant="filter"
			size="md"
		/>
	)
}
