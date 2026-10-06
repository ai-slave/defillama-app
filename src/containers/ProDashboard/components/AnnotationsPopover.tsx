import * as Ariakit from '@ariakit/react'
import { useState } from 'react'
import { Icon } from '~/ui/Icon'
import { DrawerDismiss, PopoverSurface } from '~/ui/PopoverSurface'
import { isValidAnnotationDate } from '../dashboardConfig/migrate'
import {
	DASHBOARD_ANNOTATION_LABEL_MAX_LENGTH,
	type DashboardAnnotation,
	MAX_DASHBOARD_ANNOTATIONS
} from '../dashboardTypes'
import { useProDashboardAnnotations } from '../ProDashboardAPIContext'
import { ProBadge, ProButton } from '../ui'
import { generateItemId } from '../utils/dashboardUtils'

const INPUT_STYLES =
	'min-w-0 rounded-md border border-pro-cards-border bg-surface-elevated-1 px-2.5 py-1.5 text-xs text-pro-text-primary placeholder:text-pro-text-tertiary focus-visible:border-brand focus-visible:outline-hidden read-only:cursor-not-allowed read-only:opacity-60'

export function AnnotationsPopover() {
	const { annotations, setAnnotations } = useProDashboardAnnotations()
	const [date, setDate] = useState('')
	const [label, setLabel] = useState('')
	const popover = Ariakit.usePopoverStore({ placement: 'bottom-end' })
	const atLimit = annotations.length >= MAX_DASHBOARD_ANNOTATIONS
	const trimmedLabel = label.trim()
	const canAdd = !atLimit && isValidAnnotationDate(date) && trimmedLabel.length > 0

	const addAnnotation = () => {
		if (!canAdd) return
		const annotation: DashboardAnnotation = { id: generateItemId('annotation', date), date, label: trimmedLabel }
		setAnnotations([...annotations, annotation].toSorted((a, b) => a.date.localeCompare(b.date)))
		setLabel('')
	}

	const removeAnnotation = (id: string) => {
		setAnnotations(annotations.filter((annotation) => annotation.id !== id))
	}

	return (
		<Ariakit.PopoverProvider store={popover}>
			<Ariakit.PopoverDisclosure render={<ProButton type="button" variant="ghost" />} title="Dashboard annotations">
				<Icon name="pin" height={14} width={14} />
				<span>Annotations</span>
				{annotations.length > 0 ? <ProBadge tone="info">{annotations.length}</ProBadge> : null}
			</Ariakit.PopoverDisclosure>
			<PopoverSurface variant="panel" gutter={8} dismiss="own">
				<div className="flex w-[340px] max-w-full flex-col">
					<div className="flex items-center gap-2 border-b border-subtle py-2 pr-1 pl-3">
						<div className="flex min-w-0 flex-1 flex-col gap-0.5">
							<Ariakit.PopoverHeading className="label-sm text-pro-text-primary">Annotations</Ariakit.PopoverHeading>
							<p className="body-xs text-pro-text-secondary">Dated marks shown on every time-series chart.</p>
						</div>
						<DrawerDismiss label="Close annotations" />
					</div>
					{annotations.length === 0 ? (
						<p className="px-3 py-3 body-sm text-pro-text-secondary">No annotations yet.</p>
					) : (
						<ul className="flex max-h-60 flex-col overflow-y-auto">
							{annotations.map((annotation) => (
								<li
									key={annotation.id}
									className="flex items-center gap-2 border-b border-subtle px-3 py-1.5 body-sm last-of-type:border-b-0"
								>
									<span className="shrink-0 font-jetbrains text-xs text-pro-text-secondary">{annotation.date}</span>
									<span className="min-w-0 flex-1 truncate text-pro-text-primary">{annotation.label}</span>
									<ProButton
										type="button"
										size="sm"
										square
										variant="ghost"
										aria-label={`Delete annotation ${annotation.label}`}
										onClick={() => removeAnnotation(annotation.id)}
									>
										<Icon name="trash-2" height={14} width={14} />
									</ProButton>
								</li>
							))}
						</ul>
					)}
					<form
						className="flex flex-col gap-2 border-t border-subtle px-3 py-2"
						onSubmit={(event) => {
							event.preventDefault()
							addAnnotation()
						}}
					>
						<div className="flex gap-2">
							<input
								type="date"
								aria-label="Annotation date"
								className={`${INPUT_STYLES} shrink-0`}
								value={date}
								// Adding the last allowed annotation from this field locks it; read-only keeps its focus.
								readOnly={atLimit}
								onChange={(event) => setDate(event.target.value)}
							/>
							<input
								type="text"
								aria-label="Annotation label"
								placeholder="Label"
								className={`${INPUT_STYLES} flex-1`}
								value={label}
								maxLength={DASHBOARD_ANNOTATION_LABEL_MAX_LENGTH}
								readOnly={atLimit}
								onChange={(event) => setLabel(event.target.value)}
							/>
						</div>
						<div className="flex items-center justify-between gap-2">
							<span className="body-xs text-pro-text-tertiary">
								{atLimit
									? `Limit of ${MAX_DASHBOARD_ANNOTATIONS} reached. Delete one to add another.`
									: `${annotations.length}/${MAX_DASHBOARD_ANNOTATIONS}`}
							</span>
							<ProButton
								type="submit"
								size="sm"
								variant="primary"
								disabled={!canAdd}
								accessibleWhenDisabled
								data-umami-event="dashboard-annotation-add"
							>
								<Icon name="plus" height={14} width={14} />
								<span>Add</span>
							</ProButton>
						</div>
					</form>
				</div>
			</PopoverSurface>
		</Ariakit.PopoverProvider>
	)
}
