from settings import *
from meshes.chunk_mesh_builder import get_chunk_index
import pygame as pg
from collections import deque
import random

# ─────────────────────────────────────────────────────────────────────────────
# BLOCK BREAKING DATA
#
# Each entry is a dict with keys:
#   'hardness'  : float  – Minecraft hardness value (for reference)
#   'tool'      : str    – best tool type: 'pickaxe' | 'axe' | 'shovel' |
#                          'shears' | 'sword' | None (any/no tool)
#   'min_tier'  : int    – minimum TOOL_TIER_* required to actually drop loot
#                          (set to TOOL_TIER_NONE if any tier works)
#   'times'     : dict   – {tool_key: seconds} where tool_key is one of:
#                          'hand', 'wood', 'stone', 'copper', 'iron',
#                          'diamond', 'netherite', 'golden', 'shears', 'sword'
#                          Omit a key if that tool gives no speed benefit
#                          (i.e. same as hand / not applicable).
#
# Times are taken directly from the Minecraft wiki breaking-time table.
# A time of None means the tool can break it but it drops nothing.
# ─────────────────────────────────────────────────────────────────────────────

BLOCK_DATA = {

    # ── Unbreakable / special ─────────────────────────────────────────────────
    BEDROCK: {
        'hardness': float('inf'), 'tool': None, 'min_tier': TOOL_TIER_NONE,
        'times': {'hand': float('inf')},
    },
    LAVA: {
        'hardness': 100, 'tool': None, 'min_tier': TOOL_TIER_NONE,
        'times': {'hand': 150},
    },

    # ── Dirt family ───────────────────────────────────────────────────────────
    DIRT: {
        'hardness': 0.5, 'tool': 'shovel', 'min_tier': TOOL_TIER_NONE,
        'times': {
            'hand': 0.75, 'wood': 0.4, 'stone': 0.2, 'copper': 0.15,
            'iron': 0.15, 'diamond': 0.1, 'netherite': 0.1, 'golden': 0.1,
        },
    },
    GRASS: {
        'hardness': 0.6, 'tool': 'shovel', 'min_tier': TOOL_TIER_NONE,
        'times': {
            'hand': 0.9, 'wood': 0.45, 'stone': 0.25, 'copper': 0.2,
            'iron': 0.15, 'diamond': 0.15, 'netherite': 0.1, 'golden': 0.1,
        },
    },
    SAND: {
        'hardness': 0.5, 'tool': 'shovel', 'min_tier': TOOL_TIER_NONE,
        'times': {
            'hand': 0.75, 'wood': 0.4, 'stone': 0.2, 'copper': 0.15,
            'iron': 0.15, 'diamond': 0.1, 'netherite': 0.1, 'golden': 0.1,
        },
    },
    SNOW: {
        'hardness': 0.1, 'tool': 'shovel', 'min_tier': TOOL_TIER_WOOD,
        'times': {
            'hand': 0.5, 'wood': 0.1, 'stone': 0.05, 'copper': 0.05,
            'iron': 0.05, 'diamond': 0.05, 'netherite': 0.05, 'golden': 0.05,
        },
    },

    # ── Wood / plant ──────────────────────────────────────────────────────────
    WOOD: {
        'hardness': 2.0, 'tool': 'axe', 'min_tier': TOOL_TIER_NONE,
        'times': {
            'hand': 3.0, 'wood': 1.5, 'stone': 0.75, 'copper': 0.6,
            'iron': 0.5, 'diamond': 0.4, 'netherite': 0.35, 'golden': 0.25,
        },
    },
    LEAVES: {
        'hardness': 0.2, 'tool': 'shears', 'min_tier': TOOL_TIER_NONE,
        'times': {
            'hand': 0.3, 'wood': 0.15, 'stone': 0.1, 'copper': 0.1,
            'iron': 0.05, 'diamond': 0.05, 'netherite': 0.05, 'golden': 0.05,
            'shears': 0.05, 'sword': 0.2,
        },
    },

    # ── Stone family ──────────────────────────────────────────────────────────
    STONE: {
        'hardness': 1.5, 'tool': 'pickaxe', 'min_tier': TOOL_TIER_WOOD,
        'times': {
            'hand': 7.5, 'wood': 1.15, 'stone': 0.6, 'copper': 0.45,
            'iron': 0.4, 'diamond': 0.3, 'netherite': 0.25, 'golden': 0.2,
        },
    },
    DEEPSLATE: {
        'hardness': 3.0, 'tool': 'pickaxe', 'min_tier': TOOL_TIER_WOOD,
        'times': {
            'hand': 15.0, 'wood': 2.25, 'stone': 1.15, 'copper': 0.9,
            'iron': 0.75, 'diamond': 0.6, 'netherite': 0.5, 'golden': 0.4,
        },
    },

    # ── Ores ──────────────────────────────────────────────────────────────────
    COAL_ORE: {
        'hardness': 3.0, 'tool': 'pickaxe', 'min_tier': TOOL_TIER_WOOD,
        'times': {
            'hand': 15.0, 'wood': 2.25, 'stone': 1.15, 'copper': 0.9,
            'iron': 0.75, 'diamond': 0.6, 'netherite': 0.5, 'golden': 0.4,
        },
    },
    IRON_ORE: {
        'hardness': 3.0, 'tool': 'pickaxe', 'min_tier': TOOL_TIER_STONE,
        'times': {
            'hand': 15.0, 'wood': 2.25, 'stone': 1.15, 'copper': 0.9,
            'iron': 0.75, 'diamond': 0.6, 'netherite': 0.5, 'golden': 0.4,
        },
    },
    COPPER_ORE: {
        'hardness': 3.0, 'tool': 'pickaxe', 'min_tier': TOOL_TIER_STONE,
        'times': {
            'hand': 15.0, 'wood': 2.25, 'stone': 1.15, 'copper': 0.9,
            'iron': 0.75, 'diamond': 0.6, 'netherite': 0.5, 'golden': 0.4,
        },
    },
    GOLD_ORE: {
        'hardness': 3.0, 'tool': 'pickaxe', 'min_tier': TOOL_TIER_IRON,
        'times': {
            'hand': 15.0, 'wood': 2.25, 'stone': 1.15, 'copper': 0.9,
            'iron': 0.75, 'diamond': 0.6, 'netherite': 0.5, 'golden': 0.4,
        },
    },
    REDSTONE_ORE: {
        'hardness': 3.0, 'tool': 'pickaxe', 'min_tier': TOOL_TIER_IRON,
        'times': {
            'hand': 15.0, 'wood': 2.25, 'stone': 1.15, 'copper': 0.9,
            'iron': 0.75, 'diamond': 0.6, 'netherite': 0.5, 'golden': 0.4,
        },
    },
    DIAMOND_ORE: {
        'hardness': 3.0, 'tool': 'pickaxe', 'min_tier': TOOL_TIER_IRON,
        'times': {
            'hand': 15.0, 'wood': 7.5, 'stone': 3.75, 'copper': 3.0,
            'iron': 0.75, 'diamond': 0.6, 'netherite': 0.5, 'golden': 1.25,
        },
    },
    DEEPSLATE_DIAMOND_ORE: {
        'hardness': 4.5, 'tool': 'pickaxe', 'min_tier': TOOL_TIER_IRON,
        'times': {
            'hand': 22.5, 'wood': 11.25, 'stone': 5.65, 'copper': 4.5,
            'iron': 1.15, 'diamond': 0.85, 'netherite': 0.75, 'golden': 1.9,
        },
    },
}

# ─────────────────────────────────────────────────────────────────────────────
# TOOL KEY HELPERS
# ─────────────────────────────────────────────────────────────────────────────

# Maps TOOL_TIER_* constants → key used in BLOCK_DATA['times']
_TIER_TO_KEY = {
    TOOL_TIER_NONE:      'hand',
    TOOL_TIER_WOOD:      'wood',
    TOOL_TIER_STONE:     'stone',
    TOOL_TIER_COPPER:    'copper',   # add TOOL_TIER_COPPER to settings if missing
    TOOL_TIER_IRON:      'iron',
    TOOL_TIER_DIAMOND:   'diamond',
    TOOL_TIER_NETHERITE: 'netherite',
    TOOL_TIER_GOLDEN:    'golden',   # add TOOL_TIER_GOLDEN to settings if missing
}

# ─────────────────────────────────────────────────────────────────────────────
# EFFICIENCY ENCHANTMENT  (adds flat speed bonus per level)
# Formula from wiki: speed_multiplier += level² + 1  (applied as divisor)
# Simpler game approximation used here: each level reduces time by ~30 %
# ─────────────────────────────────────────────────────────────────────────────

def _efficiency_multiplier(level: int) -> float:
    """Return a time multiplier < 1.0 for Efficiency I-V (level 1-5)."""
    if level <= 0:
        return 1.0
    # Wiki formula: effective speed += level² + 1
    # We express this as a ratio relative to the base tool speed.
    # Approximation: multiplier = 1 / (1 + 0.25 * level²)
    return 1.0 / (1.0 + 0.25 * level * level)


# ─────────────────────────────────────────────────────────────────────────────
# HASTE EFFECT  (beacon / potion)
# ─────────────────────────────────────────────────────────────────────────────

def _haste_multiplier(haste_level: int) -> float:
    """Return a time multiplier for Haste I/II (Mining Fatigue uses negative)."""
    if haste_level == 0:
        return 1.0
    # Wiki: each Haste level multiplies speed by 1.2  → time /= 1.2^level
    return 1.0 / (1.2 ** haste_level)


# ─────────────────────────────────────────────────────────────────────────────
# UNBREAKABLE SET  (fast lookup)
# ─────────────────────────────────────────────────────────────────────────────

UNBREAKABLE = {
    bid for bid, data in BLOCK_DATA.items()
    if data['times'].get('hand') == float('inf')
}
# Also keep lava non-interactive
UNBREAKABLE.add(LAVA)

# ─────────────────────────────────────────────────────────────────────────────
# PHYSICS BLOCKS  (fall when unsupported)
# ─────────────────────────────────────────────────────────────────────────────

PHYSICS_BLOCKS = {SAND}


# ─────────────────────────────────────────────────────────────────────────────
# HELD TOOL HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def _get_held_item(app):
    return app.inventory.slots[app.inventory.selected_slot]

def _get_held_tier(app) -> int:
    slot = _get_held_item(app)
    return PICKAXE_TIERS.get(slot['id'], TOOL_TIER_NONE)

def _get_held_efficiency(app) -> int:
    """Return the Efficiency enchantment level on the held tool (0 if none)."""
    slot = _get_held_item(app)
    return slot.get('enchantments', {}).get('efficiency', 0)


# ─────────────────────────────────────────────────────────────────────────────
# BREAK TIME CALCULATION
# ─────────────────────────────────────────────────────────────────────────────

def compute_break_time(block_id: int, tier: int,
                       efficiency_level: int = 0,
                       haste_level: int = 0) -> float:
    """
    Return break time in **seconds** for block_id with given tool tier,
    Efficiency enchantment level, and Haste effect level.

    Returns float('inf') for unbreakable blocks.
    """
    data = BLOCK_DATA.get(block_id)
    if data is None:
        # Unknown block – use a sensible default
        tier_key = _TIER_TO_KEY.get(tier, 'hand')
        base = 0.8 if tier_key != 'hand' else 4.0
        return base * _efficiency_multiplier(efficiency_level) * _haste_multiplier(haste_level)

    tier_key = _TIER_TO_KEY.get(tier, 'hand')

    # Pick the best applicable time from the block's times table
    # If the held tier key isn't in the table, fall back to 'hand'
    times = data['times']
    time_sec = times.get(tier_key, times.get('hand', float('inf')))

    if time_sec == float('inf'):
        return float('inf')

    time_sec *= _efficiency_multiplier(efficiency_level)
    time_sec *= _haste_multiplier(haste_level)
    return max(time_sec, 0.05)   # floor at 1 game tick (50 ms)


# ─────────────────────────────────────────────────────────────────────────────
# VOXEL HANDLER
# ─────────────────────────────────────────────────────────────────────────────

class VoxelHandler:
    def __init__(self, world):
        self.app = world.app
        self.chunks = world.chunks

        # ray casting result
        self.chunk = None
        self.voxel_id = None
        self.voxel_index = None
        self.voxel_local_pos = None
        self.voxel_world_pos = None
        self.voxel_normal = None

        self.interaction_mode = 0   # 0 = remove   1 = add
        self.new_voxel_id = DIRT
        self.breaking = False
        self.break_timer = 0.0      # seconds
        self.break_target = glm.ivec3(0)

        self.leaf_decay_queue = []
        self.leaf_decay_scheduled = set()
        self.water_flow = {}

    # ── break progress (0-9 for crack overlay, -1 if not breaking) ────────────

    def get_break_progress(self):
        if self.breaking and self.voxel_id:
            total = self.get_break_time()
            if total == float('inf'):
                return -1, None
            stage = int((self.break_timer / total) * 10)
            return min(stage, 9), self.break_target
        return -1, None

    # ── per-frame update ──────────────────────────────────────────────────────

    def update(self):
        self.ray_cast()
        self._lava_damage_check()
        self._process_leaf_decay()

    def _lava_damage_check(self):
        if self.app.multiplayer_enabled:
            return
        pos = self.app.player.position
        for dy in (0, 1):
            result = self.get_voxel_id(
                glm.ivec3(int(pos.x), int(pos.y) + dy, int(pos.z)))
            if result[0] and int(result[0]) == LAVA:
                self.app.player_health -= self.app.delta_time * 0.001
                break

    # ── adding / removing voxels ──────────────────────────────────────────────

    def add_voxel(self):
        if self.voxel_id:
            result = self.get_voxel_id(self.voxel_world_pos + self.voxel_normal)
            if result[3] and int(result[0]) in (0, WATER_BLOCK):
                _, voxel_index, _, chunk = result
                place_pos = glm.ivec3(self.voxel_world_pos + self.voxel_normal)
                chunk.voxels[voxel_index] = self.new_voxel_id
                chunk.mesh.rebuild()
                if chunk.is_empty:
                    chunk.is_empty = False
                self.rebuild_adjacent_chunks_at(place_pos)
                self._apply_fall_physics(place_pos)
                self._refresh_water_near(place_pos)
                if self.app.multiplayer_enabled:
                    self.app.multiplayer.send_block_update(place_pos, self.new_voxel_id)
                return True
        return False

    def rebuild_adj_chunk(self, adj_voxel_pos):
        cx = int(adj_voxel_pos[0]) // CHUNK_SIZE
        cy = int(adj_voxel_pos[1]) // CHUNK_SIZE
        cz = int(adj_voxel_pos[2]) // CHUNK_SIZE
        if 0 <= cx < WORLD_W and 0 <= cy < WORLD_H and 0 <= cz < WORLD_D:
            chunk_index = cx + WORLD_W * cz + WORLD_AREA * cy
            self.chunks[chunk_index].mesh.rebuild()

    def rebuild_adjacent_chunks(self):
        lx, ly, lz = self.voxel_local_pos
        wx, wy, wz = self.voxel_world_pos
        if lx == 0:
            self.rebuild_adj_chunk((wx - 1, wy, wz))
        elif lx == CHUNK_SIZE - 1:
            self.rebuild_adj_chunk((wx + 1, wy, wz))
        if ly == 0:
            self.rebuild_adj_chunk((wx, wy - 1, wz))
        elif ly == CHUNK_SIZE - 1:
            self.rebuild_adj_chunk((wx, wy + 1, wz))
        if lz == 0:
            self.rebuild_adj_chunk((wx, wy, wz - 1))
        elif lz == CHUNK_SIZE - 1:
            self.rebuild_adj_chunk((wx, wy, wz + 1))

    def rebuild_adjacent_chunks_at(self, world_pos):
        wx, wy, wz = world_pos
        lx, ly, lz = wx % CHUNK_SIZE, wy % CHUNK_SIZE, wz % CHUNK_SIZE
        if lx == 0:
            self.rebuild_adj_chunk((wx - 1, wy, wz))
        elif lx == CHUNK_SIZE - 1:
            self.rebuild_adj_chunk((wx + 1, wy, wz))
        if ly == 0:
            self.rebuild_adj_chunk((wx, wy - 1, wz))
        elif ly == CHUNK_SIZE - 1:
            self.rebuild_adj_chunk((wx, wy + 1, wz))
        if lz == 0:
            self.rebuild_adj_chunk((wx, wy, wz - 1))
        elif lz == CHUNK_SIZE - 1:
            self.rebuild_adj_chunk((wx, wy, wz + 1))

    def remove_voxel(self):
        if not self.voxel_id:
            return
        bid = int(self.voxel_id)
        if bid in UNBREAKABLE:
            return

        data = BLOCK_DATA.get(bid, {})
        tier = _get_held_tier(self.app)
        min_tier = data.get('min_tier', TOOL_TIER_NONE)
        tier_ok = tier >= min_tier

        drop_id = BLOCK_DROPS.get(bid, bid)
        # Leaves: 5% chance to drop an apple
        if bid == LEAVES and random.random() < 0.05:
            drop_id = ITEM_APPLE

        self.chunk.voxels[self.voxel_index] = 0
        self.chunk.mesh.rebuild()
        self.rebuild_adjacent_chunks()
        self.app.inventory.damage_selected_tool()

        if tier_ok and drop_id:
            if self.app.multiplayer_enabled:
                leftover = self.app.inventory.add_block(drop_id)
                if leftover:
                    self.app.scene.dropped_items.spawn(
                        drop_id, glm.vec3(self.voxel_world_pos) + glm.vec3(0.5), leftover)
            else:
                self.app.scene.dropped_items.spawn(
                    drop_id, glm.vec3(self.voxel_world_pos) + glm.vec3(0.5))

        above = self.voxel_world_pos + glm.ivec3(0, 1, 0)
        self._apply_fall_physics(above)
        self._refresh_water_near(glm.ivec3(self.voxel_world_pos))
        if bid == WOOD:
            self._schedule_leaf_decay_near(glm.ivec3(self.voxel_world_pos))
        if self.app.multiplayer_enabled:
            self.app.multiplayer.send_block_update(self.voxel_world_pos, 0)

    def apply_block_update(self, world_pos, voxel_id):
        world_pos = glm.ivec3(*world_pos)
        result = self.get_voxel_id(world_pos)
        current_id, voxel_index, _, chunk = result
        if not chunk:
            return False

        current_id = int(current_id)
        voxel_id = int(voxel_id)
        if current_id == voxel_id:
            return False

        chunk.voxels[voxel_index] = voxel_id
        if voxel_id:
            chunk.is_empty = False
        else:
            chunk.is_empty = not np.any(chunk.voxels)
        chunk.mesh.rebuild()
        self.rebuild_adjacent_chunks_at(world_pos)

        if voxel_id == 0:
            self._apply_fall_physics(world_pos + glm.ivec3(0, 1, 0))
            if current_id == WOOD:
                self._schedule_leaf_decay_near(world_pos)
        else:
            self._apply_fall_physics(world_pos)

        self._refresh_water_near(world_pos)
        return True

    # ── fall physics ──────────────────────────────────────────────────────────

    def _apply_fall_physics(self, world_pos):
        result = self.get_voxel_id(world_pos)
        if not result[0]:
            return
        voxel_id, voxel_index, _, chunk = result
        if int(voxel_id) not in PHYSICS_BLOCKS:
            return
        below = glm.ivec3(world_pos.x, world_pos.y - 1, world_pos.z)
        if self.get_voxel_id(below)[0]:
            return
        chunk.voxels[voxel_index] = 0
        chunk.mesh.rebuild()
        drop_y = world_pos.y - 1
        while drop_y > 0:
            if self.get_voxel_id(glm.ivec3(world_pos.x, drop_y - 1, world_pos.z))[0]:
                break
            drop_y -= 1
        land_result = self.get_voxel_id(glm.ivec3(world_pos.x, drop_y, world_pos.z))
        if not land_result[0]:
            _, land_index, _, land_chunk = land_result
            land_chunk.voxels[land_index] = voxel_id
            land_chunk.mesh.rebuild()
        self._apply_fall_physics(glm.ivec3(world_pos.x, world_pos.y + 1, world_pos.z))

    # ── chunk dirtying ────────────────────────────────────────────────────────

    def _mark_dirty_chunks(self, world_pos, dirty_chunks):
        for dx, dy, dz in ((0,0,0),(1,0,0),(-1,0,0),(0,1,0),(0,-1,0),(0,0,1),(0,0,-1)):
            idx = get_chunk_index(glm.ivec3(world_pos.x+dx, world_pos.y+dy, world_pos.z+dz))
            if idx != -1:
                dirty_chunks.add(self.chunks[idx])

    def _set_world_voxel(self, world_pos, voxel_id, dirty_chunks):
        current_id, voxel_index, _, chunk = self.get_voxel_id(world_pos)
        if not chunk or int(current_id) == voxel_id:
            return False
        chunk.voxels[voxel_index] = voxel_id
        if voxel_id:
            chunk.is_empty = False
        self._mark_dirty_chunks(world_pos, dirty_chunks)
        return True

    # ── water ─────────────────────────────────────────────────────────────────

    def _is_water_passable(self, world_pos):
        result = self.get_voxel_id(world_pos)
        if not result[3]:
            return False
        return int(result[0]) in (0, WATER_BLOCK)

    def get_water_current(self, pos, strength):
        flow = glm.vec2(0.0)
        samples = 0
        for y_offset in (0.1, 0.9):
            sample = glm.ivec3(int(pos.x), int(pos.y + y_offset), int(pos.z))
            result = self.get_voxel_id(sample)
            if result[3] and int(result[0]) == WATER_BLOCK:
                direction = self.water_flow.get((sample.x, sample.y, sample.z), (0.0, 0.0))
                flow += glm.vec2(direction[0], direction[1])
                samples += 1
        if samples == 0 or glm.length(flow) < 1e-6:
            return glm.vec3(0.0)
        flow = glm.normalize(flow) * strength * self.app.delta_time
        return glm.vec3(flow.x, 0.0, flow.y)

    def _refresh_water_near(self, world_pos):
        water_top = int(WATER_LINE)
        if int(world_pos.y) > water_top + 1:
            return

        min_x = max(0, int(world_pos.x) - WATER_FLOW_RADIUS)
        max_x = min(WORLD_W * CHUNK_SIZE - 1, int(world_pos.x) + WATER_FLOW_RADIUS)
        min_z = max(0, int(world_pos.z) - WATER_FLOW_RADIUS)
        max_z = min(WORLD_D * CHUNK_SIZE - 1, int(world_pos.z) + WATER_FLOW_RADIUS)

        queue = deque()
        reachable = set()
        flow_map = {}

        for x in range(min_x, max_x + 1):
            for z in range(min_z, max_z + 1):
                pos = glm.ivec3(x, water_top, z)
                if self._is_water_passable(pos):
                    key = (x, water_top, z)
                    queue.append(pos)
                    reachable.add(key)
                    flow_map[key] = (0.0, 0.0)

        while queue:
            pos = queue.popleft()
            parent_flow = flow_map[(int(pos.x), int(pos.y), int(pos.z))]
            for dx, dy, dz in ((1,0,0),(-1,0,0),(0,0,1),(0,0,-1),(0,-1,0),(0,1,0)):
                nx, ny, nz = int(pos.x+dx), int(pos.y+dy), int(pos.z+dz)
                if nx < min_x or nx > max_x or nz < min_z or nz > max_z:
                    continue
                if ny < 0 or ny > water_top:
                    continue
                key = (nx, ny, nz)
                if key in reachable:
                    continue
                next_pos = glm.ivec3(nx, ny, nz)
                if self._is_water_passable(next_pos):
                    reachable.add(key)
                    queue.append(next_pos)
                    flow_map[key] = (float(dx), float(dz)) if (dx or dz) else parent_flow

        dirty_chunks = set()
        for x in range(min_x, max_x + 1):
            for z in range(min_z, max_z + 1):
                for y in range(water_top + 1):
                    pos = glm.ivec3(x, y, z)
                    current_id = int(self.get_voxel_id(pos)[0])
                    key = (x, y, z)
                    if key in reachable:
                        if current_id == 0:
                            self._set_world_voxel(pos, WATER_BLOCK, dirty_chunks)
                        self.water_flow[key] = flow_map.get(key, (0.0, 0.0))
                    elif current_id == WATER_BLOCK:
                        self._set_world_voxel(pos, 0, dirty_chunks)
                        self.water_flow.pop(key, None)
                    elif key in self.water_flow:
                        self.water_flow.pop(key, None)

        for chunk in dirty_chunks:
            chunk.is_empty = not np.any(chunk.voxels)
            chunk.mesh.rebuild()

    # ── leaf decay ────────────────────────────────────────────────────────────

    def _queue_leaf_decay(self, world_pos, min_delay=800, max_delay=3000):
        key = (int(world_pos.x), int(world_pos.y), int(world_pos.z))
        if key in self.leaf_decay_scheduled:
            return
        self.leaf_decay_scheduled.add(key)
        due_time = pg.time.get_ticks() + random.randint(min_delay, max_delay)
        self.leaf_decay_queue.append((due_time, key))

    def _schedule_leaf_decay_near(self, center_pos, radius=4):
        cx, cy, cz = int(center_pos.x), int(center_pos.y), int(center_pos.z)
        for dx in range(-radius, radius + 1):
            for dy in range(-radius, radius + 1):
                for dz in range(-radius, radius + 1):
                    pos = glm.ivec3(cx+dx, cy+dy, cz+dz)
                    result = self.get_voxel_id(pos)
                    if result[3] and int(result[0]) == LEAVES:
                        self._queue_leaf_decay(pos)

    def _has_wood_support(self, world_pos, radius=4):
        cx, cy, cz = int(world_pos.x), int(world_pos.y), int(world_pos.z)
        for dx in range(-radius, radius + 1):
            for dy in range(-radius, radius + 1):
                for dz in range(-radius, radius + 1):
                    pos = glm.ivec3(cx+dx, cy+dy, cz+dz)
                    result = self.get_voxel_id(pos)
                    if result[3] and int(result[0]) == WOOD:
                        return True
        return False

    def _process_leaf_decay(self):
        if not self.leaf_decay_queue:
            return
        now = pg.time.get_ticks()
        current_queue = self.leaf_decay_queue
        self.leaf_decay_queue = []
        dirty_chunks = set()

        for due_time, key in current_queue:
            if due_time > now:
                self.leaf_decay_queue.append((due_time, key))
                continue
            self.leaf_decay_scheduled.discard(key)
            pos = glm.ivec3(*key)
            result = self.get_voxel_id(pos)
            if not result[3] or int(result[0]) != LEAVES:
                continue
            if self._has_wood_support(pos):
                self._queue_leaf_decay(pos, 1500, 4000)
                continue
            voxel_id, voxel_index, _, chunk = result
            chunk.voxels[voxel_index] = 0
            self._mark_dirty_chunks(pos, dirty_chunks)
            self._schedule_leaf_decay_near(pos, radius=2)

        for chunk in dirty_chunks:
            chunk.is_empty = not np.any(chunk.voxels)
            chunk.mesh.rebuild()

    # ── mode / interaction ────────────────────────────────────────────────────

    def set_voxel(self):
        if self.interaction_mode:
            self.add_voxel()
        else:
            self.remove_voxel()

    def switch_mode(self):
        self.interaction_mode = not self.interaction_mode

    # ── break timing ──────────────────────────────────────────────────────────

    def start_break(self):
        self.ray_cast()
        if self.voxel_id:
            self.breaking = True
            self.break_timer = 0.0

    def stop_break(self):
        self.breaking = False
        self.break_timer = 0.0

    def get_break_time(self) -> float:
        """Return break time in seconds for the currently targeted block."""
        return compute_break_time(
            block_id=int(self.voxel_id),
            tier=_get_held_tier(self.app),
            efficiency_level=_get_held_efficiency(self.app),
            haste_level=getattr(self.app.player, 'haste_level', 0),
        )

    def can_break(self) -> bool:
        if not self.voxel_id:
            return False
        return int(self.voxel_id) not in UNBREAKABLE

    # ── ray casting ───────────────────────────────────────────────────────────

    def ray_cast(self):
        eye = self.app.player.get_camera_position()
        x1, y1, z1 = eye
        x2, y2, z2 = eye + self.app.player.forward * MAX_RAY_DIST

        current_voxel_pos = glm.ivec3(x1, y1, z1)
        self.voxel_id = 0
        self.voxel_normal = glm.ivec3(0)
        step_dir = -1

        dx = glm.sign(x2 - x1)
        delta_x = min(dx / (x2 - x1), 1e7) if dx != 0 else 1e7
        max_x = delta_x * (1.0 - glm.fract(x1)) if dx > 0 else delta_x * glm.fract(x1)

        dy = glm.sign(y2 - y1)
        delta_y = min(dy / (y2 - y1), 1e7) if dy != 0 else 1e7
        max_y = delta_y * (1.0 - glm.fract(y1)) if dy > 0 else delta_y * glm.fract(y1)

        dz = glm.sign(z2 - z1)
        delta_z = min(dz / (z2 - z1), 1e7) if dz != 0 else 1e7
        max_z = delta_z * (1.0 - glm.fract(z1)) if dz > 0 else delta_z * glm.fract(z1)

        while not (max_x > 1.0 and max_y > 1.0 and max_z > 1.0):
            result = self.get_voxel_id(voxel_world_pos=current_voxel_pos)
            if result[0] and int(result[0]) != WATER_BLOCK:
                self.voxel_id, self.voxel_index, self.voxel_local_pos, self.chunk = result
                self.voxel_world_pos = current_voxel_pos
                if step_dir == 0:
                    self.voxel_normal.x = -dx
                elif step_dir == 1:
                    self.voxel_normal.y = -dy
                else:
                    self.voxel_normal.z = -dz
                return True

            if max_x < max_y:
                if max_x < max_z:
                    current_voxel_pos.x += dx;  max_x += delta_x;  step_dir = 0
                else:
                    current_voxel_pos.z += dz;  max_z += delta_z;  step_dir = 2
            else:
                if max_y < max_z:
                    current_voxel_pos.y += dy;  max_y += delta_y;  step_dir = 1
                else:
                    current_voxel_pos.z += dz;  max_z += delta_z;  step_dir = 2
        return False

    def get_voxel_id(self, voxel_world_pos):
        cx, cy, cz = chunk_pos = voxel_world_pos / CHUNK_SIZE
        if 0 <= cx < WORLD_W and 0 <= cy < WORLD_H and 0 <= cz < WORLD_D:
            chunk_index = int(cx + WORLD_W * cz + WORLD_AREA * cy)
            chunk = self.chunks[chunk_index]
            lx, ly, lz = voxel_local_pos = voxel_world_pos - chunk_pos * CHUNK_SIZE
            voxel_index = int(lx + CHUNK_SIZE * lz + CHUNK_AREA * ly)
            voxel_id = chunk.voxels[voxel_index]
            return voxel_id, voxel_index, voxel_local_pos, chunk
        return 0, 0, 0, 0