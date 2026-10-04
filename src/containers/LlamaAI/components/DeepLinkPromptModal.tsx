import * as Ariakit from '@ariakit/react'
import type { RefObject } from 'react'
import { Button } from '~/ui/Button'
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'

interface DeepLinkPromptModalProps {
	isOpen: boolean
	prompt: string | null
	onClose: () => void
	onConfirm: () => void
	/** The dialog opens on load with no trigger; closing it either way continues in the composer. */
	promptInputRef: RefObject<HTMLTextAreaElement | null>
}

// A confirmation: the question arrived in a link someone else wrote, so it starts on Cancel and is sent only by choice.
export function DeepLinkPromptModal({ isOpen, prompt, onClose, onConfirm, promptInputRef }: DeepLinkPromptModalProps) {
	return (
		<Dialog size="sm" open={isOpen && !!prompt} onClose={onClose} finalFocus={promptInputRef} portal unmountOnHide>
			<DialogHeader
				title="Ask LlamaAI?"
				subtitle="This link includes a question. Review it before sending."
				closable={false}
				leading={
					<span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ai-gold-cta">
						<img src="/assets/llamaai/llama-ai.svg" alt="" className="size-5 object-contain" />
					</span>
				}
			/>
			<DialogBody>
				<p className="rounded-lg border border-subtle bg-surface-elevated-1 p-3 body-sm break-words whitespace-pre-wrap text-primary">
					{prompt}
				</p>
			</DialogBody>
			<DialogFooter>
				<Ariakit.DialogDismiss autoFocus render={<Button type="button" size="md" />}>
					Cancel
				</Ariakit.DialogDismiss>
				<Button type="button" size="md" variant="primary" onClick={onConfirm}>
					<Icon name="sparkles" height={14} width={14} />
					Ask LlamaAI
				</Button>
			</DialogFooter>
		</Dialog>
	)
}
