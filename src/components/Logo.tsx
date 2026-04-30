interface LogoProps {
  size?: number;
}

export default function Logo({ size = 32 }: LogoProps) {
  return (
    <div
      style={{ width: size, height: size, backgroundColor: '#e3fe52' }}
      className="rounded-full flex items-center justify-center shrink-0"
    >
      <svg
        width={size * 0.65}
        height={size * 0.65}
        viewBox="0 0 22 22"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Stopwatch stem */}
        <rect x="10" y="0.5" width="2" height="2.5" rx="1" fill="#0c0c0c" />
        {/* Stopwatch crown */}
        <rect x="8.5" y="0.5" width="5" height="1.5" rx="0.75" fill="#0c0c0c" />
        {/* Stopwatch outer ring */}
        <circle cx="11" cy="13" r="8" stroke="#0c0c0c" strokeWidth="1.4" />
        {/* Brain left lobe */}
        <path
          d="M11 8.5 C11 8.5 7.5 9 7 11.5 C6.5 13.5 8 16 11 16"
          stroke="#0c0c0c"
          strokeWidth="1.1"
          strokeLinecap="round"
          fill="none"
        />
        {/* Brain right lobe */}
        <path
          d="M11 8.5 C11 8.5 14.5 9 15 11.5 C15.5 13.5 14 16 11 16"
          stroke="#0c0c0c"
          strokeWidth="1.1"
          strokeLinecap="round"
          fill="none"
        />
        {/* Brain center line */}
        <line x1="11" y1="8.5" x2="11" y2="16" stroke="#0c0c0c" strokeWidth="0.7" />
        {/* Clock hand — minutes */}
        <line x1="11" y1="13" x2="11" y2="10" stroke="#0c0c0c" strokeWidth="1.4" strokeLinecap="round" />
        {/* Clock hand — hours */}
        <line x1="11" y1="13" x2="13.5" y2="13" stroke="#0c0c0c" strokeWidth="1.4" strokeLinecap="round" />
        {/* Center dot */}
        <circle cx="11" cy="13" r="0.8" fill="#0c0c0c" />
      </svg>
    </div>
  );
}
