import { Button } from '~/ui/Button'
import { SlidersIcon } from './icons'

export function RefineButton({ onClick }: { onClick: () => void }) {
	return (
		<Button type="button" onClick={onClick} size="md" aria-label="Refine leaderboard">
			<SlidersIcon className="text-primary" />
			<span className="hidden min-[1120px]:inline">Refine</span>
		</Button>
	)
}
