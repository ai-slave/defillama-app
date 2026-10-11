import { type ReactNode, useState } from 'react'
import { CHART_COLORS } from '~/constants/colors'
import { Button } from '~/ui/Button'
import { CountBadge } from '~/ui/CountBadge'
import { Icon } from '~/ui/Icon'
import { Keycap } from '~/ui/Keycap'
import { MetricChip, metricOptionChipMdStyles, metricOptionChipStyles, metricSeriesToggleStyles } from '~/ui/MetricChip'
import { PromoBadge } from '~/ui/PromoBadge'
import { type Status, StatusBadge, StatusDot } from '~/ui/StatusBadge'
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

const RECIPES = [
	['metricOptionChipStyles', metricOptionChipStyles, 'Fees'],
	['metricOptionChipMdStyles', metricOptionChipMdStyles, 'Fees'],
	['metricSeriesToggleStyles', metricSeriesToggleStyles, 'Volume']
] as const

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
						note="MetricChip has no selected state; the recipes show selected as data-active."
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
								...RECIPES.map(([name, className, label]): [string, ReactNode] => [
									name,
									<>
										{REST_HOVER_FOCUS.map((force) => (
											<Cell key={force ?? 'rest'} force={force}>
												<button type="button" className={className}>
													{label}
												</button>
											</Cell>
										))}
										<button type="button" className={className} data-active="true">
											{label}
										</button>
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
			name: 'PromoBadge',
			source: 'src/ui/PromoBadge.tsx',
			knobs: [{ name: 'icon', values: ['none', 'sparkles', 'file-lock-2'], default: 'none' }],
			render: (values) => (
				<PromoBadge icon={values.icon === 'none' ? undefined : (values.icon as 'sparkles' | 'file-lock-2')}>
					Try free
				</PromoBadge>
			)
		},
		{
			name: 'StatusBadge',
			source: 'src/ui/StatusBadge.tsx',
			knobs: [
				{ name: 'status', values: ['good', 'caution', 'bad', 'neutral'] },
				{ name: 'tooltip', boolean: true, prop: false }
			],
			render: (values) => {
				const status = values.status as Status
				return (
					<StatusBadge status={status} tooltip={values.tooltip ? 'Two of five venues report' : undefined}>
						{STATUSES.find(([key]) => key === status)[1]}
					</StatusBadge>
				)
			},
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
			render: () => (
				<span className="flex items-center gap-1 label-sm text-primary">
					Chains <CountBadge count={3} />
				</span>
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
			name: 'Tag',
			source: 'src/ui/Tag.tsx',
			render: () => <Tag>Lending</Tag>
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
