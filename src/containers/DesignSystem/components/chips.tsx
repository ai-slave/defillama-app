import { type ReactNode, useState } from 'react'
import { CHART_COLORS } from '~/constants/colors'
import { Button } from '~/ui/Button'
import { CountBadge } from '~/ui/CountBadge'
import { Hovercard } from '~/ui/Hovercard'
import { Icon } from '~/ui/Icon'
import { Keycap } from '~/ui/Keycap'
import { MetaLine } from '~/ui/MetaLine'
import { MetricChip, MetricOptionChip, MetricSeriesToggle } from '~/ui/MetricChip'
import { PromoBadge } from '~/ui/PromoBadge'
import { type Status, StatusBadge, StatusDot } from '~/ui/StatusBadge'
import { TabLink } from '~/ui/Tabs'
import { Tag, TagButton, TagLink } from '~/ui/Tag'
import { Cell, Example, type Family, type KnobValues, NotApplicable, REST_HOVER_FOCUS, Row, StateGrid } from '../shared'

const CHIP_METRICS = ['TVL', 'Fees', 'Volume'] as const
const STATUSES: ReadonlyArray<[Status, string]> = [
	['good', 'Live'],
	['caution', 'Partial'],
	['bad', 'Failed'],
	['neutral', 'Unknown']
]

// Removing a chip moves focus to its neighbor (MetricChip), so the row keeps its state to show it.
function RemovableChips() {
	const [removed, setRemoved] = useState<ReadonlyArray<string>>([])
	return (
		<Row>
			{CHIP_METRICS.map((label, index) =>
				removed.includes(label) ? null : (
					<MetricChip
						key={label}
						label={label}
						color={CHART_COLORS[index]}
						onRemove={() => setRemoved((current) => [...current, label])}
					/>
				)
			)}
			{removed.length > 0 ? (
				<Button variant="secondary" size="sm" onClick={() => setRemoved([])}>
					Restore
				</Button>
			) : null}
		</Row>
	)
}

const OPTION_CHIPS: ReadonlyArray<[string, (active?: boolean) => ReactNode]> = [
	[
		'MetricOptionChip sm',
		(active) => (
			<MetricOptionChip size="sm" data-active={active}>
				Fees
			</MetricOptionChip>
		)
	],
	[
		'MetricOptionChip md',
		(active) => (
			<MetricOptionChip size="md" data-active={active}>
				Fees
			</MetricOptionChip>
		)
	],
	['MetricSeriesToggle', (active) => <MetricSeriesToggle data-active={active}>Volume</MetricSeriesToggle>]
]

const OPTION_LABELS = ['TVL', 'Fees', 'Volume', 'Revenue'] as const

// Picked is the demo's own state: the caller keeps data-active and aria-pressed in step.
function OptionChipsDemo({ values }: { values: KnobValues }) {
	const [picked, setPicked] = useState<ReadonlyArray<string>>(['Fees'])
	return (
		<Row>
			{OPTION_LABELS.map((label) => {
				const on = picked.includes(label)
				return (
					<MetricOptionChip
						key={label}
						size={values.size as 'sm' | 'md'}
						data-active={on}
						aria-pressed={on}
						onClick={() => setPicked(on ? picked.filter((item) => item !== label) : [...picked, label])}
					>
						{label}
					</MetricOptionChip>
				)
			})}
		</Row>
	)
}

function SeriesTogglesDemo() {
	const [shown, setShown] = useState<ReadonlyArray<string>>(['Volume', 'Fees'])
	return (
		<Row>
			{['Volume', 'Fees', 'Revenue'].map((label) => {
				const on = shown.includes(label)
				return (
					<MetricSeriesToggle
						key={label}
						data-active={on}
						aria-pressed={on}
						onClick={() => setShown(on ? shown.filter((item) => item !== label) : [...shown, label])}
					>
						{label}
					</MetricSeriesToggle>
				)
			})}
		</Row>
	)
}

function StatusBadgeDemo({ values }: { values: KnobValues }) {
	const status = values.status as Status
	const label = STATUSES.find(([key]) => key === status)[1]
	if (values.explains === 'tooltip')
		return (
			<StatusBadge status={status} tooltip="Two of five venues report">
				{label}
			</StatusBadge>
		)
	if (values.explains === 'hovercard')
		return (
			<Hovercard
				render={<StatusBadge status={status} render={<button type="button" />} />}
				width="md"
				content={
					<span className="flex flex-col gap-1">
						<span className="label-md">Venue coverage</span>
						<span className="text-secondary">Two of five venues report volume for this market.</span>
					</span>
				}
			>
				{label}
			</Hovercard>
		)
	return <StatusBadge status={status}>{label}</StatusBadge>
}

const STATUS_TEXT: Record<Status, string> = {
	good: 'All changes saved',
	caution: 'Unsaved changes',
	bad: 'Disconnected',
	neutral: 'Saving'
}

function StatusDotDemo({ values }: { values: KnobValues }) {
	const status = values.status as Status
	const pulse = values.pulse === true
	return values.label === 'prop' ? (
		<StatusDot status={status} pulse={pulse} label={STATUS_TEXT[status]} />
	) : (
		<span className="flex items-center gap-1.5 body-sm text-tertiary">
			<StatusDot status={status} pulse={pulse} />
			{STATUS_TEXT[status]}
		</span>
	)
}

export const chips: Family = {
	id: 'chips',
	title: 'Chips, tags and badges',
	parts: [
		{
			name: 'MetricChip',
			source: 'src/ui/MetricChip.tsx',
			knobs: [
				{ name: 'state', values: ['rest', 'loading'], default: 'rest', prop: false },
				{ name: 'prefix', boolean: true, prop: false }
			],
			render: (values) => (
				<MetricChip
					label="TVL"
					color={CHART_COLORS[0]}
					onRemove={() => {}}
					loading={values.state === 'loading'}
					prefix={values.prefix ? <Icon name="check" className="size-3" aria-hidden /> : undefined}
				/>
			),
			states: () => (
				<>
					<Example
						wide
						name="Interaction"
						note="The three chart chips side by side. MetricChip has no selected state; the option chip and the series toggle show selected as data-active."
					>
						<StateGrid
							columns={['Rest', 'Hover', 'Focus', 'Selected']}
							rows={[
								[
									'MetricChip',
									<>
										{REST_HOVER_FOCUS.map((force) => (
											<Cell key={force ?? 'rest'} force={force}>
												<MetricChip label="TVL" color={CHART_COLORS[0]} onRemove={() => {}} />
											</Cell>
										))}
										<NotApplicable />
									</>
								],
								...OPTION_CHIPS.map(([name, chip]): [string, ReactNode] => [
									name,
									<>
										{REST_HOVER_FOCUS.map((force) => (
											<Cell key={force ?? 'rest'} force={force}>
												{chip()}
											</Cell>
										))}
										{chip(true)}
									</>
								])
							]}
						/>
					</Example>
					<Example
						name="Remove"
						prop="onRemove"
						note="Remove a focused chip with Enter: focus moves to the next chip, else the previous."
					>
						<RemovableChips />
					</Example>
				</>
			)
		},
		{
			name: 'MetricOptionChip',
			source: 'src/ui/MetricChip.tsx',
			knobs: [{ name: 'size', values: ['sm', 'md'] }],
			note: 'Click a chip or press Space on it to pick it; picked is the demo’s own state (data-active with aria-pressed). sm sits in dialog chip rows, md beside md controls.',
			render: (values) => <OptionChipsDemo values={values} />
		},
		{
			name: 'MetricSeriesToggle',
			source: 'src/ui/MetricChip.tsx',
			note: 'Click a series or press Space on it to turn it off and on. It keeps the 32px chart-toolbar height and has no ×.',
			render: () => <SeriesTogglesDemo />
		},
		{
			name: 'PromoBadge',
			source: 'src/ui/PromoBadge.tsx',
			knobs: [
				{ name: 'icon', values: ['none', 'sparkles', 'file-lock-2'], default: 'none' },
				{ name: 'href', boolean: true, prop: false }
			],
			note: 'With href the badge is the link itself: Tab to it, and it takes the hover wash.',
			render: (values) => (
				<PromoBadge
					icon={values.icon === 'none' ? undefined : (values.icon as 'sparkles' | 'file-lock-2')}
					href={values.href ? '/subscription' : undefined}
				>
					Try free
				</PromoBadge>
			),
			states: () => (
				<>
					<Example name="Link" prop="href">
						<StateGrid
							columns={['Rest', 'Hover', 'Focus']}
							rows={[
								[
									'href',
									<>
										{REST_HOVER_FOCUS.map((force) => (
											<Cell key={force ?? 'rest'} force={force}>
												<PromoBadge href="/subscription" icon="sparkles">
													New
												</PromoBadge>
											</Cell>
										))}
									</>
								]
							]}
						/>
					</Example>
					<Example name="Inside a control" note="16px tall, so a badge in a button or a tab keeps its row height.">
						<Row>
							<Button size="md">
								Export
								<PromoBadge icon="file-lock-2">Pro</PromoBadge>
							</Button>
							<TabLink href="/yields">
								<span className="inline-flex items-center gap-1.5">
									LlamaAI
									<PromoBadge>New</PromoBadge>
								</span>
							</TabLink>
						</Row>
					</Example>
				</>
			)
		},
		{
			name: 'StatusBadge',
			source: 'src/ui/StatusBadge.tsx',
			knobs: [
				{ name: 'status', values: ['good', 'caution', 'bad', 'neutral'] },
				{ name: 'explains', values: ['none', 'tooltip', 'hovercard'], default: 'none', prop: false }
			],
			note: 'With a tooltip the badge is a tab stop that opens it on hover or focus. As a hovercard anchor it renders a button (render): Enter or Space opens the card and moves focus into it, Escape returns focus to the badge.',
			render: (values) => <StatusBadgeDemo values={values} />,
			states: () => (
				<Example name="Tooltip focus" prop="tooltip" note="The label is focusable; the last badge is forced focused.">
					<Row>
						{STATUSES.map(([status, label]) => (
							<StatusBadge key={status} status={status} tooltip="Two of five venues report">
								{label}
							</StatusBadge>
						))}
						<Cell force="focus-visible">
							<StatusBadge status="caution" tooltip="Two of five venues report">
								Partial
							</StatusBadge>
						</Cell>
					</Row>
				</Example>
			)
		},
		{
			name: 'StatusDot',
			source: 'src/ui/StatusBadge.tsx',
			knobs: [
				{ name: 'status', values: ['good', 'caution', 'bad', 'neutral'] },
				{ name: 'pulse', boolean: true },
				{ name: 'label', values: ['beside text', 'prop'], default: 'beside text', prop: false }
			],
			note: 'Beside text that names the state the dot is hidden from assistive tech; with no text, label names it.',
			render: (values) => <StatusDotDemo values={values} />
		},
		{
			name: 'CountBadge',
			source: 'src/ui/CountBadge.tsx',
			note: 'The count of values a trigger holds; it widens with two digits and keeps its height.',
			render: () => (
				<Row>
					<span className="flex items-center gap-1 label-sm text-primary">
						Chains <CountBadge count={3} />
					</span>
					<Button size="md">
						Filters
						<CountBadge count={12} />
					</Button>
				</Row>
			)
		},
		{
			name: 'Keycap',
			source: 'src/ui/Keycap.tsx',
			render: () => (
				<Row>
					<span className="flex items-center gap-1 body-sm text-tertiary">
						<Keycap>⌘</Keycap>
						<Keycap>↵</Keycap>
						run
					</span>
					<Button variant="primary" size="sm">
						Run
						<span aria-hidden className="flex items-center gap-0.5">
							<Keycap onBrand>⌘</Keycap>
							<Keycap onBrand>↵</Keycap>
						</span>
					</Button>
				</Row>
			)
		},
		{
			name: 'MetaLine',
			source: 'src/ui/MetaLine.tsx',
			render: () => <MetaLine>{['9 cards', '52 views', 'Updated 4d ago']}</MetaLine>,
			states: () => (
				<>
					<Example
						name="Empty items"
						prop="children"
						note="The middle item is null (no author): it drops out with its dot, so the condition stays inline."
					>
						<MetaLine>9 cards{null}Updated 4d ago</MetaLine>
					</Example>
					<Example
						name="An item with weight"
						note="A status brings its own element and color; the line keeps the size."
					>
						<MetaLine>
							<span className="flex items-center gap-1.5 text-secondary">
								<StatusDot status="good" />
								Published
							</span>
							{['3 charts', 'Updated 4d ago']}
						</MetaLine>
					</Example>
				</>
			)
		},
		{
			name: 'Tag',
			source: 'src/ui/Tag.tsx',
			note: 'Read-only: no hover, no tab stop. A set of values in a field is a row of tags.',
			render: () => (
				<dl className="flex flex-col gap-1">
					<dt className="label-sm text-secondary">Reward tokens</dt>
					<dd className="flex flex-wrap gap-1.5">
						<Tag>AAVE</Tag>
						<Tag>stkAAVE</Tag>
						<Tag>GHO</Tag>
					</dd>
				</dl>
			)
		},
		{
			name: 'TagButton',
			source: 'src/ui/Tag.tsx',
			render: () => <TagButton>Lending</TagButton>,
			states: () => (
				<Example name="Interaction">
					<StateGrid
						columns={['Rest', 'Hover', 'Focus']}
						rows={[
							[
								'TagButton',
								<>
									{REST_HOVER_FOCUS.map((force) => (
										<Cell key={force ?? 'rest'} force={force}>
											<TagButton>Lending</TagButton>
										</Cell>
									))}
								</>
							]
						]}
					/>
				</Example>
			)
		},
		{
			name: 'TagLink',
			source: 'src/ui/Tag.tsx',
			knobs: [{ name: 'target', values: ['none', '_blank'], default: 'none' }],
			note: 'Up-right arrow: it opens a new tab; right arrow: it moves within the site.',
			render: (values) =>
				values.target === '_blank' ? (
					<TagLink href="https://github.com/DefiLlama" target="_blank" rel="noopener noreferrer">
						Audit report
					</TagLink>
				) : (
					<TagLink href="/yields">Yields</TagLink>
				),
			states: () => (
				<Example name="Interaction">
					<StateGrid
						columns={['Rest', 'Hover', 'Focus']}
						rows={[
							[
								'internal',
								<>
									{REST_HOVER_FOCUS.map((force) => (
										<Cell key={force ?? 'rest'} force={force}>
											<TagLink href="/yields">Yields</TagLink>
										</Cell>
									))}
								</>
							],
							[
								'target="_blank"',
								<>
									{REST_HOVER_FOCUS.map((force) => (
										<Cell key={force ?? 'rest'} force={force}>
											<TagLink href="https://github.com/DefiLlama" target="_blank" rel="noopener noreferrer">
												Audit report
											</TagLink>
										</Cell>
									))}
								</>
							]
						]}
					/>
				</Example>
			)
		}
	]
}
