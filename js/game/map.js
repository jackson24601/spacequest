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
    ["", "Escape Pod", "", "", "Mess Hall", "", "Supply Room", "", "Hallway", ""],
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
    "Escape Pod": {
      id: "escape-pod",
      locked: false,
      keyId: null,
      // Opens only after the Mission Control boss is defeated
      requiresClearId: "mission-control-boss",
    },
    "Engine Room": {
      id: "engine-room",
      locked: true,
      keyId: "engine-room-key",
    },
  };

  const CONNECTED = new Set(["Hallway", "Starting Scene", ...Object.keys(SPECIAL)]);

  // Classic Sierra / VGA adventure ship palette
  const PALETTE = {
    floor: "#9aa6c8",
    floorDark: "#7a86a8",
    floorLight: "#b8c2de",
    wall: "#7eb0d8",
    wallMid: "#5a92c0",
    wallDark: "#3a6a98",
    wallDeep: "#2a4a70",
    panel: "#8ec4e8",
    panelEdge: "#2a4060",
    accent: "#3ee0e8",
    accentWarm: "#f0c040",
    metal: "#c8d4e8",
    alarm: "#e03040",
    hazardYellow: "#f0d030",
    hazardBlack: "#1a1a24",
    redBand: "#d02038",
    ink: "#1a2438",
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
        { type: "panel", x: 246, y: 90, w: 78, h: 100 },
        { type: "panel", x: 636, y: 90, w: 78, h: 100 },
        { type: "panel", x: 246, y: 340, w: 78, h: 100 },
        { type: "panel", x: 636, y: 340, w: 78, h: 100 },
        { type: "vent", x: 232, y: 200, w: 40, h: 56 },
        { type: "vent", x: 688, y: 200, w: 40, h: 56 },
        { type: "vent", x: 232, y: 290, w: 40, h: 40 },
        { type: "vent", x: 688, y: 290, w: 40, h: 40 }
      );
    } else if (axes === "horizontal") {
      solids.push(
        { x: 0, y: 0, w: WIDTH, h: 150 },
        { x: 0, y: 390, w: WIDTH, h: 150 }
      );
      props.push(
        { type: "panel", x: 80, y: 162, w: 86, h: 100 },
        { type: "panel", x: 794, y: 162, w: 86, h: 100 },
        { type: "panel", x: 270, y: 168, w: 78, h: 92 },
        { type: "panel", x: 612, y: 168, w: 78, h: 92 },
        { type: "vent", x: 180, y: 175, w: 48, h: 36 },
        { type: "vent", x: 732, y: 175, w: 48, h: 36 },
        { type: "vent", x: 400, y: 178, w: 56, h: 32 },
        { type: "droid", x: 500, y: 168, w: 40, h: 40 }
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
        { type: "panel", x: 200, y: 145, w: 78, h: 92 },
        { type: "panel", x: 682, y: 145, w: 78, h: 92 },
        { type: "vent", x: 300, y: 155, w: 48, h: 32 },
        { type: "vent", x: 612, y: 155, w: 48, h: 32 },
        { type: "vent", x: 220, y: 300, w: 36, h: 48 },
        { type: "vent", x: 704, y: 300, w: 36, h: 48 }
      );
    }

    for (const dir of Object.keys(DIRS)) {
      if (!exits[dir]) continue;
      props.push(doorProp(dir, Boolean(lockedDirs[dir])));
    }

    return { solids, props, axes };
  }

  function buildSpecialShell(exits) {
    const solids = [];
    const props = [];
    const doorGap = 180;
    const wall = 70;

    // Top
    if (exits.up) {
      solids.push(
        { x: 0, y: 0, w: (WIDTH - doorGap) / 2, h: wall },
        { x: (WIDTH + doorGap) / 2, y: 0, w: (WIDTH - doorGap) / 2, h: wall }
      );
      props.push(doorProp("up", false));
    } else {
      solids.push({ x: 0, y: 0, w: WIDTH, h: wall });
    }

    // Bottom
    if (exits.down) {
      solids.push(
        { x: 0, y: HEIGHT - wall, w: (WIDTH - doorGap) / 2, h: wall },
        {
          x: (WIDTH + doorGap) / 2,
          y: HEIGHT - wall,
          w: (WIDTH - doorGap) / 2,
          h: wall,
        }
      );
      props.push(doorProp("down", false));
    } else {
      solids.push({ x: 0, y: HEIGHT - wall, w: WIDTH, h: wall });
    }

    // Left
    if (exits.left) {
      solids.push(
        { x: 0, y: wall, w: wall, h: (HEIGHT - 140 - doorGap) / 2 },
        {
          x: 0,
          y: wall + (HEIGHT - 140 - doorGap) / 2 + doorGap,
          w: wall,
          h: (HEIGHT - 140 - doorGap) / 2,
        }
      );
      props.push(doorProp("left", false));
    } else {
      solids.push({ x: 0, y: wall, w: wall, h: HEIGHT - 140 });
    }

    // Right
    if (exits.right) {
      solids.push(
        {
          x: WIDTH - wall,
          y: wall,
          w: wall,
          h: (HEIGHT - 140 - doorGap) / 2,
        },
        {
          x: WIDTH - wall,
          y: wall + (HEIGHT - 140 - doorGap) / 2 + doorGap,
          w: wall,
          h: (HEIGHT - 140 - doorGap) / 2,
        }
      );
      props.push(doorProp("right", false));
    } else {
      solids.push({ x: WIDTH - wall, y: wall, w: wall, h: HEIGHT - 140 });
    }

    props.push(
      { type: "light", x: 180, y: 86, w: 28, h: 12 },
      { type: "light", x: 460, y: 86, w: 28, h: 12 },
      { type: "light", x: 740, y: 86, w: 28, h: 12 }
    );

    return { solids, props };
  }

  function buildSpecialLayout(kind, exits) {
    const shell = buildSpecialShell(exits);
    const solids = shell.solids;
    const props = shell.props;

    if (kind === "mess-hall") {
      // Cafeteria tables + food dispenser wall (clear center aisle)
      props.push(
        { type: "label", x: 390, y: 100, text: "MESS HALL" },
        { type: "counter", x: 120, y: 120, w: 280, h: 44 },
        { type: "counter", x: 560, y: 120, w: 280, h: 44 },
        { type: "table", x: 140, y: 230, w: 150, h: 84 },
        { type: "table", x: 140, y: 340, w: 150, h: 84 },
        { type: "table", x: 670, y: 230, w: 150, h: 84 },
        { type: "table", x: 670, y: 340, w: 150, h: 84 },
        {
          type: "coffee-pot",
          id: "mess-hall-coffee",
          itemId: "coffee",
          pickupLabel: "Pick Up Coffee",
          x: 678,
          y: 248,
          w: 36,
          h: 44,
        },
        { type: "bench", x: 140, y: 430, w: 150, h: 24 },
        { type: "bench", x: 670, y: 430, w: 150, h: 24 },
        { type: "dispenser", x: 150, y: 132, w: 70, h: 24 },
        { type: "dispenser", x: 250, y: 132, w: 70, h: 24 },
        { type: "dispenser", x: 640, y: 132, w: 70, h: 24 },
        { type: "dispenser", x: 740, y: 132, w: 70, h: 24 }
      );
      solids.push(
        { x: 120, y: 120, w: 280, h: 44 },
        { x: 560, y: 120, w: 280, h: 44 },
        { x: 140, y: 230, w: 150, h: 84 },
        { x: 140, y: 340, w: 150, h: 84 },
        { x: 670, y: 230, w: 150, h: 84 },
        { x: 670, y: 340, w: 150, h: 84 }
      );
    } else if (kind === "lodging") {
      // Bunk rooms on the sides with a clear center corridor to the door
      props.push(
        { type: "label", x: 400, y: 100, text: "LODGING" },
        { type: "bunk", x: 100, y: 140, w: 200, h: 120 },
        { type: "bunk", x: 100, y: 300, w: 200, h: 120 },
        { type: "bunk", x: 660, y: 140, w: 200, h: 120 },
        { type: "bunk", x: 660, y: 300, w: 200, h: 120 },
        { type: "locker", x: 320, y: 160, w: 48, h: 100 },
        { type: "locker", x: 320, y: 300, w: 48, h: 100 },
        { type: "locker", x: 592, y: 160, w: 48, h: 100 },
        { type: "locker", x: 592, y: 300, w: 48, h: 100 },
        {
          type: "foot-locker",
          id: "lodging-foot-locker",
          interactLabel: "Open Locker",
          requiresKeyId: "lodging-locker-key",
          lockedMessage: "The locker needs a key.",
          containsItemId: "infirmary-key",
          openMessage:
            "You open the foot locker and find a key card to the Infirmary!",
          x: 400,
          y: 415,
          w: 160,
          h: 48,
        }
      );
      solids.push(
        { x: 100, y: 140, w: 200, h: 120 },
        { x: 100, y: 300, w: 200, h: 120 },
        { x: 660, y: 140, w: 200, h: 120 },
        { x: 660, y: 300, w: 200, h: 120 },
        { x: 320, y: 160, w: 48, h: 100 },
        { x: 320, y: 300, w: 48, h: 100 },
        { x: 592, y: 160, w: 48, h: 100 },
        { x: 592, y: 300, w: 48, h: 100 },
        { x: 400, y: 415, w: 160, h: 48 }
      );
    } else if (kind === "supply-room") {
      // Shelves/crates on the sides with a clear center aisle
      props.push(
        { type: "label", x: 380, y: 100, text: "SUPPLY ROOM" },
        { type: "shelf", x: 100, y: 130, w: 70, h: 300 },
        { type: "shelf", x: 190, y: 130, w: 70, h: 300 },
        { type: "shelf", x: 700, y: 130, w: 70, h: 300 },
        { type: "shelf", x: 790, y: 130, w: 70, h: 300 },
        { type: "crate", x: 300, y: 180, w: 90, h: 70 },
        { type: "crate", x: 570, y: 180, w: 90, h: 70 },
        { type: "crate", x: 300, y: 320, w: 90, h: 70 },
        { type: "crate", x: 570, y: 320, w: 90, h: 70 },
        {
          type: "plasma-riffle",
          id: "supply-plasma-riffle",
          itemId: "plasma-riffle",
          pickupLabel: "Pick Up Plasma Riffle",
          pickupMessage:
            "You pick up the Plasma Riffle, but note that it lacks an ammuniiton cartridge. You will need to find that to use it.",
          x: 445,
          y: 118,
          w: 70,
          h: 28,
        }
      );
      solids.push(
        { x: 100, y: 130, w: 70, h: 300 },
        { x: 190, y: 130, w: 70, h: 300 },
        { x: 700, y: 130, w: 70, h: 300 },
        { x: 790, y: 130, w: 70, h: 300 },
        { x: 300, y: 180, w: 90, h: 70 },
        { x: 570, y: 180, w: 90, h: 70 },
        { x: 300, y: 320, w: 90, h: 70 },
        { x: 570, y: 320, w: 90, h: 70 }
      );
    } else if (kind === "engine-room") {
      // Drive core on the stern (right) with a clear entry lane from the left door
      props.push(
        { type: "label", x: 370, y: 100, text: "ENGINE ROOM" },
        { type: "tank", x: 110, y: 110, w: 100, h: 150 },
        { type: "tank", x: 110, y: 320, w: 100, h: 130 },
        { type: "console", x: 260, y: 120, w: 130, h: 70 },
        { type: "console", x: 430, y: 120, w: 130, h: 70 },
        { type: "console", x: 260, y: 390, w: 130, h: 70 },
        { type: "console", x: 430, y: 390, w: 130, h: 70 },
        { type: "pipe", x: 210, y: 170, w: 400, h: 16 },
        { type: "pipe", x: 210, y: 360, w: 400, h: 16 },
        { type: "pipe-vert", x: 400, y: 186, w: 16, h: 174 },
        { type: "reactor", x: 630, y: 140, w: 210, h: 270 },
        { type: "thruster", x: 690, y: 420, w: 110, h: 42 },
        { type: "hazard", x: 250, y: 300, w: 340, h: 14 },
        { type: "panel", x: 560, y: 150, w: 60, h: 90 },
        { type: "panel", x: 560, y: 320, w: 60, h: 90 },
        {
          type: "wounded-crewmate",
          id: "engine-room-crewmate",
          autoTalk: true,
          talkReach: 30,
          givesItemId: "blaster",
          dialogue:
            "Oh, there is someone still alive. I thought everyone was dead. Here, take my blaster. And get out of here. There is an escape pod in mission control. You've got to get there.",
          x: 500,
          y: 245,
          w: 84,
          h: 52,
        }
      );
      solids.push(
        { x: 110, y: 110, w: 100, h: 150 },
        { x: 110, y: 320, w: 100, h: 130 },
        { x: 260, y: 120, w: 130, h: 70 },
        { x: 430, y: 120, w: 130, h: 70 },
        { x: 260, y: 390, w: 130, h: 70 },
        { x: 430, y: 390, w: 130, h: 70 },
        { x: 630, y: 140, w: 210, h: 270 },
        { x: 560, y: 150, w: 60, h: 90 },
        { x: 560, y: 320, w: 60, h: 90 }
      );
    } else if (kind === "infirmary") {
      // Clinical sick bay: beds on the sides, open center, key at the far end
      props.push(
        { type: "label", x: 390, y: 96, text: "INFIRMARY" },
        { type: "med-cross", x: 455, y: 88, w: 50, h: 50 },
        { type: "med-bed", x: 100, y: 140, w: 210, h: 70 },
        { type: "med-bed", x: 100, y: 240, w: 210, h: 70 },
        { type: "med-bed", x: 100, y: 340, w: 210, h: 70 },
        { type: "med-bed", x: 650, y: 140, w: 210, h: 70 },
        { type: "med-bed", x: 650, y: 240, w: 210, h: 70 },
        { type: "med-bed", x: 650, y: 340, w: 210, h: 70 },
        { type: "med-monitor", x: 120, y: 118, w: 54, h: 36 },
        { type: "med-monitor", x: 120, y: 218, w: 54, h: 36 },
        { type: "med-monitor", x: 786, y: 118, w: 54, h: 36 },
        { type: "med-monitor", x: 786, y: 218, w: 54, h: 36 },
        { type: "iv-stand", x: 300, y: 150, w: 18, h: 90 },
        { type: "iv-stand", x: 300, y: 320, w: 18, h: 90 },
        { type: "iv-stand", x: 642, y: 150, w: 18, h: 90 },
        { type: "iv-stand", x: 642, y: 320, w: 18, h: 90 },
        { type: "med-cabinet", x: 360, y: 120, w: 70, h: 90 },
        { type: "med-cabinet", x: 530, y: 120, w: 70, h: 90 },
        { type: "med-scanner", x: 400, y: 250, w: 160, h: 36 },
        {
          type: "key-card",
          id: "infirmary-mission-control-key",
          itemId: "mission-control-key",
          pickupLabel: "Pick Up Key Card",
          pickupMessage:
            "You pick up a key card to the Mission Control Room.",
          x: 448,
          y: 420,
          w: 64,
          h: 36,
        }
      );
      solids.push(
        { x: 100, y: 140, w: 210, h: 70 },
        { x: 100, y: 240, w: 210, h: 70 },
        { x: 100, y: 340, w: 210, h: 70 },
        { x: 650, y: 140, w: 210, h: 70 },
        { x: 650, y: 240, w: 210, h: 70 },
        { x: 650, y: 340, w: 210, h: 70 },
        { x: 360, y: 120, w: 70, h: 90 },
        { x: 530, y: 120, w: 70, h: 90 }
      );
    } else if (kind === "mission-control") {
      // Bridge: side consoles, center command floor, Escape Pod hatch up top
      props.push(
        { type: "label", x: 330, y: 96, text: "MISSION CONTROL" },
        { type: "label", x: 408, y: 36, text: "ESCAPE POD" },
        { type: "holo-screen", x: 300, y: 110, w: 360, h: 90 },
        { type: "console", x: 90, y: 140, w: 130, h: 70 },
        { type: "console", x: 90, y: 250, w: 130, h: 70 },
        { type: "console", x: 90, y: 360, w: 130, h: 70 },
        { type: "console", x: 740, y: 140, w: 130, h: 70 },
        { type: "console", x: 740, y: 250, w: 130, h: 70 },
        { type: "console", x: 740, y: 360, w: 130, h: 70 },
        { type: "command-chair", x: 430, y: 220, w: 100, h: 80 },
        { type: "floor-ring", x: 340, y: 200, w: 280, h: 160 },
        // Dead crew in blood — walkable props
        { type: "dead-astronaut", x: 280, y: 300, w: 70, h: 48, facing: 1 },
        { type: "dead-astronaut", x: 560, y: 170, w: 74, h: 50, facing: -1 },
        { type: "dead-astronaut", x: 390, y: 390, w: 80, h: 52, facing: 1 },
        { type: "dead-astronaut", x: 620, y: 340, w: 68, h: 46, facing: -1 },
        { type: "dead-astronaut", x: 250, y: 180, w: 72, h: 48, facing: 1 }
      );
      // Keep a wide center aisle so the boss can chase from mid-room to the door
      solids.push(
        { x: 90, y: 140, w: 130, h: 70 },
        { x: 90, y: 250, w: 130, h: 70 },
        { x: 90, y: 360, w: 130, h: 70 },
        { x: 740, y: 140, w: 130, h: 70 },
        { x: 740, y: 250, w: 130, h: 70 },
        { x: 740, y: 360, w: 130, h: 70 },
        { x: 300, y: 110, w: 360, h: 36 }
      );
    } else if (kind === "escape-pod") {
      props.push(
        { type: "label", x: 390, y: 100, text: "ESCAPE POD" },
        { type: "pod-bay", x: 280, y: 160, w: 400, h: 260 },
        { type: "console", x: 120, y: 200, w: 120, h: 70 },
        { type: "console", x: 720, y: 200, w: 120, h: 70 }
      );
      solids.push(
        { x: 280, y: 160, w: 400, h: 40 },
        { x: 280, y: 380, w: 400, h: 40 },
        { x: 120, y: 200, w: 120, h: 70 },
        { x: 720, y: 200, w: 120, h: 70 }
      );
    } else {
      // Remaining locked special rooms still get a simple stub layout
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

        const palette = { ...PALETTE };
        if (special?.id === "infirmary") {
          palette.wall = "#6aa8c8";
          palette.wallMid = "#4a88a8";
          palette.wallDark = "#2a6078";
          palette.panel = "#7ec0d8";
          palette.floor = "#8aa8b8";
          palette.floorDark = "#6a8898";
          palette.accent = "#5ee0d8";
          palette.redBand = "#c02840";
        } else if (special?.id === "mission-control") {
          palette.wall = "#6898c8";
          palette.wallMid = "#4878a8";
          palette.wallDark = "#285888";
          palette.panel = "#80b0e0";
          palette.floor = "#8898b8";
          palette.accent = "#40d0f0";
          palette.redBand = "#e02840";
        } else if (special?.id === "escape-pod") {
          palette.wall = "#5a98b0";
          palette.wallMid = "#3a7890";
          palette.wallDark = "#245868";
          palette.panel = "#70b8c8";
          palette.floor = "#7a98a8";
          palette.accent = "#50e0d0";
        } else if (special?.id === "engine-room") {
          palette.wall = "#7088a8";
          palette.wallMid = "#506888";
          palette.wallDark = "#304868";
          palette.panel = "#88a0b8";
          palette.floor = "#908878";
          palette.floorDark = "#706858";
          palette.accentWarm = "#f0a020";
          palette.redBand = "#c04020";
        }

        rooms[id] = {
          id,
          name: label,
          kind: isStart ? "start" : isHall ? "hallway" : "special",
          specialType: special?.id || null,
          locked: Boolean(special?.locked),
          keyId: special?.keyId || null,
          requiresClearId: special?.requiresClearId || null,
          grid: { row, col },
          spawn: { centered: true, y: isHall ? 250 : 260 },
          movement: { axes: layout.axes },
          alarm: isHall || special?.id === "mission-control",
          solids: layout.solids,
          props: layout.props,
          enemies: [],
          exits,
          lockedDirs,
          palette,
        };

        if (isStart) startRoomId = id;
      }
    }

    // Hallway aliens spawn dynamically on room entry (see adventure.js).
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
