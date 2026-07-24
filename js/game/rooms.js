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
    corridor: {
      id: "corridor",
      name: "Upper Corridor",
      spawn: { x: 120, y: 300 },
      // Solid blockers: walls, consoles, furniture
      solids: [
        { x: 0, y: 0, w: 960, h: 72 }, // ceiling strip
        { x: 0, y: 468, w: 960, h: 72 }, // floor trim / lower bulkhead
        { x: 0, y: 72, w: 48, h: 396 }, // left wall
        { x: 912, y: 72, w: 48, h: 396 }, // right wall
        { x: 300, y: 140, w: 140, h: 56 }, // ceiling conduit
        { x: 620, y: 320, w: 160, h: 70 }, // cargo crate
      ],
      // Decorative non-colliding props (drawn only)
      props: [
        { type: "panel", x: 70, y: 110, w: 70, h: 110 },
        { type: "panel", x: 820, y: 110, w: 70, h: 110 },
        { type: "door", x: 430, y: 72, w: 100, h: 18 },
        { type: "stripe", x: 48, y: 250, w: 864, h: 18 },
      ],
      enemies: [
        {
          id: "slime-1",
          x: 700,
          y: 240,
          w: 48,
          h: 72,
          name: "Sludge Alien",
        },
      ],
      // Future: exits to other rooms once maps are provided
      exits: [],
      palette: {
        floor: "#6d6a7a",
        wall: "#2a3d5c",
        wallDark: "#1a2740",
        accent: "#3ec7c0",
        accentWarm: "#e0b245",
        metal: "#8fa0b8",
      },
    },
  },

  startRoomId: "corridor",
};
