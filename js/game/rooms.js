/**
 * Ship room definitions.
 * Maps can be swapped/extended later without changing the adventure loop.
 *
 * Coordinate space: logical pixels inside the adventure canvas (960x540).
 */
window.SpaceQuestRooms = {
  WIDTH: 960,
  HEIGHT: 540,

  rooms: {
    hallway: {
      id: "hallway",
      name: "Main Hallway",
      // Player is centered in the hallway band (set precisely after sprite size is known)
      spawn: { x: 448, y: 250 },
      // This starting scene only allows left / right travel
      movement: { axes: "horizontal" },
      alarm: true,
      solids: [
        { x: 0, y: 0, w: 960, h: 150 }, // upper bulkhead / ceiling
        { x: 0, y: 390, w: 960, h: 150 }, // lower bulkhead / floor edge
      ],
      props: [
        { type: "panel", x: 90, y: 168, w: 64, h: 96 },
        { type: "panel", x: 806, y: 168, w: 64, h: 96 },
        { type: "panel", x: 280, y: 168, w: 54, h: 80 },
        { type: "panel", x: 626, y: 168, w: 54, h: 80 },
        { type: "stripe", x: 0, y: 318, w: 960, h: 10 },
        { type: "stripe", x: 0, y: 212, w: 960, h: 8 },
        { type: "light", x: 160, y: 126, w: 36, h: 16 },
        { type: "light", x: 360, y: 126, w: 36, h: 16 },
        { type: "light", x: 560, y: 126, w: 36, h: 16 },
        { type: "light", x: 760, y: 126, w: 36, h: 16 },
        { type: "door-side", x: 0, y: 200, w: 28, h: 150 },
        { type: "door-side", x: 932, y: 200, w: 28, h: 150 },
      ],
      // No enemies in the opening hallway beat
      enemies: [],
      exits: [
        // Future room links can hang off left/right ends
      ],
      palette: {
        floor: "#5c5868",
        wall: "#2a3d5c",
        wallDark: "#162338",
        accent: "#3ec7c0",
        accentWarm: "#e0b245",
        metal: "#8fa0b8",
        alarm: "#ff4d4d",
      },
    },
  },

  startRoomId: "hallway",
};
