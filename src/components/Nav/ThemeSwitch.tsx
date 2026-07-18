import { useDarkModeManager } from '~/contexts/LocalStorage'
import { Icon } from '~/ui/Icon'

interface ThemeSwitchProps {
	className?: string
	variant?: 'default' | 'pill'
	size?: 'sm' | 'md'
}

function joinClasses(...classes: Array<string | undefined>) {
	return classes.filter(Boolean).join(' ')
}

export function ThemeSwitch({ className, variant = 'default', size = 'md' }: ThemeSwitchProps) {
	const [, toggleDarkMode] = useDarkModeManager()

	if (variant === 'pill') {
		const controlSize = size === 'sm' ? 'size-7' : 'size-9'
		const iconSize = size === 'sm' ? 16 : 24

		return (
			<button
				type="button"
				onClick={toggleDarkMode}
				aria-label="Toggle theme"
				className={joinClasses(
					'hover-wash flex items-center gap-1 rounded-full p-0.5 transition-colors',
					'bg-surface',
					className
				)}
			>
				<span
					className={joinClasses(
						`flex ${controlSize} items-center justify-center rounded-full transition-colors`,
						'bg-surface-elevated-2 text-primary dark:bg-transparent dark:text-secondary'
					)}
				>
					<Icon name="sun" height={iconSize} width={iconSize} />
				</span>
				<span
					className={joinClasses(
						`flex ${controlSize} items-center justify-center rounded-full transition-colors`,
						'text-secondary dark:bg-surface-elevated-2 dark:text-primary'
					)}
				>
					<Icon name="moon" height={iconSize} width={iconSize} />
				</span>
			</button>
		)
	}

	return (
		<button
			type="button"
			onClick={toggleDarkMode}
			aria-label="Toggle theme"
			className={joinClasses('mt-2 hidden w-fit items-center gap-2 lg:flex', className)}
		>
			<Icon
				name="sun"
				height={20}
				width={20}
				className="opacity-80 hover:opacity-100 dark:opacity-40 dark:hover:opacity-100"
			/>
			<span>{' / '}</span>
			<Icon
				name="moon"
				height={20}
				width={20}
				className="opacity-40 hover:opacity-100 dark:opacity-80 dark:hover:opacity-100"
			/>
		</button>
	)
}
