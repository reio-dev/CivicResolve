import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';

import en from '../locales/en.json';
import hi from '../locales/hi.json';
import kn from '../locales/kn.json';

const resources = {
  "English (US)": { translation: en },
  "Hindi (हिन्दी)": { translation: hi },
  "Kannada (ಕನ್ನಡ)": { translation: kn },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    compatibilityJSON: 'v4',
    lng: getLocales()[0].languageCode === 'hi' ? 'Hindi (हिन्दी)' 
         : getLocales()[0].languageCode === 'kn' ? 'Kannada (ಕನ್ನಡ)' 
         : 'English (US)',
    fallbackLng: 'English (US)',
    interpolation: {
      escapeValue: false, // react already safes from xss
    },
  });

export default i18n;
