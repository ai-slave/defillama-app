import { useState } from 'react'
import { BasicLink } from '~/components/Link'
import { useDarkModeManager } from '~/contexts/LocalStorage'
import { RailItem } from '~/ui/RailItem'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { buttons } from './components/buttons'
import { charts } from './components/charts'
import { chips } from './components/chips'
import { definitions } from './components/definitions'
import { dialogs } from './components/dialogs'
import { fields } from './components/fields'
import { menus } from './components/menus'
import { navigation } from './components/navigation'
import { pickers } from './components/pickers'
import { selection } from './components/selection'
import { stats } from './components/stats'
import { status } from './components/status'
import { surfaces } from './components/surfaces'
import { tables } from './components/tables'
import { time } from './components/time'
import type { ComponentRow } from './componentTable'
import { FamilyPage } from './FamilyPage'
import { mountForcedStates } from './forcedStates'
import { chartPalette, color, colorRamps } from './foundations/color'
import { elevation } from './foundations/elevation'
import { icons } from './foundations/icons'
import { interactionStates } from './foundations/interaction'
import { shape } from './foundations/shape'
import { spacing } from './foundations/spacing'
import { typography } from './foundations/type'
import { ExampleLevel, type Family, type Foundation, SplitContext } from './shared'

/* ----------------------------------------------------------------------------
   The design system page (/dev/design-system, development only): the tokens
   (foundations) and every finished src/ui part, plus the src/components parts
   design.md's "Which component for which job" table names, in every variant
   and state, in light, dark or both side by side, so drift shows up next to
   the reference.

   The rail lists each foundation and each family of parts (buttons, pickers,
   dialogs…); each is its own path (/dev/design-system/pickers), so the server
   renders the page the URL names, and a part is a plain anchor on it
   (#virtualized-select). /dev/design-system itself stacks every page ("All"). A family page (./FamilyPage.tsx) opens with the design.md rows
   that pick between its parts, read from design.md by getStaticProps, then
   gives each part a playground, its state matrices and its DoDont pairs. A
   family is a Family entry (./shared.tsx) in its file under ./components; a
   foundation is a Foundation in ./foundations. Demos never restate the rules.
   Hover, focus and pressed are forced by ./forcedStates.ts; Show anatomy
   outlines the regions a demo marks (./anatomy.tsx). A state only a phone
   shows (sheet rows, phone drawers) gets a one-line note, not a phone frame.
   ./__tests__/coverage.test.ts fails when a part is missing from the page,
   names a file that does not exist, or is named by no design.md row.
---------------------------------------------------------------------------- */

const FOUNDATIONS: ReadonlyArray<Foundation> = [
	color,
	colorRamps,
	chartPalette,
	typography,
	spacing,
	shape,
	elevation,
	interactionStates,
	icons
]

const FAMILIES: ReadonlyArray<Family> = [
	buttons,
	selection,
	pickers,
	fields,
	navigation,
	menus,
	dialogs,
	definitions,
	chips,
	surfaces,
	tables,
	charts,
	stats,
	status,
	time
]

/** Every path under /dev/design-system: a foundation's or a family's id. */
export const DESIGN_SYSTEM_PAGES = [...FOUNDATIONS, ...FAMILIES].map((item) => item.id)

type ThemeView = 'light' | 'dark' | 'both'
const THEME_VIEWS = [
	{ value: 'light', label: 'Light' },
	{ value: 'dark', label: 'Dark' },
	{ value: 'both', label: 'Side by side' }
] as const

function FoundationView({ foundation }: { foundation: Foundation }) {
	const Overview = foundation.overview
	return (
		<article className="flex flex-col gap-6">
			<header className="flex flex-col gap-1">
				<h2 className="heading-lg text-primary">{foundation.name}</h2>
				<p className="mono-sm text-tertiary">{foundation.source}</p>
			</header>
			<ExampleLevel value="h3">
				<div className="grid grid-cols-1 gap-x-6 gap-y-10 xl:grid-cols-2">
					<Overview />
				</div>
			</ExampleLevel>
		</article>
	)
}

function railLink(path: string, label: string, active: boolean) {
	return (
		<RailItem
			key={path}
			as={BasicLink}
			href={`/dev/design-system${path}`}
			active={active}
			aria-current={active ? 'page' : undefined}
		>
			{label}
		</RailItem>
	)
}

/** `page` is a path from DESIGN_SYSTEM_PAGES, or null for All. */
export function DesignSystem({ page, rows }: { page: string | null; rows: ReadonlyArray<ComponentRow> }) {
	const [isDarkMode, toggleDarkMode] = useDarkModeManager()
	const [split, setSplit] = useState(false)
	const current =
		page === null ? null : (FOUNDATIONS.find((item) => item.id === page) ?? FAMILIES.find((item) => item.id === page))
	const view: ThemeView = split ? 'both' : isDarkMode ? 'dark' : 'light'
	// Light and Side by side render the page in light; Dark switches the app's own theme, as its toggle does.
	const setView = (next: ThemeView) => {
		setSplit(next === 'both')
		if ((next === 'dark') !== isDarkMode) toggleDarkMode()
	}
	// The token readouts measure on mount, so a theme change remounts the foundations to measure again. Families keep
	// their knob values and scroll position.
	const foundationView = (item: Foundation) => <FoundationView key={`${item.id}-${view}`} foundation={item} />
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
			<div className="mx-auto flex max-w-[1760px] flex-col gap-x-10 px-6 lg:flex-row">
				{/* Below lg the rail sits above the page as a short scrolling list. */}
				<nav
					aria-label="Pages"
					className="flex shrink-0 flex-col gap-6 overflow-y-auto border-subtle py-6 max-lg:max-h-64 max-lg:border-b lg:sticky lg:top-14 lg:h-[calc(100dvh-3.5rem)] lg:w-52 lg:py-8"
				>
					{railLink('', 'All', current === null)}
					<div className="flex flex-col gap-0.5">
						<span className="px-3 pb-1 label-xs tracking-wide text-tertiary uppercase">Foundations</span>
						{FOUNDATIONS.map((item) => railLink(`/${item.id}`, item.name, item === current))}
					</div>
					<div className="flex flex-col gap-0.5">
						<span className="px-3 pb-1 label-xs tracking-wide text-tertiary uppercase">Components</span>
						{FAMILIES.map((item) => railLink(`/${item.id}`, item.title, item === current))}
					</div>
				</nav>
				<SplitContext value={split}>
					<main className="flex min-w-0 flex-1 flex-col gap-24 pt-8 pb-24">
						{current === null ? (
							<>
								{FOUNDATIONS.map(foundationView)}
								{FAMILIES.map((item) => (
									<FamilyPage key={item.id} family={item} rows={rows} />
								))}
							</>
						) : 'overview' in current ? (
							foundationView(current)
						) : (
							<FamilyPage key={current.id} family={current} rows={rows} />
						)}
					</main>
				</SplitContext>
			</div>
		</div>
	)
}
