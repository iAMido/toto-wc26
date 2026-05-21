/** Country flag emojis, short codes, and ISO 3166-1 alpha-2 codes (for SVG flags) */

// Canonical team names match the FIFA WC2026 spelling exactly (so the
// matches table can use these as the team_name without any translation
// layer). Renamed since v1: USA→United States, South Korea→Korea Republic,
// Czech Republic→Czechia, Turkey→Türkiye, Curacao→Curaçao. Added 5 new teams
// (South Africa, Bosnia and Herzegovina, Côte d'Ivoire, Cabo Verde, Congo DR).
const TEAM_DATA: Record<string, { flag: string; code: string; iso2: string; he: string }> = {
  // ----- Group A -----
  'Mexico':                   { flag: '🇲🇽', code: 'MEX', iso2: 'mx', he: 'מקסיקו' },
  'South Africa':             { flag: '🇿🇦', code: 'RSA', iso2: 'za', he: 'דרום אפריקה' },
  'Korea Republic':           { flag: '🇰🇷', code: 'KOR', iso2: 'kr', he: 'דרום קוריאה' },
  'Czechia':                  { flag: '🇨🇿', code: 'CZE', iso2: 'cz', he: 'צ׳כיה' },
  // ----- Group B -----
  'Canada':                   { flag: '🇨🇦', code: 'CAN', iso2: 'ca', he: 'קנדה' },
  'Switzerland':              { flag: '🇨🇭', code: 'SUI', iso2: 'ch', he: 'שוויץ' },
  'Qatar':                    { flag: '🇶🇦', code: 'QAT', iso2: 'qa', he: 'קטאר' },
  'Bosnia and Herzegovina':   { flag: '🇧🇦', code: 'BIH', iso2: 'ba', he: 'בוסניה והרצגובינה' },
  // ----- Group C -----
  'Brazil':                   { flag: '🇧🇷', code: 'BRA', iso2: 'br', he: 'ברזיל' },
  'Morocco':                  { flag: '🇲🇦', code: 'MAR', iso2: 'ma', he: 'מרוקו' },
  'Haiti':                    { flag: '🇭🇹', code: 'HAI', iso2: 'ht', he: 'האיטי' },
  'Scotland':                 { flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', code: 'SCO', iso2: 'gb-sct', he: 'סקוטלנד' },
  // ----- Group D -----
  'United States':            { flag: '🇺🇸', code: 'USA', iso2: 'us', he: 'ארה״ב' },
  'Paraguay':                 { flag: '🇵🇾', code: 'PAR', iso2: 'py', he: 'פרגוואי' },
  'Australia':                { flag: '🇦🇺', code: 'AUS', iso2: 'au', he: 'אוסטרליה' },
  'Türkiye':                  { flag: '🇹🇷', code: 'TUR', iso2: 'tr', he: 'טורקיה' },
  // ----- Group E -----
  'Germany':                  { flag: '🇩🇪', code: 'GER', iso2: 'de', he: 'גרמניה' },
  'Curaçao':                  { flag: '🇨🇼', code: 'CUW', iso2: 'cw', he: 'קוראסאו' },
  "Côte d'Ivoire":            { flag: '🇨🇮', code: 'CIV', iso2: 'ci', he: 'חוף השנהב' },
  'Ecuador':                  { flag: '🇪🇨', code: 'ECU', iso2: 'ec', he: 'אקוודור' },
  // ----- Group F -----
  'Netherlands':              { flag: '🇳🇱', code: 'NED', iso2: 'nl', he: 'הולנד' },
  'Japan':                    { flag: '🇯🇵', code: 'JPN', iso2: 'jp', he: 'יפן' },
  'Tunisia':                  { flag: '🇹🇳', code: 'TUN', iso2: 'tn', he: 'תוניסיה' },
  'Sweden':                   { flag: '🇸🇪', code: 'SWE', iso2: 'se', he: 'שוודיה' },
  // ----- Group G -----
  'Belgium':                  { flag: '🇧🇪', code: 'BEL', iso2: 'be', he: 'בלגיה' },
  'Egypt':                    { flag: '🇪🇬', code: 'EGY', iso2: 'eg', he: 'מצרים' },
  'Iran':                     { flag: '🇮🇷', code: 'IRN', iso2: 'ir', he: 'איראן' },
  'New Zealand':              { flag: '🇳🇿', code: 'NZL', iso2: 'nz', he: 'ניו זילנד' },
  // ----- Group H -----
  'Spain':                    { flag: '🇪🇸', code: 'ESP', iso2: 'es', he: 'ספרד' },
  'Cabo Verde':               { flag: '🇨🇻', code: 'CPV', iso2: 'cv', he: 'כף ורדה' },
  'Saudi Arabia':             { flag: '🇸🇦', code: 'KSA', iso2: 'sa', he: 'ערב הסעודית' },
  'Uruguay':                  { flag: '🇺🇾', code: 'URU', iso2: 'uy', he: 'אורוגוואי' },
  // ----- Group I -----
  'France':                   { flag: '🇫🇷', code: 'FRA', iso2: 'fr', he: 'צרפת' },
  'Senegal':                  { flag: '🇸🇳', code: 'SEN', iso2: 'sn', he: 'סנגל' },
  'Norway':                   { flag: '🇳🇴', code: 'NOR', iso2: 'no', he: 'נורבגיה' },
  'Iraq':                     { flag: '🇮🇶', code: 'IRQ', iso2: 'iq', he: 'עיראק' },
  // ----- Group J -----
  'Argentina':                { flag: '🇦🇷', code: 'ARG', iso2: 'ar', he: 'ארגנטינה' },
  'Algeria':                  { flag: '🇩🇿', code: 'ALG', iso2: 'dz', he: 'אלג׳יריה' },
  'Austria':                  { flag: '🇦🇹', code: 'AUT', iso2: 'at', he: 'אוסטריה' },
  'Jordan':                   { flag: '🇯🇴', code: 'JOR', iso2: 'jo', he: 'ירדן' },
  // ----- Group K -----
  'Portugal':                 { flag: '🇵🇹', code: 'POR', iso2: 'pt', he: 'פורטוגל' },
  'Uzbekistan':               { flag: '🇺🇿', code: 'UZB', iso2: 'uz', he: 'אוזבקיסטן' },
  'Colombia':                 { flag: '🇨🇴', code: 'COL', iso2: 'co', he: 'קולומביה' },
  'Congo DR':                 { flag: '🇨🇩', code: 'COD', iso2: 'cd', he: 'קונגו (DR)' },
  // ----- Group L -----
  'England':                  { flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', code: 'ENG', iso2: 'gb-eng', he: 'אנגליה' },
  'Croatia':                  { flag: '🇭🇷', code: 'CRO', iso2: 'hr', he: 'קרואטיה' },
  'Ghana':                    { flag: '🇬🇭', code: 'GHA', iso2: 'gh', he: 'גאנה' },
  'Panama':                   { flag: '🇵🇦', code: 'PAN', iso2: 'pa', he: 'פנמה' },
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
