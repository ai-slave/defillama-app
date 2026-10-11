import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { Tooltip } from '~/ui/Tooltip'
import { Example, type Foundation, Row } from '../shared'

// Uses as design.md's radius table states them.
const RADII = [
	['rounded-sm', '4px', 'Chain pills, small chips'],
	['rounded-md', '6px', 'sm buttons, joined toggle groups, tooltips'],
	['rounded-lg', '8px', 'Cards, panels, inputs, md buttons'],
	['rounded-xl', '12px', 'Popovers, menus, dialogs, hovercards'],
	['rounded-full', 'full', 'Filter pills, avatars, round icon buttons']
] as const

const HEIGHTS = [
	['24px', 'sm controls', 'min-h-6'],
	['32px', 'md controls, the default', 'min-h-8'],
	['44px', 'Button lg, and controls in a phone sheet’s rows', 'min-h-11'],
	['56px', 'Dialog headers', 'min-h-14']
] as const

function ShapeOverview() {
	return (
		<>
			<Example
				name="Radius"
				note="design.md “Spacing and radius”. One radius per component type; never mix radii within a view."
			>
				<div className="grid grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] gap-4">
					{RADII.map(([radius, size, use]) => (
						<div key={radius} className="flex flex-col gap-1.5">
							<span className={`h-16 border border-medium bg-surface-elevated-1 ${radius}`} />
							<span className="mono-sm text-primary">
								{radius} · {size}
							</span>
							<span className="body-xs text-tertiary">{use}</span>
						</div>
					))}
				</div>
			</Example>
			<Example name="Control heights" note="One scale; every control in a row shares it.">
				<div className="flex items-end gap-4">
					{HEIGHTS.map(([size, use, height]) => (
						<div key={size} className="flex flex-col gap-1.5">
							<span className={`w-20 rounded-md border border-brand bg-brand-faint ${height}`} />
							<span className="mono-sm text-primary">{size}</span>
							<span className="max-w-24 body-xs text-tertiary">{use}</span>
						</div>
					))}
				</div>
			</Example>
			<Example
				name="Button sizes"
				prop="sm / md / lg"
				note="The same label on each size: sm and md set label-sm, lg sets label-md."
			>
				<Row>
					<Button variant="secondary" size="sm">
						Label
					</Button>
					<Button variant="secondary" size="md">
						Label
					</Button>
					<Button variant="secondary" size="lg">
						Label
					</Button>
					<Tooltip content="Settings" render={<Button variant="secondary" size="sm" square aria-label="Settings" />}>
						<Icon name="settings" className="size-4" aria-hidden />
					</Tooltip>
					<Tooltip content="Settings" render={<Button variant="secondary" size="md" square aria-label="Settings" />}>
						<Icon name="settings" className="size-4" aria-hidden />
					</Tooltip>
					<Tooltip content="Settings" render={<Button variant="secondary" size="lg" square aria-label="Settings" />}>
						<Icon name="settings" className="size-4" aria-hidden />
					</Tooltip>
				</Row>
			</Example>
		</>
	)
}

export const shape: Foundation = {
	id: 'shape',
	name: 'Shape',
	source: 'design.md',
	overview: ShapeOverview
}
