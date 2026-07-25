window.SpaceQuestApp = (() => {
  let screens;
  let adventureCanvas;

  function show(screenName) {
    Object.entries(screens).forEach(([name, el]) => {
      if (!el) return;
      el.hidden = name !== screenName;
      el.setAttribute("aria-hidden", name !== screenName ? "true" : "false");
    });
  }

  function updateAdventureHud(room) {
    const title = document.querySelector("[data-hud-room]");
    const tip = document.querySelector("[data-hud-tip]");
    if (title) {
      title.textContent =
        room.kind === "start"
          ? "Starting Scene — alarms active"
          : `${room.name} — alarms active`;
    }
    if (tip) {
      const axes = room.movement?.axes;
      if (axes === "horizontal") {
        tip.innerHTML = "<strong>Tip:</strong> Use ← → to walk the corridor";
      } else if (axes === "vertical") {
        tip.innerHTML = "<strong>Tip:</strong> Use ↑ ↓ to walk the corridor";
      } else {
        tip.innerHTML = "<strong>Tip:</strong> Use arrow keys to explore junctions";
      }
    }
  }

  function startAdventure(options = {}) {
    show("adventure");
    window.SpaceQuestAdventure.start({
      canvas: adventureCanvas,
      roomId: options.roomId,
      resumePosition: options.resumePosition,
      defeatedEnemyId: options.defeatedEnemyId,
      onRoomChange: updateAdventureHud,
      onCombat: (encounter) => {
        window.SpaceQuestCombat.open(encounter, {
          onFlee: () => {
            // Nudge the player back so they don't instantly re-trigger combat
            const nudged = {
              x: Math.max(60, encounter.player.x - 64),
              y: encounter.player.y,
            };
            window.SpaceQuestCombat.close();
            startAdventure({
              roomId: encounter.roomId,
              resumePosition: nudged,
            });
          },
          onWin: () => {
            window.SpaceQuestCombat.close();
            startAdventure({
              roomId: encounter.roomId,
              resumePosition: encounter.player,
              defeatedEnemyId: encounter.enemy.id,
            });
          },
        });
        show("combat");
      },
    });
  }

  function showBackstory() {
    show("backstory");
    screens.backstory?.classList.add("is-entering");
    window.setTimeout(() => {
      screens.backstory?.classList.remove("is-entering");
    }, 700);
  }

  function beginQuest() {
    const landing = screens.landing;
    landing?.classList.add("is-exiting");
    window.setTimeout(() => {
      landing?.classList.remove("is-exiting");
      showBackstory();
    }, 450);
  }

  function init() {
    screens = {
      landing: document.getElementById("screen-landing"),
      backstory: document.getElementById("screen-backstory"),
      adventure: document.getElementById("screen-adventure"),
      combat: document.getElementById("screen-combat"),
    };
    adventureCanvas = document.getElementById("adventure-canvas");

    window.SpaceQuestCombat.mount(screens.combat);

    document
      .getElementById("begin-quest")
      ?.addEventListener("click", (event) => {
        const btn = event.currentTarget;
        btn.classList.add("is-launching");
        window.setTimeout(() => {
          btn.classList.remove("is-launching");
          beginQuest();
        }, 500);
      });

    document
      .getElementById("continue-quest")
      ?.addEventListener("click", (event) => {
        const btn = event.currentTarget;
        btn.classList.add("is-launching");
        window.setTimeout(() => {
          btn.classList.remove("is-launching");
          startAdventure();
        }, 450);
      });

    show("landing");
  }

  return { init, beginQuest };
})();

document.addEventListener("DOMContentLoaded", () => {
  window.SpaceQuestApp.init();
});
