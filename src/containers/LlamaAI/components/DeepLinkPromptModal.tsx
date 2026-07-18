import * as Ariakit from '@ariakit/react'
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
			className="dialog fixed inset-0 z-50 m-auto h-fit w-full max-w-md overflow-hidden rounded-2xl border border-ai-line bg-ai-surface-card p-0 shadow-xl"
			backdrop={<div className="backdrop fixed inset-0 bg-ai-backdrop backdrop-blur-sm" />}
			portal
			unmountOnHide
		>
			<button
				type="button"
				onClick={onClose}
				className="absolute top-4 right-4 z-20 rounded-full p-1.5 text-ai-tertiary transition-colors hover:bg-ai-surface-muted hover:text-ai-primary"
				aria-label="Close"
			>
				<Icon name="x" className="size-5" />
			</button>

			<div className="relative z-10 px-8 py-10">
				<div className="mb-6 flex justify-center">
					<div
						className="flex size-16 items-center justify-center rounded-full shadow-ai-gold-glow"
						style={{ background: 'linear-gradient(135deg, #FDE0A9 0%, #FBEDCB 60%, #FDE0A9 100%)' }}
					>
						<img src="/assets/llamaai/llama-ai.svg" alt="" className="size-9 object-contain" />
					</div>
				</div>

				<Ariakit.DialogHeading className="mb-3 text-center text-xl leading-snug font-bold text-ai-primary">
					Ask LlamaAI?
				</Ariakit.DialogHeading>
				<p className="mb-5 text-center text-base leading-6 text-ai-tertiary">
					This link includes a question. Review it before sending.
				</p>

				<div className="mb-6 max-h-[220px] overflow-y-auto rounded-lg border border-ai-line bg-ai-surface p-3">
					<p className="text-sm leading-6 break-words whitespace-pre-wrap text-ai-secondary">{prompt}</p>
				</div>

				<div className="flex flex-col gap-3">
					<button
						type="button"
						onClick={onConfirm}
						className="flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3.5 text-center text-base font-semibold text-ai-on-gold shadow-ai-gold-btn transition-all hover:shadow-ai-gold-btn-hover active:translate-y-px"
						style={{
							background: 'linear-gradient(93.94deg, #FDE0A9 24.73%, #FBEDCB 57.42%, #FDE0A9 99.73%)'
						}}
					>
						<Icon name="sparkles" height={16} width={16} />
						Ask LlamaAI
					</button>
					<button
						type="button"
						onClick={onClose}
						className="w-full rounded-lg border border-ai-line px-6 py-3 text-center text-sm font-medium text-ai-tertiary transition-colors hover:bg-ai-surface-muted hover:text-ai-primary"
					>
						Close
					</button>
				</div>
			</div>
		</Ariakit.Dialog>
	)
}
