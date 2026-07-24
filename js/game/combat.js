/**
 * Turn-based combat placeholder.
 * Touching an enemy transitions here; real combat systems land later.
 */
window.SpaceQuestCombat = (() => {
  let root;
  let enemyNameEl;
  let onFlee;
  let onWinStub;

  function mount(element) {
    root = element;
    enemyNameEl = root.querySelector("[data-combat-enemy]");
    root.querySelector("[data-combat-flee]")?.addEventListener("click", () => {
      if (typeof onFlee === "function") onFlee();
    });
    root.querySelector("[data-combat-win]")?.addEventListener("click", () => {
      if (typeof onWinStub === "function") onWinStub();
    });
  }

  function open(encounter, handlers = {}) {
    onFlee = handlers.onFlee;
    onWinStub = handlers.onWin;
    if (enemyNameEl) {
      enemyNameEl.textContent = encounter.enemy.name || "Unknown Alien";
    }
    root?.setAttribute("data-active", "true");
  }

  function close() {
    root?.setAttribute("data-active", "false");
  }

  return { mount, open, close };
})();
