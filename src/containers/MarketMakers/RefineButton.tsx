import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'

export function RefineButton({ onClick }: { onClick: () => void }) {
	return (
		<Button type="button" onClick={onClick} size="md" aria-label="Refine leaderboard">
			<Icon name="sliders-horizontal" className="size-4 text-primary" aria-hidden />
			<span className="hidden min-[1120px]:inline">Refine</span>
		</Button>
	)
}
