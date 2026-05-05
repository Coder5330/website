import pygame as pg

from settings import (
    SAND, GRASS, DIRT, STONE, SNOW, LEAVES, WOOD, WATER_BLOCK,
    BEDROCK, DEEPSLATE, LAVA,
    COAL_ORE, IRON_ORE, COPPER_ORE, GOLD_ORE, REDSTONE_ORE, DIAMOND_ORE, DEEPSLATE_DIAMOND_ORE,
    ITEM_WOOD_PICK, ITEM_STONE_PICK, ITEM_IRON_PICK, ITEM_DIAMOND_PICK, ITEM_NETHERITE_PICK,
    ITEM_PLANK, ITEM_STICK, CRAFTING_TABLE, ITEM_CRAFTING_TABLE,
    ITEM_APPLE, ITEM_PORKCHOP, ITEM_BEEF, ITEM_MUTTON,
)


_ICON_CACHE = {}
_SOURCE_CACHE = None
_ASSET_IMAGE_CACHE = {}

ITEM_IMAGE_FILES = {
    ITEM_WOOD_PICK:      'woodenpickaxe.png',
    ITEM_STONE_PICK:     'stonepickaxe.png',
    ITEM_IRON_PICK:      'ironpickaxe.jpg',
    ITEM_DIAMOND_PICK:   'diamondpickaxe.png',
    CRAFTING_TABLE:      'crafting_table.png',
    ITEM_CRAFTING_TABLE: 'crafting_table.png',
}

# These assets have proper alpha channels — don't run white-to-alpha on them
_REAL_ALPHA_ASSETS = {CRAFTING_TABLE, ITEM_CRAFTING_TABLE}


def _white_to_alpha(surface, threshold=245):
    converted = pg.Surface(surface.get_size(), pg.SRCALPHA)
    width, height = surface.get_size()
    for x in range(width):
        for y in range(height):
            color = surface.get_at((x, y))
            alpha = 0 if color.r >= threshold and color.g >= threshold and color.b >= threshold else 255
            converted.set_at((x, y), (color.r, color.g, color.b, alpha))
    return converted


def _load_asset_icon(item_id):
    if item_id in _ASSET_IMAGE_CACHE:
        return _ASSET_IMAGE_CACHE[item_id]
    file_name = ITEM_IMAGE_FILES.get(item_id)
    if not file_name:
        return None

    raw = pg.image.load(f'assets/{file_name}')
    if item_id in _REAL_ALPHA_ASSETS:
        surface = raw.convert_alpha()
    elif raw.get_alpha() is not None:
        surface = raw.convert_alpha()
    else:
        surface = _white_to_alpha(raw.convert())
    _ASSET_IMAGE_CACHE[item_id] = surface
    return surface


def _load_sources():
    global _SOURCE_CACHE
    if _SOURCE_CACHE is not None:
        return _SOURCE_CACHE

    atlas0 = pg.image.load('assets/tex_array_0.png').convert_alpha()
    water = pg.image.load('assets/water.png').convert_alpha()
    ore_sheet = pg.image.load('assets/tex_array_1.png').convert_alpha()

    layer_h = atlas0.get_height() // (3 * atlas0.get_height() // atlas0.get_width())
    tile_w = atlas0.get_width() // 3

    ore_tiles = []
    cols, rows = 4, 2
    for row in range(rows):
        top = round(row * ore_sheet.get_height() / rows)
        bottom = round((row + 1) * ore_sheet.get_height() / rows)
        for col in range(cols):
            left = round(col * ore_sheet.get_width() / cols)
            right = round((col + 1) * ore_sheet.get_width() / cols)
            ore_tiles.append(ore_sheet.subsurface((left, top, right - left, bottom - top)).copy())

    _SOURCE_CACHE = {
        'atlas0': atlas0,
        'water': water,
        'atlas_tile': tile_w,
        'atlas_layer_h': layer_h,
        'ore_tiles': ore_tiles,
    }
    return _SOURCE_CACHE


def _atlas_face(layer, face):
    src = _load_sources()
    atlas0 = src['atlas0']
    tile_w = src['atlas_tile']
    layer_h = src['atlas_layer_h']
    x_map = {'side': 0, 'top': 1, 'bottom': 2}
    rect = pg.Rect(x_map[face] * tile_w, layer * layer_h, tile_w, layer_h)
    return atlas0.subsurface(rect).copy()


def _block_surface(block_id):
    if block_id == WATER_BLOCK:
        return _load_sources()['water'].copy()

    face_map = {
        SAND: ('top', SAND),
        GRASS: ('side', GRASS),
        DIRT: ('top', DIRT),
        STONE: ('top', STONE),
        SNOW: ('top', SNOW),
        LEAVES: ('top', LEAVES),
        WOOD: ('side', WOOD),
        BEDROCK: ('top', STONE),
        DEEPSLATE: ('top', STONE),
        LAVA: ('top', STONE),
        ITEM_PLANK: ('top', WOOD),
    }
    if block_id in face_map:
        face, layer = face_map[block_id]
        return _atlas_face(layer, face)

    ore_map = {
        COAL_ORE: 0,
        IRON_ORE: 1,
        GOLD_ORE: 2,
        DIAMOND_ORE: 3,
        REDSTONE_ORE: 5,
        COPPER_ORE: 7,
        DEEPSLATE_DIAMOND_ORE: 3,
    }
    if block_id in ore_map:
        return _load_sources()['ore_tiles'][ore_map[block_id]].copy()
    return None


def _pick_icon(size, head_color, handle_color):
    surf = pg.Surface((size, size), pg.SRCALPHA)
    px = max(2, size // 8)
    pg.draw.rect(surf, handle_color, (size // 2 - px // 2, size // 3, px, size // 2))
    pg.draw.rect(surf, head_color, (size // 4, size // 4, size // 2, px + 1))
    pg.draw.rect(surf, head_color, (size // 4, size // 4, px + 1, size // 4))
    return surf


def _custom_item_surface(item_id, size):
    asset_icon = _load_asset_icon(item_id)
    if asset_icon is not None:
        return pg.transform.scale(asset_icon, (size, size))

    if item_id == ITEM_STICK:
        surf = pg.Surface((size, size), pg.SRCALPHA)
        color = (166, 126, 70)
        width = max(2, size // 8)
        pg.draw.line(surf, color, (size // 3, size - size // 5), (size - size // 3, size // 5), width)
        return surf

    # Food icons
    food_colors = {
        ITEM_APPLE:    (200,  40,  40),
        ITEM_PORKCHOP: (210, 120,  80),
        ITEM_BEEF:     (160,  60,  40),
        ITEM_MUTTON:   (180, 100,  70),
    }
    if item_id in food_colors:
        surf = pg.Surface((size, size), pg.SRCALPHA)
        col = food_colors[item_id]
        if item_id == ITEM_APPLE:
            pg.draw.ellipse(surf, col, (size//8, size//4, 3*size//4, 3*size//4))
            pg.draw.line(surf, (80, 160, 60), (size//2, size//8), (size//2, size//3), max(2, size//10))
        else:
            # meat leg shape
            pg.draw.ellipse(surf, col, (size//6, size//4, 2*size//3, size//2))
            pg.draw.rect(surf, (210, 190, 160), (size//3, size*5//8, size//4, size//3))
        return surf

    pick_colors = {
        ITEM_WOOD_PICK: ((184, 144, 86), (116, 84, 52)),
        ITEM_STONE_PICK: ((160, 160, 160), (116, 84, 52)),
        ITEM_IRON_PICK: ((212, 212, 222), (116, 84, 52)),
        ITEM_DIAMOND_PICK: ((84, 220, 230), (116, 84, 52)),
        ITEM_NETHERITE_PICK: ((96, 74, 96), (116, 84, 52)),
    }
    if item_id in pick_colors:
        head, handle = pick_colors[item_id]
        return _pick_icon(size, head, handle)
    return None


def get_item_icons(size):
    if size in _ICON_CACHE:
        return _ICON_CACHE[size]

    icons = {}
    icon_ids = (
        SAND, GRASS, DIRT, STONE, SNOW, LEAVES, WOOD, WATER_BLOCK,
        BEDROCK, DEEPSLATE, LAVA,
        COAL_ORE, IRON_ORE, COPPER_ORE, GOLD_ORE, REDSTONE_ORE, DIAMOND_ORE, DEEPSLATE_DIAMOND_ORE,
        ITEM_PLANK, ITEM_STICK,
        ITEM_WOOD_PICK, ITEM_STONE_PICK, ITEM_IRON_PICK, ITEM_DIAMOND_PICK, ITEM_NETHERITE_PICK,
        CRAFTING_TABLE, ITEM_CRAFTING_TABLE,
        ITEM_APPLE, ITEM_PORKCHOP, ITEM_BEEF, ITEM_MUTTON,
    )

    for item_id in icon_ids:
        surf = _block_surface(item_id)
        if surf is None:
            surf = _custom_item_surface(item_id, size)
        else:
            surf = pg.transform.scale(surf, (size, size))
        if surf is not None:
            icons[item_id] = surf

    _ICON_CACHE[size] = icons
    return icons