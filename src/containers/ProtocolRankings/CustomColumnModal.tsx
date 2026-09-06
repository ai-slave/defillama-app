import * as Ariakit from '@ariakit/react'
import { lazy, Suspense, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { useAuthContext } from '~/auth'
import { setSignupSource } from '~/auth/signupSource'
import { isCustomColumnFormat, type CustomColumnDef } from '~/contexts/LocalStorage'
import { Button } from '~/ui/Button'
import { DialogCloseButton, DialogHeading, dialogSurfaceStyles } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'
import { Input, inputStyles } from '~/ui/Input'
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
	const { isAuthenticated, hasActiveSubscription } = useAuthContext()
	const [shouldRenderModal, setShouldRenderModal] = useState(false)
	const subscribeModalStore = Ariakit.useDialogStore({ open: shouldRenderModal, setOpen: setShouldRenderModal })
	const formula = state.formula.trim()
	const formulaEvaluation = useMemo(
		() => (formula ? evaluateFormula(replaceAliases(formula), sampleRow) : null),
		[formula, sampleRow]
	)
	const formulaError = formulaEvaluation?.status === 'error' ? `Invalid formula: ${formulaEvaluation.error}` : null
	const displayedError = state.submissionError ?? formulaError

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
		setState((prev) => {
			const input = inputRef.current
			const cursorPos = input?.selectionStart ?? prev.formula.length
			const beforeCursor = prev.formula.slice(0, cursorPos)
			const afterCursor = prev.formula.slice(cursorPos)
			const match = beforeCursor.match(/([a-zA-Z0-9_]+)$/)
			const word = match?.[1] ?? ''
			const wordStart = match ? beforeCursor.length - word.length : beforeCursor.length
			let newFormula
			if (item.type === 'function' || item.type === 'operator') {
				newFormula = `${beforeCursor.slice(0, wordStart) + item.name}()${afterCursor}`
				setTimeout(() => {
					if (inputRef.current) {
						const pos = wordStart + item.name.length + 1
						inputRef.current.setSelectionRange(pos, pos)
					}
				}, 0)
			} else {
				newFormula = beforeCursor.slice(0, wordStart) + item.name + afterCursor
				setTimeout(() => {
					if (inputRef.current) {
						const pos = wordStart + item.name.length
						inputRef.current.setSelectionRange(pos, pos)
					}
				}, 0)
			}
			return { ...prev, formula: newFormula, showSuggestions: false, fieldWarning: null, submissionError: null }
		})
		inputRef.current?.focus()
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
				<Ariakit.Dialog className={`${dialogSurfaceStyles} [--dialog-width:560px]`} unmountOnHide portal>
					<div className="flex items-center justify-between gap-3 border-b border-subtle px-4 py-3">
						<DialogHeading>Add Custom Column</DialogHeading>
						<DialogCloseButton ariaLabel="Close modal" />
					</div>
					<div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
						<label className="flex flex-col gap-1">
							<span className="label-sm text-secondary">Column Name</span>
							<Input
								value={state.name}
								onChange={(e) => setState((prev) => ({ ...prev, name: e.target.value, submissionError: null }))}
								placeholder="Custom Column"
							/>
						</label>
						<label className="flex flex-col gap-1">
							<span className="label-sm text-secondary">Formula</span>
							<div className="relative">
								{state.fieldWarning && !displayedError ? (
									<div className="mb-2 flex items-center gap-2 rounded-sm border border-yellow-400 bg-yellow-100 px-3 py-2 text-sm font-semibold text-yellow-700">
										<Icon name="help-circle" height={18} width={18} />
										<span>{state.fieldWarning}</span>
									</div>
								) : null}
								{displayedError ? (
									<div className="mb-2 flex items-center gap-2 rounded-sm border border-error bg-red-100 px-3 py-2 text-sm font-semibold text-error">
										<Icon name="alert-triangle" height={18} width={18} />
										<span>{displayedError}</span>
									</div>
								) : null}
								<input
									ref={inputRef}
									className={`${inputStyles} w-full ${displayedError ? 'border-error focus:border-error' : ''}`}
									value={state.formula}
									onChange={handleFormulaChange}
									onKeyDown={handleKeyDown}
									placeholder="e.g. revenue_30d / tvl"
									autoComplete="off"
								/>
								{state.showSuggestions ? (
									<ul className="absolute right-0 left-0 z-10 mt-1 max-h-40 overflow-y-auto overscroll-contain rounded-xl border border-medium bg-overlay shadow-overlay-sm">
										{state.suggestions.map((s, i) => (
											<li
												key={s.name}
												className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-primary ${
													i === state.highlighted ? 'bg-hover-row' : ''
												}`}
												onMouseDown={(e) => {
													e.stopPropagation()
													handleSuggestionClick(s)
												}}
											>
												{s.type === 'function' || s.type === 'operator' ? <span className="text-link">ƒ</span> : ''}
												<span>{s.name}</span>
											</li>
										))}
									</ul>
								) : null}
							</div>
						</label>
						<label className="flex flex-col gap-1">
							<span className="label-sm text-secondary">Format</span>
							<div>
								<select
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
									<div className="mt-1 body-sm text-secondary">Auto will format as: {autoFormatLabel}</div>
								) : null}
							</div>
						</label>
						<div className="flex flex-col gap-1">
							<p className="label-sm text-secondary">Available fields:</p>
							<ul className="grid max-h-32 grid-cols-2 gap-x-4 gap-y-1 overflow-y-auto rounded-lg border border-medium bg-page p-2">
								{AVAILABLE_FIELDS.map((f) => (
									<li key={f}>
										<code
											className="hover-wash cursor-pointer rounded-sm bg-surface-elevated-1 px-1 py-0.5 text-link"
											onClick={() => handleSuggestionClick({ name: f, type: 'field' })}
										>
											{f}
										</code>
									</li>
								))}
							</ul>
						</div>
						{formula && !hasFormulaError ? (
							<div className="body-sm">
								<span className="font-semibold text-secondary">Preview: </span>
								<span className="rounded-sm bg-page px-2 py-1 text-primary">{preview}</span>
							</div>
						) : null}
						<div className="body-sm text-secondary">
							<a
								href="https://docs.llama.fi/analysts/custom-columns"
								target="_blank"
								className="text-link hover:underline"
								rel="noreferrer"
							>
								Learn more on how to create custom columns
							</a>
						</div>
					</div>
					<div className="flex justify-end gap-2 border-t border-subtle bg-overlay px-4 py-3">
						<Button type="button" size="md" onClick={dialogStore.toggle}>
							Cancel
						</Button>
						<Button type="button" variant="primary" size="md" onClick={handleSave}>
							Save
						</Button>
					</div>
				</Ariakit.Dialog>
			</Ariakit.DialogProvider>
			{shouldRenderModal ? (
				<Suspense fallback={<></>}>
					<SubscribeProModal dialogStore={subscribeModalStore} />
				</Suspense>
			) : null}
		</>
	)
}
