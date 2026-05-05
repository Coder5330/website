from settings import *
from zombie import Zombie
from cow import Cow
from pig import Pig
from spider import Spider
from sheep import Sheep
import random
import math

SPAWN_RADIUS = 16
MAX_MOBS = 300      # total cap
MAX_PASSIVE = 15   # cow + pig + sheep cap
MAX_HOSTILE = 10   # zombie + spider cap
OPAQUE_BLOCKS = {STONE, DIRT, SAND, GRASS}  # solid terrain = cave ceiling


class MobManager:
    def __init__(self, app):
        self.app = app
        self.mobs = []
        self.enabled = not app.multiplayer_enabled

    # ------------------------------------------------------------------ spawn

    def _get_ground_y(self, x, z):
        for y in range(WORLD_H * CHUNK_SIZE - 1, -1, -1):
            result = self.app.scene.world.voxel_handler.get_voxel_id(
                glm.ivec3(int(x), y, int(z)))
            if result[0] and int(result[0]) != WATER_BLOCK:
                return y + 2
        return None

    def _spawn_mob(self, mob_class):
        if len(self.mobs) >= MAX_MOBS:
            return
        player = self.app.player
        angle = random.uniform(0, math.pi * 2)
        dist = random.uniform(8, SPAWN_RADIUS)
        x = player.position.x + math.cos(angle) * dist
        z = player.position.z + math.sin(angle) * dist
        y = self._get_ground_y(x, z)
        if y is not None:
            self.mobs.append(mob_class(self.app, (x, y, z)))

    def _is_dark(self):
        """Night time OR player is underground (solid opaque block above)."""
        if self.app.daylight.is_night:
            return True
        player = self.app.player
        x, z = int(player.position.x), int(player.position.z)
        y_start = int(player.position.y)
        for y in range(y_start + 1, WORLD_H * CHUNK_SIZE):
            result = self.app.scene.world.voxel_handler.get_voxel_id(
                glm.ivec3(x, y, z))
            if result[0] and int(result[0]) in OPAQUE_BLOCKS:
                return True
        return False

    def _hostile_count(self):
        return sum(1 for m in self.mobs if isinstance(m, (Zombie, Spider)))

    def _passive_count(self):
        return sum(1 for m in self.mobs if isinstance(m, (Cow, Pig, Sheep)))

    # ------------------------------------------------------------------ update

    def update(self):
        if not self.enabled:
            return
        is_night = self.app.daylight.is_night

        # passive mobs spawn during day — higher rate, includes sheep
        if not is_night and self._passive_count() < MAX_PASSIVE and random.random() < 0.4:
            mob_class = random.choice([Cow, Pig, Sheep])
            self._spawn_mob(mob_class)

        # hostile mobs only at night
        if is_night and self._hostile_count() < MAX_HOSTILE and random.random() < 0.002:
            mob_class = random.choice([Zombie, Spider])
            self._spawn_mob(mob_class)

        self.mobs = [m for m in self.mobs if m.alive]
        for mob in self.mobs:
            mob.update()

    def render(self):
        if not self.enabled:
            return
        for mob in self.mobs:
            mob.render()

    # ------------------------------------------------------------------ combat

    def handle_player_attack(self):
        if not self.enabled:
            return
        player = self.app.player
        cam_pos = player.get_camera_position()
        for mob in self.mobs:
            if not mob.alive:
                continue
            # aim at the mob's centre (1 block above its feet)
            mob_centre = glm.vec3(mob.position.x, mob.position.y + 1.0, mob.position.z)
            dx = mob_centre.x - cam_pos.x
            dy = mob_centre.y - cam_pos.y
            dz = mob_centre.z - cam_pos.z
            dist = math.sqrt(dx*dx + dy*dy + dz*dz)
            if dist < 3.5:
                forward = player.forward
                to_mob = glm.normalize(glm.vec3(dx, dy, dz))
                if glm.dot(forward, to_mob) > 0.3:
                    mob.take_damage(5)