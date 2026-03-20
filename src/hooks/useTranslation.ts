import { useState, useCallback, useEffect } from 'react';
import { translations, Language } from '../i18n/translations';

export function useTranslation() {
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem('game_lang');
    return (saved as Language) || 'zh';
  });

  const t = useCallback((key: string) => {
    const keys = key.split('.');
    let result: any = translations[lang];
    for (const k of keys) {
      if (result && result[k]) {
        result = result[k];
      } else {
        return key;
      }
    }
    return result;
  }, [lang]);

  const toggleLang = useCallback(() => {
    const next = lang === 'en' ? 'zh' : 'en';
    setLang(next);
    localStorage.setItem('game_lang', next);
  }, [lang]);

  return { t, lang, toggleLang };
}
