/**
 * Turn-based combat.
 * Player always acts first. Unarmed actions: Punch / Kick.
 * Each has 50% hit chance and deals 1 damage.
 * Inventory items (e.g. coffee) can add one-time actions.
 */
window.SpaceQuestCombat = (() => {
  const PLAYER_HIT_CHANCE = 0.5;
  const ENEMY_DEFAULT_HIT_CHANCE = 0.25;
  const UNARMED_DAMAGE = 1;
  const COFFEE_DAMAGE = 10;
  const BLASTER_HIT_CHANCE = 4 / 5;
  const BLASTER_DAMAGE = 3;

  let root;
  let playerSide;
  let enemySide;
  let logEl;
  let actionsEl;
  let resultEl;
  let resultTextEl;
  let continueBtn;
  let throwCoffeeBtn;
  let fireBlasterBtn;
  let firePlasmaBtn;
  let useMedKitBtn;

  let encounter = null;
  let handlers = {};
  let playerUnit = null;
  let enemyUnits = [];
  let selectedEnemyId = null;
  let turn = "player"; // player | enemy | resolved
  let busy = false;

  function mount(element) {
    root = element;
    playerSide = root.querySelector("[data-combat-player-side]");
    enemySide = root.querySelector("[data-combat-enemy-side]");
    logEl = root.querySelector("[data-combat-log]");
    actionsEl = root.querySelector("[data-combat-actions]");
    resultEl = root.querySelector("[data-combat-result]");
    resultTextEl = root.querySelector("[data-combat-result-text]");
    continueBtn = root.querySelector("[data-combat-continue]");
    throwCoffeeBtn = root.querySelector('[data-action="throw-coffee"]');
    fireBlasterBtn = root.querySelector('[data-action="fire-blaster"]');
    firePlasmaBtn = root.querySelector('[data-action="fire-plasma-riffle"]');
    useMedKitBtn = root.querySelector('[data-action="use-med-kit"]');

    actionsEl?.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-action]");
      if (!btn || busy || turn !== "player") return;
      const action = btn.getAttribute("data-action");
      if (action === "punch" || action === "kick") {
        playerAttack(action);
      } else if (action === "throw-coffee") {
        throwCoffee();
      } else if (action === "fire-blaster") {
        fireBlaster();
      } else if (action === "fire-plasma-riffle") {
        // Gated in syncItemActions — only usable with a cartridge
        firePlasmaRiffle();
      } else if (action === "use-med-kit") {
        useMedKit();
      }
    });

    // Targeting is fixed in spawn order (Alien 1 → 2 → …); clicks do not retarget.

    continueBtn?.addEventListener("click", () => {
      if (!handlers.outcome) return;
      const outcome = handlers.outcome;
      close();
      outcome();
      handlers = {};
    });
  }

  function log(message) {
    if (!logEl) return;
    const line = document.createElement("p");
    line.textContent = message;
    logEl.appendChild(line);
    logEl.scrollTop = logEl.scrollHeight;
  }

  function clearLog() {
    if (logEl) logEl.innerHTML = "";
  }

  function hasCoffee() {
    return window.SpaceQuestInventory.hasItem(
      window.SpaceQuestInventory.ITEM_IDS.COFFEE
    );
  }

  function hasBlaster() {
    return window.SpaceQuestInventory.hasItem(
      window.SpaceQuestInventory.ITEM_IDS.BLASTER
    );
  }

  function hasMedKit() {
    return window.SpaceQuestInventory.hasItem(
      window.SpaceQuestInventory.ITEM_IDS.MED_KIT
    );
  }

  function syncItemActions() {
    if (throwCoffeeBtn) {
      throwCoffeeBtn.hidden = !hasCoffee();
    }
    if (fireBlasterBtn) {
      fireBlasterBtn.hidden = !hasBlaster();
    }
    if (firePlasmaBtn) {
      // Rifle alone is not enough — needs ammunition cartridge
      firePlasmaBtn.hidden = !window.SpaceQuestInventory.canUsePlasmaRiffle();
    }
    if (useMedKitBtn) {
      useMedKitBtn.hidden = !hasMedKit();
    }
  }

  function turnPrompt() {
    const options = ["Punch", "Kick"];
    if (hasCoffee()) options.push("Throw Coffee");
    if (hasBlaster()) options.push("Fire Blaster");
    if (window.SpaceQuestInventory.canUsePlasmaRiffle()) {
      options.push("Fire Plasma Riffle");
    }
    if (hasMedKit()) options.push("Use Med Kit");
    if (options.length <= 2) {
      return "Your turn. Choose Punch or Kick.";
    }
    const last = options.pop();
    return `Your turn. Choose ${options.join(", ")}, or ${last}.`;
  }

  function setActionsEnabled(enabled) {
    actionsEl?.querySelectorAll("button").forEach((btn) => {
      btn.disabled = !enabled;
    });
  }

  function hpPercent(unit) {
    return Math.max(0, Math.round((unit.hp / unit.maxHp) * 100));
  }

  function unitCard(unit, side) {
    const selected =
      side === "enemy" && unit.id === selectedEnemyId && unit.hp > 0;
    const dead = unit.hp <= 0;
    return `
      <div class="battle-unit battle-unit--${side}${selected ? " is-selected" : ""}${dead ? " is-down" : ""}" data-unit-id="${unit.id}">
        <div class="battle-hp">
          <div class="battle-hp__bar">
            <div class="battle-hp__fill" style="width:${hpPercent(unit)}%"></div>
          </div>
          <div class="battle-hp__text">${Math.max(0, unit.hp)}/${unit.maxHp}</div>
        </div>
        <div class="battle-sprite-wrap">
          <img class="battle-sprite" src="${unit.sprite}" alt="${unit.name}" draggable="false" />
          <div class="battle-float" data-float></div>
        </div>
        <div class="battle-name">${unit.name}</div>
      </div>
    `;
  }

  function renderUnits() {
    if (playerSide) {
      playerSide.innerHTML = unitCard(playerUnit, "player");
    }
    if (enemySide) {
      enemySide.innerHTML = enemyUnits.map((e) => unitCard(e, "enemy")).join("");
    }
  }

  function floatDamage(unitId, text, kind) {
    const node = root.querySelector(`[data-unit-id="${unitId}"] [data-float]`);
    if (!node) return;
    node.textContent = text;
    node.className = `battle-float is-show battle-float--${kind}`;
    window.setTimeout(() => {
      node.classList.remove("is-show");
    }, 700);
  }

  function livingEnemies() {
    // Preserve encounter order so attacks and turns stay Alien 1 → 2 → …
    return enemyUnits.filter((e) => e.hp > 0);
  }

  function getSelectedEnemy() {
    // Damage always applies to the first living alien in order
    const target = livingEnemies()[0] || null;
    selectedEnemyId = target?.id || null;
    return target;
  }

  function rollHit(chance = PLAYER_HIT_CHANCE) {
    return Math.random() < chance;
  }

  async function wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  async function playerAttack(actionName) {
    const target = getSelectedEnemy();
    if (!target) return;

    busy = true;
    setActionsEnabled(false);
    turn = "enemy";

    const label = actionName === "kick" ? "Kick" : "Punch";
    const hit = rollHit(PLAYER_HIT_CHANCE);

    if (hit) {
      target.hp = Math.max(0, target.hp - UNARMED_DAMAGE);
      log(`You ${label.toLowerCase()} the ${target.name} for ${UNARMED_DAMAGE} damage!`);
    } else {
      log(`Your ${label.toLowerCase()} misses the ${target.name}.`);
    }
    getSelectedEnemy();
    renderUnits();
    floatDamage(target.id, hit ? `-${UNARMED_DAMAGE}` : "Miss", hit ? "hit" : "miss");

    await wait(650);

    if (livingEnemies().length === 0) {
      finish("win");
      return;
    }

    await enemyPhase();
  }

  async function throwCoffee() {
    const target = getSelectedEnemy();
    if (!target) return;
    const inv = window.SpaceQuestInventory;
    const coffeeId = inv.ITEM_IDS.COFFEE;
    if (!inv.hasItem(coffeeId)) {
      syncItemActions();
      return;
    }

    busy = true;
    setActionsEnabled(false);
    turn = "enemy";

    inv.removeItem(coffeeId);
    syncItemActions();

    target.hp = Math.max(0, target.hp - COFFEE_DAMAGE);
    log(
      `You hurl the pot of coffee at the ${target.name} for ${COFFEE_DAMAGE} damage!`
    );
    getSelectedEnemy();
    renderUnits();
    floatDamage(target.id, `-${COFFEE_DAMAGE}`, "hit");

    await wait(650);

    if (livingEnemies().length === 0) {
      finish("win");
      return;
    }

    await enemyPhase();
  }

  async function fireBlaster() {
    const target = getSelectedEnemy();
    if (!target) return;
    if (!hasBlaster()) {
      syncItemActions();
      return;
    }

    busy = true;
    setActionsEnabled(false);
    turn = "enemy";

    const hit = rollHit(BLASTER_HIT_CHANCE);
    if (hit) {
      target.hp = Math.max(0, target.hp - BLASTER_DAMAGE);
      log(
        `You fire the blaster at the ${target.name} for ${BLASTER_DAMAGE} damage!`
      );
    } else {
      log(`Your blaster shot misses the ${target.name}.`);
    }
    getSelectedEnemy();
    renderUnits();
    floatDamage(target.id, hit ? `-${BLASTER_DAMAGE}` : "Miss", hit ? "hit" : "miss");

    await wait(650);

    if (livingEnemies().length === 0) {
      finish("win");
      return;
    }

    await enemyPhase();
  }

  async function firePlasmaRiffle() {
    // Reserved until a cartridge is found; button stays hidden without one
    if (!window.SpaceQuestInventory.canUsePlasmaRiffle()) {
      syncItemActions();
      return;
    }
  }

  async function useMedKit() {
    const inv = window.SpaceQuestInventory;
    const medKitId = inv.ITEM_IDS.MED_KIT;
    if (!inv.hasItem(medKitId)) {
      syncItemActions();
      return;
    }

    // Using a Med Kit spends the whole turn — no attack this round
    busy = true;
    setActionsEnabled(false);
    turn = "enemy";

    inv.removeItem(medKitId);
    syncItemActions();

    const heal = inv.MED_KIT_HEAL;
    const hp = window.SpaceQuestPlayerState.heal(heal);
    playerUnit.hp = hp;
    playerUnit.maxHp = window.SpaceQuestPlayerState.getMaxHp();
    renderUnits();
    floatDamage(playerUnit.id, `+${heal}`, "heal");
    log(`You use a Med Kit and restore ${heal} HP.`);

    await wait(650);
    await enemyPhase();
  }

  async function enemyPhase() {
    // Snapshot living attackers at phase start: User → each living alien → User
    const attackers = livingEnemies();
    for (const enemy of attackers) {
      if (enemy.hp <= 0) continue;
      const chance = enemy.hitChance ?? ENEMY_DEFAULT_HIT_CHANCE;
      const damage = enemy.attackDamage ?? 1;
      const hit = rollHit(chance);

      if (hit) {
        window.SpaceQuestPlayerState.applyDamage(damage);
        playerUnit.hp = window.SpaceQuestPlayerState.getHp();
        renderUnits();
        floatDamage(playerUnit.id, `-${damage}`, "hit");
        log(`The ${enemy.name} hits you for ${damage} damage!`);
      } else {
        floatDamage(playerUnit.id, "Miss", "miss");
        log(`The ${enemy.name} attacks and misses.`);
      }

      await wait(650);

      if (playerUnit.hp <= 0) {
        await finish("lose");
        return;
      }
    }

    turn = "player";
    busy = false;
    setActionsEnabled(true);
    syncTargetHighlight();
    log(turnPrompt());
  }

  function syncTargetHighlight() {
    getSelectedEnemy();
    renderUnits();
  }

  async function playPlayerDeath() {
    playerUnit.hp = 0;
    renderUnits();
    const unit = root?.querySelector('[data-unit-id="player"]');
    if (unit) {
      unit.classList.remove("is-down");
      unit.classList.add("is-dying");
    }
    await wait(1450);
  }

  async function finish(result) {
    turn = "resolved";
    busy = true;
    setActionsEnabled(false);

    if (result === "win") {
      const onWin = handlers.onWin;
      const many = enemyUnits.length > 1;
      resultTextEl.textContent = many
        ? "Victory! The aliens collapse."
        : "Victory! The alien collapses.";
      log("You won the battle.");
      handlers.outcome = () => {
        if (typeof onWin === "function") onWin();
      };
      if (resultEl) resultEl.hidden = false;
      return;
    }

    const onLose = handlers.onLose;
    window.SpaceQuestPlayerState.setHp(0);
    log("You collapse…");
    if (resultEl) resultEl.hidden = true;
    await playPlayerDeath();
    close();
    handlers = {};
    if (typeof onLose === "function") onLose();
  }

  function open(nextEncounter, nextHandlers = {}) {
    encounter = nextEncounter;
    handlers = nextHandlers;
    busy = false;
    turn = "player";
    clearLog();
    if (resultEl) resultEl.hidden = true;

    const state = window.SpaceQuestPlayerState;
    playerUnit = {
      id: "player",
      name: "You",
      hp: state.getHp(),
      maxHp: state.getMaxHp(),
      sprite: "assets/sprites/player.png",
    };

    const rawEnemies = Array.isArray(nextEncounter.enemies)
      ? nextEncounter.enemies
      : nextEncounter.enemy
        ? [nextEncounter.enemy]
        : [];

    const ordered = rawEnemies.slice().sort((a, b) => {
      const ao = a.combatOrder != null ? a.combatOrder : 999;
      const bo = b.combatOrder != null ? b.combatOrder : 999;
      return ao - bo;
    });

    enemyUnits = ordered.map((enemy, index) => ({
      id: enemy.id || `enemy-${index}`,
      name: enemy.name || `Alien ${index + 1}`,
      type: enemy.type || null,
      combatOrder: enemy.combatOrder != null ? enemy.combatOrder : index + 1,
      hp: enemy.hp ?? enemy.maxHp ?? 5,
      maxHp: enemy.maxHp ?? enemy.hp ?? 5,
      attackDamage: enemy.attackDamage ?? 1,
      hitChance: enemy.hitChance ?? ENEMY_DEFAULT_HIT_CHANCE,
      sprite: enemy.sprite || "assets/sprites/alien-l1.png",
      deadSprite: enemy.deadSprite || null,
    }));

    selectedEnemyId = livingEnemies()[0]?.id || null;
    renderUnits();
    syncItemActions();
    setActionsEnabled(true);
    if (root) {
      root.classList.toggle("battle-horde", enemyUnits.length >= 3);
    }
    const names = enemyUnits.map((e) => e.name).join(", ");
    log(
      enemyUnits.length > 1
        ? `Battle start! ${enemyUnits.length} aliens appear: ${names}.`
        : `Battle start! A ${names} appears.`
    );
    log(turnPrompt());

    if (root) {
      root.hidden = false;
      root.setAttribute("data-active", "true");
    }
  }

  function close() {
    if (root) {
      root.setAttribute("data-active", "false");
      root.hidden = true;
      root.classList.remove("battle-horde");
    }
  }

  return { mount, open, close };
})();
