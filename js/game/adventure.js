window.SpaceQuestAdventure = (() => {
  const SPRITE_SCALE = 2.5;
  const PLAYER_SPEED = 160;
  const FRAME_W = 32;
  const FRAME_H = 48;
  const WALK_FPS = 8;
  const EDGE = 18;
  const ALIEN_SPAWN_DELAY = 1;
  const ALIEN_SPAWN_CHANCE = 0.5;
  const ALIEN_L2_SPAWN_DELAY = 2;
  const ALIEN_L2_SPAWN_CHANCE = 2 / 3;
  const INFIRMARY_AMBUSH_ID = "infirmary-ambush";
  const MISSION_CONTROL_BOSS_ID = "mission-control-boss";

  let canvas;
  let ctx;
  let running = false;
  let lastTime = 0;
  let rafId = 0;
  let room;
  let player;
  let enemies = [];
  let playerSheet;
  let enemyImage;
  let enemyDeadImage;
  let enemyImages = {};
  let onCombat;
  let onRoomChange;
  let onLockedDoor;
  let assetsReady = false;
  let alarmPhase = 0;
  let transitionLock = 0;
  let lockedDoorCooldown = 0;
  let alienSpawnTimer = null;
  let alienL2SpawnTimer = null;
  let suppressAlienSpawn = false;
  let corpses = [];
  let interactionPaused = false;
  let interactBtn = null;
  let nearbyInteractable = null;
  let onPickup = null;
  let onInteract = null;
  const propFades = new Map();

  function aabb(a, b) {
    return (
      a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y
    );
  }

  function collidesSolids(box, solids) {
    return solids.some((solid) => aabb(box, solid));
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  async function prepareAssets() {
    if (!playerSheet) {
      playerSheet = await loadImage("assets/sprites/player-walk.png");
    }
    if (!enemyImage) {
      enemyImage = await loadImage("assets/sprites/alien-l1.png");
      enemyImages["assets/sprites/alien-l1.png"] = enemyImage;
    }
    if (!enemyDeadImage) {
      try {
        enemyDeadImage = await loadImage("assets/sprites/alien-l1-dead.png");
        enemyImages["assets/sprites/alien-l1-dead.png"] = enemyDeadImage;
      } catch (err) {
        enemyDeadImage = null;
      }
    }
    const l2Sprite = "assets/sprites/alien-l2.png";
    const l2Dead = "assets/sprites/alien-l2-dead.png";
    if (!enemyImages[l2Sprite]) {
      try {
        enemyImages[l2Sprite] = await loadImage(l2Sprite);
      } catch (err) {
        enemyImages[l2Sprite] = enemyImage;
      }
    }
    if (!enemyImages[l2Dead]) {
      try {
        enemyImages[l2Dead] = await loadImage(l2Dead);
      } catch (err) {
        enemyImages[l2Dead] = enemyDeadImage;
      }
    }
    assetsReady = Boolean(playerSheet && enemyImage);
  }

  function spriteImage(src, fallback = enemyImage) {
    return (src && enemyImages[src]) || fallback;
  }

  function clearAlienSpawnTimer() {
    if (alienSpawnTimer != null) {
      window.clearTimeout(alienSpawnTimer);
      alienSpawnTimer = null;
    }
    if (alienL2SpawnTimer != null) {
      window.clearTimeout(alienL2SpawnTimer);
      alienL2SpawnTimer = null;
    }
  }

  function isHallwayScene(nextRoom = room) {
    return nextRoom?.kind === "hallway" || nextRoom?.kind === "start";
  }

  function hasLivingEnemy() {
    return enemies.some((e) => !e.defeated);
  }

  function enemyBox(enemy, x = enemy.x, y = enemy.y) {
    return {
      x: x + enemy.w * 0.18,
      y: y + enemy.h * 0.2,
      w: enemy.w * 0.64,
      h: enemy.h * 0.7,
    };
  }

  function findAlienSpawnPoint(template = window.SpaceQuestEnemies.LEVEL_ONE_ALIEN) {
    const catalog = window.SpaceQuestRooms;
    const pw = template.w;
    const ph = template.h;
    const candidates = [];

    // Prefer spawning away from the player along open corridor lanes
    if (room.movement?.axes === "vertical") {
      candidates.push(
        { x: Math.round((catalog.WIDTH - pw) / 2), y: 40 },
        { x: Math.round((catalog.WIDTH - pw) / 2), y: catalog.HEIGHT - ph - 40 }
      );
    } else {
      candidates.push(
        { x: 48, y: 250 },
        { x: catalog.WIDTH - pw - 48, y: 250 },
        { x: 48, y: 220 },
        { x: catalog.WIDTH - pw - 48, y: 280 }
      );
    }

    if (room.movement?.axes === "both") {
      candidates.push(
        { x: Math.round((catalog.WIDTH - pw) / 2), y: 40 },
        { x: Math.round((catalog.WIDTH - pw) / 2), y: catalog.HEIGHT - ph - 40 }
      );
    }

    const ranked = candidates
      .map((pos) => {
        const box = { x: pos.x + pw * 0.18, y: pos.y + ph * 0.2, w: pw * 0.64, h: ph * 0.7 };
        const blocked = collidesSolids(box, room.solids);
        const dx = pos.x + pw / 2 - (player.x + player.w / 2);
        const dy = pos.y + ph / 2 - (player.y + player.h / 2);
        const dist = Math.hypot(dx, dy);
        return { pos, blocked, dist };
      })
      .filter((entry) => !entry.blocked && entry.dist > 140)
      .sort((a, b) => b.dist - a.dist);

    if (ranked.length) return ranked[0].pos;

    // Fallback: opposite horizontal side
    const fallbackX =
      player.x < catalog.WIDTH / 2 ? catalog.WIDTH - pw - 48 : 48;
    return { x: fallbackX, y: Math.max(40, Math.min(catalog.HEIGHT - ph - 40, player.y)) };
  }

  function spawnLevelOneAlien() {
    if (!running || !isHallwayScene() || hasLivingEnemy()) return;
    const template = window.SpaceQuestEnemies.LEVEL_ONE_ALIEN;
    const point = findAlienSpawnPoint(template);
    const alien = window.SpaceQuestEnemies.createLevelOneAlien({
      x: point.x,
      y: point.y,
    });
    enemies = [alien];
  }

  function spawnLevelTwoAlien() {
    if (!running || !isHallwayScene() || hasLivingEnemy()) return;
    const template = window.SpaceQuestEnemies.LEVEL_TWO_ALIEN;
    const point = findAlienSpawnPoint(template);
    const alien = window.SpaceQuestEnemies.createLevelTwoAlien({
      x: point.x,
      y: point.y,
    });
    enemies = [alien];
  }

  function scheduleHallwayAlienSpawn() {
    clearAlienSpawnTimer();
    if (suppressAlienSpawn || !isHallwayScene()) return;

    alienSpawnTimer = window.setTimeout(() => {
      alienSpawnTimer = null;
      if (!running || !isHallwayScene() || suppressAlienSpawn) return;
      if (Math.random() < ALIEN_SPAWN_CHANCE) {
        spawnLevelOneAlien();
      }
    }, ALIEN_SPAWN_DELAY * 1000);

    // Level 2: 2/3 chance, 2 seconds after entering a normal hallway
    alienL2SpawnTimer = window.setTimeout(() => {
      alienL2SpawnTimer = null;
      if (!running || !isHallwayScene() || suppressAlienSpawn) return;
      if (Math.random() < ALIEN_L2_SPAWN_CHANCE) {
        spawnLevelTwoAlien();
      }
    }, ALIEN_L2_SPAWN_DELAY * 1000);
  }

  function spawnInfirmaryAmbush() {
    if (room?.specialType !== "infirmary") return;
    if (window.SpaceQuestInventory.hasTakenWorldPickup(INFIRMARY_AMBUSH_ID)) {
      return;
    }

    const catalog = window.SpaceQuestRooms;
    // Open center / far end so they can all path toward the door entry
    const slots = [
      { x: 360, y: 400, level: 1, order: 1 },
      { x: 520, y: 400, level: 1, order: 2 },
      { x: 440, y: 350, level: 1, order: 3 },
      { x: 340, y: 280, level: 2, order: 4 },
      { x: 540, y: 280, level: 2, order: 5 },
    ];

    enemies = slots.map((slot) => {
      const create =
        slot.level === 2
          ? window.SpaceQuestEnemies.createLevelTwoAlien
          : window.SpaceQuestEnemies.createLevelOneAlien;
      const template =
        slot.level === 2
          ? window.SpaceQuestEnemies.LEVEL_TWO_ALIEN
          : window.SpaceQuestEnemies.LEVEL_ONE_ALIEN;
      return create({
        id: `infirmary-alien-${slot.order}`,
        name: `Alien ${slot.order}`,
        combatOrder: slot.order,
        x: Math.max(16, Math.min(catalog.WIDTH - template.w - 16, slot.x)),
        y: Math.max(80, Math.min(catalog.HEIGHT - template.h - 80, slot.y)),
      });
    });
  }

  function spawnMissionControlBoss() {
    if (room?.specialType !== "mission-control") return;
    if (
      window.SpaceQuestInventory.hasTakenWorldPickup(MISSION_CONTROL_BOSS_ID)
    ) {
      return;
    }

    const catalog = window.SpaceQuestRooms;
    const template = window.SpaceQuestEnemies.BOSS_ALIEN;
    const x = Math.round((catalog.WIDTH - template.w) / 2);
    const y = Math.round((catalog.HEIGHT - template.h) / 2) - 10;
    enemies = [
      window.SpaceQuestEnemies.createBossAlien({
        id: "mission-control-boss-alien",
        name: "Boss Alien",
        combatOrder: 1,
        x,
        y,
      }),
    ];
  }

  function tryMoveEnemy(enemy, dx, dy) {
    if (dx !== 0) {
      const next = enemyBox(enemy, enemy.x + dx, enemy.y);
      const minX = 8;
      const maxX = window.SpaceQuestRooms.WIDTH - enemy.w - 8;
      const proposedX = Math.min(maxX, Math.max(minX, enemy.x + dx));
      const clamped = enemyBox(enemy, proposedX, enemy.y);
      if (!collidesSolids(clamped, room.solids)) {
        enemy.x = proposedX;
      }
    }
    if (dy !== 0) {
      const minY = 8;
      const maxY = window.SpaceQuestRooms.HEIGHT - enemy.h - 8;
      const proposedY = Math.min(maxY, Math.max(minY, enemy.y + dy));
      const clamped = enemyBox(enemy, enemy.x, proposedY);
      if (!collidesSolids(clamped, room.solids)) {
        enemy.y = proposedY;
      }
    }
  }

  function updateEnemies(dt) {
    for (const enemy of enemies) {
      if (enemy.defeated) continue;
      const cx = player.x + player.w / 2;
      const cy = player.y + player.h / 2;
      const ex = enemy.x + enemy.w / 2;
      const ey = enemy.y + enemy.h / 2;
      const dx = cx - ex;
      const dy = cy - ey;
      const dist = Math.hypot(dx, dy) || 1;
      const speed = enemy.speed || 95;
      tryMoveEnemy(enemy, (dx / dist) * speed * dt, (dy / dist) * speed * dt);
    }
  }

  function createPlayer(x, y) {
    const pw = FRAME_W * SPRITE_SCALE;
    const ph = FRAME_H * SPRITE_SCALE;
    return {
      x,
      y,
      w: pw,
      h: ph,
      facing: 1,
      moving: false,
      animTime: 0,
      frame: 0,
      hit: { ox: pw * 0.22, oy: ph * 0.58, w: pw * 0.56, h: ph * 0.36 },
      body: { ox: pw * 0.18, oy: ph * 0.2, w: pw * 0.64, h: ph * 0.7 },
    };
  }

  function defaultSpawn() {
    const catalog = window.SpaceQuestRooms;
    const pw = FRAME_W * SPRITE_SCALE;
    const ph = FRAME_H * SPRITE_SCALE;
    return {
      x: Math.round((catalog.WIDTH - pw) / 2),
      y: room.spawn?.y != null ? room.spawn.y : Math.round((catalog.HEIGHT - ph) / 2),
    };
  }

  function spawnFromEntry(entryDir) {
    const catalog = window.SpaceQuestRooms;
    const pw = FRAME_W * SPRITE_SCALE;
    const ph = FRAME_H * SPRITE_SCALE;
    const center = defaultSpawn();
    const axes = room.movement?.axes || "horizontal";
    // Junctions / door-hallways keep the player in the open cross lane
    let sideMargin = axes === "both" ? 390 : 36;
    // Special rooms spawn just inside the entry door (clear of side consoles)
    if (room.specialType === "mission-control") {
      sideMargin = 200;
    } else if (room.specialType === "escape-pod") {
      sideMargin = 56;
    }
    const endMargin = 48;

    if (!entryDir) return center;

    switch (entryDir) {
      case "left":
        return { x: sideMargin, y: center.y };
      case "right":
        return { x: catalog.WIDTH - pw - sideMargin, y: center.y };
      case "up":
        return { x: center.x, y: endMargin + 40 };
      case "down":
        return { x: center.x, y: catalog.HEIGHT - ph - endMargin - 20 };
      default:
        return center;
    }
  }

  function loadRoom(roomId, entryDir) {
    const catalog = window.SpaceQuestRooms;
    room = catalog.rooms[roomId];
    if (!room) throw new Error(`Unknown room: ${roomId}`);

    const pos = entryDir ? spawnFromEntry(entryDir) : defaultSpawn();
    player = createPlayer(pos.x, pos.y);

    enemies = [];
    corpses = [];
    propFades.clear();
    clearAlienSpawnTimer();

    window.SpaceQuestInput.setAxes(room.movement?.axes || "both");
    transitionLock = 0.2;

    if (typeof onRoomChange === "function") {
      onRoomChange(room);
    }

    if (!suppressAlienSpawn) {
      scheduleHallwayAlienSpawn();
    }
    // Room-scripted encounters (not hallway rolls). Honor post-combat suppress
    // so enemies don't pop back in on the immediate return.
    if (
      room.specialType === "infirmary" &&
      !suppressAlienSpawn &&
      !window.SpaceQuestInventory.hasTakenWorldPickup(INFIRMARY_AMBUSH_ID)
    ) {
      spawnInfirmaryAmbush();
    }
    if (
      room.specialType === "mission-control" &&
      !suppressAlienSpawn &&
      !window.SpaceQuestInventory.hasTakenWorldPickup(MISSION_CONTROL_BOSS_ID)
    ) {
      spawnMissionControlBoss();
    }
    suppressAlienSpawn = false;
  }

  function playerBox(part, x = player.x, y = player.y) {
    const box = player[part];
    return {
      x: x + box.ox,
      y: y + box.oy,
      w: box.w,
      h: box.h,
    };
  }

  function tryMove(dx, dy) {
    const catalog = window.SpaceQuestRooms;
    const exits = room.exits || {};
    let moved = false;

    if (dx !== 0) {
      // Open exits can be walked to the true screen edge for room transitions
      const minX = exits.left ? -player.w * 0.35 : 8;
      const maxX = exits.right
        ? catalog.WIDTH - player.w * 0.65
        : catalog.WIDTH - player.w - 8;
      const proposedX = Math.min(maxX, Math.max(minX, player.x + dx));
      const clamped = playerBox("hit", proposedX, player.y);
      if (!collidesSolids(clamped, room.solids) && proposedX !== player.x) {
        player.x = proposedX;
        moved = true;
      }
    }

    if (dy !== 0) {
      const minY = exits.up ? -player.h * 0.35 : 8;
      const maxY = exits.down
        ? catalog.HEIGHT - player.h * 0.65
        : catalog.HEIGHT - player.h - 8;
      const proposedY = Math.min(maxY, Math.max(minY, player.y + dy));
      const clamped = playerBox("hit", player.x, proposedY);
      if (!collidesSolids(clamped, room.solids) && proposedY !== player.y) {
        player.y = proposedY;
        moved = true;
      }
    }

    return moved;
  }

  function canEnter(roomId) {
    const target = window.SpaceQuestRooms.rooms[roomId];
    if (!target) return false;
    if (target.requiresClearId) {
      return window.SpaceQuestInventory.hasTakenWorldPickup(
        target.requiresClearId
      );
    }
    if (!target.locked) return true;
    return window.SpaceQuestInventory.hasKey(target.keyId);
  }

  function doorDirFromProp(prop) {
    if (prop.type === "door-side" || prop.type === "door-locked-side") {
      return prop.x < 100 ? "left" : "right";
    }
    if (prop.type === "door-top" || prop.type === "door-locked-top") {
      return prop.y < 40 ? "up" : "down";
    }
    return null;
  }

  function isDoorVisuallyLocked(prop) {
    const dir = doorDirFromProp(prop);
    if (!dir) return false;
    const targetId = room?.exits?.[dir];
    if (!targetId) {
      return (
        prop.type === "door-locked-side" || prop.type === "door-locked-top"
      );
    }
    return !canEnter(targetId);
  }

  function setPaused(paused) {
    interactionPaused = Boolean(paused);
    if (interactionPaused) {
      window.SpaceQuestInput.clear();
    }
  }

  function placeCorpseNearPlayer(enemyLike = {}) {
    const catalog = window.SpaceQuestRooms;
    const isBoss = enemyLike.type === "alien-boss";
    const isL2 = enemyLike.type === "alien-l2";
    const template = isBoss
      ? window.SpaceQuestEnemies?.BOSS_ALIEN || {}
      : isL2
        ? window.SpaceQuestEnemies?.LEVEL_TWO_ALIEN || {}
        : window.SpaceQuestEnemies?.LEVEL_ONE_ALIEN || {};
    // Dedicated horizontal dead sprite — scale up for hallway readability
    const drawW = isBoss ? 180 : isL2 ? 140 : 120;
    const drawH = isBoss ? 96 : isL2 ? 76 : 66;
    const facing = player?.facing >= 0 ? 1 : -1;
    let x =
      facing >= 0
        ? player.x + player.w + 14
        : player.x - drawW - 14;
    let y = player.y + Math.round(player.h * 0.45);
    x = Math.max(20, Math.min(catalog.WIDTH - drawW - 20, x));
    y = Math.max(70, Math.min(catalog.HEIGHT - drawH - 28, y));

    corpses = [
      {
        x,
        y,
        boxW: drawW,
        boxH: drawH,
        drawW,
        drawH,
        sprite:
          enemyLike.deadSprite ||
          template.deadSprite ||
          "assets/sprites/alien-l1-dead.png",
        liveSprite:
          enemyLike.sprite || template.sprite || "assets/sprites/alien-l1.png",
        searched: false,
      },
    ];
  }

  function bounceFromDir(dir) {
    const nudge = 28;
    if (dir === "left") player.x += nudge;
    if (dir === "right") player.x -= nudge;
    if (dir === "up") player.y += nudge;
    if (dir === "down") player.y -= nudge;
  }

  function attemptTransition(roomId, entryDir, fromDir) {
    if (!roomId) return null;
    if (canEnter(roomId)) {
      return { roomId, entryDir };
    }
    if (lockedDoorCooldown <= 0) {
      lockedDoorCooldown = 1.1;
      bounceFromDir(fromDir);
      if (typeof onLockedDoor === "function") {
        const target = window.SpaceQuestRooms.rooms[roomId];
        const message = target?.requiresClearId
          ? "The Escape Pod is sealed. Defeat the alien first!"
          : "This door is locked and you do not have the key.";
        onLockedDoor({
          message,
          roomId,
          roomName: target?.name || "Door",
        });
      }
    }
    return null;
  }

  function checkRoomTransition() {
    if (transitionLock > 0) return null;
    const exits = room.exits || {};
    const catalog = window.SpaceQuestRooms;
    const dir = window.SpaceQuestInput.vector();

    if (exits.left && (player.x <= EDGE || (dir.x < 0 && player.x <= EDGE + 24))) {
      return attemptTransition(exits.left, "right", "left");
    }
    if (
      exits.right &&
      (player.x + player.w >= catalog.WIDTH - EDGE ||
        (dir.x > 0 && player.x + player.w >= catalog.WIDTH - EDGE - 24))
    ) {
      return attemptTransition(exits.right, "left", "right");
    }
    if (exits.up && (player.y <= EDGE || (dir.y < 0 && player.y <= EDGE + 24))) {
      return attemptTransition(exits.up, "down", "up");
    }
    if (
      exits.down &&
      (player.y + player.h >= catalog.HEIGHT - EDGE ||
        (dir.y > 0 && player.y + player.h >= catalog.HEIGHT - EDGE - 24))
    ) {
      return attemptTransition(exits.down, "up", "down");
    }

    return null;
  }

  function checkEnemyContact() {
    const body = playerBox("body");
    for (const enemy of enemies) {
      if (enemy.defeated) continue;
      const box = { x: enemy.x, y: enemy.y, w: enemy.w, h: enemy.h };
      if (aabb(body, box)) return enemy;
    }
    return null;
  }

  function drawRoomBackdrop() {
    const { palette, movement, kind } = room;
    const { WIDTH, HEIGHT } = window.SpaceQuestRooms;
    const axes = movement?.axes || "horizontal";

    const wallGrad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    wallGrad.addColorStop(0, palette.wallDark);
    wallGrad.addColorStop(0.45, palette.wall);
    wallGrad.addColorStop(1, palette.wallDark);
    ctx.fillStyle = wallGrad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    if (kind === "special") {
      const floorGrad = ctx.createLinearGradient(0, 70, 0, HEIGHT - 70);
      floorGrad.addColorStop(0, "#4f5160");
      floorGrad.addColorStop(0.5, palette.floor);
      floorGrad.addColorStop(1, "#3b3a48");
      ctx.fillStyle = floorGrad;
      ctx.fillRect(70, 70, WIDTH - 140, HEIGHT - 140);

      ctx.strokeStyle = "rgba(15, 12, 24, 0.22)";
      ctx.lineWidth = 1;
      for (let x = 70; x < WIDTH - 70; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 70);
        ctx.lineTo(x, HEIGHT - 70);
        ctx.stroke();
      }
      for (let y = 70; y < HEIGHT - 70; y += 40) {
        ctx.beginPath();
        ctx.moveTo(70, y);
        ctx.lineTo(WIDTH - 70, y);
        ctx.stroke();
      }
    } else if (axes === "vertical") {
      const floorLeft = 220;
      const floorRight = 740;
      const floorGrad = ctx.createLinearGradient(floorLeft, 0, floorRight, 0);
      floorGrad.addColorStop(0, "#3a3746");
      floorGrad.addColorStop(0.5, palette.floor);
      floorGrad.addColorStop(1, "#3a3746");
      ctx.fillStyle = floorGrad;
      ctx.fillRect(floorLeft, 0, floorRight - floorLeft, HEIGHT);

      ctx.strokeStyle = "rgba(15, 12, 24, 0.28)";
      ctx.lineWidth = 2;
      for (let y = 0; y <= HEIGHT; y += 40) {
        ctx.beginPath();
        ctx.moveTo(floorLeft, y);
        ctx.lineTo(floorRight, y);
        ctx.stroke();
      }
      for (let x = floorLeft; x <= floorRight; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, HEIGHT);
        ctx.stroke();
      }
    } else {
      const floorTop = axes === "both" ? 120 : 150;
      const floorBottom = axes === "both" ? 420 : 390;
      const floorGrad = ctx.createLinearGradient(0, floorTop, 0, floorBottom);
      floorGrad.addColorStop(0, "#4a4658");
      floorGrad.addColorStop(0.5, palette.floor);
      floorGrad.addColorStop(1, "#3a3746");
      ctx.fillStyle = floorGrad;
      ctx.fillRect(0, floorTop, WIDTH, floorBottom - floorTop);

      ctx.strokeStyle = "rgba(15, 12, 24, 0.28)";
      ctx.lineWidth = 2;
      for (let x = 0; x <= WIDTH; x += 60) {
        ctx.beginPath();
        ctx.moveTo(x, floorTop);
        ctx.lineTo(x * 0.96 + WIDTH * 0.02, floorBottom);
        ctx.stroke();
      }
      for (let y = floorTop; y <= floorBottom; y += 28) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(WIDTH, y);
        ctx.stroke();
      }
    }

    for (const solid of room.solids) {
      const grad = ctx.createLinearGradient(
        solid.x,
        solid.y,
        solid.x,
        solid.y + solid.h
      );
      grad.addColorStop(0, "#3a516f");
      grad.addColorStop(1, palette.wallDark);
      ctx.fillStyle = grad;
      ctx.fillRect(solid.x, solid.y, solid.w, solid.h);

      ctx.fillStyle = "rgba(200, 220, 240, 0.18)";
      if (solid.w >= solid.h) {
        const rivetY =
          solid.y < HEIGHT / 2 ? solid.y + solid.h - 14 : solid.y + 10;
        for (let x = solid.x + 24; x < solid.x + solid.w; x += 36) {
          ctx.beginPath();
          ctx.arc(x, rivetY, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        const rivetX =
          solid.x < WIDTH / 2 ? solid.x + solid.w - 14 : solid.x + 10;
        for (let y = solid.y + 24; y < solid.y + solid.h; y += 36) {
          ctx.beginPath();
          ctx.arc(rivetX, y, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  function drawProps() {
    const { palette } = room;
    const pulse = room.alarm
      ? 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(alarmPhase))
      : 1;

    for (const prop of room.props) {
      if (prop.type === "panel") {
        ctx.fillStyle = palette.wallDark;
        ctx.fillRect(prop.x, prop.y, prop.w, prop.h);
        ctx.fillStyle = `rgba(62, 199, 192, ${0.35 + pulse * 0.35})`;
        ctx.fillRect(prop.x + 10, prop.y + 14, prop.w - 20, 10);
        ctx.fillStyle = palette.accentWarm;
        ctx.fillRect(prop.x + 10, prop.y + 34, prop.w - 20, 8);
        ctx.fillStyle = palette.metal;
        ctx.fillRect(
          prop.x + 10,
          prop.y + 52,
          prop.w - 20,
          Math.max(18, prop.h - 64)
        );
        ctx.strokeStyle = "rgba(255,255,255,0.08)";
        ctx.strokeRect(prop.x + 0.5, prop.y + 0.5, prop.w - 1, prop.h - 1);
      } else if (prop.type === "stripe") {
        ctx.fillStyle = "rgba(62, 199, 192, 0.22)";
        ctx.fillRect(prop.x, prop.y, prop.w, prop.h);
      } else if (prop.type === "light") {
        const glow = 0.25 + pulse * 0.75;
        ctx.fillStyle = `rgba(255, 70, 70, ${0.35 + glow * 0.4})`;
        ctx.fillRect(prop.x, prop.y, prop.w, prop.h);
        ctx.fillStyle = `rgba(255, 120, 120, ${glow})`;
        ctx.beginPath();
        ctx.ellipse(
          prop.x + prop.w / 2,
          prop.y + prop.h + 8,
          prop.w * 1.1,
          18,
          0,
          0,
          Math.PI * 2
        );
        ctx.fill();
      } else if (prop.type === "door-side" || prop.type === "door-locked-side") {
        const locked = isDoorVisuallyLocked(prop);
        ctx.fillStyle = "#0d1520";
        ctx.fillRect(prop.x, prop.y, prop.w, prop.h);
        ctx.fillStyle = locked
          ? `rgba(255, 77, 77, ${0.45 + pulse * 0.4})`
          : `rgba(62, 199, 192, ${0.35 + pulse * 0.35})`;
        ctx.fillRect(prop.x + 8, prop.y + 20, 6, prop.h - 40);
        ctx.fillStyle = palette.metal;
        ctx.fillRect(
          prop.x + (prop.x < 100 ? prop.w - 8 : 2),
          prop.y + prop.h / 2 - 10,
          6,
          20
        );
        if (locked) {
          ctx.fillStyle = "#ffd56a";
          ctx.fillRect(prop.x + 8, prop.y + prop.h / 2 - 8, 12, 16);
        }
      } else if (prop.type === "door-top" || prop.type === "door-locked-top") {
        const locked = isDoorVisuallyLocked(prop);
        ctx.fillStyle = "#0d1520";
        ctx.fillRect(prop.x, prop.y, prop.w, prop.h);
        ctx.fillStyle = locked
          ? `rgba(255, 77, 77, ${0.45 + pulse * 0.4})`
          : `rgba(62, 199, 192, ${0.35 + pulse * 0.35})`;
        ctx.fillRect(prop.x + 20, prop.y + 8, prop.w - 40, 6);
        ctx.fillStyle = palette.metal;
        ctx.fillRect(
          prop.x + prop.w / 2 - 10,
          prop.y + (prop.y < 40 ? prop.h - 8 : 2),
          20,
          6
        );
        if (locked) {
          ctx.fillStyle = "#ffd56a";
          ctx.fillRect(prop.x + prop.w / 2 - 8, prop.y + 6, 16, 12);
        }
      } else if (prop.type === "label") {
        ctx.fillStyle = "rgba(234, 242, 255, 0.85)";
        ctx.font = "700 18px Outfit, sans-serif";
        ctx.fillText(prop.text, prop.x, prop.y);
      } else if (prop.type === "counter") {
        ctx.fillStyle = "#2f415c";
        ctx.fillRect(prop.x, prop.y, prop.w, prop.h);
        ctx.fillStyle = "#3ec7c0";
        ctx.fillRect(prop.x, prop.y, prop.w, 6);
      } else if (prop.type === "table") {
        ctx.fillStyle = "#6d5844";
        ctx.fillRect(prop.x, prop.y, prop.w, prop.h);
        ctx.fillStyle = "#8a7055";
        ctx.fillRect(prop.x + 8, prop.y + 8, prop.w - 16, prop.h - 16);
      } else if (prop.type === "coffee-pot") {
        if (window.SpaceQuestInventory.hasTakenWorldPickup(prop.id)) {
          // already collected — skip drawing
        } else {
          // Pot body
          ctx.fillStyle = "#2a221c";
          ctx.fillRect(prop.x + 6, prop.y + 14, prop.w - 12, prop.h - 18);
          ctx.fillStyle = "#5c4332";
          ctx.fillRect(prop.x + 8, prop.y + 16, prop.w - 16, prop.h - 24);
          // Lid
          ctx.fillStyle = "#1a1410";
          ctx.fillRect(prop.x + 4, prop.y + 10, prop.w - 8, 8);
          ctx.fillStyle = "#c45c4a";
          ctx.fillRect(prop.x + prop.w / 2 - 4, prop.y + 4, 8, 8);
          // Handle
          ctx.strokeStyle = "#d7c4a8";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(prop.x + prop.w - 2, prop.y + 28, 8, -Math.PI / 2, Math.PI / 2);
          ctx.stroke();
          // Steam
          ctx.strokeStyle = "rgba(230, 236, 245, 0.55)";
          ctx.lineWidth = 2;
          for (let i = 0; i < 3; i += 1) {
            const sx = prop.x + 10 + i * 7;
            ctx.beginPath();
            ctx.moveTo(sx, prop.y + 4);
            ctx.quadraticCurveTo(sx + 3, prop.y - 4, sx, prop.y - 10);
            ctx.stroke();
          }
        }
      } else if (prop.type === "plasma-riffle") {
        if (window.SpaceQuestInventory.hasTakenWorldPickup(prop.id)) {
          // already collected — skip drawing
        } else {
          // Weapon rack / rifle on the back wall
          ctx.fillStyle = "#1a2434";
          ctx.fillRect(prop.x - 8, prop.y - 6, prop.w + 16, prop.h + 14);
          ctx.fillStyle = "#2c3a52";
          ctx.fillRect(prop.x - 4, prop.y - 2, prop.w + 8, 4);
          // Barrel / body
          ctx.fillStyle = "#8fa0b8";
          ctx.fillRect(prop.x, prop.y + 8, prop.w - 8, 8);
          ctx.fillStyle = "#3ec7c0";
          ctx.fillRect(prop.x + prop.w - 22, prop.y + 6, 14, 12);
          ctx.fillStyle = "#c45c4a";
          ctx.fillRect(prop.x + 10, prop.y + 10, 18, 4);
          // Stock
          ctx.fillStyle = "#5c4332";
          ctx.fillRect(prop.x + prop.w - 10, prop.y + 6, 10, 14);
          // Empty mag well marker
          ctx.fillStyle = "#ffd56a";
          ctx.fillRect(prop.x + 28, prop.y + 18, 10, 6);
        }
      } else if (prop.type === "bench") {
        ctx.fillStyle = "#3a4558";
        ctx.fillRect(prop.x, prop.y, prop.w, prop.h);
      } else if (prop.type === "dispenser") {
        ctx.fillStyle = "#1d2a3d";
        ctx.fillRect(prop.x, prop.y, prop.w, prop.h);
        ctx.fillStyle = "#e0b245";
        ctx.fillRect(prop.x + 8, prop.y + 8, prop.w - 16, 8);
      } else if (prop.type === "bunk") {
        ctx.fillStyle = "#2a3348";
        ctx.fillRect(prop.x, prop.y, prop.w, prop.h);
        ctx.fillStyle = "#4b6d8c";
        ctx.fillRect(prop.x + 10, prop.y + 12, prop.w - 20, 34);
        ctx.fillRect(prop.x + 10, prop.y + 64, prop.w - 20, 34);
        ctx.fillStyle = "#d7dee8";
        ctx.fillRect(prop.x + 16, prop.y + 18, 36, 20);
        ctx.fillRect(prop.x + 16, prop.y + 70, 36, 20);
      } else if (prop.type === "locker") {
        ctx.fillStyle = "#3a4d66";
        ctx.fillRect(prop.x, prop.y, prop.w, prop.h);
        ctx.strokeStyle = "rgba(255,255,255,0.15)";
        ctx.strokeRect(prop.x + 0.5, prop.y + 0.5, prop.w - 1, prop.h - 1);
        ctx.fillStyle = "#e0b245";
        ctx.fillRect(prop.x + prop.w - 14, prop.y + prop.h / 2 - 4, 8, 8);
      } else if (prop.type === "foot-locker") {
        // Low trunk at floor level
        ctx.fillStyle = "#3a2a1c";
        ctx.fillRect(prop.x, prop.y + 10, prop.w, prop.h - 10);
        ctx.fillStyle = "#6b4e32";
        ctx.fillRect(prop.x + 4, prop.y + 14, prop.w - 8, prop.h - 18);
        ctx.fillStyle = "#8a6a3d";
        ctx.fillRect(prop.x + 4, prop.y + 6, prop.w - 8, 12);
        ctx.fillStyle = "#c9a227";
        ctx.fillRect(prop.x + prop.w / 2 - 14, prop.y + 22, 28, 10);
        ctx.fillStyle = "#1a1410";
        ctx.fillRect(prop.x + prop.w / 2 - 3, prop.y + 24, 6, 6);
        ctx.strokeStyle = "rgba(255,255,255,0.12)";
        ctx.strokeRect(prop.x + 0.5, prop.y + 6.5, prop.w - 1, prop.h - 7);
      } else if (prop.type === "med-bed") {
        ctx.fillStyle = "#1a2e3a";
        ctx.fillRect(prop.x, prop.y + 18, prop.w, prop.h - 18);
        ctx.fillStyle = "#d7eef5";
        ctx.fillRect(prop.x + 8, prop.y + 10, prop.w - 16, prop.h - 28);
        ctx.fillStyle = "#8fd6ff";
        ctx.fillRect(prop.x + 12, prop.y + 14, 46, 28);
        ctx.fillStyle = "#2a4a5a";
        ctx.fillRect(prop.x + 6, prop.y + prop.h - 14, 16, 14);
        ctx.fillRect(prop.x + prop.w - 22, prop.y + prop.h - 14, 16, 14);
        ctx.strokeStyle = "rgba(94, 224, 216, 0.45)";
        ctx.strokeRect(prop.x + 8.5, prop.y + 10.5, prop.w - 17, prop.h - 29);
      } else if (prop.type === "med-monitor") {
        ctx.fillStyle = "#142430";
        ctx.fillRect(prop.x, prop.y, prop.w, prop.h);
        ctx.fillStyle = "#0a1820";
        ctx.fillRect(prop.x + 4, prop.y + 4, prop.w - 8, prop.h - 12);
        ctx.strokeStyle = "#5ee0d8";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(prop.x + 8, prop.y + prop.h / 2);
        ctx.quadraticCurveTo(
          prop.x + prop.w * 0.35,
          prop.y + 6,
          prop.x + prop.w * 0.5,
          prop.y + prop.h / 2
        );
        ctx.quadraticCurveTo(
          prop.x + prop.w * 0.7,
          prop.y + prop.h - 8,
          prop.x + prop.w - 8,
          prop.y + prop.h / 2
        );
        ctx.stroke();
        ctx.fillStyle = "#3a5160";
        ctx.fillRect(prop.x + prop.w / 2 - 4, prop.y + prop.h - 8, 8, 8);
      } else if (prop.type === "iv-stand") {
        ctx.fillStyle = "#9eb6c4";
        ctx.fillRect(prop.x + prop.w / 2 - 2, prop.y, 4, prop.h);
        ctx.fillStyle = "#c5dbe6";
        ctx.fillRect(prop.x - 4, prop.y, prop.w + 8, 6);
        ctx.fillStyle = "#5ee0d8";
        ctx.fillRect(prop.x + prop.w / 2 - 6, prop.y + 14, 12, 18);
        ctx.fillStyle = "#8fd6ff";
        ctx.fillRect(prop.x + prop.w / 2 - 4, prop.y + 16, 8, 12);
      } else if (prop.type === "med-cabinet") {
        ctx.fillStyle = "#244556";
        ctx.fillRect(prop.x, prop.y, prop.w, prop.h);
        ctx.fillStyle = "#316072";
        ctx.fillRect(prop.x + 4, prop.y + 4, prop.w - 8, prop.h - 8);
        ctx.strokeStyle = "rgba(143, 214, 255, 0.35)";
        ctx.strokeRect(prop.x + 4.5, prop.y + 4.5, prop.w - 9, prop.h - 9);
        ctx.fillStyle = "#5ee0d8";
        ctx.fillRect(prop.x + prop.w - 14, prop.y + prop.h / 2 - 4, 6, 8);
        ctx.fillStyle = "#ff6b6b";
        ctx.fillRect(prop.x + 12, prop.y + 16, 18, 6);
        ctx.fillRect(prop.x + 18, prop.y + 10, 6, 18);
      } else if (prop.type === "med-scanner") {
        ctx.fillStyle = "#1a3340";
        ctx.fillRect(prop.x, prop.y, prop.w, prop.h);
        ctx.fillStyle = "#5ee0d8";
        ctx.globalAlpha = 0.35;
        ctx.fillRect(prop.x + 8, prop.y + 8, prop.w - 16, prop.h - 16);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "#8fd6ff";
        ctx.strokeRect(prop.x + 6.5, prop.y + 6.5, prop.w - 13, prop.h - 13);
      } else if (prop.type === "med-cross") {
        ctx.fillStyle = "rgba(255, 90, 90, 0.9)";
        ctx.fillRect(prop.x + prop.w / 2 - 8, prop.y, 16, prop.h);
        ctx.fillRect(prop.x, prop.y + prop.h / 2 - 8, prop.w, 16);
      } else if (prop.type === "key-card") {
        if (window.SpaceQuestInventory.hasTakenWorldPickup(prop.id)) {
          // already collected
        } else {
          ctx.fillStyle = "rgba(0,0,0,0.28)";
          ctx.beginPath();
          ctx.ellipse(
            prop.x + prop.w / 2,
            prop.y + prop.h - 2,
            prop.w * 0.42,
            6,
            0,
            0,
            Math.PI * 2
          );
          ctx.fill();
          ctx.fillStyle = "#e8f4ff";
          ctx.fillRect(prop.x, prop.y + 6, prop.w, prop.h - 10);
          ctx.fillStyle = "#3ec7c0";
          ctx.fillRect(prop.x + 4, prop.y + 10, prop.w - 8, 10);
          ctx.fillStyle = "#e0b245";
          ctx.fillRect(prop.x + prop.w - 16, prop.y + 22, 10, 8);
          ctx.strokeStyle = "rgba(20, 40, 60, 0.45)";
          ctx.strokeRect(prop.x + 0.5, prop.y + 6.5, prop.w - 1, prop.h - 11);
        }
      } else if (prop.type === "holo-screen") {
        ctx.fillStyle = "#0a1420";
        ctx.fillRect(prop.x, prop.y, prop.w, prop.h);
        ctx.fillStyle = "rgba(79, 208, 255, 0.18)";
        ctx.fillRect(prop.x + 8, prop.y + 8, prop.w - 16, prop.h - 16);
        ctx.strokeStyle = `rgba(79, 208, 255, ${0.35 + pulse * 0.4})`;
        ctx.strokeRect(prop.x + 8.5, prop.y + 8.5, prop.w - 17, prop.h - 17);
        ctx.fillStyle = `rgba(79, 208, 255, ${0.55 + pulse * 0.35})`;
        ctx.font = "600 14px Outfit, sans-serif";
        ctx.fillText("SECTOR STATUS — CRITICAL", prop.x + 24, prop.y + 36);
        ctx.fillStyle = "rgba(255, 90, 90, 0.85)";
        ctx.fillText("CREW SIGNAL: LOST", prop.x + 24, prop.y + 58);
      } else if (prop.type === "command-chair") {
        ctx.fillStyle = "#1a2434";
        ctx.fillRect(prop.x + 16, prop.y + 30, prop.w - 32, prop.h - 30);
        ctx.fillStyle = "#2c3a52";
        ctx.fillRect(prop.x + 10, prop.y + 10, prop.w - 20, 28);
        ctx.fillStyle = "#4fd0ff";
        ctx.globalAlpha = 0.35;
        ctx.fillRect(prop.x + 22, prop.y + 16, prop.w - 44, 10);
        ctx.globalAlpha = 1;
      } else if (prop.type === "floor-ring") {
        ctx.strokeStyle = "rgba(79, 208, 255, 0.28)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(
          prop.x + prop.w / 2,
          prop.y + prop.h / 2,
          prop.w / 2,
          prop.h / 2,
          0,
          0,
          Math.PI * 2
        );
        ctx.stroke();
        ctx.strokeStyle = "rgba(224, 178, 69, 0.2)";
        ctx.beginPath();
        ctx.ellipse(
          prop.x + prop.w / 2,
          prop.y + prop.h / 2,
          prop.w / 2 - 16,
          prop.h / 2 - 12,
          0,
          0,
          Math.PI * 2
        );
        ctx.stroke();
        ctx.lineWidth = 1;
      } else if (prop.type === "pod-bay") {
        ctx.fillStyle = "#132430";
        ctx.fillRect(prop.x, prop.y, prop.w, prop.h);
        ctx.strokeStyle = "rgba(94, 224, 216, 0.45)";
        ctx.strokeRect(prop.x + 0.5, prop.y + 0.5, prop.w - 1, prop.h - 1);
        ctx.fillStyle = "rgba(94, 224, 216, 0.12)";
        ctx.beginPath();
        ctx.ellipse(
          prop.x + prop.w / 2,
          prop.y + prop.h / 2,
          prop.w * 0.32,
          prop.h * 0.38,
          0,
          0,
          Math.PI * 2
        );
        ctx.fill();
        ctx.strokeStyle = "rgba(94, 224, 216, 0.55)";
        ctx.stroke();
      } else if (prop.type === "dead-astronaut") {
        const facing = prop.facing >= 0 ? 1 : -1;
        const cx = prop.x + prop.w / 2;
        const cy = prop.y + prop.h / 2;
        // Blood pool
        ctx.fillStyle = "rgba(120, 18, 28, 0.55)";
        ctx.beginPath();
        ctx.ellipse(cx, prop.y + prop.h - 4, prop.w * 0.55, 14, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(160, 30, 40, 0.4)";
        ctx.beginPath();
        ctx.ellipse(
          cx + facing * 10,
          prop.y + prop.h - 2,
          prop.w * 0.35,
          9,
          0.2,
          0,
          Math.PI * 2
        );
        ctx.fill();
        // Body
        ctx.save();
        if (facing < 0) {
          ctx.translate(cx, cy);
          ctx.scale(-1, 1);
          ctx.translate(-cx, -cy);
        }
        ctx.fillStyle = "#c5ccd8";
        ctx.fillRect(prop.x + 16, prop.y + 14, prop.w - 28, 18);
        ctx.fillStyle = "#7b8799";
        ctx.fillRect(prop.x + 16, prop.y + 26, prop.w - 28, 8);
        ctx.fillStyle = "#2c3a52";
        ctx.fillRect(prop.x + prop.w - 18, prop.y + 16, 12, 16);
        ctx.fillStyle = "#e8b896";
        ctx.fillRect(prop.x + 4, prop.y + 12, 14, 14);
        ctx.fillStyle = "#d8e2f0";
        ctx.beginPath();
        ctx.arc(prop.x + 11, prop.y + 10, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.25)";
        ctx.stroke();
        // Visor crack / dark
        ctx.fillStyle = "rgba(20, 30, 40, 0.75)";
        ctx.fillRect(prop.x + 7, prop.y + 7, 8, 5);
        ctx.restore();
      } else if (prop.type === "wounded-crewmate") {
        const taken = window.SpaceQuestInventory.hasTakenWorldPickup(prop.id);
        const fade = propFades.get(prop.id);
        if (taken && !fade) {
          // Spoken with and fully faded — gone from the room
        } else {
          const alpha = fade ? fade.alpha : 1;
          ctx.save();
          ctx.globalAlpha = alpha;
          // Shadow
          ctx.fillStyle = "rgba(0,0,0,0.28)";
          ctx.beginPath();
          ctx.ellipse(
            prop.x + prop.w / 2,
            prop.y + prop.h - 2,
            prop.w * 0.4,
            6,
            0,
            0,
            Math.PI * 2
          );
          ctx.fill();
          // Blood stain under body
          ctx.fillStyle = "rgba(140, 30, 40, 0.45)";
          ctx.beginPath();
          ctx.ellipse(
            prop.x + prop.w * 0.45,
            prop.y + prop.h - 6,
            22,
            8,
            0,
            0,
            Math.PI * 2
          );
          ctx.fill();
          // Body / suit (lying on side)
          ctx.fillStyle = "#d8dde8";
          ctx.fillRect(prop.x + 18, prop.y + 16, 52, 22);
          ctx.fillStyle = "#9aa7bc";
          ctx.fillRect(prop.x + 18, prop.y + 26, 52, 8);
          // Legs
          ctx.fillStyle = "#2c3a52";
          ctx.fillRect(prop.x + 66, prop.y + 18, 14, 18);
          // Head
          ctx.fillStyle = "#f0c9a0";
          ctx.fillRect(prop.x + 4, prop.y + 14, 16, 16);
          ctx.fillStyle = "#e0b245";
          ctx.fillRect(prop.x + 4, prop.y + 12, 16, 6);
          // Closed eyes / pain
          ctx.fillStyle = "#3a2a1c";
          ctx.fillRect(prop.x + 7, prop.y + 20, 4, 2);
          ctx.fillRect(prop.x + 13, prop.y + 20, 4, 2);
          // Wound on torso
          ctx.fillStyle = "#a8323a";
          ctx.fillRect(prop.x + 34, prop.y + 20, 12, 8);
          // Weak arm reaching
          ctx.fillStyle = "#f0c9a0";
          ctx.fillRect(prop.x + 28, prop.y + 34, 10, 8);
          ctx.restore();
        }
      } else if (prop.type === "shelf") {
        ctx.fillStyle = "#2c3a4f";
        ctx.fillRect(prop.x, prop.y, prop.w, prop.h);
        for (let y = prop.y + 24; y < prop.y + prop.h - 10; y += 36) {
          ctx.fillStyle = "#8fa0b8";
          ctx.fillRect(prop.x + 6, y, prop.w - 12, 6);
          ctx.fillStyle = "#c45c4a";
          ctx.fillRect(prop.x + 10, y - 16, 18, 14);
          ctx.fillStyle = "#3ec7c0";
          ctx.fillRect(prop.x + 34, y - 16, 18, 14);
        }
      } else if (prop.type === "crate") {
        ctx.fillStyle = "#8a6a3d";
        ctx.fillRect(prop.x, prop.y, prop.w, prop.h);
        ctx.strokeStyle = "rgba(30, 20, 10, 0.45)";
        ctx.strokeRect(prop.x + 0.5, prop.y + 0.5, prop.w - 1, prop.h - 1);
        ctx.beginPath();
        ctx.moveTo(prop.x, prop.y);
        ctx.lineTo(prop.x + prop.w, prop.y + prop.h);
        ctx.moveTo(prop.x + prop.w, prop.y);
        ctx.lineTo(prop.x, prop.y + prop.h);
        ctx.stroke();
      } else if (prop.type === "tank") {
        ctx.fillStyle = "#2a3a52";
        ctx.fillRect(prop.x, prop.y, prop.w, prop.h);
        ctx.fillStyle = "#1a2538";
        ctx.fillRect(prop.x + 8, prop.y + 12, prop.w - 16, prop.h - 24);
        const glow = ctx.createLinearGradient(
          prop.x,
          prop.y,
          prop.x,
          prop.y + prop.h
        );
        glow.addColorStop(0, "rgba(255, 140, 60, 0.15)");
        glow.addColorStop(0.55, "rgba(255, 90, 40, 0.45)");
        glow.addColorStop(1, "rgba(255, 60, 30, 0.2)");
        ctx.fillStyle = glow;
        ctx.fillRect(prop.x + 14, prop.y + 20, prop.w - 28, prop.h - 40);
        ctx.fillStyle = palette.metal;
        ctx.fillRect(prop.x + 6, prop.y + 6, prop.w - 12, 8);
        ctx.fillRect(prop.x + 6, prop.y + prop.h - 14, prop.w - 12, 8);
        ctx.fillStyle = "#e0b245";
        ctx.fillRect(prop.x + prop.w / 2 - 8, prop.y + 22, 16, 10);
      } else if (prop.type === "reactor") {
        ctx.fillStyle = "#182338";
        ctx.fillRect(prop.x, prop.y, prop.w, prop.h);
        ctx.strokeStyle = "rgba(148, 210, 230, 0.35)";
        ctx.lineWidth = 2;
        ctx.strokeRect(prop.x + 4, prop.y + 4, prop.w - 8, prop.h - 8);
        const core = ctx.createRadialGradient(
          prop.x + prop.w / 2,
          prop.y + prop.h / 2,
          12,
          prop.x + prop.w / 2,
          prop.y + prop.h / 2,
          prop.w * 0.42
        );
        core.addColorStop(0, "rgba(255, 220, 120, 0.95)");
        core.addColorStop(0.45, "rgba(255, 120, 40, 0.75)");
        core.addColorStop(1, "rgba(80, 30, 20, 0.2)");
        ctx.fillStyle = core;
        ctx.beginPath();
        ctx.ellipse(
          prop.x + prop.w / 2,
          prop.y + prop.h / 2,
          prop.w * 0.28,
          prop.h * 0.34,
          0,
          0,
          Math.PI * 2
        );
        ctx.fill();
        ctx.fillStyle = "rgba(62, 199, 192, 0.55)";
        for (let i = 0; i < 4; i += 1) {
          const yy = prop.y + 28 + i * 56;
          ctx.fillRect(prop.x + 16, yy, prop.w - 32, 8);
        }
        ctx.fillStyle = "#ffd56a";
        ctx.font = "700 14px Outfit, sans-serif";
        ctx.fillText("DRIVE CORE", prop.x + 48, prop.y + 28);
      } else if (prop.type === "console") {
        ctx.fillStyle = "#24344c";
        ctx.fillRect(prop.x, prop.y, prop.w, prop.h);
        ctx.fillStyle = "#0d1520";
        ctx.fillRect(prop.x + 10, prop.y + 10, prop.w - 20, prop.h - 28);
        ctx.fillStyle = `rgba(62, 199, 192, ${0.45 + pulse * 0.35})`;
        ctx.fillRect(prop.x + 16, prop.y + 16, prop.w - 32, 10);
        ctx.fillStyle = palette.accentWarm;
        ctx.fillRect(prop.x + 16, prop.y + 32, 28, 8);
        ctx.fillStyle = "#ff6b4a";
        ctx.fillRect(prop.x + 52, prop.y + 32, 18, 8);
        ctx.fillStyle = palette.metal;
        ctx.fillRect(prop.x + 8, prop.y + prop.h - 14, prop.w - 16, 8);
      } else if (prop.type === "pipe" || prop.type === "pipe-vert") {
        ctx.fillStyle = "#6d7f96";
        ctx.fillRect(prop.x, prop.y, prop.w, prop.h);
        ctx.fillStyle = "rgba(255,255,255,0.18)";
        if (prop.type === "pipe") {
          ctx.fillRect(prop.x, prop.y + 3, prop.w, 4);
        } else {
          ctx.fillRect(prop.x + 3, prop.y, 4, prop.h);
        }
        ctx.fillStyle = "#e0b245";
        if (prop.type === "pipe") {
          for (let x = prop.x + 20; x < prop.x + prop.w; x += 48) {
            ctx.fillRect(x, prop.y - 2, 10, prop.h + 4);
          }
        } else {
          for (let y = prop.y + 20; y < prop.y + prop.h; y += 48) {
            ctx.fillRect(prop.x - 2, y, prop.w + 4, 10);
          }
        }
      } else if (prop.type === "thruster") {
        ctx.fillStyle = "#1c283c";
        ctx.fillRect(prop.x, prop.y, prop.w, prop.h);
        const plume = ctx.createLinearGradient(
          prop.x,
          prop.y,
          prop.x + prop.w,
          prop.y
        );
        plume.addColorStop(0, "rgba(255, 200, 80, 0.15)");
        plume.addColorStop(0.5, "rgba(255, 110, 40, 0.7)");
        plume.addColorStop(1, "rgba(80, 140, 255, 0.35)");
        ctx.fillStyle = plume;
        ctx.fillRect(prop.x + 8, prop.y + 8, prop.w - 16, prop.h - 16);
        ctx.fillStyle = palette.metal;
        ctx.fillRect(prop.x + 4, prop.y + 4, 10, prop.h - 8);
        ctx.fillRect(prop.x + prop.w - 14, prop.y + 4, 10, prop.h - 8);
      } else if (prop.type === "hazard") {
        ctx.fillStyle = "#1a1a1a";
        ctx.fillRect(prop.x, prop.y, prop.w, prop.h);
        ctx.fillStyle = "#e0b245";
        for (let x = prop.x; x < prop.x + prop.w; x += 28) {
          ctx.beginPath();
          ctx.moveTo(x, prop.y + prop.h);
          ctx.lineTo(x + 14, prop.y);
          ctx.lineTo(x + 28, prop.y);
          ctx.lineTo(x + 14, prop.y + prop.h);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
  }

  function drawAlarmWash() {
    if (!room.alarm) return;
    const intensity = 0.08 + 0.14 * (0.5 + 0.5 * Math.sin(alarmPhase));
    const { WIDTH, HEIGHT } = window.SpaceQuestRooms;
    const wash = ctx.createRadialGradient(
      WIDTH / 2,
      120,
      40,
      WIDTH / 2,
      HEIGHT / 2,
      HEIGHT * 0.85
    );
    wash.addColorStop(0, `rgba(255, 60, 60, ${intensity + 0.08})`);
    wash.addColorStop(1, `rgba(255, 40, 40, 0)`);
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = `rgba(120, 20, 20, ${intensity * 0.55})`;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  function updatePlayerAnim(dt, dirX) {
    if (dirX < 0) player.facing = -1;
    if (dirX > 0) player.facing = 1;

    if (player.moving) {
      player.animTime += dt;
      player.frame = 1 + (Math.floor(player.animTime * WALK_FPS) % 3);
    } else {
      player.animTime = 0;
      player.frame = 0;
    }
  }

  function drawPlayer() {
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(
      player.x + player.w / 2,
      player.y + player.h - 2,
      player.w * 0.3,
      7,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();

    const bob = player.moving ? Math.sin(player.animTime * WALK_FPS * Math.PI) * 2 : 0;

    ctx.save();
    if (player.facing < 0) {
      ctx.translate(player.x + player.w, player.y + bob);
      ctx.scale(-1, 1);
      ctx.drawImage(
        playerSheet,
        player.frame * FRAME_W,
        0,
        FRAME_W,
        FRAME_H,
        0,
        0,
        player.w,
        player.h
      );
    } else {
      ctx.drawImage(
        playerSheet,
        player.frame * FRAME_W,
        0,
        FRAME_W,
        FRAME_H,
        player.x,
        player.y + bob,
        player.w,
        player.h
      );
    }
    ctx.restore();
  }

  function isAutoTalkAvailable(prop) {
    if (!prop?.autoTalk || !prop.id || !prop.dialogue) return false;
    return !window.SpaceQuestInventory.hasTakenWorldPickup(prop.id);
  }

  function beginPropFade(propId, durationSec = 2.4) {
    if (!propId) return;
    propFades.set(propId, {
      alpha: 1,
      duration: durationSec,
      elapsed: 0,
    });
  }

  function updatePropFades(dt) {
    for (const [id, state] of [...propFades.entries()]) {
      state.elapsed += dt;
      state.alpha = Math.max(0, 1 - state.elapsed / state.duration);
      if (state.alpha <= 0) {
        propFades.delete(id);
      }
    }
  }

  function checkAutoTalk() {
    if (!room || !player || interactionPaused) return;
    const body = playerBox("body");
    for (const prop of room.props || []) {
      if (!isAutoTalkAvailable(prop)) continue;
      const reach = prop.talkReach != null ? prop.talkReach : 32;
      const box = {
        x: prop.x - reach,
        y: prop.y - reach,
        w: prop.w + reach * 2,
        h: prop.h + reach * 2,
      };
      if (!aabb(body, box)) continue;

      const inv = window.SpaceQuestInventory;
      if (!inv.takeWorldPickup(prop.id)) return;
      if (prop.givesItemId) inv.addItem(prop.givesItemId);
      setPaused(true);
      hideInteractPrompt();
      if (typeof onInteract === "function") {
        onInteract({
          type: "dialogue",
          id: prop.id,
          message: prop.dialogue,
          itemId: prop.givesItemId || null,
          fadeAfter: true,
        });
      }
      return;
    }
  }

  function isPickupAvailable(prop) {
    if (!prop?.itemId || !prop.id) return false;
    return !window.SpaceQuestInventory.hasTakenWorldPickup(prop.id);
  }

  function isInteractable(prop) {
    if (!prop) return false;
    if (prop.autoTalk) return false;
    if (isPickupAvailable(prop)) return true;
    if (prop.requiresKeyId && prop.id) {
      // Already opened/looted — no further interaction
      if (window.SpaceQuestInventory.hasTakenWorldPickup(prop.id)) return false;
      return true;
    }
    if (prop.interactLabel && prop.id && !prop.itemId) return true;
    return false;
  }

  function getNearbyInteractable() {
    if (!room || !player || interactionPaused) return null;
    const body = playerBox("body");
    const reach = 52;
    for (const prop of room.props || []) {
      if (!isInteractable(prop)) continue;
      const box = {
        x: prop.x - reach,
        y: prop.y - reach,
        w: prop.w + reach * 2,
        h: prop.h + reach * 2,
      };
      if (aabb(body, box)) return prop;
    }
    return null;
  }

  function updateInteractPrompt() {
    nearbyInteractable = getNearbyInteractable();
    if (!interactBtn) return;
    if (nearbyInteractable) {
      interactBtn.hidden = false;
      interactBtn.textContent =
        nearbyInteractable.interactLabel ||
        nearbyInteractable.pickupLabel ||
        "Interact";
    } else {
      interactBtn.hidden = true;
    }
  }

  function hideInteractPrompt() {
    nearbyInteractable = null;
    if (interactBtn) interactBtn.hidden = true;
  }

  function tryInteract() {
    const prop = nearbyInteractable || getNearbyInteractable();
    if (!prop) return false;
    const inv = window.SpaceQuestInventory;

    // Locked container (e.g. Lodging foot locker)
    if (prop.requiresKeyId) {
      if (inv.hasTakenWorldPickup(prop.id)) return false;
      if (!inv.hasKey(prop.requiresKeyId)) {
        if (typeof onInteract === "function") {
          onInteract({
            type: "locked",
            id: prop.id,
            message: prop.lockedMessage || "The locker needs a key.",
          });
        }
        return true;
      }

      // One-time open: mark looted and grant contents
      inv.takeWorldPickup(prop.id);
      if (prop.containsItemId) {
        inv.addItem(prop.containsItemId);
      }
      hideInteractPrompt();
      if (typeof onInteract === "function") {
        onInteract({
          type: "opened",
          id: prop.id,
          itemId: prop.containsItemId || null,
          message:
            prop.openMessage ||
            (prop.containsItemId
              ? "You open the locker and find something useful."
              : "The locker opens."),
        });
      }
      return true;
    }

    // World item pickup
    if (!prop.itemId || !prop.id) return false;
    if (!inv.takeWorldPickup(prop.id)) return false;
    inv.addItem(prop.itemId);
    hideInteractPrompt();
    if (typeof onPickup === "function") {
      onPickup({
        pickupId: prop.id,
        itemId: prop.itemId,
        label: prop.pickupLabel,
        message: prop.pickupMessage || null,
      });
    }
    return true;
  }

  function movementHint() {
    const axes = room.movement?.axes;
    if (axes === "horizontal") return "Move with ← → Arrow Keys";
    if (axes === "vertical") return "Move with ↑ ↓ Arrow Keys";
    return "Move with Arrow Keys";
  }

  function drawCorpses() {
    for (const corpse of corpses) {
      // Floor shadow
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath();
      ctx.ellipse(
        corpse.x + corpse.boxW / 2,
        corpse.y + corpse.boxH - 2,
        corpse.boxW * 0.42,
        8,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();

      const img = spriteImage(corpse.sprite, enemyDeadImage || enemyImage);
      if (!img) continue;

      ctx.save();
      ctx.globalAlpha = 1;
      ctx.drawImage(img, corpse.x, corpse.y, corpse.drawW, corpse.drawH);
      ctx.restore();
    }
  }

  function drawActors() {
    drawCorpses();

    for (const enemy of enemies) {
      if (enemy.defeated) continue;
      enemy.bob += 0.04;
      const oy = Math.sin(enemy.bob) * 3;
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.beginPath();
      ctx.ellipse(
        enemy.x + enemy.w / 2,
        enemy.y + enemy.h + 4,
        enemy.w * 0.35,
        6,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();
      const img = spriteImage(enemy.sprite, enemyImage);
      ctx.drawImage(img, enemy.x, enemy.y + oy, enemy.w, enemy.h);
    }

    drawPlayer();

    ctx.fillStyle = "rgba(7, 12, 24, 0.55)";
    ctx.fillRect(16, 16, 260, 36);
    ctx.strokeStyle = room.alarm
      ? `rgba(255, 90, 90, ${0.4 + 0.4 * (0.5 + 0.5 * Math.sin(alarmPhase))})`
      : "rgba(62, 199, 192, 0.5)";
    ctx.strokeRect(16.5, 16.5, 259, 35);
    ctx.fillStyle = "#eaf2ff";
    ctx.font = "600 16px Outfit, sans-serif";
    const title =
      room.name.length > 22 ? `${room.name.slice(0, 20)}…` : room.name;
    ctx.fillText(title, 28, 40);

    ctx.fillStyle = "rgba(234, 242, 255, 0.75)";
    ctx.font = "500 13px Outfit, sans-serif";
    ctx.fillText(movementHint(), 16, window.SpaceQuestRooms.HEIGHT - 18);
  }

  function frame(time) {
    if (!running) return;
    const dt = Math.min((time - lastTime) / 1000, 0.05);
    lastTime = time;

    if (transitionLock > 0) transitionLock -= dt;
    if (lockedDoorCooldown > 0) lockedDoorCooldown -= dt;
    if (room.alarm) alarmPhase += dt * 3.2;
    updatePropFades(dt);

    if (!interactionPaused) {
      const dir = window.SpaceQuestInput.vector();
      const moved = tryMove(dir.x * PLAYER_SPEED * dt, dir.y * PLAYER_SPEED * dt);
      player.moving = moved && (dir.x !== 0 || dir.y !== 0);
      updatePlayerAnim(dt, dir.x);
      updateEnemies(dt);
      updateInteractPrompt();
      checkAutoTalk();

      const transition = checkRoomTransition();
      if (transition) {
        hideInteractPrompt();
        // Keep held keys so walking continues across hallway transitions
        loadRoom(transition.roomId, transition.entryDir);
      }

      const touched = checkEnemyContact();
      if (touched) {
        clearAlienSpawnTimer();
        hideInteractPrompt();
        stop();
        if (typeof onCombat === "function") {
          const wave = enemies
            .filter((e) => !e.defeated)
            .slice()
            .sort(
              (a, b) => (a.combatOrder || 0) - (b.combatOrder || 0)
            );
          onCombat({
            enemy: wave[0] || touched,
            enemies: wave.length ? wave : [touched],
            roomId: room.id,
            player: { x: player.x, y: player.y },
          });
        }
        return;
      }
    } else {
      player.moving = false;
      updatePlayerAnim(dt, 0);
      hideInteractPrompt();
    }

    drawRoomBackdrop();
    drawProps();
    drawActors();
    drawAlarmWash();
    rafId = requestAnimationFrame(frame);
  }

  async function start(options = {}) {
    canvas = options.canvas;
    ctx = canvas.getContext("2d");
    onCombat = options.onCombat;
    onRoomChange = options.onRoomChange;
    onLockedDoor = options.onLockedDoor;
    onPickup = options.onPickup || null;
    onInteract = options.onInteract || null;
    interactBtn = options.interactBtn || document.getElementById("interact-btn");

    if (interactBtn && !interactBtn.dataset.bound) {
      interactBtn.addEventListener("click", (event) => {
        event.preventDefault();
        tryInteract();
      });
      interactBtn.dataset.bound = "true";
    }

    const catalog = window.SpaceQuestRooms;
    canvas.width = catalog.WIDTH;
    canvas.height = catalog.HEIGHT;

    await prepareAssets();
    interactionPaused = false;
    hideInteractPrompt();
    // After winning a fight, skip an immediate re-roll in the same room visit
    suppressAlienSpawn = Boolean(options.defeatedEnemyId);
    loadRoom(options.roomId || catalog.startRoomId, options.entryDir || null);

    if (options.resumePosition) {
      player.x = options.resumePosition.x;
      player.y = options.resumePosition.y;
    }

    if (options.placeCorpse) {
      placeCorpseNearPlayer(options.placeCorpse);
    }

    window.SpaceQuestInput.bind();
    window.SpaceQuestInput.clear();
    running = true;
    alarmPhase = 0;
    lastTime = performance.now();
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(frame);

    if (typeof options.onSceneReady === "function") {
      options.onSceneReady({
        room,
        player,
        corpses,
      });
    }
  }

  function stop() {
    running = false;
    interactionPaused = false;
    hideInteractPrompt();
    clearAlienSpawnTimer();
    cancelAnimationFrame(rafId);
    window.SpaceQuestInput.unbind();
  }

  function getRoom() {
    return room;
  }

  function markCorpseSearched() {
    corpses.forEach((corpse) => {
      corpse.searched = true;
    });
  }

  function getCorpses() {
    return corpses.map((c) => ({ ...c }));
  }

  return {
    start,
    stop,
    getRoom,
    setPaused,
    markCorpseSearched,
    getCorpses,
    tryInteract,
    beginPropFade,
  };
})();
