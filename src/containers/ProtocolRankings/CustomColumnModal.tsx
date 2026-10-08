import * as Ariakit from '@ariakit/react'
import { useId, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from 'react'
import { flushSync } from 'react-dom'
import { useAuthContext } from '~/auth'
import { setSignupSource } from '~/auth/signupSource'
import { LazySubscribeProModal } from '~/containers/Subscription/shared/SubscribeCards/LazySubscribeProModal'
import type { CustomColumnDef } from '~/contexts/LocalStorage'
import { Button } from '~/ui/Button'
import {
	Dialog,
	DialogBody,
	DialogCancelButton,
	DialogDiscardGuard,
	DialogFooter,
	DialogHeader,
	useOpeningKey
} from '~/ui/Dialog'
import { Field } from '~/ui/Field'
import { showFieldErrors } from '~/ui/focus'
import { Input, inputStyles } from '~/ui/Input'
import { popoverRowStyles } from '~/ui/Popover'
import { AVAILABLE_FIELDS, AVAILABLE_FUNCTIONS, replaceAliases } from './customColumnsUtils'
import { evaluateFormula, formatCustomColumnValue, type FormulaValue } from './formula.service'
import type { IProtocol } from './types'

type CustomColumnDraft = Omit<CustomColumnDef, 'id'>

type FormulaSuggestion = { name: string; type: string; args?: string }

interface CustomColumnState {
	name: string
	formula: string
	formatType: CustomColumnDef['formatType']
	submitted: boolean
	/** Empty while the suggestion list is closed. */
	suggestions: Array<FormulaSuggestion>
	highlighted: number
	fieldWarning: string | null
}

function getFilteredSuggestions(word: string): Array<FormulaSuggestion> {
	const wordLower = word.toLowerCase()
	const functionMatches = AVAILABLE_FUNCTIONS.filter((f) => f.name.toLowerCase().startsWith(wordLower))
	const fieldMatches = AVAILABLE_FIELDS.filter((f) => f.toLowerCase().startsWith(wordLower))
	return [...fieldMatches.map((f) => ({ name: f, type: 'field' })), ...functionMatches]
}

function inferCustomColumnFormat(value: FormulaValue): NonNullable<CustomColumnDef['determinedFormat']> {
	if (typeof value === 'boolean') return 'boolean'
	if (typeof value !== 'number') return 'string'
	if (value >= 0 && value <= 1) return 'percent'
	if (Math.abs(value) > 1000) return 'usd'
	return 'number'
}

/** Adds a custom column (`column` null) or edits `column`. Every opening starts from the column as saved. */
export function CustomColumnModal({
	open,
	onClose,
	column,
	onSave,
	sampleRow
}: {
	open: boolean
	onClose: () => void
	column: CustomColumnDef | null
	onSave: (def: CustomColumnDraft) => void
	sampleRow: IProtocol
}) {
	const opening = useOpeningKey(open)
	return (
		// Suggestions open below the formula as it is typed, so the phone sheet keeps its full height.
		<Dialog size="md" fullSheet open={open} onClose={onClose} unmountOnHide portal>
			<CustomColumnForm key={opening} column={column} onSave={onSave} sampleRow={sampleRow} />
		</Dialog>
	)
}

function CustomColumnForm({
	column,
	onSave,
	sampleRow
}: {
	column: CustomColumnDef | null
	onSave: (def: CustomColumnDraft) => void
	sampleRow: IProtocol
}) {
	const initialName = column?.name ?? ''
	const initialFormula = column?.formula ?? ''
	const initialFormatType = column?.formatType ?? 'auto'
	const [state, setState] = useState<CustomColumnState>({
		name: initialName,
		formula: initialFormula,
		formatType: initialFormatType,
		submitted: false,
		suggestions: [],
		highlighted: 0,
		fieldWarning: null
	})
	const inputRef = useRef<HTMLInputElement>(null)
	const fieldId = useId()
	const { isAuthenticated, hasActiveSubscription } = useAuthContext()
	const subscribeModalStore = Ariakit.useDialogStore()
	const formula = state.formula.trim()
	const formulaEvaluation = useMemo(
		() => (formula ? evaluateFormula(replaceAliases(formula), sampleRow) : null),
		[formula, sampleRow]
	)
	const nameError = state.name.trim() ? null : 'Enter a column name.'
	const formulaError = !formula
		? 'Enter a formula.'
		: formulaEvaluation?.status === 'error'
			? `Invalid formula: ${formulaEvaluation.error}`
			: null
	// A formula that does not parse says so as it is typed; an empty one waits for Save.
	const shownFormulaError = state.submitted || formula ? formulaError : null
	const suggestionsOpen = state.suggestions.length > 0

	const handleFormulaChange = (e: ChangeEvent<HTMLInputElement>) => {
		const value = e.target.value
		const cursorPos = e.target.selectionStart ?? value.length
		const beforeCursor = value.slice(0, cursorPos)
		const match = beforeCursor.match(/([a-zA-Z0-9_]+)$/)
		const word = match?.[1] ?? ''
		const suggestions = word ? getFilteredSuggestions(word) : []
		const wordLower = word.toLowerCase()
		const fieldWarning =
			word &&
			!AVAILABLE_FIELDS.some((field) => field.toLowerCase() === wordLower) &&
			!AVAILABLE_FUNCTIONS.some((item) => item.name.toLowerCase() === wordLower) &&
			Number.isNaN(Number(word))
				? `Field or function '${word}' is not available.`
				: null

		setState((prev) => ({ ...prev, formula: value, suggestions, highlighted: 0, fieldWarning }))
	}

	const handleSuggestionClick = (item: FormulaSuggestion) => {
		const input = inputRef.current!
		const cursorPos = input.selectionStart ?? state.formula.length
		const beforeCursor = state.formula.slice(0, cursorPos)
		const afterCursor = state.formula.slice(cursorPos)
		const word = beforeCursor.match(/([a-zA-Z0-9_]+)$/)?.[1] ?? ''
		const head = beforeCursor.slice(0, beforeCursor.length - word.length) + item.name
		// A function lands with its parentheses and the cursor between them.
		const isCall = item.type === 'function' || item.type === 'operator'
		const nextFormula = isCall ? `${head}()${afterCursor}` : head + afterCursor
		const cursor = head.length + (isCall ? 1 : 0)
		flushSync(() => setState((prev) => ({ ...prev, formula: nextFormula, suggestions: [], fieldWarning: null })))
		input.focus()
		input.setSelectionRange(cursor, cursor)
	}

	const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
		if (state.suggestions.length === 0) return
		if (e.key === 'ArrowDown') {
			setState((prev) => ({ ...prev, highlighted: Math.min(prev.highlighted + 1, prev.suggestions.length - 1) }))
			e.preventDefault()
		} else if (e.key === 'ArrowUp') {
			setState((prev) => ({ ...prev, highlighted: Math.max(prev.highlighted - 1, 0) }))
			e.preventDefault()
		} else if (e.key === 'Enter') {
			const suggestion = state.suggestions[state.highlighted]
			if (suggestion) {
				handleSuggestionClick(suggestion)
				e.preventDefault()
			}
		} else if (e.key === 'Escape') {
			// Dismiss the suggestions only; the enclosing Ariakit dialog stays open.
			e.stopPropagation()
			setState((prev) => ({ ...prev, suggestions: [] }))
		}
	}

	const handleSave = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		if (nameError || formulaError) {
			return showFieldErrors(event.currentTarget, () => setState((prev) => ({ ...prev, submitted: true })))
		}
		if (!isAuthenticated || !hasActiveSubscription) {
			setSignupSource('custom-columns')
			subscribeModalStore.show()
			return
		}
		const determinedFormat =
			state.formatType === 'auto' && formulaEvaluation?.status === 'success'
				? inferCustomColumnFormat(formulaEvaluation.value)
				: undefined

		onSave({
			name: state.name.trim(),
			formula: state.formula.trim(),
			formatType: state.formatType,
			...(determinedFormat ? { determinedFormat } : {})
		})
	}

	const hasFormulaError = formulaEvaluation?.status === 'error'
	const dirty = state.name !== initialName || state.formula !== initialFormula || state.formatType !== initialFormatType
	let previewFormat: NonNullable<CustomColumnDef['determinedFormat']> | null = null
	let preview: string | null = null
	if (formulaEvaluation?.status === 'success') {
		previewFormat = state.formatType === 'auto' ? inferCustomColumnFormat(formulaEvaluation.value) : state.formatType
		preview =
			previewFormat === 'boolean' && typeof formulaEvaluation.value === 'boolean'
				? formulaEvaluation.value
					? '✅ True'
					: '❌ False'
				: formatCustomColumnValue(formulaEvaluation.value, previewFormat)
	}
	const autoFormatLabel = previewFormat
		? previewFormat === 'usd'
			? 'USD'
			: previewFormat.charAt(0).toUpperCase() + previewFormat.slice(1)
		: 'Unknown'

	return (
		<>
			{/* The subscribe dialog stays outside the form: React carries a portal's submit up its own tree. */}
			<form noValidate onSubmit={handleSave} className="flex min-h-0 flex-auto flex-col">
				<DialogDiscardGuard
					when={dirty}
					title={column ? 'Discard changes to this column?' : 'Discard this column?'}
					description="The name, formula and format you entered are lost."
				/>
				<DialogHeader title={column ? 'Edit custom column' : 'Add custom column'} />
				<DialogBody>
					<Field label="Column name" error={state.submitted ? nameError : null}>
						{(control) => (
							<Ariakit.Focusable
								autoFocus
								render={
									<Input
										{...control}
										required
										value={state.name}
										onChange={(e) => setState((prev) => ({ ...prev, name: e.target.value }))}
										placeholder="Custom Column"
									/>
								}
							/>
						)}
					</Field>
					{/* Live: the parse error shows as the formula is typed. */}
					<Field
						label="Formula"
						live
						hint={
							!shownFormulaError && state.fieldWarning ? (
								<span className="text-warning">{state.fieldWarning}</span>
							) : null
						}
						error={shownFormulaError}
					>
						{(control) => (
							<div className="relative">
								<Input
									{...control}
									ref={inputRef}
									required
									role="combobox"
									aria-autocomplete="list"
									aria-expanded={suggestionsOpen}
									aria-controls={suggestionsOpen ? `${fieldId}-suggestions` : undefined}
									aria-activedescendant={suggestionsOpen ? `${fieldId}-suggestion-${state.highlighted}` : undefined}
									className="w-full"
									value={state.formula}
									onChange={handleFormulaChange}
									onKeyDown={handleKeyDown}
									placeholder="e.g. revenue_30d / tvl"
									autoComplete="off"
								/>
								{suggestionsOpen ? (
									<div
										id={`${fieldId}-suggestions`}
										role="listbox"
										aria-label="Formula suggestions"
										className="absolute right-0 left-0 z-10 mt-1 max-h-40 overflow-y-auto overscroll-contain rounded-xl border border-medium bg-overlay shadow-overlay"
									>
										{state.suggestions.map((s, i) => (
											<div
												key={s.name}
												id={`${fieldId}-suggestion-${i}`}
												role="option"
												// Focus stays in the formula, which points at the highlighted option.
												tabIndex={-1}
												aria-selected={i === state.highlighted}
												data-active-item={i === state.highlighted || undefined}
												className={popoverRowStyles}
												onMouseDown={(e) => {
													// Keep focus in the formula while a suggestion is picked.
													e.preventDefault()
													handleSuggestionClick(s)
												}}
											>
												<span className="flex items-center gap-2">
													{s.type === 'function' || s.type === 'operator' ? <span className="text-link">ƒ</span> : null}
													<span>{s.name}</span>
												</span>
											</div>
										))}
									</div>
								) : null}
							</div>
						)}
					</Field>
					<Field
						label="Format"
						hint={
							state.formatType === 'auto' && formula && !hasFormulaError
								? `Auto will format as: ${autoFormatLabel}`
								: null
						}
					>
						{(control) => (
							<select
								{...control}
								className={`${inputStyles} w-full`}
								value={state.formatType}
								// The options below are exactly the format values.
								onChange={(e) =>
									setState((prev) => ({ ...prev, formatType: e.target.value as CustomColumnDef['formatType'] }))
								}
							>
								<option value="auto">Auto</option>
								<option value="number">Number</option>
								<option value="usd">USD</option>
								<option value="percent">Percent</option>
								<option value="string">String</option>
								<option value="boolean">Boolean (checkmark)</option>
							</select>
						)}
					</Field>
					<div className="flex flex-col gap-1">
						<p className="label-sm text-secondary">Available fields</p>
						<ul className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto rounded-lg border border-medium bg-page p-2">
							{AVAILABLE_FIELDS.map((f) => (
								<li key={f}>
									<Button size="sm" onClick={() => handleSuggestionClick({ name: f, type: 'field' })}>
										<span className="font-mono">{f}</span>
									</Button>
								</li>
							))}
						</ul>
					</div>
					{formula && !hasFormulaError ? (
						<p className="body-sm">
							<span className="font-semibold text-secondary">Preview: </span>
							<span className="rounded-sm bg-page px-2 py-1 text-primary">{preview}</span>
						</p>
					) : null}
					<a
						href="https://docs.llama.fi/analysts/custom-columns"
						target="_blank"
						className="body-sm text-link hover:underline"
						rel="noreferrer"
					>
						Learn more on how to create custom columns
					</a>
				</DialogBody>
				<DialogFooter dismiss={<DialogCancelButton />}>
					<Button type="submit" variant="primary" size="md">
						Save
					</Button>
				</DialogFooter>
			</form>
			<LazySubscribeProModal dialogStore={subscribeModalStore} />
		</>
	)
}
