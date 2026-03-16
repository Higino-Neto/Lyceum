export function Logo({ size = 120, variant = 'color', className = '' }) {
  const primaryColor = variant === 'color' ? '#22c55e' : variant === 'dark' ? '#000000' : '#ffffff';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      className={className}
      strokeLinejoin="round"
    >
      <rect x="30" y="25" width="13" height="65" rx="2" fill={primaryColor} />
      <rect x="30" y="77" width="60" height="13" rx="2" fill={primaryColor} />
      <rect x="77" y="25" width="13" height="39" rx="2" fill={primaryColor} />
      <polygon points="89,45 60,25 83,25 83,45" fill={primaryColor} />
    </svg>
  );
}
