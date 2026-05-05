import argparse
import sys

import moderngl as mgl
import pygame as pg

from settings import (
    MAJOR_VER, MINOR_VER, DEPTH_SIZE, NUM_SAMPLES, WIN_RES,
    apply_world_seed,
)
from multiplayer import MultiplayerClient, DEFAULT_PORT

class VoxelEngine:
    def __init__(self, host=None, port=DEFAULT_PORT, name='Player'):
        self.multiplayer = None
        self.multiplayer_enabled = False
        self.chat_messages = []
        self.chat_open = False
        self.chat_input = ''
        self.match_over = False
        self.match_status = ''
        self._bootstrap_multiplayer(host, port, name)

        pg.init()
        pg.display.gl_set_attribute(pg.GL_CONTEXT_MAJOR_VERSION, MAJOR_VER)
        pg.display.gl_set_attribute(pg.GL_CONTEXT_MINOR_VERSION, MINOR_VER)
        pg.display.gl_set_attribute(pg.GL_CONTEXT_PROFILE_MASK, pg.GL_CONTEXT_PROFILE_CORE)
        pg.display.gl_set_attribute(pg.GL_DEPTH_SIZE, DEPTH_SIZE)
        pg.display.gl_set_attribute(pg.GL_MULTISAMPLESAMPLES, NUM_SAMPLES)
        pg.display.set_mode(WIN_RES, flags=pg.OPENGL | pg.DOUBLEBUF)
        self.ctx = mgl.create_context()

        self.ctx.enable(flags=mgl.DEPTH_TEST | mgl.CULL_FACE | mgl.BLEND)
        self.ctx.gc_mode = 'auto'

        self.clock = pg.time.Clock()
        self.delta_time = 0
        self.time = 0

        self.WIN_W = int(WIN_RES.x)
        self.WIN_H = int(WIN_RES.y)

        pg.event.set_grab(True)
        pg.mouse.set_visible(False)

        self.is_running = True
        self.on_init()

    def _bootstrap_multiplayer(self, host, port, name):
        if not host:
            return

        self.multiplayer = MultiplayerClient(host=host, port=port, name=name)
        welcome = self.multiplayer.connect()
        apply_world_seed(welcome['seed'])
        import noise as _noise_mod
        _noise_mod.reinit_noise(welcome['seed'])
        self.multiplayer_enabled = True

    def on_init(self):
        from shader_program import ShaderProgram
        from scene import Scene
        from player import Player
        from textures import Textures
        from daylight_cycle import DaylightCycle
        from mob_manager import MobManager
        from inventory import Inventory
        from hud import HUD

        self.textures = Textures(self)
        self.player = Player(self)
        self.shader_program = ShaderProgram(self)
        self.scene = Scene(self)
        self.daylight = DaylightCycle(self)
        self.player_health = 20
        self.inventory = Inventory(self)
        self.mob_manager = MobManager(self)
        self.hud = HUD(self)

        if self.multiplayer_enabled:
            self.multiplayer.attach_app(self)

        self.player.set_spawn()

    def update(self):
        self.delta_time = self.clock.tick()
        self.time = pg.time.get_ticks() * 0.001
        self.daylight.update()
        self.player.update()
        if self.multiplayer_enabled:
            self.multiplayer.update()
        self.shader_program.update()
        self.scene.update()
        self.mob_manager.update()
        self.inventory.update()

        mode = 'LAN' if self.multiplayer_enabled else 'Solo'
        pg.display.set_caption(f'{self.clock.get_fps():.0f}  HP:{self.player_health}  {mode}')

    def add_chat_message(self, message):
        entry = {
            'name': str(message.get('name', 'System')),
            'text': str(message.get('text', '')),
            'system': bool(message.get('system', False)),
        }
        if not entry['text']:
            return
        self.chat_messages.append(entry)
        self.chat_messages = self.chat_messages[-8:]

    def set_match_over(self, payload):
        self.match_over = True
        loser_id = int(payload.get('loser_id', -1))
        winner_ids = {int(player_id) for player_id in payload.get('winner_ids', [])}
        if self.multiplayer and loser_id == self.multiplayer.player_id:
            self.match_status = 'You lost'
        elif self.multiplayer and self.multiplayer.player_id in winner_ids:
            self.match_status = 'You won'
        else:
            self.match_status = str(payload.get('message', 'Match over'))
        self.add_chat_message({
            'name': 'System',
            'text': str(payload.get('message', self.match_status)),
            'system': True,
        })

    def _open_chat(self):
        if not self.multiplayer_enabled or self.inventory.any_ui_open:
            return
        self.chat_open = True
        self.chat_input = ''
        pg.event.set_grab(False)
        pg.mouse.set_visible(True)

    def _close_chat(self):
        self.chat_open = False
        self.chat_input = ''
        if not self.inventory.any_ui_open:
            pg.event.set_grab(True)
            pg.mouse.set_visible(False)

    def _submit_chat(self):
        text = self.chat_input.strip()
        if text and self.multiplayer_enabled:
            self.multiplayer.send_chat_message(text)
        self._close_chat()

    def _handle_chat_event(self, event):
        if not self.chat_open:
            return False

        if event.type == pg.TEXTINPUT:
            self.chat_input += event.text
            self.chat_input = self.chat_input[:200]
            return True

        if event.type != pg.KEYDOWN:
            return True

        if event.key == pg.K_RETURN:
            self._submit_chat()
            return True
        if event.key == pg.K_ESCAPE:
            self._close_chat()
            return True
        if event.key == pg.K_BACKSPACE:
            self.chat_input = self.chat_input[:-1]
            return True
        return True

    def render(self):
        self.ctx.clear(color=tuple(self.daylight.sky_color))
        self.scene.render()
        self.mob_manager.render()
        self.hud.render()
        pg.display.flip()

    def handle_events(self):
        for event in pg.event.get():
            if event.type == pg.QUIT:
                self.is_running = False
                continue
            if self._handle_chat_event(event):
                continue
            if event.type == pg.KEYDOWN and event.key == pg.K_ESCAPE:
                self.is_running = False
                continue
            if event.type == pg.KEYDOWN and event.key == pg.K_t:
                self._open_chat()
                continue
            if self.match_over:
                continue
            self.player.handle_event(event=event)
            self.inventory.handle_event(event=event)

    def run(self):
        while self.is_running:
            self.handle_events()
            self.update()
            self.render()
        if self.multiplayer is not None:
            self.multiplayer.close()
        pg.quit()
        sys.exit()


def build_arg_parser():
    parser = argparse.ArgumentParser(description='Minecraft desktop client')
    parser.add_argument('--host', default=None, help='Connect to a multiplayer server at this IP/hostname')
    parser.add_argument('--port', type=int, default=DEFAULT_PORT, help='Server TCP port')
    parser.add_argument('--name', default='Player', help='Display name for multiplayer')
    return parser


if __name__ == '__main__':
    args = build_arg_parser().parse_args()
    try:
        app = VoxelEngine(host=args.host, port=args.port, name=args.name)
    except OSError as exc:
        if args.host:
            print(f'Could not connect to multiplayer server {args.host}:{args.port} ({exc})')
            sys.exit(1)
        raise
    app.run()

# Created by Joshua :)