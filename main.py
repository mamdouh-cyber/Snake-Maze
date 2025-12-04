import sys
import random

import pygame

from levels_db import init_db_with_defaults, load_levels, add_random_level, Level


WINDOW_WIDTH = 960
WINDOW_HEIGHT = 720
FPS_MENU = 60

COLOR_BG = (14, 17, 23)
COLOR_GRID = (30, 35, 45)
COLOR_SNAKE = (46, 204, 113)
COLOR_SNAKE_HEAD = (39, 174, 96)
COLOR_FOOD = (231, 76, 60)
COLOR_WALL = (52, 73, 94)
COLOR_TEXT = (236, 240, 241)
COLOR_TEXT_DIM = (127, 140, 141)
COLOR_HIGHLIGHT = (241, 196, 15)


pygame.init()
pygame.display.set_caption("Modern Snake with Levels")
screen = pygame.display.set_mode((WINDOW_WIDTH, WINDOW_HEIGHT))
clock = pygame.time.Clock()
font_large = pygame.font.SysFont("segoeui", 56)
font_medium = pygame.font.SysFont("segoeui", 32)
font_small = pygame.font.SysFont("segoeui", 22)


class SnakeGame:
    def __init__(self, level: Level):
        self.level = level
        self.grid_w = level.grid_width
        self.grid_h = level.grid_height
        self.cell_size = min(WINDOW_WIDTH // self.grid_w, (WINDOW_HEIGHT - 80) // self.grid_h)
        grid_px_w = self.cell_size * self.grid_w
        grid_px_h = self.cell_size * self.grid_h
        self.grid_origin_x = (WINDOW_WIDTH - grid_px_w) // 2
        self.grid_origin_y = (WINDOW_HEIGHT - grid_px_h) // 2

        self.speed = level.speed
        self.wrap_edges = level.wrap_edges
        self.target_score = level.target_score
        self.score = 0

        self.direction = (1, 0)
        self.pending_dir = (1, 0)
        self.snake = []
        self._init_snake()
        self.walls = set(level.walls)
        self.food = None
        self.spawn_food()
        self.game_over = False
        self.win = False
        self.move_timer = 0.0

    def _init_snake(self):
        start_x = self.grid_w // 3
        start_y = self.grid_h // 2
        self.snake = [(start_x - i, start_y) for i in range(4)]

    def spawn_food(self):
        free_cells = [
            (x, y)
            for x in range(self.grid_w)
            for y in range(self.grid_h)
            if (x, y) not in self.snake and (x, y) not in self.walls
        ]
        if not free_cells:
            self.win = True
            return
        self.food = random.choice(free_cells)

    def handle_input(self, events):
        for e in events:
            if e.type == pygame.KEYDOWN:
                if e.key in (pygame.K_UP, pygame.K_w):
                    if self.direction != (0, 1):
                        self.pending_dir = (0, -1)
                elif e.key in (pygame.K_DOWN, pygame.K_s):
                    if self.direction != (0, -1):
                        self.pending_dir = (0, 1)
                elif e.key in (pygame.K_LEFT, pygame.K_a):
                    if self.direction != (1, 0):
                        self.pending_dir = (-1, 0)
                elif e.key in (pygame.K_RIGHT, pygame.K_d):
                    if self.direction != (-1, 0):
                        self.pending_dir = (1, 0)

    def update(self, dt: float):
        if self.game_over or self.win:
            return

        self.move_timer += dt
        step_interval = 1.0 / self.speed
        while self.move_timer >= step_interval:
            self.move_timer -= step_interval
            self._step_snake()

    def _step_snake(self):
        self.direction = self.pending_dir
        head_x, head_y = self.snake[0]
        dx, dy = self.direction
        new_x = head_x + dx
        new_y = head_y + dy

        if self.wrap_edges:
            new_x %= self.grid_w
            new_y %= self.grid_h
        else:
            if not (0 <= new_x < self.grid_w and 0 <= new_y < self.grid_h):
                self.game_over = True
                return

        new_head = (new_x, new_y)

        if new_head in self.walls or (new_head in self.snake[:-1]):
            self.game_over = True
            return

        self.snake.insert(0, new_head)

        if self.food and new_head == self.food:
            self.score += 1
            if self.score >= self.target_score:
                self.win = True
            else:
                self.spawn_food()
        else:
            self.snake.pop()

    def draw(self, surf: pygame.Surface):
        surf.fill(COLOR_BG)

        title = font_large.render("Snake Levels", True, COLOR_TEXT)
        surf.blit(title, (WINDOW_WIDTH // 2 - title.get_width() // 2, 16))

        score_text = font_medium.render(
            f"Score: {self.score} / {self.target_score}", True, COLOR_TEXT
        )
        surf.blit(score_text, (20, WINDOW_HEIGHT - 60))

        info = font_small.render(
            f"Level: {self.level.name}  |  Speed: {self.speed}  |  Wrap: {'ON' if self.wrap_edges else 'OFF'}",
            True,
            COLOR_TEXT_DIM,
        )
        surf.blit(info, (20, WINDOW_HEIGHT - 32))

        grid_px_w = self.cell_size * self.grid_w
        grid_px_h = self.cell_size * self.grid_h
        grid_rect = pygame.Rect(
            self.grid_origin_x, self.grid_origin_y, grid_px_w, grid_px_h
        )
        pygame.draw.rect(surf, COLOR_GRID, grid_rect, border_radius=12)

        for x in range(self.grid_w):
            for y in range(self.grid_h):
                if (x + y) % 2 == 0:
                    cell_rect = pygame.Rect(
                        self.grid_origin_x + x * self.cell_size,
                        self.grid_origin_y + y * self.cell_size,
                        self.cell_size,
                        self.cell_size,
                    )
                    pygame.draw.rect(
                        surf,
                        (22, 27, 34),
                        cell_rect,
                        border_radius=4,
                    )

        for wx, wy in self.walls:
            rect = pygame.Rect(
                self.grid_origin_x + wx * self.cell_size,
                self.grid_origin_y + wy * self.cell_size,
                self.cell_size,
                self.cell_size,
            )
            pygame.draw.rect(surf, COLOR_WALL, rect, border_radius=4)

        if self.food:
            fx, fy = self.food
            rect = pygame.Rect(
                self.grid_origin_x + fx * self.cell_size + 4,
                self.grid_origin_y + fy * self.cell_size + 4,
                self.cell_size - 8,
                self.cell_size - 8,
            )
            pygame.draw.rect(surf, COLOR_FOOD, rect, border_radius=10)

        for i, (sx, sy) in enumerate(self.snake):
            rect = pygame.Rect(
                self.grid_origin_x + sx * self.cell_size + 2,
                self.grid_origin_y + sy * self.cell_size + 2,
                self.cell_size - 4,
                self.cell_size - 4,
            )
            color = COLOR_SNAKE_HEAD if i == 0 else COLOR_SNAKE
            pygame.draw.rect(surf, color, rect, border_radius=6)

        if self.game_over:
            self._draw_center_message(surf, "Game Over", "Press ESC to return")
        elif self.win:
            self._draw_center_message(surf, "Level Cleared!", "Press ESC to return")

    def _draw_center_message(self, surf, title, subtitle):
        overlay = pygame.Surface((WINDOW_WIDTH, WINDOW_HEIGHT), pygame.SRCALPHA)
        overlay.fill((0, 0, 0, 160))
        surf.blit(overlay, (0, 0))

        t = font_large.render(title, True, COLOR_HIGHLIGHT)
        s = font_medium.render(subtitle, True, COLOR_TEXT)
        surf.blit(t, (WINDOW_WIDTH // 2 - t.get_width() // 2, WINDOW_HEIGHT // 2 - 60))
        surf.blit(
            s, (WINDOW_WIDTH // 2 - s.get_width() // 2, WINDOW_HEIGHT // 2 + 10)
        )


def main_menu():
    init_db_with_defaults()
    levels = load_levels()
    selected = 0
    running = True

    while running:
        dt = clock.tick(FPS_MENU) / 1000.0
        events = pygame.event.get()
        for e in events:
            if e.type == pygame.QUIT:
                pygame.quit()
                sys.exit()
            if e.type == pygame.KEYDOWN:
                if e.key in (pygame.K_ESCAPE, pygame.K_q):
                    pygame.quit()
                    sys.exit()
                elif e.key in (pygame.K_UP, pygame.K_w):
                    selected = (selected - 1) % len(levels)
                elif e.key in (pygame.K_DOWN, pygame.K_s):
                    selected = (selected + 1) % len(levels)
                elif e.key == pygame.K_RETURN:
                    run_game(levels[selected])
                elif e.key == pygame.K_n:
                    new_level = add_random_level(name_suffix=str(len(levels) + 1))
                    levels = load_levels()
                    selected = len(levels) - 1

        screen.fill(COLOR_BG)
        title = font_large.render("Snake Levels", True, COLOR_TEXT)
        screen.blit(title, (WINDOW_WIDTH // 2 - title.get_width() // 2, 40))

        subtitle = font_small.render(
            "Use UP/DOWN to choose a level, Enter to play, N to create random level, Esc to quit",
            True,
            COLOR_TEXT_DIM,
        )
        screen.blit(
            subtitle,
            (WINDOW_WIDTH // 2 - subtitle.get_width() // 2, 110),
        )

        list_top = 170
        for i, lvl in enumerate(levels):
            is_sel = i == selected
            color = COLOR_HIGHLIGHT if is_sel else COLOR_TEXT
            txt = font_medium.render(
                f"{lvl.id:02d}. {lvl.name} (speed {lvl.speed}, target {lvl.target_score}, wrap {'ON' if lvl.wrap_edges else 'OFF'})",
                True,
                color,
            )
            x = WINDOW_WIDTH // 2 - txt.get_width() // 2
            y = list_top + i * 40
            screen.blit(txt, (x, y))
            if is_sel:
                pygame.draw.rect(
                    screen,
                    COLOR_HIGHLIGHT,
                    pygame.Rect(x - 20, y - 4, txt.get_width() + 40, txt.get_height() + 8),
                    2,
                    border_radius=8,
                )

        pygame.display.flip()


def run_game(level: Level):
    game = SnakeGame(level)
    running = True

    while running:
        dt = clock.tick(60) / 1000.0
        events = pygame.event.get()
        for e in events:
            if e.type == pygame.QUIT:
                pygame.quit()
                sys.exit()
            if e.type == pygame.KEYDOWN:
                if e.key == pygame.K_ESCAPE:
                    running = False

        game.handle_input(events)
        game.update(dt)
        game.draw(screen)
        pygame.display.flip()


if __name__ == "__main__":
    main_menu()


