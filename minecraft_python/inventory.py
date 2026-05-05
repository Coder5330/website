import pygame as pg
from settings import (
    SAND, GRASS, DIRT, STONE, SNOW, LEAVES, WOOD,
    IRON_ORE, DIAMOND_ORE,
    ITEM_WOOD_PICK, ITEM_STONE_PICK, ITEM_IRON_PICK, ITEM_DIAMOND_PICK, ITEM_NETHERITE_PICK,
    ITEM_PLANK, ITEM_STICK, ITEM_CRAFTING_TABLE,
    CRAFTING_TABLE, TOOL_MAX_DURABILITY,
)
from hud_inv import (
    get_inventory_layout, get_crafting_table_layout,
    SLOT_S, PAD, INV_COLS, INV_ROWS,
    CRAFT_COLS, CRAFT_ROWS,
    TABLE_COLS, TABLE_ROWS,
)

HOTBAR_SLOTS = 9
TOTAL_INV    = INV_ROWS * INV_COLS

# ── Recipes ───────────────────────────────────────────────────────────────────
# Each recipe is (pattern, output_id, output_count).
# pattern: row-major tuple of item_ids (0 = empty) for the full grid.
# Matching strips empty border rows/cols so placement anywhere works.
# Exactly 1 item is consumed from each non-empty slot.

def _normalise(pattern, cols):
    """Strip empty border rows/cols — shape floats to top-left."""
    rows = [list(pattern[i*cols:(i+1)*cols]) for i in range(len(pattern)//cols)]
    while rows and all(v == 0 for v in rows[0]):   rows.pop(0)
    while rows and all(v == 0 for v in rows[-1]):  rows.pop()
    if not rows:
        return ()
    min_c = min((ci for row in rows for ci, v in enumerate(row) if v), default=0)
    max_c = max((ci for row in rows for ci, v in enumerate(row) if v), default=0)
    return tuple(v for row in rows for v in row[min_c:max_c+1])

def _prep(recipes, cols):
    result = []
    for p, out_id, out_count in recipes:
        full = list(p) + [0] * (cols * cols - len(p))
        norm = _normalise(tuple(full[:cols*cols]), cols)
        result.append((norm, out_id, out_count))
    return result

def _match_recipe(grid, cols, norm_recipes):
    pattern = tuple(s['id'] if s['count'] > 0 else 0 for s in grid)
    norm = _normalise(pattern, cols)
    for rec_norm, out_id, out_count in norm_recipes:
        if norm == rec_norm:
            return out_id, out_count
    return None

# 2×2 recipes (pattern fills a 2×2 grid, row-major)
RECIPES_2x2 = [
    # Wood log → 4 planks (single slot anywhere)
    ((WOOD,),                                                         ITEM_PLANK,          4),
    # 2 planks vertically → 4 sticks
    ((ITEM_PLANK,
      ITEM_PLANK),                                                    ITEM_STICK,          4),
    # 2×2 planks → crafting table
    ((ITEM_PLANK, ITEM_PLANK,
      ITEM_PLANK, ITEM_PLANK),                                        ITEM_CRAFTING_TABLE, 1),
]

# 3×3 recipes (pattern fills a 3×3 grid, row-major, 0=empty)
_ = 0  # shorthand for empty
RECIPES_3x3 = [
    # ── Basic materials ──────────────────────────────────────────────
    ((WOOD,),                                                         ITEM_PLANK,          4),
    ((ITEM_PLANK,
      ITEM_PLANK),                                                    ITEM_STICK,          4),
    ((ITEM_PLANK, ITEM_PLANK,
      ITEM_PLANK, ITEM_PLANK),                                        ITEM_CRAFTING_TABLE, 1),

    # ── Pickaxes ─────────────────────────────────────────────────────
    # Wooden pickaxe: PPP / _S_ / _S_
    ((ITEM_PLANK, ITEM_PLANK, ITEM_PLANK,
      _,          ITEM_STICK, _,
      _,          ITEM_STICK, _),                                     ITEM_WOOD_PICK,      1),
    # Stone pickaxe
    ((STONE,      STONE,      STONE,
      _,          ITEM_STICK, _,
      _,          ITEM_STICK, _),                                     ITEM_STONE_PICK,     1),
    # Iron pickaxe (uses IRON_ORE as iron material)
    ((IRON_ORE,   IRON_ORE,   IRON_ORE,
      _,          ITEM_STICK, _,
      _,          ITEM_STICK, _),                                     ITEM_IRON_PICK,      1),
    # Diamond pickaxe (uses DIAMOND_ORE as diamond material)
    ((DIAMOND_ORE, DIAMOND_ORE, DIAMOND_ORE,
      _,           ITEM_STICK,  _,
      _,           ITEM_STICK,  _),                                   ITEM_DIAMOND_PICK,   1),
]
del _

_RECIPES_2x2_NORM = _prep(RECIPES_2x2, 2)
_RECIPES_3x3_NORM = _prep(RECIPES_3x3, 3)


NON_STACKING_ITEMS = {
    ITEM_WOOD_PICK, ITEM_STONE_PICK, ITEM_IRON_PICK,
    ITEM_DIAMOND_PICK, ITEM_NETHERITE_PICK,
}


def _empty_slot():
    return {'id': 0, 'count': 0}


def _copy_slot(slot):
    return dict(slot) if slot else _empty_slot()


def _assign_slot(dst, src):
    dst.clear()
    dst.update(_copy_slot(src))


def _clear_slot(slot):
    _assign_slot(slot, _empty_slot())


def _new_item_slot(item_id, count=1):
    slot = {'id': item_id, 'count': count}
    max_durability = TOOL_MAX_DURABILITY.get(item_id)
    if max_durability is not None:
        slot['durability'] = max_durability
        slot['max_durability'] = max_durability
    return slot


class Inventory:
    def __init__(self, app):
        self.app = app
        self.slots = [_empty_slot() for _ in range(TOTAL_INV)]
        self.hotbar_offset  = 0
        self.selected_slot  = 0
        self.hunger         = 20
        self._hunger_timer  = 0
        self._hunger_drain_ms  = 180000   # 3 minutes per hunger point (full bar = 60 min)
        self._starve_timer     = 0
        self._starve_damage_ms = 6000     # 1 damage every 6 seconds when starving

        # ── personal 2×2 crafting ──
        self.crafting_open  = False
        self.craft_grid     = [_empty_slot() for _ in range(CRAFT_ROWS * CRAFT_COLS)]
        self.craft_output   = _empty_slot()
        self._craft_recipe  = None

        # ── crafting table 3×3 ──
        self.crafting_table_open   = False
        self.craft_table_grid      = [_empty_slot() for _ in range(TABLE_ROWS * TABLE_COLS)]
        self.craft_table_output    = _empty_slot()
        self._craft_table_recipe   = None

        # ── held item (drag) ──
        self._held_item = None   # dict copy of dragged slot

    # ── properties ───────────────────────────────────────────────────────────

    @property
    def hotbar(self):
        return self.slots[0:HOTBAR_SLOTS]

    @property
    def any_ui_open(self):
        return self.crafting_open or self.crafting_table_open

    def selected_item_id(self):
        slot = self.slots[self.selected_slot]
        return slot['id'] if slot['count'] > 0 else 0

    def selected_block_id(self):
        """Return the block ID to place, resolving item→block for crafting table."""
        item_id = self.selected_item_id()
        if item_id == ITEM_CRAFTING_TABLE:
            return CRAFTING_TABLE
        return item_id if item_id < 100 else 0

    def remove_selected(self):
        slot = self.slots[self.selected_slot]
        if slot['count'] > 0:
            slot['count'] -= 1
            if slot['count'] == 0:
                _clear_slot(slot)
            return True
        return False

    def get_max_stack(self, item_id):
        return 1 if item_id in NON_STACKING_ITEMS else 64

    def _can_stack(self, slot, item):
        return (
            slot['id'] == item['id']
            and slot.get('durability') == item.get('durability')
            and slot.get('max_durability') == item.get('max_durability')
            and slot.get('enchantments') == item.get('enchantments')
        )

    def add_item(self, item):
        if not item or item.get('id', 0) == 0 or item.get('count', 0) <= 0:
            return 0

        remaining = item['count']
        max_stack = self.get_max_stack(item['id'])

        if max_stack > 1:
            for slot in self.slots:
                if self._can_stack(slot, item) and slot['count'] < max_stack and remaining > 0:
                    add = min(max_stack - slot['count'], remaining)
                    slot['count'] += add
                    remaining -= add
                    if remaining == 0:
                        return 0

        for slot in self.slots:
            if slot['id'] == 0 and remaining > 0:
                add = min(max_stack, remaining)
                new_slot = _copy_slot(item)
                new_slot['count'] = add
                _assign_slot(slot, new_slot)
                remaining -= add
                if remaining == 0:
                    return 0

        return remaining

    def add_block(self, voxel_id, count=1):
        if self.get_max_stack(voxel_id) == 1:
            remaining = count
            while remaining > 0:
                if self.add_item(_new_item_slot(voxel_id)) != 0:
                    break
                remaining -= 1
            return remaining

        return self.add_item(_new_item_slot(voxel_id, count))

    def damage_selected_tool(self, amount=1):
        slot = self.slots[self.selected_slot]
        max_durability = slot.get('max_durability')
        if not max_durability or slot['count'] <= 0:
            return False

        slot['durability'] = max(slot.get('durability', max_durability) - amount, 0)
        if slot['durability'] == 0:
            _clear_slot(slot)
            return True
        return False

    def serialize_state(self):
        return {
            'selected_slot': int(self.selected_slot),
            'hunger': int(self.hunger),
            'slots': [_copy_slot(slot) for slot in self.slots],
        }

    def load_state(self, state):
        if not state:
            return

        slot_states = list(state.get('slots', []))
        for index in range(TOTAL_INV):
            slot_state = slot_states[index] if index < len(slot_states) else _empty_slot()
            _assign_slot(self.slots[index], slot_state)

        self.selected_slot = max(0, min(HOTBAR_SLOTS - 1, int(state.get('selected_slot', 0))))
        self.hunger = int(state.get('hunger', 20))
        self._held_item = None

    # ── crafting helpers ──────────────────────────────────────────────────────

    def _update_craft_output(self):
        result = _match_recipe(self.craft_grid, 2, _RECIPES_2x2_NORM)
        if result:
            self.craft_output  = {'id': result[0], 'count': result[1]}
            self._craft_recipe = 'grid'
        else:
            self.craft_output  = _empty_slot()
            self._craft_recipe = None

    def _update_craft_table_output(self):
        result = _match_recipe(self.craft_table_grid, 3, _RECIPES_3x3_NORM)
        if result:
            self.craft_table_output  = {'id': result[0], 'count': result[1]}
            self._craft_table_recipe = 'grid'
        else:
            self.craft_table_output  = _empty_slot()
            self._craft_table_recipe = None

    def _consume_craft_items(self, grid):
        """Consume exactly 1 from every occupied slot."""
        for slot in grid:
            if slot['id'] != 0 and slot['count'] > 0:
                slot['count'] -= 1
                if slot['count'] == 0:
                    _clear_slot(slot)

    def take_craft_output(self):
        if self.craft_output['id'] == 0:
            return
        if self.add_block(self.craft_output['id'], self.craft_output['count']) != 0:
            return
        if self._craft_recipe is not None:
            self._consume_craft_items(self.craft_grid)
        self._update_craft_output()

    def take_craft_table_output(self):
        if self.craft_table_output['id'] == 0:
            return
        if self.add_block(self.craft_table_output['id'], self.craft_table_output['count']) != 0:
            return
        if self._craft_table_recipe is not None:
            self._consume_craft_items(self.craft_table_grid)
        self._update_craft_table_output()

    # ── open / close UI ───────────────────────────────────────────────────────

    def open_inventory(self):
        self.crafting_open       = True
        self.crafting_table_open = False
        pg.event.set_grab(False)
        pg.mouse.set_visible(True)

    def open_crafting_table(self):
        self.crafting_table_open = True
        self.crafting_open       = False
        pg.event.set_grab(False)
        pg.mouse.set_visible(True)

    def close_all(self):
        self._return_held_item()
        self.crafting_open       = False
        self.crafting_table_open = False
        pg.event.set_grab(True)
        pg.mouse.set_visible(False)

    # ── update ────────────────────────────────────────────────────────────────

    def update(self):
        if self.app.multiplayer_enabled:
            self.hunger = 20
            self._hunger_timer = 0
            self._starve_timer = 0
            return

        dt = self.app.delta_time
        self._hunger_timer += dt
        if self._hunger_timer >= self._hunger_drain_ms:
            self._hunger_timer = 0
            if self.hunger > 0:
                self.hunger -= 1
        if self.hunger == 0:
            self._starve_timer += dt
            if self._starve_timer >= self._starve_damage_ms:
                self._starve_timer = 0
                if self.app.player_health > 1:
                    self.app.player_health -= 1
        else:
            self._starve_timer = 0

    # ── input ─────────────────────────────────────────────────────────────────

    def handle_event(self, event):
        if event.type == pg.KEYDOWN:
            if event.key == pg.K_e:
                if self.any_ui_open:
                    self.close_all()
                else:
                    self.open_inventory()
                return
            if not self.any_ui_open:
                slot_keys = [pg.K_1, pg.K_2, pg.K_3, pg.K_4, pg.K_5,
                             pg.K_6, pg.K_7, pg.K_8, pg.K_9]
                for i, key in enumerate(slot_keys):
                    if event.key == key:
                        self.selected_slot = i

        elif event.type == pg.MOUSEBUTTONDOWN:
            if self.crafting_open:
                self._handle_inv_click(event)
                return
            if self.crafting_table_open:
                self._handle_table_click(event)
                return
            if event.button == 4:
                self.selected_slot = (self.selected_slot - 1) % HOTBAR_SLOTS
            elif event.button == 5:
                self.selected_slot = (self.selected_slot + 1) % HOTBAR_SLOTS

    # ── right-click crafting table in world ───────────────────────────────────

    def try_interact_block(self, block_id):
        """Call this when the player right-clicks a placed block.
        Returns True if the block was interactable (UI opened), False otherwise.
        """
        if block_id == CRAFTING_TABLE:
            self.open_crafting_table()
            return True
        return False

    # ── inventory click handler (2×2) ────────────────────────────────────────

    def _handle_inv_click(self, event):
        if event.button not in (1, 3):
            return
        mx, my = event.pos
        W, H   = self.app.WIN_W, self.app.WIN_H
        layout = get_inventory_layout(W, H)

        inv_x   = layout['inv_x']
        inv_y   = layout['inv_y']
        craft_x = layout['craft_x']
        craft_y = layout['craft_y']
        out_x   = layout['out_x']
        out_y   = layout['out_y']
        hotbar_y = layout['hotbar_y']

        # craft output
        if out_x <= mx <= out_x + SLOT_S and out_y <= my <= out_y + SLOT_S:
            self.take_craft_output()
            return

        # craft grid
        for i in range(CRAFT_ROWS * CRAFT_COLS):
            row, col = divmod(i, CRAFT_COLS)
            sx = craft_x + col * (SLOT_S + PAD)
            sy = craft_y + row * (SLOT_S + PAD)
            if sx <= mx <= sx + SLOT_S and sy <= my <= sy + SLOT_S:
                if event.button == 3:
                    self._split_stack_click(self.craft_grid, i)
                else:
                    self._swap_held(self.craft_grid, i)
                self._update_craft_output()
                return

        # main inventory
        for i in range(TOTAL_INV):
            row, col = divmod(i, INV_COLS)
            sx = inv_x + col * (SLOT_S + PAD)
            sy = inv_y + row * (SLOT_S + PAD)
            if sx <= mx <= sx + SLOT_S and sy <= my <= sy + SLOT_S:
                if event.button == 3:
                    self._split_stack_click(self.slots, i)
                else:
                    self._swap_held(self.slots, i)
                return

        # hotbar
        for i in range(HOTBAR_SLOTS):
            sx = inv_x + i * (SLOT_S + PAD)
            sy = hotbar_y
            if sx <= mx <= sx + SLOT_S and sy <= my <= sy + SLOT_S:
                if event.button == 3:
                    self._split_stack_click(self.slots, i)
                else:
                    self._swap_held(self.slots, i)
                return

    # ── crafting table click handler (3×3) ───────────────────────────────────

    def _handle_table_click(self, event):
        if event.button not in (1, 3):
            return
        mx, my = event.pos
        W, H   = self.app.WIN_W, self.app.WIN_H
        layout = get_crafting_table_layout(W, H)

        inv_x    = layout['inv_x']
        inv_y    = layout['inv_y']
        table_x  = layout['table_x']
        table_y  = layout['table_y']
        out_x    = layout['out_x']
        out_y    = layout['out_y']
        hotbar_y = layout['hotbar_y']

        # table output
        if out_x <= mx <= out_x + SLOT_S and out_y <= my <= out_y + SLOT_S:
            self.take_craft_table_output()
            return

        # table grid
        for i in range(TABLE_ROWS * TABLE_COLS):
            row, col = divmod(i, TABLE_COLS)
            sx = table_x + col * (SLOT_S + PAD)
            sy = table_y + row * (SLOT_S + PAD)
            if sx <= mx <= sx + SLOT_S and sy <= my <= sy + SLOT_S:
                if event.button == 3:
                    self._split_stack_click(self.craft_table_grid, i)
                else:
                    self._swap_held(self.craft_table_grid, i)
                self._update_craft_table_output()
                return

        # main inventory
        for i in range(TOTAL_INV):
            row, col = divmod(i, INV_COLS)
            sx = inv_x + col * (SLOT_S + PAD)
            sy = inv_y + row * (SLOT_S + PAD)
            if sx <= mx <= sx + SLOT_S and sy <= my <= sy + SLOT_S:
                if event.button == 3:
                    self._split_stack_click(self.slots, i)
                else:
                    self._swap_held(self.slots, i)
                return

        # hotbar
        for i in range(HOTBAR_SLOTS):
            sx = inv_x + i * (SLOT_S + PAD)
            sy = hotbar_y
            if sx <= mx <= sx + SLOT_S and sy <= my <= sy + SLOT_S:
                if event.button == 3:
                    self._split_stack_click(self.slots, i)
                else:
                    self._swap_held(self.slots, i)
                return

    # ── drag / swap helpers ───────────────────────────────────────────────────

    def _swap_held(self, slot_list, index):
        slot = slot_list[index]
        if self._held_item is None:
            if slot['id'] != 0:
                self._held_item = _copy_slot(slot)
                _clear_slot(slot)
        else:
            if self._can_stack(slot, self._held_item) and slot['id'] != 0:
                max_stack = self.get_max_stack(slot['id'])
                if slot['count'] < max_stack:
                    add = min(max_stack - slot['count'], self._held_item['count'])
                    slot['count']           += add
                    self._held_item['count'] -= add
                    if self._held_item['count'] <= 0:
                        self._held_item = None
                    return
            tmp = _copy_slot(slot)
            _assign_slot(slot, self._held_item)
            self._held_item = tmp if tmp['id'] != 0 else None

    def _split_stack_click(self, slot_list, index):
        slot = slot_list[index]
        if self._held_item is None:
            if slot['id'] == 0:
                return
            if self.get_max_stack(slot['id']) == 1:
                self._held_item = _copy_slot(slot)
                _clear_slot(slot)
                return
            take = (slot['count'] + 1) // 2
            self._held_item = {'id': slot['id'], 'count': take}
            slot['count'] -= take
            if slot['count'] <= 0:
                _clear_slot(slot)
            return

        if slot['id'] == 0:
            if self.get_max_stack(self._held_item['id']) == 1:
                _assign_slot(slot, self._held_item)
                self._held_item = None
                return
            slot['id'] = self._held_item['id']
            slot['count'] = 1
            self._held_item['count'] -= 1
        elif self._can_stack(slot, self._held_item) and slot['count'] < self.get_max_stack(slot['id']):
            slot['count'] += 1
            self._held_item['count'] -= 1
        else:
            return

        if self._held_item['count'] <= 0:
            self._held_item = None

    def _return_held_item(self):
        if self._held_item is None:
            return
        remaining = self.add_item(self._held_item)
        if remaining == 0:
            self._held_item = None
        else:
            self._held_item['count'] = remaining