import { useTranslation } from 'react-i18next';

/**
 * Auto-mirroring chevron / back-arrow glyph.
 *
 *   <Chevron direction="forward" />   →  ›  in LTR,  ‹  in Hebrew RTL
 *   <Chevron direction="back" />      →  ←  in LTR,  →  in Hebrew RTL
 *
 * Use this anywhere a directional indicator appears in nav-style lists,
 * "view all" links, back buttons, etc. Replaces the raw Unicode characters
 * (›, ←, →) that don't flip on their own based on dir=rtl.
 */
export default function Chevron({
  direction = 'forward',
  className = '',
}: {
  direction?: 'forward' | 'back';
  className?: string;
}) {
  const { i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';

  let glyph: string;
  if (direction === 'forward') {
    // "forward" = the direction of reading, so in LTR it's ›, in RTL it's ‹
    glyph = isRtl ? '‹' : '›';
  } else {
    // "back" = opposite of reading direction
    glyph = isRtl ? '→' : '←';
  }

  return <span aria-hidden="true" className={className}>{glyph}</span>;
}
