import type { ReactNode } from 'react'
import { ProtocolChainsHovercard } from '~/components/ProtocolChainsHovercard'
import { Button } from '~/ui/Button'
import { Hovercard } from '~/ui/Hovercard'
import { Icon } from '~/ui/Icon'
import { QuestionHelper } from '~/ui/QuestionHelper'
import { TextLink } from '~/ui/TextLink'
import { Definition, Tooltip } from '~/ui/Tooltip'
import { Cell, Example, type Family, type KnobValues, NotApplicable, REST_HOVER_FOCUS, StateGrid } from '../shared'

const DEFINITION = "Total value locked in the protocol's contracts."

function IconTooltip({ disabled }: { disabled?: boolean }) {
	return (
		<Tooltip
			content="Settings"
			render={
				<Button
					variant="ghost"
					size="md"
					square
					aria-label="Settings"
					disabled={disabled}
					accessibleWhenDisabled={disabled}
				/>
			}
		>
			<Icon name="settings" className="size-4" aria-hidden />
		</Tooltip>
	)
}

function TextTooltip() {
	return (
		<Definition content={DEFINITION} className="label-sm text-secondary">
			Total value locked
		</Definition>
	)
}

const UTILIZATION = [82, 47, 15]

// Fill bars a reader sweeps down a column: with `instant` each bar's value shows as the pointer reaches it.
function InstantBars({ instant }: { instant: boolean }) {
	return (
		<div className="flex w-32 flex-col gap-2">
			{UTILIZATION.map((percent) => (
				<Tooltip key={percent} instant={instant} placement="top" content={`${percent}% utilized`} className="w-full">
					<span className="h-1.5 w-full overflow-hidden rounded-full bg-skeleton">
						<span className="block h-full rounded-full bg-brand" style={{ width: `${percent}%` }} />
					</span>
				</Tooltip>
			))}
		</div>
	)
}

type HovercardWidth = 'fit' | 'md' | 'lg'

// Each width with the content it is for: a short list hugs it (fit), prose takes md, a dense breakdown lg.
const HOVERCARD_CONTENT: Record<HovercardWidth, ReactNode> = {
	fit: (
		<dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-1">
			<dt className="text-secondary">Ethereum</dt>
			<dd className="text-right tabular-nums">$8.1b</dd>
			<dt className="text-secondary">Arbitrum</dt>
			<dd className="text-right tabular-nums">$2.4b</dd>
			<dt className="text-secondary">Base</dt>
			<dd className="text-right tabular-nums">$1.5b</dd>
		</dl>
	),
	md: (
		<span className="flex flex-col gap-1">
			<span className="label-md">Total value locked</span>
			<span className="text-secondary">
				The value of assets deposited in the protocol&rsquo;s contracts, priced in USD.
			</span>
		</span>
	),
	lg: (
		<dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1">
			<dt className="text-secondary">Supplied</dt>
			<dd className="text-right tabular-nums">$21.4b</dd>
			<dt className="text-secondary">Borrowed</dt>
			<dd className="text-right tabular-nums">−$9.8b</dd>
			<dt className="text-secondary">Staked in Safety Module</dt>
			<dd className="text-right tabular-nums">$412m</dd>
			<dt className="label-md">Total value locked</dt>
			<dd className="text-right label-md tabular-nums">$12.0b</dd>
		</dl>
	)
}

function TextHovercard({ width = 'md' }: { width?: HovercardWidth }) {
	return (
		<Hovercard definition width={width} content={HOVERCARD_CONTENT[width]}>
			Total value locked
		</Hovercard>
	)
}

function ButtonHovercard({ width = 'md' }: { width?: HovercardWidth }) {
	return (
		<Hovercard render={<Button variant="secondary" size="md" />} width={width} content={HOVERCARD_CONTENT[width]}>
			TVL breakdown
		</Hovercard>
	)
}

// A link keeps its click, so the card opens on hover or from the Show details disclosure after it.
function LinkHovercard({ width = 'md' }: { width?: HovercardWidth }) {
	return (
		<Hovercard
			render={<TextLink href="/protocol/aave-v3" />}
			showOnClick={false}
			width={width}
			content={HOVERCARD_CONTENT[width]}
		>
			Aave V3
		</Hovercard>
	)
}

const HOVERCARD_ANCHORS = { text: TextHovercard, button: ButtonHovercard, link: LinkHovercard }

function ClippedTooltips() {
	const name = 'Aave V3 lending markets on Ethereum'
	return (
		<div className="flex flex-col gap-2">
			{(['w-72', 'w-36'] as const).map((width) => (
				<span key={width} className={`flex ${width} body-sm text-primary`}>
					<Tooltip content={name} onlyWhenClipped render={<span className="block max-w-full truncate" />}>
						{name}
					</Tooltip>
				</span>
			))}
		</div>
	)
}

function DefinitionDemo({ values }: { values: KnobValues }) {
	const content = values.content === 'empty' ? null : DEFINITION
	if (values.as === 'span')
		return (
			<p className="max-w-xs body-sm text-secondary">
				Fees count toward{' '}
				<Definition as="span" content={content}>
					total value locked
				</Definition>{' '}
				only once they are deposited.
			</p>
		)
	if (values.as === 'dt')
		return (
			<dl className="grid w-56 grid-cols-[1fr_auto] gap-x-4 body-sm">
				<Definition as="dt" content={content} className="text-secondary">
					TVL
				</Definition>
				<dd className="text-right text-primary tabular-nums">$12.0b</dd>
			</dl>
		)
	if (values.as === 'h3')
		return (
			<Definition as="h3" content={content} className="heading-xs text-primary">
				Total value locked
			</Definition>
		)
	return (
		<span className="flex w-56 items-center justify-between body-sm">
			<Definition content={content} className="text-secondary">
				TVL
			</Definition>
			<span className="text-primary tabular-nums">$12.0b</span>
		</span>
	)
}

export const definitions: Family = {
	id: 'definitions',
	title: 'Definitions and hover help',
	parts: [
		{
			name: 'Tooltip',
			source: 'src/ui/Tooltip.tsx',
			knobs: [{ name: 'anchor', values: ['icon button', 'text'], prop: false }],
			note: 'Hover the anchor, or Tab to it: the tooltip opens after a short delay. Focus that code moves (a surface opening, a dialog closing) leaves it closed. The text anchor is a Definition.',
			render: (values) => (values.anchor === 'text' ? <TextTooltip /> : <IconTooltip />),
			states: () => (
				<>
					<Example
						name="Instant"
						prop="instant"
						note="Sweep the pointer down each column: with instant (right) every bar shows its value at once; without it (left) each waits for the delay."
					>
						<div className="flex gap-8">
							<InstantBars instant={false} />
							<InstantBars instant />
						</div>
					</Example>
					<Example
						name="Only when clipped"
						prop="onlyWhenClipped"
						note="The same name in a wide and a narrow cell: only the cut-off one opens a tooltip with the full value."
					>
						<ClippedTooltips />
					</Example>
					<Example name="Anchors">
						<StateGrid
							columns={['Rest', 'Hover', 'Focus', 'Disabled']}
							rows={[
								[
									'icon button',
									<>
										{REST_HOVER_FOCUS.map((force) => (
											<Cell key={force ?? 'rest'} force={force}>
												<IconTooltip />
											</Cell>
										))}
										<IconTooltip disabled />
									</>
								],
								[
									'text',
									<>
										{REST_HOVER_FOCUS.map((force) => (
											<Cell key={force ?? 'rest'} force={force}>
												<TextTooltip />
											</Cell>
										))}
										<NotApplicable />
									</>
								]
							]}
						/>
					</Example>
				</>
			)
		},
		{
			name: 'Definition',
			source: 'src/ui/Tooltip.tsx',
			knobs: [
				{ name: 'as', values: ['none', 'span', 'dt', 'h3'], default: 'none' },
				{ name: 'content', values: ['text', 'empty'], default: 'text', prop: false }
			],
			note: 'Tab to the dotted text or hover it: the definition opens. as keeps the element the text already is: a span in a sentence, a dt in a list, a heading. With empty content the text renders plain, with no mark and no tab stop.',
			render: (values) => <DefinitionDemo values={values} />
		},
		{
			name: 'Hovercard',
			source: 'src/ui/Hovercard.tsx',
			knobs: [
				{ name: 'anchor', values: ['text', 'button', 'link'], prop: false },
				{ name: 'width', values: ['fit', 'md', 'lg'], default: 'fit' }
			],
			note: 'Hover the anchor to open the card, and move into it. By keyboard: a button anchor opens on Enter or Space and moves focus into the card; a text or link anchor is followed by a Show details button that appears when focus reaches it. Escape closes the card and returns focus. The link keeps its click (showOnClick off). Each width shows the content it is for: a short list, prose, a breakdown.',
			render: (values) => {
				const Anchor = HOVERCARD_ANCHORS[values.anchor as keyof typeof HOVERCARD_ANCHORS]
				return <Anchor width={values.width as HovercardWidth} />
			},
			states: () => (
				<Example name="Interaction">
					<StateGrid
						columns={['Rest', 'Hover', 'Focus']}
						rows={(['text', 'button', 'link'] as const).map((anchor) => {
							const Anchor = HOVERCARD_ANCHORS[anchor]
							return [
								anchor,
								<>
									{REST_HOVER_FOCUS.map((force) => (
										<Cell key={force ?? 'rest'} force={force}>
											<Anchor />
										</Cell>
									))}
								</>
							]
						})}
					/>
				</Example>
			)
		},
		{
			name: 'ProtocolChainsHovercard',
			source: 'src/components/ProtocolChainsHovercard.tsx',
			knobs: [{ name: 'chains', values: ['three', 'one'], prop: false }],
			note: 'The logos load from the icon CDN and fall back to the placeholder.',
			render: (values) => (
				<ProtocolChainsHovercard chains={values.chains === 'one' ? ['Ethereum'] : ['Ethereum', 'Arbitrum', 'Base']} />
			)
		},
		{
			name: 'QuestionHelper',
			source: 'src/ui/QuestionHelper.tsx',
			note: 'Hover the icon or Tab to it: the definition opens, and a screen reader hears it as the icon’s name.',
			render: () => (
				<span className="flex items-center gap-1 label-sm text-primary">
					TVL
					<QuestionHelper text={DEFINITION} />
				</span>
			),
			states: () => (
				<Example name="Interaction">
					<StateGrid
						columns={['Rest', 'Focus']}
						rows={[
							[
								'beside a label',
								<>
									{([undefined, 'focus-visible'] as const).map((force) => (
										<span key={force ?? 'rest'} className="flex items-center gap-1 label-sm text-primary">
											TVL
											<Cell force={force}>
												<QuestionHelper text={DEFINITION} />
											</Cell>
										</span>
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
