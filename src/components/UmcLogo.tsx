export function UmcLogo({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M20 3L35 10.5V23.5C35 30.8 28.6 36.2 20 38C11.4 36.2 5 30.8 5 23.5V10.5L20 3Z"
        fill="#11151B"
        stroke="#10B981"
        strokeWidth="2.2"
      />
      <path
        d="M20 9L29 13.5V22.2C29 26.9 25.1 30.6 20 32C14.9 30.6 11 26.9 11 22.2V13.5L20 9Z"
        fill="#059669"
        fillOpacity="0.22"
      />
      <path
        d="M20 11.5L26.5 16.5L20 26.5L13.5 16.5L20 11.5Z"
        fill="#10B981"
      />
      <path d="M20 11.5L26.5 16.5L20 19V11.5Z" fill="#34D399" />
    </svg>
  );
}
