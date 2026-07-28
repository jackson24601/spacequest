/**
 * Modal choice / notice dialogs over the adventure view.
 */
window.SpaceQuestDialog = (() => {
  let root;
  let textEl;
  let actionsEl;
  let resolver = null;

  function mount(element) {
    root = element;
    textEl = root.querySelector("[data-dialog-text]");
    actionsEl = root.querySelector("[data-dialog-actions]");

    actionsEl?.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-dialog-value]");
      if (!btn || !resolver) return;
      const value = btn.getAttribute("data-dialog-value");
      const settle = resolver;
      resolver = null;
      hide();
      settle(value);
    });
  }

  function hide() {
    if (!root) return;
    root.hidden = true;
    root.setAttribute("aria-hidden", "true");
  }

  function show({ text, buttons }) {
    if (!root || !textEl || !actionsEl) {
      return Promise.resolve(null);
    }

    if (resolver) {
      const settle = resolver;
      resolver = null;
      settle(null);
    }

    textEl.textContent = text || "";
    actionsEl.innerHTML = (buttons || [])
      .map((btn) => {
        const secondary = btn.secondary ? " btn-dialog--secondary" : "";
        return `<button type="button" class="btn-dialog${secondary}" data-dialog-value="${btn.value}">${btn.label}</button>`;
      })
      .join("");

    root.hidden = false;
    root.setAttribute("aria-hidden", "false");

    return new Promise((resolve) => {
      resolver = resolve;
      const first = actionsEl.querySelector("button");
      first?.focus();
    });
  }

  function confirm(text, { yesLabel = "Yes", noLabel = "No" } = {}) {
    return show({
      text,
      buttons: [
        { label: yesLabel, value: "yes" },
        { label: noLabel, value: "no", secondary: true },
      ],
    });
  }

  function notice(text, { okLabel = "OK" } = {}) {
    return show({
      text,
      buttons: [{ label: okLabel, value: "ok" }],
    });
  }

  return { mount, show, confirm, notice, hide };
})();
