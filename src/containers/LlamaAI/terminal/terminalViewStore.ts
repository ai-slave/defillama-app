import Router from 'next/router'
import { useSyncExternalStore } from 'react'
import { useAuthContext } from '~/auth'
import { TERMINAL_PATH, toTerminalPath } from './terminalRoutes'

export interface TerminalShapeOptions {
	shape: string
	text?: string
	lock?: boolean
	disableSelection?: boolean
	disableSave?: boolean
	disableUndo?: boolean
	zOrder?: 'top' | 'bottom'
	overrides?: Record<string, string | number | boolean>
}

export interface TerminalStudyInput {
	id: string
	value: string | number | boolean
}

export interface TerminalStudy {
	getInputValues: () => Array<TerminalStudyInput>
	setInputValues: (values: Array<TerminalStudyInput>) => void
	paneIndex: () => number
	mergeUp: () => void
	unmergeDown: () => void
	changePriceScale: (scale: string) => void
	applyOverrides: (overrides: Record<string, string | number | boolean>) => void
}

export interface TerminalChart {
	symbol: () => string
	symbolExt: () => { ticker?: string } | null
	getAllStudies: () => Array<{ id: string; name: string }>
	getStudyById: (entityId: string) => TerminalStudy
	onSymbolChanged: () => { subscribe: (context: null, handler: () => void) => void }
	createStudy: (
		name: string,
		forceOverlay: boolean,
		lock: boolean,
		inputs?: Record<string, string | number | boolean>,
		overrides?: undefined,
		options?: { priceScale: string }
	) => Promise<string | null>
	createShape: (point: { time: number; price?: number }, options: TerminalShapeOptions) => Promise<string | null>
	createMultipointShape: (
		points: Array<{ time: number; price: number }>,
		options: TerminalShapeOptions
	) => Promise<string | null>
	removeEntity: (id: string) => void
	getAllShapes: () => Array<{ id: string; name: string }>
	getShapeById: (entityId: string) => {
		getPoints: () => Array<{ time: number; price: number }>
		getProperties: () => { text?: unknown }
	}
	onIntervalChanged: () => { subscribe: (context: null, handler: (interval: string) => void) => void }
	onVisibleRangeChanged: () => {
		subscribe: (context: null, handler: (range: { from: number; to: number }) => void) => void
	}
	setResolution: (resolution: string) => Promise<boolean>
	setSymbol: (symbol: string) => Promise<boolean>
	setVisibleRange: (range: { from: number; to: number }) => Promise<void>
	refreshMarks: () => void
	clearMarks: (mode?: number) => void
	dataReady: (callback: () => void) => boolean
	// Both are unix seconds / a TradingView resolution string such as '1D' or '60'.
	getVisibleRange: () => { from: number; to: number }
	resolution: () => string
}

export interface TerminalWidget {
	// The raw study metainfo, which the public getStudiesList() does not carry.
	_chartApiInstance?: { allStudiesMetadata?: () => Array<Record<string, unknown>> }
	onChartReady: (callback: () => void) => void
	subscribe: {
		(event: 'study_event' | 'study_properties_changed', callback: (entityId: string, eventType?: string) => void): void
		(event: 'onAutoSaveNeeded', callback: () => void): void
		(event: 'drawing_event', callback: (entityId: string, eventType: string) => void): void
	}
	save: (callback: (state: object) => void) => void
	activeChart: () => TerminalChart
	takeClientScreenshot: () => Promise<HTMLCanvasElement>
	headerReady: () => Promise<void>
	createDropdown: (params: {
		title: string
		tooltip?: string
		align?: 'left' | 'right'
		items: Array<TerminalDropdownItem>
	}) => Promise<{ applyOptions: (options: { items: Array<TerminalDropdownItem> }) => void; remove: () => void }>
	createButton: (options: {
		align: 'left' | 'right'
		useTradingViewStyle: true
		text: string
		title?: string
		onClick: () => void
	}) => string
	remove: () => void
}

export interface TerminalDropdownItem {
	title: string
	icon?: string
	onSelect: () => void
}

// Saved indicators the agent ran on this chart. The script is the durable thing, not its drawings:
// it survives a symbol change and re-runs against the new symbol.
const scripts = new Map<string, Array<string>>()

export function registerTerminalScript(file: string, inputs: Array<string>) {
	scripts.set(file, inputs)
}

export function listTerminalScripts(): Array<string> {
	return [...scripts.keys()]
}

export interface TerminalScriptRef {
	file: string
	inputs: Array<string>
}

export function listTerminalScriptRefs(): Array<TerminalScriptRef> {
	return [...scripts].map(([file, inputs]) => ({ file, inputs }))
}

export function resetTerminalScripts() {
	scripts.clear()
}

// How the panes were split. Whether the terminal is open lives in the URL path, and symbol, interval,
// indicators and drawings live in the chart's own saved layout, so each restores as one unit.
const STORAGE_KEY = 'llamaai-terminal-view'

interface StoredTerminalView {
	chatRatio?: number
	chatCollapsed?: boolean
}

function readStored(): StoredTerminalView {
	try {
		const { chatRatio, chatCollapsed } = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
		return { chatRatio, chatCollapsed }
	} catch {
		return {}
	}
}

function writeStored(next: StoredTerminalView) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readStored(), ...next }))
	} catch {
		// Private windows and blocked site data both throw; the view just falls back to defaults.
	}
}

export const MIN_CHAT_PX = 320
export const MIN_CHART_PX = 920
export const TERMINAL_RAIL_PX = 52
export const TERMINAL_SPLITTER_PX = 12
const SITE_NAV_COLUMN_PX = 228
const PAGE_GUTTER_PX = 16
export const TERMINAL_SITE_NAV_MIN_VIEWPORT_PX =
	SITE_NAV_COLUMN_PX +
	PAGE_GUTTER_PX +
	TERMINAL_RAIL_PX +
	MIN_CHART_PX +
	TERMINAL_SPLITTER_PX +
	MIN_CHAT_PX +
	PAGE_GUTTER_PX
const RATIO_MIN = 0.15
const RATIO_MAX = 0.6
export const DEFAULT_CHAT_RATIO = 0.3
export const CHAT_RATIO_KEYBOARD_STEP = 0.02

export function clampChatRatio(value: number, containerWidth = 0): number {
	if (!Number.isFinite(value)) return DEFAULT_CHAT_RATIO
	const min = containerWidth > 0 ? Math.max(RATIO_MIN, MIN_CHAT_PX / containerWidth) : RATIO_MIN
	const max =
		containerWidth > 0 ? Math.min(RATIO_MAX, 1 - (MIN_CHART_PX + TERMINAL_RAIL_PX) / containerWidth) : RATIO_MAX
	if (min > max) return DEFAULT_CHAT_RATIO
	return Math.min(Math.max(value, min), max)
}

let isOpen = false
let symbol = 'HYPE'
let requestedSymbol: string | null = null
let chatRatio = DEFAULT_CHAT_RATIO
let chatCollapsed = false
let widget: TerminalWidget | null = null
const listeners = new Set<() => void>()

const subscribe = (listener: () => void) => {
	listeners.add(listener)
	return () => {
		listeners.delete(listener)
	}
}

const notify = () => {
	for (const listener of listeners) listener()
}

export function setTerminalViewOpen(next: boolean, nextSymbol?: string) {
	if (nextSymbol) requestedSymbol = nextSymbol
	if (next === isOpen && (!nextSymbol || nextSymbol === symbol)) return
	isOpen = next
	if (nextSymbol) symbol = nextSymbol
	notify()
}

export const withTerminalView = (href: string) => (isOpen ? toTerminalPath(href) : href)

export function openTerminalHome() {
	void Router.push(TERMINAL_PATH)
}

export function leaveTerminalForChatHome() {
	void Router.push('/ai/chat')
}

// Read on the first client snapshot: reading localStorage at module scope would break hydration. The server
// snapshot renders the defaults, and useSyncExternalStore moves to the stored layout once hydrated.
let restoredLayout = false
function restoreStoredLayout() {
	if (restoredLayout) return
	restoredLayout = true
	const stored = readStored()
	chatRatio = clampChatRatio(stored.chatRatio ?? DEFAULT_CHAT_RATIO)
	chatCollapsed = stored.chatCollapsed === true
}

export function setTerminalChatRatio(next: number) {
	if (next === chatRatio) return
	chatRatio = next
	writeStored({ chatRatio: next })
	notify()
}

export function setTerminalChatCollapsed(next: boolean) {
	if (next === chatCollapsed) return
	chatCollapsed = next
	writeStored({ chatCollapsed: next })
	notify()
}

export const chartTicker = (chart: Pick<TerminalChart, 'symbol' | 'symbolExt'>) =>
	chart.symbolExt()?.ticker ?? chart.symbol()

export function setTerminalSymbol(next: string) {
	if (next === symbol) return
	symbol = next
	notify()
}

/**
 * A saved layout carries its own symbol, so the widget is only told which symbol to open when
 * something outside the chart asked for one — a `?symbol=` link, or a restored session. The request
 * stands until a chart has opened on it, because a widget effect that is torn down before then
 * (strict mode runs it twice) must not take it along. After that, a rebuilt widget keeps whatever
 * the layout restored.
 */
export const peekRequestedTerminalSymbol = (): string | null => requestedSymbol

export function settleRequestedTerminalSymbol(shown: string) {
	if (requestedSymbol === shown) requestedSymbol = null
}

export const getTerminalSymbol = () => symbol

export const getTerminalViewOpen = () => isOpen

// takeClientScreenshot and the drawing replay live on the widget, not on the chart the panel keeps.
export function setTerminalWidget(next: TerminalWidget | null) {
	widget = next
}

export const getTerminalWidget = () => widget

export function useTerminalEnabled() {
	const { user } = useAuthContext()
	return !!user?.flags?.is_llama
}

export function useTerminalViewOpen() {
	return useSyncExternalStore(
		subscribe,
		() => isOpen,
		() => false
	)
}

export function useTerminalSymbol() {
	return useSyncExternalStore(
		subscribe,
		() => symbol,
		() => 'HYPE'
	)
}

export function useTerminalChatRatio() {
	return useSyncExternalStore(
		subscribe,
		() => {
			restoreStoredLayout()
			return chatRatio
		},
		() => DEFAULT_CHAT_RATIO
	)
}

export function useTerminalChatCollapsed() {
	return useSyncExternalStore(
		subscribe,
		() => {
			restoreStoredLayout()
			return chatCollapsed
		},
		() => false
	)
}
