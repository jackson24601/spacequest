/**
 * Escape Pod ending — cockpit POV with stars streaking past.
 */
window.SpaceQuestEscape = (() => {
  let root = null;
  let canvas = null;
  let ctx = null;
  let rafId = 0;
  let running = false;
  let width = 0;
  let height = 0;
  let stars = [];
  let lastTime = 0;

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  function mount(element) {
    root = element;
    canvas = root?.querySelector("[data-escape-stars]");
    ctx = canvas?.getContext("2d") || null;
  }

  function resize() {
    if (!canvas || !ctx || !root) return;
    const frame = root.querySelector("[data-escape-viewport]");
    const rect = frame?.getBoundingClientRect() || {
      width: window.innerWidth * 0.7,
      height: window.innerHeight * 0.45,
    };
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(200, Math.floor(rect.width));
    height = Math.max(140, Math.floor(rect.height));
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seedStars();
  }

  function seedStars() {
    const count = Math.floor((width * height) / 2200);
    stars = Array.from({ length: count }, () => createStar(true));
  }

  function createStar(randomDepth = false) {
    const angle = Math.random() * Math.PI * 2;
    const depth = randomDepth ? Math.random() : 0.02;
    return {
      angle,
      depth,
      speed: 0.55 + Math.random() * 1.4,
      length: 8 + Math.random() * 28,
      alpha: 0.35 + Math.random() * 0.55,
    };
  }

  function draw(time = 0) {
    if (!ctx || !running) return;
    const dt = Math.min((time - lastTime) / 1000, 0.05) || 0.016;
    lastTime = time;

    // Deep space wash
    ctx.fillStyle = "#02060f";
    ctx.fillRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;
    const maxR = Math.hypot(cx, cy);

    // Soft nebula glow behind streaks
    const glow = ctx.createRadialGradient(cx, cy, 10, cx, cy, maxR);
    glow.addColorStop(0, "rgba(40, 90, 120, 0.22)");
    glow.addColorStop(0.55, "rgba(12, 28, 48, 0.12)");
    glow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    for (const star of stars) {
      if (!prefersReducedMotion) {
        star.depth += star.speed * dt;
        if (star.depth > 1.05) {
          Object.assign(star, createStar(false));
        }
      }

      const r = star.depth * maxR;
      const x = cx + Math.cos(star.angle) * r;
      const y = cy + Math.sin(star.angle) * r;
      const prevR = Math.max(0, r - star.length * (0.35 + star.depth));
      const px = cx + Math.cos(star.angle) * prevR;
      const py = cy + Math.sin(star.angle) * prevR;

      ctx.strokeStyle = `rgba(220, 236, 255, ${star.alpha * (0.35 + star.depth * 0.65)})`;
      ctx.lineWidth = 0.8 + star.depth * 2.2;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(x, y);
      ctx.stroke();

      ctx.fillStyle = `rgba(255, 255, 255, ${0.4 + star.depth * 0.5})`;
      ctx.beginPath();
      ctx.arc(x, y, 0.6 + star.depth * 1.6, 0, Math.PI * 2);
      ctx.fill();
    }

    if (!prefersReducedMotion) {
      rafId = requestAnimationFrame(draw);
    }
  }

  function start() {
    if (!root || !canvas || !ctx) return;
    stop();
    running = true;
    root.hidden = false;
    root.setAttribute("data-active", "true");
    root.classList.remove("is-entering");
    void root.offsetWidth;
    root.classList.add("is-entering");
    resize();
    lastTime = performance.now();
    draw(lastTime);
  }

  function stop() {
    running = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    if (root) {
      root.setAttribute("data-active", "false");
      root.hidden = true;
      root.classList.remove("is-entering");
    }
  }

  window.addEventListener("resize", () => {
    if (!running) return;
    cancelAnimationFrame(rafId);
    resize();
    lastTime = performance.now();
    draw(lastTime);
  });

  return { mount, start, stop };
})();
