export const APP_LANGUAGES = ['he', 'en', 'es', 'zh', 'ar', 'ru'] as const;
export type AppLanguage = typeof APP_LANGUAGES[number];

export function parseAppLanguage(value: string | null): AppLanguage | null {
  const code = value?.trim().toLowerCase().split(/[-_]/)[0];
  return APP_LANGUAGES.find(language => language === code) || null;
}
