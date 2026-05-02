from noise import noise2, noise3
from random import random
from settings import *


@njit
def get_height(x, z):
    sample_x = x + NOISE_OFFSET_X
    sample_z = z + NOISE_OFFSET_Z
    # Reduced warp so adjacent columns differ by at most 1-2 blocks on normal ground
    warp_x = noise2(sample_x * 0.003, sample_z * 0.003) * HEIGHT_WARP_STRENGTH * 0.3
    warp_z = noise2((sample_x + 137.0) * 0.003, (sample_z - 211.0) * 0.003) * HEIGHT_WARP_STRENGTH * 0.3
    sample_x += warp_x
    sample_z += warp_z

    # island mask
    island = 1 / (pow(0.0025 * math.hypot(x - CENTER_XZ, z - CENTER_XZ), 20) + 0.0001)
    island = min(island, 1)

    a1 = CENTER_Y
    a2, a4, a8 = a1 * 0.5, a1 * 0.25, a1 * 0.125
    f1 = 0.005
    f2, f4, f8 = f1 * 2, f1 * 4, f1 * 8

    if noise2(0.1 * sample_x, 0.1 * sample_z) < 0:
        a1 /= 1.07

    height = 0
    height += noise2(sample_x * f1, sample_z * f1) * a1 + a1
    # Reduce high-frequency amplitudes so per-step height change stays small
    height += noise2(sample_x * f2, sample_z * f2) * a2 * 0.4 - a2 * 0.4
    height += noise2(sample_x * f4, sample_z * f4) * a4 * 0.3 + a4 * 0.3
    height += noise2(sample_x * f8, sample_z * f8) * a8 * 0.2 - a8 * 0.2
    # Keep mountain peaks but soften absolute ridges
    height += abs(noise2(sample_x * 0.012, sample_z * 0.012)) * a4 * 0.4
    height += noise2(sample_x * 0.025, sample_z * 0.025) * a8 * 0.5
    height = max(height, noise2(sample_x * f8, sample_z * f8) + 2)
    height *= island
    return int(height)


@njit
def get_index(x, y, z):
    return x + CHUNK_SIZE * z + CHUNK_AREA * y


@njit
def _ore_noise(wx, wy, wz, scale, threshold):
    """Returns True when a 3-D noise pocket exceeds the threshold."""
    return noise3(wx * scale, wy * scale, wz * scale) > threshold


@njit
def _world_to_minecraft_y(wy):
    world_top = WORLD_H * CHUNK_SIZE - 1
    return -64.0 + (wy / world_top) * 383.0


@njit
def _peak_strength(value, center, radius):
    dist = abs(value - center)
    if dist >= radius:
        return 0.0
    return 1.0 - dist / radius


@njit
def set_voxel_id(voxels, x, y, z, wx, wy, wz, world_height):
    voxel_id = 0
    surface_y = world_height - 1

    # ── Surface / near-surface bands always win, even on low terrain ─────────
    if wy == surface_y:
        voxel_id = SAND if surface_y <= WATER_LINE else GRASS
        voxels[get_index(x, y, z)] = voxel_id
        if voxel_id == GRASS:
            place_tree(voxels, x, y, z, voxel_id, wx, wz)
        return

    if wy >= surface_y - 3 and wy < surface_y:
        voxel_id = SAND if surface_y <= WATER_LINE else DIRT
        voxels[get_index(x, y, z)] = voxel_id
        return

    # ── Absolute bedrock floor (Y 0-1) ───────────────────────────────────────
    if wy < BEDROCK_MAX_Y:
        voxel_id = BEDROCK
        voxels[get_index(x, y, z)] = voxel_id
        return

    mc_y = _world_to_minecraft_y(wy)
    base_block = DEEPSLATE if mc_y < 0 else STONE

    # Keep caves safely underground so the surface stays grassy.
    if (surface_y - wy > 8 and
            noise3(wx * 0.09, wy * 0.09, wz * 0.09) > 0 and
            noise2(wx * 0.1, wz * 0.1) * 3 + 3 < wy < world_height - 10):
        voxel_id = 0
        voxels[get_index(x, y, z)] = voxel_id
        return

    voxel_id = base_block

    # Very deep lava pockets only, well below normal digging height.
    if mc_y <= -48 and _ore_noise(wx, wy, wz, 0.18, 0.78):
        voxel_id = LAVA
    else:
        # Diamonds increase from Y 16 down to the bottom, peaking near Y -59.
        if -64 <= mc_y <= 16:
            diamond_strength = max(
                (16.0 - mc_y) / 80.0,
                _peak_strength(mc_y, -59.0, 20.0)
            )
            diamond_threshold = 0.82 - diamond_strength * 0.14
            if _ore_noise(wx, wy, wz, 0.22, diamond_threshold):
                voxel_id = DEEPSLATE_DIAMOND_ORE if mc_y < 0 else DIAMOND_ORE
            else:
                redstone_strength = _peak_strength(mc_y, -59.0, 24.0)
                redstone_threshold = 0.84 - redstone_strength * 0.17
                if _ore_noise(wx, wy, wz, 0.24, redstone_threshold):
                    voxel_id = REDSTONE_ORE

        if voxel_id == base_block and -64 <= mc_y <= 32:
            gold_strength = _peak_strength(mc_y, -16.0, 40.0)
            gold_threshold = 0.86 - gold_strength * 0.16
            if _ore_noise(wx, wy, wz, 0.20, gold_threshold):
                voxel_id = GOLD_ORE

        if voxel_id == base_block and (-24 <= mc_y <= 96 or mc_y >= 180):
            iron_strength = max(
                _peak_strength(mc_y, 16.0, 64.0),
                _peak_strength(mc_y, 232.0, 64.0)
            )
            iron_threshold = 0.85 - iron_strength * 0.18
            if _ore_noise(wx, wy, wz, 0.18, iron_threshold):
                voxel_id = IRON_ORE

        if voxel_id == base_block and 0 <= mc_y <= 96:
            copper_strength = _peak_strength(mc_y, 48.0, 48.0)
            copper_threshold = 0.84 - copper_strength * 0.15
            if _ore_noise(wx, wy, wz, 0.17, copper_threshold):
                voxel_id = COPPER_ORE

        if voxel_id == base_block and 64 <= mc_y <= 160:
            coal_strength = _peak_strength(mc_y, 116.0, 52.0)
            coal_threshold = 0.84 - coal_strength * 0.16
            if _ore_noise(wx, wy, wz, 0.15, coal_threshold):
                voxel_id = COAL_ORE

    voxels[get_index(x, y, z)] = voxel_id


@njit
def place_tree(voxels, x, y, z, voxel_id, wx, wz):
    rnd = random()
    if voxel_id != GRASS or rnd > TREE_PROBABILITY:
        return None

    # pick tree type based on noise: oak / birch / pine
    tree_type = int(noise2(wx * 0.3, wz * 0.3) * 1.5 + 1.5) % 3  # 0=oak 1=birch 2=pine

    if tree_type == 2:
        # PINE — tall narrow trunk, small layered cone canopy
        trunk_h = 10
        if y + trunk_h >= CHUNK_SIZE:
            return None
        if x < 2 or x >= CHUNK_SIZE - 2 or z < 2 or z >= CHUNK_SIZE - 2:
            return None
        voxels[get_index(x, y, z)] = DIRT
        for iy in range(1, trunk_h):
            voxels[get_index(x, y + iy, z)] = WOOD
        # layered rings shrinking toward top
        for layer, iy in enumerate(range(trunk_h - 5, trunk_h)):
            r = 2 - layer // 2
            for ix in range(-r, r + 1):
                for iz in range(-r, r + 1):
                    if abs(ix) + abs(iz) <= r + 1:
                        lx, lz = x + ix, z + iz
                        if 0 <= lx < CHUNK_SIZE and 0 <= lz < CHUNK_SIZE:
                            voxels[get_index(lx, y + iy, lz)] = LEAVES
        voxels[get_index(x, y + trunk_h, z)] = LEAVES

    elif tree_type == 1:
        # BIRCH — slimmer than oak, slightly taller, round top
        trunk_h = TREE_HEIGHT + 1
        if y + trunk_h >= CHUNK_SIZE:
            return None
        hw = TREE_H_WIDTH - 1
        if x - hw < 0 or x + hw >= CHUNK_SIZE or z - hw < 0 or z + hw >= CHUNK_SIZE:
            return None
        voxels[get_index(x, y, z)] = DIRT
        for iy in range(1, trunk_h - 1):
            voxels[get_index(x, y + iy, z)] = WOOD
        # rounder, more uniform canopy
        for iy in range(trunk_h - 4, trunk_h):
            r = 2 if iy < trunk_h - 1 else 1
            for ix in range(-r, r + 1):
                for iz in range(-r, r + 1):
                    if ix * ix + iz * iz <= r * r + 1:
                        lx, lz = x + ix, z + iz
                        if 0 <= lx < CHUNK_SIZE and 0 <= lz < CHUNK_SIZE:
                            voxels[get_index(lx, y + iy, lz)] = LEAVES
        voxels[get_index(x, y + trunk_h, z)] = LEAVES

    else:
        # OAK — original tree
        if y + TREE_HEIGHT >= CHUNK_SIZE:
            return None
        if x - TREE_H_WIDTH < 0 or x + TREE_H_WIDTH >= CHUNK_SIZE:
            return None
        if z - TREE_H_WIDTH < 0 or z + TREE_H_WIDTH >= CHUNK_SIZE:
            return None
        voxels[get_index(x, y, z)] = DIRT
        m = 0
        for n, iy in enumerate(range(TREE_H_HEIGHT, TREE_HEIGHT - 1)):
            k = iy % 2
            rng = int(random() * 2)
            for ix in range(-TREE_H_WIDTH + m, TREE_H_WIDTH - m * rng):
                for iz in range(-TREE_H_WIDTH + m * rng, TREE_H_WIDTH - m):
                    if (ix + iz) % 4:
                        voxels[get_index(x + ix + k, y + iy, z + iz + k)] = LEAVES
            m += 1 if n > 0 else 3 if n > 1 else 0
        for iy in range(1, TREE_HEIGHT - 2):
            voxels[get_index(x, y + iy, z)] = WOOD
        voxels[get_index(x, y + TREE_HEIGHT - 2, z)] = LEAVES