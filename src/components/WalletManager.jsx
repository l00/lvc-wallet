import { useEffect, useState } from "react";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { useSettings } from "../context/SettingsContext";
import {
  defaultWalletDir,
  listWallets,
  generateWallet,
  startWalletd,
  stopWalletd,
  waitForReady,
  containerPath,
} from "../api/walletd";
import { Field, Banner, Spinner, errMessage } from "./ui";
import { useT } from "../i18n";
import { WalletIcon, PlusIcon } from "./icons";

export default function WalletManager({ onReady }) {
  const t = useT();
  const s = useSettings();
  const { walletdPath, daemonAddress, bindPort, walletsDir, libPath, update, setRpcUrl } = s;

  const [tab, setTab] = useState("open");
  const [wallets, setWallets] = useState([]);
  const [name, setName] = useState("");
  const [filePath, setFilePath] = useState(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      let dir = walletsDir;
      if (!dir) {
        dir = await defaultWalletDir();
        if (!active) return;
        update({ walletsDir: dir });
      }
      try {
        const found = await listWallets(dir);
        if (active) setWallets(found);
      } catch {
        // directory may not exist yet
      }
    })();
    return () => {
      active = false;
    };
  }, [walletsDir]);

  async function chooseFile() {
    setError(null);
    try {
      const picked = await openFileDialog({
        multiple: false,
        directory: false,
        title: t("wallet.chooseFileTitle"),
      });
      if (!picked) return;
      const path = Array.isArray(picked) ? picked[0] : picked;
      setFilePath(path);
      setName(path.split(/[/\\]/).pop() || path);
    } catch (e) {
      setError(errMessage(e));
    }
  }

  async function launch(generate) {
    setError(null);
    if (!name.trim()) return setError(t("wallet.errEnterName"));
    if (!password) return setError(t("wallet.errEnterPassword"));
    if (generate && password !== confirm)
      return setError(t("wallet.errPasswordMismatch"));

    const url = `127.0.0.1:${bindPort}`;
    const container = filePath ?? containerPath(walletsDir, name.trim());
    const args = {
      bin: walletdPath,
      container,
      password,
      daemonAddress,
      bindPort: Number(bindPort),
      libPath,
    };
    try {
      if (generate) {
        setBusy(t("wallet.busyCreating"));
        await generateWallet(args);
      }
      setBusy(t("wallet.busyStarting"));
      await startWalletd(args);
      setBusy(t("wallet.busyWaiting"));
      await waitForReady(url);
      setRpcUrl(url);
      onReady();
    } catch (e) {
        await stopWalletd().catch(() => {});
        setError(errMessage(e));
        setBusy(null);
    }
  }

  if (busy) {
    return (
      <div className="screen wizard">
        <img className="brand-logo" src="/logo.png" alt="Levcoin logo" />
        <div className="row gap">
          <Spinner />
          <span>{busy}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="screen wizard">
      <div className="brand">
        <img className="brand-logo" src="/logo.png" alt="Levcoin logo" />
        <h1>Levcoin Wallet</h1>
        <p className="muted">{t("wallet.subtitle")}</p>
      </div>

      <div className="wizard-options" style={{ gap: 18 }}>
        <div className="tabs">
          <button
            className={`tab ${tab === "open" ? "tab-active" : ""}`}
            onClick={() => {
              setTab("open");
              setError(null);
            }}
          >
            {t("wallet.openTab")}
          </button>
          <button
            className={`tab ${tab === "create" ? "tab-active" : ""}`}
            onClick={() => {
              setTab("create");
              setError(null);
              setFilePath(null);
            }}
          >
            {t("wallet.createTab")}
          </button>
        </div>

        {tab === "open" && wallets.length > 0 && (
          <div className="card">
            <h3>{t("wallet.wallets")}</h3>
            {wallets.map((w) => (
              <button
                key={w}
                type="button"
                className={`option-row ${!filePath && name === w ? "selected" : ""}`}
                onClick={() => {
                  setName(w);
                  setFilePath(null);
                }}
              >
                <span className="opt-icon">
                  <WalletIcon size={22} />
                </span>
                <span className="opt-body">
                  <span className="opt-title">{w}</span>
                </span>
              </button>
            ))}
          </div>
        )}

        {tab === "open" && (
          <button type="button" className="btn btn-ghost" onClick={chooseFile}>
            {t("wallet.chooseFile")}
          </button>
        )}

        <div className="card">
          <Field
            label={t("wallet.fileName")}
            hint={filePath ? t("wallet.openingFrom", { path: filePath }) : undefined}
          >
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setFilePath(null);
              }}
              placeholder="mywallet"
              spellCheck={false}
            />
          </Field>
          <Field label={t("wallet.password")}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {tab === "create" && (
            <Field label={t("wallet.confirmPassword")}>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </Field>
          )}

          {error && <Banner kind="error">{error}</Banner>}

          <div className="row end">
            {tab === "open" ? (
              <button className="btn btn-primary btn-lg" onClick={() => launch(false)}>
                <WalletIcon size={18} /> {t("wallet.openBtn")}
              </button>
            ) : (
              <button className="btn btn-primary btn-lg" onClick={() => launch(true)}>
                <PlusIcon size={18} /> {t("wallet.createBtn")}
              </button>
            )}
          </div>

          {tab === "create" && (
            <Banner kind="warning">{t("wallet.createWarning")}</Banner>
          )}
        </div>

        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setShowAdvanced((v) => !v)}
        >
          {showAdvanced ? t("wallet.hideAdvanced") : t("wallet.showAdvanced")}
        </button>

        {showAdvanced && (
          <div className="card">
            <Field
              label={t("wallet.walletdBinary")}
              hint={t("wallet.walletdBinaryHint")}
            >
              <input
                type="text"
                value={walletdPath}
                placeholder={t("wallet.walletdBinaryPlaceholder")}
                onChange={(e) => update({ walletdPath: e.target.value })}
                spellCheck={false}
              />
            </Field>
            <Field
              label={t("wallet.libPath")}
              hint={t("wallet.libPathHint")}
            >
              <input
                type="text"
                value={libPath}
                onChange={(e) => update({ libPath: e.target.value })}
                spellCheck={false}
              />
            </Field>
            <Field label={t("wallet.daemonAddress")} hint={t("wallet.daemonAddressHint")}>
              <input
                type="text"
                value={daemonAddress}
                onChange={(e) => update({ daemonAddress: e.target.value })}
                spellCheck={false}
              />
            </Field>
            <div className="grid-2">
              <Field label={t("wallet.bindPort")}>
                <input
                  type="number"
                  value={bindPort}
                  onChange={(e) => update({ bindPort: e.target.value })}
                />
              </Field>
              <Field label={t("wallet.walletsFolder")}>
                <input
                  type="text"
                  value={walletsDir}
                  onChange={(e) => update({ walletsDir: e.target.value })}
                  spellCheck={false}
                />
              </Field>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
