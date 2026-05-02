from settings import *
import math

DAY_LENGTH = 20 * 60
DAY_BRIGHT_DURATION = 10 * 60
SUNSET_DURATION = 90
NIGHT_DURATION = 7 * 60
DAWN_DURATION = 90

DAY_LIGHT_LEVEL = 1.08
NIGHT_LIGHT_LEVEL = 0.18

DAY_COLOR = glm.vec3(0.64, 0.86, 1.00)
SUNSET_COLOR = glm.vec3(0.97, 0.56, 0.24)
NIGHT_COLOR = glm.vec3(0.03, 0.05, 0.11)
DAWN_COLOR = glm.vec3(1.00, 0.69, 0.34)


def _smoothstep(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3.0 - 2.0 * t)


def _lerp(a, b, t):
    return a + (b - a) * t


class DaylightCycle:
    def __init__(self, app):
        self.app = app
        # Start at the beginning of the bright daytime window.
        self.time = 0.0
        self.is_night = False

    def _elapsed_seconds(self):
        return self.time * DAY_LENGTH

    def _phase(self):
        elapsed = self._elapsed_seconds()
        if elapsed < DAY_BRIGHT_DURATION:
            return 'day', elapsed / DAY_BRIGHT_DURATION

        elapsed -= DAY_BRIGHT_DURATION
        if elapsed < SUNSET_DURATION:
            return 'sunset', elapsed / SUNSET_DURATION

        elapsed -= SUNSET_DURATION
        if elapsed < NIGHT_DURATION:
            return 'night', elapsed / NIGHT_DURATION

        elapsed -= NIGHT_DURATION
        return 'dawn', elapsed / DAWN_DURATION

    def update(self):
        self.time = (self.time + self.app.delta_time / 1000 / DAY_LENGTH) % 1.0
        phase, _ = self._phase()
        self.is_night = phase == 'night'

    @property
    def sun_angle(self):
        return self.time * math.tau

    @property
    def light_level(self):
        phase, progress = self._phase()
        blend = _smoothstep(progress)

        if phase == 'day':
            return DAY_LIGHT_LEVEL
        if phase == 'sunset':
            return _lerp(DAY_LIGHT_LEVEL, NIGHT_LIGHT_LEVEL, blend)
        if phase == 'night':
            return NIGHT_LIGHT_LEVEL
        return _lerp(NIGHT_LIGHT_LEVEL, DAY_LIGHT_LEVEL, blend)

    @property
    def sky_color(self):
        phase, progress = self._phase()
        blend = _smoothstep(progress)

        if phase == 'day':
            return DAY_COLOR
        if phase == 'sunset':
            if blend < 0.5:
                return glm.mix(DAY_COLOR, SUNSET_COLOR, blend * 2.0)
            return glm.mix(SUNSET_COLOR, NIGHT_COLOR, (blend - 0.5) * 2.0)
        if phase == 'night':
            return NIGHT_COLOR
        if blend < 0.5:
            return glm.mix(NIGHT_COLOR, DAWN_COLOR, blend * 2.0)
        return glm.mix(DAWN_COLOR, DAY_COLOR, (blend - 0.5) * 2.0)
