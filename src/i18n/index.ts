import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enTranslation from './locales/en.json';

export const SUPPORTED_LOCALES = [
  { code: 'en', label: 'English', dir: 'ltr' },
  { code: 'hi', label: 'हिंदी (Hindi)', dir: 'ltr' },
  { code: 'es', label: 'Español (Spanish)', dir: 'ltr' },
  { code: 'fr', label: 'Français (French)', dir: 'ltr' },
  { code: 'de', label: 'Deutsch (German)', dir: 'ltr' },
  { code: 'pt', label: 'Português (Portuguese)', dir: 'ltr' },
  { code: 'ar', label: 'العربية (Arabic)', dir: 'rtl' }
];

const savedLanguage = typeof window !== 'undefined'
  ? localStorage.getItem('tracexmail_locale') || 'en'
  : 'en';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: enTranslation }
    },
    lng: savedLanguage,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

/**
 * Lazy loads a locale bundle on demand.
 */
export async function changeAppLanguage(lang: string): Promise<void> {
  const selected = SUPPORTED_LOCALES.find((l) => l.code === lang) || SUPPORTED_LOCALES[0];

  if (!i18n.hasResourceBundle(selected.code, 'translation') && selected.code !== 'en') {
    try {
      let bundle: any;
      switch (selected.code) {
        case 'hi':
          bundle = (await import('./locales/hi.json')).default;
          break;
        case 'es':
          bundle = (await import('./locales/es.json')).default;
          break;
        case 'fr':
          bundle = (await import('./locales/fr.json')).default;
          break;
        case 'de':
          bundle = (await import('./locales/de.json')).default;
          break;
        case 'pt':
          bundle = (await import('./locales/pt.json')).default;
          break;
        case 'ar':
          bundle = (await import('./locales/ar.json')).default;
          break;
      }
      if (bundle) {
        i18n.addResourceBundle(selected.code, 'translation', bundle, true, true);
      }
    } catch (err) {
      console.warn(`[i18n] Failed to lazy load locale ${selected.code}:`, err);
    }
  }

  await i18n.changeLanguage(selected.code);

  if (typeof window !== 'undefined') {
    localStorage.setItem('tracexmail_locale', selected.code);
    document.documentElement.dir = selected.dir;
    document.documentElement.lang = selected.code;
  }
}

// Apply initial direction
if (typeof window !== 'undefined') {
  const initial = SUPPORTED_LOCALES.find((l) => l.code === savedLanguage);
  if (initial) {
    document.documentElement.dir = initial.dir;
    document.documentElement.lang = initial.code;
    if (savedLanguage !== 'en') {
      changeAppLanguage(savedLanguage);
    }
  }
}

export default i18n;
