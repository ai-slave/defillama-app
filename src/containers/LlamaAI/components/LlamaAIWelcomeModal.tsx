import * as Ariakit from '@ariakit/react'
import { BasicLink } from '~/components/Link'
import { DialogCloseButton, DialogHeading, dialogScrollableBodyStyles, dialogSurfaceStyles } from '~/ui/Dialog'

interface LlamaAIWelcomeModalProps {
	isOpen: boolean
	onClose: () => void
}

export function LlamaAIWelcomeModal({ isOpen, onClose }: LlamaAIWelcomeModalProps) {
	return (
		<Ariakit.DialogProvider open={isOpen} setOpen={(open) => !open && onClose()}>
			<Ariakit.Dialog className={`${dialogSurfaceStyles} [--dialog-width:512px]`} portal unmountOnHide>
				<div className="flex shrink-0 justify-end px-2 py-1">
					<DialogCloseButton data-umami-event="llamaai-welcome-dismiss" />
				</div>
				<div className={`${dialogScrollableBodyStyles} flex flex-col items-center gap-4 px-8 pt-2 pb-8`}>
					<span className="relative flex items-center justify-center">
						{/* The gold glow behind the llama is the product's landing-page beacon. */}
						<span aria-hidden className="absolute size-24 rounded-full bg-ai-gold-bright blur-2xl" />
						<img src="/assets/llamaai/llama-ai.svg" alt="" className="relative object-contain" width={83} height={99} />
					</span>
					<DialogHeading className="text-center">Introducing LlamaAI 🚀</DialogHeading>
					<Ariakit.DialogDescription className="text-center body-md text-secondary">
						We're upgrading your subscription with LlamaAI. Turn data into deep, flexible analysis in a conversational
						way.
					</Ariakit.DialogDescription>
					<BasicLink
						href="/ai/chat"
						data-umami-event="llamaai-welcome-goto-chat"
						className="llamaai-glow relative flex min-h-8 items-center justify-center gap-2 overflow-hidden rounded-lg bg-ai-gold-cta px-4 py-1.5 label-sm text-ai-on-gold-strong shadow-ai-gold-cta"
						onClick={onClose}
					>
						<svg className="size-4 shrink-0" aria-hidden>
							<use href="/assets/llamaai/ask-llamaai-3.svg#ai-icon" />
						</svg>
						<span className="whitespace-nowrap">Try LlamaAI</span>
					</BasicLink>
				</div>
			</Ariakit.Dialog>
		</Ariakit.DialogProvider>
	)
}
