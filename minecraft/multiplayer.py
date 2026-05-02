import argparse
import json
import math
import queue
import random
import socket
import threading
import time

from settings import CHUNK_SIZE, SEED, WORLD_D, WORLD_W


DEFAULT_PORT = 5000
SERVER_DAY_LENGTH = 20 * 60
ATTACK_RANGE = 4.0
ATTACK_DAMAGE = 5
ATTACK_COOLDOWN = 0.35
CHAT_HISTORY_LIMIT = 20


def _send_json(sock, payload, send_lock=None):
    data = (json.dumps(payload, separators=(',', ':')) + '\n').encode('utf-8')
    if send_lock is None:
        sock.sendall(data)
        return
    with send_lock:
        sock.sendall(data)


def _recv_json_line(reader):
    line = reader.readline()
    if not line:
        return None
    return json.loads(line)


def _forward_vector(yaw, pitch):
    return (
        math.cos(yaw) * math.cos(pitch),
        math.sin(pitch),
        math.sin(yaw) * math.cos(pitch),
    )


def _normalize_player(player):
    position = player.get('position')
    return {
        'id': int(player['id']),
        'name': player.get('name', f"Player {player['id']}"),
        'position': tuple(position) if position is not None else None,
        'yaw': float(player.get('yaw', 0.0)),
        'pitch': float(player.get('pitch', 0.0)),
        'health': int(player.get('health', 20)),
        'alive': bool(player.get('alive', True)),
    }


class MultiplayerClient:
    def __init__(self, host, port=DEFAULT_PORT, name='Player'):
        self.host = host
        self.port = int(port)
        self.name = name or 'Player'

        self.socket = None
        self.reader = None
        self.send_lock = threading.Lock()
        self.recv_thread = None
        self.recv_queue = queue.Queue()
        self.running = False

        self.player_id = None
        self.seed = None
        self.initial_time = 0.0
        self.initial_players = []
        self.initial_block_updates = []
        self.initial_spawn_position = None
        self.initial_health = 20
        self.initial_chat_history = []
        self.initial_match_over = None

        self.remote_players = {}
        self.app = None
        self.last_state_send = 0.0
        self.state_send_interval = 0.05
        self.last_attack_send = 0.0
        self.attack_send_interval = ATTACK_COOLDOWN

    @property
    def connected(self):
        return self.socket is not None and self.running

    def connect(self, timeout=5.0):
        self.socket = socket.create_connection((self.host, self.port), timeout=timeout)
        self.socket.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
        self.reader = self.socket.makefile('r', encoding='utf-8')

        _send_json(self.socket, {'type': 'hello', 'name': self.name}, self.send_lock)

        self.socket.settimeout(timeout)
        try:
            welcome = _recv_json_line(self.reader)
        finally:
            self.socket.settimeout(None)

        if not welcome or welcome.get('type') != 'welcome':
            raise RuntimeError('Did not receive a valid multiplayer welcome packet')

        self.player_id = int(welcome['player_id'])
        self.seed = int(welcome['seed'])
        self.initial_time = float(welcome.get('time', 0.0))
        self.initial_players = [_normalize_player(player) for player in welcome.get('players', [])]
        self.initial_block_updates = list(welcome.get('block_updates', []))
        spawn = welcome.get('spawn_position')
        self.initial_spawn_position = tuple(spawn) if spawn is not None else None
        self.initial_health = int(welcome.get('health', 20))
        self.initial_chat_history = list(welcome.get('chat_history', []))
        self.initial_match_over = welcome.get('match_over')
        return welcome

    def attach_app(self, app):
        self.app = app
        self.remote_players = {
            player['id']: player
            for player in self.initial_players
            if player['id'] != self.player_id
        }
        self.app.daylight.time = self.initial_time
        self.app.player_health = self.initial_health
        if self.initial_spawn_position is not None:
            self.app.player.position.x = float(self.initial_spawn_position[0])
            self.app.player.position.z = float(self.initial_spawn_position[1])
        self.app.chat_messages = list(self.initial_chat_history)

        for update in self.initial_block_updates:
            pos = tuple(update['position'])
            voxel_id = int(update['voxel_id'])
            self.app.scene.world.voxel_handler.apply_block_update(pos, voxel_id)

        if self.initial_match_over:
            self.app.set_match_over(self.initial_match_over)

        self.running = True
        self.recv_thread = threading.Thread(target=self._recv_loop, daemon=True)
        self.recv_thread.start()
        self.send_player_state(force=True)

    def close(self):
        self.running = False
        if self.socket is not None:
            try:
                self.socket.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass
            try:
                self.socket.close()
            except OSError:
                pass
        self.socket = None

    def _recv_loop(self):
        try:
            while self.running:
                message = _recv_json_line(self.reader)
                if message is None:
                    break
                self.recv_queue.put(message)
        except (OSError, json.JSONDecodeError):
            pass
        finally:
            self.running = False
            self.recv_queue.put({'type': 'disconnected'})

    def update(self):
        while True:
            try:
                message = self.recv_queue.get_nowait()
            except queue.Empty:
                break
            self._handle_message(message)

        self.send_player_state()

    def _handle_message(self, message):
        message_type = message.get('type')
        if message_type == 'player_joined':
            player = _normalize_player(message['player'])
            if player['id'] != self.player_id:
                self.remote_players[player['id']] = player
                self.app.add_chat_message({
                    'name': 'System',
                    'text': f"{player['name']} joined the arena.",
                    'system': True,
                })
            return

        if message_type == 'player_left':
            player_id = int(message['player_id'])
            left = self.remote_players.pop(player_id, None)
            if left:
                self.app.add_chat_message({
                    'name': 'System',
                    'text': f"{left['name']} left the arena.",
                    'system': True,
                })
            return

        if message_type == 'player_state':
            player = _normalize_player(message['player'])
            if player['id'] == self.player_id:
                self.app.player_health = player['health']
            else:
                self.remote_players[player['id']] = player
            return

        if message_type == 'block_update' and self.app is not None:
            pos = tuple(message['position'])
            voxel_id = int(message['voxel_id'])
            self.app.scene.world.voxel_handler.apply_block_update(pos, voxel_id)
            return

        if message_type == 'time_sync' and self.app is not None:
            self.app.daylight.time = float(message['time']) % 1.0
            return

        if message_type == 'chat_message' and self.app is not None:
            self.app.add_chat_message(message)
            return

        if message_type == 'match_over' and self.app is not None:
            self.app.set_match_over(message)
            return

        if message_type == 'disconnected':
            self.running = False
            if self.app is not None:
                self.app.add_chat_message({
                    'name': 'System',
                    'text': 'Disconnected from server.',
                    'system': True,
                })

    def send_player_state(self, force=False):
        if not self.connected or self.app is None:
            return

        now = time.monotonic()
        if not force and now - self.last_state_send < self.state_send_interval:
            return

        player = self.app.player
        payload = {
            'type': 'player_state',
            'position': [float(player.position.x), float(player.position.y), float(player.position.z)],
            'yaw': float(player.yaw),
            'pitch': float(player.pitch),
        }
        try:
            _send_json(self.socket, payload, self.send_lock)
            self.last_state_send = now
        except OSError:
            self.running = False

    def send_block_update(self, world_pos, voxel_id):
        if not self.connected:
            return
        payload = {
            'type': 'block_update',
            'position': [int(world_pos[0]), int(world_pos[1]), int(world_pos[2])],
            'voxel_id': int(voxel_id),
        }
        try:
            _send_json(self.socket, payload, self.send_lock)
        except OSError:
            self.running = False

    def send_chat_message(self, text):
        if not self.connected:
            return
        text = str(text).strip()
        if not text:
            return
        try:
            _send_json(self.socket, {
                'type': 'chat_message',
                'text': text[:200],
            }, self.send_lock)
        except OSError:
            self.running = False

    def send_attack_player(self, target_id):
        if not self.connected:
            return False
        now = time.monotonic()
        if now - self.last_attack_send < self.attack_send_interval:
            return False
        try:
            _send_json(self.socket, {
                'type': 'attack_player',
                'target_id': int(target_id),
            }, self.send_lock)
            self.last_attack_send = now
            return True
        except OSError:
            self.running = False
            return False

    def find_attack_target(self):
        if not self.connected or self.app is None or self.app.match_over:
            return None

        player = self.app.player
        best_id = None
        best_dot = 0.5
        best_dist = ATTACK_RANGE

        for remote in self.remote_players.values():
            if not remote.get('alive', True):
                continue
            position = remote.get('position')
            if position is None:
                continue

            dx = position[0] - player.position.x
            dy = (position[1] + 0.9) - (player.position.y + 1.0)
            dz = position[2] - player.position.z
            dist = math.sqrt(dx * dx + dy * dy + dz * dz)
            if dist > best_dist or dist < 1e-6:
                continue

            inv_dist = 1.0 / dist
            dot = (
                player.forward.x * dx * inv_dist +
                player.forward.y * dy * inv_dist +
                player.forward.z * dz * inv_dist
            )
            if dot > best_dot:
                best_dot = dot
                best_dist = dist
                best_id = remote['id']

        return best_id

    def try_attack_player(self):
        target_id = self.find_attack_target()
        if target_id is None:
            return False
        return self.send_attack_player(target_id)


class _ClientSession:
    def __init__(self, player_id, sock, reader, name):
        self.player_id = player_id
        self.socket = sock
        self.reader = reader
        self.name = name
        self.send_lock = threading.Lock()
        self.last_attack_time = 0.0


class MultiplayerServer:
    def __init__(self, host='0.0.0.0', port=DEFAULT_PORT, seed=None):
        self.host = host
        self.port = int(port)
        self.seed = int(SEED if seed is None else seed)
        self.started_at = time.monotonic()

        self.server_socket = None
        self.running = False
        self.lock = threading.Lock()
        self.next_player_id = 1
        self.clients = {}
        self.players = {}
        self.block_updates = {}
        self.chat_history = []
        self.match_over = False

        self.rng = random.Random(self.seed)
        self.spawn_anchor = self._make_spawn_anchor()

    def _make_spawn_anchor(self):
        margin = CHUNK_SIZE * 3
        max_x = WORLD_W * CHUNK_SIZE - margin - 1
        max_z = WORLD_D * CHUNK_SIZE - margin - 1
        return (
            self.rng.randint(margin, max_x),
            self.rng.randint(margin, max_z),
        )

    def _assign_spawn_position(self):
        limit = CHUNK_SIZE * 2
        min_x = 2
        min_z = 2
        max_x = WORLD_W * CHUNK_SIZE - 3
        max_z = WORLD_D * CHUNK_SIZE - 3
        existing = [tuple(player['spawn_position']) for player in self.players.values()]

        for _ in range(100):
            x = max(min_x, min(max_x, self.spawn_anchor[0] + self.rng.randint(-limit, limit)))
            z = max(min_z, min(max_z, self.spawn_anchor[1] + self.rng.randint(-limit, limit)))
            if all((x - ex) ** 2 + (z - ez) ** 2 >= 8 ** 2 for ex, ez in existing):
                return [x, z]
        return [self.spawn_anchor[0], self.spawn_anchor[1]]

    def _build_player_record(self, player_id, name):
        spawn_position = self._assign_spawn_position()
        return {
            'id': player_id,
            'name': name,
            'position': None,
            'yaw': 0.0,
            'pitch': 0.0,
            'health': 20,
            'alive': True,
            'spawn_position': spawn_position,
        }

    def _current_time(self):
        elapsed = time.monotonic() - self.started_at
        return (elapsed / SERVER_DAY_LENGTH) % 1.0

    def _match_payload(self, loser_id):
        loser = self.players.get(loser_id, {'name': 'Unknown'})
        winner_ids = [
            player_id for player_id, player in self.players.items()
            if player_id != loser_id and player.get('alive', True)
        ]
        return {
            'type': 'match_over',
            'loser_id': loser_id,
            'loser_name': loser.get('name', 'Unknown'),
            'winner_ids': winner_ids,
            'message': f"{loser.get('name', 'Unknown')} lost the match.",
        }

    def serve_forever(self):
        self.server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.server_socket.bind((self.host, self.port))
        self.server_socket.listen()
        self.running = True

        print(f'Multiplayer server listening on {self.host}:{self.port} with seed {self.seed}')

        threading.Thread(target=self._time_sync_loop, daemon=True).start()

        try:
            while self.running:
                client_sock, _ = self.server_socket.accept()
                client_sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
                threading.Thread(
                    target=self._handle_client,
                    args=(client_sock,),
                    daemon=True,
                ).start()
        except KeyboardInterrupt:
            print('\nServer shutting down.')
        finally:
            self.running = False
            try:
                self.server_socket.close()
            except OSError:
                pass

    def _time_sync_loop(self):
        while self.running:
            time.sleep(2.0)
            self.broadcast({'type': 'time_sync', 'time': self._current_time()})

    def _handle_client(self, client_sock):
        reader = client_sock.makefile('r', encoding='utf-8')
        session = None
        try:
            hello = _recv_json_line(reader)
            if not hello or hello.get('type') != 'hello':
                return

            with self.lock:
                player_id = self.next_player_id
                self.next_player_id += 1
                name = str(hello.get('name') or f'Player {player_id}')
                session = _ClientSession(player_id, client_sock, reader, name)
                existing_players = [dict(player) for player in self.players.values()]
                block_updates = [
                    {'position': list(pos), 'voxel_id': voxel_id}
                    for pos, voxel_id in self.block_updates.items()
                ]
                player = self._build_player_record(player_id, name)
                self.clients[player_id] = session
                self.players[player_id] = player
                chat_history = list(self.chat_history)
                match_over = self._match_payload(next(
                    (pid for pid, record in self.players.items() if not record.get('alive', True)),
                    player_id,
                )) if self.match_over else None

            _send_json(client_sock, {
                'type': 'welcome',
                'player_id': player_id,
                'seed': self.seed,
                'time': self._current_time(),
                'players': existing_players,
                'block_updates': block_updates,
                'spawn_position': player['spawn_position'],
                'health': player['health'],
                'chat_history': chat_history,
                'match_over': match_over,
            }, session.send_lock)

            self.broadcast({
                'type': 'player_joined',
                'player': self.players[player_id],
            }, exclude=player_id)

            while self.running:
                message = _recv_json_line(reader)
                if message is None:
                    break
                self._handle_client_message(player_id, message)
        except (OSError, json.JSONDecodeError):
            pass
        finally:
            if session is not None:
                self._disconnect_player(session.player_id)
            try:
                client_sock.close()
            except OSError:
                pass

    def _broadcast_player_state(self, player_id, exclude=None):
        player = self.players.get(player_id)
        if not player:
            return
        self.broadcast({'type': 'player_state', 'player': player}, exclude=exclude)

    def _record_chat(self, entry):
        with self.lock:
            self.chat_history.append(entry)
            self.chat_history = self.chat_history[-CHAT_HISTORY_LIMIT:]
        self.broadcast(entry)

    def _handle_attack(self, attacker_id, target_id):
        with self.lock:
            if self.match_over:
                return
            attacker = self.players.get(attacker_id)
            target = self.players.get(target_id)
            session = self.clients.get(attacker_id)
            if not attacker or not target or not session:
                return
            if not attacker.get('alive', True) or not target.get('alive', True):
                return
            if attacker.get('position') is None or target.get('position') is None:
                return

            now = time.monotonic()
            if now - session.last_attack_time < ATTACK_COOLDOWN:
                return
            session.last_attack_time = now

            ax, ay, az = attacker['position']
            tx, ty, tz = target['position']
            dx = tx - ax
            dy = (ty + 0.9) - (ay + 1.0)
            dz = tz - az
            dist_sq = dx * dx + dy * dy + dz * dz
            if dist_sq > ATTACK_RANGE * ATTACK_RANGE or dist_sq < 1e-6:
                return

            dist = math.sqrt(dist_sq)
            fx, fy, fz = _forward_vector(attacker['yaw'], attacker['pitch'])
            dot = (fx * dx + fy * dy + fz * dz) / dist
            if dot < 0.45:
                return

            target['health'] = max(0, int(target.get('health', 20)) - ATTACK_DAMAGE)
            if target['health'] == 0:
                target['alive'] = False
                self.match_over = True

            payload = dict(target)
            match_payload = self._match_payload(target_id) if self.match_over else None

        self.broadcast({'type': 'player_state', 'player': payload})
        if match_payload:
            self._record_chat({
                'type': 'chat_message',
                'name': 'System',
                'text': match_payload['message'],
                'system': True,
            })
            self.broadcast(match_payload)

    def _handle_client_message(self, player_id, message):
        message_type = message.get('type')

        if message_type == 'player_state':
            position = message.get('position')
            if position is None or len(position) != 3:
                return
            with self.lock:
                player = self.players.get(player_id)
                if not player:
                    return
                player['position'] = [float(position[0]), float(position[1]), float(position[2])]
                player['yaw'] = float(message.get('yaw', 0.0))
                player['pitch'] = float(message.get('pitch', 0.0))
                payload = dict(player)
            self.broadcast({'type': 'player_state', 'player': payload}, exclude=player_id)
            return

        if message_type == 'block_update':
            position = message.get('position')
            if position is None or len(position) != 3:
                return
            pos_key = (int(position[0]), int(position[1]), int(position[2]))
            voxel_id = int(message.get('voxel_id', 0))
            with self.lock:
                self.block_updates[pos_key] = voxel_id
            self.broadcast({
                'type': 'block_update',
                'position': list(pos_key),
                'voxel_id': voxel_id,
            }, exclude=player_id)
            return

        if message_type == 'attack_player':
            self._handle_attack(player_id, int(message.get('target_id', -1)))
            return

        if message_type == 'chat_message':
            with self.lock:
                player = self.players.get(player_id)
                if not player:
                    return
                text = str(message.get('text', '')).strip()[:200]
                if not text:
                    return
                entry = {
                    'type': 'chat_message',
                    'player_id': player_id,
                    'name': player['name'],
                    'text': text,
                    'system': False,
                }
            self._record_chat(entry)

    def _disconnect_player(self, player_id):
        with self.lock:
            session = self.clients.pop(player_id, None)
            self.players.pop(player_id, None)
            reset_round = not self.players
            if reset_round:
                self.match_over = False
                self.chat_history = []
                self.spawn_anchor = self._make_spawn_anchor()
                self.started_at = time.monotonic()
        if session is None:
            return
        self.broadcast({'type': 'player_left', 'player_id': player_id})
        try:
            session.socket.close()
        except OSError:
            pass

    def broadcast(self, payload, exclude=None):
        with self.lock:
            sessions = [
                session for player_id, session in self.clients.items()
                if player_id != exclude
            ]
        stale_ids = []
        for session in sessions:
            try:
                _send_json(session.socket, payload, session.send_lock)
            except OSError:
                stale_ids.append(session.player_id)
        for player_id in stale_ids:
            self._disconnect_player(player_id)


def build_server_arg_parser():
    parser = argparse.ArgumentParser(description='Minecraft LAN multiplayer server')
    parser.add_argument('--host', default='0.0.0.0', help='Host/IP to bind to')
    parser.add_argument('--port', type=int, default=DEFAULT_PORT, help='TCP port to listen on')
    parser.add_argument('--seed', type=int, default=None, help='Optional world seed override')
    return parser
