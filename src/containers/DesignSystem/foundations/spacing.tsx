import { Example, type Foundation } from '../shared'

// Roles and steps as design.md's spacing table states them. The step is the class itself, written out so Tailwind sees it.
const GAPS = [
	['Icon to text inside a control', 'gap-1', '4px'],
	['Icon to text, tight', 'gap-0.5', '2px'],
	['Dense control cluster', 'gap-1.5', '6px'],
	['Between toolbar groups', 'gap-2', '8px'],
	['Between cards, panels and tables', 'gap-2', '8px'],
	['Prose internals in a directory card', 'gap-3', '12px'],
	['Card sections', 'gap-6', '24px']
] as const

const INSETS = [
	['Panel header', 'px-4 py-3', '16px / 12px'],
	['Toolbar above a chart', 'px-2 pt-2 pb-0', '8px / 8px / 0'],
	['Toolbar above a table', 'p-2', '8px'],
	['Popover and menu row', 'px-3 py-2', '12px / 8px']
] as const

const BOX = 'size-6 rounded-sm border border-brand bg-brand-faint'

function SpacingOverview() {
	return (
		<>
			<Example wide name="Gaps" note="design.md “Spacing and radius”. Two boxes separated by the gap each role uses.">
				<div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
					{GAPS.map(([role, step, size]) => (
						<div key={role} className="flex flex-col gap-1.5">
							<span className={`flex w-fit items-center ${step}`}>
								<span className={BOX} />
								<span className={BOX} />
							</span>
							<span className="mono-sm text-primary">
								{step} · {size}
							</span>
							<span className="body-xs text-tertiary">{role}</span>
						</div>
					))}
				</div>
			</Example>
			<Example
				wide
				name="Insets"
				note="Padding the role takes; the dashed frame is the padded box. Card padding sm, base and md are drawn under Surfaces."
			>
				<div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
					{INSETS.map(([role, step, size]) => (
						<div key={role} className="flex flex-col gap-1.5">
							<span className={`w-40 border border-dashed border-medium ${step}`}>
								<span className="block h-5 rounded-sm border border-brand bg-brand-faint" />
							</span>
							<span className="mono-sm text-primary">
								{step} · {size}
							</span>
							<span className="body-xs text-tertiary">{role}</span>
						</div>
					))}
				</div>
			</Example>
		</>
	)
}

export const spacing: Foundation = {
	id: 'spacing',
	name: 'Spacing',
	source: 'design.md',
	overview: SpacingOverview
}
