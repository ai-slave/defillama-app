import { type RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { CapabilityChips } from '~/containers/LlamaAI/components/input/CapabilityChips'
import { EntityComboboxPopover } from '~/containers/LlamaAI/components/input/EntityCombobox'
import { DragOverlay, ImageUpload, ImageUploadButton } from '~/containers/LlamaAI/components/input/ImageUpload'
import { InputTextarea } from '~/containers/LlamaAI/components/input/InputTextarea'
import { MobileToolsPopover } from '~/containers/LlamaAI/components/input/MobileToolsPopover'
import { ModeToggle } from '~/containers/LlamaAI/components/input/ModeToggle'
import { SubmitButton } from '~/containers/LlamaAI/components/input/SubmitButton'
import { PastedContentModal } from '~/containers/LlamaAI/components/PastedContentModal'
import { useEntityCombobox } from '~/containers/LlamaAI/hooks/useEntityCombobox'
import { fileToBase64, useImageUpload } from '~/containers/LlamaAI/hooks/useImageUpload'
import { usePromptDraft } from '~/containers/LlamaAI/hooks/usePromptDraft'
import type { AgenticAnswerMode, FactCheckedUsage, ResearchUsage } from '~/containers/LlamaAI/types'
import { setInputSize, syncHighlightScroll } from '~/containers/LlamaAI/utils/scrollUtils'
import { highlightWord } from '~/containers/LlamaAI/utils/textUtils'
import { useMedia } from '~/hooks/useMedia'
import type { FormSubmitEvent } from '~/types/forms'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { Tooltip } from '~/ui/Tooltip'
import { trackUmamiEvent } from '~/utils/analytics/umami'

const PASTE_TO_FILE_THRESHOLD = 1500

// Browser object URLs are only needed for local previews, so clean them up after use.
function revokeImageUrls(images: Array<{ url: string }>) {
	for (const image of images) URL.revokeObjectURL(image.url)
}

export type PromptSubmitMode =
	| { kind: 'direct' }
	| { kind: 'blocked'; message: string }
	| { kind: 'queue'; atCapacity: boolean; capacityMessage: string | null }

interface PromptInputProps {
	draftScope: string
	submitMode: PromptSubmitMode
	handleSubmit: (
		prompt: string,
		preResolvedEntities?: Array<{ term: string; slug: string; type?: string }>,
		images?: Array<{ data: string; mimeType: string; filename?: string; isPasted?: boolean }>,
		pageContext?: undefined,
		isSuggestedQuestion?: boolean
	) => void | Promise<void> | boolean | QueueSubmitResult | Promise<QueueSubmitResult>
	promptInputRef: RefObject<HTMLTextAreaElement | null>
	isPending: boolean
	handleStopRequest: () => void
	isStreaming?: boolean
	isStopping?: boolean
	placeholder: string
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
	droppedFiles?: Array<File> | null
	clearDroppedFiles?: () => void
	externalDragging?: boolean
	onOpenAlerts?: () => void
	quotedText?: string | null
	onClearQuotedText?: () => void
	enterToSend: boolean
	walkthroughActive?: boolean
}

export type QueueSubmitResult =
	| { status: 'accepted' }
	| { status: 'cancelled' }
	| { status: 'rejected'; message: string }

const trackSubmit = () => {
	trackUmamiEvent('llamaai-prompt-submit')
}

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
	restoreRequest,
	onRestoreConsumed,
	mode,
	setMode,
	researchUsage,
	factCheckedUsage,
	onFactCheckedGated,
	droppedFiles,
	clearDroppedFiles,
	externalDragging,
	onOpenAlerts,
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
	const isSuggestedRef = useRef(false)
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
	const imageUpload = useImageUpload({ droppedFiles: isStopping ? null : droppedFiles, clearDroppedFiles })
	useEffect(() => {
		if (isStopping && droppedFiles?.length) clearDroppedFiles?.()
	}, [isStopping, droppedFiles, clearDroppedFiles])

	// Entity combobox handling
	const entityCombobox = useEntityCombobox({
		promptInputRef,
		currentValue: value,
		applyPromptEdit
	})
	const { clearSearch, restoreEntities } = entityCombobox

	// Mobile placeholder handling
	const isMobile = useMedia('(max-width: 640px)')
	const mobilePlaceholder = placeholder.replace('Type @ to add a protocol, chain or stablecoin', '')
	const finalPlaceholder = isMobile ? mobilePlaceholder : placeholder
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

		lastRestoreKeyRef.current = restoreRequest.key

		if (value.trim().length > 0) {
			onRestoreConsumed?.()
			return
		}

		const { text, entities } = restoreRequest
		let cancelled = false

		queueMicrotask(() => {
			if (cancelled) return

			restoreEntities(entities)
			clearSearch()
			applyPromptEdit({
				nextValue: text,
				selectionStart: text.length,
				selectionEnd: text.length
			})
			onRestoreConsumed?.()
		})

		return () => {
			cancelled = true
		}
	}, [restoreRequest, value, restoreEntities, clearSearch, applyPromptEdit, onRestoreConsumed])

	// Focus input after external drop
	useEffect(() => {
		if (droppedFiles && droppedFiles.length > 0) {
			promptInputRef.current?.focus()
		}
	}, [droppedFiles, promptInputRef])

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

	const prepareImagesForSubmit = useCallback(async (imagesToSend: Array<{ file: File; isPasted?: boolean }>) => {
		const imagePromises: Array<Promise<{ data: string; mimeType: string; filename: string; isPasted?: boolean }>> = []
		for (const image of imagesToSend) {
			const file = image.file
			imagePromises.push(
				fileToBase64(file).then((data) => ({
					data,
					mimeType: file.type,
					filename: file.name,
					...(image.isPasted ? { isPasted: true } : {})
				}))
			)
		}
		return Promise.all(imagePromises)
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
		submitInFlightRef.current = true
		// The finalizer guarded six early returns, so the body settles in its own function and the flag
		// clears after it. Promise.finally keeps a throw propagating once it has, as the finalizer did.
		const submit = async () => {
			const finalEntities = entityCombobox.getFinalEntities()
			const imagesToSend = [...imageUpload.selectedImages]
			const isSuggested = isSuggestedRef.current
			isSuggestedRef.current = false

			if (submitMode.kind === 'blocked') {
				setSubmitError(submitMode.message)
				return
			}

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
					const images = await prepareImagesForSubmit(imagesToSend)
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

			trackSubmit()
			const hasImages = imagesToSend.length > 0
			// A logical cannot be lowered inside a try, and both submit paths below pass the same flag.
			const suggestedFlag = isSuggested || undefined

			if (hasImages) {
				try {
					const images = await prepareImagesForSubmit(imagesToSend)
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
		if (target.closest('button, textarea, input, [role="option"]')) return
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
		if (hasFile) {
			imageUpload.handlePaste(event)
			return
		}

		const text = data.getData('text/plain')
		if (!text || text.length < PASTE_TO_FILE_THRESHOLD || shiftHeldRef.current) return

		if (imageUpload.addPastedText(text)) {
			event.preventDefault()
		}
	}

	const handleDrop = (event: React.DragEvent<HTMLFormElement>) => {
		if (isStopping) {
			event.preventDefault()
			return
		}
		clearSubmitError()
		imageUpload.handleDrop(event)
	}

	return (
		// oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- a drop target; attaching by keyboard goes through the attach button.
		<form
			className="@container relative flex w-full flex-col gap-4 rounded-lg border border-medium bg-page p-4 has-[textarea:focus]:border-brand"
			onDragEnter={isStopping ? undefined : imageUpload.handleDragEnter}
			onDragLeave={imageUpload.handleDragLeave}
			onDragOver={(e) => e.preventDefault()}
			onDrop={handleDrop}
			onSubmit={handleFormSubmit}
			onPointerDown={handleFormPointerDown}
		>
			<DragOverlay
				isDragging={!isStopping && imageUpload.isDragging}
				externalDragging={!isStopping && externalDragging}
			/>

			<ImageUpload
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
					<Icon name="message-square-plus" height={14} width={14} className="shrink-0 text-link-on-tint" />
					<p className="min-w-0 flex-1 truncate body-sm text-secondary">{quotedText}</p>
					<Button
						type="button"
						size="sm"
						variant="ghost"
						square
						onClick={onClearQuotedText}
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
				placeholder={finalPlaceholder}
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
			) : submitMode.kind === 'blocked' ? (
				<p role="status" className="body-sm text-tertiary">
					{submitMode.message}
				</p>
			) : submitMode.kind === 'queue' && submitMode.atCapacity && submitMode.capacityMessage ? (
				<p role="status" className="body-sm text-tertiary">
					{submitMode.capacityMessage}
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
							isSuggestedRef.current = true
							applyPromptEdit({ nextValue: prompt, selectionStart: prompt.length, focus: true })
						}}
						isPending={isPending}
						isStreaming={isStreaming}
					/>
					{onOpenAlerts ? (
						<Tooltip
							content="Create & manage alerts"
							render={
								<Button
									type="button"
									size="md"
									variant="ghost"
									onClick={() => {
										trackUmamiEvent('llamaai-alerts-open', { source: 'toolbar' })
										onOpenAlerts()
									}}
									data-walkthrough="alerts-button"
								/>
							}
						>
							<Icon name="calendar-plus" height={14} width={14} className="text-warning" />
							Alerts
						</Tooltip>
					) : null}
				</div>
				<MobileToolsPopover
					mode={mode}
					setMode={setMode}
					researchUsage={researchUsage}
					factCheckedUsage={factCheckedUsage}
					onFactCheckedGated={onFactCheckedGated}
					onOpenAlerts={onOpenAlerts}
					onPromptSelect={(prompt, categoryKey) => {
						if (categoryKey === 'research') {
							setMode('research')
						}
						isSuggestedRef.current = true
						applyPromptEdit({ nextValue: prompt, selectionStart: prompt.length, focus: true })
					}}
					onImageUploadClick={imageUpload.openFilePicker}
					isPending={isPending}
					isStreaming={isStreaming}
					isStopping={isStopping}
					walkthroughActive={walkthroughActive}
				/>
				<div className="flex shrink-0 items-center gap-2">
					<span className="@max-sm:hidden" data-walkthrough="image-upload">
						<ImageUploadButton onClick={imageUpload.openFilePicker} disabled={isStopping} />
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
												(value.trim().length > 0 || imageUpload.selectedImages.length > 0),
											onStop: handleStopRequest
										}
									: submitMode.kind === 'queue'
										? {
												kind: 'queue',
												disabled: value.trim().length === 0 && imageUpload.selectedImages.length === 0
											}
										: {
												kind: 'send',
												disabled:
													isPending ||
													submitMode.kind === 'blocked' ||
													(value.trim().length === 0 && imageUpload.selectedImages.length === 0)
											}
						}
					/>
				</div>
			</div>
		</form>
	)
}
