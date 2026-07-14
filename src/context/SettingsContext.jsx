import { createContext, useContext, useEffect, useState } from "react";
import { COLOR_THEMES, DEFAULT_COLOR_THEME, getColorTheme } from "../themes";
import { LANGUAGES, DEFAULT_LANG } from "../i18n";

const DEFAULT_RPC_URL = "127.0.0.1:8070";
const STORAGE_KEY = "lvc-wallet-settings";

const DEFAULTS = {
  theme: "dark",
  colorTheme: DEFAULT_COLOR_THEME,
  language: DEFAULT_LANG,
  rpcUrl: DEFAULT_RPC_URL,
  walletdPath: "",
  daemonAddress: "node.levcoin.org:18081",
  bindPort: 8070,
  walletsDir: "",
  libPath: "",
};

const SettingsContext = createContext(null);

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = { ...DEFAULTS, ...JSON.parse(raw) };
      if (saved.walletdPath === "walletd") saved.walletdPath = "";
      return saved;
    }
  } catch {}
  return { ...DEFAULTS };
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(loadSettings);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    const root = document.documentElement;
    root.setAttribute("data-theme", settings.theme);
    const color = getColorTheme(settings.colorTheme);
    root.setAttribute("data-color", color.id);
    for (const [prop, val] of Object.entries(color.vars)) {
      root.style.setProperty(prop, val);
    }
  }, [settings]);

  const update = (patch) => setSettings((s) => ({ ...s, ...patch }));
  const setTheme = (theme) => update({ theme });
  const setColorTheme = (colorTheme) => update({ colorTheme });
  const setLanguage = (language) => update({ language });
  const setRpcUrl = (rpcUrl) => update({ rpcUrl });

  const value = {
    ...settings,
    update,
    setTheme,
    setColorTheme,
    setLanguage,
    setRpcUrl,
    DEFAULT_RPC_URL,
    COLOR_THEMES,
    LANGUAGES,
  };
  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
