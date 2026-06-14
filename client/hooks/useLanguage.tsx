import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../lib/i18n';

type LanguageContextType = {
  language: string;
  setLanguage: (lang: string) => Promise<void>;
};

const LanguageContext = createContext<LanguageContextType>({
  language: "English (US)",
  setLanguage: async () => {},
});

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  const [language, setLanguageState] = useState("English (US)");

  useEffect(() => {
    AsyncStorage.getItem('setting_language').then(lang => {
      if (lang) {
        setLanguageState(lang);
        i18n.changeLanguage(lang);
      }
    });
  }, []);

  const setLanguage = async (lang: string) => {
    setLanguageState(lang);
    await i18n.changeLanguage(lang);
    await AsyncStorage.setItem('setting_language', lang);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
