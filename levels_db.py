import sqlite3
import json
from dataclasses import dataclass
from typing import List, Optional


DB_NAME = "levels.db"


@dataclass
class Level:
    id: Optional[int]
    name: str
    speed: int
    grid_width: int
    grid_height: int
    target_score: int
    wrap_edges: bool
    walls: List[tuple]  # list of (x, y) grid coordinates


def get_connection():
    return sqlite3.connect(DB_NAME)


def init_db_with_defaults():
    """Create the levels table and insert default levels if empty."""
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS levels (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            speed INTEGER NOT NULL,
            grid_width INTEGER NOT NULL,
            grid_height INTEGER NOT NULL,
            target_score INTEGER NOT NULL,
            wrap_edges INTEGER NOT NULL,
            walls_json TEXT NOT NULL
        )
        """
    )
    conn.commit()

    cur.execute("SELECT COUNT(*) FROM levels")
    count = cur.fetchone()[0]
    if count == 0:
        default_levels = [
            Level(
                id=None,
                name="Classic Wide",
                speed=8,
                grid_width=32,
                grid_height=24,
                target_score=10,
                wrap_edges=False,
                walls=[],
            ),
            Level(
                id=None,
                name="Boxed In",
                speed=10,
                grid_width=28,
                grid_height=20,
                target_score=15,
                wrap_edges=False,
                walls=_border_walls(28, 20),
            ),
            Level(
                id=None,
                name="Portal Wrap",
                speed=12,
                grid_width=26,
                grid_height=18,
                target_score=20,
                wrap_edges=True,
                walls=_center_cross_walls(26, 18),
            ),
        ]
        for lvl in default_levels:
            insert_level(conn, lvl)

    conn.close()


def _border_walls(w: int, h: int) -> List[tuple]:
    walls = []
    for x in range(w):
        walls.append((x, 0))
        walls.append((x, h - 1))
    for y in range(h):
        walls.append((0, y))
        walls.append((w - 1, y))
    return walls


def _center_cross_walls(w: int, h: int) -> List[tuple]:
    walls = []
    mid_x = w // 2
    mid_y = h // 2
    for x in range(w // 3, 2 * w // 3):
        walls.append((x, mid_y))
    for y in range(h // 3, 2 * h // 3):
        walls.append((mid_x, y))
    return walls


def insert_level(conn: sqlite3.Connection, level: Level) -> int:
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO levels (name, speed, grid_width, grid_height, target_score, wrap_edges, walls_json)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            level.name,
            level.speed,
            level.grid_width,
            level.grid_height,
            level.target_score,
            1 if level.wrap_edges else 0,
            json.dumps(level.walls),
        ),
    )
    conn.commit()
    return cur.lastrowid


def add_random_level(name_suffix: str = "") -> Level:
    """Create and save a random level configuration."""
    import random

    conn = get_connection()
    grid_w = random.choice([20, 24, 28, 32])
    grid_h = random.choice([16, 18, 20, 24])
    speed = random.randint(8, 14)
    target_score = random.randint(8, 25)
    wrap_edges = random.choice([True, False])

    num_walls = random.randint(10, 30)
    walls = []
    for _ in range(num_walls):
        x = random.randint(0, grid_w - 1)
        y = random.randint(0, grid_h - 1)
        walls.append((x, y))

    level = Level(
        id=None,
        name=f"Random {name_suffix}".strip() or "Random",
        speed=speed,
        grid_width=grid_w,
        grid_height=grid_h,
        target_score=target_score,
        wrap_edges=wrap_edges,
        walls=walls,
    )
    level.id = insert_level(conn, level)
    conn.close()
    return level


def load_levels() -> List[Level]:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, name, speed, grid_width, grid_height, target_score, wrap_edges, walls_json FROM levels ORDER BY id"
    )
    rows = cur.fetchall()
    conn.close()

    levels = []
    for row in rows:
        lvl_id, name, speed, gw, gh, target, wrap_edges, walls_json = row
        walls = json.loads(walls_json)
        levels.append(
            Level(
                id=lvl_id,
                name=name,
                speed=speed,
                grid_width=gw,
                grid_height=gh,
                target_score=target,
                wrap_edges=bool(wrap_edges),
                walls=[tuple(w) for w in walls],
            )
        )
    return levels



