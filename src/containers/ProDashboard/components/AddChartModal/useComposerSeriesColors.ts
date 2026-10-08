import { useMemo } from 'react'
import { useProDashboardVariables } from '../../ProDashboardAPIContext'
import type { ChartConfig } from '../../types'
import { getChartEntityKey, getDashboardEntityColors, getMultiChartSeriesColors } from '../../utils/colorManager'

/**
 * Composer series colours by item id, as the saved cards will draw them when they join after the dashboard's cards.
 * A combined card colours its series together; separate cards each take their entity's colour.
 */
export function useComposerSeriesColors(
	composerItems: ReadonlyArray<ChartConfig>,
	combined: boolean
): Record<string, string> {
	const { resolvedItems } = useProDashboardVariables()
	return useMemo(() => {
		const entityColors = getDashboardEntityColors([...resolvedItems, ...composerItems])
		if (combined) return getMultiChartSeriesColors(composerItems, entityColors)
		const colors: Record<string, string> = {}
		for (const item of composerItems) colors[item.id] = item.color ?? entityColors[getChartEntityKey(item)]
		return colors
	}, [resolvedItems, composerItems, combined])
}
