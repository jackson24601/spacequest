# Space Quest

A browser-based, space-themed adventure game.

## Play

```bash
python3 -m http.server 8080
```

Open [http://localhost:8080](http://localhost:8080), then click **Begin Quest**.

- Read the ship backstory briefing, then press **Continue**
- Start in the **Starting Scene**; walk connected **Hallway** tiles from the ship map
- Most hallways are left/right; the vertical spine allows up/down; the junction allows both
- Special rooms (Mess Hall, Engine Room, etc.) come later
- Map source files live in `data/`

## Project layout

- `index.html` — title screen, adventure canvas, combat stub
- `js/game/` — adventure loop, ship map, input, rooms, combat placeholder
- `data/` — spaceship map CSV/PDF
- `assets/sprites/` — player and enemy pixel sprites
