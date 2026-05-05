from settings import *
import pygame as pg

class PlayerModel:
    def __init__(self, app):
        self.app = app
        self.ctx = app.ctx
        self.shader = app.shader_program.player_model
        self.texture = self.load_texture()
        self.vao = self.get_vao()

    def load_texture(self):
        img = pg.image.load('assets/steve.png').convert_alpha()
        w, h = img.get_size()
        data = pg.image.tostring(img, 'RGBA', False)
        tex = self.ctx.texture((w, h), 4, data)
        tex.filter = (self.ctx.NEAREST, self.ctx.NEAREST)
        return tex

    def uv(self, px, py, pw, ph, W=64, H=64):
        u0 = px / W
        u1 = (px + pw) / W
        v0 = py / H
        v1 = (py + ph) / H
        # bl, br, tr, tl
        return [u0, v1,  u1, v1,  u1, v0,  u0, v0]

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
        # front (z1)
        verts += self.make_face([x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1], front)
        # back (z0)
        verts += self.make_face([x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0], back)
        # left (x0)
        verts += self.make_face([x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0], left)
        # right (x1)
        verts += self.make_face([x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1], right)
        # top (y1)
        verts += self.make_face([x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0], top)
        # bottom (y0)
        verts += self.make_face([x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1], bottom)
        return verts

    def get_vao(self):
        W, H = 600, 300
        u = self.uv  # uv(px, py, pw, ph, W, H)

        # HEAD
        head_top    = u( 75,   0,  75,  75, W, H)
        head_bottom = u(150,   0,  75,  75, W, H)
        head_right  = u(  0,  75,  75,  75, W, H)
        head_front  = u( 75,  75,  75,  75, W, H)
        head_left   = u(150,  75,  75,  75, W, H)
        head_back   = u(225,  75,  75,  75, W, H)

        # TORSO
        torso_top    = u(188, 150,  75,  38, W, H)
        torso_bottom = u(263, 150,  75,  38, W, H)
        torso_right  = u(150, 188,  38, 112, W, H)
        torso_front  = u(188, 188,  75, 112, W, H)
        torso_left   = u(263, 188,  38, 112, W, H)
        torso_back   = u(300, 188,  75, 112, W, H)

        # RIGHT ARM
        rarm_top    = u(412, 150,  38,  38, W, H)
        rarm_bottom = u(450, 150,  38,  38, W, H)
        rarm_right  = u(375, 188,  38, 112, W, H)
        rarm_front  = u(412, 188,  38, 112, W, H)
        rarm_left   = u(450, 188,  38, 112, W, H)
        rarm_back   = u(488, 188,  38, 112, W, H)

        # LEFT ARM (mirror right arm)
        larm_top    = u(412, 150,  38,  38, W, H)
        larm_bottom = u(450, 150,  38,  38, W, H)
        larm_right  = u(450, 188,  38, 112, W, H)
        larm_front  = u(412, 188,  38, 112, W, H)
        larm_left   = u(375, 188,  38, 112, W, H)
        larm_back   = u(488, 188,  38, 112, W, H)

        # RIGHT LEG
        rleg_top    = u( 38, 150,  38,  38, W, H)
        rleg_bottom = u( 75, 150,  38,  38, W, H)
        rleg_right  = u(  0, 188,  38, 112, W, H)
        rleg_front  = u( 38, 188,  38, 112, W, H)
        rleg_left   = u( 75, 188,  38, 112, W, H)
        rleg_back   = u(112, 188,  38, 112, W, H)

        # LEFT LEG (mirror right leg)
        lleg_top    = u( 38, 150,  38,  38, W, H)
        lleg_bottom = u( 75, 150,  38,  38, W, H)
        lleg_right  = u( 75, 188,  38, 112, W, H)
        lleg_front  = u( 38, 188,  38, 112, W, H)
        lleg_left   = u(  0, 188,  38, 112, W, H)
        lleg_back   = u(112, 188,  38, 112, W, H)

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

        vbo = self.ctx.buffer(verts)
        ibo = self.ctx.buffer(indices)
        return self.ctx.vertex_array(
            self.shader,
            [(vbo, '3f 2f', 'in_position', 'in_uv')],
            ibo
        )

    def get_model_matrix(self, position, yaw):
        m = glm.mat4()
        m = glm.translate(m, glm.vec3(position) - glm.vec3(0, 0.2, 0))
        m = glm.rotate(m, -yaw + glm.radians(90), glm.vec3(0, 1, 0))
        return m

    def _render_one(self, position, yaw):
        self.texture.use(location=4)
        self.shader['u_texture'] = 4
        self.shader['m_model'].write(self.get_model_matrix(position, yaw))
        self.shader['m_view'].write(self.app.player.m_view)
        self.shader['m_proj'].write(self.app.player.m_proj)
        self.vao.render()

    def render(self):
        if self.app.player.third_person:
            self._render_one(self.app.player.position, self.app.player.yaw)

        multiplayer = getattr(self.app, 'multiplayer', None)
        if not multiplayer:
            return

        for remote in multiplayer.remote_players.values():
            if remote.get('position') is None or not remote.get('alive', True):
                continue
            self._render_one(remote['position'], remote.get('yaw', 0.0))
