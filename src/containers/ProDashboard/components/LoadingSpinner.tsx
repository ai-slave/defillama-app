interface LoadingSpinnerProps {
	size?: 'sm' | 'md' | 'lg'
	className?: string
}

export function LoadingSpinner({ size = 'md', className = '' }: LoadingSpinnerProps) {
	const sizeClasses = {
		sm: 'size-5',
		md: 'size-8',
		lg: 'size-12'
	}

	return <div className={`animate-spin rounded-full border-b-2 border-brand ${sizeClasses[size]} ${className}`} />
}
