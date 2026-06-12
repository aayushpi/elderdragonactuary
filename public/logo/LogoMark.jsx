// LogoMark — Elder Dragon Actuary monocled dragon eye.
// Theme-aware: linework follows --foreground, pupil follows --primary
// (pass explicit ink/accent to opt out). Chain auto-drops below 24px.
function LogoMark({ size = 28, ink, accent, chain }) {
  const _ink = ink || "hsl(var(--foreground))";
  const _accent = accent || "hsl(var(--primary))";
  const _chain = chain !== undefined ? chain : size >= 24;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <circle cx="30" cy="28" r="22" stroke={_ink} strokeWidth="3.5"></circle>
      <path d="M9.5 28 Q30 14 50.5 28 Q30 42 9.5 28 Z" stroke={_ink} strokeWidth="2.8" strokeLinejoin="round"></path>
      <path d="M30 19.5 Q34.5 28 30 36.5 Q25.5 28 30 19.5 Z" fill={_accent}></path>
      {_chain && <path d="M46 44 C 51 49, 52 53, 49 59" stroke={_ink} strokeWidth="2.6" strokeLinecap="round" strokeDasharray="0.1 5.2"></path>}
    </svg>
  );
}
export default LogoMark;
