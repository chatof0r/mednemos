interface LogoProps {
  size?: number;
}

// Placeholder carré — le vrai logo est en cours de refonte.
export default function Logo({ size = 32 }: LogoProps) {
  return (
    <div
      style={{ width: size, height: size }}
      className="shrink-0 rounded-lg bg-white dark:bg-brand"
    />
  );
}
