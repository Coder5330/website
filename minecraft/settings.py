from numba import njit
import numpy as np
import glm
import math
import os
import random as pyrandom

# OpenGL settings
MAJOR_VER, MINOR_VER = 3, 3
DEPTH_SIZE = 24
NUM_SAMPLES = 1  # antialiasing

# resolution
WIN_RES = glm.vec2(1600, 900)

# world generation
SEED = 0
NOISE_OFFSET_X = 0.0
NOISE_OFFSET_Z = 0.0
HEIGHT_WARP_STRENGTH = 0.0


def apply_world_seed(seed):
    global SEED, NOISE_OFFSET_X, NOISE_OFFSET_Z, HEIGHT_WARP_STRENGTH
    SEED = int(seed)
    terrain_rng = pyrandom.Random(SEED)
    NOISE_OFFSET_X = terrain_rng.uniform(-8000.0, 8000.0)
    NOISE_OFFSET_Z = terrain_rng.uniform(-8000.0, 8000.0)
    HEIGHT_WARP_STRENGTH = terrain_rng.uniform(24.0, 62.0)


apply_world_seed(int(os.getenv('MINECRAFT_SEED', pyrandom.SystemRandom().randrange(1, 1_000_000_000))))

# ray casting
MAX_RAY_DIST = 6

# chunk
CHUNK_SIZE = 48
H_CHUNK_SIZE = CHUNK_SIZE // 2
CHUNK_AREA = CHUNK_SIZE * CHUNK_SIZE
CHUNK_VOL = CHUNK_AREA * CHUNK_SIZE
CHUNK_SPHERE_RADIUS = H_CHUNK_SIZE * math.sqrt(3)

# world
WORLD_W, WORLD_H = 20, 8
WORLD_H = 2  # keep vertical fixed
RENDER_DIST = 10  # chunks in each horizontal direction
WORLD_D = WORLD_W
WORLD_AREA = WORLD_W * WORLD_D
WORLD_VOL = WORLD_AREA * WORLD_H

# world center
CENTER_XZ = WORLD_W * H_CHUNK_SIZE
CENTER_Y = WORLD_H * H_CHUNK_SIZE

# camera
ASPECT_RATIO = WIN_RES.x / WIN_RES.y
FOV_DEG = 50
V_FOV = glm.radians(FOV_DEG)  # vertical FOV
H_FOV = 2 * math.atan(math.tan(V_FOV * 0.5) * ASPECT_RATIO)  # horizontal FOV
NEAR = 0.1
FAR = 4000.0
PITCH_MAX = glm.radians(89)

# colors
BG_COLOR = glm.vec3(0.58, 0.83, 0.99)

# ── Block IDs ────────────────────────────────────────────────────────────────
# Surface / basic blocks (existing)
SAND   = 1
GRASS  = 2
DIRT   = 3
STONE  = 4
SNOW   = 5
LEAVES = 6
WOOD   = 7

# Fluid / special (existing)
WATER_BLOCK = 8   # unbreakable placeholder – water is a mesh, not a voxel

# Deep / underground blocks
BEDROCK   = 9    # indestructible floor (Y 0-1)
DEEPSLATE = 10   # hard rock layer (Y 2-15), 3× mine time
LAVA      = 11   # unbreakable lava lake block (damages player on contact)

# Ores
COAL_ORE      = 12   # found Y 10-80, wood+ pickaxe
IRON_ORE      = 13   # found Y 5-60, stone+ pickaxe
COPPER_ORE    = 14   # found Y 10-70, stone+ pickaxe
GOLD_ORE      = 15   # found Y 5-30, iron+ pickaxe
REDSTONE_ORE  = 16   # found Y 2-16, iron+ pickaxe
DIAMOND_ORE   = 17   # found Y 2-16, iron+ pickaxe (best around Y 7)
DEEPSLATE_DIAMOND_ORE = 18  # Y 2-14, deepslate variant, iron+ pickaxe

# Crafting Table block (placed in the world, right-click to open 3×3 UI)
CRAFTING_TABLE = 19

# Aliases kept for tree generation (same texture slots)
BIRCH_WOOD   = WOOD
BIRCH_LEAVES = LEAVES
PINE_WOOD    = WOOD
PINE_LEAVES  = LEAVES

# ── Tool tiers ────────────────────────────────────────────────────────────────
TOOL_TIER_NONE      = 0
TOOL_TIER_WOOD      = 1
TOOL_TIER_STONE     = 2
TOOL_TIER_COPPER   = 2  # same tier as stone, different texture
TOOL_TIER_IRON      = 3
TOOL_TIER_DIAMOND   = 4
TOOL_TIER_NETHERITE = 5
TOOL_TIER_GOLDEN = 6  # for fun, better than netherite

# Pickaxe / tool item IDs (stored in inventory slots alongside blocks)
ITEM_WOOD_PICK      = 101
ITEM_STONE_PICK     = 102
ITEM_IRON_PICK      = 103
ITEM_DIAMOND_PICK   = 104
ITEM_NETHERITE_PICK = 105
ITEM_PLANK          = 106
ITEM_STICK          = 107
ITEM_CRAFTING_TABLE = 108   # crafting table as a placeable item

# Food items
ITEM_APPLE          = 109   # drops from leaves (rare)
ITEM_PORKCHOP       = 110   # drops from pig
ITEM_BEEF           = 111   # drops from cow
ITEM_MUTTON         = 112   # drops from sheep

# How many hunger points each food restores (out of 20)
FOOD_HUNGER_RESTORE = {
    ITEM_APPLE:    4,
    ITEM_PORKCHOP: 8,
    ITEM_BEEF:     8,
    ITEM_MUTTON:   6,
}

PICKAXE_TIERS = {
    ITEM_WOOD_PICK:      TOOL_TIER_WOOD,
    ITEM_STONE_PICK:     TOOL_TIER_STONE,
    ITEM_IRON_PICK:      TOOL_TIER_IRON,
    ITEM_DIAMOND_PICK:   TOOL_TIER_DIAMOND,
    ITEM_NETHERITE_PICK: TOOL_TIER_NETHERITE,
}

TOOL_MAX_DURABILITY = {
    ITEM_WOOD_PICK: 59,
    ITEM_STONE_PICK: 131,
    ITEM_IRON_PICK: 250,
    ITEM_DIAMOND_PICK: 1561,
    ITEM_NETHERITE_PICK: 2031,
}

# Minimum tool tier required to HARVEST a block (drops item).
BLOCK_REQUIRED_TIER = {
    COAL_ORE:     TOOL_TIER_WOOD,
    IRON_ORE:     TOOL_TIER_STONE,
    COPPER_ORE:   TOOL_TIER_STONE,
    GOLD_ORE:     TOOL_TIER_IRON,
    REDSTONE_ORE: TOOL_TIER_IRON,
    DIAMOND_ORE:  TOOL_TIER_IRON,
    DEEPSLATE_DIAMOND_ORE: TOOL_TIER_IRON,
    DEEPSLATE:    TOOL_TIER_WOOD,
    BEDROCK:      999,
    LAVA:         999,
}

# What item(s) a block drops when mined: block_id -> drop_id
# If not listed, drops itself.  0 = drops nothing.
# LEAVES has a chance to drop ITEM_APPLE — handled in voxel_handler.remove_voxel
BLOCK_DROPS = {
    LEAVES:       0,          # override: see voxel_handler apple chance
    COAL_ORE:     COAL_ORE,
    IRON_ORE:     IRON_ORE,
    COPPER_ORE:   COPPER_ORE,
    GOLD_ORE:     GOLD_ORE,
    REDSTONE_ORE: REDSTONE_ORE,
    DIAMOND_ORE:  DIAMOND_ORE,
    DEEPSLATE_DIAMOND_ORE: DIAMOND_ORE,
    # Crafting table drops the item version when broken
    CRAFTING_TABLE: ITEM_CRAFTING_TABLE,
}

# Blocks that are interactable (right-click opens UI instead of placing)
INTERACTABLE_BLOCKS = {
    CRAFTING_TABLE,
}

# Item → placeable block ID mapping (for ITEM_CRAFTING_TABLE -> CRAFTING_TABLE)
ITEM_TO_BLOCK = {
    ITEM_CRAFTING_TABLE: CRAFTING_TABLE,
}

# ── falling blocks (physics) ─────────────────────────────────────────────────
FALLING_BLOCKS = {SAND}

# ── terrain levels (surface) ─────────────────────────────────────────────────
SNOW_LVL  = 54
STONE_LVL = 49
DIRT_LVL  = 40
GRASS_LVL = 8
SAND_LVL  = 7

# ── deep layer Y boundaries ───────────────────────────────────────────────────
BEDROCK_MAX_Y   = 2
DEEPSLATE_MAX_Y = 16
LAVA_LAKE_MIN_Y = 3
LAVA_LAKE_MAX_Y = 12

DIAMOND_BEST_Y  = 7

# ── tree settings ─────────────────────────────────────────────────────────────
TREE_PROBABILITY = 0.02
TREE_WIDTH, TREE_HEIGHT = 4, 8
TREE_H_WIDTH, TREE_H_HEIGHT = TREE_WIDTH // 2, TREE_HEIGHT // 2

# ── water ─────────────────────────────────────────────────────────────────────
WATER_LINE = 5.6
WATER_AREA = 5 * CHUNK_SIZE * WORLD_W
WATER_FLOW_RADIUS = 24
PLAYER_WATER_PUSH = 0.00055
MOB_WATER_PUSH = 0.00035

# ── cloud ─────────────────────────────────────────────────────────────────────
CLOUD_SCALE  = 25
CLOUD_HEIGHT = WORLD_H * CHUNK_SIZE * 2

# ── physics ───────────────────────────────────────────────────────────────────
GRAVITY       = -0.0004
JUMP_STRENGTH = 0.08

# player
PLAYER_SPEED = 0.005
PLAYER_ROT_SPEED = 0.003
PLAYER_POS = glm.vec3(CENTER_XZ, CHUNK_SIZE, CENTER_XZ)
MOUSE_SENSITIVITY = 0.002