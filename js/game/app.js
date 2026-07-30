window.SpaceQuestApp = (() => {
  let screens;
  let adventureCanvas;
  let messageTimer = 0;
  let inventoryBtn;
  let inventoryPanel;
  let inventoryBody;
  let inventoryCount;
  let inventoryOpen = false;
  let pausedForInventory = false;

  function show(screenName) {
    closeInventory();
    Object.entries(screens).forEach(([name, el]) => {
      if (!el) return;
      el.hidden = name !== screenName;
      el.setAttribute("aria-hidden", name !== screenName ? "true" : "false");
    });
    // Inventory stays available during the quest, not title / game over
    setInventoryChromeVisible(
      screenName !== "landing" && screenName !== "gameover"
    );
  }

  function setInventoryChromeVisible(visible) {
    if (!inventoryBtn) return;
    inventoryBtn.hidden = !visible;
    if (!visible) closeInventory();
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
        if (room.specialType === "engine-room") {
          tip.innerHTML =
            "<strong>Tip:</strong> Drive core online — exit left to the hallway";
        } else if (room.specialType === "infirmary") {
          tip.innerHTML =
            "<strong>Tip:</strong> Clear the aliens, then check the back of the room";
        } else {
          tip.innerHTML =
            "<strong>Tip:</strong> Explore, then leave through the door";
        }
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

  function renderInventoryPanel() {
    if (!inventoryBody) return;
    const items = window.SpaceQuestInventory.listItems();
    const count = items.length;

    if (inventoryCount) {
      inventoryCount.textContent = String(count);
      inventoryCount.hidden = count === 0;
    }

    if (count === 0) {
      inventoryBody.innerHTML =
        '<p class="inventory-panel__empty">Your inventory is empty.</p>';
      return;
    }

    inventoryBody.innerHTML = `<ul class="inventory-list">${items
      .map(
        (item) => `
      <li class="inventory-item">
        <p class="inventory-item__name">${item.name}</p>
        ${
          item.description
            ? `<p class="inventory-item__desc">${item.description}</p>`
            : ""
        }
      </li>`
      )
      .join("")}</ul>`;
  }

  function openInventory() {
    if (!inventoryPanel || inventoryBtn?.hidden) return;
    renderInventoryPanel();
    inventoryPanel.hidden = false;
    inventoryOpen = true;
    inventoryBtn?.setAttribute("aria-expanded", "true");

    // Pause hallway movement while browsing inventory
    if (
      screens.adventure &&
      !screens.adventure.hidden &&
      window.SpaceQuestAdventure
    ) {
      window.SpaceQuestAdventure.setPaused(true);
      pausedForInventory = true;
    }
  }

  function closeInventory() {
    if (!inventoryPanel || inventoryPanel.hidden) {
      inventoryOpen = false;
      inventoryBtn?.setAttribute("aria-expanded", "false");
      return;
    }
    inventoryPanel.hidden = true;
    inventoryOpen = false;
    inventoryBtn?.setAttribute("aria-expanded", "false");

    if (pausedForInventory && window.SpaceQuestAdventure) {
      // Don't unpause if another modal (search dialog) still needs the pause
      const dialog = document.getElementById("game-dialog");
      const dialogOpen = dialog && !dialog.hidden;
      if (!dialogOpen) {
        window.SpaceQuestAdventure.setPaused(false);
      }
      pausedForInventory = false;
    }
  }

  function toggleInventory() {
    if (inventoryOpen) closeInventory();
    else openInventory();
  }

  function mountInventoryUi() {
    inventoryBtn = document.getElementById("inventory-btn");
    inventoryPanel = document.getElementById("inventory-panel");
    inventoryBody = inventoryPanel?.querySelector("[data-inventory-body]");
    inventoryCount = inventoryBtn?.querySelector("[data-inventory-count]");

    inventoryBtn?.addEventListener("click", () => toggleInventory());
    inventoryPanel
      ?.querySelectorAll("[data-inventory-close]")
      .forEach((el) => {
        el.addEventListener("click", () => closeInventory());
      });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && inventoryOpen) {
        closeInventory();
      }
    });

    window.SpaceQuestInventory.onChange(() => {
      renderInventoryPanel();
    });

    inventoryBtn?.setAttribute("aria-expanded", "false");
    renderInventoryPanel();
  }

  async function offerAlienSearch(defeatedEnemy = null) {
    const adventure = window.SpaceQuestAdventure;
    const inventory = window.SpaceQuestInventory;
    adventure.setPaused(true);

    // Brief beat so the collapsed alien is visible before the prompt
    await new Promise((resolve) => window.setTimeout(resolve, 450));

    const choice = await window.SpaceQuestDialog.confirm("Search Alien?");
    if (choice === "yes") {
      adventure.markCorpseSearched();
      const isLevelTwo = defeatedEnemy?.type === "alien-l2";

      if (isLevelTwo) {
        if (inventory.rollLockerKeyFind()) {
          inventory.addKey(inventory.KEY_IDS.LODGING_LOCKER);
          await window.SpaceQuestDialog.notice(
            "You have found a key to the Lodging foot locker!"
          );
          const room = adventure.getRoom();
          if (room) updateAdventureHud(room);
        } else {
          showGameMessage("You find nothing useful.");
        }
      } else if (inventory.rollKeyCardFind()) {
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

  async function handleCrewmateDialogue(info) {
    const adventure = window.SpaceQuestAdventure;
    adventure.setPaused(true);
    await window.SpaceQuestDialog.notice(info.message);
    if (info.itemId === window.SpaceQuestInventory.ITEM_IDS.BLASTER) {
      showGameMessage("Blaster added to inventory.");
    }
    if (info.fadeAfter && info.id) {
      // Keep drawing while they fade; takenWorldPickup keeps them gone on re-entry
      adventure.beginPropFade(info.id, 2.6);
    }
    adventure.setPaused(false);
  }

  async function handlePickupNotice(info) {
    const adventure = window.SpaceQuestAdventure;
    adventure.setPaused(true);
    await window.SpaceQuestDialog.notice(info.message);
    adventure.setPaused(false);
  }

  async function handleLockerOpened(info) {
    const adventure = window.SpaceQuestAdventure;
    adventure.setPaused(true);
    await window.SpaceQuestDialog.notice(
      info?.message || "You open the locker and find something useful."
    );
    const room = adventure.getRoom();
    if (room) updateAdventureHud(room);
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
      onPickup: (info) => {
        if (info?.message) {
          handlePickupNotice(info);
          return;
        }
        if (info?.itemId === window.SpaceQuestInventory.ITEM_IDS.COFFEE) {
          showGameMessage("Picked up a pot of coffee.");
        } else if (
          info?.itemId === window.SpaceQuestInventory.ITEM_IDS.MISSION_CONTROL
        ) {
          showGameMessage("Mission Control key card added to inventory.");
        } else {
          showGameMessage("Item added to inventory.");
        }
      },
      onInteract: (info) => {
        if (info?.type === "dialogue" && info.message) {
          handleCrewmateDialogue(info);
          return;
        }
        if (info?.type === "opened" && info.itemId) {
          handleLockerOpened(info);
          return;
        }
        if (info?.message) {
          showGameMessage(info.message);
        }
      },
      onCombat: (encounter) => {
        show("combat");
        const wave = Array.isArray(encounter.enemies)
          ? encounter.enemies
          : encounter.enemy
            ? [encounter.enemy]
            : [];
        const multi = wave.length > 1;
        window.SpaceQuestCombat.open(encounter, {
          onWin: () => {
            if (encounter.roomId === "infirmary") {
              window.SpaceQuestInventory.takeWorldPickup("infirmary-ambush");
            }
            startAdventure({
              roomId: encounter.roomId,
              resumePosition: encounter.player,
              defeatedEnemyId: encounter.enemy?.id || wave[0]?.id,
              placeCorpse: multi ? null : encounter.enemy,
              afterCombatLoot: !multi,
              defeatedEnemy: multi ? null : encounter.enemy,
            });
          },
          onLose: () => {
            window.SpaceQuestAdventure.stop();
            showGameOver();
          },
        });
      },
      onSceneReady: () => {
        if (options.afterCombatLoot) {
          offerAlienSearch(options.defeatedEnemy || options.placeCorpse);
        }
      },
    });
  }

  function showGameOver() {
    show("gameover");
    screens.gameover?.classList.remove("is-entering");
    void screens.gameover?.offsetWidth;
    screens.gameover?.classList.add("is-entering");
  }

  function returnToTitle() {
    window.SpaceQuestDialog.hide();
    window.SpaceQuestCombat.close();
    window.SpaceQuestAdventure.stop();
    window.SpaceQuestInventory.reset();
    window.SpaceQuestPlayerState.reset();
    renderInventoryPanel();
    show("landing");
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
    renderInventoryPanel();
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
      gameover: document.getElementById("screen-gameover"),
    };
    adventureCanvas = document.getElementById("adventure-canvas");

    window.SpaceQuestCombat.mount(screens.combat);
    window.SpaceQuestDialog.mount(document.getElementById("game-dialog"));
    window.SpaceQuestInventory.reset();
    window.SpaceQuestPlayerState.reset();
    mountInventoryUi();

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

    document
      .getElementById("return-title")
      ?.addEventListener("click", (event) => {
        const btn = event.currentTarget;
        btn.classList.add("is-launching");
        window.setTimeout(() => {
          btn.classList.remove("is-launching");
          returnToTitle();
        }, 400);
      });

    show("landing");
  }

  return { init, beginQuest, showGameMessage };
})();

document.addEventListener("DOMContentLoaded", () => {
  window.SpaceQuestApp.init();
});
