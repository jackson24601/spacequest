/**
 * Spaceship grid from the provided map.
 * Empty / black cells = outspace.
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

  const SPECIAL = {
    "Mess Hall": {
      id: "mess-hall",
      locked: false,
      keyId: null,
    },
    "Supply Room": {
      id: "supply-room",
      locked: false,
      keyId: null,
    },
    Lodging: {
      id: "lodging",
      locked: false,
      keyId: null,
    },
    Infirmary: {
      id: "infirmary",
      locked: true,
      keyId: "infirmary-key",
    },
    "Mission Control": {
      id: "mission-control",
      locked: true,
      keyId: "mission-control-key",
    },
    "Engine Room": {
      id: "engine-room",
      locked: true,
      keyId: "engine-room-key",
    },
  };

  const CONNECTED = new Set(["Hallway", "Starting Scene", ...Object.keys(SPECIAL)]);

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
    if (SPECIAL[label]) return SPECIAL[label].id;
    return null;
  }

  function labelAt(row, col) {
    return GRID[row]?.[col] || "";
  }

  function axesFromExits(exits) {
    const horiz = Boolean(exits.left || exits.right);
    const vert = Boolean(exits.up || exits.down);
    if (horiz && vert) return "both";
    if (vert) return "vertical";
    return "horizontal";
  }

  function doorProp(dir, locked) {
    if (dir === "left") {
      return {
        type: locked ? "door-locked-side" : "door-side",
        x: 0,
        y: 200,
        w: 28,
        h: 150,
        label: locked ? "Locked" : "Open",
      };
    }
    if (dir === "right") {
      return {
        type: locked ? "door-locked-side" : "door-side",
        x: 932,
        y: 200,
        w: 28,
        h: 150,
        label: locked ? "Locked" : "Open",
      };
    }
    if (dir === "up") {
      return {
        type: locked ? "door-locked-top" : "door-top",
        x: 390,
        y: 0,
        w: 180,
        h: 28,
        label: locked ? "Locked" : "Open",
      };
    }
    return {
      type: locked ? "door-locked-top" : "door-top",
      x: 390,
      y: 512,
      w: 180,
      h: 28,
      label: locked ? "Locked" : "Open",
    };
  }

  function buildHallwayLayout(exits, lockedDirs) {
    const solids = [];
    const props = [];
    const axes = axesFromExits(exits);
    const gap = 200;

    props.push(
      { type: "light", x: 160, y: 126, w: 36, h: 16 },
      { type: "light", x: 360, y: 126, w: 36, h: 16 },
      { type: "light", x: 560, y: 126, w: 36, h: 16 },
      { type: "light", x: 760, y: 126, w: 36, h: 16 }
    );

    if (axes === "vertical") {
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
    } else if (axes === "horizontal") {
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
    } else {
      // Plus-shaped corridor with door gaps on connected sides
      const topH = 120;
      const botY = 420;
      const sideW = 200;

      if (exits.up) {
        solids.push(
          { x: 0, y: 0, w: (WIDTH - gap) / 2, h: topH },
          { x: (WIDTH + gap) / 2, y: 0, w: (WIDTH - gap) / 2, h: topH }
        );
      } else {
        solids.push({ x: 0, y: 0, w: WIDTH, h: topH });
      }

      if (exits.down) {
        solids.push(
          { x: 0, y: botY, w: (WIDTH - gap) / 2, h: HEIGHT - botY },
          {
            x: (WIDTH + gap) / 2,
            y: botY,
            w: (WIDTH - gap) / 2,
            h: HEIGHT - botY,
          }
        );
      } else {
        solids.push({ x: 0, y: botY, w: WIDTH, h: HEIGHT - botY });
      }

      if (!exits.left) {
        solids.push({ x: 0, y: topH, w: sideW, h: botY - topH });
      }
      if (!exits.right) {
        solids.push({
          x: WIDTH - sideW,
          y: topH,
          w: sideW,
          h: botY - topH,
        });
      }

      props.push(
        { type: "panel", x: 210, y: 150, w: 54, h: 80 },
        { type: "panel", x: 696, y: 150, w: 54, h: 80 },
        { type: "stripe", x: 0, y: 250, w: WIDTH, h: 8 },
        { type: "stripe", x: 476, y: 0, w: 8, h: HEIGHT }
      );
    }

    for (const dir of Object.keys(DIRS)) {
      if (!exits[dir]) continue;
      props.push(doorProp(dir, Boolean(lockedDirs[dir])));
    }

    return { solids, props, axes };
  }

  function buildSpecialLayout(kind, exits) {
    const solids = [];
    const props = [];

    // Outer bulkheads with a single doorway opening
    const doorGap = 180;
    solids.push(
      { x: 0, y: 0, w: WIDTH, h: 70 },
      { x: 0, y: HEIGHT - 70, w: WIDTH, h: 70 },
      { x: 0, y: 70, w: 70, h: HEIGHT - 140 },
      { x: WIDTH - 70, y: 70, w: 70, h: HEIGHT - 140 }
    );

    // Carve doorway by not covering the exit edge with an extra blocker;
    // instead mark a door prop and keep edge open via exits.
    if (exits.up) {
      // open top center: replace top solid with two pieces
      solids.length = 0;
      solids.push(
        { x: 0, y: 0, w: (WIDTH - doorGap) / 2, h: 70 },
        { x: (WIDTH + doorGap) / 2, y: 0, w: (WIDTH - doorGap) / 2, h: 70 },
        { x: 0, y: HEIGHT - 70, w: WIDTH, h: 70 },
        { x: 0, y: 70, w: 70, h: HEIGHT - 140 },
        { x: WIDTH - 70, y: 70, w: 70, h: HEIGHT - 140 }
      );
      props.push(doorProp("up", false));
    } else if (exits.down) {
      solids.length = 0;
      solids.push(
        { x: 0, y: 0, w: WIDTH, h: 70 },
        { x: 0, y: HEIGHT - 70, w: (WIDTH - doorGap) / 2, h: 70 },
        {
          x: (WIDTH + doorGap) / 2,
          y: HEIGHT - 70,
          w: (WIDTH - doorGap) / 2,
          h: 70,
        },
        { x: 0, y: 70, w: 70, h: HEIGHT - 140 },
        { x: WIDTH - 70, y: 70, w: 70, h: HEIGHT - 140 }
      );
      props.push(doorProp("down", false));
    } else if (exits.left) {
      solids.length = 0;
      solids.push(
        { x: 0, y: 0, w: WIDTH, h: 70 },
        { x: 0, y: HEIGHT - 70, w: WIDTH, h: 70 },
        { x: 0, y: 70, w: 70, h: (HEIGHT - 140 - doorGap) / 2 },
        {
          x: 0,
          y: 70 + (HEIGHT - 140 - doorGap) / 2 + doorGap,
          w: 70,
          h: (HEIGHT - 140 - doorGap) / 2,
        },
        { x: WIDTH - 70, y: 70, w: 70, h: HEIGHT - 140 }
      );
      props.push(doorProp("left", false));
    } else if (exits.right) {
      solids.length = 0;
      solids.push(
        { x: 0, y: 0, w: WIDTH, h: 70 },
        { x: 0, y: HEIGHT - 70, w: WIDTH, h: 70 },
        { x: 0, y: 70, w: 70, h: HEIGHT - 140 },
        { x: WIDTH - 70, y: 70, w: 70, h: (HEIGHT - 140 - doorGap) / 2 },
        {
          x: WIDTH - 70,
          y: 70 + (HEIGHT - 140 - doorGap) / 2 + doorGap,
          w: 70,
          h: (HEIGHT - 140 - doorGap) / 2,
        }
      );
      props.push(doorProp("right", false));
    }

    props.push(
      { type: "light", x: 180, y: 86, w: 28, h: 12 },
      { type: "light", x: 460, y: 86, w: 28, h: 12 },
      { type: "light", x: 740, y: 86, w: 28, h: 12 }
    );

    if (kind === "mess-hall") {
      // Cafeteria tables + food dispenser wall
      props.push(
        { type: "label", x: 390, y: 100, text: "MESS HALL" },
        { type: "counter", x: 120, y: 130, w: 720, h: 48 },
        { type: "table", x: 180, y: 250, w: 160, h: 90 },
        { type: "table", x: 400, y: 250, w: 160, h: 90 },
        { type: "table", x: 620, y: 250, w: 160, h: 90 },
        { type: "bench", x: 180, y: 350, w: 160, h: 28 },
        { type: "bench", x: 400, y: 350, w: 160, h: 28 },
        { type: "bench", x: 620, y: 350, w: 160, h: 28 },
        { type: "dispenser", x: 140, y: 145, w: 70, h: 28 },
        { type: "dispenser", x: 250, y: 145, w: 70, h: 28 },
        { type: "dispenser", x: 640, y: 145, w: 70, h: 28 },
        { type: "dispenser", x: 750, y: 145, w: 70, h: 28 }
      );
      solids.push(
        { x: 120, y: 130, w: 720, h: 48 },
        { x: 180, y: 250, w: 160, h: 90 },
        { x: 400, y: 250, w: 160, h: 90 },
        { x: 620, y: 250, w: 160, h: 90 }
      );
    } else if (kind === "lodging") {
      props.push(
        { type: "label", x: 400, y: 100, text: "LODGING" },
        { type: "bunk", x: 120, y: 150, w: 210, h: 120 },
        { type: "bunk", x: 120, y: 300, w: 210, h: 120 },
        { type: "bunk", x: 630, y: 150, w: 210, h: 120 },
        { type: "bunk", x: 630, y: 300, w: 210, h: 120 },
        { type: "locker", x: 370, y: 160, w: 50, h: 110 },
        { type: "locker", x: 430, y: 160, w: 50, h: 110 },
        { type: "locker", x: 490, y: 160, w: 50, h: 110 },
        { type: "locker", x: 370, y: 310, w: 50, h: 110 },
        { type: "locker", x: 430, y: 310, w: 50, h: 110 },
        { type: "locker", x: 490, y: 310, w: 50, h: 110 }
      );
      solids.push(
        { x: 120, y: 150, w: 210, h: 120 },
        { x: 120, y: 300, w: 210, h: 120 },
        { x: 630, y: 150, w: 210, h: 120 },
        { x: 630, y: 300, w: 210, h: 120 },
        { x: 370, y: 160, w: 170, h: 110 },
        { x: 370, y: 310, w: 170, h: 110 }
      );
    } else if (kind === "supply-room") {
      props.push(
        { type: "label", x: 380, y: 100, text: "SUPPLY ROOM" },
        { type: "shelf", x: 110, y: 140, w: 70, h: 280 },
        { type: "shelf", x: 210, y: 140, w: 70, h: 280 },
        { type: "shelf", x: 680, y: 140, w: 70, h: 280 },
        { type: "shelf", x: 780, y: 140, w: 70, h: 280 },
        { type: "crate", x: 340, y: 200, w: 90, h: 70 },
        { type: "crate", x: 450, y: 200, w: 90, h: 70 },
        { type: "crate", x: 560, y: 200, w: 90, h: 70 },
        { type: "crate", x: 390, y: 300, w: 100, h: 80 },
        { type: "crate", x: 510, y: 310, w: 80, h: 70 }
      );
      solids.push(
        { x: 110, y: 140, w: 70, h: 280 },
        { x: 210, y: 140, w: 70, h: 280 },
        { x: 680, y: 140, w: 70, h: 280 },
        { x: 780, y: 140, w: 70, h: 280 },
        { x: 340, y: 200, w: 310, h: 70 },
        { x: 390, y: 300, w: 200, h: 80 }
      );
    } else {
      // Locked special rooms still get a simple stub layout (unreachable for now)
      props.push(
        { type: "label", x: 360, y: 240, text: kind.replace("-", " ").toUpperCase() },
        { type: "panel", x: 200, y: 160, w: 80, h: 100 },
        { type: "panel", x: 680, y: 160, w: 80, h: 100 }
      );
    }

    return { solids, props, axes: "both" };
  }

  function buildRooms() {
    const rooms = {};
    let startRoomId = "start";

    for (let row = 0; row < GRID.length; row += 1) {
      for (let col = 0; col < GRID[row].length; col += 1) {
        const label = GRID[row][col];
        if (!CONNECTED.has(label)) continue;

        const id = cellId(row, col);
        const exits = { up: null, down: null, left: null, right: null };
        const lockedDirs = { up: false, down: false, left: false, right: false };

        for (const [dir, meta] of Object.entries(DIRS)) {
          const nr = row + meta.dr;
          const nc = col + meta.dc;
          const neighbor = labelAt(nr, nc);
          if (!CONNECTED.has(neighbor)) continue;
          exits[dir] = cellId(nr, nc);
          if (SPECIAL[neighbor]?.locked) lockedDirs[dir] = true;
        }

        const isStart = label === "Starting Scene";
        const isHall = label === "Hallway" || isStart;
        const special = SPECIAL[label];

        const layout = isHall
          ? buildHallwayLayout(exits, lockedDirs)
          : buildSpecialLayout(special.id, exits);

        rooms[id] = {
          id,
          name: label,
          kind: isStart ? "start" : isHall ? "hallway" : "special",
          specialType: special?.id || null,
          locked: Boolean(special?.locked),
          keyId: special?.keyId || null,
          grid: { row, col },
          spawn: { centered: true, y: isHall ? 250 : 260 },
          movement: { axes: layout.axes },
          alarm: isHall,
          solids: layout.solids,
          props: layout.props,
          enemies: [],
          exits,
          lockedDirs,
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
    SPECIAL,
    rooms: built.rooms,
    startRoomId: built.startRoomId,
    cellId,
  };
})();
