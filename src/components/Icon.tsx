// Material Symbols Rounded (self-hosted). All interface action icons come
// through here — emoji stays reserved for content (avatars, reactions, slides).

export default function Icon({
  name,
  size = 18,
  className = '',
  style,
}: {
  name: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span className={`icon ${className}`} style={{ fontSize: size, ...style }} aria-hidden>
      {name}
    </span>
  );
}
