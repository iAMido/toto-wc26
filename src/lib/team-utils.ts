/** Country flag emojis and short codes for all WC2026 teams */

const TEAM_DATA: Record<string, { flag: string; code: string; he: string }> = {
  // Group A
  'Morocco': { flag: '🇲🇦', code: 'MAR', he: 'מרוקו' },
  'USA': { flag: '🇺🇸', code: 'USA', he: 'ארה״ב' },
  'Mexico': { flag: '🇲🇽', code: 'MEX', he: 'מקסיקו' },
  'Canada': { flag: '🇨🇦', code: 'CAN', he: 'קנדה' },
  // Group B
  'Argentina': { flag: '🇦🇷', code: 'ARG', he: 'ארגנטינה' },
  'Brazil': { flag: '🇧🇷', code: 'BRA', he: 'ברזיל' },
  'Colombia': { flag: '🇨🇴', code: 'COL', he: 'קולומביה' },
  'Uruguay': { flag: '🇺🇾', code: 'URU', he: 'אורוגוואי' },
  // Group C
  'France': { flag: '🇫🇷', code: 'FRA', he: 'צרפת' },
  'Germany': { flag: '🇩🇪', code: 'GER', he: 'גרמניה' },
  'Spain': { flag: '🇪🇸', code: 'ESP', he: 'ספרד' },
  'Portugal': { flag: '🇵🇹', code: 'POR', he: 'פורטוגל' },
  // Group D
  'England': { flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', code: 'ENG', he: 'אנגליה' },
  'Netherlands': { flag: '🇳🇱', code: 'NED', he: 'הולנד' },
  'Belgium': { flag: '🇧🇪', code: 'BEL', he: 'בלגיה' },
  'Italy': { flag: '🇮🇹', code: 'ITA', he: 'איטליה' },
  // Other teams
  'Croatia': { flag: '🇭🇷', code: 'CRO', he: 'קרואטיה' },
  'Denmark': { flag: '🇩🇰', code: 'DEN', he: 'דנמרק' },
  'Switzerland': { flag: '🇨🇭', code: 'SUI', he: 'שוויץ' },
  'Serbia': { flag: '🇷🇸', code: 'SRB', he: 'סרביה' },
  'Japan': { flag: '🇯🇵', code: 'JPN', he: 'יפן' },
  'South Korea': { flag: '🇰🇷', code: 'KOR', he: 'דרום קוריאה' },
  'Australia': { flag: '🇦🇺', code: 'AUS', he: 'אוסטרליה' },
  'Saudi Arabia': { flag: '🇸🇦', code: 'KSA', he: 'ערב הסעודית' },
  'Iran': { flag: '🇮🇷', code: 'IRN', he: 'איראן' },
  'Qatar': { flag: '🇶🇦', code: 'QAT', he: 'קטאר' },
  'Ecuador': { flag: '🇪🇨', code: 'ECU', he: 'אקוודור' },
  'Paraguay': { flag: '🇵🇾', code: 'PAR', he: 'פרגוואי' },
  'Chile': { flag: '🇨🇱', code: 'CHI', he: 'צ׳ילה' },
  'Peru': { flag: '🇵🇪', code: 'PER', he: 'פרו' },
  'Venezuela': { flag: '🇻🇪', code: 'VEN', he: 'ונצואלה' },
  'Bolivia': { flag: '🇧🇴', code: 'BOL', he: 'בוליביה' },
  'Poland': { flag: '🇵🇱', code: 'POL', he: 'פולין' },
  'Ukraine': { flag: '🇺🇦', code: 'UKR', he: 'אוקראינה' },
  'Turkey': { flag: '🇹🇷', code: 'TUR', he: 'טורקיה' },
  'Austria': { flag: '🇦🇹', code: 'AUT', he: 'אוסטריה' },
  'Czech Republic': { flag: '🇨🇿', code: 'CZE', he: 'צ׳כיה' },
  'Scotland': { flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', code: 'SCO', he: 'סקוטלנד' },
  'Wales': { flag: '🏴󠁧󠁢󠁷󠁬󠁳󠁿', code: 'WAL', he: 'וויילס' },
  'Norway': { flag: '🇳🇴', code: 'NOR', he: 'נורבגיה' },
  'Sweden': { flag: '🇸🇪', code: 'SWE', he: 'שוודיה' },
  'Ghana': { flag: '🇬🇭', code: 'GHA', he: 'גאנה' },
  'Senegal': { flag: '🇸🇳', code: 'SEN', he: 'סנגל' },
  'Cameroon': { flag: '🇨🇲', code: 'CMR', he: 'קמרון' },
  'Nigeria': { flag: '🇳🇬', code: 'NGA', he: 'ניגריה' },
  'Egypt': { flag: '🇪🇬', code: 'EGY', he: 'מצרים' },
  'Tunisia': { flag: '🇹🇳', code: 'TUN', he: 'תוניסיה' },
  'Algeria': { flag: '🇩🇿', code: 'ALG', he: 'אלג׳יריה' },
  'Costa Rica': { flag: '🇨🇷', code: 'CRC', he: 'קוסטה ריקה' },
  'Honduras': { flag: '🇭🇳', code: 'HON', he: 'הונדורס' },
  'Jamaica': { flag: '🇯🇲', code: 'JAM', he: 'ג׳מייקה' },
  'Panama': { flag: '🇵🇦', code: 'PAN', he: 'פנמה' },
  'Haiti': { flag: '🇭🇹', code: 'HAI', he: 'האיטי' },
  'Curacao': { flag: '🇨🇼', code: 'CUW', he: 'קוראסאו' },
  'Uzbekistan': { flag: '🇺🇿', code: 'UZB', he: 'אוזבקיסטן' },
  'Iraq': { flag: '🇮🇶', code: 'IRQ', he: 'עיראק' },
  'Jordan': { flag: '🇯🇴', code: 'JOR', he: 'ירדן' },
  'New Zealand': { flag: '🇳🇿', code: 'NZL', he: 'ניו זילנד' },
};

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
  if (!teamName) return { flag: '⚽', code: '???', he: '' };
  return TEAM_DATA[teamName] ?? { flag: '⚽', code: teamName.slice(0, 3).toUpperCase(), he: teamName };
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
