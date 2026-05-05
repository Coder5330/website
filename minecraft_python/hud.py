import pygame as pg
import moderngl as mgl
import numpy as np
from item_icons import get_item_icons
from settings import (
    SAND, GRASS, DIRT, STONE, SNOW, LEAVES, WOOD,
    BEDROCK, DEEPSLATE, LAVA,
    COAL_ORE, IRON_ORE, COPPER_ORE, GOLD_ORE,
    REDSTONE_ORE, DIAMOND_ORE, DEEPSLATE_DIAMOND_ORE,
    ITEM_WOOD_PICK, ITEM_STONE_PICK, ITEM_IRON_PICK,
    ITEM_DIAMOND_PICK, ITEM_NETHERITE_PICK,
    ITEM_PLANK, ITEM_STICK,
    ITEM_APPLE, ITEM_PORKCHOP, ITEM_BEEF, ITEM_MUTTON,
    BLOCK_REQUIRED_TIER, PICKAXE_TIERS, TOOL_TIER_NONE,
)
from hud_inv import draw_inventory

BLOCK_NAMES = {
    SAND:   'Sand',
    GRASS:  'Grass',
    DIRT:   'Dirt',
    STONE:  'Stone',
    SNOW:   'Snow',
    LEAVES: 'Leaves',
    WOOD:   'Wood',
    # Deep
    BEDROCK:   'Bedrock',
    DEEPSLATE: 'Deepslate',
    LAVA:      'Lava',
    # Ores
    COAL_ORE:             'Coal Ore',
    IRON_ORE:             'Iron Ore',
    COPPER_ORE:           'Copper Ore',
    GOLD_ORE:             'Gold Ore',
    REDSTONE_ORE:         'Redstone Ore',
    DIAMOND_ORE:          'Diamond Ore',
    DEEPSLATE_DIAMOND_ORE:'Deepslate Diamond Ore',
    # Pickaxes
    ITEM_WOOD_PICK:      'Wooden Pickaxe',
    ITEM_STONE_PICK:     'Stone Pickaxe',
    ITEM_IRON_PICK:      'Iron Pickaxe',
    ITEM_DIAMOND_PICK:   'Diamond Pickaxe',
    ITEM_NETHERITE_PICK: 'Netherite Pickaxe',
    ITEM_PLANK:          'Planks',
    ITEM_STICK:          'Stick',
    # Food
    ITEM_APPLE:          'Apple',
    ITEM_PORKCHOP:       'Porkchop',
    ITEM_BEEF:           'Beef',
    ITEM_MUTTON:         'Mutton',
}

BLOCK_COLORS = {
    SAND:   (219, 203, 144),
    GRASS:  (106, 168,  79),
    DIRT:   (134,  96,  67),
    STONE:  (136, 136, 136),
    SNOW:   (240, 245, 255),
    LEAVES: ( 60, 120,  50),
    WOOD:   (102,  81,  51),
    # Deep
    BEDROCK:   ( 50,  50,  50),
    DEEPSLATE: ( 80,  80,  90),
    LAVA:      (220,  80,  10),
    # Ores — stone base with colored fleck shown as icon tint
    COAL_ORE:             ( 50,  50,  50),
    IRON_ORE:             (180, 130, 100),
    COPPER_ORE:           (180, 110,  60),
    GOLD_ORE:             (220, 190,  40),
    REDSTONE_ORE:         (180,  30,  30),
    DIAMOND_ORE:          ( 40, 190, 210),
    DEEPSLATE_DIAMOND_ORE:( 20, 150, 175),
    # Pickaxes
    ITEM_WOOD_PICK:      (180, 140,  80),
    ITEM_STONE_PICK:     (160, 160, 160),
    ITEM_IRON_PICK:      (200, 200, 210),
    ITEM_DIAMOND_PICK:   ( 80, 220, 230),
    ITEM_NETHERITE_PICK: ( 80,  60,  80),
    ITEM_PLANK:          (181, 145,  92),
    ITEM_STICK:          (166, 126,  70),
    # Food
    ITEM_APPLE:          (200,  40,  40),
    ITEM_PORKCHOP:       (210, 120,  80),
    ITEM_BEEF:           (160,  60,  40),
    ITEM_MUTTON:         (180, 100,  70),
}

# Tool-tier names shown in the tooltip
TIER_NAMES = {0: '', 1: '[Wood+]', 2: '[Stone+]', 3: '[Iron+]', 4: '[Diamond+]', 5: '[Netherite+]'}

HOTBAR_SLOTS = 9
SLOT_SIZE    = 50
SLOT_PAD     = 4
ICON_SIZE    = SLOT_SIZE - 18
HEART_W      = 18
HUNGER_W     = 18


class HUD:
    def __init__(self, app):
        self.app = app
        self.ctx = app.ctx
        self.W   = app.WIN_W
        self.H   = app.WIN_H

        pg.font.init()
        self._font_sm = pg.font.SysFont('Arial', 13, bold=True)
        self._font_xs = pg.font.SysFont('Arial', 11)

        self._heart_img  = self._make_heart(HEART_W)
        self._hunger_img = self._make_drumstick(HUNGER_W)
        self._item_icons = get_item_icons(ICON_SIZE)

        self._surf = pg.Surface((self.W, self.H), pg.SRCALPHA)

        self._tex = self.ctx.texture((self.W, self.H), 4)
        self._tex.filter = (mgl.NEAREST, mgl.NEAREST)

        self._prog = self.ctx.program(
            vertex_shader="""
                #version 330
                in vec2 in_pos;
                in vec2 in_uv;
                out vec2 uv;
                void main() { uv = in_uv; gl_Position = vec4(in_pos, 0.0, 1.0); }
            """,
            fragment_shader="""
                #version 330
                uniform sampler2D tex;
                in vec2 uv;
                out vec4 f_color;
                void main() { f_color = texture(tex, uv); }
            """,
        )
        quad = np.array([
            -1, -1,  0, 1,
             1, -1,  1, 1,
             1,  1,  1, 0,
            -1,  1,  0, 0,
        ], dtype='f4')
        idx = np.array([0, 1, 2, 0, 2, 3], dtype='u4')
        self._vao = self.ctx.vertex_array(
            self._prog,
            [(self.ctx.buffer(quad), '2f 2f', 'in_pos', 'in_uv')],
            self.ctx.buffer(idx),
        )

    # ── sprite builders ──────────────────────────────────────────────────────

    def _make_heart(self, size):
        s = pg.Surface((size, size), pg.SRCALPHA)
        r = (220, 30, 30)
        d = size // 4
        pg.draw.circle(s, r, (d,   d), d)
        pg.draw.circle(s, r, (3*d, d), d)
        pg.draw.polygon(s, r, [(0, d), (size//2, size-1), (size-1, d)])
        return s

    def _make_drumstick(self, size):
        s = pg.Surface((size, size), pg.SRCALPHA)
        c = (180, 120, 50)
        pg.draw.ellipse(s, c, (1, size//4, size-4, size//2))
        pg.draw.line(s, (210, 175, 130), (size-3, size//4), (size-3, 3*size//4), 3)
        return s

    # ── slot drawing ─────────────────────────────────────────────────────────

    def _draw_durability_bar(self, surf, x, y, slot):
        max_durability = slot.get('max_durability')
        if not max_durability:
            return

        durability = max(0, slot.get('durability', max_durability))
        ratio = durability / max_durability
        bar_x = x + 5
        bar_y = y + SLOT_SIZE - 8
        bar_w = SLOT_SIZE - 10
        bar_h = 4
        fill_w = max(1, int(bar_w * ratio)) if durability > 0 else 0
        color = (
            int((1.0 - ratio) * 220),
            int(ratio * 220),
            40,
        )

        pg.draw.rect(surf, (0, 0, 0, 180), (bar_x, bar_y, bar_w, bar_h), border_radius=2)
        if fill_w > 0:
            pg.draw.rect(surf, color, (bar_x, bar_y, fill_w, bar_h), border_radius=2)

    def _draw_slot(self, surf, x, y, selected, slot):
        voxel_id = slot['id']
        count = slot['count']
        bg     = (200, 170, 80, 220) if selected else (60, 60, 60, 200)
        border = (255, 210, 60, 255) if selected else (20, 20, 20, 220)
        pg.draw.rect(surf, bg,     (x, y, SLOT_SIZE, SLOT_SIZE), border_radius=4)
        pg.draw.rect(surf, border, (x, y, SLOT_SIZE, SLOT_SIZE), 2, border_radius=4)

        if voxel_id and count > 0:
            ix = x + (SLOT_SIZE - ICON_SIZE) // 2
            iy = y + 8
            icon = self._item_icons.get(voxel_id)
            if icon is not None:
                surf.blit(icon, (ix, iy))
            else:
                col   = BLOCK_COLORS.get(voxel_id, (150, 150, 150))
                light = tuple(min(255, c + 50) for c in col)
                dark  = tuple(max(0,   c - 50) for c in col)
                pg.draw.rect(surf, col, (ix, iy, ICON_SIZE, ICON_SIZE))
                top_pts = [
                    (ix,           iy),
                    (ix+ICON_SIZE, iy),
                    (ix+ICON_SIZE-6, iy-6),
                    (ix-6,           iy-6),
                ]
                pg.draw.polygon(surf, light, top_pts)
                right_pts = [
                    (ix+ICON_SIZE,   iy),
                    (ix+ICON_SIZE,   iy+ICON_SIZE),
                    (ix+ICON_SIZE-6, iy+ICON_SIZE-6),
                    (ix+ICON_SIZE-6, iy-6),
                ]
                pg.draw.polygon(surf, dark, right_pts)

            if count > 1:
                lbl = self._font_xs.render(str(count), True, (255, 255, 255))
                surf.blit(lbl, (x + SLOT_SIZE - lbl.get_width() - 3,
                                y + SLOT_SIZE - lbl.get_height() - 2))

            self._draw_durability_bar(surf, x, y, slot)

    def _draw_hearts(self, surf, hp, cx, y):
        n = 10
        total_w = n * (HEART_W + 2)
        sx = cx - total_w // 2
        for i in range(n):
            filled = hp - i * 2
            alpha = 255 if filled >= 2 else 160 if filled == 1 else 50
            img = self._heart_img.copy()
            img.set_alpha(alpha)
            surf.blit(img, (sx + i * (HEART_W + 2), y))

    def _draw_hunger(self, surf, hunger, cx, y):
        n = 10
        total_w = n * (HUNGER_W + 2)
        sx = cx - total_w // 2
        for i in range(n):
            filled = hunger - i * 2
            alpha = 255 if filled >= 2 else 160 if filled == 1 else 50
            img = self._hunger_img.copy()
            img.set_alpha(alpha)
            surf.blit(img, (sx + i * (HUNGER_W + 2), y))

    def _draw_chat(self, surf):
        x = 16
        y = 16
        for message in self.app.chat_messages[-6:]:
            color = (255, 220, 120) if message.get('system') else (255, 255, 255)
            label = f"{message['name']}: {message['text']}" if not message.get('system') else message['text']
            text = self._font_sm.render(label, True, color)
            surf.blit(text, (x, y))
            y += text.get_height() + 4

        if self.app.chat_open:
            prompt = self._font_sm.render(f"> {self.app.chat_input}", True, (255, 255, 255))
            bg_w = min(self.W - 32, max(220, prompt.get_width() + 16))
            bg_h = prompt.get_height() + 14
            bg_y = self.H - bg_h - 18
            pg.draw.rect(surf, (0, 0, 0, 180), (16, bg_y, bg_w, bg_h), border_radius=6)
            surf.blit(prompt, (24, bg_y + 7))

    def _draw_match_status(self, surf):
        if not self.app.match_over or not self.app.match_status:
            return
        label = self._font_sm.render(self.app.match_status, True, (255, 90, 90))
        box_w = label.get_width() + 24
        box_h = label.get_height() + 16
        x = self.W // 2 - box_w // 2
        y = 24
        pg.draw.rect(surf, (0, 0, 0, 190), (x, y, box_w, box_h), border_radius=8)
        surf.blit(label, (self.W // 2 - label.get_width() // 2, y + 8))

    # ── coords display ───────────────────────────────────────────────────────

    def _draw_coords(self, surf):
        p = self.app.player.position
        lines = [f'You:  X={p.x:.1f}  Y={p.y:.1f}  Z={p.z:.1f}']

        multiplayer = getattr(self.app, 'multiplayer', None)
        if multiplayer:
            for remote in multiplayer.remote_players.values():
                pos = remote.get('position')
                name = remote.get('name', '?')
                if pos:
                    lines.append(f'{name}:  X={pos[0]:.1f}  Y={pos[1]:.1f}  Z={pos[2]:.1f}')
                else:
                    lines.append(f'{name}:  (no position yet)')

        for i, line in enumerate(lines):
            color = (100, 255, 100) if i == 0 else (255, 200, 100)
            txt = self._font_sm.render(line, True, color)
            bg = pg.Surface((txt.get_width() + 8, txt.get_height() + 4), pg.SRCALPHA)
            bg.fill((0, 0, 0, 140))
            surf.blit(bg, (8, 8 + i * 20))
            surf.blit(txt, (12, 10 + i * 20))

    # ── main render ───────────────────────────────────────────────────────────

    def render(self):
        inv  = self.app.inventory
        W, H = self.W, self.H
        surf = self._surf
        surf.fill((0, 0, 0, 0))

        bar_w = HOTBAR_SLOTS * (SLOT_SIZE + SLOT_PAD) - SLOT_PAD
        bar_x = W // 2 - bar_w // 2
        bar_y = H - SLOT_SIZE - 150

        stat_y = bar_y - HEART_W - 8
        mid    = W // 2
        self._draw_hearts(surf, self.app.player_health, mid - bar_w // 4, stat_y)
        self._draw_hunger(surf, inv.hunger,              mid + bar_w // 4, stat_y)

        for i in range(HOTBAR_SLOTS):
            sx   = bar_x + i * (SLOT_SIZE + SLOT_PAD)
            slot = inv.hotbar[i]
            self._draw_slot(surf, sx, bar_y, i == inv.selected_slot, slot)
            num = self._font_xs.render(str(i + 1), True, (180, 180, 180))
            surf.blit(num, (sx + 3, bar_y + 2))

        # selected block / tool name + required tier hint
        sel_slot = inv.slots[inv.selected_slot]
        sel_id = inv.selected_item_id()
        if sel_id:
            name = BLOCK_NAMES.get(sel_id, f'Block #{sel_id}')
            req_tier = BLOCK_REQUIRED_TIER.get(sel_id, TOOL_TIER_NONE)
            tier_hint = TIER_NAMES.get(req_tier, '')
            display = f'{name}  {tier_hint}' if tier_hint else name
            if sel_slot.get('max_durability'):
                display = f"{display} ({sel_slot.get('durability', 0)}/{sel_slot['max_durability']})"
            lbl = self._font_sm.render(display, True, (255, 255, 255))
            surf.blit(lbl, (W // 2 - lbl.get_width() // 2, stat_y - 18))

        # crosshair
        cx, cy = W // 2, H // 2
        pg.draw.line(surf, (255, 255, 255, 200), (cx-10, cy), (cx+10, cy), 2)
        pg.draw.line(surf, (255, 255, 255, 200), (cx, cy-10), (cx, cy+10), 2)

        # inventory / crafting overlay
        if self.app.inventory.crafting_open:
            draw_inventory(surf, self.app.inventory, W, H,
                           self._font_sm, self._font_xs,
                           self.app.inventory._held_item)
        elif self.app.inventory.crafting_table_open:
            from hud_inv import draw_crafting_table
            draw_crafting_table(surf, self.app.inventory, W, H,
                                self._font_sm, self._font_xs,
                                self.app.inventory._held_item)

        self._draw_coords(surf)
        self._draw_chat(surf)
        self._draw_match_status(surf)

        # upload to GL and draw
        raw = pg.image.tostring(surf, 'RGBA', False)
        self._tex.write(raw)
        self._tex.use(location=5)
        self._prog['tex'] = 5

        self.ctx.disable(mgl.DEPTH_TEST)
        self.ctx.disable(mgl.CULL_FACE)
        self._vao.render()
        self.ctx.enable(mgl.DEPTH_TEST)
        self.ctx.enable(mgl.CULL_FACE)