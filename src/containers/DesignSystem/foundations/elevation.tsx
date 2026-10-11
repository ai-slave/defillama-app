import { Example, type Foundation } from '../shared'

// Levels and uses as design.md's elevation table states them.
const ELEVATIONS = [
	['none', 'none', 'Cards, panels, buttons and everything in the page flow; hover uses hover-wash-card, never a lift'],
	[
		'raised',
		'var(--shadow-raised)',
		'In the flow but distinct: a switch knob, a sticky table header, a hero card on a marketing landing'
	],
	[
		'overlay',
		'var(--shadow-overlay)',
		'Floats over nearby content: menus, popovers, tooltips, hovercards, floating toolbars and buttons'
	],
	['dialog', 'var(--shadow-dialog)', 'Over the whole UI: dialogs, sheets, modals, full-screen overlays']
] as const

function ElevationOverview() {
	return (
		<Example
			wide
			name="Shadows"
			note="design.md “Tokens”, elevation table. Picked by distance from the page; dark mode carries elevation with surface lift as well."
		>
			<div className="grid grid-cols-1 gap-6 sm:grid-cols-4">
				{ELEVATIONS.map(([level, shadow, use]) => (
					<div key={level} className="flex flex-col gap-2">
						<span className="h-24 rounded-xl border border-subtle bg-overlay" style={{ boxShadow: shadow }} />
						<span className="mono-sm text-primary">{level === 'none' ? 'none' : `--shadow-${level}`}</span>
						<span className="body-xs text-tertiary">{use}</span>
					</div>
				))}
			</div>
		</Example>
	)
}

export const elevation: Foundation = {
	id: 'elevation',
	name: 'Elevation',
	source: 'src/styles/semantics.css',
	overview: ElevationOverview
}
