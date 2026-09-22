import { getTerminalLayers, loadTerminalLayers, saveTerminalLayers, type TerminalLayers } from './terminalData'
import { applyTerminalLayers, clearTerminalAgentDrawings } from './terminalOps'
import type { TerminalDropdownItem, TerminalWidget } from './terminalViewStore'

// The dropdown has no checked state, so a layer that is on carries a check and one that is off an
// empty icon of the same size, which keeps the titles aligned.
const icon = (path: string) =>
	`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28">${path}</svg>`
const CHECK_ICON = icon('<path fill="none" stroke="currentColor" stroke-width="1.5" d="M7 14.5l4.5 4.5L21 9"/>')
const EMPTY_ICON = icon('')

const LAYER_TITLES: Array<[keyof TerminalLayers, string]> = [
	['unlocks', 'Unlocks'],
	['events', 'Events'],
	['drawings', 'AI drawings'],
	['trades', 'Trade markers']
]

export function layerMenuItems(
	layers: TerminalLayers,
	onToggle: (key: keyof TerminalLayers) => void
): Array<TerminalDropdownItem> {
	return LAYER_TITLES.map(([key, title]) => ({
		title,
		icon: layers[key] ? CHECK_ICON : EMPTY_ICON,
		onSelect: () => onToggle(key)
	}))
}

export async function mountTerminalLayerControls(widget: TerminalWidget, fetchFn: typeof fetch) {
	await Promise.all([widget.headerReady(), loadTerminalLayers(fetchFn)])
	applyTerminalLayers()
	const toggle = (key: keyof TerminalLayers) => {
		saveTerminalLayers({ ...getTerminalLayers(), [key]: !getTerminalLayers()[key] }, fetchFn)
		applyTerminalLayers()
		dropdown.applyOptions({ items: layerMenuItems(getTerminalLayers(), toggle) })
	}
	const dropdown = await widget.createDropdown({
		title: 'Layers',
		tooltip: 'Show or hide chart layers',
		align: 'right',
		items: layerMenuItems(getTerminalLayers(), toggle)
	})
	widget.createButton({
		align: 'right',
		useTradingViewStyle: true,
		text: 'Clear AI drawings',
		title: 'Remove everything the AI drew on this chart. Your own drawings stay.',
		onClick: clearTerminalAgentDrawings
	})
}
