import Image from 'next/image'
import { LoadingDots } from '~/ui/Loaders'

export function ProDashboardLoader({ heading }: { heading?: string | null }) {
	return (
		<div className="isolate flex flex-1 flex-col items-center justify-center gap-6 rounded-md border border-pro-cards-border bg-pro-cards-bg p-1">
			<div className="relative size-24">
				<div className="absolute inset-0 rounded-full border border-pro-ai-400 opacity-10" />

				<div className="absolute inset-0 animate-spin rounded-full [animation-duration:3s]">
					<div
						className="-z-10 size-full rounded-full border-2 border-transparent border-t-pro-ai-400 border-r-pro-ai-400 opacity-30"
						style={{
							background: 'conic-gradient(from 0deg, transparent, var(--color-pro-ai-400) 90deg, transparent 180deg)'
						}}
					/>
				</div>

				<div className="absolute inset-3 animate-spin rounded-full [animation-direction:reverse] [animation-duration:2s]">
					<div className="size-full rounded-full border-2 border-transparent border-b-pro-ai-400 border-l-pro-ai-400" />
				</div>

				<div className="absolute inset-6 animate-pulse rounded-full bg-pro-ai-400 opacity-10" />

				<div className="absolute inset-0 animate-spin [animation-duration:4s]">
					<div className="absolute top-0 left-1/2 -ml-1 size-2 rounded-full bg-pro-ai-400" />
				</div>
				<div className="absolute inset-0 animate-spin [animation-direction:reverse] [animation-duration:3s]">
					<div className="absolute bottom-0 left-1/2 -ml-0.75 size-1.5 rounded-full bg-pro-ai-400 opacity-60" />
				</div>

				<div className="absolute inset-0 flex items-center justify-center">
					<div className="relative">
						<Image
							src="/assets/llama.webp"
							alt="Loading"
							width={64}
							height={64}
							className="z-10 size-16 object-contain [animation-duration:1.5s]"
						/>
						<div
							className="absolute inset-0 -z-10 animate-ping rounded-full opacity-30 [animation-duration:2s]"
							style={{
								background: 'radial-gradient(circle, var(--color-pro-ai-400), transparent)'
							}}
						/>
					</div>
				</div>
			</div>

			<div className="flex flex-col items-center gap-1 text-center">
				{heading ? <h1 className="heading-xs text-pro-text-primary">{heading}</h1> : null}
				<p className="flex items-center gap-1 text-pro-text-label">
					Loading
					<LoadingDots />
				</p>
			</div>
		</div>
	)
}
