import { invoke } from "@tauri-apps/api/core";

export const DISPLAY_DECIMALS = 12;
const ATOMIC = 10 ** DISPLAY_DECIMALS;
export const COIN_SYMBOL = "LVC";

export const DEFAULT_FEE = "0.001";
export const DEFAULT_MIXIN = 3;

export async function rpc(url, method, params = {}) {
  return invoke("rpc_request", { url, method, params });
}

const AMOUNT_DECIMALS = 8;

export function formatAmount(atomic) {
  const n = atomic == null ? 0 : Number(atomic) / ATOMIC;
  return n.toLocaleString(undefined, {
    minimumFractionDigits: AMOUNT_DECIMALS,
    maximumFractionDigits: AMOUNT_DECIMALS,
  });
}

export function toAtomic(amountStr) {
  const n = parseFloat(amountStr);
  if (!isFinite(n)) return NaN;
  return Math.round(n * ATOMIC);
}

export const getStatus = (url) => rpc(url, "getStatus");

export const getBalance = (url, address) =>
  rpc(url, "getBalance", address ? { address } : {});

export const getAddresses = (url) => rpc(url, "getAddresses");

export const createAddress = (url) => rpc(url, "createAddress", {});

export const deleteAddress = (url, address) =>
  rpc(url, "deleteAddress", { address });

export const getViewKey = (url) => rpc(url, "getViewKey");

export const getSpendKeys = (url, address) =>
  rpc(url, "getSpendKeys", { address });

export const getMnemonicSeed = (url, address) =>
  rpc(url, "getMnemonicSeed", { address });

export const getTransactions = (url, firstBlockIndex = 0, blockCount = 1e9) =>
  rpc(url, "getTransactions", { firstBlockIndex, blockCount });

export const sendTransaction = (
  url,
  { transfers, fee, anonymity, changeAddress, paymentId }
) => {
  const params = { transfers, fee, anonymity };
  if (changeAddress) params.changeAddress = changeAddress;
  if (paymentId) params.paymentId = paymentId;
  return rpc(url, "sendTransaction", params);
};
