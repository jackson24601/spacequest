/**
 * Spaceship grid from the provided map.
 * Empty / black cells = outspace. Special rooms are reserved for later.
 *
 * Grid rows (top → bottom), cols (left → right):
 *
 *                 1               2        3        4               5               6            7        8            9
 * 0:                                                                                                      Hallway
 * 1:                                              Mess Hall                       Supply Room             Hallway
 * 2:  Mission Control   Hallway  Hallway  Hallway        Starting Scene  Hallway      Hallway  Hallway   Engine Room
 * 3:                                              Lodging                         Infirmary               Hallway
 * 4:                                                                                                      Hallway
 */
window.SpaceQuestMap = (() => {
  const WIDTH = 960;
  const HEIGHT = 540;

  const WALKABLE = new Set(["Hallway", "Starting Scene"]);

  // Compact content grid (5 rows × 10 cols), matching the CSV content block.
  const GRID = [
    ["", "", "", "", "", "", "", "", "Hallway", ""],
    ["", "", "", "", "Mess Hall", "", "Supply Room", "", "Hallway", ""],
    [
      "",
      "Mission Control",
      "Hallway",
      "Hallway",
      "Hallway",
      "Starting Scene",
      "Hallway",
      "Hallway",
      "Hallway",
      "Engine Room",
    ],
    ["", "", "", "", "Lodging", "", "Infirmary", "", "Hallway", ""],
    ["", "", "", "", "", "", "", "", "Hallway", ""],
  ];

  const DIRS = {
    up: { dr: -1, dc: 0, opposite: "down" },
    down: { dr: 1, dc: 0, opposite: "up" },
    left: { dr: 0, dc: -1, opposite: "right" },
    right: { dr: 0, dc: 1, opposite: "left" },
  };

  const PALETTE = {
    floor: "#5c5868",
    wall: "#2a3d5c",
    wallDark: "#162338",
    accent: "#3ec7c0",
    accentWarm: "#e0b245",
    metal: "#8fa0b8",
    alarm: "#ff4d4d",
  };

  function cellId(row, col) {
    const label = GRID[row]?.[col] || "";
    if (label === "Starting Scene") return "start";
    if (label === "Hallway") return `hallway-${row}-${col}`;
    return null;
  }

  function axesFromExits(exits) {
    const horiz = Boolean(exits.left || exits.right);
    const vert = Boolean(exits.up || exits.down);
    if (horiz && vert) return "both";
    if (vert) return "vertical";
    return "horizontal";
  }

  function buildLayout(exits, axes) {
    const solids = [];
    const props = [];

    // Shared alarm lights along the ceiling line
    props.push(
      { type: "light", x: 160, y: 126, w: 36, h: 16 },
      { type: "light", x: 360, y: 126, w: 36, h: 16 },
      { type: "light", x: 560, y: 126, w: 36, h: 16 },
      { type: "light", x: 760, y: 126, w: 36, h: 16 }
    );

    if (axes === "horizontal") {
      solids.push(
        { x: 0, y: 0, w: WIDTH, h: 150 },
        { x: 0, y: 390, w: WIDTH, h: 150 }
      );
      props.push(
        { type: "panel", x: 90, y: 168, w: 64, h: 96 },
        { type: "panel", x: 806, y: 168, w: 64, h: 96 },
        { type: "panel", x: 280, y: 168, w: 54, h: 80 },
        { type: "panel", x: 626, y: 168, w: 54, h: 80 },
        { type: "stripe", x: 0, y: 318, w: WIDTH, h: 10 },
        { type: "stripe", x: 0, y: 212, w: WIDTH, h: 8 }
      );
      if (exits.left) props.push({ type: "door-side", x: 0, y: 200, w: 28, h: 150 });
      if (exits.right) props.push({ type: "door-side", x: 932, y: 200, w: 28, h: 150 });
    } else if (axes === "vertical") {
      solids.push(
        { x: 0, y: 0, w: 220, h: HEIGHT },
        { x: 740, y: 0, w: 220, h: HEIGHT }
      );
      props.push(
        { type: "panel", x: 246, y: 90, w: 64, h: 96 },
        { type: "panel", x: 650, y: 90, w: 64, h: 96 },
        { type: "panel", x: 246, y: 340, w: 64, h: 96 },
        { type: "panel", x: 650, y: 340, w: 64, h: 96 },
        { type: "stripe", x: 220, y: 160, w: 10, h: 220 },
        { type: "stripe", x: 730, y: 160, w: 10, h: 220 }
      );
      if (exits.up) props.push({ type: "door-top", x: 390, y: 0, w: 180, h: 28 });
      if (exits.down) props.push({ type: "door-top", x: 390, y: 512, w: 180, h: 28 });
    } else {
      // Crossroads: corner bulkheads only — open lanes through center + exits
      solids.push(
        { x: 0, y: 0, w: 300, h: 130 },
        { x: 660, y: 0, w: 300, h: 130 },
        { x: 0, y: 410, w: 300, h: 130 },
        { x: 660, y: 410, w: 300, h: 130 }
      );
      props.push(
        { type: "panel", x: 210, y: 150, w: 54, h: 80 },
        { type: "panel", x: 696, y: 150, w: 54, h: 80 },
        { type: "stripe", x: 0, y: 250, w: WIDTH, h: 8 },
        { type: "stripe", x: 476, y: 0, w: 8, h: HEIGHT }
      );
      if (exits.left) props.push({ type: "door-side", x: 0, y: 200, w: 28, h: 140 });
      if (exits.right) props.push({ type: "door-side", x: 932, y: 200, w: 28, h: 140 });
      if (exits.up) props.push({ type: "door-top", x: 390, y: 0, w: 180, h: 28 });
      if (exits.down) props.push({ type: "door-top", x: 390, y: 512, w: 180, h: 28 });
    }

    return { solids, props };
  }

  function buildRooms() {
    const rooms = {};
    let startRoomId = "start";

    for (let row = 0; row < GRID.length; row += 1) {
      for (let col = 0; col < GRID[row].length; col += 1) {
        const label = GRID[row][col];
        if (!WALKABLE.has(label)) continue;

        const id = cellId(row, col);
        const exits = { up: null, down: null, left: null, right: null };

        for (const [dir, meta] of Object.entries(DIRS)) {
          const nr = row + meta.dr;
          const nc = col + meta.dc;
          const neighbor = GRID[nr]?.[nc] || "";
          if (WALKABLE.has(neighbor)) {
            exits[dir] = cellId(nr, nc);
          }
        }

        const axes = axesFromExits(exits);
        const layout = buildLayout(exits, axes);
        const isStart = label === "Starting Scene";

        rooms[id] = {
          id,
          name: isStart ? "Starting Scene" : "Hallway",
          kind: isStart ? "start" : "hallway",
          grid: { row, col },
          spawn: { centered: true, y: 250 },
          movement: { axes },
          alarm: true,
          solids: layout.solids,
          props: layout.props,
          enemies: [],
          exits,
          palette: { ...PALETTE },
        };

        if (isStart) startRoomId = id;
      }
    }

    return { rooms, startRoomId };
  }

  const built = buildRooms();

  return {
    WIDTH,
    HEIGHT,
    GRID,
    rooms: built.rooms,
    startRoomId: built.startRoomId,
    cellId,
  };
})();
