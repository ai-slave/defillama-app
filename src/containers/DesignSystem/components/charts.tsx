import { useState } from 'react'
import { Button } from '~/ui/Button'
import {
	CHART_FILL,
	ChartPanelBody,
	ChartPanelExportShellLoading,
	ChartPanelTitle,
	ChartPanelToolbar
} from '~/ui/ChartPanel'
import { Icon } from '~/ui/Icon'
import { Panel } from '~/ui/Panel'
import { FailedDataNote, ScopeNote } from '~/ui/ScopeNote'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { BusyGlyph, SurfaceBodyLoadingStatus, SurfaceBodyStatus } from '~/ui/Status'
import { FAILED_READ, type Family, type KnobValues } from '../shared'

const VIEWS = [
	{ value: 'combined', label: 'Combined' },
	{ value: 'breakdown', label: 'Breakdown' }
] as const

// Stands in for an ECharts canvas: the shell is what this section shows, not the plot.
function PlotPlaceholder() {
	return (
		<svg viewBox="0 0 600 240" preserveAspectRatio="none" aria-hidden className={`${CHART_FILL} text-link`}>
			<path
				d="M0 190 L60 170 L120 180 L180 120 L240 140 L300 90 L360 110 L420 60 L480 80 L540 40 L600 55"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				vectorEffect="non-scaling-stroke"
			/>
		</svg>
	)
}

// .csv and .png as the export buttons draw them; the real ones need the router and auth, so the page shows their markup.
function ExportButtons({ pngPending }: { pngPending?: boolean }) {
	return (
		<>
			<Button size="md">
				<Icon name="download-paper" className="size-3.5" aria-hidden />
				<span>.csv</span>
			</Button>
			<Button size="md" pending={pngPending}>
				{pngPending ? (
					<BusyGlyph decorative size={14} />
				) : (
					<Icon name="download-paper" className="size-3.5" aria-hidden />
				)}
				<span>.png</span>
			</Button>
		</>
	)
}

// The shell's marks sit on the real parts, so Show anatomy outlines the panel, toolbar, title and body.
function ChartShellDemo({ values }: { values: KnobValues }) {
	const [view, setView] = useState<string>('combined')
	return (
		<div className="w-full max-w-3xl">
			<Panel data-anatomy="Panel">
				<ChartPanelToolbar
					data-anatomy="ChartPanelToolbar"
					leading={
						<>
							<span className="contents" data-anatomy="ChartPanelTitle">
								<ChartPanelTitle
									headingAs="h4"
									subtitle="Daily, all chains"
									titleTooltip="Fees paid by users, before any split with holders."
								>
									Fees
								</ChartPanelTitle>
							</span>
							{values.controls ? (
								<SegmentedControl
									label="View"
									options={VIEWS}
									value={view}
									onValueChange={setView}
									variant="default"
									size="md"
								/>
							) : null}
						</>
					}
				>
					<ExportButtons pngPending={values.state === 'png pending'} />
				</ChartPanelToolbar>
				<ChartPanelBody data-anatomy="ChartPanelBody">
					<PlotPlaceholder />
				</ChartPanelBody>
			</Panel>
		</div>
	)
}

function BodyDemo({ values }: { values: KnobValues }) {
	return (
		<div className="w-full max-w-xl">
			<Panel>
				<ChartPanelToolbar leading={<ChartPanelTitle headingAs="h4">Fees</ChartPanelTitle>} />
				<ChartPanelBody>
					{values.state === 'loading' ? <SurfaceBodyLoadingStatus label="Loading chart" /> : null}
					{values.state === 'empty' ? (
						<SurfaceBodyStatus variant="empty">No fees in this range.</SurfaceBodyStatus>
					) : null}
					{values.state === 'error' ? (
						<SurfaceBodyStatus variant="error" retry={FAILED_READ}>
							Couldn&rsquo;t load fees.
						</SurfaceBodyStatus>
					) : null}
					{values.state === 'rest' ? <PlotPlaceholder /> : null}
				</ChartPanelBody>
			</Panel>
		</div>
	)
}

export const charts: Family = {
	id: 'charts',
	title: 'Charts',
	parts: [
		{
			name: 'ChartPanelToolbar',
			source: 'src/ui/ChartPanel.tsx',
			knobs: [
				{ name: 'controls', boolean: true, prop: false },
				{ name: 'state', values: ['rest', 'png pending'], default: 'rest', prop: false }
			],
			note: 'The export buttons are plain Buttons: ChartExportButtons needs the router and an ECharts instance.',
			render: (values) => <ChartShellDemo values={values} />,
			anatomy: true
		},
		{
			name: 'ChartPanelBody',
			source: 'src/ui/ChartPanel.tsx',
			knobs: [{ name: 'state', values: ['rest', 'loading', 'empty', 'error'], default: 'rest', prop: false }],
			note: "Loading, empty and error with Try again each fill the body's 360px floor.",
			render: (values) => <BodyDemo values={values} />
		},
		{
			name: 'ChartPanelExportShellLoading',
			source: 'src/ui/ChartPanel.tsx',
			note: 'A lazy chart that draws its own title and export row.',
			render: () => (
				<div className="w-full max-w-3xl">
					<Panel>
						<ChartPanelExportShellLoading />
					</Panel>
				</div>
			)
		},
		{
			name: 'ScopeNote',
			source: 'src/ui/ScopeNote.tsx',
			note: 'Directly under the toolbar, before the body.',
			render: () => (
				<div className="w-full max-w-xl">
					<Panel>
						<ChartPanelToolbar leading={<ChartPanelTitle headingAs="h4">Fees</ChartPanelTitle>} />
						<ScopeNote>This chart ignores the TVL range filter and shows every pool.</ScopeNote>
						<ChartPanelBody className="min-h-[80px]" />
					</Panel>
				</div>
			)
		},
		{
			name: 'FailedDataNote',
			source: 'src/ui/ScopeNote.tsx',
			note: 'Directly under the toolbar, before the body.',
			render: () => (
				<div className="w-full max-w-xl">
					<Panel>
						<ChartPanelToolbar leading={<ChartPanelTitle headingAs="h4">Fees</ChartPanelTitle>} />
						<FailedDataNote labels={['Base', 'Arbitrum']} shows="Showing the other chains." />
						<ChartPanelBody className="min-h-[80px]" />
					</Panel>
				</div>
			)
		}
	]
}
