export function Mark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <circle cx="50" cy="50" r="46" fill="none" stroke="#c9a96a" strokeWidth="1.2" />
      <circle cx="50" cy="50" r="40" fill="none" stroke="#c9a96a" strokeWidth=".5" opacity=".6" />
      <path d="M29 33 L50 71 L71 33" fill="none" stroke="#ecd8a8" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="logo">
      <Mark />
      <span>
        <b>VERUM</b>
        <small>Society</small>
      </span>
    </span>
  );
}
