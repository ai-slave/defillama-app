import { useState } from 'react'
import { useDarkModeManager } from '~/contexts/LocalStorage'
import { SegmentedControl } from '~/ui/SegmentedControl'
import {
	ActionsGroup,
	ChipsGroup,
	FeedbackGroup,
	FieldsGroup,
	NavigationGroup,
	OverlaysGroup,
	SelectionGroup,
	SurfacesGroup
} from './components'
import { mountForcedStates } from './forcedStates'
import {
	ChartPaletteGroup,
	ColourGroup,
	ElevationGroup,
	IconsGroup,
	RampsGroup,
	ShapeGroup,
	TypeGroup
} from './foundations'
import { SplitContext } from './shared'

/* ----------------------------------------------------------------------------
   The design system page (/dev/design-system, development only): the tokens
   (foundations) and every src/ui control in every variant and state, in light,
   dark or both side by side, so a review is one page and drift shows up next
   to the reference. Component groups follow the job (design.md "Which
   component for which job"); every demo is an Example that names what it
   shows. Hover, focus and pressed are forced by ./forcedStates.ts. A new
   token, variant, size or state adds its Example here in the same change.
---------------------------------------------------------------------------- */

const CONTENTS = [
	{
		title: 'Foundations',
		links: [
			['colour', 'Colour'],
			['ramps', 'Colour ramps'],
			['chart-palette', 'Chart palette'],
			['type', 'Type'],
			['shape', 'Shape'],
			['elevation', 'Elevation'],
			['icons', 'Icons']
		]
	},
	{
		title: 'Components',
		links: [
			['actions', 'Actions'],
			['navigation', 'Navigation and choice'],
			['fields', 'Fields'],
			['selection', 'Selection'],
			['chips', 'Chips and badges'],
			['feedback', 'Feedback'],
			['surfaces', 'Surfaces'],
			['overlays', 'Overlays']
		]
	}
] as const

type ThemeView = 'light' | 'dark' | 'both'
const THEME_VIEWS = [
	{ value: 'light', label: 'Light' },
	{ value: 'dark', label: 'Dark' },
	{ value: 'both', label: 'Side by side' }
] as const

export function DesignSystem() {
	const [isDarkMode, toggleDarkMode] = useDarkModeManager()
	const [split, setSplit] = useState(false)
	const view: ThemeView = split ? 'both' : isDarkMode ? 'dark' : 'light'
	// Light and Side by side render the page in light; Dark switches the app's own theme, as its toggle does.
	const setView = (next: ThemeView) => {
		setSplit(next === 'both')
		if ((next === 'dark') !== isDarkMode) toggleDarkMode()
	}
	return (
		<div ref={mountForcedStates} className="col-span-full min-h-screen bg-page text-primary">
			<header className="sticky top-[env(safe-area-inset-top,0px)] z-30 border-b border-subtle bg-page-glass backdrop-blur">
				<div className="mx-auto flex min-h-14 max-w-[1760px] flex-wrap items-center gap-x-4 gap-y-2 px-6 py-2">
					<div className="mr-auto flex flex-wrap items-baseline gap-x-2">
						<h1 className="heading-xs text-primary">Design system</h1>
						<span className="body-sm text-tertiary">tokens and src/ui components · development only</span>
					</div>
					<SegmentedControl
						label="Theme"
						options={THEME_VIEWS}
						value={view}
						onValueChange={setView}
						variant="default"
						size="md"
					/>
				</div>
			</header>
			<div className="mx-auto flex max-w-[1760px] gap-10 px-6">
				<nav
					aria-label="Contents"
					className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-52 shrink-0 flex-col gap-6 overflow-y-auto py-8 lg:flex"
				>
					{CONTENTS.map((group) => (
						<div key={group.title} className="flex flex-col gap-1">
							<span className="px-2 pb-1 label-xs tracking-wide text-tertiary uppercase">{group.title}</span>
							{group.links.map(([id, label]) => (
								<a
									key={id}
									href={`#${id}`}
									className="rounded-md px-2 py-1 label-sm text-secondary hover:bg-hover-row hover:text-primary focus-visible:bg-hover-row focus-visible:text-primary"
								>
									{label}
								</a>
							))}
						</div>
					))}
				</nav>
				<SplitContext value={split}>
					{/* Keyed by the view: the token readouts measure on mount, so a theme change measures again. */}
					<main key={view} className="flex min-w-0 flex-1 flex-col gap-16 pt-8 pb-24">
						<ColourGroup />
						<RampsGroup />
						<ChartPaletteGroup />
						<TypeGroup />
						<ShapeGroup />
						<ElevationGroup />
						<IconsGroup />
						<ActionsGroup />
						<NavigationGroup />
						<FieldsGroup />
						<SelectionGroup />
						<ChipsGroup />
						<FeedbackGroup />
						<SurfacesGroup />
						<OverlaysGroup />
					</main>
				</SplitContext>
			</div>
		</div>
	)
}
