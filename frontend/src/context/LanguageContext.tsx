import React, { createContext, useContext, useState, useEffect } from 'react';
import { it } from '../locales/it';
import { en } from '../locales/en';

type Language = 'it' | 'en';
type Translations = typeof it;

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
  interpolate: (template: string, vars: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('easyea_lang');
    if (saved === 'it' || saved === 'en') return saved;
    return 'en'; // Default English as requested
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('easyea_lang', lang);
  };

  const t = language === 'en' ? en : it;

  const interpolate = (template: string, vars: Record<string, string | number>) => {
    let result = template;
    for (const [key, val] of Object.entries(vars)) {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(val));
    }
    return result;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, interpolate }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
