import clsx from 'clsx'
import { type KeyboardEvent, type MouseEvent, useRef, useState } from 'react'
import { Input, Textarea } from './Input'
import { BusyGlyph } from './Status'
import { Tooltip } from './Tooltip'

/* ----------------------------------------------------------------------------
   InlineTextField: text that edits in place (a dashboard's name and
   description, a section title). The value shows as a button; pressing it
   swaps in the field, selected. InlineRenameInput is that field alone, for a
   rename whose trigger lives elsewhere (a tab's Rename menu item, a row's
   pencil): the caller shows it while renaming and hides it when it reports.

   The field is Input or Textarea `variant="inline"`: it takes the text's own
   type and color from its parent (put the type on the heading or line that
   holds it, never on these parts) and stands where the text was, with a
   brand ring. Keyboard, the same at every site:
   - Enter saves (Shift+Enter is a new line in a multiline field), Escape
     cancels, leaving the field saves. Each edit reports once: the blur that
     follows Enter or Escape is ignored. Keys typed while an IME composes
     belong to the composition.
   - Keys and presses stay inside the field, so a tab bar's arrows, a card's
     shortcuts, a dialog's Escape and a row's click never see them.
   - `onCommit` gets the raw text and whether a key finished the edit; the
     caller trims, keeps the old name for a blank (docs/focus-and-errors.md)
     and, after a key, puts focus back on what the field replaced. A pointer
     that leaves the field keeps focus where it went.

   InlineTextField does all of that itself: it trims, clips to `maxLength`,
   reports only a changed value, and returns focus to the value after Enter
   or Escape. Empty, it shows the placeholder in text-tertiary italics.
   `status` marks the save the caller runs: saving shows a spinner on the
   value and marks it busy; error rings it red and announces `errorMessage`.
   `className` is placement only on both parts.
---------------------------------------------------------------------------- */

// Module scope keeps the ref callback's identity stable, so it runs once per edit, when the field mounts.
function focusAndSelect(field: HTMLInputElement | HTMLTextAreaElement | null) {
	field?.focus()
	field?.select()
}

export function InlineRenameInput({
	initial,
	label,
	multiline = false,
	maxLength,
	placeholder,
	invalid = false,
	className,
	onCommit,
	onCancel
}: {
	initial: string
	/** The field's accessible name ("Rename Weekly volume", "Section title"). */
	label: string
	multiline?: boolean
	maxLength?: number
	placeholder?: string
	/** The last save of this value failed. */
	invalid?: boolean
	/** Layout placement only. */
	className?: string
	onCommit: (value: string, fromKeyboard: boolean) => void
	onCancel: () => void
}) {
	const [value, setValue] = useState(initial)
	const finished = useRef(false)
	const field = {
		ref: focusAndSelect,
		value,
		maxLength,
		placeholder,
		'aria-label': label,
		'aria-invalid': invalid || undefined,
		className,
		onChange: (event: { target: { value: string } }) => setValue(event.target.value),
		onKeyDown: (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
			event.stopPropagation()
			if (event.nativeEvent.isComposing) return
			if (event.key === 'Enter' && !(multiline && event.shiftKey)) {
				event.preventDefault()
				finished.current = true
				onCommit(value, true)
			} else if (event.key === 'Escape') {
				event.preventDefault()
				finished.current = true
				onCancel()
			}
		},
		onBlur: () => {
			if (finished.current) return
			finished.current = true
			onCommit(value, false)
		},
		onClick: (event: MouseEvent) => event.stopPropagation()
	}
	return multiline ? <Textarea variant="inline" rows={2} {...field} /> : <Input variant="inline" {...field} />
}

export function InlineTextField({
	value,
	label,
	placeholder,
	maxLength,
	autoFocus = false,
	multiline = false,
	status = 'idle',
	errorMessage,
	className,
	onCommit
}: {
	value: string
	/** The field's accessible name while editing ("Dashboard name"). */
	label: string
	/** Shown in place of an empty value, and in the empty field. */
	placeholder: string
	maxLength: number
	/** Opens the field, now or when it turns on later (a section just added). */
	autoFocus?: boolean
	multiline?: boolean
	status?: 'idle' | 'saving' | 'error'
	errorMessage?: string
	/** Layout placement only. */
	className?: string
	onCommit: (next: string) => void
}) {
	const [editing, setEditing] = useState(autoFocus)
	const [seenAutoFocus, setSeenAutoFocus] = useState(autoFocus)
	if (autoFocus !== seenAutoFocus) {
		setSeenAutoFocus(autoFocus)
		if (autoFocus) setEditing(true)
	}
	// Set by Enter and Escape; the value button takes focus when it mounts after one of them.
	const returnFocusToButtonRef = useRef(false)
	const saving = status === 'saving'
	const failed = status === 'error'
	return (
		<span className={clsx('relative flex min-w-0 flex-col', className)}>
			{editing ? (
				<InlineRenameInput
					initial={value}
					label={label}
					multiline={multiline}
					maxLength={maxLength}
					placeholder={placeholder}
					invalid={failed}
					onCommit={(draft, fromKeyboard) => {
						returnFocusToButtonRef.current = fromKeyboard
						setEditing(false)
						const next = draft.trim().slice(0, maxLength)
						if (next !== value) onCommit(next)
					}}
					onCancel={() => {
						returnFocusToButtonRef.current = true
						setEditing(false)
					}}
				/>
			) : (
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
							aria-busy={saving || undefined}
							onClick={() => setEditing(true)}
							className={clsx(
								'min-w-0 rounded-sm text-left transition-colors duration-120 ease-out-quart hover:bg-hover-row',
								saving && 'pr-5',
								failed && 'ring-1 ring-error',
								!value && 'text-tertiary italic'
							)}
						/>
					}
				>
					{value || placeholder}
				</Tooltip>
			)}
			{saving ? (
				<span className="pointer-events-none absolute top-1 right-1 text-tertiary">
					<BusyGlyph label="Saving" size={12} hideLabel />
				</span>
			) : null}
			{failed && errorMessage ? (
				<span role="alert" className="mt-1 block body-sm text-error">
					{errorMessage}
				</span>
			) : null}
		</span>
	)
}
