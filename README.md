# Space Quest

A browser-based, space-themed adventure game.

## Play

```bash
python3 -m http.server 8080
```

Open [http://localhost:8080](http://localhost:8080), then click **Begin Quest**.

- Read the ship backstory briefing, then press **Continue**
- Move with **Arrow Keys** or **WASD**
- Walk into an alien to enter the combat screen (turn-based combat comes later)
- Ship room maps will be expanded as layouts are provided

## Project layout

- `index.html` — title screen, adventure canvas, combat stub
- `js/game/` — adventure loop, input, rooms, combat placeholder
- `assets/sprites/` — player and enemy pixel sprites
