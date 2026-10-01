import * as Ariakit from '@ariakit/react'
import { lazy, Suspense, useId, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { flushSync } from 'react-dom'
import { useAuthContext } from '~/auth'
import { setSignupSource } from '~/auth/signupSource'
import { isCustomColumnFormat, type CustomColumnDef } from '~/contexts/LocalStorage'
import { Button } from '~/ui/Button'
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '~/ui/Dialog'
import { Input, inputStyles } from '~/ui/Input'
import { popoverRowStyles } from '~/ui/Popover'
import { InlineStatus } from '~/ui/Status'
import { AVAILABLE_FIELDS, AVAILABLE_FUNCTIONS, replaceAliases } from './customColumnsUtils'
import { evaluateFormula, formatCustomColumnValue, type FormulaValue } from './formula.service'
import type { IProtocol } from './types'

const SubscribeProModal = lazy(() =>
	import('~/containers/Subscription/shared/SubscribeCards/SubscribeProCard').then((m) => ({
		default: m.SubscribeProModal
	}))
)

interface CustomColumnModalProps {
	dialogStore: Ariakit.DialogStore
	onSave: (def: CustomColumnDef) => void
	sampleRow: IProtocol
	name?: string
	formula?: string
	formatType?: CustomColumnDef['formatType']
	displayAs?: string
}

type FormulaSuggestion = { name: string; type: string; args?: string }

interface CustomColumnState {
	name: string
	formula: string
	formatType: CustomColumnDef['formatType']
	submissionError: string | null
	showSuggestions: boolean
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

export function CustomColumnModal({
	dialogStore,
	onSave,
	sampleRow,
	name: initialName = '',
	formula: initialFormula = '',
	formatType: initialFormatType = 'auto',
	displayAs: _initialDisplayAs = 'auto'
}: CustomColumnModalProps) {
	const [state, setState] = useState<CustomColumnState>({
		name: initialName,
		formula: initialFormula,
		formatType: initialFormatType,
		submissionError: null,
		showSuggestions: false,
		suggestions: [],
		highlighted: 0,
		fieldWarning: null
	})
	const inputRef = useRef<HTMLInputElement>(null)
	const fieldId = useId()
	const { isAuthenticated, hasActiveSubscription } = useAuthContext()
	const [shouldRenderModal, setShouldRenderModal] = useState(false)
	const subscribeModalStore = Ariakit.useDialogStore({ open: shouldRenderModal, setOpen: setShouldRenderModal })
	const formula = state.formula.trim()
	const formulaEvaluation = useMemo(
		() => (formula ? evaluateFormula(replaceAliases(formula), sampleRow) : null),
		[formula, sampleRow]
	)
	const formulaError = formulaEvaluation?.status === 'error' ? `Invalid formula: ${formulaEvaluation.error}` : null

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

		setState((prev) => ({
			...prev,
			formula: value,
			submissionError: null,
			suggestions,
			showSuggestions: suggestions.length > 0,
			highlighted: 0,
			fieldWarning
		}))
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
		flushSync(() =>
			setState((prev) => ({
				...prev,
				formula: nextFormula,
				showSuggestions: false,
				fieldWarning: null,
				submissionError: null
			}))
		)
		input.focus()
		input.setSelectionRange(cursor, cursor)
	}

	const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
		if (!state.showSuggestions) return
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
			setState((prev) => ({ ...prev, showSuggestions: false }))
		}
	}

	const handleSave = () => {
		if (!state.name.trim() || !state.formula.trim()) {
			setState((prev) => ({ ...prev, submissionError: 'Name and formula are required' }))
			return
		}
		if (formulaEvaluation?.status === 'error') return
		if (!isAuthenticated || !hasActiveSubscription) {
			setSignupSource('custom-columns')
			setShouldRenderModal(true)
			return
		}
		setState((prev) => ({ ...prev, submissionError: null }))

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
			<Ariakit.DialogProvider store={dialogStore}>
				{/* Suggestions open below the formula as it is typed, so the phone sheet keeps its full height. */}
				<Dialog size="md" fullSheet unmountOnHide portal>
					<DialogHeader title={initialName ? 'Edit custom column' : 'Add custom column'} />
					<DialogBody>
						<div className="flex flex-col gap-1">
							<label htmlFor={`${fieldId}-name`} className="label-sm text-secondary">
								Column name
							</label>
							<Ariakit.Focusable
								autoFocus
								render={
									<Input
										id={`${fieldId}-name`}
										value={state.name}
										onChange={(e) => setState((prev) => ({ ...prev, name: e.target.value, submissionError: null }))}
										placeholder="Custom Column"
									/>
								}
							/>
						</div>
						<div className="flex flex-col gap-1">
							<label htmlFor={`${fieldId}-formula`} className="label-sm text-secondary">
								Formula
							</label>
							<div className="relative">
								<Input
									id={`${fieldId}-formula`}
									ref={inputRef}
									aria-invalid={formulaError ? true : undefined}
									aria-describedby={formulaError || state.fieldWarning ? `${fieldId}-formula-note` : undefined}
									className="w-full"
									value={state.formula}
									onChange={handleFormulaChange}
									onKeyDown={handleKeyDown}
									placeholder="e.g. revenue_30d / tvl"
									autoComplete="off"
								/>
								{state.showSuggestions ? (
									<ul className="absolute right-0 left-0 z-10 mt-1 max-h-40 overflow-y-auto overscroll-contain rounded-xl border border-medium bg-overlay shadow-overlay-sm">
										{state.suggestions.map((s, i) => (
											// oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- the input owns arrow-key and Enter selection for these suggestions.
											<li
												key={s.name}
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
											</li>
										))}
									</ul>
								) : null}
							</div>
							{formulaError || state.fieldWarning ? (
								<p
									id={`${fieldId}-formula-note`}
									className={`body-sm ${formulaError ? 'text-data-down' : 'text-warning'}`}
								>
									{formulaError ?? state.fieldWarning}
								</p>
							) : null}
						</div>
						<div className="flex flex-col gap-1">
							<label htmlFor={`${fieldId}-format`} className="label-sm text-secondary">
								Format
							</label>
							<select
								id={`${fieldId}-format`}
								className={`${inputStyles} w-full`}
								value={state.formatType}
								onChange={(e) => {
									const formatType = e.target.value
									if (isCustomColumnFormat(formatType)) {
										setState((prev) => ({ ...prev, formatType }))
									}
								}}
							>
								<option value="auto">Auto</option>
								<option value="number">Number</option>
								<option value="usd">USD</option>
								<option value="percent">Percent</option>
								<option value="string">String</option>
								<option value="boolean">Boolean (checkmark)</option>
							</select>
							{state.formatType === 'auto' && formula && !hasFormulaError ? (
								<p className="body-sm text-secondary">Auto will format as: {autoFormatLabel}</p>
							) : null}
						</div>
						<div className="flex flex-col gap-1">
							<p className="label-sm text-secondary">Available fields</p>
							<ul className="grid max-h-32 grid-cols-2 gap-x-4 gap-y-1 overflow-y-auto rounded-lg border border-medium bg-page p-2">
								{AVAILABLE_FIELDS.map((f) => (
									<li key={f}>
										<button
											type="button"
											className="hover-wash cursor-pointer rounded-sm bg-surface-elevated-1 px-1 py-0.5 font-mono text-link"
											onClick={() => handleSuggestionClick({ name: f, type: 'field' })}
										>
											{f}
										</button>
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
						{state.submissionError ? <InlineStatus variant="error">{state.submissionError}</InlineStatus> : null}
					</DialogBody>
					<DialogFooter
						dismiss={<Ariakit.DialogDismiss render={<Button type="button" size="md" />}>Cancel</Ariakit.DialogDismiss>}
					>
						<Button type="button" variant="primary" size="md" onClick={handleSave}>
							Save
						</Button>
					</DialogFooter>
				</Dialog>
			</Ariakit.DialogProvider>
			{shouldRenderModal ? (
				<Suspense fallback={null}>
					<SubscribeProModal dialogStore={subscribeModalStore} />
				</Suspense>
			) : null}
		</>
	)
}
