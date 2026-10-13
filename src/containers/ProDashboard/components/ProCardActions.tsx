import * as Ariakit from '@ariakit/react'
import { useRouter } from 'next/router'
import { type ReactNode, useState } from 'react'
import toast from 'react-hot-toast'
import type { OmittedChartExport } from '~/components/ChartExport/types'
import { type ChartPngExportOptions, useChartPngExport } from '~/components/ChartExport/useChartPngExport'
import {
	CSV_DOWNLOAD_ERROR,
	CsvDownloadDialogs,
	downloadPreparedCsv,
	type PrepareCsv,
	useCsvDownload
} from '~/components/CsvDownloadButton'
import { useIsClient } from '~/hooks/useIsClient'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { MenuItem, MenuSeparator, MenuSurface } from '~/ui/PopoverSurface'
import { ErrorLine } from '~/ui/Status'
import { Tooltip } from '~/ui/Tooltip'
import { tw } from '~/ui/tw'
import type { StoredColSpan } from '../dashboardConfig/colSpan'
import { DASHBOARD_CARD_HEIGHT_LABELS, getEmbedCardHeight } from '../dashboardLayout/cardHeight'
import { getBindableFieldsForKind } from '../dashboardVariables/resolve'
import { dashboardItemHash } from '../hooks/useDashboardItemDeepLink'
import {
	useProDashboardDashboard,
	useProDashboardItemsState,
	useProDashboardPermissions,
	useProDashboardVariables
} from '../ProDashboardAPIContext'
import { keepKeyboardEventsInsideCard } from '../ui/keyboard'
import type { UnifiedRowHeaderType } from '../unifiedTable/config/types'
import { useDashboardCardContext } from './DashboardCardContext'
import { buildEmbedIframeSnippet, cardEmbedSrc, copyTextToClipboard, EmbedSnippetDialog } from './EmbedSnippetDialog'
import { type CsvExportLevel, EXPORT_LEVEL_LABELS } from './UnifiedTable/core/csvExportLevels'

const noChart = () => null

const menuGroupLabelStyles = tw`px-3 pt-2 pb-1 body-sm text-tertiary`

const COL_SPAN_LABELS = {
	0.5: 'Quarter width',
	1: 'Half width',
	1.5: 'Three-quarter width',
	2: 'Full width'
} as const satisfies Record<StoredColSpan, string>

export { keepKeyboardEventsInsideCard }
export function ProCardEditControls({ children }: { children: ReactNode }) {
	const { isReadOnly } = useProDashboardPermissions()
	if (isReadOnly) return null
	return (
		<div
			role="presentation"
			onKeyDown={keepKeyboardEventsInsideCard}
			className="flex min-w-0 flex-wrap items-center justify-end gap-2 opacity-0 transition-opacity group-hover/dashboard-card:opacity-100 group-focus-visible/dashboard-card:opacity-100 group-has-focus-visible/dashboard-card:opacity-100 group-data-[arrived=true]/dashboard-card:opacity-100 has-[[aria-expanded=true]]:opacity-100 motion-reduce:transition-none pointer-coarse:opacity-100"
		>
			{children}
		</div>
	)
}
/** A Pro card exports through its More actions menu, which reads the chart through `onReady`, so its charts draw no buttons. */
export const PRO_CARD_MENU_EXPORTS: OmittedChartExport = { omit: 'exports through the Pro card menu (ProCardHeader)' }

export interface ProCardOverflowMenuProps {
	image?: ChartPngExportOptions | undefined
	csv?:
		| { prepareCsv: PrepareCsv; onClick?: never; isLoading?: never; disabled?: boolean }
		| { onClick: () => void | Promise<void>; isLoading?: boolean | undefined; prepareCsv?: never; disabled?: boolean }
		| undefined
	csvLevels?:
		| {
				rowHeaders: Array<UnifiedRowHeaderType>
				onExport: (level: CsvExportLevel) => void | Promise<void>
				isLoading?: boolean | undefined
		  }
		| undefined
	onDuplicate?: (() => void) | undefined
	disabled?: boolean | undefined
}
export function ProCardOverflowMenu({ image, csv, csvLevels, onDuplicate, disabled }: ProCardOverflowMenuProps) {
	const { isReadOnly, hideDuplicateButton } = useProDashboardPermissions()
	const { currentDashboard } = useProDashboardDashboard()
	const { items } = useProDashboardItemsState()
	const { variables, canEditVariables, bindItemField } = useProDashboardVariables()
	const cardContext = useDashboardCardContext()
	const router = useRouter()
	const { isExporting, downloadImage, copyImage } = useChartPngExport(image ?? { chartInstance: noChart })
	const csvDownload = useCsvDownload()
	const isClient = useIsClient()
	const [isEmbedDialogOpen, setIsEmbedDialogOpen] = useState(false)
	const menu = Ariakit.useMenuStore({
		placement: 'bottom-end',
		setOpen: (open) => {
			if (open) csvDownload.clearError()
		}
	})
	const canDuplicate = !!onDuplicate && !isReadOnly && !hideDuplicateButton
	const shareableCard =
		cardContext && currentDashboard?.visibility === 'public'
			? {
					itemId: cardContext.itemId,
					dashboardKey: currentDashboard.slug ?? currentDashboard.id,
					item: items.find((candidate) => candidate.id === cardContext.itemId)
				}
			: null
	const hasExports = !!image || !!csv || !!csvLevels
	const layout = isReadOnly ? null : (cardContext?.layout ?? null)
	const onRemove = isReadOnly ? null : (cardContext?.onRemove ?? null)
	const card = cardContext ? items.find((candidate) => candidate.id === cardContext.itemId) : undefined
	const parameterActions =
		card && canEditVariables && !isReadOnly
			? variables.flatMap((variable) =>
					getBindableFieldsForKind(card, variable.kind).map((field) => {
						const bound = 'bindings' in card && card.bindings?.[field] === variable.id
						return {
							key: `${variable.id}:${field}`,
							label: bound ? `Unbind from ${variable.label}` : `Bind to ${variable.label}`,
							onSelect: () => bindItemField(card.id, field, bound ? null : variable.id)
						}
					})
				)
			: []
	const hasParameterActions = parameterActions.length > 0
	if (!hasExports && !canDuplicate && !shareableCard && !layout && !onRemove && !hasParameterActions) return null
	const copyCardLink = () => {
		if (!shareableCard) return
		const url = `${window.location.origin}/pro/${shareableCard.dashboardKey}${dashboardItemHash(shareableCard.itemId)}`
		void copyTextToClipboard(url, 'Card link copied')
	}
	const busy = !!disabled || isExporting
	const csvBusy =
		busy ||
		!isClient ||
		csvDownload.userLoading ||
		csvDownload.status === 'pending' ||
		!!csv?.isLoading ||
		!!csvLevels?.isLoading ||
		!!csv?.disabled
	const requestDownload = (run: () => void | Promise<void>) =>
		csvDownload.requestDownload(
			async () => {
				await run()
				menu.hide()
			},
			() => {
				const { open, contentElement } = menu.getState()
				if (!open || !contentElement?.isConnected) toast.error(CSV_DOWNLOAD_ERROR)
			}
		)
	const exportCsv = () => {
		if (csv) void requestDownload(() => (csv.prepareCsv ? downloadPreparedCsv(csv.prepareCsv) : csv.onClick()))
	}
	const exportLevels: Array<CsvExportLevel> = csvLevels
		? ['all', ...csvLevels.rowHeaders.filter((header) => header !== 'protocol')]
		: []
	return (
		<div role="presentation" onKeyDown={keepKeyboardEventsInsideCard}>
			<Ariakit.MenuProvider store={menu}>
				<Tooltip
					content="More actions"
					render={
						<Ariakit.MenuButton
							render={<Button size="sm" square variant="ghost" />}
							disabled={
								(disabled && !canDuplicate && !shareableCard && !layout && !onRemove && !hasParameterActions) ||
								!isClient
							}
							accessibleWhenDisabled
							aria-label="More actions"
						/>
					}
				>
					<Icon name="ellipsis" className="size-4" />
				</Tooltip>
				<MenuSurface variant="actions" composite={false}>
					<Ariakit.MenuList store={menu} aria-label="Card actions">
						{image ? (
							<>
								<MenuItem
									disabled={busy}
									onClick={downloadImage}
									data-umami-event="export-image"
									data-umami-event-page={router.pathname}
								>
									Download image
								</MenuItem>
								<MenuItem
									disabled={busy}
									onClick={copyImage}
									data-umami-event="copy-image"
									data-umami-event-page={router.pathname}
								>
									Copy image
								</MenuItem>
							</>
						) : null}
						{csv ? (
							<MenuItem
								disabled={csvBusy}
								accessibleWhenDisabled
								hideOnClick={false}
								onClick={exportCsv}
								data-umami-event="export-csv"
								data-umami-event-page={router.pathname}
							>
								Download CSV
							</MenuItem>
						) : null}
						{exportLevels.map((level) => (
							<MenuItem
								key={level}
								disabled={csvBusy}
								accessibleWhenDisabled
								hideOnClick={false}
								onClick={() => {
									void requestDownload(() => csvLevels?.onExport(level))
								}}
								data-umami-event="export-csv"
								data-umami-event-page={router.pathname}
							>
								Download CSV: {EXPORT_LEVEL_LABELS[level]}
							</MenuItem>
						))}
						{layout ? (
							<>
								{hasExports ? <MenuSeparator /> : null}
								{layout.colSpanOptions.length > 0 ? (
									<Ariakit.MenuGroup>
										<Ariakit.MenuGroupLabel className={menuGroupLabelStyles}>Width</Ariakit.MenuGroupLabel>
										{layout.colSpanOptions.map((option) => (
											<MenuItem
												kind="radio"
												key={option}
												name="dashboard-card-width"
												value={String(option)}
												checked={option === layout.colSpan}
												onClick={() => layout.onColSpanChange(option)}
												data-umami-event="dashboard-card-width"
											>
												{COL_SPAN_LABELS[option]}
											</MenuItem>
										))}
									</Ariakit.MenuGroup>
								) : null}
								{layout.height && layout.heightOptions.length > 0 ? (
									<Ariakit.MenuGroup>
										<Ariakit.MenuGroupLabel className={menuGroupLabelStyles}>Height</Ariakit.MenuGroupLabel>
										{layout.heightOptions.map((option) => (
											<MenuItem
												kind="radio"
												key={option}
												name="dashboard-card-height"
												value={option}
												checked={option === layout.height}
												onClick={() => layout.onHeightChange(option)}
												data-umami-event="dashboard-card-height"
											>
												{DASHBOARD_CARD_HEIGHT_LABELS[option]}
											</MenuItem>
										))}
									</Ariakit.MenuGroup>
								) : null}
								<Ariakit.MenuGroup>
									<Ariakit.MenuGroupLabel className={menuGroupLabelStyles}>Move</Ariakit.MenuGroupLabel>
									<MenuItem
										disabled={!layout.canMoveUp}
										accessibleWhenDisabled
										hideOnClick={false}
										onClick={() => layout.onMove(-1)}
									>
										Move up
									</MenuItem>
									<MenuItem
										disabled={!layout.canMoveDown}
										accessibleWhenDisabled
										hideOnClick={false}
										onClick={() => layout.onMove(1)}
									>
										Move down
									</MenuItem>
								</Ariakit.MenuGroup>
							</>
						) : null}
						{hasParameterActions ? (
							<>
								{hasExports || layout ? <MenuSeparator /> : null}
								<Ariakit.MenuGroup>
									<Ariakit.MenuGroupLabel className={menuGroupLabelStyles}>Parameters</Ariakit.MenuGroupLabel>
									{parameterActions.map((action) => (
										<MenuItem
											key={action.key}
											onClick={action.onSelect}
											data-umami-event="dashboard-card-bind"
											data-umami-event-page={router.pathname}
										>
											{action.label}
										</MenuItem>
									))}
								</Ariakit.MenuGroup>
							</>
						) : null}
						{shareableCard ? (
							<>
								{hasExports || layout || hasParameterActions ? <MenuSeparator /> : null}
								<MenuItem
									onClick={copyCardLink}
									data-umami-event="copy-card-link"
									data-umami-event-page={router.pathname}
								>
									Copy link to card
								</MenuItem>
								<MenuItem
									onClick={() => setIsEmbedDialogOpen(true)}
									data-umami-event="embed-card"
									data-umami-event-page={router.pathname}
								>
									Embed card…
								</MenuItem>
							</>
						) : null}
						{canDuplicate ? (
							<>
								{hasExports || shareableCard || layout || hasParameterActions ? <MenuSeparator /> : null}
								<Ariakit.MenuGroup>
									<MenuItem onClick={onDuplicate}>Duplicate</MenuItem>
								</Ariakit.MenuGroup>
							</>
						) : null}
						{onRemove ? (
							<>
								{hasExports || shareableCard || layout || canDuplicate || hasParameterActions ? (
									<MenuSeparator />
								) : null}
								<Ariakit.MenuGroup>
									<MenuItem destructive onClick={onRemove} data-umami-event="dashboard-card-remove">
										<Icon name="trash-2" className="size-3.5" />
										Remove card
									</MenuItem>
								</Ariakit.MenuGroup>
							</>
						) : null}
					</Ariakit.MenuList>
					{csvDownload.status === 'error' ? (
						<div className="max-w-xs">
							<ErrorLine inset="menuRow">{CSV_DOWNLOAD_ERROR}</ErrorLine>
						</div>
					) : null}
				</MenuSurface>
			</Ariakit.MenuProvider>
			<span role="status" className="sr-only">
				{csvDownload.status === 'pending' ? 'Preparing CSV download' : ''}
			</span>
			<CsvDownloadDialogs controller={csvDownload} />
			{shareableCard ? (
				<EmbedSnippetDialog
					open={isEmbedDialogOpen}
					onClose={() => setIsEmbedDialogOpen(false)}
					heading="Embed card"
					snippetFor={(theme) =>
						buildEmbedIframeSnippet({
							src: cardEmbedSrc(shareableCard.dashboardKey, shareableCard.itemId, theme),
							height: getEmbedCardHeight(shareableCard.item)
						})
					}
				/>
			) : null}
		</div>
	)
}
