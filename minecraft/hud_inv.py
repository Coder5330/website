"""
hud_inv.py  —  draws inventory (2×2 crafting) and crafting table (3×3) overlays.
"""
import pygame as pg
from item_icons import get_item_icons
from settings import (
    SAND, GRASS, DIRT, STONE, SNOW, LEAVES, WOOD,
    ITEM_WOOD_PICK, ITEM_STONE_PICK, ITEM_IRON_PICK,
    ITEM_DIAMOND_PICK, ITEM_NETHERITE_PICK,
    ITEM_PLANK, ITEM_STICK, ITEM_CRAFTING_TABLE,
    CRAFTING_TABLE,
)

SLOT_S = 44
PAD    = 4
INV_COLS   = 9
INV_ROWS   = 3
CRAFT_COLS = 2
CRAFT_ROWS = 2
TABLE_COLS = 3
TABLE_ROWS = 3

CRAFT_GAP  = 24
ARROW_W    = 30
OUTPUT_GAP = 14

BLOCK_COLORS = {
    SAND:   (219, 203, 144),
    GRASS:  (106, 168,  79),
    DIRT:   (134,  96,  67),
    STONE:  (136, 136, 136),
    SNOW:   (240, 245, 255),
    LEAVES: ( 60, 120,  50),
    WOOD:   (102,  81,  51),
    CRAFTING_TABLE:      (160, 110,  60),
    ITEM_CRAFTING_TABLE: (160, 110,  60),
    ITEM_PLANK:          (181, 145,  92),
    ITEM_STICK:          (166, 126,  70),
    ITEM_WOOD_PICK:      (180, 140,  80),
    ITEM_STONE_PICK:     (160, 160, 160),
    ITEM_IRON_PICK:      (200, 200, 210),
    ITEM_DIAMOND_PICK:   ( 80, 220, 230),
    ITEM_NETHERITE_PICK: ( 80,  60,  80),
}
BLOCK_NAMES = {
    SAND: 'Sand', GRASS: 'Grass', DIRT: 'Dirt',
    STONE: 'Stone', SNOW: 'Snow', LEAVES: 'Leaves', WOOD: 'Wood',
    CRAFTING_TABLE:      'Crafting Table',
    ITEM_CRAFTING_TABLE: 'Crafting Table',
    ITEM_PLANK: 'Planks',
    ITEM_STICK: 'Stick',
    ITEM_WOOD_PICK:      'Wooden Pickaxe',
    ITEM_STONE_PICK:     'Stone Pickaxe',
    ITEM_IRON_PICK:      'Iron Pickaxe',
    ITEM_DIAMOND_PICK:   'Diamond Pickaxe',
    ITEM_NETHERITE_PICK: 'Netherite Pickaxe',
}


# ── layout helpers ────────────────────────────────────────────────────────────

def get_inventory_layout(W, H):
    """Layout for the personal 2×2 crafting inventory screen."""
    inv_w = INV_COLS * (SLOT_S + PAD) - PAD
    inv_x = W // 2 - inv_w // 2
    inv_y = H // 2 + 30

    craft_h   = CRAFT_ROWS * (SLOT_S + PAD) - PAD
    craft_w   = CRAFT_COLS * (SLOT_S + PAD) - PAD
    total_row = craft_w + CRAFT_GAP + ARROW_W + OUTPUT_GAP + SLOT_S
    craft_x   = W // 2 - total_row // 2
    craft_y   = inv_y - craft_h - 56

    arrow_x = craft_x + craft_w + CRAFT_GAP
    arrow_y = craft_y + craft_h // 2 - 8
    out_x   = arrow_x + ARROW_W + OUTPUT_GAP
    out_y   = craft_y + craft_h // 2 - SLOT_S // 2

    hotbar_y = inv_y + INV_ROWS * (SLOT_S + PAD) + 20

    return {
        'inv_x':    inv_x,
        'inv_y':    inv_y,
        'hotbar_y': hotbar_y,
        'craft_x':  craft_x,
        'craft_y':  craft_y,
        'arrow_x':  arrow_x,
        'arrow_y':  arrow_y,
        'out_x':    out_x,
        'out_y':    out_y,
    }


def get_crafting_table_layout(W, H):
    """Layout for the 3×3 crafting table screen."""
    inv_w = INV_COLS * (SLOT_S + PAD) - PAD
    inv_x = W // 2 - inv_w // 2
    inv_y = H // 2 + 80

    table_h   = TABLE_ROWS * (SLOT_S + PAD) - PAD
    table_w   = TABLE_COLS * (SLOT_S + PAD) - PAD
    total_row = table_w + CRAFT_GAP + ARROW_W + OUTPUT_GAP + SLOT_S
    table_x   = W // 2 - total_row // 2
    table_y   = inv_y - table_h - 70

    arrow_x = table_x + table_w + CRAFT_GAP
    arrow_y = table_y + table_h // 2 - 8
    out_x   = arrow_x + ARROW_W + OUTPUT_GAP
    out_y   = table_y + table_h // 2 - SLOT_S // 2

    hotbar_y = inv_y + INV_ROWS * (SLOT_S + PAD) + 20

    return {
        'inv_x':    inv_x,
        'inv_y':    inv_y,
        'hotbar_y': hotbar_y,
        'table_x':  table_x,
        'table_y':  table_y,
        'arrow_x':  arrow_x,
        'arrow_y':  arrow_y,
        'out_x':    out_x,
        'out_y':    out_y,
    }


# ── slot drawing ──────────────────────────────────────────────────────────────

def _draw_durability_bar(surf, x, y, slot):
    max_durability = slot.get('max_durability')
    if not max_durability:
        return

    durability = max(0, slot.get('durability', max_durability))
    ratio = durability / max_durability
    bar_x = x + 4
    bar_y = y + SLOT_S - 7
    bar_w = SLOT_S - 8
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

def _draw_slot(surf, x, y, slot, font, selected=False, label=None):
    bg     = (200, 170, 80, 220) if selected else (50, 50, 50, 210)
    border = (255, 210, 60, 255) if selected else (20, 20, 20, 200)
    pg.draw.rect(surf, bg,     (x, y, SLOT_S, SLOT_S), border_radius=3)
    pg.draw.rect(surf, border, (x, y, SLOT_S, SLOT_S), 2, border_radius=3)
    if slot and slot['id'] and slot['count'] > 0:
        IS = SLOT_S - 14
        ix = x + (SLOT_S - IS) // 2
        iy = y + (SLOT_S - IS) // 2
        icon = get_item_icons(IS).get(slot['id'])
        if icon is not None:
            surf.blit(icon, (ix, iy))
        else:
            col   = BLOCK_COLORS.get(slot['id'], (150, 150, 150))
            light = tuple(min(255, c + 50) for c in col)
            dark  = tuple(max(0,   c - 50) for c in col)
            pg.draw.rect(surf, col, (ix, iy, IS, IS))
            pg.draw.polygon(surf, light, [
                (ix,      iy),
                (ix + IS, iy),
                (ix + IS - 4, iy - 4),
                (ix - 4,  iy - 4),
            ])
            pg.draw.polygon(surf, dark, [
                (ix + IS, iy),
                (ix + IS, iy + IS),
                (ix + IS - 4, iy + IS - 4),
                (ix + IS - 4, iy - 4),
            ])
        if slot['count'] > 1:
            cnt = font.render(str(slot['count']), True, (255, 255, 255))
            surf.blit(cnt, (x + SLOT_S - cnt.get_width() - 3,
                            y + SLOT_S - cnt.get_height() - 2))
        _draw_durability_bar(surf, x, y, slot)
    if label:
        lsurf = font.render(label, True, (160, 160, 160))
        surf.blit(lsurf, (x + 3, y + 3))


def _draw_arrow(surf, x, y, font_sm):
    arrow = font_sm.render('=>', True, (220, 220, 100))
    surf.blit(arrow, (x, y))


def _draw_inv_rows(surf, inv, inv_x, inv_y, hotbar_y, font_xs, font_sm):
    """Draw the 3-row main inventory and the hotbar row."""
    lbl = font_sm.render('Inventory', True, (200, 200, 200))
    surf.blit(lbl, (inv_x, inv_y - 22))

    for i in range(INV_ROWS * INV_COLS):
        row, col = divmod(i, INV_COLS)
        sx = inv_x + col * (SLOT_S + PAD)
        sy = inv_y + row * (SLOT_S + PAD)
        _draw_slot(surf, sx, sy, inv.slots[i], font_xs)

    hb_lbl = font_xs.render('Hotbar', True, (160, 160, 160))
    surf.blit(hb_lbl, (inv_x, hotbar_y - 15))
    for i in range(9):
        sx = inv_x + i * (SLOT_S + PAD)
        _draw_slot(surf, sx, hotbar_y, inv.slots[i], font_xs,
                   selected=(i == inv.selected_slot), label=str(i + 1))


# ── public draw functions ─────────────────────────────────────────────────────

def draw_inventory(surf, inv, W, H, font_sm, font_xs, held_item):
    """Personal 2×2 inventory crafting screen."""
    dim = pg.Surface((W, H), pg.SRCALPHA)
    dim.fill((0, 0, 0, 140))
    surf.blit(dim, (0, 0))

    layout  = get_inventory_layout(W, H)
    inv_x   = layout['inv_x']
    inv_y   = layout['inv_y']
    craft_x = layout['craft_x']
    craft_y = layout['craft_y']

    # crafting section header
    craft_lbl = font_sm.render('Crafting  (2×2)', True, (255, 220, 100))
    surf.blit(craft_lbl, (craft_x, craft_y - 22))

    for i in range(CRAFT_ROWS * CRAFT_COLS):
        row, col = divmod(i, CRAFT_COLS)
        sx = craft_x + col * (SLOT_S + PAD)
        sy = craft_y + row * (SLOT_S + PAD)
        _draw_slot(surf, sx, sy, inv.craft_grid[i], font_xs)

    _draw_arrow(surf, layout['arrow_x'], layout['arrow_y'], font_sm)
    _draw_slot(surf, layout['out_x'], layout['out_y'], inv.craft_output, font_xs)

    _draw_inv_rows(surf, inv, inv_x, inv_y, layout['hotbar_y'], font_xs, font_sm)

    tip = font_xs.render('E  close  |  Right-click a Crafting Table for 3x3', True, (110, 110, 110))
    surf.blit(tip, (W - tip.get_width() - 10, H - tip.get_height() - 8))

    if held_item and held_item['id'] != 0:
        mx, my = pg.mouse.get_pos()
        _draw_slot(surf, mx - SLOT_S // 2, my - SLOT_S // 2, held_item, font_xs)


def draw_crafting_table(surf, inv, W, H, font_sm, font_xs, held_item):
    """3×3 crafting table screen."""
    dim = pg.Surface((W, H), pg.SRCALPHA)
    dim.fill((0, 0, 0, 140))
    surf.blit(dim, (0, 0))

    layout  = get_crafting_table_layout(W, H)
    inv_x   = layout['inv_x']
    inv_y   = layout['inv_y']
    table_x = layout['table_x']
    table_y = layout['table_y']

    ct_lbl = font_sm.render('Crafting Table  (3x3)', True, (255, 180, 60))
    surf.blit(ct_lbl, (table_x, table_y - 22))

    for i in range(TABLE_ROWS * TABLE_COLS):
        row, col = divmod(i, TABLE_COLS)
        sx = table_x + col * (SLOT_S + PAD)
        sy = table_y + row * (SLOT_S + PAD)
        _draw_slot(surf, sx, sy, inv.craft_table_grid[i], font_xs)

    _draw_arrow(surf, layout['arrow_x'], layout['arrow_y'], font_sm)
    _draw_slot(surf, layout['out_x'], layout['out_y'], inv.craft_table_output, font_xs)

    _draw_inv_rows(surf, inv, inv_x, inv_y, layout['hotbar_y'], font_xs, font_sm)

    tip = font_xs.render('E  close', True, (110, 110, 110))
    surf.blit(tip, (W - tip.get_width() - 10, H - tip.get_height() - 8))

    if held_item and held_item['id'] != 0:
        mx, my = pg.mouse.get_pos()
        _draw_slot(surf, mx - SLOT_S // 2, my - SLOT_S // 2, held_item, font_xs)
