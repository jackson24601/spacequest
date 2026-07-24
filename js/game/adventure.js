window.SpaceQuestAdventure = (() => {
  const SPRITE_SCALE = 2;
  const PLAYER_SPEED = 170;

  let canvas;
  let ctx;
  let running = false;
  let lastTime = 0;
  let rafId = 0;
  let room;
  let player;
  let enemies = [];
  let playerImage;
  let enemyImage;
  let onCombat;
  let assetsReady = false;

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
    if (assetsReady) return;
    [playerImage, enemyImage] = await Promise.all([
      loadImage("assets/sprites/player.png"),
      loadImage("assets/sprites/enemy.png"),
    ]);
    assetsReady = true;
  }

  function loadRoom(roomId) {
    const catalog = window.SpaceQuestRooms;
    room = catalog.rooms[roomId];
    if (!room) throw new Error(`Unknown room: ${roomId}`);

    const pw = playerImage.width * SPRITE_SCALE;
    const ph = playerImage.height * SPRITE_SCALE;

    player = {
      x: room.spawn.x,
      y: room.spawn.y,
      w: pw,
      h: ph,
      // Feet-focused hitbox for tighter corridor feel
      hit: { ox: pw * 0.2, oy: ph * 0.55, w: pw * 0.6, h: ph * 0.4 },
    };

    enemies = room.enemies.map((enemy) => ({
      ...enemy,
      defeated: false,
      bob: Math.random() * Math.PI * 2,
    }));
  }

  function playerHitbox(x = player.x, y = player.y) {
    return {
      x: x + player.hit.ox,
      y: y + player.hit.oy,
      w: player.hit.w,
      h: player.hit.h,
    };
  }

  function tryMove(dx, dy) {
    if (dx !== 0) {
      const next = playerHitbox(player.x + dx, player.y);
      if (!collidesSolids(next, room.solids)) {
        player.x += dx;
      }
    }
    if (dy !== 0) {
      const next = playerHitbox(player.x, player.y + dy);
      if (!collidesSolids(next, room.solids)) {
        player.y += dy;
      }
    }
  }

  function checkEnemyContact() {
    const hit = playerHitbox();
    for (const enemy of enemies) {
      if (enemy.defeated) continue;
      const box = { x: enemy.x, y: enemy.y, w: enemy.w, h: enemy.h };
      if (aabb(hit, box)) {
        return enemy;
      }
    }
    return null;
  }

  function drawRoom() {
    const { palette } = room;
    const { WIDTH, HEIGHT } = window.SpaceQuestRooms;

    // Floor
    ctx.fillStyle = palette.floor;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Floor tile lines
    ctx.strokeStyle = "rgba(20, 16, 30, 0.18)";
    ctx.lineWidth = 1;
    for (let x = 0; x < WIDTH; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y < HEIGHT; y += 48) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WIDTH, y);
      ctx.stroke();
    }

    // Solids / walls
    for (const solid of room.solids) {
      const grad = ctx.createLinearGradient(
        solid.x,
        solid.y,
        solid.x,
        solid.y + solid.h
      );
      grad.addColorStop(0, palette.wall);
      grad.addColorStop(1, palette.wallDark);
      ctx.fillStyle = grad;
      ctx.fillRect(solid.x, solid.y, solid.w, solid.h);
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.strokeRect(solid.x + 0.5, solid.y + 0.5, solid.w - 1, solid.h - 1);
    }

    // Props
    for (const prop of room.props) {
      if (prop.type === "panel") {
        ctx.fillStyle = palette.wallDark;
        ctx.fillRect(prop.x, prop.y, prop.w, prop.h);
        ctx.fillStyle = palette.accent;
        ctx.fillRect(prop.x + 10, prop.y + 14, prop.w - 20, 10);
        ctx.fillStyle = palette.accentWarm;
        ctx.fillRect(prop.x + 10, prop.y + 34, prop.w - 20, 8);
        ctx.fillStyle = palette.metal;
        ctx.fillRect(prop.x + 10, prop.y + 52, prop.w - 20, 28);
      } else if (prop.type === "door") {
        ctx.fillStyle = "#101820";
        ctx.fillRect(prop.x, prop.y, prop.w, prop.h);
        ctx.fillStyle = palette.accent;
        ctx.fillRect(prop.x + 8, prop.y + 4, prop.w - 16, 4);
      } else if (prop.type === "stripe") {
        ctx.fillStyle = "rgba(62, 199, 192, 0.25)";
        ctx.fillRect(prop.x, prop.y, prop.w, prop.h);
      }
    }
  }

  function drawActors(time) {
    for (const enemy of enemies) {
      if (enemy.defeated) continue;
      enemy.bob += 0.04;
      const oy = Math.sin(enemy.bob) * 3;
      ctx.drawImage(
        enemyImage,
        enemy.x,
        enemy.y + oy,
        enemy.w,
        enemy.h
      );
      // Soft shadow
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
    }

    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.ellipse(
      player.x + player.w / 2,
      player.y + player.h - 2,
      player.w * 0.28,
      7,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();

    ctx.drawImage(playerImage, player.x, player.y, player.w, player.h);

    // Room label
    ctx.fillStyle = "rgba(7, 12, 24, 0.55)";
    ctx.fillRect(16, 16, 220, 36);
    ctx.strokeStyle = "rgba(62, 199, 192, 0.5)";
    ctx.strokeRect(16.5, 16.5, 219, 35);
    ctx.fillStyle = "#eaf2ff";
    ctx.font = "600 16px Outfit, sans-serif";
    ctx.fillText(room.name, 28, 40);

    // Hint
    ctx.fillStyle = "rgba(234, 242, 255, 0.75)";
    ctx.font = "500 13px Outfit, sans-serif";
    ctx.fillText("Move with Arrow Keys or WASD", 16, window.SpaceQuestRooms.HEIGHT - 18);
  }

  function frame(time) {
    if (!running) return;
    const dt = Math.min((time - lastTime) / 1000, 0.05);
    lastTime = time;

    const dir = window.SpaceQuestInput.vector();
    tryMove(dir.x * PLAYER_SPEED * dt, dir.y * PLAYER_SPEED * dt);

    const touched = checkEnemyContact();
    if (touched) {
      stop();
      if (typeof onCombat === "function") {
        onCombat({
          enemy: touched,
          roomId: room.id,
          player: { x: player.x, y: player.y },
        });
      }
      return;
    }

    drawRoom();
    drawActors(time);
    rafId = requestAnimationFrame(frame);
  }

  async function start(options = {}) {
    canvas = options.canvas;
    ctx = canvas.getContext("2d");
    onCombat = options.onCombat;

    const catalog = window.SpaceQuestRooms;
    canvas.width = catalog.WIDTH;
    canvas.height = catalog.HEIGHT;

    await prepareAssets();
    loadRoom(options.roomId || catalog.startRoomId);

    if (options.resumePosition) {
      player.x = options.resumePosition.x;
      player.y = options.resumePosition.y;
    }

    // Mark previously fought enemy defeated if returning from combat stub
    if (options.defeatedEnemyId) {
      const foe = enemies.find((e) => e.id === options.defeatedEnemyId);
      if (foe) foe.defeated = true;
    }

    window.SpaceQuestInput.bind();
    window.SpaceQuestInput.clear();
    running = true;
    lastTime = performance.now();
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(rafId);
    window.SpaceQuestInput.unbind();
  }

  return { start, stop };
})();
