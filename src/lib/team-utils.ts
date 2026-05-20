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

/** Get the flag emoji for a team name. Falls back to ⚽ if not found. */
export function getFlag(teamName: string): string {
  return TEAM_DATA[teamName]?.flag ?? '⚽';
}

/** Get the 3-letter code for a team. Falls back to first 3 chars uppercase. */
export function getCode(teamName: string): string {
  return TEAM_DATA[teamName]?.code ?? teamName.slice(0, 3).toUpperCase();
}

/** Get the Hebrew name for a team. Falls back to English name. */
export function getTeamHe(teamName: string): string {
  return TEAM_DATA[teamName]?.he ?? teamName;
}

/** Get the localized team name based on language. */
export function getTeamName(teamName: string, lang: string): string {
  if (lang === 'he') {
    return TEAM_DATA[teamName]?.he ?? teamName;
  }
  return teamName;
}

/** Get all team data. */
export function getTeamData(teamName: string) {
  return TEAM_DATA[teamName] ?? { flag: '⚽', code: teamName.slice(0, 3).toUpperCase(), he: teamName };
}
