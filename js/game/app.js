window.SpaceQuestApp = (() => {
  let screens;
  let adventureCanvas;
  let messageTimer = 0;

  function show(screenName) {
    Object.entries(screens).forEach(([name, el]) => {
      if (!el) return;
      el.hidden = name !== screenName;
      el.setAttribute("aria-hidden", name !== screenName ? "true" : "false");
    });
  }

  function showGameMessage(text) {
    const el = document.getElementById("game-message");
    if (!el) return;
    el.hidden = false;
    el.textContent = text;
    el.classList.remove("is-visible");
    void el.offsetWidth;
    el.classList.add("is-visible");
    window.clearTimeout(messageTimer);
    messageTimer = window.setTimeout(() => {
      el.classList.remove("is-visible");
      el.hidden = true;
    }, 2400);
  }

  function updateAdventureHud(room) {
    const title = document.querySelector("[data-hud-room]");
    const tip = document.querySelector("[data-hud-tip]");
    const hp = window.SpaceQuestPlayerState.getHp();
    const maxHp = window.SpaceQuestPlayerState.getMaxHp();

    if (title) {
      if (room.kind === "start") {
        title.textContent = `Starting Scene — HP ${hp}/${maxHp}`;
      } else if (room.kind === "special") {
        title.textContent = `${room.name} — HP ${hp}/${maxHp}`;
      } else {
        title.textContent = `${room.name} — HP ${hp}/${maxHp}`;
      }
    }
    if (tip) {
      if (room.kind === "special") {
        tip.innerHTML = "<strong>Tip:</strong> Explore, then leave through the door";
      } else {
        const axes = room.movement?.axes;
        if (axes === "horizontal") {
          tip.innerHTML =
            "<strong>Tip:</strong> Use ← → ; aliens may appear and chase you";
        } else if (axes === "vertical") {
          tip.innerHTML =
            "<strong>Tip:</strong> Use ↑ ↓ ; aliens may appear and chase you";
        } else {
          tip.innerHTML =
            "<strong>Tip:</strong> Arrow keys move; doorways lead to rooms";
        }
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
      onLockedDoor: (info) => {
        showGameMessage(
          info?.message || "This door is locked and you do not have the key."
        );
      },
      onCombat: (encounter) => {
        show("combat");
        window.SpaceQuestCombat.open(encounter, {
          onWin: () => {
            startAdventure({
              roomId: encounter.roomId,
              resumePosition: encounter.player,
              defeatedEnemyId: encounter.enemy.id,
            });
          },
          onLose: () => {
            window.SpaceQuestPlayerState.healFull();
            startAdventure({
              roomId: "start",
            });
            showGameMessage("You wake back in the Starting Scene.");
          },
        });
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
    window.SpaceQuestInventory.reset();
    window.SpaceQuestPlayerState.reset();
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
    window.SpaceQuestInventory.reset();
    window.SpaceQuestPlayerState.reset();

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

  return { init, beginQuest, showGameMessage };
})();

document.addEventListener("DOMContentLoaded", () => {
  window.SpaceQuestApp.init();
});
