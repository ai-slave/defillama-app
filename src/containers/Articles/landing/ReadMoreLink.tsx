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
			className="inline-flex items-center gap-x-2 label-sm text-link uppercase"
			rel={isExternalLink ? 'noopener noreferrer' : undefined}
			target={isExternalLink ? '_blank' : undefined}
		>
			<span>{title}</span>
			<span aria-hidden>→</span>
		</Link>
	)
}
