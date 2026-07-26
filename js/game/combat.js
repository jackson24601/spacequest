/**
 * Turn-based combat.
 * Player always acts first. Unarmed actions: Punch / Kick.
 * Each has 50% hit chance and deals 1 damage.
 */
window.SpaceQuestCombat = (() => {
  const HIT_CHANCE = 0.5;
  const UNARMED_DAMAGE = 1;

  let root;
  let playerSide;
  let enemySide;
  let logEl;
  let actionsEl;
  let resultEl;
  let resultTextEl;
  let continueBtn;

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

    actionsEl?.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-action]");
      if (!btn || busy || turn !== "player") return;
      const action = btn.getAttribute("data-action");
      if (action === "punch" || action === "kick") {
        playerAttack(action);
      }
    });

    enemySide?.addEventListener("click", (event) => {
      const unit = event.target.closest("[data-unit-id]");
      if (!unit || turn !== "player") return;
      const id = unit.getAttribute("data-unit-id");
      const target = enemyUnits.find((e) => e.id === id && e.hp > 0);
      if (target) {
        selectedEnemyId = target.id;
        renderUnits();
      }
    });

    continueBtn?.addEventListener("click", () => {
      if (!handlers.outcome) return;
      const outcome = handlers.outcome;
      handlers = {};
      close();
      outcome();
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
    return enemyUnits.filter((e) => e.hp > 0);
  }

  function getSelectedEnemy() {
    let target = enemyUnits.find((e) => e.id === selectedEnemyId && e.hp > 0);
    if (!target) target = livingEnemies()[0] || null;
    if (target) selectedEnemyId = target.id;
    return target;
  }

  function rollHit(chance = HIT_CHANCE) {
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
    const hit = rollHit(HIT_CHANCE);

    if (hit) {
      target.hp = Math.max(0, target.hp - UNARMED_DAMAGE);
      renderUnits();
      floatDamage(target.id, `-${UNARMED_DAMAGE}`, "hit");
      log(`You ${label.toLowerCase()} the ${target.name} for ${UNARMED_DAMAGE} damage!`);
    } else {
      floatDamage(target.id, "Miss", "miss");
      log(`Your ${label.toLowerCase()} misses the ${target.name}.`);
    }

    await wait(650);

    if (livingEnemies().length === 0) {
      finish("win");
      return;
    }

    await enemyPhase();
  }

  async function enemyPhase() {
    for (const enemy of livingEnemies()) {
      const chance = enemy.hitChance ?? HIT_CHANCE;
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
        finish("lose");
        return;
      }
    }

    turn = "player";
    busy = false;
    setActionsEnabled(true);
    log("Your turn. Choose Punch or Kick.");
  }

  function finish(result) {
    turn = "resolved";
    busy = true;
    setActionsEnabled(false);

    if (result === "win") {
      resultTextEl.textContent = "Victory! The alien collapses.";
      log("You won the battle.");
      handlers.outcome = () => {
        if (typeof handlers.onWin === "function") handlers.onWin();
      };
    } else {
      window.SpaceQuestPlayerState.setHp(0);
      resultTextEl.textContent = "You were defeated...";
      log("You were defeated.");
      handlers.outcome = () => {
        if (typeof handlers.onLose === "function") handlers.onLose();
      };
    }

    if (resultEl) resultEl.hidden = false;
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

    enemyUnits = rawEnemies.map((enemy, index) => ({
      id: enemy.id || `enemy-${index}`,
      name: enemy.name || "Alien",
      hp: enemy.hp ?? enemy.maxHp ?? 5,
      maxHp: enemy.maxHp ?? enemy.hp ?? 5,
      attackDamage: enemy.attackDamage ?? 1,
      hitChance: enemy.hitChance ?? HIT_CHANCE,
      sprite: enemy.sprite || "assets/sprites/enemy.png",
    }));

    selectedEnemyId = livingEnemies()[0]?.id || null;
    renderUnits();
    setActionsEnabled(true);
    log(`Battle start! A ${enemyUnits.map((e) => e.name).join(", ")} appears.`);
    log("Your turn. Choose Punch or Kick.");

    if (root) {
      root.hidden = false;
      root.setAttribute("data-active", "true");
    }
  }

  function close() {
    if (root) {
      root.setAttribute("data-active", "false");
      root.hidden = true;
    }
  }

  return { mount, open, close };
})();
