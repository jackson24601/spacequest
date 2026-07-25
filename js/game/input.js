window.SpaceQuestInput = (() => {
  const keys = new Set();
  let axes = "both"; // "both" | "horizontal" | "vertical"

  const KEY_MAP = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
    w: "up",
    W: "up",
    s: "down",
    S: "down",
    a: "left",
    A: "left",
    d: "right",
    D: "right",
  };

  function onKeyDown(event) {
    const action = KEY_MAP[event.key];
    if (!action) return;
    event.preventDefault();
    keys.add(action);
  }

  function onKeyUp(event) {
    const action = KEY_MAP[event.key];
    if (!action) return;
    event.preventDefault();
    keys.delete(action);
  }

  function bind() {
    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", onKeyUp, { passive: false });
  }

  function unbind() {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    keys.clear();
  }

  function setAxes(nextAxes) {
    axes = nextAxes || "both";
    if (axes === "horizontal") {
      keys.delete("up");
      keys.delete("down");
    } else if (axes === "vertical") {
      keys.delete("left");
      keys.delete("right");
    }
  }

  function vector() {
    let x = 0;
    let y = 0;
    if (axes !== "vertical") {
      if (keys.has("left")) x -= 1;
      if (keys.has("right")) x += 1;
    }
    if (axes !== "horizontal") {
      if (keys.has("up")) y -= 1;
      if (keys.has("down")) y += 1;
    }
    if (x !== 0 && y !== 0) {
      const inv = 1 / Math.SQRT2;
      x *= inv;
      y *= inv;
    }
    return { x, y };
  }

  function clear() {
    keys.clear();
  }

  return { bind, unbind, vector, clear, setAxes };
})();
