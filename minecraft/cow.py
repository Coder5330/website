from settings import *
from mob import Mob
import pygame as pg
import math, random

COW_SPEED = 0.0004
WANDER_CHANGE_MS = 3000

class Cow(Mob):
    """Passive mob — wanders randomly, flees when hit."""
    def __init__(self, app, position):
        super().__init__(app, position, health=10)
        self.yaw = random.uniform(0, math.pi * 2)
        self._wander_timer = 0
        self._fleeing = False
        self._flee_timer = 0
        self.texture = self._load_texture()
        self.vao = self._build_vao()

    def _load_texture(self):
        img = pg.image.load('assets/cow.png').convert_alpha()
        w, h = img.get_size()
        data = pg.image.tostring(img, 'RGBA', False)
        tex = self.app.ctx.texture((w, h), 4, data)
        tex.filter = (self.app.ctx.NEAREST, self.app.ctx.NEAREST)
        return tex

    def _uv(self, px, py, pw, ph, W=64, H=32):
        u0, u1 = px / W, (px + pw) / W
        v0, v1 = py / H, (py + ph) / H
        return [u0, v1,  u1, v1,  u1, v0,  u0, v0]

    def _face(self, p0, p1, p2, p3, uvs):
        u = uvs
        return [*p0, u[0], u[1], *p1, u[2], u[3], *p2, u[4], u[5], *p3, u[6], u[7]]

    def _box(self, x0, y0, z0, x1, y1, z1, top, bottom, right, front, left, back):
        v = []
        v += self._face([x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1], front)
        v += self._face([x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0], back)
        v += self._face([x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0], left)
        v += self._face([x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1], right)
        v += self._face([x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0], top)
        v += self._face([x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1], bottom)
        return v

    def _build_vao(self):
        u = self._uv
        # Minecraft cow skin 64x32
        head_top    = u( 8,  0,  8,  8)
        head_bottom = u(16,  0,  8,  8)
        head_right  = u( 0,  8,  8,  8)
        head_front  = u( 8,  8,  8,  8)
        head_left   = u(16,  8,  8,  8)
        head_back   = u(24,  8,  8,  8)

        body_top    = u(28,  0, 10,  4)
        body_bottom = u(38,  0, 10,  4)
        body_right  = u(18,  4,  4, 12)
        body_front  = u(22,  4, 10, 12)
        body_left   = u(32,  4,  4, 12)
        body_back   = u(36,  4, 10, 12)

        lt  = u( 4, 16,  4,  4)
        lb  = u( 8, 16,  4,  4)
        lr  = u( 0, 20,  4,  6)
        lf  = u( 4, 20,  4,  6)
        ll  = u( 8, 20,  4,  6)
        lbk = u(12, 20,  4,  6)

        body_hw, body_hh, body_hl = 0.45, 0.30, 0.60
        body_cy = 0.35
        leg_w, leg_h = 0.15, 0.38
        leg_top = body_cy - body_hh
        head_s = 0.22

        verts = []
        verts += self._box(-body_hw, body_cy-body_hh, -body_hl,
                            body_hw, body_cy+body_hh,  body_hl,
                            body_top, body_bottom, body_right, body_front, body_left, body_back)
        verts += self._box(-head_s, body_cy-head_s,  body_hl,
                            head_s, body_cy+head_s,  body_hl+head_s*2,
                            head_top, head_bottom, head_right, head_front, head_left, head_back)
        for lx, lz in ((body_hw-leg_w, body_hl-leg_w), (-body_hw+leg_w, body_hl-leg_w),
                        (body_hw-leg_w, -body_hl+leg_w), (-body_hw+leg_w, -body_hl+leg_w)):
            verts += self._box(lx-leg_w, leg_top-leg_h, lz-leg_w,
                               lx+leg_w, leg_top,       lz+leg_w,
                               lt, lb, lr, lf, ll, lbk)

        verts = np.array(verts, dtype='f4')
        indices = []
        for i in range(len(verts) // 20):
            b = i * 4
            indices += [b, b+1, b+2, b, b+2, b+3]
        vbo = self.app.ctx.buffer(verts)
        ibo = self.app.ctx.buffer(np.array(indices, dtype='u4'))
        return self.app.ctx.vertex_array(
            self.app.shader_program.player_model,
            [(vbo, '3f 2f', 'in_position', 'in_uv')], ibo)

    def take_damage(self, amount):
        was_alive = self.alive
        super().take_damage(amount)
        if was_alive and not self.alive:
            self.app.scene.dropped_items.spawn(ITEM_BEEF, self.position + glm.vec3(0, 0.5, 0), 1)
        else:
            self._fleeing = True
            self._flee_timer = 2000

    def update(self):
        super().update()
        if not self.alive:
            return
        dt = self.app.delta_time
        player = self.app.player
        if self._fleeing:
            self._flee_timer -= dt
            if self._flee_timer <= 0:
                self._fleeing = False
            dx = self.position.x - player.position.x
            dz = self.position.z - player.position.z
            dist = math.sqrt(dx*dx + dz*dz) or 1
            self.yaw = math.atan2(dz, dx)
            self.position.x += (dx/dist) * COW_SPEED * 2 * dt
            self.position.z += (dz/dist) * COW_SPEED * 2 * dt
        else:
            self._wander_timer += dt
            if self._wander_timer >= WANDER_CHANGE_MS:
                self._wander_timer = 0
                if random.random() < 0.6:
                    self.yaw = random.uniform(0, math.pi * 2)
            if random.random() < 0.3:
                self.position.x += math.cos(self.yaw) * COW_SPEED * dt
                self.position.z += math.sin(self.yaw) * COW_SPEED * dt

    def get_model_matrix(self):
        m = glm.mat4()
        m = glm.translate(m, self.position)
        m = glm.rotate(m, self.yaw + glm.radians(90), glm.vec3(0, 1, 0))
        return m

    def render(self):
        if not self.alive:
            return
        self.texture.use(location=4)
        shader = self.app.shader_program.player_model
        shader['u_texture'] = 4
        shader['m_model'].write(self.get_model_matrix())
        shader['m_view'].write(self.app.player.m_view)
        shader['m_proj'].write(self.app.player.m_proj)
        self.vao.render()