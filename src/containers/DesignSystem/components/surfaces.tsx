import { useState } from 'react'
import { Announcement, announcementCtaStyles, type AnnouncementScope } from '~/components/Announcement'
import { BasicLink } from '~/components/Link'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { EntityTitleRow } from '~/ui/EntityTitleRow'
import { EntityTitleStrip } from '~/ui/EntityTitleStrip'
import { Icon } from '~/ui/Icon'
import { IconTile } from '~/ui/IconTile'
import { Logo } from '~/ui/Logo'
import { MetaLine } from '~/ui/MetaLine'
import { Panel, PanelHeader, PanelTitle } from '~/ui/Panel'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { Select } from '~/ui/Select'
import { Tag } from '~/ui/Tag'
import { Tooltip } from '~/ui/Tooltip'
import { DEMO_LOGO } from '../demoAssets'
import { Cell, DoDont, Example, type Family, type KnobValues, REST_HOVER_FOCUS, StateGrid } from '../shared'

const CHAINS = ['All chains', 'Ethereum', 'Arbitrum', 'Base', 'Solana']
const PERIODS = [
	{ value: '7d', label: '7d' },
	{ value: '30d', label: '30d' },
	{ value: '90d', label: '90d' }
] as const

type CardPadding = 'none' | 'sm' | 'base' | 'md' | 'strip' | 'row'
type CardTone = 'plain' | 'brand' | 'warning'
type IconTileTone = 'brand' | 'warning' | 'error' | 'success' | 'neutral'
const ICON_TILE_TONES: ReadonlyArray<IconTileTone> = ['brand', 'warning', 'error', 'success', 'neutral']
const CARD_PADDINGS: ReadonlyArray<CardPadding> = ['sm', 'base', 'strip', 'row', 'md', 'none']

function PanelDemo({ values }: { values: KnobValues }) {
	const [chain, setChain] = useState('Ethereum')
	const [period, setPeriod] = useState<string>('30d')
	const controls = values.header === 'controls'
	return (
		<div className={`w-full ${controls ? 'max-w-xl' : 'max-w-sm'}`}>
			<Panel>
				<PanelHeader>
					<PanelTitle as="h4">Fees by chain</PanelTitle>
					{controls ? (
						<>
							<Select
								label="Chain"
								allValues={CHAINS}
								selectedValues={chain}
								setSelectedValues={setChain}
								variant="filter"
								size="md"
							/>
							<SegmentedControl
								label="Period"
								options={PERIODS}
								value={period}
								onValueChange={setPeriod}
								variant="default"
								size="md"
							/>
						</>
					) : null}
					<Button size="md">.csv</Button>
				</PanelHeader>
				<p className="p-4 body-sm text-secondary">Charts and tables sit flush in the body.</p>
			</Panel>
		</div>
	)
}

const ANNOUNCEMENT_SCOPES: ReadonlyArray<AnnouncementScope> = [
	'notice',
	'llamaai',
	'app',
	'verified',
	'ir',
	'data',
	'near',
	'sonic',
	'odyssey',
	'spark',
	'research'
]

// The home-slot scopes, whose `*-announcement-scope` class colors the call-to-action pill
// (src/styles/themes/announcements.css). The other banners link inline, as the NEAR banner does.
const CTA_SCOPES = new Set<AnnouncementScope>(['llamaai', 'app', 'verified', 'ir', 'data'])

// Closing writes the dismissal cookie for this version, so Show again moves to a new version, as a changed banner does.
function AnnouncementDemo({ values }: { values: KnobValues }) {
	const [version, setVersion] = useState(1)
	const scope = values.scope as AnnouncementScope
	const content = (
		<span className="inline-flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1">
			Fees now include MEV rebates.
			<BasicLink
				href="/yields"
				className={CTA_SCOPES.has(scope) ? announcementCtaStyles : 'underline underline-offset-2'}
			>
				Read more
			</BasicLink>
		</span>
	)
	return (
		<div className="flex w-full max-w-2xl flex-col items-start gap-3">
			<div className="w-full">
				{values.notCancellable ? (
					<Announcement notCancellable scope={scope}>
						{content}
					</Announcement>
				) : (
					<Announcement announcementId="design-system-demo" version={String(version)} scope={scope}>
						{content}
					</Announcement>
				)}
			</div>
			{values.notCancellable ? null : (
				<Button size="sm" onClick={() => setVersion(version + 1)}>
					Show again
				</Button>
			)}
		</div>
	)
}

export const surfaces: Family = {
	id: 'surfaces',
	title: 'Surfaces',
	parts: [
		{
			name: 'Card',
			source: 'src/ui/Card.tsx',
			knobs: [
				{ name: 'padding', values: ['base', 'sm', 'md', 'strip', 'row', 'none'] },
				{ name: 'tone', values: ['plain', 'brand', 'warning'], default: 'plain' },
				{ name: 'radius', values: ['default', 'large'], default: 'default' }
			],
			render: (values) => {
				const padding = values.padding as CardPadding
				return (
					<div className="w-72">
						<Card
							padding={padding}
							tone={values.tone as CardTone}
							radius={values.radius as 'default' | 'large'}
							data-anatomy={`Card padding="${padding}"`}
						>
							<span className="body-sm text-primary">A repeated content tile</span>
						</Card>
					</div>
				)
			},
			anatomy: true,
			states: () => (
				<>
					<Example
						wide
						name="Padding"
						prop="padding"
						note="Show anatomy tints the padding in the playground; here every step sits side by side."
					>
						<div className="flex flex-wrap items-start gap-3">
							{CARD_PADDINGS.map((padding) => (
								<Card key={padding} padding={padding}>
									<span className="block mono-sm text-secondary">padding="{padding}"</span>
								</Card>
							))}
						</div>
					</Example>
					<Example name="Button card" prop='as="button"' note="With hover-wash-card.">
						<StateGrid
							columns={['Rest', 'Hover', 'Focus', 'Pressed']}
							rows={[
								[
									'Open report',
									<>
										{([...REST_HOVER_FOCUS, 'active'] as const).map((force) => (
											<Cell key={force ?? 'rest'} force={force}>
												<Card as="button" padding="base" className="hover-wash-card">
													<span className="body-sm text-primary">Open report</span>
												</Card>
											</Cell>
										))}
									</>
								]
							]}
						/>
					</Example>
				</>
			),
			dos: () => (
				<Example name="Corners">
					<DoDont
						good={
							<Card padding="base">
								<span className="body-sm text-primary">Card, 8px corners</span>
							</Card>
						}
						goodCaption="Card draws the 8px corner every card and panel shares."
						bad={
							// A deliberate counter-example: a frame rounded by hand to 6px, a corner Card never draws.
							<div className="rounded-md border border-subtle bg-surface p-3">
								<span className="body-sm text-primary">Hand-built, 6px corners</span>
							</div>
						}
						badCaption="A hand-rounded 6px frame reads as a different object beside 8px cards."
					/>
				</Example>
			)
		},
		{
			name: 'Announcement',
			source: 'src/components/Announcement.tsx',
			knobs: [
				{ name: 'scope', values: ANNOUNCEMENT_SCOPES, default: 'notice' },
				{ name: 'notCancellable', boolean: true }
			],
			note: 'Close it with the × (Tab to it, then Enter): the banner leaves and focus moves to the page content. Show again brings it back as a new version. Each scope repaints the banner; a home-slot scope (llamaai, app, verified, ir, data) also colors its call-to-action pill.',
			render: (values) => <AnnouncementDemo values={values} />
		},
		{
			name: 'IconTile',
			source: 'src/ui/IconTile.tsx',
			knobs: [
				{ name: 'tone', values: ICON_TILE_TONES },
				{ name: 'size', values: ['sm', 'md'] },
				{ name: 'busy', boolean: true }
			],
			note: 'Decoration beside the text that names the subject: hidden from assistive tech. busy swaps the icon for the spinner while the card waits.',
			render: (values) => (
				<IconTile
					icon="calendar-plus"
					tone={values.tone as IconTileTone}
					size={values.size as 'sm' | 'md'}
					busy={values.busy as boolean}
				/>
			),
			states: () => (
				<>
					<Example wide name="Tone × size">
						<StateGrid
							columns={ICON_TILE_TONES}
							rows={(['sm', 'md'] as const).map((size) => [
								size,
								<>
									{ICON_TILE_TONES.map((tone) => (
										<IconTile key={tone} icon="calendar-plus" tone={tone} size={size} />
									))}
								</>
							])}
						/>
					</Example>
					<Example
						name="Leading a card"
						note="md beside a title and a description; sm beside a title and one meta line."
					>
						<div className="flex w-80 flex-col gap-3">
							<Card padding="base" className="flex items-start gap-3">
								<IconTile icon="calendar-plus" tone="brand" size="md" />
								<span className="flex flex-col gap-0.5">
									<span className="label-md text-primary">Token unlocks</span>
									<span className="body-sm text-secondary">Upcoming emissions by date</span>
								</span>
							</Card>
							<Card padding="base" className="flex items-center gap-3">
								<IconTile icon="calendar-plus" tone="warning" size="sm" />
								<span className="flex flex-col">
									<span className="label-md text-primary">Unlock alert</span>
									<MetaLine>{['Daily', '3 tokens']}</MetaLine>
								</span>
							</Card>
						</div>
					</Example>
				</>
			)
		},
		{
			name: 'Panel',
			source: 'src/ui/Panel.tsx',
			knobs: [{ name: 'header', values: ['title', 'controls'], default: 'title', prop: false }],
			note: 'The controls header puts a Select, a SegmentedControl and a Button in the 32px row.',
			render: (values) => <PanelDemo values={values} />,
			states: () => (
				<Example
					name="Section link"
					prop="anchor"
					note="Hover the title: the link icon shows, and the title links to its own section."
				>
					<div className="w-full max-w-sm">
						<Panel>
							<PanelHeader>
								<PanelTitle as="h4" anchor="design-system-panel-anchor">
									Markets
								</PanelTitle>
								<Button size="md">.csv</Button>
							</PanelHeader>
							<p className="p-4 body-sm text-secondary">A section the page's nav and shared links point at.</p>
						</Panel>
					</div>
				</Example>
			)
		},
		{
			name: 'EntityTitleStrip',
			source: 'src/ui/EntityTitleStrip.tsx',
			knobs: [
				{ name: 'media', boolean: true, prop: false },
				{ name: 'actions', boolean: true, prop: false }
			],
			render: (values) => (
				<div className="w-full max-w-md">
					<EntityTitleStrip
						media={values.media ? <Logo src={DEMO_LOGO} size={28} /> : undefined}
						title="Ethereum"
						headingAs="h4"
						actions={
							values.actions ? (
								<Button size="md">
									<Icon name="bookmark" className="size-3.5" aria-hidden />
									Bookmark
								</Button>
							) : undefined
						}
					/>
				</div>
			)
		},
		{
			name: 'EntityTitleRow',
			source: 'src/ui/EntityTitleRow.tsx',
			note: 'Inside a Card.',
			render: () => (
				<div className="w-80">
					<Card padding="md">
						<EntityTitleRow
							as="h4"
							logo={<Logo src={DEMO_LOGO} size={24} />}
							actions={
								<>
									<Tooltip content="Website" render={<Button variant="ghost" size="md" square aria-label="Website" />}>
										<Icon name="globe" className="size-4" aria-hidden />
									</Tooltip>
									<Tooltip
										content="Bookmark"
										render={<Button variant="ghost" size="md" square aria-label="Bookmark" />}
									>
										<Icon name="bookmark" className="size-4" aria-hidden />
									</Tooltip>
								</>
							}
						>
							Aave <span className="font-normal text-secondary">AAVE</span> <Tag>Lending</Tag>
						</EntityTitleRow>
					</Card>
				</div>
			)
		}
	]
}
