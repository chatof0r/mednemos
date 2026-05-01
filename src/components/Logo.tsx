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
        width={size * 0.62}
        height={size * 0.62}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Left lobe outline */}
        <path
          d="M12 5.5C11.1 4.5 9.8 4 8.5 4C6.3 4 4.5 5.5 4 7.5C3.7 8.8 4 10.2 4.8 11.2C4.1 12 3.8 13.1 4 14.2C4.4 16.2 6.1 17.7 8 17.9C8.7 18 9.4 17.9 10 17.6C10.6 17.9 11.3 18 12 18"
          stroke="#0c0c0c"
          strokeWidth="1.35"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Right lobe outline */}
        <path
          d="M12 5.5C12.9 4.5 14.2 4 15.5 4C17.7 4 19.5 5.5 20 7.5C20.3 8.8 20 10.2 19.2 11.2C19.9 12 20.2 13.1 20 14.2C19.6 16.2 17.9 17.7 16 17.9C15.3 18 14.6 17.9 14 17.6C13.4 17.9 12.7 18 12 18"
          stroke="#0c0c0c"
          strokeWidth="1.35"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Interhemispheric fissure */}
        <line x1="12" y1="5.5" x2="12" y2="18" stroke="#0c0c0c" strokeWidth="0.85" strokeLinecap="round" />
        {/* Left sulci */}
        <path d="M7 9C7.8 8.5 9.2 8.8 9.8 9.8" stroke="#0c0c0c" strokeWidth="0.95" strokeLinecap="round" fill="none" />
        <path d="M6.5 13C7.6 12.2 9.6 12.7 10.5 13.8" stroke="#0c0c0c" strokeWidth="0.95" strokeLinecap="round" fill="none" />
        {/* Right sulci */}
        <path d="M17 9C16.2 8.5 14.8 8.8 14.2 9.8" stroke="#0c0c0c" strokeWidth="0.95" strokeLinecap="round" fill="none" />
        <path d="M17.5 13C16.4 12.2 14.4 12.7 13.5 13.8" stroke="#0c0c0c" strokeWidth="0.95" strokeLinecap="round" fill="none" />
      </svg>
    </div>
  );
}
