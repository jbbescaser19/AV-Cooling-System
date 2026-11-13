/**
 * Async confirmation API. The UI lives once at application root.
 * Confirmations never bypass the user's explicit approval.
 */
export function confirmAction(message, options = {}) {
  if (typeof window === "undefined") return Promise.resolve(false);
  return new Promise((resolve) => {
    let accepted = false;
    const detail = {
      message: String(message || "Are you sure you want to continue?"),
      title: options.title || "Confirm action",
      tone:
        options.tone ||
        (/delete|remove|cancel|decline|clear|restore/i.test(message)
          ? "caution"
          : "default"),
      confirmLabel: options.confirmLabel || "Confirm",
      settle: (value) => {
        if (!accepted) {
          accepted = true;
          resolve(Boolean(value));
        }
      },
    };
    const event = new CustomEvent("av-confirm-request", {
      detail,
      cancelable: true,
    });
    // When the dialog is not mounted, fail closed rather than auto-accepting.
    window.dispatchEvent(event);
    if (!event.defaultPrevented) detail.settle(false);
  });
}
