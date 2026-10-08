import toast from 'react-hot-toast'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { Tooltip } from '~/ui/Tooltip'

const SUCCESS_TOAST_DURATION = 4000

export function successToast({ title, description }: { title: string; description?: string }) {
	if (!description) {
		return toast.success(title, { duration: SUCCESS_TOAST_DURATION })
	}
	return toast.success(
		<div className="flex flex-col gap-1">
			<p className="title-md text-primary">{title}</p>
			<p className="text-secondary">{description}</p>
		</div>,
		{ duration: SUCCESS_TOAST_DURATION }
	)
}

export function errorToast({ title, description }: { title: string; description: string }) {
	return toast.error(
		(t) => (
			<div className="flex flex-col gap-2">
				<p className="flex items-center gap-2 title-md text-error">
					<Icon name="alert-triangle" height={16} width={16} />
					<span>{title}</span>
					<Tooltip
						content="Close"
						portal={false}
						// Beside the button, in the title row's free space: above clips at the viewport top, below covers the description.
						placement="left"
						render={
							<Button
								variant="ghost"
								size="sm"
								square
								className="ml-auto"
								aria-label="Close"
								onClick={() => toast.dismiss(t.id)}
							/>
						}
					>
						<Icon name="x" className="size-4" />
					</Tooltip>
				</p>
				<p className="text-secondary">{description}</p>
			</div>
		),
		{
			position: 'top-right',
			icon: null,
			style: {
				padding: '12px'
			}
		}
	)
}
