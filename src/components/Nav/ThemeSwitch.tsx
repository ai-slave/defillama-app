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
	const [isDarkMode, toggleDarkMode] = useDarkModeManager()

	if (variant === 'pill') {
		const iconSize = size === 'sm' ? 'size-4' : 'size-6'

		return (
			<button
				type="button"
				onClick={toggleDarkMode}
				aria-label="Dark mode"
				data-menu-name="Toggle theme"
				aria-pressed={isDarkMode}
				className={joinClasses(
					'hover-wash flex items-center gap-1 rounded-full p-0.5 transition-colors',
					'bg-surface',
					className
				)}
			>
				<span
					className={joinClasses(
						'flex items-center justify-center rounded-full p-1.5 transition-colors',
						'bg-surface-elevated-2 text-primary dark:bg-transparent dark:text-secondary'
					)}
				>
					<Icon name="sun" className={iconSize} />
				</span>
				<span
					className={joinClasses(
						'flex items-center justify-center rounded-full p-1.5 transition-colors',
						'text-secondary dark:bg-surface-elevated-2 dark:text-primary'
					)}
				>
					<Icon name="moon" className={iconSize} />
				</span>
			</button>
		)
	}

	return (
		<button
			type="button"
			onClick={toggleDarkMode}
			aria-label="Dark mode"
			data-menu-name="Toggle theme"
			aria-pressed={isDarkMode}
			className={joinClasses('mt-2 hidden w-fit items-center gap-2 lg:flex', className)}
		>
			<Icon name="sun" className="size-5 text-primary dark:text-tertiary dark:hover:text-primary" />
			<span>{' / '}</span>
			<Icon name="moon" className="size-5 text-tertiary hover:text-primary dark:text-primary" />
		</button>
	)
}
