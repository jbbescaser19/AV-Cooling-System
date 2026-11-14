import { confirmAction as openConfirmDialog } from "./confirmAction.jsx";

/** Compatibility wrapper for existing POS/Management/notification confirmations.
 * Every caller uses the same responsive modal; no invisible global listener.
 */
export function confirmAction(message, options = {}) {
  if (message && typeof message === "object") {
    return openConfirmDialog(message);
  }
  const text = String(message || "Are you sure you want to continue?");
  return openConfirmDialog({
    title: options.title || "Confirm action",
    message: text,
    confirmText: options.confirmLabel || "Confirm",
    danger:
      options.tone === "caution" ||
      /\b(delete|remove|cancel|decline|clear|archive)\b/i.test(text),
  });
}
