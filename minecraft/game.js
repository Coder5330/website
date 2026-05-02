(() => {
  // ── Block IDs (match settings.py) ────────────────────────────────────────
  const AIR=0, SAND=1, GRASS=2, DIRT=3, STONE=4, SNOW=5, LEAVES=6, WOOD=7, WATER=8;
  const BEDROCK = 9;
  const COAL_ORE=12, IRON_ORE=13, COPPER_ORE=14, GOLD_ORE=15, REDSTONE_ORE=16, DIAMOND_ORE=17;
  const ORES = [COAL_ORE, IRON_ORE, COPPER_ORE, GOLD_ORE, REDSTONE_ORE, DIAMOND_ORE];
  const ALL_BLOCKS = [SAND, GRASS, DIRT, STONE, SNOW, LEAVES, WOOD];
  const SOLID = new Set([SAND,GRASS,DIRT,STONE,SNOW,LEAVES,WOOD,BEDROCK,
                         COAL_ORE,IRON_ORE,COPPER_ORE,GOLD_ORE,REDSTONE_ORE,DIAMOND_ORE]);

  // World dims
  const WX=64, WY=40, WZ=64;
  const SEA_LEVEL = 9;
  const ATLAS_LAYERS = 8;

  // ── Tool items ───────────────────────────────────────────────────────────
  const ITEM_WOOD_PICK=101, ITEM_STONE_PICK=102, ITEM_IRON_PICK=103, ITEM_DIAMOND_PICK=104;
  const ITEM_WOOD_AXE=111,  ITEM_STONE_AXE=112,  ITEM_IRON_AXE=113,  ITEM_DIAMOND_AXE=114;
  const ITEM_WOOD_SHOVEL=121, ITEM_STONE_SHOVEL=122, ITEM_IRON_SHOVEL=123;
  const ITEM_WOOD_SWORD=131, ITEM_STONE_SWORD=132, ITEM_IRON_SWORD=133, ITEM_DIAMOND_SWORD=134;

  const TOOLS = {
    [ITEM_WOOD_PICK]:    { kind:'pickaxe', tier:1, name:'Wood Pickaxe',    img:'assets/woodenpickaxe.png' },
    [ITEM_STONE_PICK]:   { kind:'pickaxe', tier:2, name:'Stone Pickaxe',   img:'assets/stonepickaxe.png' },
    [ITEM_IRON_PICK]:    { kind:'pickaxe', tier:3, name:'Iron Pickaxe',    img:'assets/ironpickaxe.jpg' },
    [ITEM_DIAMOND_PICK]: { kind:'pickaxe', tier:4, name:'Diamond Pickaxe', img:'assets/diamondpickaxe.png' },
    [ITEM_WOOD_AXE]:     { kind:'axe',     tier:1, name:'Wood Axe',        img:'assets/woodenaxe.jpg' },
    [ITEM_STONE_AXE]:    { kind:'axe',     tier:2, name:'Stone Axe',       img:'assets/stoneaxe.jpg' },
    [ITEM_IRON_AXE]:     { kind:'axe',     tier:3, name:'Iron Axe',        img:'assets/ironaxe.png' },
    [ITEM_DIAMOND_AXE]:  { kind:'axe',     tier:4, name:'Diamond Axe',     img:'assets/diamondaxe.png' },
    [ITEM_WOOD_SHOVEL]:  { kind:'shovel',  tier:1, name:'Wood Shovel',     img:'assets/woodenshovel.jpg' },
    [ITEM_STONE_SHOVEL]: { kind:'shovel',  tier:2, name:'Stone Shovel',    img:'assets/stoneshovel.jpg' },
    [ITEM_IRON_SHOVEL]:  { kind:'shovel',  tier:3, name:'Iron Shovel',     img:'assets/ironshovel.jpg' },
    [ITEM_WOOD_SWORD]:   { kind:'sword',   tier:1, name:'Wood Sword',      img:'assets/woodensword.jpg' },
    [ITEM_STONE_SWORD]:  { kind:'sword',   tier:2, name:'Stone Sword',     img:'assets/stonesword.png' },
    [ITEM_IRON_SWORD]:   { kind:'sword',   tier:3, name:'Iron Sword',      img:'assets/ironsword.png' },
    [ITEM_DIAMOND_SWORD]:{ kind:'sword',   tier:4, name:'Diamond Sword',   img:'assets/diamondsword.png' },
  };

  // What tool each block prefers + minimum tier required to drop
  const BLOCK_TOOL = {
    [SAND]:'shovel', [DIRT]:'shovel', [GRASS]:'shovel', [SNOW]:'shovel',
    [WOOD]:'axe',    [LEAVES]:'sword',
    [STONE]:'pickaxe', [COAL_ORE]:'pickaxe', [IRON_ORE]:'pickaxe',
    [COPPER_ORE]:'pickaxe', [GOLD_ORE]:'pickaxe',
    [DIAMOND_ORE]:'pickaxe', [REDSTONE_ORE]:'pickaxe',
  };
  const BLOCK_MIN_TIER = {
    [STONE]:1, [COAL_ORE]:1,
    [IRON_ORE]:2, [COPPER_ORE]:2,
    [GOLD_ORE]:3, [DIAMOND_ORE]:3, [REDSTONE_ORE]:3,
  };

  // Hand-mining times (s) — straight from voxel_handler.py
  const BREAK_TIME = {
    [SAND]: 0.75, [GRASS]: 0.9, [DIRT]: 0.75, [STONE]: 7.5,
    [SNOW]: 0.5,  [LEAVES]: 0.3, [WOOD]: 3.0,
    [COAL_ORE]: 7.5, [IRON_ORE]: 15, [COPPER_ORE]: 15,
    [GOLD_ORE]: 15, [DIAMOND_ORE]: 15, [REDSTONE_ORE]: 15,
    [BEDROCK]: Infinity,
  };
  // Speed multipliers per tier when the tool kind matches the block
  const TIER_SPEED = [1, 6, 9, 13, 18];

  function getSelectedTool() {
    const slot = hotbar[hotbarSlot];
    return (slot && slot.kind === 'tool') ? slot.id : null;
  }
  function getMineTime(block, itemId) {
    const base = BREAK_TIME[block] ?? 1.0;
    if (itemId == null) return base;
    const t = TOOLS[itemId];
    if (!t || t.kind !== BLOCK_TOOL[block]) return base;
    return base / TIER_SPEED[t.tier];
  }
  function canHarvest(block, itemId) {
    const minTier = BLOCK_MIN_TIER[block] || 0;
    if (minTier === 0) return true;
    const t = itemId != null ? TOOLS[itemId] : null;
    return !!(t && t.kind === BLOCK_TOOL[block] && t.tier >= minTier);
  }

  // ── Physics ──────────────────────────────────────────────────────────────
  const WALK = 4.5;
  const SPRINT = 6.5;
  const JUMP_VEL = 8.2;
  const GRAVITY = -28;
  const MAX_FALL = 60;
  const PW = 0.3, PH = 1.8, EYE = 1.6, REACH = 5.5;

  // ── State ────────────────────────────────────────────────────────────────
  let world = null;
  let myId='', myName='Player', myColor=0xe74c3c;
  let others = {};
  let channel=null, isHost=false, roomCode='', worldTimeout=null;
  let hotbarSlot=0, running=false, worldDirty=false;
  const player = { pos: new THREE.Vector3(0,0,0), vy:0, grounded:false, yaw:0, pitch:0 };
  const inputKeys = { fwd:false, back:false, left:false, right:false, jump:false, sprint:false };

  // Inventory: 9 slots, each null | {kind:'block', block, count} | {kind:'tool', id}
  const HOTBAR_SIZE = 9;
  const hotbar = Array(HOTBAR_SIZE).fill(null);
  const blockThumbs = {}; // populated by atlas + ore loaders

  // ── Three.js ─────────────────────────────────────────────────────────────
  const canvas = document.getElementById('mcCanvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x88c5ff);
  scene.fog = new THREE.Fog(0x88c5ff, 50, 130);

  const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 400);
  scene.add(camera);

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

  // ── Atlas + materials ────────────────────────────────────────────────────
  const atlasTex = new THREE.TextureLoader().load('assets/tex_array_0.png');
  atlasTex.magFilter = THREE.NearestFilter;
  atlasTex.minFilter = THREE.NearestFilter;
  atlasTex.generateMipmaps = false;
  atlasTex.colorSpace = THREE.SRGBColorSpace;

  const waterTex = new THREE.TextureLoader().load('assets/water.png');
  waterTex.wrapS = waterTex.wrapT = THREE.RepeatWrapping;
  waterTex.magFilter = THREE.NearestFilter;
  waterTex.minFilter = THREE.NearestFilter;
  waterTex.colorSpace = THREE.SRGBColorSpace;

  function makeBlockGeo(id) {
    const g = new THREE.BoxGeometry(1, 1, 1);
    const uvs = g.attributes.uv.array;
    const vMax = (ATLAS_LAYERS - id) / ATLAS_LAYERS;
    const vMin = vMax - 1 / ATLAS_LAYERS;
    // BoxGeometry face order: +X, -X, +Y, -Y, +Z, -Z. Atlas tile order: BOTTOM | SIDE | TOP.
    const uRanges = [
      [1/3, 2/3], [1/3, 2/3], // +X side, -X side
      [2/3, 1  ], [0,   1/3], // +Y top (right tile), -Y bottom (left tile)
      [1/3, 2/3], [1/3, 2/3], // +Z side, -Z side
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
  for (const id of ALL_BLOCKS) blockGeos[id] = makeBlockGeo(id);
  blockGeos[BEDROCK] = blockGeos[STONE];
  blockGeos[WATER]   = new THREE.BoxGeometry(1, 1, 1);

  const blockMaterial = new THREE.MeshLambertMaterial({ map: atlasTex });
  const waterMaterial = new THREE.MeshLambertMaterial({
    map: waterTex, color: 0x99ccff, transparent: true, opacity: 0.78, depthWrite: false,
  });

  // ── Ore textures from tex_array_1.png (4×2 grid of 64×64 tiles) ──────────
  // Tile order in file (row-major): coal, iron, gold, diamond, lapis, redstone, emerald, copper
  const oreMaterials = {};
  const oreTileIndex = {
    [COAL_ORE]: 0, [IRON_ORE]: 1, [GOLD_ORE]: 2, [DIAMOND_ORE]: 3,
    [REDSTONE_ORE]: 5, [COPPER_ORE]: 7,
  };
  for (const id of ORES) blockGeos[id] = new THREE.BoxGeometry(1, 1, 1);
  const oreImg = new Image();
  oreImg.onload = () => {
    const tileW = oreImg.width / 4;
    const tileH = oreImg.height / 2;
    for (const idStr of Object.keys(oreTileIndex)) {
      const id = +idStr;
      const tIdx = oreTileIndex[id];
      const col = tIdx % 4, row = Math.floor(tIdx / 4);
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const cx = c.getContext('2d');
      cx.imageSmoothingEnabled = false;
      cx.drawImage(oreImg, col*tileW, row*tileH, tileW, tileH, 0, 0, 64, 64);
      const tex = new THREE.CanvasTexture(c);
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.colorSpace = THREE.SRGBColorSpace;
      oreMaterials[id] = new THREE.MeshLambertMaterial({ map: tex });
      // Hotbar thumbnail
      const tc = document.createElement('canvas');
      tc.width = tc.height = 32;
      const tcx = tc.getContext('2d');
      tcx.imageSmoothingEnabled = false;
      tcx.drawImage(oreImg, col*tileW, row*tileH, tileW, tileH, 0, 0, 32, 32);
      blockThumbs[id] = tc.toDataURL();
    }
    if (running) { worldDirty = true; updateHotbarUI(); }
  };
  oreImg.src = 'assets/tex_array_1.png';

  // ── Crack textures ───────────────────────────────────────────────────────
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
  crackMesh.visible = false; crackMesh.frustumCulled = false;
  scene.add(crackMesh);

  // ── Block selection wireframe (BLACK, opaque) ────────────────────────────
  const selectGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.005, 1.005, 1.005));
  const selectMat = new THREE.LineBasicMaterial({ color: 0x000000 });
  const selectMesh = new THREE.LineSegments(selectGeo, selectMat);
  selectMesh.visible = false; selectMesh.frustumCulled = false;
  scene.add(selectMesh);

  // ── First-person hand (swings while mining) ──────────────────────────────
  const hand = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.55, 0.18),
    new THREE.MeshLambertMaterial({ color: 0xf5c896 })
  );
  hand.position.set(0.42, -0.45, -0.65);
  hand.rotation.x = -0.35;
  camera.add(hand);
  let armSwing = 0;

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

  function isFaceVisible(id, x, y, z) {
    const isWater = id === WATER;
    const ok = b => isWater ? (b === AIR) : (b === AIR || b === WATER);
    return ok(getB(x-1,y,z)) || ok(getB(x+1,y,z))
        || ok(getB(x,y-1,z)) || ok(getB(x,y+1,z))
        || ok(getB(x,y,z-1)) || ok(getB(x,y,z+1));
  }

  // ── Mesh building ────────────────────────────────────────────────────────
  const meshes = {};
  function buildMeshes() {
    for (const id of Object.keys(meshes)) {
      scene.remove(meshes[id]);
      meshes[id].dispose();
      delete meshes[id];
    }
    const counts = {};
    for (let y=0; y<WY; y++) for (let z=0; z<WZ; z++) for (let x=0; x<WX; x++) {
      const b = getB(x,y,z);
      if (b === AIR) continue;
      if (!isFaceVisible(b, x, y, z)) continue;
      counts[b] = (counts[b]||0) + 1;
    }
    const dummy = new THREE.Object3D();
    for (const idStr of Object.keys(counts)) {
      const id = +idStr;
      const geo = blockGeos[id] || blockGeos[STONE];
      const mat = (id === WATER) ? waterMaterial
                : (oreMaterials[id]) ? oreMaterials[id]
                : blockMaterial;
      const mesh = new THREE.InstancedMesh(geo, mat, counts[id]);
      let i = 0;
      for (let y=0; y<WY; y++) for (let z=0; z<WZ; z++) for (let x=0; x<WX; x++) {
        if (getB(x,y,z) !== id) continue;
        if (!isFaceVisible(id, x, y, z)) continue;
        dummy.position.set(x + 0.5, y + 0.5, z + 0.5);
        dummy.updateMatrix();
        mesh.setMatrixAt(i++, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.frustumCulled = false;
      if (id === WATER) mesh.renderOrder = 2;
      scene.add(mesh);
      meshes[id] = mesh;
    }
  }

  // ── World gen with terrain + water ───────────────────────────────────────
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
        let h = 4;
        h += noise2(x, z, 0.035) * 16;
        h += noise2(x, z, 0.085) * 6;
        h += noise2(x, z, 0.21)  * 2.5;
        h = Math.max(2, Math.min(WY - 5, Math.floor(h)));
        heights[z][x] = h;
        for (let y=0; y<h; y++) {
          if (y === 0) setB(x,y,z, BEDROCK);
          else if (y < h - 4) setB(x,y,z, STONE);
          else setB(x,y,z, DIRT);
        }
        const surf = h - 1;
        if (h >= WY - 9)        setB(x, surf, z, SNOW);
        else if (surf <= SEA_LEVEL) setB(x, surf, z, SAND);
        else                       setB(x, surf, z, GRASS);
      }
    }
    // Trees only on grass above water
    let s = Math.random()*999;
    const rng = () => { s = (s*9301+49297)%233280; return s/233280; };
    for (let z=3; z<WZ-3; z++) for (let x=3; x<WX-3; x++) {
      if (getB(x, heights[z][x] - 1, z) !== GRASS) continue;
      if (rng() > 0.022) continue;
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
    // Fill all air ≤ SEA_LEVEL with water
    for (let z=0; z<WZ; z++) for (let x=0; x<WX; x++) {
      for (let y=0; y<=SEA_LEVEL; y++) if (getB(x,y,z) === AIR) setB(x,y,z, WATER);
    }
    // Scatter ore veins inside stone
    const oreSpec = [
      { id: COAL_ORE,     minY: 4,  maxY: 32, count: 90, vein: 5 },
      { id: COPPER_ORE,   minY: 4,  maxY: 28, count: 50, vein: 5 },
      { id: IRON_ORE,     minY: 3,  maxY: 24, count: 65, vein: 4 },
      { id: GOLD_ORE,     minY: 2,  maxY: 14, count: 22, vein: 4 },
      { id: REDSTONE_ORE, minY: 2,  maxY: 12, count: 24, vein: 5 },
      { id: DIAMOND_ORE,  minY: 2,  maxY:  9, count: 14, vein: 3 },
    ];
    for (const spec of oreSpec) {
      for (let i = 0; i < spec.count; i++) {
        let cx = Math.floor(rng()*WX);
        let cy = spec.minY + Math.floor(rng() * (spec.maxY - spec.minY + 1));
        let cz = Math.floor(rng()*WZ);
        for (let v = 0; v < spec.vein; v++) {
          if (getB(cx,cy,cz) === STONE) setB(cx,cy,cz, spec.id);
          const dir = Math.floor(rng()*6);
          if      (dir===0 && cx>0)    cx--;
          else if (dir===1 && cx<WX-1) cx++;
          else if (dir===2 && cy>1)    cy--;
          else if (dir===3 && cy<WY-1) cy++;
          else if (dir===4 && cz>0)    cz--;
          else if (dir===5 && cz<WZ-1) cz++;
        }
      }
    }
  }

  function findSpawn() {
    const cx = Math.floor(WX/2), cz = Math.floor(WZ/2);
    for (let r = 0; r < WX/2; r++) {
      for (let dz=-r; dz<=r; dz++) for (let dx=-r; dx<=r; dx++) {
        const x = cx+dx, z = cz+dz;
        if (x<0||x>=WX||z<0||z>=WZ) continue;
        for (let y = WY-3; y > SEA_LEVEL; y--) {
          if (isSolidAt(x,y,z) && !SOLID.has(getB(x,y+1,z)) && !SOLID.has(getB(x,y+2,z))
              && getB(x,y+1,z) !== WATER && getB(x,y+2,z) !== WATER)
            return new THREE.Vector3(x+0.5, y+1, z+0.5);
        }
      }
    }
    return new THREE.Vector3(WX/2, WY/2, WZ/2);
  }

  // ── Water flow (simple flood-fill) ───────────────────────────────────────
  // Only the host runs this (then re-broadcasts changed cells). Guests just
  // receive block events. Run after the local player breaks/places a block
  // adjacent to water or below sea level.
  function settleWater() {
    if (!world) return [];
    const changes = [];
    for (let iter = 0; iter < 12; iter++) {
      let changed = false;
      for (let y=0; y<=SEA_LEVEL+1; y++) {
        for (let z=0; z<WZ; z++) {
          for (let x=0; x<WX; x++) {
            if (getB(x,y,z) !== AIR) continue;
            let flow = (getB(x, y+1, z) === WATER);
            if (!flow && y <= SEA_LEVEL) {
              flow = (getB(x-1,y,z)===WATER) || (getB(x+1,y,z)===WATER)
                  || (getB(x,y,z-1)===WATER) || (getB(x,y,z+1)===WATER);
            }
            if (flow) {
              setB(x,y,z, WATER);
              changes.push([x,y,z]);
              changed = true;
            }
          }
        }
      }
      if (!changed) break;
    }
    if (changes.length) worldDirty = true;
    return changes;
  }

  // ── Collision ────────────────────────────────────────────────────────────
  function collidesAt(x, y, z) {
    const ys = [y + 0.05, y + 0.9, y + PH - 0.05];
    for (const dx of [-PW, PW]) for (const dz of [-PW, PW]) for (const py of ys) {
      if (isSolidAt(Math.floor(x+dx), Math.floor(py), Math.floor(z+dz))) return true;
    }
    return false;
  }
  function isGrounded(x, y, z) {
    const fy = Math.floor(y - 0.02);
    for (const dx of [-PW, PW]) for (const dz of [-PW, PW]) {
      if (isSolidAt(Math.floor(x+dx), fy, Math.floor(z+dz))) return true;
    }
    return false;
  }
  function inWater() {
    return getB(Math.floor(player.pos.x), Math.floor(player.pos.y + 0.5), Math.floor(player.pos.z)) === WATER;
  }

  // ── Tick ────────────────────────────────────────────────────────────────
  function tick(dt) {
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
    const inWaterNow = inWater();
    let speed = (inputKeys.sprint && f > 0) ? SPRINT : WALK;
    if (inWaterNow) speed *= 0.6;
    const vx = dxn * speed, vz = dzn * speed;

    // Auto step-up: if blocked horizontally but a 1-block ledge is climbable
    // (always when in water — needed to get out — and otherwise when grounded)
    let wasGrounded = isGrounded(player.pos.x, player.pos.y, player.pos.z);
    const newX = player.pos.x + vx * dt;
    if (!collidesAt(newX, player.pos.y, player.pos.z)) player.pos.x = newX;
    else if ((wasGrounded || inWaterNow) && !collidesAt(newX, player.pos.y + 1.0, player.pos.z)
             && !collidesAt(player.pos.x, player.pos.y + 1.0, player.pos.z)) {
      player.pos.x = newX; player.pos.y += 1.0;
    }
    const newZ = player.pos.z + vz * dt;
    if (!collidesAt(player.pos.x, player.pos.y, newZ)) player.pos.z = newZ;
    else if ((wasGrounded || inWaterNow) && !collidesAt(player.pos.x, player.pos.y + 1.0, newZ)
             && !collidesAt(player.pos.x, player.pos.y + 1.0, player.pos.z)) {
      player.pos.z = newZ; player.pos.y += 1.0;
    }

    wasGrounded = isGrounded(player.pos.x, player.pos.y, player.pos.z);

    if (inputKeys.jump && wasGrounded) {
      player.vy = JUMP_VEL;
      player.grounded = false;
    } else if (inputKeys.jump && inWaterNow) {
      // Sustained swim-up while space is held
      player.vy = Math.max(player.vy, 4.0);
      player.grounded = false;
    } else if (wasGrounded && player.vy <= 0) {
      player.vy = 0; player.grounded = true;
      const snapY = Math.round(player.pos.y);
      if (Math.abs(player.pos.y - snapY) < 0.06 && !collidesAt(player.pos.x, snapY, player.pos.z)) {
        player.pos.y = snapY;
      }
    } else {
      const g = inWaterNow ? GRAVITY * 0.35 : GRAVITY;
      player.vy = Math.max(player.vy + g * dt, inWaterNow ? -6 : -MAX_FALL);
      player.grounded = false;
    }

    if (player.vy !== 0) {
      const newY = player.pos.y + player.vy * dt;
      if (collidesAt(player.pos.x, newY, player.pos.z)) {
        if (player.vy < 0) { player.pos.y = Math.ceil(newY); player.grounded = true; }
        else { player.pos.y = Math.floor(newY + PH) - PH - 0.001; }
        player.vy = 0;
      } else {
        player.pos.y = newY;
      }
    }

    if (player.pos.y < -10) {
      const sp = findSpawn(); player.pos.copy(sp); player.vy = 0;
    }

    camera.position.set(player.pos.x, player.pos.y + EYE, player.pos.z);
    camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
  }

  // ── Voxel raycast ────────────────────────────────────────────────────────
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

  // ── Mining ───────────────────────────────────────────────────────────────
  let mouseDownLeft = false;
  let mining = null;

  function updateMining(dt) {
    const hit = raycastBlock();
    if (hit) {
      selectMesh.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
      selectMesh.visible = true;
    } else {
      selectMesh.visible = false;
    }
    if (!mouseDownLeft || !hit ||
        (mining && (mining.x !== hit.x || mining.y !== hit.y || mining.z !== hit.z))) {
      mining = null;
      crackMesh.visible = false;
      if (!mouseDownLeft || !hit) return;
    }
    if (!mining) {
      const blk = getB(hit.x, hit.y, hit.z);
      const tool = getSelectedTool();
      const total = getMineTime(blk, tool);
      if (!total || total === Infinity) return;
      mining = { x: hit.x, y: hit.y, z: hit.z, timer: 0, total, block: blk, tool };
    }
    mining.timer += dt;
    const progress = mining.timer / mining.total;
    const stage = Math.min(9, Math.floor(progress * 10));
    crackMat.map = crackTextures[stage];
    crackMat.needsUpdate = true;
    crackMesh.position.set(mining.x + 0.5, mining.y + 0.5, mining.z + 0.5);
    crackMesh.visible = true;

    if (progress >= 1) {
      const bx = mining.x, by = mining.y, bz = mining.z, blk = mining.block;
      setB(bx, by, bz, AIR);
      bcast('block', { x: bx, y: by, z: bz, v: AIR });
      worldDirty = true;
      // Only drop if the tool was sufficient to harvest
      if (canHarvest(blk, mining.tool)) spawnDrop(bx + 0.5, by + 0.5, bz + 0.5, blk);
      if (isHost) {
        const changes = settleWater();
        for (const [cx, cy, cz] of changes) bcast('block', { x:cx, y:cy, z:cz, v:WATER });
      }
      mining = null;
      crackMesh.visible = false;
    }
  }

  function placeBlock() {
    const hit = raycastBlock(); if (!hit) return;
    const slot = hotbar[hotbarSlot];
    if (!slot || slot.kind !== 'block' || slot.count <= 0) return;
    const px = hit.x + hit.normal[0], py = hit.y + hit.normal[1], pz = hit.z + hit.normal[2];
    if (px<0||px>=WX||py<0||py>=WY||pz<0||pz>=WZ) return;
    const cur = getB(px, py, pz);
    if (cur !== AIR && cur !== WATER) return;
    const cx = px+0.5, cy = py+0.5, cz = pz+0.5;
    const dx = Math.abs(cx - player.pos.x), dz = Math.abs(cz - player.pos.z);
    const overlapY = (cy + 0.5) > player.pos.y && (cy - 0.5) < (player.pos.y + PH);
    if (dx < PW + 0.5 && dz < PW + 0.5 && overlapY) return;
    const blk = slot.block;
    setB(px, py, pz, blk);
    slot.count--;
    if (slot.count <= 0) hotbar[hotbarSlot] = null;
    updateHotbarUI();
    bcast('block', { x:px, y:py, z:pz, v:blk });
    worldDirty = true;
  }

  // ── Dropped items ────────────────────────────────────────────────────────
  const drops = [];

  function spawnDrop(x, y, z, blockId) {
    const baseGeo = blockGeos[blockId] || blockGeos[STONE];
    const geo = baseGeo.clone();
    geo.scale(0.32, 0.32, 0.32);
    const mat = (blockId === WATER)         ? waterMaterial
              : (oreMaterials[blockId])     ? oreMaterials[blockId]
              : blockMaterial;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    scene.add(mesh);
    drops.push({
      pos: new THREE.Vector3(x, y, z),
      vel: new THREE.Vector3((Math.random()-0.5)*1.6, 3.5, (Math.random()-0.5)*1.6),
      blockId, mesh, age: 0, spin: Math.random() * Math.PI * 2,
    });
  }

  function updateDrops(dt) {
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.age += dt;
      d.spin += dt * 1.8;

      d.vel.y = Math.max(d.vel.y + GRAVITY * dt, -18);
      const newY = d.pos.y + d.vel.y * dt;
      if (isSolidAt(Math.floor(d.pos.x), Math.floor(newY - 0.16), Math.floor(d.pos.z))) {
        d.pos.y = Math.ceil(newY - 0.16) + 0.16;
        d.vel.y = 0;
        d.vel.x *= 0.55;
        d.vel.z *= 0.55;
      } else {
        d.pos.y = newY;
      }
      const newX = d.pos.x + d.vel.x * dt;
      if (!isSolidAt(Math.floor(newX), Math.floor(d.pos.y), Math.floor(d.pos.z)))
        d.pos.x = newX;
      else d.vel.x *= -0.3;
      const newZ = d.pos.z + d.vel.z * dt;
      if (!isSolidAt(Math.floor(d.pos.x), Math.floor(d.pos.y), Math.floor(newZ)))
        d.pos.z = newZ;
      else d.vel.z *= -0.3;
      d.vel.x *= 0.985; d.vel.z *= 0.985;

      const bob = Math.sin(d.age * 2.5) * 0.07;
      d.mesh.position.set(d.pos.x, d.pos.y + bob, d.pos.z);
      d.mesh.rotation.y = d.spin;

      if (d.age > 0.4) {
        const dx = d.pos.x - player.pos.x;
        const dz = d.pos.z - player.pos.z;
        const dy = d.pos.y - (player.pos.y + 0.9);
        if (dx*dx + dy*dy + dz*dz < 1.6) {
          if (addToInventory(d.blockId)) {
            scene.remove(d.mesh); d.mesh.geometry.dispose();
            drops.splice(i, 1);
          }
        }
      }
      // Despawn after 5min
      if (d.age > 300) {
        scene.remove(d.mesh); d.mesh.geometry.dispose();
        drops.splice(i, 1);
      }
    }
  }

  // ── Hand swing animation ─────────────────────────────────────────────────
  function updateHand(dt) {
    if (mouseDownLeft && mining) {
      armSwing += dt * 6;
      if (armSwing > Math.PI * 2) armSwing -= Math.PI * 2;
      const swing = Math.sin(armSwing);
      hand.rotation.x = -0.35 + swing * 0.55;
      hand.rotation.z = Math.cos(armSwing * 0.5) * 0.18;
      hand.position.y = -0.45 + (Math.cos(armSwing) - 1) * 0.06;
    } else {
      armSwing *= Math.pow(0.0001, dt);
      hand.rotation.x += (-0.35 - hand.rotation.x) * Math.min(1, dt * 8);
      hand.rotation.z += (0      - hand.rotation.z) * Math.min(1, dt * 8);
      hand.position.y += (-0.45 - hand.position.y) * Math.min(1, dt * 8);
    }
  }

  // ── Inventory ────────────────────────────────────────────────────────────
  function addToInventory(blockId) {
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      if (hotbar[i]?.kind === 'block' && hotbar[i].block === blockId) {
        hotbar[i].count++; updateHotbarUI(); return true;
      }
    }
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      if (!hotbar[i]) {
        hotbar[i] = { kind: 'block', block: blockId, count: 1 };
        updateHotbarUI(); return true;
      }
    }
    return false;
  }
  function giveStartingTools() {
    hotbar[0] = { kind:'tool', id: ITEM_WOOD_PICK };
    hotbar[1] = { kind:'tool', id: ITEM_STONE_PICK };
    hotbar[2] = { kind:'tool', id: ITEM_IRON_PICK };
    hotbar[3] = { kind:'tool', id: ITEM_DIAMOND_PICK };
    hotbar[4] = { kind:'tool', id: ITEM_IRON_AXE };
    hotbar[5] = { kind:'tool', id: ITEM_IRON_SHOVEL };
    hotbar[6] = { kind:'tool', id: ITEM_DIAMOND_SWORD };
  }

  // ── Other players ────────────────────────────────────────────────────────
  function ensureOther(id, color, name) {
    if (others[id]?.mesh) return others[id];
    const grp = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.2, 0.4), new THREE.MeshLambertMaterial({ color }));
    body.position.y = 0.6; grp.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshLambertMaterial({ color: 0xffd6a8 }));
    head.position.y = 1.45; grp.add(head);
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
    const out = []; let i = 0;
    while (i < arr.length) {
      let n = 1;
      while (i+n < arr.length && arr[i+n] === arr[i] && n < 255) n++;
      out.push(n, arr[i]); i += n;
    }
    return new Uint8Array(out);
  }
  function rleDec(rle) {
    const out = [];
    for (let i=0; i<rle.length; i+=2) for (let j=0; j<rle[i]; j++) out.push(rle[i+1]);
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
      mouseDownLeft = false; mining = null;
      crackMesh.visible = false; selectMesh.visible = false;
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
      mouseDownLeft = false; mining = null; crackMesh.visible = false;
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
    if (n >= 1 && n <= HOTBAR_SIZE) { hotbarSlot = n - 1; updateHotbarUI(); }
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
    hotbarSlot = (hotbarSlot + (e.deltaY > 0 ? 1 : -1) + HOTBAR_SIZE) % HOTBAR_SIZE;
    updateHotbarUI();
  }, { passive: false });

  // ── Hotbar UI (counts; sample texture from atlas) ────────────────────────
  function makeThumbs(image) {
    const layerH = image.height / ATLAS_LAYERS;
    const tileW  = image.width / 3;
    for (const id of [SAND, GRASS, DIRT, STONE, SNOW, LEAVES, WOOD]) {
      const c = document.createElement('canvas');
      c.width = c.height = 32;
      const cx = c.getContext('2d');
      cx.imageSmoothingEnabled = false;
      cx.drawImage(image, tileW, id * layerH, tileW, layerH, 0, 0, 32, 32);
      blockThumbs[id] = c.toDataURL();
    }
    buildHotbarUI();
  }
  const atlasImg = new Image();
  atlasImg.onload = () => makeThumbs(atlasImg);
  atlasImg.src = 'assets/tex_array_0.png';

  function slotImage(item) {
    if (!item) return null;
    if (item.kind === 'block') return blockThumbs[item.block] || null;
    if (item.kind === 'tool')  return TOOLS[item.id]?.img || null;
    return null;
  }
  function buildHotbarUI() {
    const el = document.getElementById('hotbar');
    el.innerHTML = '';
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const slot = document.createElement('div');
      slot.className = 'slot';
      const swatch = document.createElement('div');
      swatch.className = 'swatch';
      const item = hotbar[i];
      const src = slotImage(item);
      if (src) swatch.style.backgroundImage = `url(${src})`;
      slot.appendChild(swatch);
      const num = document.createElement('span');
      num.className = 'num'; num.textContent = i + 1;
      slot.appendChild(num);
      if (item?.kind === 'block' && item.count > 1) {
        const cnt = document.createElement('span');
        cnt.className = 'cnt'; cnt.textContent = item.count;
        slot.appendChild(cnt);
      }
      el.appendChild(slot);
    }
    updateHotbarUI();
  }
  function updateHotbarUI() {
    const el = document.getElementById('hotbar');
    if (!el.children.length) { buildHotbarUI(); return; }
    [...el.children].forEach((c, i) => {
      c.classList.toggle('active', i === hotbarSlot);
      const item = hotbar[i];
      const swatch = c.querySelector('.swatch');
      const src = slotImage(item);
      swatch.style.backgroundImage = src ? `url(${src})` : 'none';
      let cnt = c.querySelector('.cnt');
      if (item?.kind === 'block' && item.count > 1) {
        if (!cnt) { cnt = document.createElement('span'); cnt.className = 'cnt'; c.appendChild(cnt); }
        cnt.textContent = item.count;
      } else if (cnt) cnt.remove();
    });
  }

  // ── Boot ────────────────────────────────────────────────────────────────
  function beginPlaying() {
    const sp = findSpawn();
    player.pos.copy(sp); player.vy = 0; player.yaw = 0; player.pitch = 0;
    giveStartingTools();
    buildMeshes();
    running = true;
    document.getElementById('lobbyPanel').style.display = 'none';
    document.getElementById('waitPanel').style.display = 'none';
    document.getElementById('crosshair').style.display = 'block';
    document.getElementById('hotbar').style.display = 'flex';
    document.getElementById('hudInfo').style.display = 'block';
    document.getElementById('roomBadge').textContent = 'Room: ' + roomCode;
    if (atlasImg.complete && Object.keys(blockThumbs).length === 0) makeThumbs(atlasImg);
    else buildHotbarUI();
    resize();
    last = performance.now();
    requestAnimationFrame(loop);
  }

  let last = 0, moveBcastTimer = 0, waterAnimT = 0;
  function loop(now) {
    if (!running) return;
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    tick(dt);
    updateMining(dt);
    updateDrops(dt);
    updateHand(dt);

    // Animate water texture (flowing effect)
    waterAnimT += dt * 0.18;
    waterTex.offset.y = -waterAnimT;
    waterTex.offset.x = waterAnimT * 0.5;

    if (worldDirty) { buildMeshes(); worldDirty = false; }

    moveBcastTimer += dt;
    if (moveBcastTimer > 0.05) {
      moveBcastTimer = 0;
      bcast('move', {
        id: myId, name: myName, color: myColor,
        x: +player.pos.x.toFixed(2), y: +player.pos.y.toFixed(2), z: +player.pos.z.toFixed(2),
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
    resize(); generateWorld(); connectRoom(roomCode); beginPlaying();
  });
  document.getElementById('joinBtn').addEventListener('click', async () => {
    const code = document.getElementById('codeInput').value.trim().toUpperCase();
    if (code.length !== 4) { alert('Enter a 4-letter room code.'); return; }
    if (!await getMyUser()) return;
    roomCode = code; isHost = false;
    document.getElementById('lobbyPanel').style.display = 'none';
    document.getElementById('waitCode').textContent = code;
    document.getElementById('waitPanel').style.display = 'flex';
    resize(); connectRoom(roomCode);
    worldTimeout = setTimeout(() => {
      document.getElementById('waitMsg').textContent = 'Room not found. Check the code and try again.';
    }, 12000);
  });
  document.getElementById('codeInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('joinBtn').click();
  });
  resize();
})();
