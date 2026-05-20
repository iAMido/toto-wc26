import { getIso2 } from '@/lib/team-utils';

/**
 * Renders a country flag as an SVG via the `flag-icons` CSS package, instead
 * of relying on regional-indicator emoji (which doesn't render on Windows
 * Chrome/Edge by default).
 *
 * Falls back to a soccer ball glyph when the team is TBD/unknown.
 *
 * Sizes:
 *   - `sm`  — used in headers / small chips  (~20px)
 *   - `md`  — used in collapsed match cards  (~28px)
 *   - `lg`  — used in expanded match cards   (~44px)
 *   - `xl`  — reserved for selectors / hero  (~56px)
 */
type Size = 'sm' | 'md' | 'lg' | 'xl';

const SIZE_PX: Record<Size, number> = {
  sm: 20,
  md: 28,
  lg: 44,
  xl: 56,
};

interface Props {
  team: string | null | undefined;
  size?: Size;
  className?: string;
  /** Render as a circular crest (1:1 aspect) rather than a 4:3 flag. */
  round?: boolean;
}

export default function TeamFlag({ team, size = 'md', className = '', round = false }: Props) {
  const iso2 = getIso2(team);
  const px = SIZE_PX[size];

  if (!iso2) {
    // TBD or unknown team — gray silhouette shield
    return (
      <span
        className={`inline-flex items-center justify-center bg-muted text-muted-foreground/60 ${round ? 'rounded-full' : 'rounded-sm'} ${className}`}
        style={{ width: px, height: round ? px : Math.round(px * 0.75), fontSize: Math.round(px * 0.55) }}
        aria-hidden="true"
      >
        🛡
      </span>
    );
  }

  // 4:3 aspect-ratio flag is the flag-icons default. When round=true, force
  // a 1:1 box and cover-crop the flag to a circle (good for outright pickers).
  const style: React.CSSProperties = round
    ? { width: px, height: px }
    : { width: px, height: Math.round(px * 0.75) };

  return (
    <span
      className={`fi fi-${iso2} ${round ? 'rounded-full' : 'rounded-sm'} shrink-0 ${className}`}
      style={{
        ...style,
        backgroundSize: round ? 'cover' : 'cover',
        backgroundPosition: 'center',
        display: 'inline-block',
      }}
      aria-hidden="true"
    />
  );
}
