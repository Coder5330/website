from settings import *
from mob import Mob
import math, random

SPIDER_SPEED = 0.0015
SPIDER_ATTACK_RANGE = 1.8
SPIDER_ATTACK_DAMAGE = 1
SPIDER_ATTACK_COOLDOWN = 1500

class Spider(Mob):
    """Neutral mob — passive in daylight, hostile at night or when attacked.
    
    Aggro from being hit persists until dawn, then resets so spiders return
    to passive wandering during the day (matching vanilla Minecraft behaviour).
    """
    def __init__(self, app, position):
        super().__init__(app, position, health=16)
        self.yaw = random.uniform(0, math.pi * 2)
        self.attack_timer = 0
        self._aggro = False
        self._wander_timer = 0

    def take_damage(self, amount):
        super().take_damage(amount)
        self._aggro = True  # becomes hostile when hit regardless of time

    def update(self):
        super().update()
        if not self.alive:
            return

        dt = self.app.delta_time
        player = self.app.player
        is_night = self.app.daylight.is_night

        # Reset provoked aggro at dawn so spider goes passive in daylight
        if not is_night and self._aggro:
            self._aggro = False

        # Aggressive at night OR if provoked during the day
        hostile = self._aggro or is_night

        dx = player.position.x - self.position.x
        dy = player.position.y - self.position.y
        dz = player.position.z - self.position.z
        dist_3d = math.sqrt(dx*dx + dy*dy + dz*dz)
        dist = math.sqrt(dx*dx + dz*dz) or 0.001

        self.yaw = math.atan2(dz, dx)

        if hostile:
            if dist_3d > SPIDER_ATTACK_RANGE:
                self.position.x += (dx/dist) * SPIDER_SPEED * dt
                self.position.z += (dz/dist) * SPIDER_SPEED * dt
            else:
                self.attack_timer += dt
                if self.attack_timer >= SPIDER_ATTACK_COOLDOWN:
                    self.attack_timer = 0
                    self.app.player_health -= SPIDER_ATTACK_DAMAGE
        else:
            # Passive wander
            self._wander_timer += dt
            if self._wander_timer >= 3500:
                self._wander_timer = 0
                self.yaw = random.uniform(0, math.pi * 2)
            if random.random() < 0.2:
                self.position.x += math.cos(self.yaw) * SPIDER_SPEED * 0.3 * dt
                self.position.z += math.sin(self.yaw) * SPIDER_SPEED * 0.3 * dt

    def get_model_matrix(self):
        m = glm.mat4()
        m = glm.translate(m, self.position)
        m = glm.rotate(m, self.yaw + glm.radians(90), glm.vec3(0, 1, 0))
        m = glm.scale(m, glm.vec3(1.4, 0.6, 1.4))
        return m

    def render(self):
        if not self.alive:
            return
        shader = self.app.shader_program.player_model
        shader['m_model'].write(self.get_model_matrix())
        shader['m_view'].write(self.app.player.m_view)
        shader['m_proj'].write(self.app.player.m_proj)
        try:
            self.app.scene.mob_textures['zombie'].use(location=4)
            shader['u_texture'] = 4
        except Exception:
            pass
        try:
            self.vao.render()
        except Exception:
            pass