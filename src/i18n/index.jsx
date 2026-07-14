import { createContext, useContext } from "react";
import en from "./en.json";
import bg from "./bg.json";

const LOCALES = { en, bg };

export const LANGUAGES = [
  { id: "en", label: "English" },
  { id: "bg", label: "Български" },
];
export const DEFAULT_LANG = "en";

let currentLang = DEFAULT_LANG;
export function setLanguage(lang) {
  currentLang = LOCALES[lang] ? lang : DEFAULT_LANG;
}

function lookup(dict, key) {
  return key.split(".").reduce((o, k) => (o == null ? undefined : o[k]), dict);
}

function interpolate(str, vars) {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

export function translate(key, vars) {
  const primary = lookup(LOCALES[currentLang], key);
  const val =
    primary != null && primary !== "" ? primary : lookup(LOCALES[DEFAULT_LANG], key);
  if (val == null) return key;
  return interpolate(val, vars);
}

const I18nContext = createContext(DEFAULT_LANG);

export function I18nProvider({ lang, children }) {
  setLanguage(lang);
  return <I18nContext.Provider value={lang}>{children}</I18nContext.Provider>;
}

export function useT() {
  useContext(I18nContext);
  return translate;
}
