import * as Ariakit from '@ariakit/react'
import { type FormEvent, useRef, useState } from 'react'
import { Button } from '~/ui/Button'
import { Field } from '~/ui/Field'
import { focusNeighbourOnLeave, showFieldErrors } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { DrawerDismiss, PopoverSurface } from '~/ui/PopoverSurface'
import { Tooltip } from '~/ui/Tooltip'
import { isValidAnnotationDate } from '../dashboardConfig/migrate'
import {
	DASHBOARD_ANNOTATION_LABEL_MAX_LENGTH,
	type DashboardAnnotation,
	MAX_DASHBOARD_ANNOTATIONS
} from '../dashboardTypes'
import { useProDashboardAnnotations } from '../ProDashboardAPIContext'
import { ProBadge } from '../ui'
import { generateItemId } from '../utils/dashboardUtils'

export function AnnotationsPopover() {
	const { annotations } = useProDashboardAnnotations()
	// The draft outlives a close, so a half-typed annotation is still there on the next opening.
	const [date, setDate] = useState('')
	const [label, setLabel] = useState('')
	const popover = Ariakit.usePopoverStore({ placement: 'bottom-end' })

	return (
		<Ariakit.PopoverProvider store={popover}>
			<Ariakit.PopoverDisclosure render={<Button size="md" type="button" variant="ghost" />}>
				<Icon name="pin" className="size-3.5" />
				<span>Annotations</span>
				{/* Unpadded, the count fits the md button's 32px height instead of growing it. */}
				{annotations.length > 0 ? (
					<ProBadge tone="info" className="py-0!">
						{annotations.length}
					</ProBadge>
				) : null}
			</Ariakit.PopoverDisclosure>
			<PopoverSurface variant="panel" gutter={8} dismiss="own">
				{/* The surface unmounts on hide, so each opening starts with its errors quiet. */}
				<AnnotationsPanel date={date} label={label} onDateChange={setDate} onLabelChange={setLabel} />
			</PopoverSurface>
		</Ariakit.PopoverProvider>
	)
}

function AnnotationsPanel({
	date,
	label,
	onDateChange,
	onLabelChange
}: {
	date: string
	label: string
	onDateChange: (date: string) => void
	onLabelChange: (label: string) => void
}) {
	const { annotations, setAnnotations } = useProDashboardAnnotations()
	const [submitted, setSubmitted] = useState(false)
	const dateInputRef = useRef<HTMLInputElement>(null)
	const atLimit = annotations.length >= MAX_DASHBOARD_ANNOTATIONS
	const trimmedLabel = label.trim()
	// A date field holds a full date or nothing.
	const dateError = isValidAnnotationDate(date) ? null : 'Enter a date.'
	const labelError = trimmedLabel ? null : 'Enter a label.'

	const addAnnotation = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		// At the limit the fields are read-only and Add is disabled, but Enter in a field still submits.
		if (atLimit) return
		if (dateError || labelError) return showFieldErrors(event.currentTarget, () => setSubmitted(true))
		const annotation: DashboardAnnotation = { id: generateItemId('annotation', date), date, label: trimmedLabel }
		setAnnotations([...annotations, annotation].toSorted((a, b) => a.date.localeCompare(b.date)))
		onLabelChange('')
		setSubmitted(false)
	}

	return (
		<div className="flex w-[340px] max-w-full flex-col">
			<div className="flex items-center gap-2 border-b border-subtle py-2 pr-1 pl-3">
				<div className="flex min-w-0 flex-1 flex-col gap-0.5">
					<Ariakit.PopoverHeading className="label-sm text-primary">Annotations</Ariakit.PopoverHeading>
					<p className="body-xs text-secondary">Dated marks shown on every time-series chart.</p>
				</div>
				<DrawerDismiss label="Close annotations" />
			</div>
			{annotations.length === 0 ? (
				<p className="px-3 py-3 body-sm text-secondary">No annotations yet.</p>
			) : (
				<ul className="flex max-h-60 flex-col overflow-y-auto">
					{annotations.map((annotation) => (
						<li
							key={annotation.id}
							data-row
							className="flex items-center gap-2 border-b border-subtle px-3 py-1.5 body-sm last-of-type:border-b-0"
						>
							<span className="shrink-0 mono-sm text-secondary">{annotation.date}</span>
							<span className="min-w-0 flex-1 truncate text-primary">{annotation.label}</span>
							<Tooltip
								content="Delete annotation"
								render={
									<Button
										type="button"
										size="sm"
										square
										variant="ghostDestructive"
										aria-label={`Delete annotation ${annotation.label}`}
										// After the last row, the date field that adds one.
										ref={focusNeighbourOnLeave(() => dateInputRef.current)}
										onClick={() => setAnnotations(annotations.filter((item) => item.id !== annotation.id))}
									/>
								}
							>
								<Icon name="trash-2" className="size-4" />
							</Tooltip>
						</li>
					))}
				</ul>
			)}
			<form noValidate className="flex flex-col gap-2 border-t border-subtle px-3 py-2" onSubmit={addAnnotation}>
				<div className="flex gap-2">
					<Field label="Date" error={submitted ? dateError : null} className="shrink-0">
						{(control) => (
							<Input
								{...control}
								ref={dateInputRef}
								type="date"
								required
								className="cursor-pointer"
								value={date}
								// Adding the last allowed annotation from this field locks it; read-only keeps its focus.
								readOnly={atLimit}
								aria-disabled={atLimit || undefined}
								onChange={(event) => onDateChange(event.target.value)}
							/>
						)}
					</Field>
					<Field label="Label" error={submitted ? labelError : null} className="flex-1">
						{(control) => (
							<Input
								{...control}
								type="text"
								required
								placeholder="e.g. Merge"
								value={label}
								maxLength={DASHBOARD_ANNOTATION_LABEL_MAX_LENGTH}
								readOnly={atLimit}
								aria-disabled={atLimit || undefined}
								onChange={(event) => onLabelChange(event.target.value)}
							/>
						)}
					</Field>
				</div>
				<div className="flex items-center justify-between gap-2">
					<span className="body-xs text-tertiary">
						{atLimit
							? `Limit of ${MAX_DASHBOARD_ANNOTATIONS} reached. Delete one to add another.`
							: `${annotations.length}/${MAX_DASHBOARD_ANNOTATIONS}`}
					</span>
					<Button
						type="submit"
						size="sm"
						variant="primary"
						disabled={atLimit}
						accessibleWhenDisabled
						data-umami-event="dashboard-annotation-add"
					>
						<Icon name="plus" className="size-3.5" />
						<span>Add</span>
					</Button>
				</div>
			</form>
		</div>
	)
}
