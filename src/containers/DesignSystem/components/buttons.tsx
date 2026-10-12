import * as Ariakit from '@ariakit/react'
import { type ReactNode, useState } from 'react'
import { ExternalLinkButton } from '~/components/ExternalLinkButton'
import { BasicLink } from '~/components/Link'
import { Button, ButtonGroup, StableLabel } from '~/ui/Button'
import { CopyHelper } from '~/ui/Copy'
import { FileButton } from '~/ui/FileButton'
import { Icon } from '~/ui/Icon'
import { Menu } from '~/ui/Menu'
import { MenuItem, MenuSurface } from '~/ui/PopoverSurface'
import { BusyGlyph } from '~/ui/Status'
import { Tooltip } from '~/ui/Tooltip'
import { DashedTile, ImageReplaceTile, UploadTile } from '~/ui/UploadTile'
import { DEMO_IMAGE } from '../demoAssets'
import {
	Cell,
	DoDont,
	Example,
	type Family,
	type ForcedState,
	type KnobValues,
	NotApplicable,
	REST_HOVER_FOCUS,
	Row,
	StateGrid
} from '../shared'

const BUTTON_STATES = ['Rest', 'Hover', 'Focus', 'Pressed', 'Selected', 'Disabled', 'Pending'] as const
const BUTTON_VARIANTS = [
	'secondary',
	'primary',
	'outline',
	'destructive',
	'ghost',
	'ghostDestructive',
	'filter',
	'toggle',
	'metricBrowse',
	'floating',
	'overlay',
	'onMedia',
	'onBrand'
] as const
type Variant = (typeof BUTTON_VARIANTS)[number]
const SELECTABLE = new Set<Variant>(['ghost', 'filter', 'toggle'])
const SQUARES: ReadonlyArray<[Variant, ReadonlyArray<'sm' | 'md' | 'lg'>]> = [
	['secondary', ['md', 'sm']],
	['ghost', ['md', 'sm']],
	['ghostDestructive', ['md', 'sm']],
	['primary', ['md', 'sm']],
	['onMedia', ['md']],
	['onBrand', ['lg']]
]

/** The surroundings a variant is built for: the overlay arrow waits for its rail's hover, so its rail is forced
    hovered; onMedia sits on a picture and onBrand on the blue header. */
function Backdrop({ variant, children }: { variant: Variant; children: ReactNode }) {
	if (variant === 'overlay')
		return (
			<Cell force="hover">
				<div className="group/rail flex items-center gap-2">{children}</div>
			</Cell>
		)
	if (variant === 'onMedia')
		return (
			<div
				className="flex items-center gap-2 rounded-md bg-cover bg-center p-1.5"
				style={{ backgroundImage: `url("${DEMO_IMAGE}")` }}
			>
				{children}
			</div>
		)
	if (variant === 'onBrand') return <div className="flex items-center gap-2 rounded-md bg-brand p-1.5">{children}</div>
	return <div className="flex items-center gap-2">{children}</div>
}

/** One cell: the variant at each size, forced into `force` or given the state's props. */
function buttonCell(
	variant: Variant,
	sizes: ReadonlyArray<'sm' | 'md' | 'lg'>,
	square: boolean,
	force?: ForcedState,
	state?: { 'data-active'?: boolean; disabled?: boolean; pending?: boolean; pendingLabel?: string }
) {
	return (
		<Backdrop variant={variant}>
			{sizes.map((size) => (
				<Cell key={size} force={force}>
					{square ? (
						<Tooltip
							content="Settings"
							render={<Button variant={variant} size={size} square aria-label="Settings" {...state} />}
						>
							<Icon name="settings" className="size-4" aria-hidden />
						</Tooltip>
					) : (
						<Button variant={variant} size={size} {...state}>
							Action
						</Button>
					)}
				</Cell>
			))}
		</Backdrop>
	)
}

function stateRow(variant: Variant, sizes: ReadonlyArray<'sm' | 'md' | 'lg'>, square: boolean) {
	return (
		<>
			{buttonCell(variant, sizes, square)}
			{buttonCell(variant, sizes, square, 'hover')}
			{buttonCell(variant, sizes, square, 'focus-visible')}
			{buttonCell(variant, sizes, square, 'active')}
			{SELECTABLE.has(variant) ? (
				buttonCell(variant, sizes, square, undefined, { 'data-active': true })
			) : (
				<NotApplicable />
			)}
			{buttonCell(variant, sizes, square, undefined, { disabled: true })}
			{buttonCell(variant, sizes, square, undefined, { pendingLabel: 'Saving…', pending: true })}
		</>
	)
}

/** The playground's button: the knobs' variant, size and state, with or without an icon, or icon-only. The label
    reserves the busy label's width at rest, as design.md asks of every button that can be pending. */
function playButton(values: KnobValues) {
	const variant = values.variant as Variant
	const size = values.size as 'sm' | 'md' | 'lg'
	const state = {
		pendingLabel: 'Exporting…',
		pending: values.state === 'pending',
		disabled: values.state === 'disabled'
	}
	return (
		<Backdrop variant={variant}>
			{values.square ? (
				<Tooltip
					content="Settings"
					render={
						<Button variant={variant} size={size} square aria-label="Settings" data-anatomy="Button" {...state} />
					}
				>
					<Icon name="settings" className="size-4" aria-hidden data-anatomy="Icon slot" />
				</Tooltip>
			) : (
				<Button variant={variant} size={size} data-anatomy="Button" {...state}>
					{values.icon ? <Icon name="download" className="size-3.5" aria-hidden data-anatomy="Icon slot" /> : null}
					<span data-anatomy="Label">Export</span>
				</Button>
			)}
		</Backdrop>
	)
}

const FORMATS = ['CSV', 'JSON'] as const

function SplitButtonDemo() {
	const menu = Ariakit.useMenuStore<{ format: (typeof FORMATS)[number] }>({ defaultValues: { format: 'CSV' } })
	const { format } = Ariakit.useStoreState(menu, 'values')
	return (
		<ButtonGroup label="Download">
			<Button variant="primary" size="md">
				<Icon name="download-cloud" className="size-3.5" aria-hidden />
				Download {format}
			</Button>
			<Ariakit.MenuProvider store={menu}>
				<Ariakit.MenuButton aria-label="Choose download format" render={<Button variant="primary" size="md" square />}>
					<Icon name="chevron-down" className="size-3.5" aria-hidden />
				</Ariakit.MenuButton>
				<MenuSurface variant="actions">
					{FORMATS.map((option) => (
						<MenuItem kind="radio" key={option} name="format" value={option} hideOnClick>
							{option}
						</MenuItem>
					))}
				</MenuSurface>
			</Ariakit.MenuProvider>
		</ButtonGroup>
	)
}

function StableLabelDemo() {
	const [editing, setEditing] = useState(false)
	return (
		<Row>
			<Button size="md" onClick={() => setEditing(!editing)}>
				<StableLabel labels={['Edit', 'Done']} current={editing ? 'Done' : 'Edit'} />
			</Button>
			<Button size="md">
				<StableLabel labels={['Edit', 'Done']} current="Edit" />
			</Button>
			<Button size="md">
				<StableLabel labels={['Edit', 'Done']} current="Done" />
			</Button>
		</Row>
	)
}

const UPLOAD_SHAPES = ['wide', 'cover', 'round'] as const
// The app always gives a tile a sized slot (a dialog or side panel column); wide and cover fill theirs.
const tileSlot = (shape: (typeof UPLOAD_SHAPES)[number], width: string) => (shape === 'round' ? undefined : width)

type Shape = (typeof UPLOAD_SHAPES)[number]

export const buttons: Family = {
	id: 'buttons',
	title: 'Buttons and actions',
	parts: [
		{
			name: 'Button',
			source: 'src/ui/Button.tsx',
			knobs: [
				{ name: 'variant', values: BUTTON_VARIANTS, default: 'secondary' },
				{ name: 'size', values: ['md', 'sm', 'lg'] },
				{ name: 'state', values: ['rest', 'pending', 'disabled'], default: 'rest', prop: false },
				{ name: 'square', boolean: true },
				{ name: 'icon', boolean: true, prop: false }
			],
			render: playButton,
			anatomy: true,
			states: () => (
				<>
					<Example
						wide
						name="Variant × state"
						note="Each cell shows md, then sm. The overlay arrow sits in a forced-hover rail; on a page it waits for the rail's hover."
					>
						<StateGrid
							columns={BUTTON_STATES}
							rows={BUTTON_VARIANTS.map((variant) => [variant, stateRow(variant, ['md', 'sm'], false)])}
						/>
					</Example>
					<Example wide name="Square" prop="square">
						<StateGrid
							columns={BUTTON_STATES}
							rows={SQUARES.map(([variant, sizes]) => [variant, stateRow(variant, sizes, true)])}
						/>
					</Example>
					<Example name="Link" prop='variant="link"'>
						<StateGrid
							columns={['Rest', 'Hover', 'Focus', 'Disabled', 'Pending']}
							rows={[
								[
									'link',
									<>
										{REST_HOVER_FOCUS.map((force) => (
											<span key={force ?? 'rest'} className="body-sm text-secondary">
												<Cell force={force}>
													<Button variant="link" type="button">
														Sign out
													</Button>
												</Cell>
											</span>
										))}
										<span className="body-sm text-secondary">
											<Button variant="link" type="button" disabled>
												Sign out
											</Button>
										</span>
										<span className="body-sm text-secondary">
											<Button variant="link" type="button" pendingLabel="Signing out…" pending>
												Sign out
											</Button>
										</span>
									</>
								]
							]}
						/>
					</Example>
					<Example name="In a sentence" prop='variant="inlineLink"'>
						<p className="body-sm text-secondary">
							Already have an account?{' '}
							<Button variant="inlineLink" type="button">
								Sign in
							</Button>
						</p>
						{/* A long link wraps with its sentence instead of dropping to its own line. */}
						<p className="max-w-64 body-sm text-secondary">
							Inputs we could not measure never count as zero.{' '}
							<Button as={BasicLink} href="/exchanges/rank" variant="inlineLink">
								Compare every exchange and read how the score is built
							</Button>
							.
						</p>
					</Example>
					<Example name="Full-width CTA" prop='size="lg"'>
						<div className="w-72">
							<Button variant="primary" size="lg" className="w-full">
								Start free trial
							</Button>
						</div>
					</Example>
					<Example name="State icon" prop="stateIcon">
						<Row>
							<Button variant="toggle" size="md" stateIcon>
								Newsletter
							</Button>
							<Button variant="toggle" size="md" stateIcon data-active>
								Research Notes
							</Button>
						</Row>
					</Example>
					<Example name="Done label" prop="doneLabel">
						<Row>
							<Button size="md" doneLabel="Copied">
								<Icon name="copy" className="size-3.5" aria-hidden />
								Copy link
							</Button>
							<Button size="md" doneLabel="Copied" done>
								<Icon name="copy" className="size-3.5" aria-hidden />
								Copy link
							</Button>
						</Row>
					</Example>
					<Example name="Internal link" prop="as={BasicLink}">
						<Row>
							<Button as={BasicLink} href="/yields" size="md">
								Open yields
							</Button>
							<Button as={BasicLink} href="/yields" size="md" variant="primary">
								Open yields
							</Button>
						</Row>
					</Example>
					<Example
						name="Pending without a label"
						prop="pending, no pendingLabel"
						note="An export button in a toolbar row, md and sm."
					>
						<Row>
							<Button size="md">
								<Icon name="download" className="size-3.5" aria-hidden />
								.csv
							</Button>
							<Button size="md" pending>
								<BusyGlyph decorative size={14} />
								.csv
							</Button>
							<Button size="sm">
								<Icon name="download" className="size-3.5" aria-hidden />
								.png
							</Button>
							<Button size="sm" pending>
								<BusyGlyph decorative size={12} />
								.png
							</Button>
						</Row>
					</Example>
					<Example
						name="Disabled, still focusable"
						prop="accessibleWhenDisabled"
						note="Tab through: the first is skipped, the other three keep focus."
					>
						<Row>
							<Button size="md" disabled>
								Resend code
							</Button>
							<Button size="md" disabled accessibleWhenDisabled>
								Resend code
							</Button>
							<Button size="md" aria-disabled>
								Resend code
							</Button>
							<Tooltip
								content="Decrease"
								render={<Button size="md" square disabled accessibleWhenDisabled aria-label="Decrease" />}
							>
								<Icon name="minus" className="size-4" aria-hidden />
							</Tooltip>
						</Row>
					</Example>
					<Example name="Truncated" prop="truncate" note="Two pills in a 224px row.">
						<div className="flex w-56 gap-2">
							<Button size="sm" truncate>
								<span className="truncate">What is the TVL of Aave on Ethereum?</span>
							</Button>
							<Button size="sm" truncate>
								<Icon name="search" className="size-3.5 shrink-0" aria-hidden />
								<span className="truncate">Compare Lido and Rocket Pool</span>
							</Button>
						</div>
					</Example>
				</>
			),
			dos: () => (
				<Example name="Export busy" prop="pending">
					<DoDont
						good={
							<Row>
								<Button size="md">
									<Icon name="download" className="size-3.5" aria-hidden />
									.csv
								</Button>
								<Button size="md" pending>
									<BusyGlyph decorative size={14} />
									.csv
								</Button>
							</Row>
						}
						goodCaption="At rest and busy, .csv keeps one width: the spinner takes the icon's place."
						bad={
							<Row>
								<Button size="md" pendingLabel="Exporting…">
									<Icon name="download" className="size-3.5" aria-hidden />
									.csv
								</Button>
								<Button size="md" pendingLabel="Exporting…" pending>
									<Icon name="download" className="size-3.5" aria-hidden />
									.csv
								</Button>
							</Row>
						}
						badCaption="Room for “Exporting…” makes .csv wider than its neighbors, even at rest."
					/>
				</Example>
			)
		},
		{
			name: 'ButtonGroup',
			source: 'src/ui/Button.tsx',
			render: () => <SplitButtonDemo />
		},
		{
			name: 'ExternalLinkButton',
			source: 'src/components/ExternalLinkButton.tsx',
			knobs: [{ name: 'icon', values: ['none', 'globe'], default: 'none' }],
			render: (values) => (
				<ExternalLinkButton icon={values.icon === 'globe' ? 'globe' : undefined} href="https://defillama.com">
					Website
				</ExternalLinkButton>
			),
			states: () => (
				<Example name="Interaction">
					<StateGrid
						columns={['Rest', 'Hover', 'Focus']}
						rows={[
							[
								'with icon',
								<>
									{REST_HOVER_FOCUS.map((force) => (
										<Cell key={force ?? 'rest'} force={force}>
											<ExternalLinkButton icon="globe" href="https://defillama.com">
												Website
											</ExternalLinkButton>
										</Cell>
									))}
								</>
							],
							[
								'no icon',
								<>
									{REST_HOVER_FOCUS.map((force) => (
										<Cell key={force ?? 'rest'} force={force}>
											<ExternalLinkButton href="https://defillama.com">Docs</ExternalLinkButton>
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
			name: 'Menu',
			source: 'src/ui/Menu.tsx',
			knobs: [{ name: 'items', values: ['external', 'action'], prop: false }],
			note: 'Open it. On a phone it is a drawer headed by its name.',
			render: (values) =>
				values.items === 'external' ? (
					<Menu name="Websites" options={['https://defillama.com', 'https://docs.llama.fi']} isExternal />
				) : (
					<Menu name="Sort by" options={['TVL', 'Volume', 'Fees']} onItemClick={() => {}} />
				)
		},
		{
			name: 'StableLabel',
			source: 'src/ui/Button.tsx',
			note: 'Press the first button; all three keep one width.',
			render: () => <StableLabelDemo />
		},
		{
			name: 'FileButton',
			source: 'src/ui/FileButton.tsx',
			knobs: [{ name: 'size', values: ['md', 'sm'] }],
			render: (values) => (
				<FileButton accept=".csv,text/csv" size={values.size as 'md' | 'sm'} onFiles={() => {}}>
					<Icon name="paperclip" className="size-3.5" aria-hidden />
					Upload CSV file
				</FileButton>
			)
		},
		{
			name: 'UploadTile',
			source: 'src/ui/UploadTile.tsx',
			knobs: [
				{ name: 'shape', values: UPLOAD_SHAPES },
				{ name: 'state', values: ['rest', 'uploading', 'invalid', 'disabled'], default: 'rest', prop: false },
				{ name: 'hint', boolean: true, prop: false }
			],
			note: 'The file input stays with the caller, so this tile opens nothing. Tab to it and pick uploading: it keeps focus, is announced busy and ignores presses. The hint names the accepted files.',
			render: (values) => (
				<div className={tileSlot(values.shape as Shape, 'w-72')}>
					<UploadTile
						shape={values.shape as Shape}
						icon="image-plus"
						label="Upload logo"
						hint={values.hint ? 'PNG or SVG, up to 2 MB' : undefined}
						pendingLabel="Uploading…"
						pending={values.state === 'uploading'}
						aria-invalid={values.state === 'invalid' || undefined}
						disabled={values.state === 'disabled'}
					/>
				</div>
			),
			states: () => (
				<Example wide name="Interaction, upload and validity">
					<StateGrid
						columns={['Rest', 'Hover', 'Focus', 'Pressed', 'Uploading', 'Invalid', 'Disabled']}
						rows={UPLOAD_SHAPES.map((shape) => {
							const className = tileSlot(shape, 'w-48')
							return [
								shape,
								<>
									{([...REST_HOVER_FOCUS, 'active'] as const).map((force) => (
										<Cell key={force ?? 'rest'} force={force}>
											<UploadTile shape={shape} icon="image-plus" label="Upload logo" className={className} />
										</Cell>
									))}
									<UploadTile
										shape={shape}
										icon="image-plus"
										label="Upload logo"
										pendingLabel="Uploading…"
										pending
										className={className}
									/>
									<UploadTile shape={shape} icon="image-plus" label="Upload logo" aria-invalid className={className} />
									<UploadTile shape={shape} icon="image-plus" label="Upload logo" disabled className={className} />
								</>
							]
						})}
					/>
				</Example>
			)
		},
		{
			name: 'DashedTile',
			source: 'src/ui/UploadTile.tsx',
			knobs: [{ name: 'as', values: ['button', 'BasicLink'], default: 'button', prop: false }],
			note: 'A button that adds the next card, or with as={BasicLink} and href a link that opens a page (View all). Hover it or Tab to it: the dashed edge and the text darken, never blue.',
			render: (values) =>
				values.as === 'BasicLink' ? (
					<DashedTile as={BasicLink} href="/yields" className="min-h-12 w-72">
						View all
						<Icon name="arrow-right" className="size-3.5" aria-hidden />
					</DashedTile>
				) : (
					<DashedTile className="min-h-12 w-72">
						<Icon name="plus" className="size-3.5" aria-hidden />
						Add card
					</DashedTile>
				),
			states: () => (
				<Example wide name="Interaction">
					<StateGrid
						columns={['Rest', 'Hover', 'Focus', 'Pressed']}
						rows={[
							[
								'button',
								<>
									{([...REST_HOVER_FOCUS, 'active'] as const).map((force) => (
										<Cell key={force ?? 'rest'} force={force}>
											<DashedTile className="min-h-12 w-48">
												<Icon name="plus" className="size-3.5" aria-hidden />
												Add card
											</DashedTile>
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
			name: 'ImageReplaceTile',
			source: 'src/ui/UploadTile.tsx',
			knobs: [
				{ name: 'shape', values: UPLOAD_SHAPES },
				{ name: 'state', values: ['rest', 'uploading', 'disabled'], default: 'rest', prop: false }
			],
			render: (values) => (
				<div className={tileSlot(values.shape as Shape, 'w-72')}>
					<ImageReplaceTile
						shape={values.shape as Shape}
						src={DEMO_IMAGE}
						pendingLabel="Uploading…"
						pending={values.state === 'uploading'}
						disabled={values.state === 'disabled'}
						aria-label="Replace image"
					/>
				</div>
			),
			states: () => (
				<Example wide name="Interaction and upload">
					<StateGrid
						columns={['Rest', 'Hover', 'Focus', 'Uploading', 'Disabled']}
						rows={UPLOAD_SHAPES.map((shape) => {
							const slot = tileSlot(shape, 'w-48')
							// The forced state goes on the tile itself, inside its slot: the scrim reads the tile's group hover.
							return [
								shape,
								<>
									{REST_HOVER_FOCUS.map((force) => (
										<div key={force ?? 'rest'} className={slot}>
											<Cell force={force}>
												<ImageReplaceTile shape={shape} src={DEMO_IMAGE} aria-label="Replace image" />
											</Cell>
										</div>
									))}
									<div className={slot}>
										<ImageReplaceTile
											shape={shape}
											src={DEMO_IMAGE}
											pendingLabel="Uploading…"
											pending
											aria-label="Replace image"
										/>
									</div>
									<div className={slot}>
										<ImageReplaceTile shape={shape} src={DEMO_IMAGE} disabled aria-label="Replace image" />
									</div>
								</>
							]
						})}
					/>
				</Example>
			)
		},
		{
			name: 'CopyHelper',
			source: 'src/ui/Copy.tsx',
			knobs: [{ name: 'size', values: ['size-3.5', 'size-4'], default: 'size-3.5' }],
			note: 'Click it to see the copied state.',
			render: (values) => (
				<CopyHelper toCopy="0x5f98a1c4" size={values.size as 'size-3.5' | 'size-4'} aria-label="Copy address" />
			),
			states: () => (
				<Example name="Interaction">
					<StateGrid
						columns={['Rest', 'Hover', 'Focus']}
						rows={(['size-3.5', 'size-4'] as const).map((size) => [
							size,
							<>
								{REST_HOVER_FOCUS.map((force) => (
									<Cell key={force ?? 'rest'} force={force}>
										<CopyHelper toCopy="0x5f98a1c4" size={size} aria-label="Copy address" />
									</Cell>
								))}
							</>
						])}
					/>
				</Example>
			)
		}
	]
}
