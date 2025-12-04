## Snake Game with Level Database

This is a modern Snake game built with Python and `pygame`.  
It uses an SQLite database to store **levels** (speed, grid size, obstacles, target score, etc.), so levels are persistent and easy to edit.

### Features
- **Multiple levels** loaded from a **SQLite** database.
- Levels define:
  - Snake speed
  - Grid width & height
  - Target score to beat the level
  - Walls/obstacles layout
  - Colors & difficulty
- **Different from classic Nokia Snake**:
  - Levels with unique wall patterns.
  - Optional screen wrap instead of instant death on borders.
  - Smooth animations and modern color palette.

### Requirements

Install dependencies:

```bash
pip install -r requirements.txt
```

### How to Run

```bash
python main.py
```

On first run, a `levels.db` file will be created automatically with some default levels.

### Controls
- **Arrow keys / WASD**: Move the snake
- **Enter**: Select menu item / start game
- **Esc**: Go back or quit from main menu
- **N (in level select)**: Create a random new level and save it to the database

### Files
- `main.py` – game loop, menus, and rendering
- `levels_db.py` – SQLite logic for storing and loading level data


