import math
import random

from meshes.cube_mesh import CubeMesh
from settings import *


DROP_SCALE = 0.28
DROP_BOB = 0.06
DROP_PICKUP_RADIUS = 1.6
DROP_SPIN_SPEED = 0.0015


class DroppedItem:
    def __init__(self, item_id, position, count=1):
        self.item_id = item_id
        self.count = count
        self.position = glm.vec3(position) + glm.vec3(
            random.uniform(-0.18, 0.18),
            0.12,
            random.uniform(-0.18, 0.18),
        )
        self.velocity_y = 0.0
        self.spin = random.uniform(0.0, math.tau)
        self.bob_phase = random.uniform(0.0, math.tau)


class DroppedItems:
    def __init__(self, app):
        self.app = app
        self.mesh = CubeMesh(app)
        self.items = []

    def spawn(self, item_id, world_pos, count=1):
        for _ in range(count):
            self.items.append(DroppedItem(item_id, world_pos))

    def _get_ground_y(self, item):
        x, z = int(item.position.x), int(item.position.z)
        vh = self.app.scene.world.voxel_handler
        for y in range(int(item.position.y), -1, -1):
            result = vh.get_voxel_id(glm.ivec3(x, y, z))
            if result[0] and int(result[0]) != WATER_BLOCK:
                return y + 1.0
        return 0.0

    def update(self):
        if not self.items:
            return

        dt = self.app.delta_time
        player_pos = self.app.player.position
        remaining_items = []

        for item in self.items:
            item.spin += DROP_SPIN_SPEED * dt
            item.velocity_y += GRAVITY * 0.35 * dt
            item.velocity_y = max(item.velocity_y, -0.12)
            item.position.y += item.velocity_y

            ground_y = self._get_ground_y(item)
            if item.position.y <= ground_y:
                item.position.y = ground_y
                item.velocity_y = 0.0

            dx = item.position.x - player_pos.x
            dy = item.position.y - player_pos.y
            dz = item.position.z - player_pos.z
            if dx * dx + dy * dy + dz * dz <= DROP_PICKUP_RADIUS * DROP_PICKUP_RADIUS:
                leftover = self.app.inventory.add_block(item.item_id, item.count)
                if leftover == 0:
                    continue
                item.count = leftover

            remaining_items.append(item)

        self.items = remaining_items

    def _model_matrix(self, item):
        bob_y = DROP_BOB * math.sin(self.app.time * 2.5 + item.bob_phase)
        m = glm.mat4()
        m = glm.translate(m, glm.vec3(item.position.x, item.position.y + bob_y, item.position.z))
        m = glm.rotate(m, item.spin, glm.vec3(0, 1, 0))
        m = glm.scale(m, glm.vec3(DROP_SCALE))
        return m

    def render(self):
        if not self.items:
            return

        program = self.mesh.program
        program['m_view'].write(self.app.player.m_view)
        program['m_proj'].write(self.app.player.m_proj)
        program['tint_color'].write(glm.vec3(0))
        program['u_texture_0'] = 0

        for item in self.items:
            texture = self.app.textures.get_item_texture(item.item_id)
            if texture is None:
                continue
            texture.use(location=0)
            program['m_model'].write(self._model_matrix(item))
            self.mesh.render()
