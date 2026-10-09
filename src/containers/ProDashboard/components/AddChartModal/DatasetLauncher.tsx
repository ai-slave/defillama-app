import { Card } from '~/ui/Card'
import { Icon, type IIcon } from '~/ui/Icon'
import { Tag } from '~/ui/Tag'

export type DatasetLauncherCard<T extends string> = {
	id: T
	title: string
	description: string
	icon: IIcon['name']
	tags: Array<string>
}

// The dataset choice that opens Add chart and Add table: the first card is the featured dataset with its tags,
// the rest list under "Other datasets". A locked card stays clickable; the caller opens the upgrade from onSelect.
export function DatasetLauncher<T extends string>({
	cards,
	isLocked,
	onSelect
}: {
	cards: Array<DatasetLauncherCard<T>>
	isLocked: (id: T) => boolean
	onSelect: (id: T) => void
}) {
	const [hero, ...others] = cards

	return (
		<div className="flex h-full flex-col gap-4">
			<Card
				as="button"
				type="button"
				padding="md"
				onClick={() => onSelect(hero.id)}
				className="hover-wash-card flex flex-col gap-3 text-left"
			>
				<span className="flex items-center gap-3">
					<span className="flex size-10 items-center justify-center rounded-lg bg-brand-tint">
						<Icon name={hero.icon} height={22} width={22} className="text-link" />
					</span>
					<span className="mr-auto heading-xs text-primary">{hero.title}</span>
					<Icon name="arrow-right" height={18} width={18} className="text-tertiary" />
				</span>
				<span className="body-md text-secondary">{hero.description}</span>
				<span className="flex flex-wrap gap-1.5">
					{hero.tags.map((tag) => (
						<Tag key={tag}>{tag}</Tag>
					))}
				</span>
			</Card>

			<div className="flex flex-col gap-2.5">
				<span className="label-sm text-secondary">Other datasets</span>
				<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
					{others.map((card) => {
						const locked = isLocked(card.id)
						return (
							<Card
								key={card.id}
								as="button"
								type="button"
								padding="md"
								onClick={() => onSelect(card.id)}
								className="hover-wash-card flex items-start gap-2.5 text-left"
							>
								<span className="flex h-lh shrink-0 items-center label-md">
									<Icon name={locked ? 'file-lock-2' : card.icon} height={16} width={16} className="text-secondary" />
								</span>
								<span className="flex min-w-0 flex-1 flex-col gap-0.5">
									<span className="label-md text-primary">
										{card.title}
										{locked ? <span className="ml-1 body-sm text-tertiary">(Pro)</span> : null}
									</span>
									<span className="line-clamp-1 body-sm text-secondary">{card.description}</span>
								</span>
							</Card>
						)
					})}
				</div>
			</div>
		</div>
	)
}
