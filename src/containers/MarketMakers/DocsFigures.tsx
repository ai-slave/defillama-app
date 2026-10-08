const DOCS_ASSETS = '/market-makers-docs'
export const BG_GRADIENT_GRAINY = `${DOCS_ASSETS}/bg-gradient-grainy.jpg`
export const BG_SPACE_NOISE = `${DOCS_ASSETS}/bg-space-noise.jpg`

export function docsAsset(name: string) {
	return `${DOCS_ASSETS}/${name}`
}

function FigureCaption({ caption }: { caption?: string }) {
	if (!caption) return null
	return <figcaption className="body-sm text-secondary">{caption}</figcaption>
}

export function FigureTable({ src, alt, caption }: { src: string; alt: string; caption?: string }) {
	return (
		<figure className="flex flex-col gap-2">
			<div className="relative aspect-[10/3] w-full overflow-hidden rounded-[4px] bg-[#23557A] min-[600px]:aspect-auto min-[600px]:h-[216px]">
				<img
					src={BG_GRADIENT_GRAINY}
					alt=""
					aria-hidden
					className="absolute inset-0 size-full object-cover object-top"
				/>
				<div aria-hidden className="absolute inset-0 bg-[#23557A] opacity-70" />
				<img
					src={src}
					alt={alt}
					loading="lazy"
					className="absolute top-5 left-[30px] w-[calc(100%-60px)] rounded-t-lg bg-equity-logo shadow-lg"
				/>
			</div>
			<FigureCaption caption={caption} />
		</figure>
	)
}

export function FigureRadar({ src, alt, caption }: { src: string; alt: string; caption?: string }) {
	return (
		<figure className="flex flex-col gap-2">
			<div className="relative aspect-[3/2] w-full overflow-hidden rounded-[4px] bg-[#0b1f3a]">
				<img src={BG_SPACE_NOISE} alt="" aria-hidden className="absolute inset-0 size-full object-cover object-top" />
				<img
					src={src}
					alt={alt}
					loading="lazy"
					className="absolute top-5 left-1/2 w-[68%] -translate-x-1/2 rounded-t-lg bg-equity-logo shadow-lg"
				/>
			</div>
			<FigureCaption caption={caption} />
		</figure>
	)
}

export function FigureDualTable({
	frontSrc,
	backSrc,
	alt,
	caption
}: {
	frontSrc: string
	backSrc: string
	alt: string
	caption?: string
}) {
	return (
		<figure className="flex flex-col gap-2">
			<div className="relative w-full overflow-hidden rounded-[4px] bg-[#23557A]" style={{ aspectRatio: '740 / 334' }}>
				<img
					src={BG_GRADIENT_GRAINY}
					alt=""
					aria-hidden
					className="absolute inset-0 size-full object-cover object-top"
				/>
				<div aria-hidden className="absolute inset-0 bg-[#23557A] opacity-70" />
				<div className="absolute top-[4.2%] left-[2.8%] w-[76.4%]">
					<img src={backSrc} alt="" aria-hidden className="block w-full rounded-lg bg-equity-logo" />
					<img
						src={backSrc}
						alt=""
						aria-hidden
						className="absolute inset-0 w-full rounded-lg"
						style={{
							filter: 'blur(4px)',
							WebkitMaskImage: 'linear-gradient(to bottom, transparent 60%, black 80%)',
							maskImage: 'linear-gradient(to bottom, transparent 60%, black 80%)'
						}}
					/>
				</div>
				<img
					src={frontSrc}
					alt={alt}
					loading="lazy"
					className="absolute top-[37.7%] left-[24.6%] w-[72.3%] rounded-lg border border-[#C7C7BE] bg-equity-logo"
					style={{ boxShadow: '0px 4px 68px 0px #00000040' }}
				/>
			</div>
			<FigureCaption caption={caption} />
		</figure>
	)
}
