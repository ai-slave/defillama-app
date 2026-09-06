import toast from 'react-hot-toast'
import { Icon } from '~/ui/Icon'

const SUCCESS_TOAST_DURATION = 4000

export function successToast({ title, description }: { title: string; description?: string }) {
	if (!description) {
		return toast.success(title, { duration: SUCCESS_TOAST_DURATION })
	}
	return toast.success(
		<div className="flex flex-col gap-1">
			<p className="font-semibold text-primary">{title}</p>
			<p className="text-secondary">{description}</p>
		</div>,
		{ duration: SUCCESS_TOAST_DURATION }
	)
}

export function errorToast({ title, description }: { title: string; description: string }) {
	return toast.error(
		(t) => (
			<div className="flex flex-col gap-2">
				<p className="flex items-center gap-2 text-base font-semibold text-error">
					<Icon name="alert-triangle" height={16} width={16} />
					<span>{title}</span>
					<button type="button" onClick={() => toast.dismiss(t.id)} className="ml-auto text-primary">
						<Icon name="circle-x" height={16} width={16} />

						<span className="sr-only">Close</span>
					</button>
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
