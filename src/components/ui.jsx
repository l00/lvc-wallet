import { useState } from "react";
import { translate as t } from "../i18n";

export function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function Banner({ kind = "error", children }) {
  if (!children) return null;
  return <div className={`banner banner-${kind}`}>{children}</div>;
}

export function Spinner() {
  return <span className="spinner" aria-label={t("common.loading")} />;
}

export function CopyButton({ value }) {
  const copy = () => navigator.clipboard?.writeText(value);
  return (
    <button type="button" className="copy-btn" onClick={copy} title={t("common.copy")}>
      {t("common.copy")}
    </button>
  );
}

export function CopyText({ value, className = "", block = false, plain = false, style }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard?.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  };
  const base = plain ? "copyable copyable-plain" : "mono-box copyable";
  return (
    <span
      role="button"
      tabIndex={0}
      className={`${base} ${block ? "block" : ""} ${className}`.trim()}
      style={style}
      title="Click to copy"
      onClick={copy}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          copy();
        }
      }}
    >
      {copied ? t("common.copied") : value}
    </span>
  );
}

export function errMessage(e) {
  if (typeof e === "string") return e;
  if (e && e.message) return e.message;
  return t("common.somethingWrong");
}
