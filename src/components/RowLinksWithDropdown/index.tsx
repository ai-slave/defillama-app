import { LinksWithDropdown } from './LinksWithDropdown'
import { OtherLinks } from './OtherLinks'

interface ILink {
	label: string
	to: string
}

interface IRowLinksProps {
	links: ILink[]
	name?: string
	activeLink?: string
	alternativeOthersText?: string
}

export const RowLinksWithDropdown = (props: IRowLinksProps) => {
	return (
		<span>
			<span className="sm:hidden">
				<OtherLinks
					name={
						props.links.find((link) => link.label === props.activeLink)?.label ??
						props.alternativeOthersText ??
						'Others'
					}
					options={props.links}
					keyPrefix={props.name}
					isActive={true}
					className="min-h-8 w-full justify-between"
				/>
			</span>
			<div className="flex flex-nowrap rounded-lg border border-subtle bg-surface max-sm:hidden">
				<LinksWithDropdown {...props} />
			</div>
		</span>
	)
}
