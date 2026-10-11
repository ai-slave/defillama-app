import { useState } from 'react'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { EntityTitleRow } from '~/ui/EntityTitleRow'
import { EntityTitleStrip } from '~/ui/EntityTitleStrip'
import { Icon } from '~/ui/Icon'
import { Logo } from '~/ui/Logo'
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

type CardPadding = 'none' | 'sm' | 'base' | 'md' | 'strip'
type CardTone = 'plain' | 'brand' | 'warning'

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

export const surfaces: Family = {
	id: 'surfaces',
	title: 'Surfaces',
	parts: [
		{
			name: 'Card',
			source: 'src/ui/Card.tsx',
			knobs: [
				{ name: 'padding', values: ['base', 'sm', 'md', 'strip', 'none'] },
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
			name: 'Panel',
			source: 'src/ui/Panel.tsx',
			knobs: [{ name: 'header', values: ['title', 'controls'], default: 'title', prop: false }],
			note: 'The controls header puts a Select, a SegmentedControl and a Button in the 32px row.',
			render: (values) => <PanelDemo values={values} />
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
