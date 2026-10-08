import { useState } from 'react'

export function EntityIcon({
	src,
	name,
	size = 20
}: {
	src?: string | null | undefined
	name?: string | null | undefined
	size?: number | undefined
}) {
	const [failedSrc, setFailedSrc] = useState<string | null>(null)

	return (
		<span
			className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-elevated-2 ring-1 ring-(--border-subtle)"
			style={{ width: size, height: size }}
		>
			{src && src !== failedSrc ? (
				// eslint-disable-next-line @next/next/no-img-element
				<img
					src={src}
					alt=""
					width={size}
					height={size}
					loading="lazy"
					className="size-full object-cover"
					onError={() => setFailedSrc(src)}
				/>
			) : (
				<span aria-hidden="true" className="title-sm text-secondary">
					{name?.charAt(0).toUpperCase() ?? ''}
				</span>
			)}
		</span>
	)
}
