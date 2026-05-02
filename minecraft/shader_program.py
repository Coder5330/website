from settings import *

class ShaderProgram:
    def __init__(self, app):
        self.app = app
        self.ctx = app.ctx
        self.player = app.player
        self.chunk = self.get_program(shader_name='chunk')
        self.voxel_marker = self.get_program(shader_name='voxel_marker')
        self.water = self.get_program('water')
        self.clouds = self.get_program('clouds')
        self.player_model = self.get_program('player_model')
        self.set_uniforms_on_init()

    def set_uniforms_on_init(self):
        # chunk
        self.chunk['m_proj'].write(self.player.m_proj)
        self.chunk['m_model'].write(glm.mat4())
        self.chunk['u_texture_array_0'] = 1
        self.chunk['u_texture_1'] = 2
        self.chunk['u_texture_array_1'] = 4
        self.chunk['u_crack_array'] = 3
        self.chunk['u_crafting_table'] = 6
        self.chunk['bg_color'].write(BG_COLOR)
        self.chunk['water_line'] = WATER_LINE
        self.chunk['crack_stage'] = -1         # ADD
        self.chunk['crack_voxel_pos'].write(glm.vec3(0))  # ADD
        # marker
        self.voxel_marker['m_proj'].write(self.player.m_proj)
        self.voxel_marker['m_model'].write(glm.mat4())
        self.voxel_marker['u_texture_0'] = 0
        self.voxel_marker['tint_color'].write(glm.vec3(1, 0, 0))
        # water
        self.water['m_proj'].write(self.player.m_proj)
        self.water['u_texture_0'] = 2
        self.water['water_area'] = WATER_AREA
        self.water['water_line'] = WATER_LINE
        self.water['time'] = 0.0
        # clouds
        self.clouds['m_proj'].write(self.player.m_proj)
        self.clouds['center'] = CENTER_XZ
        self.clouds['bg_color'].write(BG_COLOR)
        self.clouds['cloud_scale'] = CLOUD_SCALE
        self.chunk['light_level'] = 1.0
        self.chunk['time'] = 0.0

    def update(self):
        self.chunk['m_view'].write(self.player.m_view)
        self.voxel_marker['m_view'].write(self.player.m_view)
        self.water['m_view'].write(self.player.m_view)
        self.clouds['m_view'].write(self.player.m_view)
        self.water['time'] = self.app.time
        self.chunk['time'] = self.app.time
        # daylight
        daylight = self.app.daylight
        self.chunk['bg_color'].write(daylight.sky_color)
        self.chunk['light_level'] = daylight.light_level
        # crack uniforms
        vh = self.app.scene.world.voxel_handler
        stage, pos = vh.get_break_progress()
        self.chunk['crack_stage'] = stage
        if pos is not None:
            self.chunk['crack_voxel_pos'].write(glm.vec3(pos))
        else:
            self.chunk['crack_voxel_pos'].write(glm.vec3(0))
        
    def get_program(self, shader_name):
        with open(f'shaders/{shader_name}.vert') as f:
            vert = f.read()
        with open(f'shaders/{shader_name}.frag') as f:
            frag = f.read()
        return self.ctx.program(vertex_shader=vert, fragment_shader=frag)