type LogoMarkProps = {
  size?: number;
  variant?: "light" | "dark";
};

export default function LogoMark({ size = 28, variant = "light" }: LogoMarkProps) {
  const stroke = variant === "light" ? "#58ABD4" : "#1E4B88";
  const strokeBottom = variant === "light" ? "#2E7BB5" : "#1E4B88";
  const fill = variant === "light" ? "rgba(88,171,212,0.18)" : "rgba(181,217,238,0.35)";
  const dot = variant === "light" ? "#2E7BB5" : "#1E4B88";

  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="4,4 24,14 11,14" fill={fill} />
      <line x1="4" y1="4" x2="24" y2="14" stroke={stroke} strokeWidth="2.4" strokeLinecap="round" />
      <line x1="24" y1="14" x2="11" y2="14" stroke={strokeBottom} strokeWidth="2.4" strokeLinecap="round" />
      <line x1="11" y1="14" x2="4" y2="4" stroke={stroke} strokeWidth="2.4" strokeLinecap="round" />
      <line x1="11" y1="14" x2="4" y2="24" stroke={stroke} strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="24" cy="14" r="2.8" fill={dot} />
    </svg>
  );
}
