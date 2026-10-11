import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { ListLoading, NoResults } from '~/ui/NoResults'
import { Panel } from '~/ui/Panel'
import { Skeleton } from '~/ui/Skeleton'
import {
	BusyGlyph,
	EmptyState,
	ErrorLine,
	InlineLoading,
	InlineStatus,
	PanelLoadingStatus,
	PanelStatus,
	SurfaceBodyLoadingStatus,
	SurfaceBodyStatus,
	SurfaceLoadingOverlay
} from '~/ui/Status'
import { DoDont, Example, FAILED_READ, type Family, Row } from '../shared'

// A failed query that is refetching.
const RETRYING_READ = { refetch() {}, isFetching: true }

const PANEL_STATES = ['loading', 'empty', 'error', 'failed', 'retrying']
const retryFor = (state: string) =>
	state === 'failed' ? FAILED_READ : state === 'retrying' ? RETRYING_READ : undefined

const EMPTY_ACTIONS = {
	one: <Button size="sm">Clear filters</Button>,
	two: (
		<>
			<Button size="sm" variant="primary">
				New query
			</Button>
			<Button size="sm">Browse examples</Button>
		</>
	)
}

const SKELETON_SHAPES = {
	bar: 'h-3 w-40',
	square: 'size-10 rounded-lg',
	round: 'size-10 rounded-full'
}

export const status: Family = {
	id: 'status',
	title: 'Loading, empty and error',
	parts: [
		{
			name: 'EmptyState',
			source: 'src/ui/Status.tsx',
			knobs: [
				{ name: 'size', values: ['md', 'lg'] },
				{ name: 'framed', boolean: true },
				{ name: 'icon', values: ['none', 'bookmark', 'search', 'lock'], default: 'none' },
				{ name: 'actions', values: ['none', 'one', 'two'], default: 'none', prop: false }
			],
			note: 'Unframed, it sits in a Panel that holds it; framed, it draws its own dashed frame.',
			anatomy: true,
			render: (values) => {
				const icon = values.icon === 'none' ? undefined : (values.icon as 'bookmark' | 'search' | 'lock')
				const actions = values.actions === 'none' ? undefined : EMPTY_ACTIONS[values.actions as 'one' | 'two']
				const framed = values.framed === true
				const state = (
					<div className="contents" data-anatomy="EmptyState">
						<EmptyState
							size={values.size as 'md' | 'lg'}
							framed={framed}
							icon={icon}
							title="No saved queries"
							actions={actions}
						>
							Save a query from the builder and it lists here.
						</EmptyState>
					</div>
				)
				return <div className={values.size === 'lg' ? 'w-96' : 'w-80'}>{framed ? state : <Panel>{state}</Panel>}</div>
			},
			states: () => (
				// headingAs="h3" is the lowest level EmptyState offers; the page outline shows it as is.
				<Example name="Gated page" prop='headingAs="h3"'>
					<div className="w-96">
						<EmptyState
							size="lg"
							framed
							icon="lock"
							headingAs="h3"
							title="Pro feature"
							actions={
								<>
									<Button size="md" variant="primary">
										Upgrade
									</Button>
									<Button size="md">Learn more</Button>
								</>
							}
						>
							Upgrade to export unlimited data.
						</EmptyState>
					</div>
				</Example>
			)
		},
		{
			name: 'NoResults',
			source: 'src/ui/NoResults.tsx',
			knobs: [{ name: 'copy', values: ['default', 'custom'], default: 'default', prop: false }],
			render: (values) => (
				<Card padding="none" className="flex w-72 flex-col">
					{values.copy === 'custom' ? <NoResults>No chains match &ldquo;zzz&rdquo;</NoResults> : <NoResults />}
				</Card>
			)
		},
		{
			name: 'PanelStatus',
			source: 'src/ui/Status.tsx',
			knobs: [{ name: 'state', values: PANEL_STATES, prop: false }],
			note: 'Loading is PanelLoadingStatus. error has no retry (server-rendered data); failed offers Try again.',
			render: (values) => {
				const state = values.state as string
				return (
					<div className="flex w-72">
						{state === 'loading' ? (
							<PanelLoadingStatus className="min-h-[140px]" />
						) : (
							<PanelStatus
								variant={state === 'empty' ? 'empty' : 'error'}
								retry={retryFor(state)}
								className="min-h-[140px]"
							>
								{state === 'empty' ? 'No pools match current filters' : <>Couldn&rsquo;t load pools.</>}
							</PanelStatus>
						)}
					</div>
				)
			}
		},
		{
			name: 'SurfaceBodyStatus',
			source: 'src/ui/Status.tsx',
			knobs: [{ name: 'state', values: PANEL_STATES, prop: false }],
			note: 'Loading is SurfaceBodyLoadingStatus.',
			render: (values) => {
				const state = values.state as string
				return (
					<Card padding="none" className="flex w-72">
						{state === 'loading' ? (
							<SurfaceBodyLoadingStatus label="Loading chart" className="min-h-[140px]" />
						) : (
							<SurfaceBodyStatus
								variant={state === 'empty' ? 'empty' : 'error'}
								retry={retryFor(state)}
								className="min-h-[140px]"
							>
								{state === 'empty' ? 'No routes match.' : <>Couldn&rsquo;t load the chart.</>}
							</SurfaceBodyStatus>
						)}
					</Card>
				)
			}
		},
		{
			name: 'SurfaceLoadingOverlay',
			source: 'src/ui/Status.tsx',
			note: 'The content stays visible underneath.',
			render: () => (
				<Panel className="min-h-[140px] w-80 p-4">
					<p className="body-md text-secondary">Ethereum $52.1b, Solana $9.8b, Arbitrum $2.4b, Base $2.1b.</p>
					<SurfaceLoadingOverlay label="Refreshing pools" />
				</Panel>
			)
		},
		{
			name: 'ListLoading',
			source: 'src/ui/NoResults.tsx',
			render: () => (
				<Card padding="none" className="w-72">
					<ListLoading label="Loading chains" />
				</Card>
			)
		},
		{
			name: 'InlineLoading',
			source: 'src/ui/Status.tsx',
			knobs: [{ name: 'insideLiveRegion', boolean: true }],
			render: (values) =>
				values.insideLiveRegion ? (
					<span role="status" aria-live="polite">
						<InlineLoading label="Checking your payment" insideLiveRegion />
					</span>
				) : (
					<InlineLoading label="Loading chats" />
				)
		},
		{
			name: 'BusyGlyph',
			source: 'src/ui/Status.tsx',
			knobs: [{ name: 'mode', values: ['label', 'hideLabel', 'decorative'], default: 'label', prop: false }],
			note: 'label shows beside the spinner; hideLabel keeps it for screen readers (an icon slot, a chip); decorative is the bare spinner inside a control.',
			anatomy: true,
			render: (values) =>
				values.mode === 'label' ? (
					<span className="body-sm text-secondary" data-anatomy="BusyGlyph">
						<BusyGlyph label="Saving…" size={12} />
					</span>
				) : values.mode === 'hideLabel' ? (
					<span className="text-tertiary" data-anatomy="BusyGlyph">
						<BusyGlyph label="Adding to queue" size={14} hideLabel />
					</span>
				) : (
					<span className="text-tertiary" data-anatomy="BusyGlyph">
						<BusyGlyph decorative size={18} />
					</span>
				),
			states: () => (
				<Example name="Busy button" prop="decorative">
					<Button size="md" aria-busy>
						<BusyGlyph decorative size={14} />
						Signing in…
					</Button>
				</Example>
			),
			dos: () => (
				<Example name="Inside a control" prop="decorative">
					<DoDont
						good={
							<Row>
								<Button size="md">
									<BusyGlyph decorative size={14} />
									Stop query
								</Button>
							</Row>
						}
						goodCaption="Decorative: screen readers name the button “Stop query”."
						bad={
							<Row>
								<Button size="md">
									<BusyGlyph label="Query running" size={14} />
									Stop query
								</Button>
							</Row>
						}
						badCaption="Labeled: the label joins the button's name, “Query running Stop query”."
					/>
				</Example>
			)
		},
		{
			name: 'InlineStatus',
			source: 'src/ui/Status.tsx',
			knobs: [
				{ name: 'variant', values: ['error', 'warning', 'info', 'empty'] },
				{ name: 'retry', values: ['none', 'failed', 'retrying'], default: 'none', prop: false }
			],
			note: 'Retry applies to an error: Try again, then the read running again.',
			render: (values) => {
				const variant = values.variant as 'error' | 'warning' | 'info' | 'empty'
				return (
					<div className="w-96">
						<InlineStatus variant={variant} retry={variant === 'error' ? retryFor(values.retry as string) : undefined}>
							{variant === 'error' ? (
								<>Couldn&rsquo;t load your dashboards.</>
							) : variant === 'warning' ? (
								<>
									Your subscription has ended, so this dashboard is view-only.{' '}
									<Button variant="link" type="button">
										Renew
									</Button>
								</>
							) : variant === 'info' ? (
								'Charts update every hour.'
							) : (
								'No saved queries yet.'
							)}
						</InlineStatus>
					</div>
				)
			},
			states: () => (
				<Example name="Narrow box" prop="retry" note="The retry button wraps under the message at 360px.">
					<div className="max-w-[360px]">
						<InlineStatus variant="error" retry={FAILED_READ}>
							Couldn&rsquo;t refresh yield pools. Showing the last loaded data.
						</InlineStatus>
					</div>
				</Example>
			)
		},
		{
			name: 'ErrorLine',
			source: 'src/ui/Status.tsx',
			knobs: [{ name: 'inset', values: ['none', 'menuRow'] }],
			note: 'none sits in a toolbar row; menuRow in a list.',
			render: (values) =>
				values.inset === 'menuRow' ? (
					<Card padding="none" className="w-72">
						<ErrorLine inset="menuRow">Couldn&rsquo;t load chains.</ErrorLine>
					</Card>
				) : (
					<div className="w-72">
						<ErrorLine inset="none">Couldn&rsquo;t load chains.</ErrorLine>
					</div>
				)
		},
		{
			name: 'Skeleton',
			source: 'src/ui/Skeleton.tsx',
			knobs: [
				{ name: 'shape', values: ['bar', 'square', 'round'], default: 'bar', prop: false },
				{ name: 'still', boolean: true }
			],
			render: (values) => (
				<Skeleton
					className={SKELETON_SHAPES[values.shape as keyof typeof SKELETON_SHAPES]}
					still={values.still === true}
				/>
			)
		}
	]
}
