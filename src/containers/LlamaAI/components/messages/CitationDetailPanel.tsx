import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useMedia } from '~/hooks/useMedia'
import { Button } from '~/ui/Button'
import { Dialog, DialogBackButton, DialogBody, DialogHeader, dialogScrollableBodyStyles } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'
import { PillBody } from './CitationPill'
import {
	accentFor,
	badgeFor,
	citationHeadline,
	citedRowDate,
	describeFigure,
	findCitedCell,
	iconFor,
	mismatchLabel,
	shouldFlagMismatch,
	shouldFlagUnverified,
	unverifiedLabel
} from './citationPillHelpers'
import { useCitationSheet } from './CitationSheetContext'

export function CitationDetailPanel({
	onBackToDashboard,
	advancedProvenance
}: {
	onBackToDashboard?: () => void
	advancedProvenance: boolean
}) {
	const { activeRef, close, restoreFocus } = useCitationSheet()
	const isMobile = useMedia('(max-width: 1023px)')
	const panelRef = useRef<HTMLDivElement>(null)
	const closeDesktopPanel = useCallback(() => {
		// Closing a nonmodal panel must not move focus away from another part of the page.
		if (panelRef.current?.contains(document.activeElement)) restoreFocus()
		close()
	}, [close, restoreFocus])
	useEffect(() => {
		if (isMobile || !activeRef) return
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape' && !event.defaultPrevented && panelRef.current?.contains(document.activeElement)) {
				closeDesktopPanel()
			}
		}
		document.addEventListener('keydown', onKeyDown)
		return () => document.removeEventListener('keydown', onKeyDown)
	}, [isMobile, activeRef, closeDesktopPanel])

	const citedCell = useMemo(
		() =>
			activeRef
				? findCitedCell(activeRef.rows, activeRef.columns, {
						field: activeRef.field,
						rowIndex: activeRef.rowIndex,
						value: activeRef.value
					})
				: null,
		[activeRef]
	)

	if (!activeRef) return null

	const accent = accentFor(activeRef.sourceType)
	const badge = badgeFor(activeRef.sourceType)
	const iconName = iconFor(activeRef.sourceType)
	const headline = citationHeadline(activeRef)
	const description = activeRef.sourceType === 'data' ? describeFigure(activeRef, citedCell) : null
	const citedRow = citedCell && activeRef.rows ? activeRef.rows[citedCell.rowIndex] : null
	const citedDate =
		activeRef.sourceType === 'data' && citedRow
			? citedRowDate(citedRow, activeRef.columns ?? Object.keys(citedRow))
			: null
	const asOfText = citedDate ?? activeRef.asOf
	const mismatch = shouldFlagMismatch(activeRef.verification)
	const unverified = !mismatch && shouldFlagUnverified(activeRef.verification)

	// What the citation says: the source type, its figure, and when. The desktop panel shows it in its header row;
	// the phone dialog opens its body with it, under the shared dialog header.
	const summary = (
		<div className="flex min-w-0 flex-1 flex-col gap-0.5">
			<span className={`label-xs tracking-wide uppercase ${accent.text}`}>{badge}</span>
			{headline ? <span className="heading-sm text-primary tabular-nums">{headline}</span> : null}
			{description ? <span className="body-sm text-secondary">{description}</span> : null}
			{asOfText ? <span className="body-sm text-tertiary">as of {asOfText}</span> : null}
		</div>
	)

	const verification = (
		<>
			{mismatch ? (
				<div className="flex items-start gap-1.5 rounded-md bg-surface-elevated-1 px-2.5 py-2 body-sm text-secondary">
					<Icon name="alert-triangle" height={14} width={14} className="mt-px shrink-0 text-warning" />
					<span>{mismatchLabel(activeRef)}</span>
				</div>
			) : unverified ? (
				<div className="flex items-start gap-1.5 rounded-md bg-surface-elevated-1 px-2.5 py-2 body-sm text-secondary">
					<Icon name="help-circle" height={14} width={14} className="mt-px shrink-0" />
					<span>{unverifiedLabel()}</span>
				</div>
			) : null}
			<PillBody reference={activeRef} citedCell={citedCell} advancedProvenance={advancedProvenance} />
		</>
	)

	if (isMobile) {
		return (
			<Dialog size="sm" open onClose={close} portal unmountOnHide>
				<div className={`absolute top-0 left-0 h-full w-[3px] ${accent.bar}`} />
				<DialogHeader
					title="Source detail"
					leading={
						<>
							{onBackToDashboard ? <DialogBackButton label="Back to dashboard" onClick={onBackToDashboard} /> : null}
							<span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${accent.chip}`}>
								<Icon name={iconName} height={16} width={16} />
							</span>
						</>
					}
				/>
				<DialogBody>
					{summary}
					{verification}
				</DialogBody>
			</Dialog>
		)
	}

	return (
		<div className="hidden shrink-0 overflow-hidden pl-2.5 lg:block">
			<div
				ref={panelRef}
				data-citation-panel
				role="region"
				aria-label="Source detail"
				className="relative flex h-full w-[min(26vw,420px)] min-w-[320px] flex-col overflow-hidden rounded-lg border border-subtle bg-surface"
			>
				<div className={`absolute top-0 left-0 h-full w-[3px] ${accent.bar}`} />
				<div className="flex shrink-0 items-start gap-2.5 border-b border-subtle py-3 pr-3 pl-4">
					<span className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md ${accent.chip}`}>
						<Icon name={iconName} height={14} width={14} />
					</span>
					{summary}
					<div className="flex shrink-0 items-center gap-1">
						{onBackToDashboard ? (
							<Button type="button" variant="ghost" size="sm" onClick={onBackToDashboard}>
								<Icon name="chevron-left" height={14} width={14} />
								Dashboard
							</Button>
						) : null}
						<Button
							type="button"
							variant="ghost"
							size="md"
							square
							onClick={closeDesktopPanel}
							aria-label="Close source detail"
						>
							<Icon name="x" className="size-4" />
						</Button>
					</div>
				</div>
				<div className={`${dialogScrollableBodyStyles} flex flex-col gap-2.5 px-4 py-3.5`}>{verification}</div>
			</div>
		</div>
	)
}
