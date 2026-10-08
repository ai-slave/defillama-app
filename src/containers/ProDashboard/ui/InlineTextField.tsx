import { useRef, useState } from 'react'
import { LoadingSpinner } from '~/ui/Loaders'
import { Tooltip } from '~/ui/Tooltip'
import { keepKeyboardEventsInsideCard } from './keyboard'

// The field mounts each time editing starts, so its text is selected once per edit.
const selectOnMount = (field: HTMLInputElement | HTMLTextAreaElement | null) => field?.select()

export type InlineTextFieldStatus = 'idle' | 'saving' | 'error'

interface InlineTextFieldProps {
	value: string
	placeholder: string
	maxLength: number
	autoFocus?: boolean
	multiline?: boolean
	disabled?: boolean
	status?: InlineTextFieldStatus
	errorMessage?: string
	className?: string | undefined
	onCommit: (next: string) => void
}

export function InlineTextField({
	value,
	placeholder,
	maxLength,
	autoFocus,
	multiline = false,
	disabled = false,
	status = 'idle',
	errorMessage,
	className,
	onCommit
}: InlineTextFieldProps) {
	const [draft, setDraft] = useState(value)
	const [editing, setEditing] = useState(autoFocus === true)
	const [committedValue, setCommittedValue] = useState(value)
	const [seenAutoFocus, setSeenAutoFocus] = useState(autoFocus === true)
	if ((autoFocus === true) !== seenAutoFocus) {
		setSeenAutoFocus(autoFocus === true)
		if (autoFocus) setEditing(true)
	}
	// Set by Enter and Escape; the value button takes focus when it mounts after one of them. A pointer blur leaves
	// focus where the pointer put it.
	const returnFocusToButtonRef = useRef(false)
	if (!editing && committedValue !== value) {
		setCommittedValue(value)
		setDraft(value)
	}
	const saving = status === 'saving'
	const failed = status === 'error'
	const blocked = disabled && !saving
	const wrapperClassName = `relative flex min-w-0 flex-col ${className ?? ''}`.trim()
	const statusClassName = `${saving ? 'pr-5 opacity-70' : ''} ${failed ? 'ring-1 ring-error' : ''}`
	const statusAffordances = (
		<>
			{saving ? (
				<span className="pointer-events-none absolute top-1 right-1 text-pro-text-tertiary">
					<LoadingSpinner size={12} />
				</span>
			) : null}
			{failed && errorMessage ? (
				<span role="alert" className="mt-1 block body-sm text-error">
					{errorMessage}
				</span>
			) : null}
		</>
	)
	if (!editing) {
		return (
			<span className={wrapperClassName}>
				<Tooltip
					content="Click to edit"
					render={
						<button
							ref={(button) => {
								if (!button || !returnFocusToButtonRef.current) return
								returnFocusToButtonRef.current = false
								button.focus()
							}}
							type="button"
							disabled={blocked}
							aria-busy={saving || undefined}
							onClick={() => {
								setDraft(value)
								setEditing(true)
							}}
							className={`${className ?? ''} min-w-0 rounded-sm text-left transition-colors duration-120 ease-out-quart hover:bg-pro-hover-fill/60 ${statusClassName} ${value ? '' : 'text-pro-text-tertiary italic'}`
								.replace(/\s+/g, ' ')
								.trim()}
						/>
					}
				>
					{value || placeholder}
				</Tooltip>
				{statusAffordances}
			</span>
		)
	}
	const commit = () => {
		setEditing(false)
		const next = draft.trim().slice(0, maxLength)
		if (next !== value) onCommit(next)
	}
	const commitFromKeyboard = () => {
		returnFocusToButtonRef.current = true
		commit()
	}
	const cancelFromKeyboard = () => {
		returnFocusToButtonRef.current = true
		setDraft(value)
		setEditing(false)
	}
	const fieldClassName =
		`${className ?? ''} min-w-0 rounded-sm border border-pro-cards-border bg-transparent px-1 outline-hidden focus:border-link ${statusClassName}`
			.replace(/\s+/g, ' ')
			.trim()
	const shared = {
		value: draft,
		maxLength,
		placeholder,
		disabled: blocked,
		autoFocus: true,
		'aria-busy': saving || undefined,
		onChange: (event: { target: { value: string } }) => setDraft(event.target.value),
		onBlur: commit,
		className: fieldClassName
	}
	if (multiline) {
		return (
			<span className={wrapperClassName}>
				<textarea
					ref={selectOnMount}
					rows={2}
					{...shared}
					onKeyDown={(event) => {
						keepKeyboardEventsInsideCard(event)
						if (event.key === 'Enter' && !event.shiftKey) {
							event.preventDefault()
							commitFromKeyboard()
						}
						if (event.key === 'Escape') cancelFromKeyboard()
					}}
				/>
				{statusAffordances}
			</span>
		)
	}
	return (
		<span className={wrapperClassName}>
			<input
				ref={selectOnMount}
				{...shared}
				onKeyDown={(event) => {
					keepKeyboardEventsInsideCard(event)
					if (event.key === 'Enter') commitFromKeyboard()
					if (event.key === 'Escape') cancelFromKeyboard()
				}}
			/>
			{statusAffordances}
		</span>
	)
}
