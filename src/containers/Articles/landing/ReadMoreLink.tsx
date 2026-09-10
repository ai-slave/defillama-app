import Link from 'next/link'

export interface ReadMoreLinkProps {
	url: string
	title: string
}

export function ReadMoreLink({ url, title }: ReadMoreLinkProps) {
	const isExternalLink = url.startsWith('http')

	return (
		<Link
			href={url}
			className="inline-flex items-center gap-x-2 text-xs font-medium uppercase"
			rel={isExternalLink ? 'noopener noreferrer' : undefined}
			style={{ color: '#237BFF' }}
			target={isExternalLink ? '_blank' : undefined}
		>
			<span>{title}</span>
			<span aria-hidden>→</span>
		</Link>
	)
}
