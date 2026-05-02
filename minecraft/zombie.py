from settings import *
from mob import Mob
import pygame as pg
import math

ZOMBIE_SPEED = 0.001
ZOMBIE_ATTACK_RANGE = 1.5
ZOMBIE_ATTACK_DAMAGE = 1
ZOMBIE_ATTACK_COOLDOWN = 1000  # ms

class Zombie(Mob):
    def __init__(self, app, position):
        super().__init__(app, position, health=20)
        self.attack_timer = 0
        self.texture = self.load_texture()
        self.vao = self.build_vao()

    def load_texture(self):
        img = pg.image.load('assets/zombie.png').convert_alpha()
        w, h = img.get_size()
        data = pg.image.tostring(img, 'RGBA', False)
        tex = self.app.ctx.texture((w, h), 4, data)
        tex.filter = (self.app.ctx.NEAREST, self.app.ctx.NEAREST)
        return tex

    def uv(self, px, py, pw, ph, W, H):
        u0, u1 = px/W, (px+pw)/W
        v0, v1 = py/H, (py+ph)/H
        return [u0,v1, u1,v1, u1,v0, u0,v0]

    def make_face(self, p0, p1, p2, p3, uvs):
        u = uvs
        return [
            *p0, u[0], u[1],
            *p1, u[2], u[3],
            *p2, u[4], u[5],
            *p3, u[6], u[7],
        ]

    def make_box(self, x0, y0, z0, x1, y1, z1,
                 top, bottom, right, front, left, back):
        verts = []
        verts += self.make_face([x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1], front)
        verts += self.make_face([x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0], back)
        verts += self.make_face([x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0], left)
        verts += self.make_face([x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1], right)
        verts += self.make_face([x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0], top)
        verts += self.make_face([x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1], bottom)
        return verts

    def build_vao(self):
        W, H = 64, 64
        u = self.uv

        # Head (top-left of texture)
        head_top    = u( 8,  0,  8,  8, W, H)
        head_bottom = u(16,  0,  8,  8, W, H)
        head_right  = u( 0,  8,  8,  8, W, H)
        head_front  = u( 8,  8,  8,  8, W, H)
        head_left   = u(16,  8,  8,  8, W, H)
        head_back   = u(24,  8,  8,  8, W, H)

        # Torso
        torso_top    = u(20, 16,  8,  4, W, H)
        torso_bottom = u(28, 16,  8,  4, W, H)
        torso_right  = u(16, 20,  4, 12, W, H)
        torso_front  = u(20, 20,  8, 12, W, H)
        torso_left   = u(28, 20,  4, 12, W, H)
        torso_back   = u(32, 20,  8, 12, W, H)

        # Right arm (starts at x=40)
        rarm_top    = u(44, 16,  4,  4, W, H)
        rarm_bottom = u(48, 16,  4,  4, W, H)
        rarm_right  = u(40, 20,  4, 12, W, H)
        rarm_front  = u(44, 20,  4, 12, W, H)
        rarm_left   = u(48, 20,  4, 12, W, H)
        rarm_back   = u(52, 20,  4, 12, W, H)

        # Left arm (mirror right arm UVs)
        larm_top    = u(44, 16,  4,  4, W, H)
        larm_bottom = u(48, 16,  4,  4, W, H)
        larm_right  = u(48, 20,  4, 12, W, H)
        larm_front  = u(44, 20,  4, 12, W, H)
        larm_left   = u(40, 20,  4, 12, W, H)
        larm_back   = u(52, 20,  4, 12, W, H)

        # Right leg (starts at x=0, y=16 — below torso left)
        rleg_top    = u( 4, 16,  4,  4, W, H)
        rleg_bottom = u( 8, 16,  4,  4, W, H)
        rleg_right  = u( 0, 20,  4, 12, W, H)
        rleg_front  = u( 4, 20,  4, 12, W, H)
        rleg_left   = u( 8, 20,  4, 12, W, H)
        rleg_back   = u(12, 20,  4, 12, W, H)

        # Left leg (mirror right leg UVs)
        lleg_top    = u( 4, 16,  4,  4, W, H)
        lleg_bottom = u( 8, 16,  4,  4, W, H)
        lleg_right  = u( 8, 20,  4, 12, W, H)
        lleg_front  = u( 4, 20,  4, 12, W, H)
        lleg_left   = u( 0, 20,  4, 12, W, H)
        lleg_back   = u(12, 20,  4, 12, W, H)

        verts = []
        verts += self.make_box(-0.25, 1.3, -0.25,  0.25, 1.8,  0.25,
            head_top, head_bottom, head_right, head_front, head_left, head_back)
        verts += self.make_box(-0.25, 0.55, -0.15,  0.25, 1.3, 0.15,
            torso_top, torso_bottom, torso_right, torso_front, torso_left, torso_back)
        verts += self.make_box( 0.25, 0.55, -0.1,   0.45, 1.3,  0.1,
            rarm_top, rarm_bottom, rarm_right, rarm_front, rarm_left, rarm_back)
        verts += self.make_box(-0.45, 0.55, -0.1,  -0.25, 1.3,  0.1,
            larm_top, larm_bottom, larm_right, larm_front, larm_left, larm_back)
        verts += self.make_box( 0.0, -0.75, -0.1,   0.25, 0.55, 0.1,
            rleg_top, rleg_bottom, rleg_right, rleg_front, rleg_left, rleg_back)
        verts += self.make_box(-0.25, -0.75, -0.1,  0.0,  0.55, 0.1,
            lleg_top, lleg_bottom, lleg_right, lleg_front, lleg_left, lleg_back)

        verts = np.array(verts, dtype='f4')
        indices = []
        num_quads = len(verts) // (5 * 4)
        for i in range(num_quads):
            b = i * 4
            indices += [b, b+1, b+2, b, b+2, b+3]
        indices = np.array(indices, dtype='u4')

        vbo = self.app.ctx.buffer(verts)
        ibo = self.app.ctx.buffer(indices)
        return self.app.ctx.vertex_array(
            self.app.shader_program.player_model,
            [(vbo, '3f 2f', 'in_position', 'in_uv')],
            ibo
        )

    def update(self):
        super().update()
        if not self.alive:
            return
        player = self.app.player
        dx = player.position.x - self.position.x
        dy = player.position.y - self.position.y
        dz = player.position.z - self.position.z
        dist_3d = math.sqrt(dx*dx + dy*dy + dz*dz)
        dist = math.sqrt(dx*dx + dz*dz)  # horizontal dist for movement/facing

        # face player
        self.yaw = math.atan2(dz, dx)

        # walk toward player (horizontal movement only)
        if dist == 0:
            return
        if dist_3d > ZOMBIE_ATTACK_RANGE:
            self.position.x += (dx/dist) * ZOMBIE_SPEED * self.app.delta_time
            self.position.z += (dz/dist) * ZOMBIE_SPEED * self.app.delta_time
        else:
            # attack
            self.attack_timer += self.app.delta_time
            if self.attack_timer >= ZOMBIE_ATTACK_COOLDOWN:
                self.attack_timer = 0
                self.app.player_health -= ZOMBIE_ATTACK_DAMAGE
                print(f"Player health: {self.app.player_health}")

    def get_model_matrix(self):
        m = glm.mat4()
        m = glm.translate(m, self.position)
        m = glm.rotate(m, self.yaw + glm.radians(90), glm.vec3(0, 1, 0))
        return m

    def render(self):
        if not self.alive:
            return
        self.texture.use(location=4)
        self.app.shader_program.player_model['u_texture'] = 4
        self.app.shader_program.player_model['m_model'].write(self.get_model_matrix())
        self.app.shader_program.player_model['m_view'].write(self.app.player.m_view)
        self.app.shader_program.player_model['m_proj'].write(self.app.player.m_proj)
        self.vao.render()