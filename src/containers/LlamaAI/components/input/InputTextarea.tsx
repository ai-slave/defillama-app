import * as Ariakit from '@ariakit/react'
import { useMemo, type RefObject } from 'react'
import { createOwnedRef } from '~/containers/LlamaAI/utils/ownedRef'

interface InputTextareaProps {
	combobox: Ariakit.ComboboxStore
	promptInputRef: RefObject<HTMLTextAreaElement | null>
	highlightRef: RefObject<HTMLDivElement | null>
	/** The in-flow box the textarea sizes. `setInputSize` holds its height while it measures. */
	wrapperRef: RefObject<HTMLDivElement | null>
	value: string
	sanitizedHighlightedHtml: string
	placeholder: string
	disabled: boolean
	onScroll: () => void
	onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
	onKeyDownCapture: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
	onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
	onPaste: (e: React.ClipboardEvent<Element>) => void
	onCompositionStart?: () => void
	onCompositionEnd?: () => void
}

export function InputTextarea({
	combobox,
	promptInputRef,
	highlightRef,
	wrapperRef,
	value,
	sanitizedHighlightedHtml,
	placeholder,
	disabled,
	onScroll,
	onChange,
	onKeyDownCapture,
	onKeyDown,
	onPaste,
	onCompositionStart,
	onCompositionEnd
}: InputTextareaProps) {
	const bindPromptInput = useMemo(() => createOwnedRef(promptInputRef), [promptInputRef])
	return (
		<div ref={wrapperRef} className="relative w-full">
			<Ariakit.Combobox
				store={combobox}
				autoSelect
				value={value}
				showOnClick={false}
				showOnChange={false}
				showOnKeyPress={false}
				setValueOnChange={false}
				render={
					<textarea
						ref={bindPromptInput}
						value={value}
						rows={1}
						maxLength={200_000}
						placeholder={placeholder}
						onScroll={onScroll}
						onPointerDown={combobox.hide}
						onChange={onChange}
						onKeyDownCapture={onKeyDownCapture}
						onKeyDown={onKeyDown}
						onPaste={onPaste}
						onCompositionStart={onCompositionStart}
						onCompositionEnd={onCompositionEnd}
						name="prompt"
						className="relative z-1 block min-h-4 w-full resize-none overflow-x-hidden overflow-y-hidden overscroll-contain border-0 bg-transparent p-0 leading-normal wrap-break-word whitespace-pre-wrap text-ai-primary caret-ai-primary outline-hidden placeholder:text-ai-tertiary max-sm:text-base"
						autoCorrect="on"
						autoCapitalize="none"
						autoComplete="off"
						spellCheck
					/>
				}
				disabled={disabled}
			/>
			<div
				aria-hidden="true"
				className="highlighted-text pointer-events-none absolute top-0 right-0 bottom-0 left-0 z-0 min-h-4 overflow-x-hidden overflow-y-hidden overscroll-contain p-0 leading-normal wrap-break-word whitespace-pre-wrap max-sm:text-base"
				ref={highlightRef}
				// Safe here: highlightWord escapes user text and only injects internal highlight spans.
				// eslint-disable-next-line react/no-danger
				dangerouslySetInnerHTML={{ __html: sanitizedHighlightedHtml }}
			/>
		</div>
	)
}
