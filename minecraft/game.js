(() => {
  // ── Block IDs (match settings.py) ────────────────────────────────────────
  const AIR=0, SAND=1, GRASS=2, DIRT=3, STONE=4, SNOW=5, LEAVES=6, WOOD=7;
  const BEDROCK = 9; // bedrock is rendered as STONE (no extra atlas slot needed)
  const ALL_BLOCKS = [SAND, GRASS, DIRT, STONE, SNOW, LEAVES, WOOD];
  const HOTBAR = [GRASS, DIRT, STONE, SAND, WOOD, LEAVES, SNOW];
  const SOLID = new Set([SAND,GRASS,DIRT,STONE,SNOW,LEAVES,WOOD,BEDROCK]);

  // World dims
  const WX=64, WY=32, WZ=64;
  const ATLAS_LAYERS = 8; // tex_array_0.png has 8 layers (8x128 = 1024 tall)

  // ── Physics (Minecraft-ish: jump ~1.1 blocks high, walk ~4.3 m/s) ───────
  const WALK = 4.5;       // m/s
  const SPRINT = 6.5;     // m/s
  const JUMP_VEL = 8.2;   // m/s initial upward
  const GRAVITY = -28;    // m/s²
  const MAX_FALL = 60;    // m/s
  const PW = 0.3;         // half-width (radius for collision)
  const PH = 1.8;         // total height
  const EYE = 1.6;        // eye height from feet
  const REACH = 5.5;

  // Hand-mining times (seconds), straight from voxel_handler.py BLOCK_DATA
  const BREAK_TIME = {
    [SAND]: 0.75, [GRASS]: 0.9, [DIRT]: 0.75, [STONE]: 7.5,
    [SNOW]: 0.5,  [LEAVES]: 0.3, [WOOD]: 3.0, [BEDROCK]: Infinity,
  };

  // ── State ────────────────────────────────────────────────────────────────
  let world = null; // Uint8Array WX*WY*WZ
  let myId='', myName='Player', myColor=0xe74c3c;
  let others = {};
  let channel=null, isHost=false, roomCode='', worldTimeout=null;
  let hotbarSlot=0, running=false, worldDirty=false;
  const player = {
    pos: new THREE.Vector3(0, 0, 0),
    vy: 0, grounded: false, yaw: 0, pitch: 0,
  };
  const inputKeys = { fwd:false, back:false, left:false, right:false, jump:false, sprint:false };

  // ── Three.js ─────────────────────────────────────────────────────────────
  const canvas = document.getElementById('mcCanvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x88c5ff);
  scene.fog = new THREE.Fog(0x88c5ff, 40, 100);

  const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 300);

  scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x6b4f31, 0.85));
  const sun = new THREE.DirectionalLight(0xffffff, 0.55);
  sun.position.set(40, 80, 30);
  scene.add(sun);

  function resize() {
    const app = document.getElementById('mcApp');
    const w = app.clientWidth, h = app.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);

  // ── Load atlas texture ───────────────────────────────────────────────────
  const atlasTex = new THREE.TextureLoader().load('assets/tex_array_0.png');
  atlasTex.magFilter = THREE.NearestFilter;
  atlasTex.minFilter = THREE.NearestFilter;
  atlasTex.generateMipmaps = false;
  atlasTex.colorSpace = THREE.SRGBColorSpace;
  // flipY default true: image's top row → V=1

  // Atlas layout (file): 8 layers stacked vertically; layer 0 is empty (AIR=0).
  // Block id N lives at file Y = N*128 .. (N+1)*128.
  // Within each strip, file order (left→right) is: BOTTOM | SIDE | TOP.
  // (Python applies flip_x at load; we use the raw file, so we DON'T mirror.)
  // With default flipY=true, file Y maps to V: vMax = (8-id)/8, vMin = (7-id)/8.
  function makeBlockGeo(id) {
    const g = new THREE.BoxGeometry(1, 1, 1);
    const uvs = g.attributes.uv.array;
    const vMax = (ATLAS_LAYERS - id) / ATLAS_LAYERS;
    const vMin = vMax - 1 / ATLAS_LAYERS;
    // BoxGeometry face order: +X, -X, +Y, -Y, +Z, -Z
    const uRanges = [
      [1/3, 2/3], // +X side
      [1/3, 2/3], // -X side
      [2/3, 1  ], // +Y top    → right tile
      [0,   1/3], // -Y bottom → left tile
      [1/3, 2/3], // +Z side
      [1/3, 2/3], // -Z side
    ];
    for (let face = 0; face < 6; face++) {
      const [uMin, uMax] = uRanges[face];
      for (let v = 0; v < 4; v++) {
        const i = (face * 4 + v) * 2;
        uvs[i]   = uMin + uvs[i]   * (uMax - uMin);
        uvs[i+1] = vMin + uvs[i+1] * (vMax - vMin);
      }
    }
    g.attributes.uv.needsUpdate = true;
    return g;
  }

  const blockGeos = {};
  const blockMaterial = new THREE.MeshLambertMaterial({ map: atlasTex });
  for (const id of ALL_BLOCKS) blockGeos[id] = makeBlockGeo(id);
  blockGeos[BEDROCK] = blockGeos[STONE];

  // ── Crack textures (10 stages: crack_0..crack_9.png) ─────────────────────
  const crackTextures = [];
  for (let i = 0; i < 10; i++) {
    const t = new THREE.TextureLoader().load(`assets/crack_${i}.png`);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    crackTextures.push(t);
  }
  const crackMat = new THREE.MeshBasicMaterial({
    transparent: true, opacity: 0.95, depthWrite: false, polygonOffset: true,
    polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const crackMesh = new THREE.Mesh(new THREE.BoxGeometry(1.001, 1.001, 1.001), crackMat);
  crackMesh.visible = false;
  crackMesh.frustumCulled = false;
  scene.add(crackMesh);

  // ── Block selection wireframe (looks like Minecraft's outline) ───────────
  const selectGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002));
  const selectMat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55 });
  const selectMesh = new THREE.LineSegments(selectGeo, selectMat);
  selectMesh.visible = false;
  selectMesh.frustumCulled = false;
  scene.add(selectMesh);

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
  const isSolidAt = (x,y,z) => SOLID.has(getB(x,y,z));
  const isExposed = (x,y,z) => !SOLID.has(getB(x-1,y,z)) || !SOLID.has(getB(x+1,y,z))
    || !SOLID.has(getB(x,y-1,z)) || !SOLID.has(getB(x,y+1,z))
    || !SOLID.has(getB(x,y,z-1)) || !SOLID.has(getB(x,y,z+1));

  // ── Mesh building ────────────────────────────────────────────────────────
  const meshes = {}; // id -> InstancedMesh
  function buildMeshes() {
    for (const id of Object.keys(meshes)) {
      scene.remove(meshes[id]);
      meshes[id].dispose();
      delete meshes[id];
    }
    const counts = {};
    for (let y=0; y<WY; y++) for (let z=0; z<WZ; z++) for (let x=0; x<WX; x++) {
      const b = getB(x,y,z);
      if (b === AIR || !SOLID.has(b)) continue;
      if (!isExposed(x,y,z)) continue;
      counts[b] = (counts[b]||0) + 1;
    }
    const dummy = new THREE.Object3D();
    for (const idStr of Object.keys(counts)) {
      const id = +idStr;
      const geo = blockGeos[id] || blockGeos[STONE];
      const mesh = new THREE.InstancedMesh(geo, blockMaterial, counts[id]);
      let i = 0;
      for (let y=0; y<WY; y++) for (let z=0; z<WZ; z++) for (let x=0; x<WX; x++) {
        if (getB(x,y,z) !== id) continue;
        if (!isExposed(x,y,z)) continue;
        dummy.position.set(x + 0.5, y + 0.5, z + 0.5);
        dummy.updateMatrix();
        mesh.setMatrixAt(i++, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.frustumCulled = false;
      scene.add(mesh);
      meshes[id] = mesh;
    }
  }

  // ── World generation ─────────────────────────────────────────────────────
  function noise2(x, z, freq) {
    const xi = Math.floor(x*freq), zi = Math.floor(z*freq);
    const xf = x*freq - xi, zf = z*freq - zi;
    const h = (a,b) => {
      let n = (a|0)*374761393 + (b|0)*668265263;
      n = (n ^ (n>>13)) * 1274126177 | 0;
      return ((n ^ (n>>16)) >>> 0) / 0xffffffff;
    };
    const u = xf*xf*(3-2*xf), v = zf*zf*(3-2*zf);
    return ((h(xi,zi)*(1-u) + h(xi+1,zi)*u) * (1-v)
          + (h(xi,zi+1)*(1-u) + h(xi+1,zi+1)*u) * v);
  }

  function generateWorld() {
    world = new Uint8Array(WX * WY * WZ);
    const heights = [];
    for (let z=0; z<WZ; z++) {
      heights[z] = [];
      for (let x=0; x<WX; x++) {
        let h = 8;
        h += noise2(x, z, 0.05) * 10;
        h += noise2(x, z, 0.13) * 4;
        h += noise2(x, z, 0.27) * 1.6;
        h = Math.max(2, Math.min(WY - 5, Math.floor(h)));
        heights[z][x] = h;
        for (let y=0; y<h; y++) {
          if (y === 0) setB(x,y,z, BEDROCK);
          else if (y < h - 4) setB(x,y,z, STONE);
          else setB(x,y,z, DIRT);
        }
        const surf = h - 1;
        if (h >= WY - 8) setB(x, surf, z, SNOW);
        else if (surf <= 5) setB(x, surf, z, SAND);
        else setB(x, surf, z, GRASS);
      }
    }
    let s = Math.random()*999;
    const rng = () => { s = (s*9301+49297)%233280; return s/233280; };
    for (let z=3; z<WZ-3; z++) for (let x=3; x<WX-3; x++) {
      if (getB(x, heights[z][x] - 1, z) !== GRASS) continue;
      if (rng() > 0.025) continue;
      const h = heights[z][x];
      const th = 4 + Math.floor(rng()*2);
      for (let dy=0; dy<th; dy++) setB(x, h+dy, z, WOOD);
      for (let dy=-1; dy<=1; dy++) for (let dx=-2; dx<=2; dx++) for (let dz=-2; dz<=2; dz++) {
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
      for (let dz=-r; dz<=r; dz++) for (let dx=-r; dx<=r; dx++) {
        const x = cx+dx, z = cz+dz;
        if (x<0||x>=WX||z<0||z>=WZ) continue;
        for (let y = WY-3; y > 1; y--) {
          if (isSolidAt(x,y,z) && !isSolidAt(x,y+1,z) && !isSolidAt(x,y+2,z))
            return new THREE.Vector3(x+0.5, y+1, z+0.5);
        }
      }
    }
    return new THREE.Vector3(WX/2, WY/2, WZ/2);
  }

  // ── Collision (4 corners × 3 Y offsets through player body) ─────────────
  function collidesAt(x, y, z) {
    const ys = [y + 0.05, y + 0.9, y + PH - 0.05];
    for (const dx of [-PW, PW]) for (const dz of [-PW, PW]) for (const py of ys) {
      if (isSolidAt(Math.floor(x+dx), Math.floor(py), Math.floor(z+dz))) return true;
    }
    return false;
  }

  // Standing-on-block check: probe block immediately under feet
  function isGrounded(x, y, z) {
    const fy = Math.floor(y - 0.02);
    for (const dx of [-PW, PW]) for (const dz of [-PW, PW]) {
      if (isSolidAt(Math.floor(x+dx), fy, Math.floor(z+dz))) return true;
    }
    return false;
  }

  // ── Tick ────────────────────────────────────────────────────────────────
  function tick(dt) {
    // Camera-relative input
    const f = (inputKeys.fwd?1:0)  - (inputKeys.back?1:0);
    const r = (inputKeys.right?1:0) - (inputKeys.left?1:0);
    let dxn = 0, dzn = 0;
    if (f || r) {
      const sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
      dxn = -f * sy + r * cy;
      dzn = -f * cy - r * sy;
      const len = Math.hypot(dxn, dzn);
      if (len > 0) { dxn /= len; dzn /= len; }
    }
    const speed = (inputKeys.sprint && f > 0) ? SPRINT : WALK;
    const vx = dxn * speed, vz = dzn * speed;

    // Horizontal — axis-by-axis, slide on walls
    const newX = player.pos.x + vx * dt;
    if (!collidesAt(newX, player.pos.y, player.pos.z)) player.pos.x = newX;
    const newZ = player.pos.z + vz * dt;
    if (!collidesAt(player.pos.x, player.pos.y, newZ)) player.pos.z = newZ;

    // Update grounded BEFORE applying gravity (prevents accumulation = bouncing)
    const wasGrounded = isGrounded(player.pos.x, player.pos.y, player.pos.z);

    // Jump
    if (inputKeys.jump && wasGrounded) {
      player.vy = JUMP_VEL;
      player.grounded = false;
    } else if (wasGrounded && player.vy <= 0) {
      // Sitting on the ground: clamp velocity and snap to integer Y
      player.vy = 0;
      player.grounded = true;
      const snapY = Math.round(player.pos.y);
      if (Math.abs(player.pos.y - snapY) < 0.06 && !collidesAt(player.pos.x, snapY, player.pos.z)) {
        player.pos.y = snapY;
      }
    } else {
      // In air → apply gravity
      player.vy = Math.max(player.vy + GRAVITY * dt, -MAX_FALL);
      player.grounded = false;
    }

    // Move Y
    if (player.vy !== 0) {
      const newY = player.pos.y + player.vy * dt;
      if (collidesAt(player.pos.x, newY, player.pos.z)) {
        if (player.vy < 0) {
          // Hit floor — snap up to top of block we landed on
          player.pos.y = Math.ceil(newY);
          player.grounded = true;
        } else {
          // Hit ceiling — snap down so head is just below block
          player.pos.y = Math.floor(newY + PH) - PH - 0.001;
        }
        player.vy = 0;
      } else {
        player.pos.y = newY;
      }
    }

    if (player.pos.y < -10) {
      const sp = findSpawn();
      player.pos.copy(sp);
      player.vy = 0;
    }

    camera.position.set(player.pos.x, player.pos.y + EYE, player.pos.z);
    camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
  }

  // ── Voxel raycast (Amanatides-Woo) ───────────────────────────────────────
  function raycastBlock() {
    const o = camera.position.clone();
    const d = new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion).normalize();
    let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z);
    const sx = d.x>0?1:-1, sy = d.y>0?1:-1, sz = d.z>0?1:-1;
    const tdx = d.x===0 ? Infinity : Math.abs(1/d.x);
    const tdy = d.y===0 ? Infinity : Math.abs(1/d.y);
    const tdz = d.z===0 ? Infinity : Math.abs(1/d.z);
    let tmx = d.x===0 ? Infinity : tdx * (sx>0 ? 1-(o.x-x) : (o.x-x));
    let tmy = d.y===0 ? Infinity : tdy * (sy>0 ? 1-(o.y-y) : (o.y-y));
    let tmz = d.z===0 ? Infinity : tdz * (sz>0 ? 1-(o.z-z) : (o.z-z));
    let face = [0,0,0];
    while (true) {
      const t = Math.min(tmx, tmy, tmz);
      if (t > REACH) return null;
      if (tmx < tmy && tmx < tmz) { x += sx; tmx += tdx; face = [-sx,0,0]; }
      else if (tmy < tmz)         { y += sy; tmy += tdy; face = [0,-sy,0]; }
      else                        { z += sz; tmz += tdz; face = [0,0,-sz]; }
      if (isSolidAt(x,y,z)) return { x, y, z, normal: face };
    }
  }

  // ── Mining (hold left button, crack progresses, block breaks at 100%) ────
  let mouseDownLeft = false;
  let mining = null; // { x, y, z, timer, total }

  function updateMining(dt) {
    const hit = raycastBlock();

    // Selection outline always tracks the targeted block
    if (hit) {
      selectMesh.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
      selectMesh.visible = true;
    } else {
      selectMesh.visible = false;
    }

    // Cancel mining if mouse released, no target, or different block
    if (!mouseDownLeft || !hit ||
        (mining && (mining.x !== hit.x || mining.y !== hit.y || mining.z !== hit.z))) {
      mining = null;
      crackMesh.visible = false;
      if (!mouseDownLeft || !hit) return;
    }

    // Start mining if not already
    if (!mining) {
      const blk = getB(hit.x, hit.y, hit.z);
      const total = BREAK_TIME[blk];
      if (!total || total === Infinity) return;
      mining = { x: hit.x, y: hit.y, z: hit.z, timer: 0, total };
    }

    mining.timer += dt;
    const progress = mining.timer / mining.total;

    // Update crack texture (10 stages)
    const stage = Math.min(9, Math.floor(progress * 10));
    crackMat.map = crackTextures[stage];
    crackMat.needsUpdate = true;
    crackMesh.position.set(mining.x + 0.5, mining.y + 0.5, mining.z + 0.5);
    crackMesh.visible = true;

    // Block broke
    if (progress >= 1) {
      setB(mining.x, mining.y, mining.z, AIR);
      bcast('block', { x: mining.x, y: mining.y, z: mining.z, v: AIR });
      worldDirty = true;
      mining = null;
      crackMesh.visible = false;
    }
  }

  function placeBlock() {
    const hit = raycastBlock(); if (!hit) return;
    const px = hit.x + hit.normal[0], py = hit.y + hit.normal[1], pz = hit.z + hit.normal[2];
    if (px<0||px>=WX||py<0||py>=WY||pz<0||pz>=WZ) return;
    if (getB(px, py, pz) !== AIR) return;
    // Don't place inside player
    const cx = px+0.5, cy = py+0.5, cz = pz+0.5;
    const dx = Math.abs(cx - player.pos.x);
    const dz = Math.abs(cz - player.pos.z);
    const overlapY = (cy + 0.5) > player.pos.y && (cy - 0.5) < (player.pos.y + PH);
    if (dx < PW + 0.5 && dz < PW + 0.5 && overlapY) return;
    const blk = HOTBAR[hotbarSlot];
    setB(px, py, pz, blk);
    bcast('block', { x:px, y:py, z:pz, v:blk });
    worldDirty = true;
  }

  // ── Other players ────────────────────────────────────────────────────────
  function ensureOther(id, color, name) {
    if (others[id]?.mesh) return others[id];
    const grp = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.2, 0.4), new THREE.MeshLambertMaterial({ color }));
    body.position.y = 0.6;
    grp.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshLambertMaterial({ color: 0xffd6a8 }));
    head.position.y = 1.45;
    grp.add(head);
    scene.add(grp);
    const label = document.createElement('div');
    label.className = 'name-tag'; label.textContent = name;
    document.getElementById('nameTags').appendChild(label);
    others[id] = { mesh: grp, label, x:0, y:0, z:0, yaw:0, name, color };
    return others[id];
  }
  function removeOther(id) {
    const o = others[id]; if (!o) return;
    scene.remove(o.mesh); o.label?.remove(); delete others[id];
  }
  function updateNameTags() {
    const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
    for (const o of Object.values(others)) {
      if (!o.mesh) continue;
      const pos = new THREE.Vector3(o.x, o.y + 2.2, o.z);
      const proj = pos.project(camera);
      if (proj.z > 1 || proj.z < -1) { o.label.style.display = 'none'; continue; }
      o.label.style.display = 'block';
      o.label.style.left = ((proj.x+1)/2 * w) + 'px';
      o.label.style.top  = ((-proj.y+1)/2 * h) + 'px';
    }
  }

  // ── Multiplayer ──────────────────────────────────────────────────────────
  function bcast(event, payload) { if (channel) channel.send({ type:'broadcast', event, payload }); }

  function rleEnc(arr) {
    const out = [];
    let i = 0;
    while (i < arr.length) {
      let n = 1;
      while (i+n < arr.length && arr[i+n] === arr[i] && n < 255) n++;
      out.push(n, arr[i]); i += n;
    }
    return new Uint8Array(out);
  }
  function rleDec(rle) {
    const out = [];
    for (let i = 0; i < rle.length; i += 2) for (let j = 0; j < rle[i]; j++) out.push(rle[i+1]);
    return new Uint8Array(out);
  }
  const b64Enc = b => { let s=''; for (const x of b) s += String.fromCharCode(x); return btoa(s); };
  const b64Dec = s => { const b = atob(s); const o = new Uint8Array(b.length); for (let i=0;i<b.length;i++) o[i]=b.charCodeAt(i); return o; };

  function sendWorld() {
    if (!world) return;
    bcast('world', { d: b64Enc(rleEnc(world)) });
  }

  function connectRoom(code) {
    if (channel) sb.removeChannel(channel);
    channel = sb.channel('mc3d:'+code);

    channel.on('presence', { event:'sync' }, () => {
      const all = Object.values(channel.presenceState()).flat();
      document.getElementById('onlineBadge').textContent = '👤 ' + all.length + ' online';
      if (isHost && world) sendWorld();
    });
    channel.on('presence', { event:'leave' }, ({ leftPresences }) => {
      const arr = Array.isArray(leftPresences) ? leftPresences : Object.values(leftPresences).flat();
      arr.forEach(p => { if (p?.userId && p.userId !== myId) removeOther(p.userId); });
    });
    channel.on('broadcast', { event:'req_world' }, () => { if (isHost && world) sendWorld(); });
    channel.on('broadcast', { event:'world' }, ({ payload }) => {
      if (world) return;
      if (worldTimeout) { clearTimeout(worldTimeout); worldTimeout = null; }
      const decoded = rleDec(b64Dec(payload.d));
      const buf = new Uint8Array(WX*WY*WZ);
      buf.set(decoded.subarray(0, Math.min(decoded.length, buf.length)));
      world = buf;
      beginPlaying();
    });
    channel.on('broadcast', { event:'block' }, ({ payload }) => {
      setB(payload.x, payload.y, payload.z, payload.v);
      worldDirty = true;
    });
    channel.on('broadcast', { event:'move' }, ({ payload }) => {
      if (payload.id === myId) return;
      const o = ensureOther(payload.id, payload.color, payload.name);
      o.x=payload.x; o.y=payload.y; o.z=payload.z; o.yaw=payload.yaw;
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

  // ── Input ────────────────────────────────────────────────────────────────
  let pointerLocked = false;
  canvas.addEventListener('click', () => { if (running) canvas.requestPointerLock(); });
  document.addEventListener('pointerlockchange', () => {
    pointerLocked = document.pointerLockElement === canvas;
    document.getElementById('lockHint').style.display = (running && !pointerLocked) ? 'block' : 'none';
    if (!pointerLocked) {
      mouseDownLeft = false;
      mining = null;
      crackMesh.visible = false;
      selectMesh.visible = false;
    }
  });
  document.addEventListener('mousemove', e => {
    if (!pointerLocked) return;
    player.yaw   -= e.movementX * 0.0022;
    player.pitch -= e.movementY * 0.0022;
    const lim = Math.PI/2 - 0.01;
    if (player.pitch > lim) player.pitch = lim;
    if (player.pitch < -lim) player.pitch = -lim;
  });
  document.addEventListener('mousedown', e => {
    if (!pointerLocked) return;
    if (e.button === 0) mouseDownLeft = true;
    else if (e.button === 2) placeBlock();
  });
  document.addEventListener('mouseup', e => {
    if (e.button === 0) {
      mouseDownLeft = false;
      mining = null;
      crackMesh.visible = false;
    }
  });
  document.addEventListener('contextmenu', e => { if (pointerLocked) e.preventDefault(); });

  document.addEventListener('keydown', e => {
    if (!running) return;
    if (e.code === 'KeyW' || e.code === 'ArrowUp')    inputKeys.fwd = true;
    if (e.code === 'KeyS' || e.code === 'ArrowDown')  inputKeys.back = true;
    if (e.code === 'KeyA' || e.code === 'ArrowLeft')  inputKeys.left = true;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') inputKeys.right = true;
    if (e.code === 'Space') { inputKeys.jump = true; e.preventDefault(); }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') inputKeys.sprint = true;
    const n = parseInt(e.key);
    if (n >= 1 && n <= HOTBAR.length) { hotbarSlot = n - 1; updateHotbarUI(); }
  });
  document.addEventListener('keyup', e => {
    if (e.code === 'KeyW' || e.code === 'ArrowUp')    inputKeys.fwd = false;
    if (e.code === 'KeyS' || e.code === 'ArrowDown')  inputKeys.back = false;
    if (e.code === 'KeyA' || e.code === 'ArrowLeft')  inputKeys.left = false;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') inputKeys.right = false;
    if (e.code === 'Space') inputKeys.jump = false;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') inputKeys.sprint = false;
  });
  canvas.addEventListener('wheel', e => {
    if (!running) return;
    e.preventDefault();
    hotbarSlot = (hotbarSlot + (e.deltaY > 0 ? 1 : -1) + HOTBAR.length) % HOTBAR.length;
    updateHotbarUI();
  }, { passive: false });

  // ── Hotbar UI ────────────────────────────────────────────────────────────
  // Build small swatch images sampled from the side-tile of each block in atlas
  const hotbarThumbs = {};
  function makeThumbs(image) {
    const layerH = image.height / ATLAS_LAYERS; // 128
    const tileW  = image.width / 3;             // 128
    for (const id of HOTBAR) {
      const c = document.createElement('canvas');
      c.width = c.height = 32;
      const cx = c.getContext('2d');
      cx.imageSmoothingEnabled = false;
      // Show the SIDE tile (middle) so blocks look like blocks; sy uses raw layer index = id
      const sx = tileW;            // middle tile = side
      const sy = id * layerH;      // block id N is at file Y = N * 128
      cx.drawImage(image, sx, sy, tileW, layerH, 0, 0, 32, 32);
      hotbarThumbs[id] = c.toDataURL();
    }
    buildHotbarUI();
  }
  // Load atlas as Image to make thumbnails (separate from Three.js texture load)
  const atlasImg = new Image();
  atlasImg.onload = () => makeThumbs(atlasImg);
  atlasImg.src = 'assets/tex_array_0.png';

  function buildHotbarUI() {
    const el = document.getElementById('hotbar');
    el.innerHTML = '';
    HOTBAR.forEach((b, i) => {
      const slot = document.createElement('div');
      slot.className = 'slot';
      const swatch = document.createElement('div');
      swatch.className = 'swatch';
      if (hotbarThumbs[b]) swatch.style.backgroundImage = `url(${hotbarThumbs[b]})`;
      slot.appendChild(swatch);
      const num = document.createElement('span');
      num.className = 'num'; num.textContent = i + 1;
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

  // ── Boot ────────────────────────────────────────────────────────────────
  function beginPlaying() {
    const sp = findSpawn();
    player.pos.copy(sp);
    player.vy = 0; player.yaw = 0; player.pitch = 0;
    buildMeshes();
    running = true;
    document.getElementById('lobbyPanel').style.display = 'none';
    document.getElementById('waitPanel').style.display = 'none';
    document.getElementById('crosshair').style.display = 'block';
    document.getElementById('hotbar').style.display = 'flex';
    document.getElementById('hudInfo').style.display = 'block';
    document.getElementById('roomBadge').textContent = 'Room: ' + roomCode;
    if (Object.keys(hotbarThumbs).length === 0 && atlasImg.complete) makeThumbs(atlasImg);
    else if (Object.keys(hotbarThumbs).length > 0) buildHotbarUI();
    resize();
    last = performance.now();
    requestAnimationFrame(loop);
  }

  let last = 0, moveBcastTimer = 0;
  function loop(now) {
    if (!running) return;
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    tick(dt);
    updateMining(dt);
    if (worldDirty) { buildMeshes(); worldDirty = false; }
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

  // ── Auth + lobby ─────────────────────────────────────────────────────────
  const PCOLORS = [0xe74c3c,0x3498db,0x2ecc71,0xf1c40f,0x9b59b6,0x1abc9c,0xe67e22,0xe91e63];

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
    const p='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let c='';
    for (let i=0;i<4;i++) c += p[Math.floor(Math.random()*p.length)];
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
