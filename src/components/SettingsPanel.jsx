import { useState } from "react";
import { useSettings } from "../context/SettingsContext";
import { getStatus } from "../api/rpc";
import { Field, Banner, Spinner, errMessage } from "./ui";
import { useT } from "../i18n";

export default function SettingsPanel() {
  const t = useT();
  const {
    theme,
    setTheme,
    colorTheme,
    setColorTheme,
    COLOR_THEMES,
    language,
    setLanguage,
    LANGUAGES,
    rpcUrl,
    setRpcUrl,
    DEFAULT_RPC_URL,
  } = useSettings();
  const [url, setUrl] = useState(rpcUrl);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null);
  const [saved, setSaved] = useState(false);

  async function testConnection() {
    setTesting(true);
    setResult(null);
    try {
      const s = await getStatus(url);
      const synced = t("settings.blocksLine", {
        blocks: s?.blockCount ?? "?",
        known: s?.knownBlockCount ?? "?",
      });
      setResult({
        kind: "success",
        text: t("settings.connectedLine", { synced, peers: s?.peerCount ?? 0 }),
      });
    } catch (e) {
      setResult({ kind: "error", text: errMessage(e) });
    } finally {
      setTesting(false);
    }
  }

  function save() {
    setRpcUrl(url.trim() || DEFAULT_RPC_URL);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <>
      <section className="card">
        <h3>{t("settings.appearance")}</h3>
        <div className="theme-toggle">
          <button
            type="button"
            className={`seg ${theme === "light" ? "seg-active" : ""}`}
            onClick={() => setTheme("light")}
          >
            {t("settings.light")}
          </button>
          <button
            type="button"
            className={`seg ${theme === "dark" ? "seg-active" : ""}`}
            onClick={() => setTheme("dark")}
          >
            {t("settings.dark")}
          </button>
        </div>

        <div className="field-label" style={{ marginTop: 16 }}>
          {t("settings.colorTheme")}
        </div>
        <div className="theme-swatches">
          {COLOR_THEMES.map((ct) => (
            <button
              key={ct.id}
              type="button"
              className={`swatch-btn ${colorTheme === ct.id ? "selected" : ""}`}
              onClick={() => setColorTheme(ct.id)}
              title={ct.label}
            >
              <span
                className="swatch-dot"
                style={{ background: ct.vars["--accent-gradient"] }}
              />
              {ct.label}
            </button>
          ))}
        </div>

        <div className="field-label" style={{ marginTop: 16 }}>
          {t("settings.language")}
        </div>
        <div className="theme-toggle">
          {LANGUAGES.map((lng) => (
            <button
              key={lng.id}
              type="button"
              className={`seg ${language === lng.id ? "seg-active" : ""}`}
              onClick={() => setLanguage(lng.id)}
            >
              {lng.label}
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h3>{t("settings.network")}</h3>
        <Field
          label={t("settings.rpcUrl")}
          hint={t("settings.rpcHint", { url: DEFAULT_RPC_URL })}
        >
          <input
            type="text"
            value={url}
            spellCheck={false}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={DEFAULT_RPC_URL}
          />
        </Field>

        <div className="row gap">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={testConnection}
            disabled={testing}
          >
            {testing ? <Spinner /> : t("settings.testConnection")}
          </button>
          <button type="button" className="btn btn-primary" onClick={save}>
            {saved ? t("common.saved") : t("common.save")}
          </button>
        </div>
        {result && <Banner kind={result.kind}>{result.text}</Banner>}
      </section>
    </>
  );
}
