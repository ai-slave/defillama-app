import { Fragment, type ReactNode, useId, useState } from 'react'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { Select } from '~/ui/Select'
import { Switch } from '~/ui/Switch'
import { AnatomyContext } from './anatomy'
import { type ComponentRow, componentsNamedIn } from './componentTable'
import { type Family, Frame, type Knob, type KnobValues, type PartSpec, slug } from './shared'

/* One family's page: its title and the design.md rows that pick between its parts ("Which one", read from design.md
   and never restated), then each part in turn: its header, a playground (the live part, and the knobs that pick its
   variant, size and state), its full state matrices collapsed under "All states", and its DoDont pairs. */

/** The family title and its "Which one" rows: every row whose Use cell names one of `names` in a code span, each
    such name linking to its part below. */
function FamilyIntro({
	title,
	names,
	rows
}: {
	title: string
	names: ReadonlyArray<string>
	rows: ReadonlyArray<ComponentRow>
}) {
	const shown = rows.filter((row) => row.names.some((name) => names.includes(name)))
	return (
		<header className="flex flex-col gap-4">
			<h2 className="heading-lg text-primary">{title}</h2>
			<h3 className="label-md text-primary">Which one</h3>
			<table className="w-full max-w-[120ch] border-collapse text-left body-sm">
				<thead>
					<tr>
						<th scope="col" className="w-2/5 pr-4 pb-2 label-xs tracking-wide text-tertiary uppercase">
							Job
						</th>
						<th scope="col" className="pb-2 label-xs tracking-wide text-tertiary uppercase">
							Use (design.md)
						</th>
					</tr>
				</thead>
				<tbody>
					{shown.map((row) => (
						<tr key={row.job} className="border-t border-subtle align-top">
							<td className="py-2 pr-4 text-primary">{row.job}</td>
							<td className="py-2 text-secondary">
								{row.use.split('`').map((text, index) => {
									const name = index % 2 === 1 ? componentsNamedIn(text).find((named) => names.includes(named)) : null
									const code =
										index % 2 === 1 ? <code className={`mono-sm ${name ? '' : 'text-primary'}`}>{text}</code> : text
									return (
										// oxlint-disable-next-line react/no-array-index-key -- The pieces of one fixed cell.
										<Fragment key={index}>
											{name ? (
												<Button as="a" href={`#${slug(name)}`} variant="inlineLink">
													{code}
												</Button>
											) : (
												code
											)}
										</Fragment>
									)
								})}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</header>
	)
}

function PartHeader({ name, source, note }: { name: string; source: string; note?: string }) {
	return (
		<header className="flex flex-col gap-1">
			<h3 className="heading-sm text-primary">{name}</h3>
			<p className="mono-sm text-tertiary">{source}</p>
			{note ? <p className="max-w-[90ch] body-sm text-secondary">{note}</p> : null}
		</header>
	)
}

/** The JSX the playground shows, for its knob values: a prop knob as the prop (a bare name when a boolean is on,
    `name={false}` when a required boolean is off), left out at its `default` or when an optional boolean is off; a knob
    that is no prop (`prop: false`) as a JSX comment naming it (state: loading). */
function codeLine(name: string, knobs: ReadonlyArray<Knob>, values: KnobValues) {
	let props = ''
	const notes: Array<string> = []
	for (const knob of knobs) {
		const value = values[knob.name]
		if ('required' in knob && value === false) {
			props += ` ${knob.name}={false}`
			continue
		}
		if (value === false || ('values' in knob && value === knob.default)) continue
		if (knob.prop === false) notes.push(value === true ? knob.name : `${knob.name}: ${value}`)
		else props += value === true ? ` ${knob.name}` : ` ${knob.name}="${value}"`
	}
	return `<${name}${props} />${notes.length > 0 ? ` {/* ${notes.join(', ')} */}` : ''}`
}

// More options than this read better in a Select than in a row of segments that scrolls inside its box.
const MAX_SEGMENTS = 5

function Playground({ part }: { part: PartSpec }) {
	const knobs = part.knobs ?? []
	const [values, setValues] = useState(() => {
		const initial: KnobValues = {}
		for (const knob of knobs) initial[knob.name] = 'values' in knob ? knob.values[0] : false
		return initial
	})
	const [anatomy, setAnatomy] = useState(false)
	const propsId = useId()
	const set = (name: string, value: string | boolean) => setValues({ ...values, [name]: value })
	const stage = (
		<AnatomyContext value={anatomy}>
			<Frame wide>
				<div className="flex min-h-12 flex-wrap items-center justify-center">{part.render(values)}</div>
			</Frame>
		</AnatomyContext>
	)
	if (knobs.length === 0 && !part.anatomy) return stage
	return (
		<div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
			<div className="flex min-w-0 flex-col gap-2">
				{stage}
				{knobs.length > 0 ? (
					<code className="mono-sm break-words whitespace-pre-wrap text-secondary">
						{codeLine(part.name, knobs, values)}
					</code>
				) : null}
			</div>
			<div className="flex flex-col gap-4">
				{knobs.length > 0 ? (
					<div role="group" aria-labelledby={propsId} className="flex flex-col gap-3">
						<h4 id={propsId} className="label-md text-primary">
							Props
						</h4>
						{knobs.map((knob) => {
							const name = <code className="mono-sm text-secondary">{knob.name}</code>
							if (!('values' in knob))
								return (
									<div key={knob.name} className="flex items-center justify-between gap-3">
										{name}
										<Switch
											label={knob.name}
											hideLabel
											value={knob.name}
											checked={values[knob.name] === true}
											onChange={() => set(knob.name, !values[knob.name])}
										/>
									</div>
								)
							const value = values[knob.name] as string
							return (
								<div key={knob.name} className="flex flex-col gap-1.5">
									{name}
									{knob.values.length > MAX_SEGMENTS ? (
										<Select
											label={value}
											labelType="none"
											heading={knob.name}
											allValues={knob.values}
											selectedValues={value}
											setSelectedValues={(next) => set(knob.name, next)}
											variant="input"
											size="md"
											triggerProps={{ 'aria-label': `${knob.name}: ${value}` }}
										/>
									) : (
										<SegmentedControl
											label={knob.name}
											options={knob.values.map((option) => ({ value: option, label: option }))}
											value={value}
											onValueChange={(next) => set(knob.name, next)}
											variant="default"
											size="sm"
											buttonClassName="mono-sm"
										/>
									)}
								</div>
							)
						})}
					</div>
				) : null}
				{part.anatomy ? (
					<Switch label="Show anatomy" value="anatomy" checked={anatomy} onChange={() => setAnatomy(!anatomy)} />
				) : null}
			</div>
		</div>
	)
}

function AllStates({ states: States }: { states: () => ReactNode }) {
	const [open, setOpen] = useState(false)
	return (
		// design.md names no disclosure part, so this is the native element in the app's chevron pattern (MetricSection,
		// HeroMetric). The matrices mount only while it is open, so a family page does not render them all up front.
		<details className="group/states" onToggle={(event) => setOpen(event.currentTarget.open)}>
			<summary className="flex w-fit items-center gap-1 rounded-md label-md text-secondary hover:text-primary">
				<Icon
					name="chevron-down"
					className="size-4 transition-transform duration-100 group-open/states:rotate-180"
					aria-hidden
				/>
				All states
			</summary>
			{open ? (
				<div className="grid grid-cols-1 gap-x-6 gap-y-10 pt-6 xl:grid-cols-2">
					<States />
				</div>
			) : null}
		</details>
	)
}

function PartSection({ part }: { part: PartSpec }) {
	const Dos = part.dos
	return (
		<article id={slug(part.name)} className="flex scroll-mt-24 flex-col gap-6">
			<PartHeader name={part.name} source={part.source} note={part.note} />
			<Playground part={part} />
			{part.states ? <AllStates states={part.states} /> : null}
			{Dos ? (
				<div className="grid grid-cols-1 gap-x-6 gap-y-10 xl:grid-cols-2">
					<Dos />
				</div>
			) : null}
		</article>
	)
}

export function FamilyPage({ family, rows }: { family: Family; rows: ReadonlyArray<ComponentRow> }) {
	return (
		<div className="flex flex-col gap-16">
			<FamilyIntro title={family.title} names={family.parts.map((part) => part.name)} rows={rows} />
			{family.parts.map((part) => (
				<PartSection key={part.name} part={part} />
			))}
		</div>
	)
}
