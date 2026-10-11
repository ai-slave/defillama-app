import { useId, useRef } from 'react'
import { useAuthContext } from '~/auth'
import { Button } from '~/ui/Button'
import { Field } from '~/ui/Field'
import { focusNeighborOnLeave } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Input, Textarea } from '~/ui/Input'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { Tooltip } from '~/ui/Tooltip'
import { DASHBOARD_DESCRIPTION_MAX_LENGTH } from '../dashboardTypes'

/* The fields every dashboard form shares (create, comparison, generate, settings), so each fact reads
   and behaves the same wherever it is asked. */

type Visibility = 'public' | 'private'

// One note per state. A free account keeps a private dashboard it already has, but cannot return to it.
function visibilityNote(value: Visibility, canMakePrivate: boolean, sharedWithTeam: boolean) {
	if (value === 'public') {
		return canMakePrivate
			? 'Anyone can find it in Discover.'
			: 'Anyone can find it in Discover. Private dashboards need Pro.'
	}
	const audience = sharedWithTeam ? 'Only your team can see it.' : 'Only you can see it.'
	return canMakePrivate ? audience : `${audience} Once public, it needs Pro to go private again.`
}

export function VisibilityField({
	value,
	onChange,
	sharedWithTeam,
	disabled
}: {
	value: Visibility
	onChange: (value: Visibility) => void
	sharedWithTeam: boolean
	disabled?: boolean
}) {
	const id = useId()
	const { hasActiveSubscription } = useAuthContext()
	// The radiogroup is the group, so it takes the label and hint ids instead of sitting in a FieldGroup.
	return (
		<div className="flex flex-col gap-1">
			<span id={`${id}-label`} className="label-sm text-secondary">
				Visibility
			</span>
			<SegmentedControl
				aria-labelledby={`${id}-label`}
				aria-describedby={`${id}-hint`}
				label="Visibility"
				variant="field"
				size="md"
				value={value}
				onValueChange={onChange}
				options={[
					{
						value: 'public',
						disabled,
						label: (
							<>
								<Icon name="globe" className="size-3.5" />
								Public
							</>
						)
					},
					{
						value: 'private',
						disabled: disabled || !hasActiveSubscription,
						label: (
							<>
								<Icon name={hasActiveSubscription ? 'key' : 'file-lock-2'} className="size-3.5" />
								{hasActiveSubscription ? 'Private' : 'Private (Pro)'}
							</>
						)
					}
				]}
			/>
			<p id={`${id}-hint`} className="body-sm text-tertiary">
				{visibilityNote(value, hasActiveSubscription, sharedWithTeam)}
			</p>
		</div>
	)
}

export function TagsField({
	tags,
	onChange,
	disabled
}: {
	tags: Array<string>
	onChange: (tags: Array<string>) => void
	disabled?: boolean
}) {
	const inputRef = useRef<HTMLInputElement>(null)
	const addTag = () => {
		const input = inputRef.current!
		const tag = input.value.trim().toLowerCase()
		if (tag && !tags.includes(tag)) onChange([...tags, tag])
		input.value = ''
	}
	return (
		<div className="flex flex-col gap-2">
			<Field label="Tags" hint="Press Enter to add a tag.">
				{(control) => (
					<div className="flex gap-2">
						<Input
							{...control}
							ref={inputRef}
							type="text"
							readOnly={disabled}
							placeholder="e.g. lending"
							// Enter adds the tag; it never submits the form around the field.
							onKeyDown={(e) => {
								if (disabled) return
								if (e.key === 'Enter') {
									e.preventDefault()
									addTag()
								}
								// Typed text is part of the draft: the first Escape adds it and keeps the dialog open, so the
								// next one asks through the dialog's discard question instead of dropping it.
								if (e.key === 'Escape' && e.currentTarget.value.trim()) {
									e.preventDefault()
									addTag()
								}
							}}
							// Leaving the field for Save, Cancel or Back adds the typed tag, so it is saved or asked about.
							onBlur={() => {
								if (!disabled) addTag()
							}}
							className="flex-1"
						/>
						<Button type="button" size="md" onClick={addTag} disabled={disabled}>
							Add tag
						</Button>
					</div>
				)}
			</Field>
			{tags.length > 0 ? (
				<ul aria-label="Added tags" className="flex flex-wrap gap-2">
					{tags.map((tag) => (
						<li
							key={tag}
							data-row
							className="flex max-w-full items-center gap-0.5 rounded-md border border-medium pl-2 body-sm text-secondary"
						>
							<span className="min-w-0 wrap-anywhere">{tag}</span>
							<Tooltip
								content="Remove tag"
								render={
									<Button
										type="button"
										variant="ghost"
										size="sm"
										square
										disabled={disabled}
										aria-label={`Remove tag ${tag}`}
										ref={focusNeighborOnLeave(() => inputRef.current)}
										onClick={() => onChange(tags.filter((t) => t !== tag))}
									/>
								}
							>
								<Icon name="x" className="size-4" />
							</Tooltip>
						</li>
					))}
				</ul>
			) : null}
		</div>
	)
}

export function DescriptionField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
	return (
		<Field label="Description" hint={`${value.length}/${DASHBOARD_DESCRIPTION_MAX_LENGTH} characters`}>
			{(control) => (
				<Textarea
					{...control}
					name="description"
					value={value}
					onChange={(e) => onChange(e.target.value)}
					placeholder="Describe your dashboard…"
					maxLength={DASHBOARD_DESCRIPTION_MAX_LENGTH}
					rows={3}
					className="resize-none"
				/>
			)}
		</Field>
	)
}
