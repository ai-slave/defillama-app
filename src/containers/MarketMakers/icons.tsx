export function ArrowRightIcon({ className }: { className?: string }) {
	return (
		<svg
			width="14"
			height="12"
			viewBox="0 0 14 12"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			className={`shrink-0 ${className ?? ''}`}
			aria-hidden
		>
			<path
				d="M7.75 10.75L12.75 5.75L7.75 0.75M12.75 5.75H0.75"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	)
}

export function SlidersIcon({ className }: { className?: string }) {
	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 16 16"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			className={className}
		>
			<path
				d="M7 4L13.5 4M5 4C5 3.44771 5.44772 3 6 3C6.55229 3 7 3.44772 7 4C7 4.55228 6.55228 5 6 5C5.44772 5 5 4.55228 5 4ZM2.5 4H5M7 12H13.5M5 12C5 11.4477 5.44772 11 6 11C6.55228 11 7 11.4477 7 12C7 12.5523 6.55228 13 6 13C5.44772 13 5 12.5523 5 12ZM2.5 12L5 12M11 8L13.5 8M9 8C9 7.44771 9.44772 7 10 7C10.5523 7 11 7.44772 11 8C11 8.55228 10.5523 9 10 9C9.44772 9 9 8.55228 9 8ZM2.5 8H9"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	)
}

export function CheckCircleIcon({ className }: { className?: string }) {
	return (
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			className={`shrink-0 ${className ?? ''}`}
		>
			<path
				fillRule="evenodd"
				clipRule="evenodd"
				d="M11.9999 21.6C17.3018 21.6 21.5999 17.302 21.5999 12C21.5999 6.69809 17.3018 2.40002 11.9999 2.40002C6.69797 2.40002 2.3999 6.69809 2.3999 12C2.3999 17.302 6.69797 21.6 11.9999 21.6ZM16.6278 9.82938C16.9201 9.42739 16.8312 8.86452 16.4293 8.57216C16.0273 8.27981 15.4644 8.36868 15.172 8.77067L10.9915 14.5189L8.7363 12.2636C8.38483 11.9122 7.81498 11.9122 7.46351 12.2636C7.11203 12.6151 7.11203 13.1849 7.46351 13.5364L10.4635 16.5364C10.6496 16.7225 10.9079 16.8179 11.1703 16.7973C11.4327 16.7767 11.673 16.6422 11.8278 16.4294L16.6278 9.82938Z"
				fill="#057A55"
			/>
		</svg>
	)
}
