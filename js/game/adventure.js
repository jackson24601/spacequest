window.SpaceQuestAdventure = (() => {
  const SPRITE_SCALE = 2.5;
  const PLAYER_SPEED = 160;
  const FRAME_W = 32;
  const FRAME_H = 48;
  const WALK_FPS = 8;

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
  let onCombat;
  let assetsReady = false;
  let alarmPhase = 0;

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
    [playerSheet, enemyImage] = await Promise.all([
      loadImage("assets/sprites/player-walk.png"),
      loadImage("assets/sprites/enemy.png"),
    ]);
    assetsReady = true;
  }

  function loadRoom(roomId) {
    const catalog = window.SpaceQuestRooms;
    room = catalog.rooms[roomId];
    if (!room) throw new Error(`Unknown room: ${roomId}`);

    const pw = FRAME_W * SPRITE_SCALE;
    const ph = FRAME_H * SPRITE_SCALE;

    // Center the player in the hallway for the starting scene
    const spawnX =
      room.spawn?.centered === false
        ? room.spawn.x
        : Math.round((catalog.WIDTH - pw) / 2);
    const spawnY =
      room.spawn?.y != null
        ? room.spawn.y
        : Math.round((catalog.HEIGHT - ph) / 2);

    player = {
      x: spawnX,
      y: spawnY,
      w: pw,
      h: ph,
      facing: 1, // 1 right, -1 left
      moving: false,
      animTime: 0,
      frame: 0,
      hit: { ox: pw * 0.22, oy: ph * 0.58, w: pw * 0.56, h: ph * 0.36 },
      body: { ox: pw * 0.18, oy: ph * 0.2, w: pw * 0.64, h: ph * 0.7 },
    };

    enemies = (room.enemies || []).map((enemy) => ({
      ...enemy,
      defeated: false,
      bob: Math.random() * Math.PI * 2,
    }));

    window.SpaceQuestInput.setAxes(room.movement?.axes || "both");
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
    let moved = false;
    if (dx !== 0) {
      // Keep inside canvas horizontally even without side walls
      const minX = 8;
      const maxX = window.SpaceQuestRooms.WIDTH - player.w - 8;
      const proposedX = Math.min(maxX, Math.max(minX, player.x + dx));
      const clamped = playerBox("hit", proposedX, player.y);
      if (!collidesSolids(clamped, room.solids) && proposedX !== player.x) {
        player.x = proposedX;
        moved = true;
      }
    }
    if (dy !== 0) {
      const next = playerBox("hit", player.x, player.y + dy);
      if (!collidesSolids(next, room.solids)) {
        player.y += dy;
        moved = true;
      }
    }
    return moved;
  }

  function checkEnemyContact() {
    const body = playerBox("body");
    for (const enemy of enemies) {
      if (enemy.defeated) continue;
      const box = { x: enemy.x, y: enemy.y, w: enemy.w, h: enemy.h };
      if (aabb(body, box)) {
        return enemy;
      }
    }
    return null;
  }

  function drawHallwayBackdrop(time) {
    const { palette } = room;
    const { WIDTH, HEIGHT } = window.SpaceQuestRooms;

    // Deep metal walls
    const wallGrad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    wallGrad.addColorStop(0, palette.wallDark);
    wallGrad.addColorStop(0.45, palette.wall);
    wallGrad.addColorStop(1, palette.wallDark);
    ctx.fillStyle = wallGrad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Hallway floor band
    const floorTop = 150;
    const floorBottom = 390;
    const floorGrad = ctx.createLinearGradient(0, floorTop, 0, floorBottom);
    floorGrad.addColorStop(0, "#4a4658");
    floorGrad.addColorStop(0.5, palette.floor);
    floorGrad.addColorStop(1, "#3a3746");
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, floorTop, WIDTH, floorBottom - floorTop);

    // Perspective floor lines
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

    // Ceiling / floor bulkheads from solids
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

      // Rivet row
      ctx.fillStyle = "rgba(200, 220, 240, 0.18)";
      const rivetY = solid.y < HEIGHT / 2 ? solid.y + solid.h - 14 : solid.y + 10;
      for (let x = 24; x < WIDTH; x += 36) {
        ctx.beginPath();
        ctx.arc(x, rivetY, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawProps(time) {
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
        ctx.fillRect(prop.x + 10, prop.y + 52, prop.w - 20, Math.max(18, prop.h - 64));
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
      } else if (prop.type === "door-side") {
        ctx.fillStyle = "#0d1520";
        ctx.fillRect(prop.x, prop.y, prop.w, prop.h);
        ctx.fillStyle = `rgba(255, 77, 77, ${0.25 + pulse * 0.45})`;
        ctx.fillRect(prop.x + 8, prop.y + 20, 6, prop.h - 40);
        ctx.fillStyle = palette.metal;
        ctx.fillRect(
          prop.x + (prop.x < 100 ? prop.w - 8 : 2),
          prop.y + prop.h / 2 - 10,
          6,
          20
        );
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

    // Soft full-frame pulse
    ctx.fillStyle = `rgba(120, 20, 20, ${intensity * 0.55})`;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  function updatePlayerAnim(dt, dirX) {
    if (dirX < 0) player.facing = -1;
    if (dirX > 0) player.facing = 1;

    if (player.moving) {
      player.animTime += dt;
      const frameCount = 3; // walk frames 1..3 on the sheet (0 is idle)
      player.frame = 1 + (Math.floor(player.animTime * WALK_FPS) % frameCount);
    } else {
      player.animTime = 0;
      player.frame = 0;
    }
  }

  function drawPlayer() {
    // Shadow
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

    // Subtle bob while walking
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

  function drawActors() {
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
      ctx.drawImage(enemyImage, enemy.x, enemy.y + oy, enemy.w, enemy.h);
    }

    drawPlayer();

    // Room label + alarm cue
    ctx.fillStyle = "rgba(7, 12, 24, 0.55)";
    ctx.fillRect(16, 16, 240, 36);
    ctx.strokeStyle = room.alarm
      ? `rgba(255, 90, 90, ${0.4 + 0.4 * (0.5 + 0.5 * Math.sin(alarmPhase))})`
      : "rgba(62, 199, 192, 0.5)";
    ctx.strokeRect(16.5, 16.5, 239, 35);
    ctx.fillStyle = "#eaf2ff";
    ctx.font = "600 16px Outfit, sans-serif";
    ctx.fillText(room.name, 28, 40);

    ctx.fillStyle = "rgba(234, 242, 255, 0.75)";
    ctx.font = "500 13px Outfit, sans-serif";
    const hint =
      room.movement?.axes === "horizontal"
        ? "Move with ← → Arrow Keys"
        : "Move with Arrow Keys or WASD";
    ctx.fillText(hint, 16, window.SpaceQuestRooms.HEIGHT - 18);
  }

  function frame(time) {
    if (!running) return;
    const dt = Math.min((time - lastTime) / 1000, 0.05);
    lastTime = time;

    if (room.alarm) {
      alarmPhase += dt * 3.2;
    }

    const dir = window.SpaceQuestInput.vector();
    const moved = tryMove(dir.x * PLAYER_SPEED * dt, dir.y * PLAYER_SPEED * dt);
    player.moving = moved && (dir.x !== 0 || dir.y !== 0);
    updatePlayerAnim(dt, dir.x);

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

    drawHallwayBackdrop(time);
    drawProps(time);
    drawActors();
    drawAlarmWash();
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

    if (options.defeatedEnemyId) {
      const foe = enemies.find((e) => e.id === options.defeatedEnemyId);
      if (foe) foe.defeated = true;
    }

    window.SpaceQuestInput.bind();
    window.SpaceQuestInput.clear();
    running = true;
    alarmPhase = 0;
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
