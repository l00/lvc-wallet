import { useCallback, useEffect, useRef, useState } from "react";
import { useSettings } from "../context/SettingsContext";
import {
  getStatus,
  getBalance,
  getAddresses,
  createAddress,
  getViewKey,
  getSpendKeys,
  getMnemonicSeed,
  getTransactions,
  sendTransaction,
  formatAmount,
  toAtomic,
  COIN_SYMBOL,
  DEFAULT_FEE,
  DEFAULT_MIXIN,
} from "../api/rpc";
import { stopWalletd } from "../api/walletd";
import { Field, Banner, Spinner, CopyButton, CopyText, errMessage } from "./ui";
import { useT } from "../i18n";
import SettingsPanel from "./SettingsPanel";
import { KeyIcon } from "./icons";

const NAV = [
  { id: "balance", emoji: "💰" },
  { id: "receive", emoji: "📥" },
  { id: "send", emoji: "📤" },
  { id: "history", emoji: "🕘" },
  { id: "settings", emoji: "⚙️" },
];

export default function Dashboard({ onLock }) {
  const t = useT();
  const { rpcUrl } = useSettings();
  const [panel, setPanel] = useState("balance");
  const [status, setStatus] = useState(null);
  const [balance, setBalance] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(null);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [st, bal, addr] = await Promise.all([
        getStatus(rpcUrl),
        getBalance(rpcUrl),
        getAddresses(rpcUrl),
      ]);
      setStatus(st ?? null);
      setBalance(bal ?? null);
      setAddresses(addr?.addresses ?? []);
      setConnected(true);
    } catch (e) {
      setError(errMessage(e));
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, [rpcUrl]);

  const poll = useCallback(async () => {
    try {
      const [st, bal] = await Promise.all([getStatus(rpcUrl), getBalance(rpcUrl)]);
      setStatus(st ?? null);
      setBalance(bal ?? null);
      setConnected(true);
    } catch {
      setConnected(false);
    }
  }, [rpcUrl]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const synced =
    connected === true &&
    status != null &&
    (status.knownBlockCount ?? 0) > 1 &&
    (status.blockCount ?? 0) >= (status.knownBlockCount ?? 0);
  useEffect(() => {
    const id = setInterval(poll, synced ? 30000 : 4000);
    return () => clearInterval(id);
  }, [poll, synced]);

  const primary = addresses[0] || "";

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src="/logo.png" alt="" />
          <span>Levcoin</span>
        </div>
        <nav className="nav">
          {NAV.map(({ id, emoji }) => (
            <button
              key={id}
              className={`nav-item ${panel === id ? "active" : ""}`}
              onClick={() => setPanel(id)}
            >
              <span className="nav-emoji" aria-hidden="true">{emoji}</span>
              {t(`nav.${id}`)}
            </button>
          ))}
        </nav>

        <div className="sidebar-foot">
          <button
            className="nav-item"
            onClick={async () => {
              await stopWalletd().catch(() => {});
              onLock?.();
            }}
          >
            <span className="nav-emoji" aria-hidden="true">🔒</span>
            {t("nav.lock")}
          </button>
        </div>
      </aside>

      <div className="main">
        <div className="balance-header">
          <span className="amount">
            {loading && balance == null ? (
              <Spinner />
            ) : (
              <>
                {formatAmount(balance?.availableBalance)}
                <span className="sym">{COIN_SYMBOL}</span>
              </>
            )}
          </span>
          <span className="sub">
            {t("balance.lockedLine", {
              amount: formatAmount(balance?.lockedAmount),
              sym: COIN_SYMBOL,
            })}
          </span>
        </div>

        {error && <Banner kind="error">{error}</Banner>}

        {panel === "balance" && (
          <BalancePanel balance={balance} loading={loading} onRefresh={refresh} />
        )}
        {panel === "receive" && (
          <ReceivePanel url={rpcUrl} addresses={addresses} onChange={refresh} />
        )}
        {panel === "send" && (
          <SendPanel url={rpcUrl} primary={primary} onSent={refresh} />
        )}
        {panel === "history" && <HistoryPanel url={rpcUrl} />}
        {panel === "settings" && (
          <section>
            <h2 className="panel-title">{t("settings.title")}</h2>
            <SettingsPanel />
            <BackupCard url={rpcUrl} primary={primary} />
          </section>
        )}
      </div>
    </div>
  );
}

function BalancePanel({ balance, loading, onRefresh }) {
  const t = useT();
  const avail = balance?.availableBalance;
  const locked = balance?.lockedAmount;
  return (
    <section>
      <h2 className="panel-title">{t("balance.title")}</h2>
      <div className="card">
        <div className="row spread">
          <span className="muted">{t("balance.available")}</span>
          <strong>
            <CopyText plain value={formatAmount(avail)} /> {COIN_SYMBOL}
          </strong>
        </div>
        <div className="row spread">
          <span className="muted">{t("balance.lockedPending")}</span>
          <strong>
            <CopyText plain value={formatAmount(locked)} /> {COIN_SYMBOL}
          </strong>
        </div>
        <div className="row end">
          <button className="btn btn-secondary" onClick={onRefresh} disabled={loading}>
            {loading ? <Spinner /> : t("common.refresh")}
          </button>
        </div>
      </div>
    </section>
  );
}

function ReceivePanel({ url, addresses, onChange }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function addAddress() {
    setBusy(true);
    setError(null);
    try {
      await createAddress(url);
      await onChange();
    } catch (e) {
      setError(errMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h2 className="panel-title">{t("receive.title")}</h2>

      <div className="card">
        <h3>{t("receive.yourAddresses")}</h3>
        {addresses.length === 0 && (
          <p className="muted small">{t("receive.noAddresses")}</p>
        )}
        {addresses.map((a) => (
          <div className="addr-row" key={a}>
            <CopyText value={a} className="flex" />
          </div>
        ))}
        <div className="row end">
          <button className="btn btn-primary" onClick={addAddress} disabled={busy}>
            {busy ? <Spinner /> : t("receive.createAddress")}
          </button>
        </div>
        {error && <Banner kind="error">{error}</Banner>}
      </div>
    </section>
  );
}

function BackupCard({ url, primary }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [keys, setKeys] = useState(null);
  const [error, setError] = useState(null);

  async function reveal() {
    setBusy(true);
    setError(null);
    try {
      const [view, spend, seed] = await Promise.all([
        getViewKey(url).catch(() => null),
        primary ? getSpendKeys(url, primary).catch(() => null) : null,
        primary ? getMnemonicSeed(url, primary).catch(() => null) : null,
      ]);
      setKeys({
        viewSecretKey: view?.viewSecretKey,
        spendSecretKey: spend?.spendSecretKey,
        spendPublicKey: spend?.spendPublicKey,
        mnemonicSeed: seed?.mnemonicSeed,
      });
    } catch (e) {
      setError(errMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h3>
        <KeyIcon size={16} /> {t("backup.title")}
      </h3>
      {!keys && (
        <>
          <p className="muted small">{t("backup.intro")}</p>
          <div className="row">
            <button className="btn btn-secondary" onClick={reveal} disabled={busy}>
              {busy ? <Spinner /> : t("backup.reveal")}
            </button>
          </div>
        </>
      )}
      {error && <Banner kind="error">{error}</Banner>}
      {keys && (
        <>
          <Banner kind="warning">{t("backup.warning")}</Banner>
          {keys.mnemonicSeed && (
            <KeyField label={t("backup.mnemonicSeed")} value={keys.mnemonicSeed} />
          )}
          {keys.spendSecretKey && (
            <KeyField label={t("backup.spendSecretKey")} value={keys.spendSecretKey} />
          )}
          {keys.viewSecretKey && (
            <KeyField label={t("backup.viewSecretKey")} value={keys.viewSecretKey} />
          )}
        </>
      )}
    </div>
  );
}

function KeyField({ label, value }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="seed-box">{value}</div>
      <CopyButton value={value} />
    </div>
  );
}

const HISTORY_INITIAL = 5;
const CHUNK_BLOCKS = 20000;

function HistoryPanel({ url }) {
  const t = useT();
  const [txs, setTxs] = useState([]);
  const [visibleCount, setVisibleCount] = useState(HISTORY_INITIAL);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const scanRef = useRef({ cursor: null, txs: [], done: false });

  const loadUntil = useCallback(
    async (target) => {
      if (scanRef.current.done) return;
      setLoading(true);
      setError(null);
      try {
        let { cursor, txs: acc } = scanRef.current;
        if (cursor == null) {
          const st = await getStatus(url);
          cursor = (st?.blockCount ?? 1) - 1;
        }
        let reachedEnd = false;
        while (acc.length < target && cursor >= 0) {
          const start = Math.max(0, cursor - CHUNK_BLOCKS + 1);
          const res = await getTransactions(url, start, cursor - start + 1);

          const flat = (res?.items ?? [])
            .flatMap((b) => b.transactions ?? [])
            .filter((t) => t && t.transactionHash && t.state !== 1 && t.state !== 2);
          flat.sort((a, b) => (b.blockIndex || Infinity) - (a.blockIndex || Infinity));
          acc = acc.concat(flat);
          cursor = start - 1;
          if (start === 0) reachedEnd = true;
        }
        if (cursor < 0) reachedEnd = true;
        scanRef.current = { cursor, txs: acc, done: reachedEnd };
        setTxs(acc);
        setDone(reachedEnd);
      } catch (e) {
        setError(errMessage(e));
      } finally {
        setLoading(false);
      }
    },
    [url]
  );

  const reload = useCallback(() => {
    scanRef.current = { cursor: null, txs: [], done: false };
    setTxs([]);
    setDone(false);
    setVisibleCount(HISTORY_INITIAL);
    loadUntil(HISTORY_INITIAL);
  }, [loadUntil]);

  useEffect(() => {
    reload();
  }, [reload]);

  function loadAll() {
    setVisibleCount(Infinity);
    loadUntil(Infinity);
  }

  const shown = txs.slice(0, visibleCount);
  const hasMore = txs.length > visibleCount || !done;

  return (
    <section>
      <h2 className="panel-title">{t("history.title")}</h2>
      <div className="card">
        <div className="row spread">
          <h3>{t("history.transactions")}</h3>
          <button className="btn btn-secondary" onClick={reload} disabled={loading}>
            {loading ? <Spinner /> : t("common.refresh")}
          </button>
        </div>
        {error && <Banner kind="error">{error}</Banner>}
        {!error && done && txs.length === 0 && (
          <p className="muted small">{t("history.none")}</p>
        )}
        {shown.map((t) => (
          <TxRow key={t.transactionHash} tx={t} />
        ))}
        {loading && txs.length === 0 && !error && (
          <div className="row"><Spinner /></div>
        )}
        {hasMore && (
          <div className="row end">
            <button className="btn btn-secondary" onClick={loadAll} disabled={loading}>
              {loading ? <Spinner /> : t("history.loadAll")}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function TxRow({ tx }) {
  const t = useT();
  const incoming = Number(tx.amount) >= 0;
  const pending = !tx.blockIndex;
  const ts = tx.timestamp
    ? new Date(tx.timestamp * 1000).toLocaleString()
    : t("history.pending");
  return (
    <div className="addr-row">
      <span className={`tx-dir ${incoming ? "in" : "out"}`}>
        {incoming ? t("history.received") : t("history.sent")}
      </span>
      <div className="flex" style={{ minWidth: 0 }}>
        <CopyText value={tx.transactionHash} block />
        <span className="muted small">
          {ts}
          {pending && ` · ${t("history.pendingTag")}`}
          {tx.fee
            ? ` · ${t("history.feeTag", {
                amount: formatAmount(tx.fee),
                sym: COIN_SYMBOL,
              })}`
            : ""}
        </span>
      </div>
      <strong className={incoming ? "tx-amount-in" : "tx-amount-out"}>
        {incoming ? "+" : "−"}
        {formatAmount(Math.abs(Number(tx.amount)))} {COIN_SYMBOL}
      </strong>
    </div>
  );
}

function SendPanel({ url, primary, onSent }) {
  const t = useT();
  const [form, setForm] = useState({
    address: "",
    amount: "",
    fee: DEFAULT_FEE,
    anonymity: String(DEFAULT_MIXIN),
    paymentId: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [txHash, setTxHash] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setTxHash(null);

    const amount = toAtomic(form.amount);
    const fee = toAtomic(form.fee);
    if (!form.address.trim()) return setError(t("send.errNoAddress"));
    if (!(amount > 0)) return setError(t("send.errAmount"));
    if (!(fee >= 0) || Number.isNaN(fee)) return setError(t("send.errFee"));

    setBusy(true);
    try {
      const res = await sendTransaction(url, {
        transfers: [{ address: form.address.trim(), amount }],
        fee,
        anonymity: parseInt(form.anonymity, 10) || 0,
        changeAddress: primary || undefined,
        paymentId: form.paymentId.trim() || undefined,
      });
      setTxHash(res?.transactionHash ?? "(sent)");
      setForm((f) => ({ ...f, address: "", amount: "", paymentId: "" }));
      onSent();
    } catch (err) {
      setError(errMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h2 className="panel-title">{t("send.title")}</h2>
      <form className="card" onSubmit={submit}>
        <Field label={t("send.destinationAddress")}>
          <input type="text" value={form.address} onChange={set("address")} spellCheck={false} />
        </Field>
        <Field label={t("send.amount", { sym: COIN_SYMBOL })}>
          <input type="number" step="any" min="0" value={form.amount} onChange={set("amount")} placeholder="0.00" />
        </Field>

        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setShowAdvanced((v) => !v)}
        >
          {showAdvanced ? t("send.hideAdvanced") : t("send.showAdvanced")}
        </button>

        {showAdvanced && (
          <>
            <div className="grid-2">
              <Field label={t("send.fee", { sym: COIN_SYMBOL })} hint={t("send.autoSet")}>
                <input type="number" step="any" min="0" value={form.fee} onChange={set("fee")} placeholder="0.00" />
              </Field>
              <Field label={t("send.mixin")} hint={t("send.autoSet")}>
                <input type="number" min="0" value={form.anonymity} onChange={set("anonymity")} />
              </Field>
            </div>
            <Field label={t("send.paymentId")} hint={t("send.optional")}>
              <input type="text" value={form.paymentId} onChange={set("paymentId")} spellCheck={false} />
            </Field>
          </>
        )}

        {error && <Banner kind="error">{error}</Banner>}
        {txHash && (
          <Banner kind="success">
            {t("send.sentHash")}
            <CopyText value={txHash} block style={{ marginTop: 6 }} />
          </Banner>
        )}

        <div className="row end">
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? <Spinner /> : t("send.sendTransaction")}
          </button>
        </div>
      </form>
    </section>
  );
}
