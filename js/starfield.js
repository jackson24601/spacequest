(() => {
  const canvas = document.getElementById("starfield");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  let width = 0;
  let height = 0;
  let stars = [];
  let animationId = 0;
  let lastTime = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seedStars();
  }

  function seedStars() {
    const count = Math.floor((width * height) / 9000);
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: Math.random() * 1.6 + 0.3,
      speed: Math.random() * 0.035 + 0.01,
      twinkle: Math.random() * Math.PI * 2,
      twinkleSpeed: Math.random() * 1.8 + 0.6,
      alpha: Math.random() * 0.6 + 0.25,
    }));
  }

  function draw(time = 0) {
    const dt = Math.min((time - lastTime) / 1000, 0.05);
    lastTime = time;

    ctx.clearRect(0, 0, width, height);

    for (const star of stars) {
      if (!prefersReducedMotion) {
        star.y += star.speed * 18 * dt;
        if (star.y > height + 2) {
          star.y = -2;
          star.x = Math.random() * width;
        }
        star.twinkle += star.twinkleSpeed * dt;
      }

      const pulse = prefersReducedMotion
        ? star.alpha
        : star.alpha * (0.55 + 0.45 * Math.sin(star.twinkle));

      ctx.beginPath();
      ctx.fillStyle = `rgba(234, 242, 255, ${pulse})`;
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    }

    if (!prefersReducedMotion) {
      animationId = requestAnimationFrame(draw);
    }
  }

  resize();
  draw(0);

  window.addEventListener("resize", () => {
    cancelAnimationFrame(animationId);
    resize();
    lastTime = performance.now();
    draw(lastTime);
  });
})();
