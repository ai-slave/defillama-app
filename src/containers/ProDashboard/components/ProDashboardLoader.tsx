import Image from 'next/image'
import { Card } from '~/ui/Card'
import { InlineLoading } from '~/ui/Status'

// The Pro route's full-page loader keeps its branded llama, the one listed exception to the shared spinner
// (check-design-tokens hand-rolled-spinner). Its rings spin only under motion-safe, so reduced motion holds them still,
// and the one status line under them announces "Loading" once.
export function ProDashboardLoader({ heading }: { heading?: string | null }) {
	return (
		<Card padding="none" className="isolate flex flex-1 flex-col items-center justify-center gap-6">
			<div className="relative size-24" aria-hidden>
				<div className="absolute inset-0 rounded-full border border-pro-ai opacity-10" />

				<div className="absolute inset-0 rounded-full [animation-duration:3s] motion-safe:animate-spin">
					<div
						className="-z-10 size-full rounded-full border-2 border-transparent border-t-pro-ai border-r-pro-ai opacity-30"
						style={{
							background: 'conic-gradient(from 0deg, transparent, var(--violet-9) 90deg, transparent 180deg)'
						}}
					/>
				</div>

				<div className="absolute inset-3 rounded-full [animation-direction:reverse] [animation-duration:2s] motion-safe:animate-spin">
					<div className="size-full rounded-full border-2 border-transparent border-b-pro-ai border-l-pro-ai" />
				</div>

				<div className="absolute inset-6 rounded-full bg-pro-ai opacity-10 motion-safe:animate-pulse" />

				<div className="absolute inset-0 [animation-duration:4s] motion-safe:animate-spin">
					<div className="absolute top-0 left-1/2 -ml-1 size-2 rounded-full bg-pro-ai" />
				</div>
				<div className="absolute inset-0 [animation-direction:reverse] [animation-duration:3s] motion-safe:animate-spin">
					<div className="absolute bottom-0 left-1/2 -ml-0.75 size-1.5 rounded-full bg-pro-ai opacity-60" />
				</div>

				<div className="absolute inset-0 flex items-center justify-center">
					<div className="relative">
						<Image
							src="/assets/llama.webp"
							alt=""
							width={64}
							height={64}
							className="z-10 size-16 object-contain [animation-duration:1.5s]"
						/>
						<div
							className="absolute inset-0 -z-10 rounded-full opacity-30 [animation-duration:2s] motion-safe:animate-ping"
							style={{
								background: 'radial-gradient(circle, var(--violet-9), transparent)'
							}}
						/>
					</div>
				</div>
			</div>

			<div className="flex flex-col items-center gap-1 text-center">
				{heading ? <h1 className="heading-xs text-primary">{heading}</h1> : null}
				<InlineLoading label="Loading" />
			</div>
		</Card>
	)
}
