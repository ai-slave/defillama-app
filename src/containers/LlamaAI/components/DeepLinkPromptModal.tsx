import * as Ariakit from '@ariakit/react'
import { Button } from '~/ui/Button'
import {
	DialogCloseButton,
	DialogHeading,
	dialogScrollableBodyStyles,
	dialogSurfaceStyles,
	DialogFooter
} from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'

interface DeepLinkPromptModalProps {
	isOpen: boolean
	prompt: string | null
	onClose: () => void
	onConfirm: () => void
}

export function DeepLinkPromptModal({ isOpen, prompt, onClose, onConfirm }: DeepLinkPromptModalProps) {
	return (
		<Ariakit.Dialog
			open={isOpen && !!prompt}
			onClose={onClose}
			className={`${dialogSurfaceStyles} [--dialog-width:448px]`}
			portal
			unmountOnHide
		>
			<div className="flex shrink-0 items-center justify-between gap-3 border-b border-subtle px-4 py-3">
				<DialogHeading>Ask LlamaAI?</DialogHeading>
				<DialogCloseButton />
			</div>
			<div className={`${dialogScrollableBodyStyles} flex flex-col gap-4 p-4`}>
				<div className="flex justify-center">
					<div className="flex size-14 items-center justify-center rounded-full bg-ai-gold-cta shadow-ai-gold-glow">
						<img src="/assets/llamaai/llama-ai.svg" alt="" className="size-8 object-contain" />
					</div>
				</div>
				<Ariakit.DialogDescription className="text-center body-md text-secondary">
					This link includes a question. Review it before sending.
				</Ariakit.DialogDescription>
				<div className="max-h-[220px] overflow-y-auto rounded-lg border border-subtle bg-surface-elevated-1 p-3">
					<p className="body-sm break-words whitespace-pre-wrap text-primary">{prompt}</p>
				</div>
			</div>
			<DialogFooter
				dismiss={
					<Button type="button" size="md" onClick={onClose}>
						Close
					</Button>
				}
			>
				<Button type="button" size="md" variant="primary" onClick={onConfirm}>
					<Icon name="sparkles" height={14} width={14} />
					Ask LlamaAI
				</Button>
			</DialogFooter>
		</Ariakit.Dialog>
	)
}
