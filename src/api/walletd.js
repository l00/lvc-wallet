import { invoke } from "@tauri-apps/api/core";
import { getStatus } from "./rpc";
import { translate as t } from "../i18n";

export const defaultWalletDir = () => invoke("default_wallet_dir");
export const listWallets = (dir) => invoke("list_wallets", { dir });
export const generateWallet = (args) => invoke("generate_wallet", { args });
export const startWalletd = (args) => invoke("start_walletd", { args });
export const stopWalletd = () => invoke("stop_walletd");
export const walletdFailed = () => invoke("walletd_failed");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function friendlyWalletdError(line) {
  if (/password is wrong/i.test(line)) return t("errors.incorrectPassword");
  const afterReason = line.split(/reason:\s*/i)[1];
  const cleaned = (afterReason ?? line)
    .replace(/^\S+\s+\S+\s+\w+\s+\[[^\]]*\]\s*/, "")
    .trim();
  return cleaned || line;
}

export async function waitForReady(url, attempts = 30, intervalMs = 1000) {
  let lastErr = "timed out";
  for (let i = 0; i < attempts; i++) {
    const failure = await walletdFailed().catch(() => null);
    if (failure) throw friendlyWalletdError(failure);
    try {
      await getStatus(url);
      return;
    } catch (e) {
      lastErr = typeof e === "string" ? e : e?.message || "not ready";
      await sleep(intervalMs);
    }
  }
  throw t("errors.notReady", { reason: lastErr });
}
export function containerPath(dir, name) {
  return `${dir.replace(/[/\\]+$/, "")}/${name}`;
}
