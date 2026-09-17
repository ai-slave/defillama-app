/** The three views of a platform page: `?view=` names one; Assets is the default and stays out of the URL. */
export const RWA_PLATFORM_VIEWS = ['information', 'assets', 'compliance'] as const
export type RWAPlatformView = (typeof RWA_PLATFORM_VIEWS)[number]
export const RWA_PLATFORM_VIEW_QUERY_KEY = 'view'
export const RWA_PLATFORM_DEFAULT_VIEW: RWAPlatformView = 'assets'

/** Strip order: what the platform is, what it holds, how each asset is gated. */
export const RWA_PLATFORM_VIEW_OPTIONS: ReadonlyArray<{ value: RWAPlatformView; label: string }> = [
	{ value: 'information', label: 'Information' },
	{ value: 'assets', label: 'Assets' },
	{ value: 'compliance', label: 'Compliance' }
]

export function parseRwaPlatformView(value: string | Array<string> | undefined): RWAPlatformView {
	const single = Array.isArray(value) ? value[0] : value
	const view = RWA_PLATFORM_VIEWS.find((option) => option === single)
	return view ?? RWA_PLATFORM_DEFAULT_VIEW
}

export function getRwaPlatformViewQuery(view: RWAPlatformView): string | undefined {
	return view === RWA_PLATFORM_DEFAULT_VIEW ? undefined : view
}
