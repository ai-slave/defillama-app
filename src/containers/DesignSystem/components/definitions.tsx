import { ProtocolChainsHovercard } from '~/components/ProtocolChainsHovercard'
import { Button } from '~/ui/Button'
import { Hovercard } from '~/ui/Hovercard'
import { Icon } from '~/ui/Icon'
import { QuestionHelper } from '~/ui/QuestionHelper'
import { Definition, Tooltip } from '~/ui/Tooltip'
import { Cell, Example, type Family, NotApplicable, REST_HOVER_FOCUS, StateGrid } from '../shared'

const DEFINITION = "Total value locked in the protocol's contracts."
const DOTTED = 'cursor-help label-sm text-secondary underline decoration-dotted underline-offset-4'

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

function TextHovercard() {
	return (
		<Hovercard
			className={DOTTED}
			content={
				<span className="flex w-80 max-w-(--popover-available-width) flex-col gap-1">
					<span className="title-md text-primary">Total value locked</span>
					<span className="body-sm text-secondary">
						The value of assets deposited in the protocol's contracts, priced in USD.
					</span>
				</span>
			}
		>
			Total value locked
		</Hovercard>
	)
}

function ButtonHovercard() {
	return (
		<Hovercard
			render={<Button variant="secondary" size="md" />}
			showOnClick={false}
			content={<span className="body-sm text-secondary">Opens the protocol's methodology.</span>}
		>
			Methodology
		</Hovercard>
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
			render: (values) => (values.anchor === 'text' ? <TextTooltip /> : <IconTooltip />),
			states: () => (
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
			)
		},
		{
			name: 'Hovercard',
			source: 'src/ui/Hovercard.tsx',
			knobs: [{ name: 'anchor', values: ['text', 'button'], prop: false }],
			note: 'The card opens on hover, focus or tap; the button keeps its own click action (showOnClick off).',
			render: (values) => (values.anchor === 'button' ? <ButtonHovercard /> : <TextHovercard />),
			states: () => (
				<Example name="Interaction">
					<StateGrid
						columns={['Rest', 'Hover', 'Focus']}
						rows={[
							[
								'text',
								<>
									{REST_HOVER_FOCUS.map((force) => (
										<Cell key={force ?? 'rest'} force={force}>
											<TextHovercard />
										</Cell>
									))}
								</>
							],
							[
								'button',
								<>
									{REST_HOVER_FOCUS.map((force) => (
										<Cell key={force ?? 'rest'} force={force}>
											<ButtonHovercard />
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
