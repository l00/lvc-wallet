import { useState } from "react";
import WalletManager from "./components/WalletManager";
import Dashboard from "./components/Dashboard";
import { useSettings } from "./context/SettingsContext";
import { I18nProvider } from "./i18n";
import "./App.css";

export default function App() {
  const { language } = useSettings();
  const [view, setView] = useState("manager");

  return (
    <I18nProvider lang={language}>
      {view === "wallet" ? (
        <Dashboard onLock={() => setView("manager")} />
      ) : (
        <main className="app">
          <WalletManager onReady={() => setView("wallet")} />
        </main>
      )}
    </I18nProvider>
  );
}
