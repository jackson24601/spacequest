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
    const hasEngineKey = window.SpaceQuestInventory.hasKey(
      window.SpaceQuestInventory.KEY_IDS.ENGINE_ROOM
    );

    if (title) {
      if (room.kind === "start") {
        title.textContent = `Starting Scene — HP ${hp}/${maxHp}`;
      } else if (room.kind === "special") {
        title.textContent = `${room.name} — HP ${hp}/${maxHp}`;
      } else {
        title.textContent = `${room.name} — HP ${hp}/${maxHp}`;
      }
      if (hasEngineKey) {
        title.textContent += " · Key Card";
      }
    }
    if (tip) {
      if (room.kind === "special") {
        tip.innerHTML =
          room.specialType === "engine-room"
            ? "<strong>Tip:</strong> Drive core online — exit left to the hallway"
            : "<strong>Tip:</strong> Explore, then leave through the door";
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

  async function offerAlienSearch() {
    const adventure = window.SpaceQuestAdventure;
    const inventory = window.SpaceQuestInventory;
    adventure.setPaused(true);

    // Brief beat so the collapsed alien is visible before the prompt
    await new Promise((resolve) => window.setTimeout(resolve, 450));

    const choice = await window.SpaceQuestDialog.confirm("Search Alien?");
    if (choice === "yes") {
      adventure.markCorpseSearched();
      if (inventory.rollKeyCardFind()) {
        inventory.addKey(inventory.KEY_IDS.ENGINE_ROOM);
        await window.SpaceQuestDialog.notice(
          "You have found a key card to the Engine Room!"
        );
        const room = adventure.getRoom();
        if (room) updateAdventureHud(room);
      } else {
        showGameMessage("You find nothing useful.");
      }
    }

    adventure.setPaused(false);
  }

  async function startAdventure(options = {}) {
    show("adventure");
    await window.SpaceQuestAdventure.start({
      canvas: adventureCanvas,
      roomId: options.roomId,
      resumePosition: options.resumePosition,
      defeatedEnemyId: options.defeatedEnemyId,
      placeCorpse: options.placeCorpse,
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
              placeCorpse: encounter.enemy,
              afterCombatLoot: true,
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
      onSceneReady: () => {
        if (options.afterCombatLoot) {
          offerAlienSearch();
        }
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
    window.SpaceQuestDialog.mount(document.getElementById("game-dialog"));
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
