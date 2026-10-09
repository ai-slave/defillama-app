import { type RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { CAPABILITIES } from '~/containers/LlamaAI/capabilities'
import { CapabilityChips } from '~/containers/LlamaAI/components/input/CapabilityChips'
import { EntityComboboxPopover } from '~/containers/LlamaAI/components/input/EntityCombobox'
import { ImageUpload, ImageUploadButton } from '~/containers/LlamaAI/components/input/ImageUpload'
import { InputTextarea } from '~/containers/LlamaAI/components/input/InputTextarea'
import { MobileToolsPopover } from '~/containers/LlamaAI/components/input/MobileToolsPopover'
import { ModeToggle } from '~/containers/LlamaAI/components/input/ModeToggle'
import { SubmitButton } from '~/containers/LlamaAI/components/input/SubmitButton'
import { PastedContentModal } from '~/containers/LlamaAI/components/PastedContentModal'
import { UploadSelectionNotice } from '~/containers/LlamaAI/components/UploadSelectionNotice'
import { useEntityCombobox } from '~/containers/LlamaAI/hooks/useEntityCombobox'
import { toSubmittedAttachments, useImageUpload } from '~/containers/LlamaAI/hooks/useImageUpload'
import { usePromptDraft } from '~/containers/LlamaAI/hooks/usePromptDraft'
import type { OutgoingAttachment } from '~/containers/LlamaAI/mutationProtocol'
import type { AgenticAnswerMode, FactCheckedUsage, ResearchUsage } from '~/containers/LlamaAI/types'
import { setInputSize, syncHighlightScroll } from '~/containers/LlamaAI/utils/scrollUtils'
import { highlightWord } from '~/containers/LlamaAI/utils/textUtils'
import { useMedia } from '~/hooks/useMedia'
import type { FormSubmitEvent } from '~/types/forms'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { trackUmamiEvent } from '~/utils/analytics/umami'
import { useFileDropTarget } from './FileDrop'
import { ComposerFrame } from './input/ComposerFrame'

const PASTE_TO_FILE_THRESHOLD = 1500
const CAPABILITY_PROMPTS = new Set(CAPABILITIES.flatMap((capability) => capability.prompts))

// Browser object URLs are only needed for local previews, so clean them up after use.
function revokeImageUrls(images: Array<{ url: string }>) {
	for (const image of images) URL.revokeObjectURL(image.url)
}

/** What the reader can do about a failed prompt; the composer offers it while the failure blocks sending. */
export type PromptFailureAction = {
	label: 'Retry' | 'Reconnect'
	notice: string
	onActivate: () => void
	onDiscard?: () => void
}

export type PromptSubmitMode =
	| { kind: 'direct' }
	| { kind: 'blocked'; failure: PromptFailureAction }
	| { kind: 'queue'; atCapacity: boolean; capacityMessage: string | null }

interface PromptInputProps {
	draftScope: string
	submitMode: PromptSubmitMode
	handleSubmit: (
		prompt: string,
		preResolvedEntities?: Array<{ term: string; slug: string; type?: string }>,
		images?: Array<OutgoingAttachment>,
		pageContext?: undefined,
		isSuggestedQuestion?: boolean
	) => void | Promise<void> | boolean | QueueSubmitResult | Promise<QueueSubmitResult>
	promptInputRef: RefObject<HTMLTextAreaElement | null>
	isPending: boolean
	handleStopRequest: () => void
	isStreaming?: boolean
	isStopping?: boolean
	placeholder: string
	/** Phones show this instead: the full hint wraps past one line there. */
	shortPlaceholder: string
	restoreRequest?: {
		key: number
		text: string
		entities?: Array<{ term: string; slug: string; type?: string }>
	} | null
	onRestoreConsumed?: () => void
	mode: AgenticAnswerMode
	setMode: (mode: AgenticAnswerMode) => void
	researchUsage?: ResearchUsage | null
	factCheckedUsage?: FactCheckedUsage | null
	onFactCheckedGated?: () => void
	/** Set when attachments cannot be sent yet (signed out): attaching calls this instead of adding a file. */
	onAttachmentsGated?: () => void
	quotedText?: string | null
	onClearQuotedText?: () => void
	enterToSend: boolean
	walkthroughActive?: boolean
}

export type QueueSubmitResult =
	| { status: 'accepted' }
	| { status: 'cancelled' }
	| { status: 'rejected'; message: string }

interface PendingSelection {
	selectionStart: number
	selectionEnd: number
	focus?: boolean
}

// Logical tests and a conditional, none of which the compiler can lower inside the try that guards the
// submit. Only an explicit rejection carries a message; anything else has none to show.
function wasAccepted(result: void | boolean | QueueSubmitResult) {
	return typeof result === 'object' && result.status === 'accepted'
}

function rejectionMessage(result: void | boolean | QueueSubmitResult) {
	return typeof result === 'object' && result.status === 'rejected' ? result.message : null
}

export function PromptInput({
	draftScope,
	submitMode,
	handleSubmit,
	promptInputRef,
	isPending,
	handleStopRequest,
	isStreaming,
	isStopping,
	placeholder,
	shortPlaceholder,
	restoreRequest,
	onRestoreConsumed,
	mode,
	setMode,
	researchUsage,
	factCheckedUsage,
	onFactCheckedGated,
	onAttachmentsGated,
	quotedText,
	onClearQuotedText,
	enterToSend,
	walkthroughActive
}: PromptInputProps) {
	const [value, setValue] = usePromptDraft(draftScope)
	const [submitError, setSubmitError] = useState<string | null>(null)
	const submitInFlightRef = useRef(false)
	const highlightRef = useRef<HTMLDivElement>(null)
	const inputWrapperRef = useRef<HTMLDivElement>(null)
	const pendingSelectionRef = useRef<PendingSelection | null>(null)
	const valueRef = useRef(value)
	const shiftHeldRef = useRef(false)
	const lastRestoreKeyRef = useRef<number | null>(null)

	useEffect(() => {
		const onDown = (e: KeyboardEvent) => {
			if (e.key === 'Shift') shiftHeldRef.current = true
		}
		const onUp = (e: KeyboardEvent) => {
			if (e.key === 'Shift') shiftHeldRef.current = false
		}
		const onBlur = () => {
			shiftHeldRef.current = false
		}
		window.addEventListener('keydown', onDown)
		window.addEventListener('keyup', onUp)
		window.addEventListener('blur', onBlur)
		return () => {
			window.removeEventListener('keydown', onDown)
			window.removeEventListener('keyup', onUp)
			window.removeEventListener('blur', onBlur)
		}
	}, [])

	// Route all programmatic prompt edits through one helper so caret restoration stays consistent.
	const applyPromptEdit = useCallback(
		({
			nextValue,
			selectionStart,
			selectionEnd,
			focus = false
		}: {
			nextValue: string
			selectionStart?: number
			selectionEnd?: number
			focus?: boolean
		}) => {
			valueRef.current = nextValue
			pendingSelectionRef.current =
				selectionStart == null
					? null
					: {
							selectionStart,
							selectionEnd: selectionEnd ?? selectionStart,
							focus
						}
			setValue(nextValue)
		},
		[setValue]
	)

	// Image upload handling
	const imageUpload = useImageUpload()

	// Entity combobox handling
	const entityCombobox = useEntityCombobox({
		promptInputRef,
		currentValue: value,
		applyPromptEdit
	})
	const { clearSearch, restoreEntities } = entityCombobox

	const isMobile = useMedia('(max-width: 640px)')
	const sanitizedHighlightedHtml = highlightWord(
		value,
		entityCombobox.selectedEntities.map(({ term }) => term)
	)

	// Resize the textarea and restore the intended selection after controlled prompt updates.
	useLayoutEffect(() => {
		const textarea = promptInputRef.current
		if (!textarea) return

		if (value) {
			setInputSize(promptInputRef, highlightRef, isMobile ? 3 : 5, inputWrapperRef)
		} else {
			textarea.style.height = ''
			textarea.style.overflowY = 'hidden'
			if (highlightRef.current) {
				highlightRef.current.style.height = ''
			}
		}

		const pendingSelection = pendingSelectionRef.current
		if (!pendingSelection) return

		if (pendingSelection.focus) {
			textarea.focus()
		}

		try {
			textarea.setSelectionRange(pendingSelection.selectionStart, pendingSelection.selectionEnd)
		} catch {
			// Some inputs reject the range; the caret stays where the browser put it.
		}
		pendingSelectionRef.current = null
	}, [value, promptInputRef, isMobile])

	useEffect(() => {
		valueRef.current = value
	}, [value])

	// Handle restore request (e.g., failed submission retry). Each restoreRequest key is
	// attempted exactly once: applied if the composer is empty, discarded otherwise.
	useEffect(() => {
		if (!restoreRequest) return
		if (lastRestoreKeyRef.current === restoreRequest.key) return

		const { key, text, entities } = restoreRequest
		const fillsComposer = value.trim().length === 0
		let cancelled = false

		queueMicrotask(() => {
			if (cancelled) return
			// Used only once it runs: a cleanup that cancels this run, such as Strict Mode replaying a mount or a
			// dependency change, leaves the request for the next run.
			lastRestoreKeyRef.current = key
			if (fillsComposer) {
				restoreEntities(entities)
				clearSearch()
				applyPromptEdit({
					nextValue: text,
					selectionStart: text.length,
					selectionEnd: text.length
				})
			}
			onRestoreConsumed?.()
		})

		return () => {
			cancelled = true
		}
	}, [restoreRequest, value, restoreEntities, clearSearch, applyPromptEdit, onRestoreConsumed])

	const resetInput = (imagesToRevoke?: Array<{ url: string }>) => {
		applyPromptEdit({
			nextValue: '',
			selectionStart: 0,
			selectionEnd: 0
		})
		imageUpload.setPreviewImage(null)
		if (imagesToRevoke && imagesToRevoke.length > 0) {
			imageUpload.clearImages(false)
			revokeImageUrls(imagesToRevoke)
		} else {
			imageUpload.clearImages(true)
		}
		entityCombobox.resetCombobox()
	}

	const clearSubmitError = useCallback(() => {
		setSubmitError((current) => (current ? null : current))
	}, [])

	const shouldResetSubmittedDraft = useCallback(
		(promptValue: string, imagesToSend: Array<{ id: string }>) => {
			if (valueRef.current !== promptValue) return false
			const currentImageIds = imageUpload.getSelectedImageIds()
			if (currentImageIds.length !== imagesToSend.length) return false
			return imagesToSend.every((image, index) => image.id === currentImageIds[index])
		},
		[imageUpload]
	)

	// Submit the prompt plus any selected entities/images, then clear the local composer state.
	const submitForm = async (promptValue: string) => {
		if (submitInFlightRef.current) return
		if (isStopping) return
		if (!promptValue.trim() && imageUpload.selectedImages.length === 0) return
		if (imageUpload.uploadMessage) return
		submitInFlightRef.current = true
		// The finalizer guarded six early returns, so the body settles in its own function and the flag
		// clears after it. Promise.finally keeps a throw propagating once it has, as the finalizer did.
		const submit = async () => {
			const finalEntities = entityCombobox.getFinalEntities()
			const imagesToSend = [...imageUpload.selectedImages]
			// A ready-made prompt sent as written is a suggested question, however it reached the composer; once the
			// reader edits it, it is their own.
			const isSuggested = CAPABILITY_PROMPTS.has(promptValue.trim())

			// Send is disabled and the notice with its actions is already on screen.
			if (submitMode.kind === 'blocked') return

			if (submitMode.kind === 'queue') {
				const restoreDraftIfUntouched = () => {
					if (!shouldResetSubmittedDraft('', [])) return
					restoreEntities(finalEntities)
					applyPromptEdit({
						nextValue: promptValue,
						selectionStart: promptValue.length,
						selectionEnd: promptValue.length
					})
					if (imagesToSend.length > 0) {
						imageUpload.addImages(imagesToSend.map((image) => image.file))
					}
				}

				setSubmitError(null)
				resetInput(imagesToSend)
				try {
					const images = await toSubmittedAttachments(imagesToSend)
					const result = await handleSubmit(promptValue, finalEntities, images)
					if (!wasAccepted(result)) {
						setSubmitError(rejectionMessage(result))
						restoreDraftIfUntouched()
					}
				} catch (error) {
					console.error('Queue failed', error)
					setSubmitError('Failed to queue your prompt. Please try again.')
					restoreDraftIfUntouched()
				}
				return
			}

			trackUmamiEvent('llamaai-prompt-submit')
			const hasImages = imagesToSend.length > 0
			// A logical cannot be lowered inside a try, and both submit paths below pass the same flag.
			const suggestedFlag = isSuggested || undefined

			if (hasImages) {
				try {
					const images = await toSubmittedAttachments(imagesToSend)
					const accepted = await Promise.resolve(
						handleSubmit(promptValue, finalEntities, images, undefined, suggestedFlag)
					)
					if (accepted === false) return
					setSubmitError(null)
					if (shouldResetSubmittedDraft(promptValue, imagesToSend)) {
						resetInput(imagesToSend)
					}
					return
				} catch (error) {
					console.error('Submission failed', error)
					setSubmitError('Failed to submit your prompt. Please try again.')
				}
				return
			}

			try {
				const accepted = await Promise.resolve(
					handleSubmit(promptValue, finalEntities, undefined, undefined, suggestedFlag)
				)
				if (accepted === false) return
				setSubmitError(null)
				resetInput()
			} catch (error) {
				console.error('Submission failed', error)
				setSubmitError('Failed to submit your prompt. Please try again.')
			}
		}
		await submit().finally(() => {
			submitInFlightRef.current = false
		})
	}

	const handleKeyDownCapture = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
		// Ariakit's composite proxy forwards Enter to the active @ suggestion, swallowing
		// the textarea's native newline. Stop capture propagation so the configured newline shortcut
		// keeps the textarea behavior before combobox handlers see the event.
		if (event.key === 'Enter' && event.shiftKey === enterToSend) {
			event.stopPropagation()
		}
	}

	// Let the combobox own navigation keys first, then submit on the configured shortcut.
	const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
		const shouldSubmit = event.key === 'Enter' && event.shiftKey !== enterToSend

		// First let entity combobox handle the event
		if (!shouldSubmit) {
			entityCombobox.handleKeyDown(event)
		}
		if (event.defaultPrevented) return

		// Handle enter for submission
		if (shouldSubmit && !entityCombobox.hasRenderedItems && !event.nativeEvent.isComposing) {
			event.preventDefault()
			void submitForm(value)
		}
	}

	// Keep the mirrored highlight layer and combobox trigger detection in sync with textarea edits.
	const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
		clearSubmitError()
		applyPromptEdit({ nextValue: event.target.value })
		entityCombobox.handleChange(event.target)
	}

	// Reposition the suggestion popover and highlighted overlay whenever the textarea scrolls.
	const handleScroll = () => {
		syncHighlightScroll(promptInputRef, highlightRef)
		entityCombobox.handleScroll()
	}

	// Route native form submits through the same submit helper used by the Enter key path.
	const handleFormSubmit = (e: FormSubmitEvent) => {
		e.preventDefault()
		void submitForm(value)
	}

	// Clicking empty space inside the composer should still focus the textarea.
	const handleFormPointerDown = (event: React.PointerEvent<HTMLFormElement>) => {
		const target = event.target as HTMLElement
		if (target.closest('button, textarea, input, summary, a, [role="option"]')) return
		requestAnimationFrame(() => {
			promptInputRef.current?.focus()
		})
	}

	const handleImageRemove = (idx: number) => {
		if (isStopping) return
		clearSubmitError()
		imageUpload.removeImage(idx)
	}

	const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
		if (isStopping) return
		clearSubmitError()
		imageUpload.handleImageSelect(event)
	}

	const handlePaste = (event: React.ClipboardEvent<Element>) => {
		clearSubmitError()
		const data = event.clipboardData
		if (!data) return

		const hasFile = Array.from(data.items).some((item) => item.kind === 'file')
		if (hasFile && onAttachmentsGated) {
			event.preventDefault()
			onAttachmentsGated()
			return
		}
		if (hasFile) {
			imageUpload.handlePaste(event)
			return
		}

		// A long paste stays text while attachments are gated, since it would otherwise become a file.
		const text = data.getData('text/plain')
		if (!text || text.length < PASTE_TO_FILE_THRESHOLD || shiftHeldRef.current || onAttachmentsGated) return

		if (imageUpload.addPastedText(text)) {
			event.preventDefault()
		}
	}

	useFileDropTarget(
		'Attach files to message',
		(files) => {
			clearSubmitError()
			imageUpload.addDroppedFiles(files)
			promptInputRef.current?.focus()
		},
		!isStopping
	)

	return (
		<ComposerFrame
			as="form"
			layout="stack"
			className="@container relative w-full"
			onSubmit={handleFormSubmit}
			onPointerDown={handleFormPointerDown}
		>
			<UploadSelectionNotice
				feedback={imageUpload.selectionFeedback}
				onDismiss={imageUpload.dismissSelectionFeedback}
			/>
			<ImageUpload
				retryUpload={imageUpload.retryUpload}
				uploadMessage={imageUpload.uploadMessage}
				disabled={isStopping}
				selectedImages={imageUpload.selectedImages}
				previewImage={imageUpload.previewImage}
				setPreviewImage={imageUpload.setPreviewImage}
				openPastedPreview={imageUpload.setPastedPreview}
				removeImage={handleImageRemove}
				fileInputRef={imageUpload.fileInputRef}
				handleImageSelect={handleImageSelect}
			/>

			<PastedContentModal preview={imageUpload.pastedPreview} onClose={() => imageUpload.setPastedPreview(null)} />

			{quotedText ? (
				<div className="flex items-center gap-2 rounded-md border-l-2 border-brand bg-brand-muted py-1 pr-1 pl-3">
					<Icon name="message-square-plus" height={14} width={14} className="shrink-0 text-link" />
					<p className="min-w-0 flex-1 truncate body-sm text-secondary">{quotedText}</p>
					<Button
						type="button"
						size="sm"
						variant="ghost"
						square
						onClick={() => {
							onClearQuotedText?.()
							promptInputRef.current?.focus()
						}}
						aria-label="Clear quoted text"
					>
						<Icon name="x" height={14} width={14} />
					</Button>
				</div>
			) : null}

			<InputTextarea
				combobox={entityCombobox.combobox}
				promptInputRef={promptInputRef}
				highlightRef={highlightRef}
				wrapperRef={inputWrapperRef}
				value={value}
				sanitizedHighlightedHtml={sanitizedHighlightedHtml}
				placeholder={isMobile ? shortPlaceholder : placeholder}
				disabled={!!isStopping || (isPending && !isStreaming)}
				onScroll={handleScroll}
				onChange={handleChange}
				onKeyDownCapture={handleKeyDownCapture}
				onKeyDown={handleKeyDown}
				onPaste={handlePaste}
				onCompositionStart={entityCombobox.handleCompositionStart}
				onCompositionEnd={entityCombobox.handleCompositionEnd}
			/>

			<EntityComboboxPopover
				combobox={entityCombobox.combobox}
				promptInputRef={promptInputRef}
				matches={entityCombobox.matches}
				hasMatches={entityCombobox.hasMatches}
				isTriggerOnly={entityCombobox.isTriggerOnly}
				isLoading={entityCombobox.isLoading}
				isFetching={entityCombobox.isFetching}
				onItemClick={entityCombobox.selectEntity}
			/>

			{submitError ? (
				<p role="alert" className="body-sm text-error">
					{submitError}
				</p>
			) : null}

			<div className="flex items-center justify-between gap-4 p-0">
				<div className="hidden min-w-0 flex-1 [scrollbar-width:none] items-center gap-2 overflow-x-auto *:shrink-0 @sm:flex">
					<ModeToggle
						mode={mode}
						setMode={setMode}
						researchUsage={researchUsage}
						factCheckedUsage={factCheckedUsage}
						onFactCheckedGated={onFactCheckedGated}
					/>
					<CapabilityChips
						key={isPending || isStreaming ? 'capability-chips-disabled' : 'capability-chips-enabled'}
						onPromptSelect={(prompt, categoryKey) => {
							if (categoryKey === 'research') {
								setMode('research')
							}
							applyPromptEdit({ nextValue: prompt, selectionStart: prompt.length, focus: true })
						}}
						isPending={isPending}
						isStreaming={isStreaming}
					/>
				</div>
				<MobileToolsPopover
					mode={mode}
					setMode={setMode}
					researchUsage={researchUsage}
					factCheckedUsage={factCheckedUsage}
					onFactCheckedGated={onFactCheckedGated}
					onPromptSelect={(prompt, categoryKey) => {
						if (categoryKey === 'research') {
							setMode('research')
						}
						applyPromptEdit({ nextValue: prompt, selectionStart: prompt.length, focus: true })
					}}
					onImageUploadClick={onAttachmentsGated ?? imageUpload.openFilePicker}
					isPending={isPending}
					isStreaming={isStreaming}
					isStopping={isStopping}
					walkthroughActive={walkthroughActive}
				/>
				<div className="flex shrink-0 items-center gap-2">
					<span className="@max-sm:hidden" data-walkthrough="image-upload">
						<ImageUploadButton onClick={onAttachmentsGated ?? imageUpload.openFilePicker} disabled={isStopping} />
					</span>
					<SubmitButton
						mode={
							isStopping
								? { kind: 'stopping' }
								: isStreaming
									? {
											kind: 'streaming',
											canQueue:
												submitMode.kind === 'queue' &&
												!imageUpload.uploadMessage &&
												(value.trim().length > 0 || imageUpload.selectedImages.length > 0),
											onStop: handleStopRequest
										}
									: submitMode.kind === 'queue'
										? {
												kind: 'queue',
												disabled:
													!!imageUpload.uploadMessage ||
													(value.trim().length === 0 && imageUpload.selectedImages.length === 0)
											}
										: {
												kind: 'send',
												disabled:
													isPending ||
													!!imageUpload.uploadMessage ||
													submitMode.kind === 'blocked' ||
													(value.trim().length === 0 && imageUpload.selectedImages.length === 0)
											}
						}
					/>
				</div>
			</div>
		</ComposerFrame>
	)
}
