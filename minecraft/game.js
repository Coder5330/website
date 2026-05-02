(() => {
  // ── World constants ──────────────────────────────────────────────────────
  const WX = 48, WY = 28, WZ = 48; // world dims
  const AIR=0,GRASS=1,DIRT=2,STONE=3,WOOD=4,LEAVES=5,SAND=6,PLANK=7,COBBLE=8,BEDROCK=9;

  const BLOCKS = {
    [GRASS]:  { color: 0x6ab04c, top: 0x4caf50, solid:true,  name:'Grass'  },
    [DIRT]:   { color: 0x8b5a2b, top: null,     solid:true,  name:'Dirt'   },
    [STONE]:  { color: 0x808080, top: null,     solid:true,  name:'Stone'  },
    [WOOD]:   { color: 0x6f4e2a, top: 0x9a7548, solid:true,  name:'Wood'   },
    [LEAVES]: { color: 0x3c8c3c, top: null,     solid:true,  name:'Leaves' },
    [SAND]:   { color: 0xe6d59a, top: null,     solid:true,  name:'Sand'   },
    [PLANK]:  { color: 0xc8954a, top: null,     solid:true,  name:'Plank'  },
    [COBBLE]: { color: 0x8e8e8e, top: null,     solid:true,  name:'Cobble' },
    [BEDROCK]:{ color: 0x202020, top: null,     solid:true,  name:'Bedrock'},
  };

  const HOTBAR = [GRASS,DIRT,STONE,WOOD,PLANK,COBBLE,SAND];
  const PCOLORS = [0xe74c3c,0x3498db,0x2ecc71,0xf1c40f,0x9b59b6,0x1abc9c,0xe67e22,0xe91e63];

  // ── State ────────────────────────────────────────────────────────────────
  let world = null; // Uint8Array WX*WY*WZ
  let myId='', myName='Player', myColor=0xe74c3c;
  let others = {}; // id -> { mesh, label, x, y, z, yaw, name, color }
  let channel = null, isHost = false, roomCode = '';
  let hotbarSlot = 0, running = false, worldTimeout = null;
  const player = { pos: new THREE.Vector3(0,0,0), vel: new THREE.Vector3(0,0,0), grounded: false, yaw: 0, pitch: 0 };
  const PW = 0.6, PH = 1.75, EYE = 1.55; // player half-width, height, eye height
  const GRAVITY = -28, JUMP = 8.5, WALK = 5.5, MAX_FALL = 35, REACH = 5.5;

  // ── Three.js setup ───────────────────────────────────────────────────────
  const canvas = document.getElementById('mcCanvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x88c5ff);
  scene.fog = new THREE.Fog(0x88c5ff, 28, 70);

  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 200);

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const sun = new THREE.DirectionalLight(0xffffff, 0.6);
  sun.position.set(0.6, 1, 0.4);
  scene.add(sun);

  function resize() {
    const app = document.getElementById('mcApp');
    const w = app.clientWidth, h = app.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);

  // ── World helpers ────────────────────────────────────────────────────────
  const idx = (x,y,z) => (y * WZ + z) * WX + x;
  const getB = (x,y,z) => {
    if (x<0||x>=WX||z<0||z>=WZ||y<0) return BEDROCK;
    if (y>=WY) return AIR;
    return world[idx(x,y,z)];
  };
  const setB = (x,y,z,v) => {
    if (x>=0&&x<WX&&y>=0&&y<WY&&z>=0&&z<WZ) world[idx(x,y,z)]=v;
  };
  const isSolid = (x,y,z) => {
    const b = getB(x,y,z);
    return b !== AIR && BLOCKS[b]?.solid;
  };

  // ── Mesh building (InstancedMesh per block type) ─────────────────────────
  const blockMeshes = {}; // id -> InstancedMesh
  const cubeGeo = new THREE.BoxGeometry(1, 1, 1);

  function buildMeshes() {
    for (const id of Object.keys(blockMeshes)) {
      scene.remove(blockMeshes[id]);
      blockMeshes[id].geometry?.dispose?.();
      blockMeshes[id].material?.dispose?.();
    }
    Object.keys(blockMeshes).forEach(k => delete blockMeshes[k]);

    // Count visible instances per block type
    const counts = {};
    for (let y = 0; y < WY; y++) {
      for (let z = 0; z < WZ; z++) {
        for (let x = 0; x < WX; x++) {
          const b = getB(x,y,z);
          if (b === AIR) continue;
          if (!isExposed(x,y,z)) continue;
          counts[b] = (counts[b] || 0) + 1;
        }
      }
    }

    const dummy = new THREE.Object3D();
    for (const idStr of Object.keys(counts)) {
      const id = +idStr;
      const info = BLOCKS[id];
      const mat = new THREE.MeshLambertMaterial({ color: info.color });
      const mesh = new THREE.InstancedMesh(cubeGeo, mat, counts[id]);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      let i = 0;
      for (let y = 0; y < WY; y++) for (let z = 0; z < WZ; z++) for (let x = 0; x < WX; x++) {
        if (getB(x,y,z) !== id) continue;
        if (!isExposed(x,y,z)) continue;
        dummy.position.set(x + 0.5, y + 0.5, z + 0.5);
        dummy.updateMatrix();
        mesh.setMatrixAt(i++, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      scene.add(mesh);
      blockMeshes[id] = mesh;
    }

    // Grass tops as a separate green mesh layer
    buildGrassTops();
  }

  let grassTopMesh = null;
  const flatGeo = new THREE.PlaneGeometry(1, 1);
  flatGeo.rotateX(-Math.PI / 2);
  function buildGrassTops() {
    if (grassTopMesh) {
      scene.remove(grassTopMesh);
      grassTopMesh.material.dispose();
    }
    const positions = [];
    for (let y = 0; y < WY; y++) for (let z = 0; z < WZ; z++) for (let x = 0; x < WX; x++) {
      if (getB(x,y,z) !== GRASS) continue;
      if (getB(x,y+1,z) !== AIR) continue;
      positions.push([x, y, z]);
    }
    if (positions.length === 0) { grassTopMesh = null; return; }
    const mat = new THREE.MeshLambertMaterial({ color: 0x4caf50 });
    grassTopMesh = new THREE.InstancedMesh(flatGeo, mat, positions.length);
    const dummy = new THREE.Object3D();
    positions.forEach((p, i) => {
      dummy.position.set(p[0]+0.5, p[1]+1.001, p[2]+0.5);
      dummy.updateMatrix();
      grassTopMesh.setMatrixAt(i, dummy.matrix);
    });
    grassTopMesh.instanceMatrix.needsUpdate = true;
    scene.add(grassTopMesh);
  }

  function isExposed(x,y,z) {
    return getB(x-1,y,z)===AIR || getB(x+1,y,z)===AIR ||
           getB(x,y-1,z)===AIR || getB(x,y+1,z)===AIR ||
           getB(x,y,z-1)===AIR || getB(x,y,z+1)===AIR;
  }

  // ── World generation ─────────────────────────────────────────────────────
  function noise2(x, z, freq) {
    const xi = Math.floor(x * freq), zi = Math.floor(z * freq);
    const xf = x*freq - xi, zf = z*freq - zi;
    const h = (a,b) => {
      let n = a*374761393 + b*668265263;
      n = (n ^ (n>>13)) * 1274126177 | 0;
      return ((n ^ (n>>16)) >>> 0) / 0xffffffff;
    };
    const a=h(xi,zi), b=h(xi+1,zi), c=h(xi,zi+1), d=h(xi+1,zi+1);
    const u = xf*xf*(3-2*xf), v = zf*zf*(3-2*zf);
    return (a*(1-u)+b*u)*(1-v) + (c*(1-u)+d*u)*v;
  }

  function generateWorld() {
    world = new Uint8Array(WX * WY * WZ);
    const heights = [];
    const sandPos = [];
    for (let z = 0; z < WZ; z++) {
      heights[z] = [];
      for (let x = 0; x < WX; x++) {
        let h = 6;
        h += noise2(x, z, 0.06) * 10;
        h += noise2(x, z, 0.15) * 3;
        h += noise2(x, z, 0.25) * 1.5;
        h = Math.max(2, Math.min(WY - 4, Math.floor(h)));
        heights[z][x] = h;
        for (let y = 0; y < h; y++) {
          if (y === 0) setB(x,y,z,BEDROCK);
          else if (y < h - 3) setB(x,y,z,STONE);
          else setB(x,y,z,DIRT);
        }
        const surf = h - 1;
        if (surf <= 5) { setB(x, surf, z, SAND); sandPos.push([x,surf,z]); }
        else setB(x, surf, z, GRASS);
      }
    }

    // Trees
    let s = Math.random()*999;
    const rng = () => { s=(s*9301+49297)%233280; return s/233280; };
    for (let z = 3; z < WZ-3; z++) for (let x = 3; x < WX-3; x++) {
      const h = heights[z][x];
      if (getB(x, h-1, z) !== GRASS) continue;
      if (rng() > 0.025) continue;
      const th = 4 + Math.floor(rng()*2);
      for (let dy = 0; dy < th; dy++) setB(x, h+dy, z, WOOD);
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -2; dx <= 2; dx++)
          for (let dz = -2; dz <= 2; dz++) {
            const yy = h + th - 1 + dy;
            if (Math.abs(dx)+Math.abs(dz)+Math.abs(dy) > 4) continue;
            if (getB(x+dx, yy, z+dz) === AIR) setB(x+dx, yy, z+dz, LEAVES);
          }
      setB(x, h+th, z, LEAVES);
    }
  }

  function findSpawn() {
    const cx = Math.floor(WX/2), cz = Math.floor(WZ/2);
    for (let r = 0; r < WX/2; r++) {
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        const x = cx+dx, z = cz+dz;
        if (x<0||x>=WX||z<0||z>=WZ) continue;
        for (let y = WY-2; y > 1; y--) {
          if (isSolid(x,y,z) && !isSolid(x,y+1,z) && !isSolid(x,y+2,z))
            return new THREE.Vector3(x+0.5, y+1, z+0.5);
        }
      }
    }
    return new THREE.Vector3(WX/2, WY/2, WZ/2);
  }

  // ── Physics & collision ──────────────────────────────────────────────────
  function aabbCollides(p) {
    const minX = Math.floor(p.x - PW), maxX = Math.floor(p.x + PW);
    const minY = Math.floor(p.y),       maxY = Math.floor(p.y + PH);
    const minZ = Math.floor(p.z - PW), maxZ = Math.floor(p.z + PW);
    for (let y = minY; y <= maxY; y++)
      for (let z = minZ; z <= maxZ; z++)
        for (let x = minX; x <= maxX; x++)
          if (isSolid(x,y,z)) return true;
    return false;
  }

  const inputKeys = { fwd:false, back:false, left:false, right:false, jump:false };

  function tick(dt) {
    // Movement input (relative to camera yaw)
    const ax = (inputKeys.right?1:0) - (inputKeys.left?1:0);
    const az = (inputKeys.back?1:0)  - (inputKeys.fwd?1:0);
    const sinY = Math.sin(player.yaw), cosY = Math.cos(player.yaw);
    let vx = (cosY * ax - sinY * az) * WALK;
    let vz = (sinY * ax + cosY * az) * WALK;

    // Gravity
    player.vel.y = Math.max(player.vel.y + GRAVITY * dt, -MAX_FALL);
    if (inputKeys.jump && player.grounded) {
      player.vel.y = JUMP;
      player.grounded = false;
    }

    // Move axis-by-axis with collision
    const next = player.pos.clone();
    next.x += vx * dt;
    if (aabbCollides(next)) next.x = player.pos.x;
    next.z += vz * dt;
    if (aabbCollides({x:next.x, y:next.y, z:next.z})) next.z = player.pos.z;

    next.y += player.vel.y * dt;
    if (aabbCollides(next)) {
      if (player.vel.y < 0) player.grounded = true;
      next.y = player.pos.y;
      player.vel.y = 0;
    } else {
      player.grounded = false;
    }

    player.pos.copy(next);

    // Below-world respawn
    if (player.pos.y < -10) {
      const sp = findSpawn();
      player.pos.copy(sp);
      player.vel.set(0,0,0);
    }

    // Camera
    camera.position.set(player.pos.x, player.pos.y + EYE, player.pos.z);
    camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
  }

  // ── Voxel raycast ────────────────────────────────────────────────────────
  function raycastBlock() {
    const o = camera.position.clone();
    const d = new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion).normalize();

    let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z);
    const sx = d.x > 0 ? 1 : -1, sy = d.y > 0 ? 1 : -1, sz = d.z > 0 ? 1 : -1;
    const tdx = d.x === 0 ? Infinity : Math.abs(1/d.x);
    const tdy = d.y === 0 ? Infinity : Math.abs(1/d.y);
    const tdz = d.z === 0 ? Infinity : Math.abs(1/d.z);
    let tmx = d.x === 0 ? Infinity : tdx * (sx > 0 ? 1 - (o.x - x) : (o.x - x));
    let tmy = d.y === 0 ? Infinity : tdy * (sy > 0 ? 1 - (o.y - y) : (o.y - y));
    let tmz = d.z === 0 ? Infinity : tdz * (sz > 0 ? 1 - (o.z - z) : (o.z - z));
    let face = null;
    while (true) {
      const t = Math.min(tmx, tmy, tmz);
      if (t > REACH) return null;
      if (tmx < tmy && tmx < tmz) { x += sx; tmx += tdx; face = [-sx,0,0]; }
      else if (tmy < tmz)         { y += sy; tmy += tdy; face = [0,-sy,0]; }
      else                         { z += sz; tmz += tdz; face = [0,0,-sz]; }
      if (isSolid(x,y,z)) return { x, y, z, normal: face };
    }
  }

  // ── Block interaction ────────────────────────────────────────────────────
  function breakBlock() {
    const hit = raycastBlock();
    if (!hit) return;
    if (getB(hit.x, hit.y, hit.z) === BEDROCK) return;
    setB(hit.x, hit.y, hit.z, AIR);
    bcast('block', { x: hit.x, y: hit.y, z: hit.z, v: AIR });
    buildMeshes();
  }

  function placeBlock() {
    const hit = raycastBlock();
    if (!hit) return;
    const px = hit.x + hit.normal[0];
    const py = hit.y + hit.normal[1];
    const pz = hit.z + hit.normal[2];
    if (px<0||px>=WX||py<0||py>=WY||pz<0||pz>=WZ) return;
    if (getB(px,py,pz) !== AIR) return;
    // Don't place inside player
    const cx = px + 0.5, cy = py + 0.5, cz = pz + 0.5;
    const dx = Math.abs(cx - player.pos.x);
    const dz = Math.abs(cz - player.pos.z);
    const dy1 = cy - player.pos.y, dy2 = (cy) - (player.pos.y + PH);
    if (dx < PW + 0.5 && dz < PW + 0.5 && dy1 > -1 && dy2 < 1) return;
    const blk = HOTBAR[hotbarSlot];
    setB(px, py, pz, blk);
    bcast('block', { x: px, y: py, z: pz, v: blk });
    buildMeshes();
  }

  // ── Other players (cube + name tag) ──────────────────────────────────────
  function ensureOtherPlayer(id, color, name) {
    if (others[id]?.mesh) return others[id];
    const grp = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 1.6, 0.4),
      new THREE.MeshLambertMaterial({ color })
    );
    body.position.y = 0.8;
    grp.add(body);
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.5, 0.5),
      new THREE.MeshLambertMaterial({ color: 0xffd6a8 })
    );
    head.position.y = 1.85;
    grp.add(head);
    scene.add(grp);

    const label = document.createElement('div');
    label.className = 'name-tag';
    label.textContent = name;
    document.getElementById('nameTags').appendChild(label);

    others[id] = { mesh: grp, label, x:0, y:0, z:0, yaw:0, name, color };
    return others[id];
  }

  function removeOtherPlayer(id) {
    const o = others[id]; if (!o) return;
    scene.remove(o.mesh);
    o.label?.remove();
    delete others[id];
  }

  function updateNameTags() {
    const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
    for (const o of Object.values(others)) {
      if (!o.mesh) continue;
      const pos = new THREE.Vector3(o.x, o.y + 2.4, o.z);
      const proj = pos.clone().project(camera);
      if (proj.z > 1) { o.label.style.display = 'none'; continue; }
      o.label.style.display = 'block';
      o.label.style.left = ((proj.x + 1) / 2 * w) + 'px';
      o.label.style.top  = ((-proj.y + 1) / 2 * h) + 'px';
    }
  }

  // ── Multiplayer (Supabase Realtime) ──────────────────────────────────────
  function bcast(event, payload) { if (channel) channel.send({ type:'broadcast', event, payload }); }

  // RLE encode/decode for the world (handles 32KB limit)
  function rleEncode(arr) {
    const out = [];
    let i = 0;
    while (i < arr.length) {
      let n = 1;
      while (i+n < arr.length && arr[i+n] === arr[i] && n < 255) n++;
      out.push(n, arr[i]); i += n;
    }
    return new Uint8Array(out);
  }
  function rleDecode(rle) {
    const out = [];
    for (let i = 0; i < rle.length; i += 2)
      for (let j = 0; j < rle[i]; j++) out.push(rle[i+1]);
    return new Uint8Array(out);
  }
  function bytesToB64(bytes) {
    let s = ''; for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s);
  }
  function b64ToBytes(b64) {
    const s = atob(b64); const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }

  function sendWorld() {
    if (!world) return;
    const rle = rleEncode(world);
    bcast('world', { d: bytesToB64(rle), w:WX, h:WY, dpth:WZ });
  }

  function connectRoom(code) {
    if (channel) sb.removeChannel(channel);
    channel = sb.channel('mc3d:'+code);

    channel.on('presence', { event:'sync' }, () => {
      const state = channel.presenceState();
      const all = Object.values(state).flat();
      // Update online count
      document.getElementById('onlineBadge').textContent = '👤 ' + all.length + ' online';
      // Host re-sends world to anyone present (idempotent for receiver)
      if (isHost && world) sendWorld();
    });

    channel.on('presence', { event:'leave' }, ({ leftPresences }) => {
      const arr = Array.isArray(leftPresences) ? leftPresences : Object.values(leftPresences).flat();
      arr.forEach(p => { if (p?.userId && p.userId !== myId) removeOtherPlayer(p.userId); });
    });

    channel.on('broadcast', { event:'req_world' }, () => { if (isHost && world) sendWorld(); });

    channel.on('broadcast', { event:'world' }, ({ payload }) => {
      if (world) return;
      if (worldTimeout) { clearTimeout(worldTimeout); worldTimeout = null; }
      const rle = b64ToBytes(payload.d);
      world = rleDecode(rle);
      if (world.length !== WX*WY*WZ) {
        // Pad/truncate if size mismatch (different versions)
        const buf = new Uint8Array(WX*WY*WZ);
        buf.set(world.subarray(0, Math.min(world.length, buf.length)));
        world = buf;
      }
      beginPlaying();
    });

    channel.on('broadcast', { event:'block' }, ({ payload }) => {
      setB(payload.x, payload.y, payload.z, payload.v);
      buildMeshes();
    });

    channel.on('broadcast', { event:'move' }, ({ payload }) => {
      if (payload.id === myId) return;
      const o = ensureOtherPlayer(payload.id, payload.color, payload.name);
      o.x = payload.x; o.y = payload.y; o.z = payload.z; o.yaw = payload.yaw;
      o.mesh.position.set(o.x, o.y, o.z);
      o.mesh.rotation.y = -o.yaw;
    });

    channel.subscribe(async status => {
      if (status !== 'SUBSCRIBED') return;
      await channel.track({ userId: myId, displayName: myName });
      if (!isHost) {
        bcast('req_world', {});
        setTimeout(() => bcast('req_world', {}), 1500);
        setTimeout(() => bcast('req_world', {}), 4000);
      }
    });
  }

  // ── Input (pointer lock + keys) ──────────────────────────────────────────
  let pointerLocked = false;

  canvas.addEventListener('click', () => { if (running) canvas.requestPointerLock(); });

  document.addEventListener('pointerlockchange', () => {
    pointerLocked = document.pointerLockElement === canvas;
    document.getElementById('lockHint').style.display = (running && !pointerLocked) ? 'block' : 'none';
  });

  document.addEventListener('mousemove', e => {
    if (!pointerLocked) return;
    player.yaw   -= e.movementX * 0.0025;
    player.pitch -= e.movementY * 0.0025;
    player.pitch = Math.max(-Math.PI/2 + 0.01, Math.min(Math.PI/2 - 0.01, player.pitch));
  });

  document.addEventListener('mousedown', e => {
    if (!pointerLocked) return;
    if (e.button === 0) breakBlock();
    else if (e.button === 2) placeBlock();
  });

  document.addEventListener('contextmenu', e => { if (pointerLocked) e.preventDefault(); });

  document.addEventListener('keydown', e => {
    if (!running) return;
    if (e.code === 'KeyW' || e.code === 'ArrowUp')    inputKeys.fwd   = true;
    if (e.code === 'KeyS' || e.code === 'ArrowDown')  inputKeys.back  = true;
    if (e.code === 'KeyA' || e.code === 'ArrowLeft')  inputKeys.left  = true;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') inputKeys.right = true;
    if (e.code === 'Space') { inputKeys.jump = true; e.preventDefault(); }
    const n = parseInt(e.key);
    if (n >= 1 && n <= HOTBAR.length) { hotbarSlot = n - 1; updateHotbarUI(); }
  });

  document.addEventListener('keyup', e => {
    if (e.code === 'KeyW' || e.code === 'ArrowUp')    inputKeys.fwd   = false;
    if (e.code === 'KeyS' || e.code === 'ArrowDown')  inputKeys.back  = false;
    if (e.code === 'KeyA' || e.code === 'ArrowLeft')  inputKeys.left  = false;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') inputKeys.right = false;
    if (e.code === 'Space') inputKeys.jump = false;
  });

  // Mouse wheel cycles hotbar
  canvas.addEventListener('wheel', e => {
    if (!running) return;
    e.preventDefault();
    hotbarSlot = (hotbarSlot + (e.deltaY > 0 ? 1 : -1) + HOTBAR.length) % HOTBAR.length;
    updateHotbarUI();
  }, { passive: false });

  // ── Hotbar UI ────────────────────────────────────────────────────────────
  function buildHotbarUI() {
    const el = document.getElementById('hotbar');
    el.innerHTML = '';
    HOTBAR.forEach((b, i) => {
      const slot = document.createElement('div');
      slot.className = 'slot';
      slot.dataset.idx = i;
      const swatch = document.createElement('div');
      swatch.className = 'swatch';
      const c = BLOCKS[b].color;
      swatch.style.background = '#' + c.toString(16).padStart(6,'0');
      slot.appendChild(swatch);
      const num = document.createElement('span');
      num.className = 'num';
      num.textContent = i + 1;
      slot.appendChild(num);
      el.appendChild(slot);
    });
    updateHotbarUI();
  }
  function updateHotbarUI() {
    document.querySelectorAll('#hotbar .slot').forEach((el, i) => {
      el.classList.toggle('active', i === hotbarSlot);
    });
  }

  // ── Boot game ────────────────────────────────────────────────────────────
  function beginPlaying() {
    const sp = findSpawn();
    player.pos.copy(sp);
    player.vel.set(0,0,0);
    player.yaw = 0; player.pitch = 0;
    buildMeshes();
    running = true;
    document.getElementById('lobbyPanel').style.display = 'none';
    document.getElementById('waitPanel').style.display  = 'none';
    document.getElementById('crosshair').style.display  = 'block';
    document.getElementById('hotbar').style.display     = 'flex';
    document.getElementById('hudInfo').style.display    = 'block';
    document.getElementById('roomBadge').textContent    = 'Room: ' + roomCode;
    buildHotbarUI();
    resize();
    last = performance.now();
    requestAnimationFrame(loop);
  }

  let last = 0, moveBcastTimer = 0;
  function loop(now) {
    if (!running) return;
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    tick(dt);
    moveBcastTimer += dt;
    if (moveBcastTimer > 0.05) {
      moveBcastTimer = 0;
      bcast('move', {
        id: myId, name: myName, color: myColor,
        x: +player.pos.x.toFixed(2),
        y: +player.pos.y.toFixed(2),
        z: +player.pos.z.toFixed(2),
        yaw: +player.yaw.toFixed(2),
      });
    }
    updateNameTags();
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }

  // ── Auth + lobby buttons ─────────────────────────────────────────────────
  async function getMyUser() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return false;
    myId = session.user.id;
    myName = session.user.user_metadata?.display_name || session.user.email?.split('@')[0] || 'Player';
    let h = 0; for (const c of myId) h = ((h<<5) - h + c.charCodeAt(0)) | 0;
    myColor = PCOLORS[Math.abs(h) % PCOLORS.length];
    return true;
  }

  function genCode() {
    const p='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let c=''; for (let i=0;i<4;i++) c += p[Math.floor(Math.random()*p.length)];
    return c;
  }

  document.getElementById('createBtn').addEventListener('click', async () => {
    if (!await getMyUser()) return;
    roomCode = genCode(); isHost = true;
    document.getElementById('lobbyPanel').style.display = 'none';
    resize();
    generateWorld();
    connectRoom(roomCode);
    beginPlaying();
  });

  document.getElementById('joinBtn').addEventListener('click', async () => {
    const code = document.getElementById('codeInput').value.trim().toUpperCase();
    if (code.length !== 4) { alert('Enter a 4-letter room code.'); return; }
    if (!await getMyUser()) return;
    roomCode = code; isHost = false;
    document.getElementById('lobbyPanel').style.display = 'none';
    document.getElementById('waitCode').textContent = code;
    document.getElementById('waitPanel').style.display = 'flex';
    resize();
    connectRoom(roomCode);
    worldTimeout = setTimeout(() => {
      document.getElementById('waitMsg').textContent = 'Room not found. Check the code and try again.';
    }, 12000);
  });

  document.getElementById('codeInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('joinBtn').click();
  });

  resize();
})();
