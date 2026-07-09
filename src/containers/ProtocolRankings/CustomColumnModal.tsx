import * as Ariakit from '@ariakit/react'
import { lazy, Suspense, useRef, useState } from 'react'
import { Icon } from '~/components/Icon'
import { Button } from '~/ui/Button'
import { DialogCloseButton, DialogHeading, dialogSurfaceStyles } from '~/ui/Dialog'
import { Input, inputStyles } from '~/ui/Input'
import { formatValue } from '../../utils'
import { useAuthContext } from '../Subscription/auth'
import { setSignupSource } from '../Subscription/signupSource'
import { AVAILABLE_FIELDS, AVAILABLE_FUNCTIONS, replaceAliases } from './customColumnsUtils'
import { evaluateFormula } from './formula.service'

const SubscribeProModal = lazy(() =>
	import('~/components/SubscribeCards/SubscribeProCard').then((m) => ({ default: m.SubscribeProModal }))
)

interface CustomColumnModalProps {
	dialogStore: Ariakit.DialogStore
	onSave: (def: {
		name: string
		formula: string
		formatType: string
		determinedFormat?: 'number' | 'usd' | 'percent' | 'string' | 'boolean'
	}) => void
	sampleRow: any
	name?: string
	formula?: string
	formatType?: string
	displayAs?: string
}

function getFilteredSuggestions(word) {
	const wordLower = word.toLowerCase()
	const functionMatches = AVAILABLE_FUNCTIONS.filter((f) => f.name.toLowerCase().startsWith(wordLower))
	const fieldMatches = AVAILABLE_FIELDS.filter((f) => f.toLowerCase().startsWith(wordLower))
	return [...fieldMatches.map((f) => ({ name: f, type: 'field' })), ...functionMatches]
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
	const [state, setState] = useState({
		name: initialName,
		formula: initialFormula,
		formatType: initialFormatType,
		error: null,
		showSuggestions: false,
		suggestions: [],
		highlighted: 0,
		fieldWarning: null
	})
	const inputRef = useRef(null)
	const { isAuthenticated, hasActiveSubscription } = useAuthContext()
	const [shouldRenderModal, setShouldRenderModal] = useState(false)
	const subscribeModalStore = Ariakit.useDialogStore({ open: shouldRenderModal, setOpen: setShouldRenderModal })

	const handleFormulaChange = (e) => {
		const value = e.target.value
		setState((prev) => ({ ...prev, formula: value }))
		const cursorPos = e.target.selectionStart
		const beforeCursor = value.slice(0, cursorPos)
		const match = beforeCursor.match(/([a-zA-Z0-9_]+)$/)
		const word = match ? match[1] : ''
		if (word) {
			const filtered = getFilteredSuggestions(word)
			setState((prev) => ({
				...prev,
				suggestions: filtered,
				showSuggestions: filtered.length > 0,
				highlighted: 0,
				fieldWarning:
					word &&
					!AVAILABLE_FIELDS.some((f) => f.toLowerCase() === word.toLowerCase()) &&
					!AVAILABLE_FUNCTIONS.some((f) => f.name.toLowerCase() === word.toLowerCase()) &&
					Number.isNaN(Number(word))
						? `Field or function '${word}' is not available.`
						: null
			}))
		} else {
			setState((prev) => ({ ...prev, showSuggestions: false, fieldWarning: null }))
		}
		if (value.trim()) {
			const formulaWithPaths = replaceAliases(value)
			const result = evaluateFormula(formulaWithPaths, sampleRow)
			if (result.error) {
				setState((prev) => ({ ...prev, error: 'Invalid formula: ' + result.error }))
			} else {
				setState((prev) => ({ ...prev, error: null }))
			}
		} else {
			setState((prev) => ({ ...prev, error: null }))
		}
	}

	const handleSuggestionClick = (item) => {
		if (typeof item === 'string') item = { name: item, type: 'field' }
		setState((prev) => {
			const input = inputRef.current
			let cursorPos = input ? input.selectionStart : prev.formula.length
			const beforeCursor = prev.formula.slice(0, cursorPos)
			const afterCursor = prev.formula.slice(cursorPos)
			const match = beforeCursor.match(/([a-zA-Z0-9_]+)$/)
			const word = match ? match[1] : ''
			const wordStart = match ? beforeCursor.length - word.length : beforeCursor.length
			let newFormula
			if (item.type === 'function' || item.type === 'operator') {
				newFormula = beforeCursor.slice(0, wordStart) + item.name + '()' + afterCursor
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
			return { ...prev, formula: newFormula, showSuggestions: false, fieldWarning: null, error: null }
		})
		inputRef.current?.focus()
	}

	const handleKeyDown = (e) => {
		if (!state.showSuggestions) return
		if (e.key === 'ArrowDown') {
			setState((prev) => ({ ...prev, highlighted: Math.min(prev.highlighted + 1, prev.suggestions.length - 1) }))
			e.preventDefault()
		} else if (e.key === 'ArrowUp') {
			setState((prev) => ({ ...prev, highlighted: Math.max(prev.highlighted - 1, 0) }))
			e.preventDefault()
		} else if (e.key === 'Enter') {
			if (state.suggestions[state.highlighted]) {
				handleSuggestionClick(state.suggestions[state.highlighted])
				e.preventDefault()
			}
		} else if (e.key === 'Escape') {
			setState((prev) => ({ ...prev, showSuggestions: false }))
		}
	}

	const handleSave = () => {
		if (!state.name.trim() || !state.formula.trim()) {
			setState((prev) => ({ ...prev, error: 'Name and formula are required' }))
			return
		}
		const formulaWithPaths = replaceAliases(state.formula)
		const result = evaluateFormula(formulaWithPaths, sampleRow)
		if (result.error) {
			setState((prev) => ({ ...prev, error: 'Invalid formula: ' + result.error }))
			return
		}
		if (!isAuthenticated || !hasActiveSubscription) {
			setSignupSource('custom-columns')
			setShouldRenderModal(true)
			return
		}
		setState((prev) => ({ ...prev, error: null }))

		const determinedFormat =
			state.formatType === 'auto' && !result.error
				? (() => {
						if (typeof result.value === 'boolean') return 'boolean'
						if (typeof result.value === 'number') {
							if (result.value >= 0 && result.value <= 1) return 'percent'
							if (Math.abs(result.value) > 1000) return 'usd'
							return 'number'
						}
						return 'string'
					})()
				: undefined

		onSave({
			name: state.name.trim(),
			formula: state.formula.trim(),
			formatType: state.formatType,
			determinedFormat
		})
	}

	let preview = null
	let hasFormulaError = false
	if (state.formula.trim()) {
		const formulaWithPaths = replaceAliases(state.formula)
		const result = evaluateFormula(formulaWithPaths, sampleRow)
		if (result.error) {
			hasFormulaError = true
		} else {
			const determinedFormat =
				state.formatType === 'auto'
					? (() => {
							if (typeof result.value === 'boolean') return 'boolean'
							if (typeof result.value === 'number') {
								if (result.value >= 0 && result.value <= 1) return 'percent'
								if (Math.abs(result.value) > 1000) return 'usd'
								return 'number'
							}
							return 'string'
						})()
					: state.formatType

			if (determinedFormat === 'boolean' && typeof result.value === 'boolean') {
				preview = result.value ? '✅ True' : '❌ False'
			} else {
				preview = formatValue(result.value, determinedFormat)
			}
		}
	}

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
								onChange={(e) => setState((prev) => ({ ...prev, name: e.target.value }))}
								placeholder="Custom Column"
							/>
						</label>
						<label className="flex flex-col gap-1">
							<span className="label-sm text-secondary">Formula</span>
							<div className="relative">
								{state.fieldWarning && !state.error ? (
									<div className="mb-2 flex items-center gap-2 rounded-sm border border-yellow-400 bg-yellow-100 px-3 py-2 text-sm font-semibold text-yellow-700">
										<Icon name="help-circle" height={18} width={18} />
										<span>{state.fieldWarning}</span>
									</div>
								) : null}
								{state.error ? (
									<div className="mb-2 flex items-center gap-2 rounded-sm border border-red-400 bg-red-100 px-3 py-2 text-sm font-semibold text-red-700">
										<Icon name="alert-triangle" height={18} width={18} />
										<span>{state.error}</span>
									</div>
								) : null}
								<input
									ref={inputRef}
									className={`${inputStyles} w-full ${state.error ? 'border-red-400 focus:border-red-400' : ''}`}
									value={state.formula}
									onChange={handleFormulaChange}
									onKeyDown={handleKeyDown}
									placeholder="e.g. revenue_30d / tvl"
									autoComplete="off"
								/>
								{state.showSuggestions ? (
									<ul className="absolute right-0 left-0 z-10 mt-1 max-h-40 overflow-y-auto overscroll-contain rounded-xl border border-medium bg-overlay shadow-[0_12px_32px_-12px_rgb(0_0_0/0.25)]">
										{state.suggestions.map((s, i) => (
											<li
												key={s.name || s}
												className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-primary ${
													i === state.highlighted ? 'bg-hover-row' : ''
												}`}
												onMouseDown={(e) => {
													e.stopPropagation()
													handleSuggestionClick(s)
												}}
											>
												{s.type === 'function' || s.type === 'operator' ? <span className="text-link">ƒ</span> : ''}
												<span>{s.name || s}</span>
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
									onChange={(e) => setState((prev) => ({ ...prev, formatType: e.target.value }))}
								>
									<option value="auto">Auto</option>
									<option value="number">Number</option>
									<option value="usd">USD</option>
									<option value="percent">Percent</option>
									<option value="string">String</option>
									<option value="boolean">Boolean (checkmark)</option>
								</select>
								{state.formatType === 'auto' && state.formula.trim() && !hasFormulaError ? (
									<div className="mt-1 body-sm text-secondary">
										Auto will format as:{' '}
										{(() => {
											const formulaWithPaths = replaceAliases(state.formula)
											const result = evaluateFormula(formulaWithPaths, sampleRow)
											if (!result.error) {
												if (typeof result.value === 'boolean') return 'Boolean'
												if (typeof result.value === 'number') {
													if (result.value >= 0 && result.value <= 1) return 'Percent'
													if (Math.abs(result.value) > 1000) return 'USD'
													return 'Number'
												}
												return 'String'
											}
											return 'Unknown'
										})()}
									</div>
								) : null}
							</div>
						</label>
						<div className="flex flex-col gap-1">
							<p className="label-sm text-secondary">Available fields:</p>
							<ul className="grid max-h-32 grid-cols-2 gap-x-4 gap-y-1 overflow-y-auto rounded-[8px] border border-medium bg-page p-2">
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
						{state.formula.trim() && !hasFormulaError ? (
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
