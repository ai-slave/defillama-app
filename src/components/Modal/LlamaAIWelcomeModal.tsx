import * as Ariakit from '@ariakit/react'
import { Icon } from '~/components/Icon'
import { BasicLink } from '~/components/Link'

interface LlamaAIWelcomeModalProps {
	isOpen: boolean
	onClose: () => void
}

export function LlamaAIWelcomeModal({ isOpen, onClose }: LlamaAIWelcomeModalProps) {
	return (
		<Ariakit.DialogProvider open={isOpen} setOpen={(open) => !open && onClose()}>
			<Ariakit.Dialog
				className="dialog fixed inset-0 z-50 m-auto h-fit w-full max-w-lg overflow-hidden rounded-2xl border border-[#E6E6E6] bg-[#FFFFFF] p-0 shadow-xl dark:border-sub-line dark:bg-sub-card"
				backdrop={<div className="backdrop fixed inset-0 bg-black/60 backdrop-blur-sm" />}
				portal
				unmountOnHide
			>
				<Ariakit.DialogDismiss
					data-umami-event="llamaai-welcome-dismiss"
					className="absolute top-4 right-4 z-20 rounded-full p-1.5 text-sub-text-muted transition-colors hover:bg-[#f7f7f7] hover:text-black dark:text-ai-tertiary dark:hover:bg-gray-700/50 dark:hover:text-ai-primary"
				>
					<Icon name="x" className="size-5" />
				</Ariakit.DialogDismiss>

				<div className="relative z-10 px-8 py-10">
					<div className="mb-6 flex justify-center">
						<span className="relative flex flex-col items-center justify-center">
							<span
								className="absolute block size-24.5 shrink-0"
								style={{ background: 'linear-gradient(90deg, #FEE2AD 0%, #FEE2AD 100%)', filter: 'blur(32px)' }}
							></span>
							<img
								src="/assets/llamaai/llama-ai.svg"
								alt="LlamaAI"
								className="z-10 object-contain"
								width={83}
								height={99}
							/>
						</span>
					</div>

					<h2 className="mb-4 text-center text-2xl leading-snug font-bold text-black dark:text-ai-primary">
						Introducing LlamaAI 🚀
					</h2>
					<p className="mb-6 text-center text-base leading-6 text-sub-text-muted dark:text-ai-tertiary">
						We're upgrading your subscription with LlamaAI. Turn data into deep, flexible analysis in a conversational
						way.
					</p>

					<BasicLink
						href="/ai/chat"
						data-umami-event="llamaai-welcome-goto-chat"
						className="llamaai-glow relative mx-auto flex items-center justify-center gap-2.5 overflow-hidden rounded-md bg-ai-gold-cta px-6 py-3.5 text-center text-xl font-semibold text-black shadow-ai-gold-cta"
						onClick={onClose}
					>
						<svg className="size-4 shrink-0">
							<use href="/assets/llamaai/ask-llamaai-3.svg#ai-icon" />
						</svg>
						<span className="whitespace-nowrap">Try LlamaAI</span>
					</BasicLink>
				</div>
			</Ariakit.Dialog>
		</Ariakit.DialogProvider>
	)
}
