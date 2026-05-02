import pygame as pg
from camera import Camera
from settings import *


class Player(Camera):
    def __init__(self, app, position=PLAYER_POS, yaw=-90, pitch=0):
        self.app = app
        super().__init__(position, yaw, pitch)
        self.velocity_y = 0
        self.is_on_ground = False
        self.third_person = False
        self.third_person_dist = 3

    def set_spawn(self):
        x, z = int(self.position.x), int(self.position.z)
        for y in range(WORLD_H * CHUNK_SIZE - 1, -1, -1):
            result = self.app.scene.world.voxel_handler.get_voxel_id(glm.ivec3(x, y, z))
            if result[0]:
                self.position.y = y + 2
                break

    def get_camera_position(self):
        if self.third_person:
            dist = self.third_person_dist
            behind = glm.vec3(
                glm.cos(self.yaw) * glm.cos(self.pitch) * dist,
                -glm.sin(self.pitch) * dist,
                glm.sin(self.yaw) * glm.cos(self.pitch) * dist
            )
            base = self.position + glm.vec3(0, 2, 0)

            steps = 20
            for i in range(steps, 0, -1):
                t = i / steps
                test_pos = base + (-behind) * t
                test_pos.y = max(test_pos.y, self.position.y + 0.5)
                if not self.check_block(test_pos):
                    return test_pos

            return base
        else:
            cam_pos = self.position + glm.vec3(0, 1.6, 0)
            if self.check_block(cam_pos):
                offset = glm.vec3(0.3, 0.3, 0.3)
                test_positions = [
                    cam_pos + offset,
                    cam_pos - offset,
                    cam_pos + glm.vec3(offset.x, -offset.y, offset.z),
                    cam_pos + glm.vec3(-offset.x, offset.y, -offset.z),
                ]
                for test_pos in test_positions:
                    if not self.check_block(test_pos):
                        return test_pos
                return self.position
            return cam_pos

    def update(self):
        if not self.app.inventory.any_ui_open:
            self.keyboard_control()
            self.mouse_control()
        self.apply_water_current()
        self.apply_gravity()
        if not self.app.inventory.any_ui_open:
            self.handle_breaking()
        super().update()

    def handle_breaking(self):
        vh = self.app.scene.world.voxel_handler
        left_held = pg.mouse.get_pressed()[0]

        if not left_held:
            if vh.breaking:
                vh.breaking = False
                vh.break_timer = 0
            return

        if not vh.breaking:
            vh.ray_cast()
            if not vh.voxel_id or not vh.can_break():
                self.app.mob_manager.handle_player_attack()
                return
            vh.breaking = True
            vh.break_timer = 0
            vh.break_target = glm.ivec3(vh.voxel_world_pos)
            return

        vh.break_timer += self.app.delta_time * 0.001

        result = vh.get_voxel_id(vh.break_target)
        if not result[0]:
            vh.breaking = False
            vh.break_timer = 0
            return

        vh.ray_cast()
        if vh.voxel_id == 0 or glm.ivec3(vh.voxel_world_pos) != vh.break_target:
            vh.breaking = False
            vh.break_timer = 0
            return

        if vh.break_timer >= vh.get_break_time():
            voxel_id, voxel_index, voxel_local_pos, chunk = result
            vh.voxel_id        = voxel_id
            vh.voxel_index     = voxel_index
            vh.voxel_local_pos = voxel_local_pos
            vh.voxel_world_pos = glm.ivec3(vh.break_target)
            vh.chunk           = chunk

            # Delegate to remove_voxel so tool-tier and drop logic is applied.
            vh.remove_voxel()

            chunk.mesh.rebuild()
            vh.rebuild_adjacent_chunks()
            vh.breaking = False
            vh.break_timer = 0

    def handle_event(self, event):
        if self.app.inventory.any_ui_open:
            if event.type == pg.KEYDOWN and event.key == pg.K_F5:
                self.third_person = not self.third_person
            return
        if event.type == pg.MOUSEBUTTONDOWN:
            if event.button == 3:
                inv = self.app.inventory
                vh = self.app.scene.world.voxel_handler
                # Check if looking at an interactable block (e.g. crafting table)
                if vh.voxel_id and int(vh.voxel_id) in INTERACTABLE_BLOCKS:
                    inv.try_interact_block(int(vh.voxel_id))
                else:
                    block_id = inv.selected_block_id()
                    if block_id:
                        vh.new_voxel_id = block_id
                        if vh.add_voxel():
                            inv.remove_selected()
        if event.type == pg.KEYDOWN:
            if event.key == pg.K_F5:
                self.third_person = not self.third_person

    def apply_gravity(self):
        self.velocity_y += GRAVITY * self.app.delta_time
        self.velocity_y = max(self.velocity_y, -0.5)
        self.position.y += self.velocity_y
        ground_height = self.get_ground_height()
        if self.velocity_y > 0:
            if self.check_block(glm.vec3(self.position.x, self.position.y + 1.8, self.position.z)):
                self.velocity_y = 0
        if self.velocity_y <= 0 and self.position.y <= ground_height:
            self.position.y = ground_height
            self.velocity_y = 0
            self.is_on_ground = True
        else:
            self.is_on_ground = False

    def get_ground_height(self):
        x, z = int(self.position.x), int(self.position.z)
        for y in range(int(self.position.y), -1, -1):
            result = self.app.scene.world.voxel_handler.get_voxel_id(glm.ivec3(x, y, z))
            if result[0] and int(result[0]) != WATER_BLOCK:
                return y + 2
        return 0

    def check_block(self, pos):
        result = self.app.scene.world.voxel_handler.get_voxel_id(
            glm.ivec3(int(pos.x), int(pos.y), int(pos.z))
        )
        return result[0] and int(result[0]) != WATER_BLOCK

    def check_collision(self, pos):
        radius = 0.3
        for dx in (-radius, radius):
            for dz in (-radius, radius):
                for y_offset in (0.0, 0.9, 1.8):
                    result = self.app.scene.world.voxel_handler.get_voxel_id(
                        glm.ivec3(int(pos.x + dx), int(pos.y + y_offset), int(pos.z + dz))
                    )
                    if result[0] and int(result[0]) != WATER_BLOCK:
                        return True
        return False

    def _horizontal_axes(self):
        forward = glm.vec3(self.forward.x, 0.0, self.forward.z)
        if glm.length(forward) < 1e-6:
            forward = glm.vec3(0.0, 0.0, -1.0)
        else:
            forward = glm.normalize(forward)
        right = glm.normalize(glm.cross(forward, glm.vec3(0.0, 1.0, 0.0)))
        return forward, right

    def _move_and_collide(self, delta):
        if delta.x:
            test_pos = glm.vec3(self.position.x + delta.x, self.position.y, self.position.z)
            if not self.check_collision(test_pos):
                self.position.x = test_pos.x
        if delta.z:
            test_pos = glm.vec3(self.position.x, self.position.y, self.position.z + delta.z)
            if not self.check_collision(test_pos):
                self.position.z = test_pos.z

    def apply_water_current(self):
        flow = self.app.scene.world.voxel_handler.get_water_current(
            self.position + glm.vec3(0.0, 0.5, 0.0), PLAYER_WATER_PUSH
        )
        if glm.length(flow) > 1e-6:
            self._move_and_collide(flow)

    def mouse_control(self):
        cx, cy = int(WIN_RES.x // 2), int(WIN_RES.y // 2)
        mx, my = pg.mouse.get_pos()
        mouse_dx = mx - cx
        mouse_dy = my - cy
        if mouse_dx or mouse_dy:
            pg.mouse.set_pos((cx, cy))
            if mouse_dx:
                self.rotate_yaw(delta_x=mouse_dx * MOUSE_SENSITIVITY)
            if mouse_dy:
                self.rotate_pitch(delta_y=mouse_dy * MOUSE_SENSITIVITY)

    def keyboard_control(self):
        key_state = pg.key.get_pressed()
        vel = PLAYER_SPEED * self.app.delta_time
        forward, right = self._horizontal_axes()
        move = glm.vec3(0.0)

        if key_state[pg.K_w]:
            move += forward
        if key_state[pg.K_s]:
            move -= forward
        if key_state[pg.K_d]:
            move += right
        if key_state[pg.K_a]:
            move -= right

        if glm.length(move) > 1e-6:
            move = glm.normalize(move) * vel
            self._move_and_collide(move)

        if key_state[pg.K_SPACE] and self.is_on_ground:
            self.velocity_y = JUMP_STRENGTH