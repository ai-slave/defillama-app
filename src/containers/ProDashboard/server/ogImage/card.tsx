import type { ReactElement } from 'react'

export const OG_CARD_BASE_WIDTH = 1200
export const OG_CARD_MAX_CHARTS = 3

const CARD_BACKGROUND = '#0b1214'
const CARD_SURFACE = '#131c1f'
const CARD_BORDER = '#1f2c30'
const TEXT_PRIMARY = '#ffffff'
const TEXT_SECONDARY = 'rgba(255, 255, 255, 0.72)'
const TEXT_MUTED = 'rgba(255, 255, 255, 0.5)'
const ACCENT = '#326abd'

const LOGO_DATA_URI =
	'data:image/png;base64,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'

const STATIC_CARD_TITLE = 'DefiLlama Pro Dashboard'
const STATIC_CARD_SUBTITLE = 'No-code DeFi analytics dashboards'

export interface DashboardOgCardChart {
	id: string
	caption: string
	imageDataUri: string
}

export interface DashboardOgCardProps {
	width: number
	height: number
	title: string
	authorName: string | null
	metaLine: string
	charts: Array<DashboardOgCardChart>
	summaryLines: Array<string>
}

export function getOgChartImageSize(cardWidth: number): {
	width: number
	height: number
} {
	const scale = cardWidth / OG_CARD_BASE_WIDTH
	return { width: Math.round(346 * scale), height: Math.round(190 * scale) }
}

function scaler(cardWidth: number) {
	const scale = cardWidth / OG_CARD_BASE_WIDTH
	return (value: number) => Math.round(value * scale)
}

function CardShell({
	width,
	height,
	children
}: {
	width: number
	height: number
	children: ReactElement | Array<ReactElement>
}): ReactElement {
	const px = scaler(width)
	return (
		<div
			style={{
				display: 'flex',
				flexDirection: 'column',
				width: `${width}px`,
				height: `${height}px`,
				backgroundColor: CARD_BACKGROUND,
				color: TEXT_PRIMARY,
				padding: `${px(48)}px ${px(56)}px`
			}}
		>
			<div style={{ display: 'flex', alignItems: 'center' }}>
				<img src={LOGO_DATA_URI} width={px(44)} height={px(44)} alt="" />
				<div
					style={{
						display: 'flex',
						marginLeft: `${px(14)}px`,
						fontSize: `${px(24)}px`,
						color: TEXT_SECONDARY,
						letterSpacing: `${px(1)}px`
					}}
				>
					DefiLlama Pro
				</div>
			</div>
			{children}
		</div>
	)
}

function ChartTile({ chart, cardWidth }: { chart: DashboardOgCardChart; cardWidth: number }): ReactElement {
	const px = scaler(cardWidth)
	const image = getOgChartImageSize(cardWidth)
	return (
		<div
			style={{
				display: 'flex',
				flexDirection: 'column',
				width: `${image.width}px`,
				backgroundColor: CARD_SURFACE,
				border: `${Math.max(1, px(1))}px solid ${CARD_BORDER}`,
				borderRadius: `${px(12)}px`,
				padding: `${px(10)}px`
			}}
		>
			<div
				style={{
					display: 'flex',
					fontSize: `${px(18)}px`,
					color: TEXT_SECONDARY,
					marginBottom: `${px(6)}px`
				}}
			>
				{chart.caption}
			</div>
			<img src={chart.imageDataUri} width={image.width - px(20)} height={image.height} alt="" />
		</div>
	)
}

export function buildDashboardOgCard({
	width,
	height,
	title,
	authorName,
	metaLine,
	charts,
	summaryLines
}: DashboardOgCardProps): ReactElement {
	const px = scaler(width)
	return (
		<CardShell width={width} height={height}>
			<div
				style={{
					display: 'flex',
					flexDirection: 'column',
					marginTop: `${px(36)}px`
				}}
			>
				<div
					style={{
						display: 'flex',
						fontSize: `${px(58)}px`,
						lineHeight: 1.1,
						color: TEXT_PRIMARY
					}}
				>
					{title}
				</div>
				{authorName ? (
					<div
						style={{
							display: 'flex',
							marginTop: `${px(16)}px`,
							fontSize: `${px(26)}px`,
							color: ACCENT
						}}
					>
						By {authorName}
					</div>
				) : null}
				<div
					style={{
						display: 'flex',
						marginTop: `${px(10)}px`,
						fontSize: `${px(24)}px`,
						color: TEXT_MUTED
					}}
				>
					{metaLine}
				</div>
			</div>
			{charts.length > 0 ? (
				<div style={{ display: 'flex', marginTop: 'auto', gap: `${px(24)}px` }}>
					{charts.map((chart) => (
						<ChartTile key={chart.id} chart={chart} cardWidth={width} />
					))}
				</div>
			) : (
				<div
					style={{
						display: 'flex',
						flexDirection: 'column',
						marginTop: 'auto',
						gap: `${px(12)}px`
					}}
				>
					{[...new Set(summaryLines)].map((line) => (
						<div
							key={line}
							style={{
								display: 'flex',
								fontSize: `${px(28)}px`,
								color: TEXT_SECONDARY
							}}
						>
							{line}
						</div>
					))}
				</div>
			)}
		</CardShell>
	)
}

export function buildStaticDashboardOgCard({ width, height }: { width: number; height: number }): ReactElement {
	const px = scaler(width)
	return (
		<CardShell width={width} height={height}>
			<div
				style={{
					display: 'flex',
					flexDirection: 'column',
					marginTop: 'auto',
					marginBottom: 'auto'
				}}
			>
				<div
					style={{
						display: 'flex',
						fontSize: `${px(64)}px`,
						color: TEXT_PRIMARY
					}}
				>
					{STATIC_CARD_TITLE}
				</div>
				<div
					style={{
						display: 'flex',
						marginTop: `${px(18)}px`,
						fontSize: `${px(30)}px`,
						color: TEXT_SECONDARY
					}}
				>
					{STATIC_CARD_SUBTITLE}
				</div>
			</div>
		</CardShell>
	)
}
