/** Country flag emojis, short codes, and ISO 3166-1 alpha-2 codes (for SVG flags) */

const TEAM_DATA: Record<string, { flag: string; code: string; iso2: string; he: string }> = {
  // Group A
  'Morocco':       { flag: '🇲🇦', code: 'MAR', iso2: 'ma', he: 'מרוקו' },
  'USA':           { flag: '🇺🇸', code: 'USA', iso2: 'us', he: 'ארה״ב' },
  'Mexico':        { flag: '🇲🇽', code: 'MEX', iso2: 'mx', he: 'מקסיקו' },
  'Canada':        { flag: '🇨🇦', code: 'CAN', iso2: 'ca', he: 'קנדה' },
  // Group B
  'Argentina':     { flag: '🇦🇷', code: 'ARG', iso2: 'ar', he: 'ארגנטינה' },
  'Brazil':        { flag: '🇧🇷', code: 'BRA', iso2: 'br', he: 'ברזיל' },
  'Colombia':      { flag: '🇨🇴', code: 'COL', iso2: 'co', he: 'קולומביה' },
  'Uruguay':       { flag: '🇺🇾', code: 'URU', iso2: 'uy', he: 'אורוגוואי' },
  // Group C
  'France':        { flag: '🇫🇷', code: 'FRA', iso2: 'fr', he: 'צרפת' },
  'Germany':       { flag: '🇩🇪', code: 'GER', iso2: 'de', he: 'גרמניה' },
  'Spain':         { flag: '🇪🇸', code: 'ESP', iso2: 'es', he: 'ספרד' },
  'Portugal':      { flag: '🇵🇹', code: 'POR', iso2: 'pt', he: 'פורטוגל' },
  // Group D
  'England':       { flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', code: 'ENG', iso2: 'gb-eng', he: 'אנגליה' },
  'Netherlands':   { flag: '🇳🇱', code: 'NED', iso2: 'nl', he: 'הולנד' },
  'Belgium':       { flag: '🇧🇪', code: 'BEL', iso2: 'be', he: 'בלגיה' },
  'Italy':         { flag: '🇮🇹', code: 'ITA', iso2: 'it', he: 'איטליה' },
  // Other teams
  'Croatia':       { flag: '🇭🇷', code: 'CRO', iso2: 'hr', he: 'קרואטיה' },
  'Denmark':       { flag: '🇩🇰', code: 'DEN', iso2: 'dk', he: 'דנמרק' },
  'Switzerland':   { flag: '🇨🇭', code: 'SUI', iso2: 'ch', he: 'שוויץ' },
  'Serbia':        { flag: '🇷🇸', code: 'SRB', iso2: 'rs', he: 'סרביה' },
  'Japan':         { flag: '🇯🇵', code: 'JPN', iso2: 'jp', he: 'יפן' },
  'South Korea':   { flag: '🇰🇷', code: 'KOR', iso2: 'kr', he: 'דרום קוריאה' },
  'Australia':     { flag: '🇦🇺', code: 'AUS', iso2: 'au', he: 'אוסטרליה' },
  'Saudi Arabia':  { flag: '🇸🇦', code: 'KSA', iso2: 'sa', he: 'ערב הסעודית' },
  'Iran':          { flag: '🇮🇷', code: 'IRN', iso2: 'ir', he: 'איראן' },
  'Qatar':         { flag: '🇶🇦', code: 'QAT', iso2: 'qa', he: 'קטאר' },
  'Ecuador':       { flag: '🇪🇨', code: 'ECU', iso2: 'ec', he: 'אקוודור' },
  'Paraguay':      { flag: '🇵🇾', code: 'PAR', iso2: 'py', he: 'פרגוואי' },
  'Chile':         { flag: '🇨🇱', code: 'CHI', iso2: 'cl', he: 'צ׳ילה' },
  'Peru':          { flag: '🇵🇪', code: 'PER', iso2: 'pe', he: 'פרו' },
  'Venezuela':     { flag: '🇻🇪', code: 'VEN', iso2: 've', he: 'ונצואלה' },
  'Bolivia':       { flag: '🇧🇴', code: 'BOL', iso2: 'bo', he: 'בוליביה' },
  'Poland':        { flag: '🇵🇱', code: 'POL', iso2: 'pl', he: 'פולין' },
  'Ukraine':       { flag: '🇺🇦', code: 'UKR', iso2: 'ua', he: 'אוקראינה' },
  'Turkey':        { flag: '🇹🇷', code: 'TUR', iso2: 'tr', he: 'טורקיה' },
  'Austria':       { flag: '🇦🇹', code: 'AUT', iso2: 'at', he: 'אוסטריה' },
  'Czech Republic':{ flag: '🇨🇿', code: 'CZE', iso2: 'cz', he: 'צ׳כיה' },
  'Scotland':      { flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', code: 'SCO', iso2: 'gb-sct', he: 'סקוטלנד' },
  'Wales':         { flag: '🏴󠁧󠁢󠁷󠁬󠁳󠁿', code: 'WAL', iso2: 'gb-wls', he: 'וויילס' },
  'Norway':        { flag: '🇳🇴', code: 'NOR', iso2: 'no', he: 'נורבגיה' },
  'Sweden':        { flag: '🇸🇪', code: 'SWE', iso2: 'se', he: 'שוודיה' },
  'Ghana':         { flag: '🇬🇭', code: 'GHA', iso2: 'gh', he: 'גאנה' },
  'Senegal':       { flag: '🇸🇳', code: 'SEN', iso2: 'sn', he: 'סנגל' },
  'Cameroon':      { flag: '🇨🇲', code: 'CMR', iso2: 'cm', he: 'קמרון' },
  'Nigeria':       { flag: '🇳🇬', code: 'NGA', iso2: 'ng', he: 'ניגריה' },
  'Egypt':         { flag: '🇪🇬', code: 'EGY', iso2: 'eg', he: 'מצרים' },
  'Tunisia':       { flag: '🇹🇳', code: 'TUN', iso2: 'tn', he: 'תוניסיה' },
  'Algeria':       { flag: '🇩🇿', code: 'ALG', iso2: 'dz', he: 'אלג׳יריה' },
  'Costa Rica':    { flag: '🇨🇷', code: 'CRC', iso2: 'cr', he: 'קוסטה ריקה' },
  'Honduras':      { flag: '🇭🇳', code: 'HON', iso2: 'hn', he: 'הונדורס' },
  'Jamaica':       { flag: '🇯🇲', code: 'JAM', iso2: 'jm', he: 'ג׳מייקה' },
  'Panama':        { flag: '🇵🇦', code: 'PAN', iso2: 'pa', he: 'פנמה' },
  'Haiti':         { flag: '🇭🇹', code: 'HAI', iso2: 'ht', he: 'האיטי' },
  'Curacao':       { flag: '🇨🇼', code: 'CUW', iso2: 'cw', he: 'קוראסאו' },
  'Uzbekistan':    { flag: '🇺🇿', code: 'UZB', iso2: 'uz', he: 'אוזבקיסטן' },
  'Iraq':          { flag: '🇮🇶', code: 'IRQ', iso2: 'iq', he: 'עיראק' },
  'Jordan':        { flag: '🇯🇴', code: 'JOR', iso2: 'jo', he: 'ירדן' },
  'New Zealand':   { flag: '🇳🇿', code: 'NZL', iso2: 'nz', he: 'ניו זילנד' },
};

/** ISO 3166-1 alpha-2 code (or sub-region like gb-eng) for use with flag-icons CSS. */
export function getIso2(teamName: string | null | undefined): string | null {
  if (!teamName) return null;
  return TEAM_DATA[teamName]?.iso2 ?? null;
}

/** Get the flag emoji for a team name. Falls back to ⚽ if name is missing/unknown. */
export function getFlag(teamName: string | null | undefined): string {
  if (!teamName) return '⚽';
  return TEAM_DATA[teamName]?.flag ?? '⚽';
}

/** Get the 3-letter code for a team. Falls back to first 3 chars uppercase or '???'. */
export function getCode(teamName: string | null | undefined): string {
  if (!teamName) return '???';
  return TEAM_DATA[teamName]?.code ?? teamName.slice(0, 3).toUpperCase();
}

/** Get the Hebrew name for a team. Falls back to English name. */
export function getTeamHe(teamName: string | null | undefined): string {
  if (!teamName) return '';
  return TEAM_DATA[teamName]?.he ?? teamName;
}

/** Get the localized team name based on language. */
export function getTeamName(teamName: string | null | undefined, lang: string): string {
  if (!teamName) return '';
  if (lang === 'he') {
    return TEAM_DATA[teamName]?.he ?? teamName;
  }
  return teamName;
}

/** Get all team data. */
export function getTeamData(teamName: string | null | undefined) {
  if (!teamName) return { flag: '⚽', code: '???', iso2: null as string | null, he: '' };
  return TEAM_DATA[teamName] ?? { flag: '⚽', code: teamName.slice(0, 3).toUpperCase(), iso2: null as string | null, he: teamName };
}

/** All teams as a sorted array. */
export function getAllTeams(lang: string): string[] {
  return Object.keys(TEAM_DATA).sort((a, b) =>
    getTeamName(a, lang).localeCompare(getTeamName(b, lang), lang === 'he' ? 'he' : 'en'),
  );
}

/* ============================================================
 * Placeholder labels for TBD knockout slots
 *
 * Grammar (stored in matches.{home,away}_team_placeholder):
 *   GROUP_X_WINNER       → 1st place finisher of group X
 *   GROUP_X_RUNNERUP     → 2nd place finisher of group X
 *   THIRD_<letters>      → best 3rd-place team across listed groups
 *   WIN_<fixture_id>     → winner of the referenced earlier knockout match
 *   LOSE_<fixture_id>    → loser (for the 3rd-place play-off)
 *
 * The optional matchNumberLookup maps api_fixture_id → match_number so
 * WIN_900101 can render as "Winner Match 73".
 * ============================================================ */

export function getPlaceholderLabel(
  placeholder: string | null | undefined,
  lang: string,
  matchNumberLookup?: Map<number, number>,
): string {
  if (!placeholder) return '';

  const he = lang === 'he';

  // GROUP_X_WINNER
  const winnerMatch = placeholder.match(/^GROUP_([A-L])_WINNER$/);
  if (winnerMatch) {
    return he ? `1° בית ${winnerMatch[1]}` : `1st Group ${winnerMatch[1]}`;
  }

  // GROUP_X_RUNNERUP
  const runnerMatch = placeholder.match(/^GROUP_([A-L])_RUNNERUP$/);
  if (runnerMatch) {
    return he ? `2° בית ${runnerMatch[1]}` : `2nd Group ${runnerMatch[1]}`;
  }

  // THIRD_<letters>  e.g. THIRD_CDEF
  const thirdMatch = placeholder.match(/^THIRD_([A-L]+)$/);
  if (thirdMatch) {
    const letters = thirdMatch[1].split('').join('/');
    return he ? `מקום 3 (${letters})` : `3rd (${letters})`;
  }

  // WIN_<id>
  const winRef = placeholder.match(/^WIN_(\d+)$/);
  if (winRef) {
    const fid = Number(winRef[1]);
    const num = matchNumberLookup?.get(fid);
    if (num) return he ? `מנצח משחק ${num}` : `Winner Match ${num}`;
    return he ? `מנצח` : `Winner`;
  }

  // LOSE_<id>
  const loseRef = placeholder.match(/^LOSE_(\d+)$/);
  if (loseRef) {
    const fid = Number(loseRef[1]);
    const num = matchNumberLookup?.get(fid);
    if (num) return he ? `מפסיד משחק ${num}` : `Loser Match ${num}`;
    return he ? `מפסיד` : `Loser`;
  }

  // Unknown — return as-is
  return placeholder;
}

/** True if the placeholder string indicates a TBD slot. */
export function isPlaceholder(placeholder: string | null | undefined): boolean {
  return !!placeholder && placeholder.length > 0;
}
