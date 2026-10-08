import { type ReactNode, useId } from 'react'

/* ----------------------------------------------------------------------------
   Field — a form control with its visible label, an optional hint and its
   error. FieldGroup is the same for a set of controls answered together
   (newsletter chips, delivery channels, a required pick of options).

   Validation (docs/focus-and-errors.md, "Validating a form"):
   - The submit button stays enabled. Disabling it to enforce input hides
     what is wrong; pressing it says what is wrong instead.
   - The form derives each error from its values and shows them only after
     the first submit (one `submitted` state), so an untouched form is quiet
     and each error clears as soon as its field is fixed.
   - A submit that finds an error calls `showFieldErrors(form, commit)`
     (./focus.ts): it renders the errors and focuses the first invalid
     field, so a screen reader reads the field with its error.
   - Forms take `noValidate`; the browser's own bubble never shows
     (scripts/policies/check-form-validation.ts). That also stops the
     browser enforcing `min`, `max`, `minLength`, `pattern` and `step`, so
     each needs a derived error of its own.
   - Copy: "Enter …" for missing text, "Choose …" for a missing pick,
     "Enter a valid …" for a malformed value. One sentence, no "Please".

   Layout: label-sm text-secondary label over the control, then the hint
   (body-sm text-tertiary) and the error (body-sm text-error), 4px apart.
   `action` sits on the label row's right (Forgot password?). The control is
   a render function that spreads the wiring onto it:
     <Field label="Email" error={errors.email}>
       {(control) => <Input {...control} type="email" value={email} … />}
     </Field>
   `aria-invalid` turns the Input recipe's border red; callers never add an
   error border. `className` is layout placement only.
   `hideLabel`: only for a control a search icon or its surface already
   names (a search box, a link bubble's URL); the label stays for screen
   readers. Every other field shows its label (design.md).
   A picker that draws its own label (VirtualizedSelect's `field`) takes
   `error` and wires it the same way, so it never sits inside a Field.
   `live`: for a check that runs while the reader types ("will this work?":
   a date the page refuses, a name already taken). Its changes are announced,
   since no submit moves focus to them. Submit errors never need it.
---------------------------------------------------------------------------- */

export type FieldControlProps = {
	id: string
	'aria-describedby': string | undefined
	'aria-invalid': true | undefined
}

function describedBy(hintId: string, errorId: string, hint: ReactNode, error: string | null | undefined) {
	return [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined
}

export function Field({
	label,
	hideLabel = false,
	action,
	hint,
	error,
	live = false,
	className,
	children
}: {
	label: ReactNode
	/** Screen-reader-only label, for a search box or an inline editor its surface already names. */
	hideLabel?: boolean
	/** A link or button on the label row's right, such as "Forgot password?". */
	action?: ReactNode
	hint?: ReactNode
	error?: string | null
	/** Announce the error as it changes; for checks that run while typing. */
	live?: boolean
	/** Layout placement only. */
	className?: string
	children: (control: FieldControlProps) => ReactNode
}) {
	const id = useId()
	const hintId = `${id}-hint`
	const errorId = `${id}-error`
	const control = children({
		id,
		'aria-describedby': describedBy(hintId, errorId, hint, error),
		'aria-invalid': error ? true : undefined
	})
	const labelElement = (
		<label htmlFor={id} className={hideLabel ? 'sr-only' : 'label-sm text-secondary'}>
			{label}
		</label>
	)
	return (
		<div data-invalid={error ? '' : undefined} className={`flex min-w-0 flex-col gap-1 ${className ?? ''}`.trim()}>
			{action ? (
				// The action sits on the label row but follows the control in tab order: a reader who types the label's
				// value and presses Tab reaches the next field, not "Forgot password?".
				<div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-2 gap-y-1">
					{labelElement}
					<div className="col-span-2 row-start-2 flex min-w-0 flex-col">{control}</div>
					<div className="col-start-2 row-start-1">{action}</div>
				</div>
			) : (
				<>
					{labelElement}
					{control}
				</>
			)}
			{hint ? (
				<p id={hintId} className="body-sm text-tertiary">
					{hint}
				</p>
			) : null}
			{error ? (
				// A live error is read out by the region below; the visible copy stays the description target only.
				<p id={errorId} aria-hidden={live || undefined} className="body-sm text-error">
					{error}
				</p>
			) : null}
			{/* Absolute (sr-only), so it takes no gap in the column; mounted throughout, as a live region must be. */}
			{live ? (
				<span aria-live="polite" className="sr-only">
					{error}
				</span>
			) : null}
		</div>
	)
}

export function FieldGroup({
	label,
	hint,
	error,
	className,
	children
}: {
	label: ReactNode
	hint?: ReactNode
	error?: string | null
	/** Layout placement only. */
	className?: string
	children: ReactNode
}) {
	const id = useId()
	const labelId = `${id}-label`
	const hintId = `${id}-hint`
	const errorId = `${id}-error`
	return (
		<div
			role="group"
			aria-labelledby={labelId}
			aria-describedby={describedBy(hintId, errorId, hint, error)}
			data-invalid={error ? '' : undefined}
			className={`flex min-w-0 flex-col gap-1 ${className ?? ''}`.trim()}
		>
			<span id={labelId} className="label-sm text-secondary">
				{label}
			</span>
			{children}
			{hint ? (
				<p id={hintId} className="body-sm text-tertiary">
					{hint}
				</p>
			) : null}
			{error ? (
				<p id={errorId} className="body-sm text-error">
					{error}
				</p>
			) : null}
		</div>
	)
}
