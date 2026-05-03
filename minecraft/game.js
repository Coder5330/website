(() => {
  // ── Block IDs ────────────────────────────────────────────────────────────
  const AIR=0, SAND=1, GRASS=2, DIRT=3, STONE=4, SNOW=5, LEAVES=6, WOOD=7, WATER=8;
  const BEDROCK = 9;
  const CRAFTING_TABLE = 10;
  const COAL_ORE=12, IRON_ORE=13, COPPER_ORE=14, GOLD_ORE=15, REDSTONE_ORE=16, DIAMOND_ORE=17;
  const ORES = [COAL_ORE, IRON_ORE, COPPER_ORE, GOLD_ORE, REDSTONE_ORE, DIAMOND_ORE];
  const ATLAS_BLOCKS = [SAND, GRASS, DIRT, STONE, SNOW, LEAVES, WOOD]; // in tex_array_0.png
  const SOLID = new Set([SAND,GRASS,DIRT,STONE,SNOW,LEAVES,WOOD,BEDROCK,CRAFTING_TABLE,
                         COAL_ORE,IRON_ORE,COPPER_ORE,GOLD_ORE,REDSTONE_ORE,DIAMOND_ORE]);

  // ── World dims (chunked, infinite) ───────────────────────────────────────
  const CHUNK_W = 32;
  const WY = 64;
  const SEA_LEVEL = 14;
  const ATLAS_LAYERS = 8;
  const MESH_DIST = 3;  // build visible meshes within this chunk radius
  const GEN_DIST  = 4;  // pre-generate data one ring beyond so edge faces cull correctly

  // ── Tool items ───────────────────────────────────────────────────────────
  const ITEM_WOOD_PICK=101, ITEM_STONE_PICK=102, ITEM_IRON_PICK=103, ITEM_DIAMOND_PICK=104;
  const ITEM_WOOD_AXE=111,  ITEM_STONE_AXE=112,  ITEM_IRON_AXE=113,  ITEM_DIAMOND_AXE=114;
  const ITEM_WOOD_SHOVEL=121, ITEM_STONE_SHOVEL=122, ITEM_IRON_SHOVEL=123;
  const ITEM_WOOD_SWORD=131, ITEM_STONE_SWORD=132, ITEM_IRON_SWORD=133, ITEM_DIAMOND_SWORD=134;

  const TOOLS = {
    [ITEM_WOOD_PICK]:    { kind:'pickaxe', tier:1, name:'Wood Pickaxe',    img:'assets/woodenpickaxe.png' },
    [ITEM_STONE_PICK]:   { kind:'pickaxe', tier:2, name:'Stone Pickaxe',   img:'assets/stonepickaxe.png' },
    [ITEM_IRON_PICK]:    { kind:'pickaxe', tier:3, name:'Iron Pickaxe',    img:'assets/ironpickaxe.png' },
    [ITEM_DIAMOND_PICK]: { kind:'pickaxe', tier:4, name:'Diamond Pickaxe', img:'assets/diamondpickaxe.png' },
    [ITEM_WOOD_AXE]:     { kind:'axe',     tier:1, name:'Wood Axe',        img:'assets/woodenaxe.png' },
    [ITEM_STONE_AXE]:    { kind:'axe',     tier:2, name:'Stone Axe',       img:'assets/stoneaxe.png' },
    [ITEM_IRON_AXE]:     { kind:'axe',     tier:3, name:'Iron Axe',        img:'assets/ironaxe.png' },
    [ITEM_DIAMOND_AXE]:  { kind:'axe',     tier:4, name:'Diamond Axe',     img:'assets/diamondaxe.png' },
    [ITEM_WOOD_SHOVEL]:  { kind:'shovel',  tier:1, name:'Wood Shovel',     img:'assets/woodenshovel.png' },
    [ITEM_STONE_SHOVEL]: { kind:'shovel',  tier:2, name:'Stone Shovel',    img:'assets/stoneshovel.png' },
    [ITEM_IRON_SHOVEL]:  { kind:'shovel',  tier:3, name:'Iron Shovel',     img:'assets/ironshovel.png' },
    [ITEM_WOOD_SWORD]:   { kind:'sword',   tier:1, name:'Wood Sword',      img:'assets/woodensword.png' },
    [ITEM_STONE_SWORD]:  { kind:'sword',   tier:2, name:'Stone Sword',     img:'assets/stonesword.png' },
    [ITEM_IRON_SWORD]:   { kind:'sword',   tier:3, name:'Iron Sword',      img:'assets/ironsword.png' },
    [ITEM_DIAMOND_SWORD]:{ kind:'sword',   tier:4, name:'Diamond Sword',   img:'assets/diamondsword.png' },
  };

  const ITEM_PLANK = 106, ITEM_STICK = 107, ITEM_APPLE = 108;
  const ITEMS = {
    [ITEM_PLANK]: { name: 'Plank' },
    [ITEM_STICK]: { name: 'Stick' },
    [ITEM_APPLE]: { name: 'Apple' },
  };

  // ── Recipes ──────────────────────────────────────────────────────────────
  // shape: array of strings (rows), 1-3 rows × 1-3 chars; ' ' = empty
  // key: char -> ['block'|'item'|'tool', id]
  // out: ['block'|'item'|'tool', id, count]
  // shapeless: array of [kind, id, count?] — order doesn't matter, no shape constraint
  const RECIPES = [
    { shapeless:[['block', WOOD, 1]],       out:['item', ITEM_PLANK, 4] },
    { shape:['p','p'], key:{ p:['item', ITEM_PLANK] }, out:['item', ITEM_STICK, 4] },
    { shape:['pp','pp'],
      key:{ p:['item', ITEM_PLANK] },
      out:['block', CRAFTING_TABLE, 1] },
    // Pickaxes (3-wide top row)
    { shape:['ppp',' s ',' s '], key:{ p:['item',ITEM_PLANK],  s:['item',ITEM_STICK] }, out:['tool', ITEM_WOOD_PICK, 1] },
    { shape:['ppp',' s ',' s '], key:{ p:['block',STONE],      s:['item',ITEM_STICK] }, out:['tool', ITEM_STONE_PICK, 1] },
    { shape:['ppp',' s ',' s '], key:{ p:['block',IRON_ORE],   s:['item',ITEM_STICK] }, out:['tool', ITEM_IRON_PICK, 1] },
    { shape:['ppp',' s ',' s '], key:{ p:['block',DIAMOND_ORE],s:['item',ITEM_STICK] }, out:['tool', ITEM_DIAMOND_PICK, 1] },
    // Axes
    { shape:['pp','ps',' s'],    key:{ p:['item',ITEM_PLANK],  s:['item',ITEM_STICK] }, out:['tool', ITEM_WOOD_AXE, 1] },
    { shape:['pp','ps',' s'],    key:{ p:['block',STONE],      s:['item',ITEM_STICK] }, out:['tool', ITEM_STONE_AXE, 1] },
    { shape:['pp','ps',' s'],    key:{ p:['block',IRON_ORE],   s:['item',ITEM_STICK] }, out:['tool', ITEM_IRON_AXE, 1] },
    { shape:['pp','ps',' s'],    key:{ p:['block',DIAMOND_ORE],s:['item',ITEM_STICK] }, out:['tool', ITEM_DIAMOND_AXE, 1] },
    // Shovels
    { shape:['p','s','s'],       key:{ p:['item',ITEM_PLANK],  s:['item',ITEM_STICK] }, out:['tool', ITEM_WOOD_SHOVEL, 1] },
    { shape:['p','s','s'],       key:{ p:['block',STONE],      s:['item',ITEM_STICK] }, out:['tool', ITEM_STONE_SHOVEL, 1] },
    { shape:['p','s','s'],       key:{ p:['block',IRON_ORE],   s:['item',ITEM_STICK] }, out:['tool', ITEM_IRON_SHOVEL, 1] },
    // Swords
    { shape:['p','p','s'],       key:{ p:['item',ITEM_PLANK],  s:['item',ITEM_STICK] }, out:['tool', ITEM_WOOD_SWORD, 1] },
    { shape:['p','p','s'],       key:{ p:['block',STONE],      s:['item',ITEM_STICK] }, out:['tool', ITEM_STONE_SWORD, 1] },
    { shape:['p','p','s'],       key:{ p:['block',IRON_ORE],   s:['item',ITEM_STICK] }, out:['tool', ITEM_IRON_SWORD, 1] },
    { shape:['p','p','s'],       key:{ p:['block',DIAMOND_ORE],s:['item',ITEM_STICK] }, out:['tool', ITEM_DIAMOND_SWORD, 1] },
  ];

  const BLOCK_TOOL = {
    [SAND]:'shovel', [DIRT]:'shovel', [GRASS]:'shovel', [SNOW]:'shovel',
    [WOOD]:'axe',    [LEAVES]:'sword', [CRAFTING_TABLE]:'axe',
    [STONE]:'pickaxe', [COAL_ORE]:'pickaxe', [IRON_ORE]:'pickaxe',
    [COPPER_ORE]:'pickaxe', [GOLD_ORE]:'pickaxe',
    [DIAMOND_ORE]:'pickaxe', [REDSTONE_ORE]:'pickaxe',
  };
  const BLOCK_MIN_TIER = {
    [STONE]:1, [COAL_ORE]:1,
    [IRON_ORE]:2, [COPPER_ORE]:2,
    [GOLD_ORE]:3, [DIAMOND_ORE]:3, [REDSTONE_ORE]:3,
  };
  const BLOCK_HARDNESS = {
    [SAND]: 0.5, [GRASS]: 0.6, [DIRT]: 0.5, [SNOW]: 0.1,
    [WOOD]: 0.9, [LEAVES]: 0.2, [STONE]: 1.5, [CRAFTING_TABLE]: 1.5,
    [COAL_ORE]: 3.0, [IRON_ORE]: 3.0, [COPPER_ORE]: 3.0,
    [GOLD_ORE]: 3.0, [REDSTONE_ORE]: 3.0, [DIAMOND_ORE]: 3.0,
    [BEDROCK]: Infinity,
  };
  const TIER_SPEED = [1, 2, 4, 6, 8];
  const TOOL_MAX_DUR = {
    [ITEM_WOOD_PICK]:60,    [ITEM_STONE_PICK]:132,   [ITEM_IRON_PICK]:251,   [ITEM_DIAMOND_PICK]:1562,
    [ITEM_WOOD_AXE]:60,     [ITEM_STONE_AXE]:132,    [ITEM_IRON_AXE]:251,    [ITEM_DIAMOND_AXE]:1562,
    [ITEM_WOOD_SHOVEL]:60,  [ITEM_STONE_SHOVEL]:132,  [ITEM_IRON_SHOVEL]:251,
    [ITEM_WOOD_SWORD]:60,   [ITEM_STONE_SWORD]:132,   [ITEM_IRON_SWORD]:251,  [ITEM_DIAMOND_SWORD]:1562,
  };

  function getSelectedTool() {
    const slot = inventory[hotbarSlot];
    return (slot && slot.kind === 'tool') ? slot.id : null;
  }
  function canHarvest(block, itemId) {
    const minTier = BLOCK_MIN_TIER[block] || 0;
    if (minTier === 0) return true;
    const t = itemId != null ? TOOLS[itemId] : null;
    return !!(t && t.kind === BLOCK_TOOL[block] && t.tier >= minTier);
  }
  function getMineTime(block, itemId) {
    const hardness = BLOCK_HARDNESS[block];
    if (hardness === undefined || hardness === Infinity) return Infinity;
    const t = itemId != null ? TOOLS[itemId] : null;
    let speedMultiplier = 1;
    if (t && t.kind === BLOCK_TOOL[block]) speedMultiplier = TIER_SPEED[t.tier];
    if (inWater()) speedMultiplier *= 0.5;
    let damage = speedMultiplier / hardness;
    damage /= canHarvest(block, itemId) ? 30 : 100;
    if (damage >= 1) return 0;
    return Math.ceil(1 / damage) / 20;
  }

  // ── Physics ──────────────────────────────────────────────────────────────
  const WALK = 4.5, SPRINT = 6.5, JUMP_VEL = 8.2, GRAVITY = -28, MAX_FALL = 60;
  const PW = 0.3, PH = 1.8, EYE = 1.6, REACH = 5.5;

  // ── State ────────────────────────────────────────────────────────────────
  let myId='', myName='Player', myColor=0xe74c3c;
  let others = {};
  let channel=null, isHost=false, roomCode='', worldSeed=1;
  let hotbarSlot=0, running=false;
  const player = { pos: new THREE.Vector3(0,0,0), vy:0, grounded:false, yaw:0, pitch:0 };
  const inputKeys = { fwd:false, back:false, left:false, right:false, jump:false, sprint:false };

  const HOTBAR_SIZE = 9;
  const INV_SIZE = 36;
  const inventory = Array(INV_SIZE).fill(null);
  const blockThumbs = {};
  const itemThumbs = {};

  // Chunks: Map<"cx,cz", Uint8Array(16*WY*16)>
  const chunks = new Map();
  // Per-chunk meshes: Map<"cx,cz", { meshes: {id: InstancedMesh}, dirty: bool }>
  const chunkMeshes = new Map();
  // Edits diff so newly-generated chunks pick them up & joiners receive them
  // Map<"x,y,z", value>
  const edits = new Map();
  let lastChunkX = null, lastChunkZ = null;

  const ckey = (cx,cz) => cx + ',' + cz;
  const ek   = (x,y,z) => x + ',' + y + ',' + z;

  // ── Three.js ─────────────────────────────────────────────────────────────
  const canvas = document.getElementById('mcCanvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x88c5ff);
  scene.fog = new THREE.Fog(0x88c5ff, 100, 240);

  const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 800);
  scene.add(camera);

  const ambientLight = new THREE.AmbientLight(0xd8eaff, 1.1);
  scene.add(ambientLight);
  const sun = new THREE.DirectionalLight(0xfff5e0, 1.0);
  sun.position.set(60, 100, 40);
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

  // ctTex is built from the 3rd panel of the sprite sheet (loaded below via ctImg)

  function makeBlockGeo(id) {
    const g = new THREE.BoxGeometry(1, 1, 1);
    const uvs = g.attributes.uv.array;
    const vMax = (ATLAS_LAYERS - id) / ATLAS_LAYERS;
    const vMin = vMax - 1 / ATLAS_LAYERS;
    const uRanges = [
      [1/3, 2/3], [1/3, 2/3],
      [2/3, 1  ], [0,   1/3],
      [1/3, 2/3], [1/3, 2/3],
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
  for (const id of ATLAS_BLOCKS) blockGeos[id] = makeBlockGeo(id);
  blockGeos[BEDROCK] = blockGeos[STONE];
  blockGeos[WATER]   = new THREE.BoxGeometry(1, 1, 1);
  // Crafting table: custom UVs so each face uses the correct 1/3 strip of the sprite sheet.
  // Strip order in the 384×128 PNG: 0=side, 1=front, 2=top(3×3 grid).
  // BoxGeometry face order: +X, -X, +Y(top), -Y(bot), +Z(front), -Z(back)
  blockGeos[CRAFTING_TABLE] = (() => {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const uv = geo.attributes.uv;
    const strips = [0, 0, 2, 0, 1, 0]; // panel index per face
    for (let face = 0; face < 6; face++) {
      const u0 = strips[face] / 3, u1 = u0 + 1 / 3;
      for (let j = 0; j < 4; j++) {
        const i = face * 4 + j;
        uv.setX(i, u0 + uv.getX(i) * (u1 - u0));
      }
    }
    uv.needsUpdate = true;
    return geo;
  })();
  for (const id of ORES) blockGeos[id] = new THREE.BoxGeometry(1, 1, 1);

  const blockMaterial = new THREE.MeshLambertMaterial({ map: atlasTex });
  const waterMaterial = new THREE.MeshLambertMaterial({
    map: waterTex, color: 0x99ccff, transparent: true, opacity: 0.78, depthWrite: false,
    side: THREE.DoubleSide,
  });
  let craftingTableMat = new THREE.MeshLambertMaterial({ color: 0x8b6340 }); // replaced by array once sprite loads

  // Ore textures
  const oreMaterials = {};
  const oreTileIndex = {
    [COAL_ORE]: 0, [IRON_ORE]: 1, [GOLD_ORE]: 2, [DIAMOND_ORE]: 3,
    [REDSTONE_ORE]: 5, [COPPER_ORE]: 7,
  };
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
      const tc = document.createElement('canvas');
      tc.width = tc.height = 32;
      const tcx = tc.getContext('2d');
      tcx.imageSmoothingEnabled = false;
      tcx.drawImage(oreImg, col*tileW, row*tileH, tileW, tileH, 0, 0, 32, 32);
      blockThumbs[id] = tc.toDataURL();
    }
    if (running) { markAllChunksDirty(); updateHotbarUI(); }
  };
  oreImg.src = 'assets/tex_array_1.png';

  // Crafting-table texture + thumbnail (sprite sheet: 3 panels wide)
  // Panel 0 = side, panel 1 = front/side, panel 2 = top (3x3 grid)
  const ctImg = new Image();
  ctImg.onload = () => {
    const tex = new THREE.Texture(ctImg);
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace; tex.needsUpdate = true;
    craftingTableMat = new THREE.MeshLambertMaterial({ map: tex });
    // Thumbnail: use top face (right third of sprite)
    const pw = Math.floor(ctImg.width / 3);
    const tc = document.createElement('canvas'); tc.width = tc.height = 32;
    const tcx = tc.getContext('2d'); tcx.imageSmoothingEnabled = false;
    tcx.drawImage(ctImg, pw * 2, 0, pw, ctImg.height, 0, 0, 32, 32);
    blockThumbs[CRAFTING_TABLE] = tc.toDataURL();
    if (running) markAllChunksDirty();
    updateHotbarUI();
  };
  ctImg.src = 'assets/crafting_table.png';

  // Crack textures
  const crackTextures = [];
  for (let i = 0; i < 10; i++) {
    const t = new THREE.TextureLoader().load(`assets/crack_${i}.png`);
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false; crackTextures.push(t);
  }
  const crackMat = new THREE.MeshBasicMaterial({
    transparent: true, opacity: 0.95, depthWrite: false, polygonOffset: true,
    polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const crackMesh = new THREE.Mesh(new THREE.BoxGeometry(1.001, 1.001, 1.001), crackMat);
  crackMesh.visible = false; crackMesh.frustumCulled = false;
  scene.add(crackMesh);

  const selectGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.005, 1.005, 1.005));
  const selectMat = new THREE.LineBasicMaterial({ color: 0x000000 });
  const selectMesh = new THREE.LineSegments(selectGeo, selectMat);
  selectMesh.visible = false; selectMesh.frustumCulled = false;
  scene.add(selectMesh);

  const hand = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.55, 0.18),
    new THREE.MeshLambertMaterial({ color: 0xf5c896 })
  );
  hand.position.set(0.42, -0.45, -0.65);
  hand.rotation.x = -0.35;
  camera.add(hand);
  let armSwing = 0;

  // ── Third-person player mesh ─────────────────────────────────────────────
  let thirdPerson = false;
  const playerMeshGroup = new THREE.Group();
  const _pmBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 1.2, 0.4),
    new THREE.MeshLambertMaterial({ color: 0x3f51b5 })
  );
  _pmBody.position.y = 0.6;
  playerMeshGroup.add(_pmBody);
  const _pmHead = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.5, 0.5),
    new THREE.MeshLambertMaterial({ color: 0xffd6a8 })
  );
  _pmHead.position.y = 1.45;
  playerMeshGroup.add(_pmHead);
  playerMeshGroup.visible = false;
  scene.add(playerMeshGroup);

  // Apply steve skin to player mesh faces
  (function() {
    const img = new Image();
    img.onload = () => {
      const S = img.width / 64;
      function faceMat(sx, sy, sw, sh) {
        const c = document.createElement('canvas'); c.width = sw; c.height = sh;
        const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, sx*S, sy*S, sw*S, sh*S, 0, 0, sw, sh);
        const t = new THREE.CanvasTexture(c);
        t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
        return new THREE.MeshLambertMaterial({ map: t });
      }
      // Three.js face order: +X, -X, +Y, -Y, +Z (back), -Z (front)
      _pmHead.material = [
        faceMat(16,8,8,8), faceMat(0,8,8,8),
        faceMat(8,0,8,8),  faceMat(16,0,8,8),
        faceMat(24,8,8,8), faceMat(8,8,8,8),
      ];
      _pmBody.material = [
        faceMat(28,20,4,12), faceMat(16,20,4,12),
        faceMat(20,16,8,4),  faceMat(28,16,8,4),
        faceMat(32,20,8,12), faceMat(20,20,8,12),
      ];
    };
    img.src = 'assets/steve.png';
  })();

  // ── Chunk world helpers ──────────────────────────────────────────────────
  const chunkLocal = (n) => ((n % CHUNK_W) + CHUNK_W) % CHUNK_W;

  function getB(x, y, z) {
    if (y < 0) return BEDROCK;
    if (y >= WY) return AIR;
    const cx = Math.floor(x / CHUNK_W), cz = Math.floor(z / CHUNK_W);
    const ch = chunks.get(ckey(cx, cz));
    if (!ch) return AIR;
    const lx = chunkLocal(x), lz = chunkLocal(z);
    return ch[(y * CHUNK_W + lz) * CHUNK_W + lx];
  }
  function setBLocalOnly(x, y, z, v) {
    if (y < 0 || y >= WY) return false;
    const cx = Math.floor(x / CHUNK_W), cz = Math.floor(z / CHUNK_W);
    const ch = chunks.get(ckey(cx, cz));
    if (!ch) return false;
    const lx = chunkLocal(x), lz = chunkLocal(z);
    ch[(y * CHUNK_W + lz) * CHUNK_W + lx] = v;
    markChunkDirty(cx, cz);
    if (lx === 0)            markChunkDirty(cx-1, cz);
    if (lx === CHUNK_W - 1)  markChunkDirty(cx+1, cz);
    if (lz === 0)            markChunkDirty(cx, cz-1);
    if (lz === CHUNK_W - 1)  markChunkDirty(cx, cz+1);
    return true;
  }
  // Authoritative set: applies edit and records it for joiners + future chunks
  function setB(x, y, z, v) {
    edits.set(ek(x, y, z), v);
    setBLocalOnly(x, y, z, v);
  }
  const isSolidAt = (x,y,z) => SOLID.has(getB(x,y,z));

  function isFaceVisible(id, x, y, z) {
    const isWater = id === WATER;
    const ok = b => isWater ? (b === AIR) : (b === AIR || b === WATER);
    return ok(getB(x-1,y,z)) || ok(getB(x+1,y,z))
        || ok(getB(x,y-1,z)) || ok(getB(x,y+1,z))
        || ok(getB(x,y,z-1)) || ok(getB(x,y,z+1));
  }

  // ── Deterministic noise (seeded) ─────────────────────────────────────────
  function hash2(a, b, salt) {
    let n = ((a|0) * 374761393) ^ ((b|0) * 668265263) ^ (salt|0) * 2147483647;
    n = (n ^ (n>>13)) * 1274126177 | 0;
    return ((n ^ (n>>16)) >>> 0) / 0xffffffff;
  }
  function noise2(x, z, freq, salt) {
    const xi = Math.floor(x*freq), zi = Math.floor(z*freq);
    const xf = x*freq - xi, zf = z*freq - zi;
    const u = xf*xf*(3-2*xf), v = zf*zf*(3-2*zf);
    return ((hash2(xi,zi,salt)*(1-u) + hash2(xi+1,zi,salt)*u) * (1-v)
          + (hash2(xi,zi+1,salt)*(1-u) + hash2(xi+1,zi+1,salt)*u) * v);
  }
  function hash3(a, b, c, salt) {
    let n = ((a|0)*374761393) ^ ((b|0)*668265263) ^ ((c|0)*1440009) ^ (salt|0);
    n = (n ^ (n>>13)) * 1274126177 | 0;
    return ((n ^ (n>>16)) >>> 0) / 0xffffffff;
  }
  function noise3(x, y, z, freq, salt) {
    const xi=Math.floor(x*freq),yi=Math.floor(y*freq),zi=Math.floor(z*freq);
    const xf=x*freq-xi, yf=y*freq-yi, zf=z*freq-zi;
    const ux=xf*xf*(3-2*xf), uy=yf*yf*(3-2*yf), uz=zf*zf*(3-2*zf);
    return (hash3(xi,  yi,  zi,  salt)*(1-ux)+hash3(xi+1,yi,  zi,  salt)*ux)*(1-uy)*(1-uz)
         + (hash3(xi,  yi+1,zi,  salt)*(1-ux)+hash3(xi+1,yi+1,zi,  salt)*ux)*   uy *(1-uz)
         + (hash3(xi,  yi,  zi+1,salt)*(1-ux)+hash3(xi+1,yi,  zi+1,salt)*ux)*(1-uy)*   uz
         + (hash3(xi,  yi+1,zi+1,salt)*(1-ux)+hash3(xi+1,yi+1,zi+1,salt)*ux)*   uy *   uz;
  }
  // ── Biomes ───────────────────────────────────────────────────────────────
  const BIOMES = {
    forest:   { baseH:20, mtnAmp:36, hillAmp:16, detAmp:5, surf:GRASS, snowH:54, treeRate:0.040 },
    plains:   { baseH:18, mtnAmp:12, hillAmp:6,  detAmp:3, surf:GRASS, snowH:54, treeRate:0.005 },
    savanna:  { baseH:19, mtnAmp:20, hillAmp:10, detAmp:4, surf:GRASS, snowH:999,treeRate:0.50  },
    desert:   { baseH:17, mtnAmp:18, hillAmp:8,  detAmp:4, surf:SAND,  snowH:999,treeRate:0     },
    cold:     { baseH:17, mtnAmp:16, hillAmp:6,  detAmp:3, surf:SNOW,  snowH:10, treeRate:0.005 },
    mountain: { baseH:32, mtnAmp:56, hillAmp:18, detAmp:6, surf:STONE, snowH:48, treeRate:0.009 },
  };
  function getBiome(wx, wz) {
    const temp  = noise2(wx, wz, 0.006, worldSeed ^ 0xbabe1);
    const rough = noise2(wx, wz, 0.007, worldSeed ^ 0xdead3);
    const moist = noise2(wx, wz, 0.006, worldSeed ^ 0xcafe2);
    if (rough > 0.72) return 'mountain';
    if (temp > 0.68 && moist < 0.38) return 'desert';
    if (temp > 0.58) return 'savanna';
    if (temp < 0.15) return 'cold';
    if (moist < 0.38) return 'plains';
    return 'forest';
  }
  function heightAt(wx, wz, biome) {
    const b = BIOMES[biome];
    let h = b.baseH;
    h += (noise2(wx, wz, 0.012, worldSeed)       - 0.35) * b.mtnAmp;
    h += noise2(wx, wz, 0.045, worldSeed^0x9e37) * b.hillAmp;
    h += noise2(wx, wz, 0.18,  worldSeed^0x12af) * b.detAmp;
    return Math.max(2, Math.min(WY - 4, Math.floor(h)));
  }

  // ── Leaf decay ───────────────────────────────────────────────────────────
  const playerPlaced   = new Set(); // "x,y,z" keys of player-placed blocks
  const decayScheduled = new Set();
  const decayQueue     = []; // {x,y,z,at}

  function leafCanReachWood(sx, sy, sz) {
    const visited = new Set();
    const queue = [[sx, sy, sz, 0]];
    while (queue.length) {
      const [x, y, z, d] = queue.shift();
      const k = ek(x,y,z);
      if (visited.has(k)) continue;
      visited.add(k);
      const b = getB(x,y,z);
      if (b === WOOD) return true;
      if (b !== LEAVES || d >= 7) continue;
      queue.push([x+1,y,z,d+1],[x-1,y,z,d+1],[x,y+1,z,d+1],
                 [x,y-1,z,d+1],[x,y,z+1,d+1],[x,y,z-1,d+1]);
    }
    return false;
  }
  function queueLeafDecay(bx, by, bz) {
    const R = 7;
    for (let dy=-R; dy<=R; dy++) for (let dx=-R; dx<=R; dx++) for (let dz=-R; dz<=R; dz++) {
      const x=bx+dx, y=by+dy, z=bz+dz;
      const k = ek(x,y,z);
      if (decayScheduled.has(k) || playerPlaced.has(k)) continue;
      if (getB(x,y,z) !== LEAVES) continue;
      if (!leafCanReachWood(x,y,z)) {
        decayScheduled.add(k);
        // Stagger decay: 4-6 minutes
        decayQueue.push({ x, y, z, at: Date.now() + (240 + Math.random()*120) * 1000 });
      }
    }
  }
  function processLeafDecay() {
    const now = Date.now();
    for (let i = decayQueue.length - 1; i >= 0; i--) {
      const d = decayQueue[i];
      if (now < d.at) continue;
      decayScheduled.delete(ek(d.x,d.y,d.z));
      decayQueue.splice(i, 1);
      if (getB(d.x,d.y,d.z) === LEAVES && !playerPlaced.has(ek(d.x,d.y,d.z))) {
        setB(d.x, d.y, d.z, AIR);
        bcast('block', { x:d.x, y:d.y, z:d.z, v:AIR });
        afterBlockRemoved(d.x, d.y, d.z);
      }
    }
  }

  // ── Generate one chunk ───────────────────────────────────────────────────
  function generateChunk(cx, cz) {
    const buf = new Uint8Array(CHUNK_W * WY * CHUNK_W);
    const set = (lx, y, lz, v) => { buf[(y * CHUNK_W + lz) * CHUNK_W + lx] = v; };
    // Sample biome at chunk centre for consistent surface rules
    const biome = getBiome(cx * CHUNK_W + CHUNK_W/2, cz * CHUNK_W + CHUNK_W/2);
    const bp = BIOMES[biome];

    const heights = new Int32Array(CHUNK_W * CHUNK_W);
    const biomes  = new Array(CHUNK_W * CHUNK_W);
    for (let lz = 0; lz < CHUNK_W; lz++) {
      for (let lx = 0; lx < CHUNK_W; lx++) {
        const wx = cx * CHUNK_W + lx, wz = cz * CHUNK_W + lz;
        const col_biome = getBiome(wx, wz);
        const col_bp = BIOMES[col_biome];
        const h = heightAt(wx, wz, col_biome);
        heights[lz * CHUNK_W + lx] = h;
        biomes[lz * CHUNK_W + lx]  = col_biome;
        for (let y = 0; y < h; y++) {
          if (y === 0) set(lx, y, lz, BEDROCK);
          else if (y < h - 4) set(lx, y, lz, STONE);
          else set(lx, y, lz, DIRT);
        }
        const surf = h - 1;
        if (surf >= col_bp.snowH)          set(lx, surf, lz, SNOW);
        else if (surf <= SEA_LEVEL + 1)    set(lx, surf, lz, SAND);
        else                               set(lx, surf, lz, col_bp.surf);
        for (let y = h; y <= SEA_LEVEL; y++) set(lx, y, lz, WATER);
      }
    }

    // Cave carving: two independent 3D noise fields; carve where both pass near 0.5
    for (let lz = 0; lz < CHUNK_W; lz++) {
      for (let lx = 0; lx < CHUNK_W; lx++) {
        const wx = cx * CHUNK_W + lx, wz = cz * CHUNK_W + lz;
        const h = heights[lz * CHUNK_W + lx];
        for (let y = 2; y < h - 4; y++) {
          const n1 = noise3(wx, y, wz, 0.04, worldSeed ^ 0xc0ffee);
          const n2 = noise3(wx, y, wz, 0.04, worldSeed ^ 0xdeadbe);
          if (Math.abs(n1 - 0.5) < 0.09 && Math.abs(n2 - 0.5) < 0.09)
            buf[(y * CHUNK_W + lz) * CHUNK_W + lx] = AIR;
          // Extra large caverns at lower depths
          const n3 = noise3(wx, y, wz, 0.025, worldSeed ^ 0xf00d);
          if (y < h * 0.55 && n3 > 0.78)
            buf[(y * CHUNK_W + lz) * CHUNK_W + lx] = AIR;
        }
      }
    }

    // Trees (deterministic per chunk via salted RNG)
    let s = (cx * 73856093) ^ (cz * 19349663) ^ worldSeed;
    const rng = () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 0) / 0xffffffff); };
    for (let lz = 2; lz < CHUNK_W - 2; lz++) {
      for (let lx = 2; lx < CHUNK_W - 2; lx++) {
        const h = heights[lz * CHUNK_W + lx];
        const surf = h - 1;
        const col_bp = BIOMES[biomes[lz * CHUNK_W + lx]];
        if (buf[(surf * CHUNK_W + lz) * CHUNK_W + lx] !== GRASS) continue;
        if (rng() > col_bp.treeRate) continue;
        const th = 4 + Math.floor(rng() * 2);
        for (let dy = 0; dy < th; dy++) if (h + dy < WY) set(lx, h + dy, lz, WOOD);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -2; dx <= 2; dx++) for (let dzz = -2; dzz <= 2; dzz++) {
          const yy = h + th - 1 + dy;
          const lxx = lx + dx, lzz = lz + dzz;
          if (lxx < 0 || lxx >= CHUNK_W || lzz < 0 || lzz >= CHUNK_W) continue;
          if (yy < 0 || yy >= WY) continue;
          if (Math.abs(dx) + Math.abs(dzz) + Math.abs(dy) > 4) continue;
          if (buf[(yy * CHUNK_W + lzz) * CHUNK_W + lxx] === AIR) set(lxx, yy, lzz, LEAVES);
        }
        if (h + th < WY) set(lx, h + th, lz, LEAVES);
      }
    }

    // Ore veins
    const oreSpec = [
      { id: COAL_ORE,     minY: 4,  maxY: 36, count: 32, vein: 8 },
      { id: COPPER_ORE,   minY: 4,  maxY: 32, count: 18, vein: 7 },
      { id: IRON_ORE,     minY: 3,  maxY: 28, count: 24, vein: 7 },
      { id: GOLD_ORE,     minY: 2,  maxY: 16, count: 10, vein: 6 },
      { id: REDSTONE_ORE, minY: 2,  maxY: 14, count: 10, vein: 6 },
      { id: DIAMOND_ORE,  minY: 2,  maxY: 10, count:  6, vein: 5 },
    ];
    for (const spec of oreSpec) {
      for (let i = 0; i < spec.count; i++) {
        let lx = Math.floor(rng() * CHUNK_W);
        let y  = spec.minY + Math.floor(rng() * (spec.maxY - spec.minY + 1));
        let lz = Math.floor(rng() * CHUNK_W);
        for (let v = 0; v < spec.vein; v++) {
          if (lx >= 0 && lx < CHUNK_W && lz >= 0 && lz < CHUNK_W && y > 0 && y < WY) {
            if (buf[(y * CHUNK_W + lz) * CHUNK_W + lx] === STONE)
              set(lx, y, lz, spec.id);
          }
          const dir = Math.floor(rng() * 6);
          if      (dir === 0) lx--;
          else if (dir === 1) lx++;
          else if (dir === 2) y--;
          else if (dir === 3) y++;
          else if (dir === 4) lz--;
          else                lz++;
        }
      }
    }

    // Apply any edits within this chunk
    for (const [k, v] of edits) {
      const [ex, ey, ez] = k.split(',').map(Number);
      const ecx = Math.floor(ex / CHUNK_W), ecz = Math.floor(ez / CHUNK_W);
      if (ecx !== cx || ecz !== cz) continue;
      if (ey < 0 || ey >= WY) continue;
      const lx = chunkLocal(ex), lz = chunkLocal(ez);
      buf[(ey * CHUNK_W + lz) * CHUNK_W + lx] = v;
    }

    return buf;
  }

  // ── Per-chunk meshing ────────────────────────────────────────────────────
  function markChunkDirty(cx, cz) {
    const k = ckey(cx, cz);
    const m = chunkMeshes.get(k);
    if (m) m.dirty = true;
  }
  function markAllChunksDirty() {
    for (const m of chunkMeshes.values()) m.dirty = true;
  }
  function disposeChunkMeshes(cx, cz) {
    const k = ckey(cx, cz);
    const m = chunkMeshes.get(k);
    if (!m) return;
    for (const mesh of Object.values(m.meshes)) {
      scene.remove(mesh);
      mesh.dispose();
    }
    chunkMeshes.delete(k);
  }
  function buildChunkMesh(cx, cz) {
    const k = ckey(cx, cz);
    const ch = chunks.get(k);
    if (!ch) return;
    let entry = chunkMeshes.get(k);
    if (entry) {
      for (const mesh of Object.values(entry.meshes)) { scene.remove(mesh); mesh.dispose(); }
    }
    entry = { meshes: {}, dirty: false };
    chunkMeshes.set(k, entry);

    const counts = {};
    const x0 = cx * CHUNK_W, z0 = cz * CHUNK_W;
    for (let y = 0; y < WY; y++) for (let lz = 0; lz < CHUNK_W; lz++) for (let lx = 0; lx < CHUNK_W; lx++) {
      const b = ch[(y * CHUNK_W + lz) * CHUNK_W + lx];
      if (b === AIR) continue;
      if (!isFaceVisible(b, x0 + lx, y, z0 + lz)) continue;
      counts[b] = (counts[b] || 0) + 1;
    }

    const dummy = new THREE.Object3D();
    for (const idStr of Object.keys(counts)) {
      const id = +idStr;
      const geo = blockGeos[id] || blockGeos[STONE];
      const mat = (id === WATER)          ? waterMaterial
                : (id === CRAFTING_TABLE) ? craftingTableMat
                : (oreMaterials[id])      ? oreMaterials[id]
                                          : blockMaterial;
      const mesh = new THREE.InstancedMesh(geo, mat, counts[id]);
      let i = 0;
      for (let y = 0; y < WY; y++) for (let lz = 0; lz < CHUNK_W; lz++) for (let lx = 0; lx < CHUNK_W; lx++) {
        if (ch[(y * CHUNK_W + lz) * CHUNK_W + lx] !== id) continue;
        if (!isFaceVisible(id, x0 + lx, y, z0 + lz)) continue;
        dummy.position.set(x0 + lx + 0.5, y + 0.5, z0 + lz + 0.5);
        dummy.updateMatrix();
        mesh.setMatrixAt(i++, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.frustumCulled = false;
      if (id === WATER) mesh.renderOrder = 2;
      scene.add(mesh);
      entry.meshes[id] = mesh;
    }
  }

  function updateChunks() {
    const pcx = Math.floor(player.pos.x / CHUNK_W);
    const pcz = Math.floor(player.pos.z / CHUNK_W);
    if (pcx === lastChunkX && pcz === lastChunkZ) return;
    lastChunkX = pcx; lastChunkZ = pcz;

    // Pre-generate data for GEN_DIST radius (includes one ring beyond visible meshes
    // so edge-face culling works correctly and there's no seam at the fog boundary)
    for (let dz = -GEN_DIST; dz <= GEN_DIST; dz++) {
      for (let dx = -GEN_DIST; dx <= GEN_DIST; dx++) {
        const cx = pcx + dx, cz = pcz + dz;
        const k = ckey(cx, cz);
        if (!chunks.has(k)) {
          chunks.set(k, generateChunk(cx, cz));
          // Only register a mesh entry if within visible range
          if (Math.abs(dx) <= MESH_DIST && Math.abs(dz) <= MESH_DIST) {
            chunkMeshes.set(k, { meshes:{}, dirty:true });
          }
          // Generating this chunk may expose new faces on neighbours that have meshes
          markChunkDirty(cx-1, cz); markChunkDirty(cx+1, cz);
          markChunkDirty(cx, cz-1); markChunkDirty(cx, cz+1);
        } else if (Math.abs(dx) <= MESH_DIST && Math.abs(dz) <= MESH_DIST
                   && !chunkMeshes.has(k)) {
          // Chunk data existed but no mesh yet (was in outer ring before)
          chunkMeshes.set(k, { meshes:{}, dirty:true });
        }
      }
    }

    // Unload chunks that are too far away
    for (const k of [...chunks.keys()]) {
      const [cx, cz] = k.split(',').map(Number);
      if (Math.abs(cx - pcx) > GEN_DIST + 1 || Math.abs(cz - pcz) > GEN_DIST + 1) {
        disposeChunkMeshes(cx, cz);
        chunks.delete(k);
      }
    }
    // Remove mesh entries for chunks that drifted outside MESH_DIST
    for (const k of [...chunkMeshes.keys()]) {
      const [cx, cz] = k.split(',').map(Number);
      if (Math.abs(cx - pcx) > MESH_DIST || Math.abs(cz - pcz) > MESH_DIST) {
        disposeChunkMeshes(cx, cz);
      }
    }
  }

  function processDirtyChunks(maxPerFrame = 3) {
    let n = 0;
    for (const [k, entry] of chunkMeshes) {
      if (!entry.dirty) continue;
      const [cx, cz] = k.split(',').map(Number);
      buildChunkMesh(cx, cz);
      if (++n >= maxPerFrame) return;
    }
  }

  // ── Spawn search ─────────────────────────────────────────────────────────
  function findSpawn() {
    // Search outward from origin — prefer grass/dirt surface, skip snow/stone/water
    const warmSurf = new Set([GRASS, DIRT, SAND]);
    for (let r = 0; r < CHUNK_W * (MESH_DIST + 1); r++) {
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const x = dx, z = dz;
        const cx = Math.floor(x / CHUNK_W), cz = Math.floor(z / CHUNK_W);
        if (!chunks.has(ckey(cx, cz))) continue;
        for (let y = WY - 3; y > 0; y--) {
          const surf = getB(x, y, z);
          if (isSolidAt(x, y, z) && getB(x, y+1, z) === AIR && getB(x, y+2, z) === AIR
              && warmSurf.has(surf)) {
            return new THREE.Vector3(x + 0.5, y + 1, z + 0.5);
          }
        }
      }
    }
    return new THREE.Vector3(0.5, WY/2, 0.5);
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
      player.vy = JUMP_VEL; player.grounded = false;
    } else if (inputKeys.jump && inWaterNow) {
      player.vy = Math.max(player.vy, 4.0); player.grounded = false;
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

    if (thirdPerson) {
      const sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
      camera.position.set(player.pos.x + sy * 4, player.pos.y + EYE + 2, player.pos.z + cy * 4);
      camera.lookAt(player.pos.x, player.pos.y + 1.0, player.pos.z);
      hand.visible = false;
      playerMeshGroup.position.set(player.pos.x, player.pos.y, player.pos.z);
      playerMeshGroup.rotation.y = -player.yaw;
      playerMeshGroup.visible = true;
    } else {
      camera.position.set(player.pos.x, player.pos.y + EYE, player.pos.z);
      camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
      hand.visible = true;
      playerMeshGroup.visible = false;
    }
  }

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

  // ── Physics events: water flow + sand gravity ────────────────────────────
  function triggerFlow(x, y, z) {
    // (x,y,z) just became AIR — find adjacent WATER and spread from it
    const sources = [];
    for (const [dx,dy,dz] of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]) {
      if (getB(x+dx,y+dy,z+dz) === WATER) sources.push([x+dx,y+dy,z+dz,0]);
    }
    if (!sources.length) return;
    const visited = new Set();
    for (const [sx,sy,sz] of sources) visited.add(ek(sx,sy,sz));
    const queue = [...sources];
    while (queue.length) {
      const [wx,wy,wz,hops] = queue.shift();
      const bkDown = ek(wx,wy-1,wz);
      if (wy > 0 && !visited.has(bkDown) && getB(wx,wy-1,wz) === AIR) {
        visited.add(bkDown);
        setB(wx,wy-1,wz,WATER); bcast('block',{x:wx,y:wy-1,z:wz,v:WATER});
        queue.push([wx,wy-1,wz,0]);
      }
      if (hops < 7) {
        for (const [dx,dz] of [[-1,0],[1,0],[0,-1],[0,1]]) {
          const nx=wx+dx, nz=wz+dz, bk=ek(nx,wy,nz);
          if (!visited.has(bk) && getB(nx,wy,nz) === AIR) {
            visited.add(bk);
            setB(nx,wy,nz,WATER); bcast('block',{x:nx,y:wy,z:nz,v:WATER});
            queue.push([nx,wy,nz,hops+1]);
          }
        }
      }
    }
  }

  function afterBlockRemoved(x, y, z) {
    // Sand gravity: cascade sand fall upward from cleared block
    let clearY = y;
    while (clearY + 1 < WY && getB(x, clearY+1, z) === SAND) {
      const fromY = clearY + 1;
      let landY = clearY;
      while (landY > 0 && getB(x, landY-1, z) === AIR) landY--;
      setB(x, fromY, z, AIR);  bcast('block',{x, y:fromY, z, v:AIR});
      setB(x, landY, z, SAND); bcast('block',{x, y:landY, z, v:SAND});
      clearY = fromY;
    }
    // Water flow from adjacent water sources
    triggerFlow(x, y, z);
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
      afterBlockRemoved(bx, by, bz);
      if (blk === LEAVES) {
        const r = Math.random();
        if (r < 0.05)      spawnItemDrop(bx+0.5, by+0.5, bz+0.5, ITEM_STICK);
        else if (r < 0.07) spawnItemDrop(bx+0.5, by+0.5, bz+0.5, ITEM_APPLE);
      } else if (canHarvest(blk, mining.tool)) {
        spawnDrop(bx + 0.5, by + 0.5, bz + 0.5, blk === GRASS ? DIRT : blk);
        if (blk === WOOD) queueLeafDecay(bx, by, bz);
      }
      // Durability damage
      const toolSlot = inventory[hotbarSlot];
      if (toolSlot && toolSlot.kind === 'tool') {
        toolSlot.dur = (toolSlot.dur ?? TOOL_MAX_DUR[toolSlot.id] ?? 60) - 1;
        if (toolSlot.dur <= 0) inventory[hotbarSlot] = null;
      }
      mining = null;
      crackMesh.visible = false;
    }
  }

  function placeBlock() {
    const hit = raycastBlock(); if (!hit) return;
    // Right-click on crafting table → open 3x3 crafting
    if (getB(hit.x, hit.y, hit.z) === CRAFTING_TABLE) {
      openInventoryWithCrafting(3); return;
    }
    const slot = inventory[hotbarSlot];
    if (!slot || slot.kind !== 'block' || slot.count <= 0) return;
    const px = hit.x + hit.normal[0], py = hit.y + hit.normal[1], pz = hit.z + hit.normal[2];
    if (py < 0 || py >= WY) return;
    const cur = getB(px, py, pz);
    if (cur !== AIR && cur !== WATER) return;
    const cx = px+0.5, cy = py+0.5, cz = pz+0.5;
    const dx = Math.abs(cx - player.pos.x), dz = Math.abs(cz - player.pos.z);
    const overlapY = (cy + 0.5) > player.pos.y && (cy - 0.5) < (player.pos.y + PH);
    if (dx < PW + 0.5 && dz < PW + 0.5 && overlapY) return;
    const blk = slot.block;
    setB(px, py, pz, blk);
    playerPlaced.add(ek(px, py, pz));
    slot.count--;
    if (slot.count <= 0) inventory[hotbarSlot] = null;
    updateHotbarUI();
    bcast('block', { x:px, y:py, z:pz, v:blk });
  }

  // ── Dropped items ────────────────────────────────────────────────────────
  const drops = [];
  const ITEM_DROP_COLOR = { [ITEM_STICK]: 0xa07030, [ITEM_APPLE]: 0xdd2211 };

  function _spawnDrop(x, y, z, blockId, itemId) {
    let mesh;
    if (itemId != null) {
      const geo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
      const mat = new THREE.MeshLambertMaterial({ color: ITEM_DROP_COLOR[itemId] || 0xffffff });
      mesh = new THREE.Mesh(geo, mat);
    } else {
      const baseGeo = blockGeos[blockId] || blockGeos[STONE];
      const geo = baseGeo.clone();
      geo.scale(0.32, 0.32, 0.32);
      const mat = (blockId === WATER)          ? waterMaterial
                : (blockId === CRAFTING_TABLE) ? craftingTableMat
                : (oreMaterials[blockId])      ? oreMaterials[blockId]
                                               : blockMaterial;
      mesh = new THREE.Mesh(geo, mat);
    }
    mesh.position.set(x, y, z);
    scene.add(mesh);
    drops.push({
      pos: new THREE.Vector3(x, y, z),
      vel: new THREE.Vector3((Math.random()-0.5)*1.6, 3.5, (Math.random()-0.5)*1.6),
      blockId, itemId, mesh, age: 0, spin: Math.random() * Math.PI * 2,
    });
  }
  function spawnDrop(x, y, z, blockId)   { _spawnDrop(x, y, z, blockId, null); }
  function spawnItemDrop(x, y, z, itemId) { _spawnDrop(x, y, z, null, itemId); }

  function updateDrops(dt) {
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.age += dt; d.spin += dt * 1.8;
      d.vel.y = Math.max(d.vel.y + GRAVITY * dt, -18);
      const newY = d.pos.y + d.vel.y * dt;
      if (isSolidAt(Math.floor(d.pos.x), Math.floor(newY - 0.16), Math.floor(d.pos.z))) {
        d.pos.y = Math.ceil(newY - 0.16) + 0.16;
        d.vel.y = 0; d.vel.x *= 0.55; d.vel.z *= 0.55;
      } else d.pos.y = newY;
      const newX = d.pos.x + d.vel.x * dt;
      if (!isSolidAt(Math.floor(newX), Math.floor(d.pos.y), Math.floor(d.pos.z))) d.pos.x = newX;
      else d.vel.x *= -0.3;
      const newZ = d.pos.z + d.vel.z * dt;
      if (!isSolidAt(Math.floor(d.pos.x), Math.floor(d.pos.y), Math.floor(newZ))) d.pos.z = newZ;
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
          const picked = d.itemId != null
            ? addItem(d.itemId, 1)
            : addToInventory(d.blockId);
          if (picked) {
            scene.remove(d.mesh); d.mesh.geometry.dispose();
            drops.splice(i, 1);
          }
        }
      }
      if (d.age > 300) {
        scene.remove(d.mesh); d.mesh.geometry.dispose();
        drops.splice(i, 1);
      }
    }
  }

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

  // ── Inventory helpers ────────────────────────────────────────────────────
  function itemKindMatches(slot, kind, id) {
    if (!slot || slot.kind !== kind) return false;
    return (kind === 'block') ? slot.block === id : slot.id === id;
  }
  function addStackable(kind, id, count) {
    for (let i = 0; i < INV_SIZE; i++) {
      const s = inventory[i];
      if (s && itemKindMatches(s, kind, id)) { s.count += count; updateInventoryUI(); return true; }
    }
    for (let i = 0; i < INV_SIZE; i++) {
      if (!inventory[i]) {
        inventory[i] = (kind === 'block') ? { kind, block: id, count } : { kind, id, count };
        updateInventoryUI(); return true;
      }
    }
    return false;
  }
  function addToInventory(blockId) { return addStackable('block', blockId, 1); }
  function addItem(itemId, count = 1) { return addStackable('item', itemId, count); }
  function addTool(itemId) {
    for (let i = 0; i < INV_SIZE; i++) {
      if (!inventory[i]) { inventory[i] = { kind:'tool', id: itemId, dur: TOOL_MAX_DUR[itemId] ?? 60 }; updateInventoryUI(); return true; }
    }
    return false;
  }

  // ── Crafting grid + recipe matching ──────────────────────────────────────
  // craftGrid is 3x3; only top-left 2x2 is used in inventory mode
  let craftGrid = Array(9).fill(null);
  let craftSize = 2; // 2 or 3
  let craftResult = null;
  let cursorItem = null; // dragging in inventory
  let invOpen = false;

  function gridGet(r, c) { return craftGrid[r * 3 + c]; }
  function gridSet(r, c, v) { craftGrid[r * 3 + c] = v; }

  function ingredientMatches(slot, kind, id) {
    if (!slot) return false;
    if (slot.kind !== kind) return false;
    return (kind === 'block') ? slot.block === id : slot.id === id;
  }

  function matchRecipe() {
    // Find tight bounding box of non-null cells within craftSize×craftSize
    let r0 = craftSize, r1 = -1, c0 = craftSize, c1 = -1;
    for (let r = 0; r < craftSize; r++) for (let c = 0; c < craftSize; c++) {
      if (gridGet(r, c)) {
        if (r < r0) r0 = r; if (r > r1) r1 = r;
        if (c < c0) c0 = c; if (c > c1) c1 = c;
      }
    }
    if (r1 < 0) return null;
    const rows = r1 - r0 + 1, cols = c1 - c0 + 1;

    // Try each recipe
    outer: for (const recipe of RECIPES) {
      if (recipe.shapeless) {
        // Count items in entire grid, compare to ingredient list
        const need = recipe.shapeless.map(([k, id, n]) => ({ k, id, n: n||1, have: 0 }));
        let totalCells = 0;
        for (let r = 0; r < craftSize; r++) for (let c = 0; c < craftSize; c++) {
          const s = gridGet(r, c); if (!s) continue;
          totalCells++;
          let matched = false;
          for (const ing of need) {
            if (ingredientMatches(s, ing.k, ing.id)) { ing.have += (s.count || 1); matched = true; break; }
          }
          if (!matched) continue outer;
        }
        if (totalCells === 0) continue;
        for (const ing of need) if (ing.have < ing.n) continue outer;
        return recipe;
      }
      // Shaped
      const pat = recipe.shape;
      if (pat.length !== rows) continue;
      if (pat[0].length !== cols) continue;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const ch = pat[r][c];
        const slot = gridGet(r0 + r, c0 + c);
        if (ch === ' ') {
          if (slot) continue outer;
        } else {
          const def = recipe.key[ch];
          if (!def || !slot) continue outer;
          if (!ingredientMatches(slot, def[0], def[1])) continue outer;
        }
      }
      // Check no extra items outside bounding box (already enforced by trim, since trim is min/max of non-null)
      return recipe;
    }
    return null;
  }
  function makeOutputItem(recipe) {
    const [k, id, n] = recipe.out;
    if (k === 'block') return { kind:'block', block:id, count:n };
    if (k === 'item')  return { kind:'item',  id, count:n };
    return { kind:'tool', id };
  }
  function consumeGridOnce() {
    // Consume one of each non-empty slot
    for (let r = 0; r < craftSize; r++) for (let c = 0; c < craftSize; c++) {
      const s = gridGet(r, c); if (!s) continue;
      if (s.kind === 'tool') gridSet(r, c, null);
      else {
        s.count = (s.count || 1) - 1;
        if (s.count <= 0) gridSet(r, c, null);
      }
    }
  }
  function recomputeCraftResult() {
    const r = matchRecipe();
    craftResult = r ? makeOutputItem(r) : null;
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

  // ── Multiplayer (deterministic terrain via roomCode seed) ────────────────
  function bcast(event, payload) { if (channel) channel.send({ type:'broadcast', event, payload }); }

  function sendEdits() {
    if (edits.size === 0) { bcast('edits', { e: [] }); return; }
    const arr = [];
    for (const [k, v] of edits) {
      const [x,y,z] = k.split(',').map(Number);
      arr.push([x, y, z, v]);
    }
    bcast('edits', { e: arr });
  }
  function applyEditsBatch(arr) {
    for (const [x, y, z, v] of arr) {
      edits.set(ek(x,y,z), v);
      setBLocalOnly(x, y, z, v);
    }
  }

  function connectRoom(code) {
    if (channel) sb.removeChannel(channel);
    channel = sb.channel('mc3d:'+code);
    channel.on('presence', { event:'sync' }, () => {
      const all = Object.values(channel.presenceState()).flat();
      document.getElementById('onlineBadge').textContent = '👤 ' + all.length + ' online';
      if (isHost) sendEdits();
    });
    channel.on('presence', { event:'leave' }, ({ leftPresences }) => {
      const arr = Array.isArray(leftPresences) ? leftPresences : Object.values(leftPresences).flat();
      arr.forEach(p => { if (p?.userId && p.userId !== myId) removeOther(p.userId); });
    });
    channel.on('broadcast', { event:'req_edits' }, () => { if (isHost) sendEdits(); });
    channel.on('broadcast', { event:'edits' }, ({ payload }) => applyEditsBatch(payload.e || []));
    channel.on('broadcast', { event:'block' }, ({ payload }) => {
      edits.set(ek(payload.x, payload.y, payload.z), payload.v);
      setBLocalOnly(payload.x, payload.y, payload.z, payload.v);
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
        bcast('req_edits', {});
        setTimeout(() => bcast('req_edits', {}), 1500);
      }
    });
  }

  // ── Input ────────────────────────────────────────────────────────────────
  let pointerLocked = false;
  canvas.addEventListener('click', () => { if (running && !invOpen) canvas.requestPointerLock(); });
  document.addEventListener('pointerlockchange', () => {
    pointerLocked = document.pointerLockElement === canvas;
    document.getElementById('lockHint').style.display = (running && !pointerLocked && !invOpen) ? 'block' : 'none';
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
  document.addEventListener('contextmenu', e => { if (pointerLocked || invOpen) e.preventDefault(); });

  document.addEventListener('keydown', e => {
    if (!running) return;
    if (e.code === 'KeyE') { toggleInventory(); e.preventDefault(); return; }
    if (e.code === 'F5') { thirdPerson = !thirdPerson; e.preventDefault(); return; }
    if (e.code === 'Escape' && invOpen) { toggleInventory(); return; }
    if (invOpen) return;
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

  // ── Hotbar UI ────────────────────────────────────────────────────────────
  function makeAtlasThumbs(image) {
    const layerH = image.height / ATLAS_LAYERS;
    const tileW  = image.width / 3;
    for (const id of [SAND, GRASS, DIRT, STONE, SNOW, LEAVES, WOOD]) {
      const c = document.createElement('canvas'); c.width = c.height = 32;
      const cx = c.getContext('2d'); cx.imageSmoothingEnabled = false;
      cx.drawImage(image, tileW, id * layerH, tileW, layerH, 0, 0, 32, 32);
      blockThumbs[id] = c.toDataURL();
    }
    buildHotbarUI();
  }
  const atlasImg = new Image();
  atlasImg.onload = () => makeAtlasThumbs(atlasImg);
  atlasImg.src = 'assets/tex_array_0.png';

  function slotImage(item) {
    if (!item) return null;
    if (item.kind === 'block') return blockThumbs[item.block] || null;
    if (item.kind === 'tool')  return TOOLS[item.id]?.img || null;
    if (item.kind === 'item')  return itemThumbs[item.id] || null;
    return null;
  }
  function makePlankThumb() {
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const cx = c.getContext('2d');
    cx.fillStyle = '#c8954a'; cx.fillRect(2, 8, 28, 16);
    cx.strokeStyle = '#7a4f28'; cx.lineWidth = 1;
    cx.strokeRect(2, 8, 28, 16);
    cx.beginPath(); cx.moveTo(2, 16); cx.lineTo(30, 16); cx.stroke();
    return c.toDataURL();
  }
  function makeStickThumb() {
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const cx = c.getContext('2d');
    cx.fillStyle = '#a87838'; cx.fillRect(13, 4, 6, 24);
    cx.strokeStyle = '#5e3f1e'; cx.strokeRect(13, 4, 6, 24);
    return c.toDataURL();
  }
  function makeAppleThumb() {
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const cx = c.getContext('2d');
    cx.fillStyle = '#cc2200'; cx.beginPath(); cx.arc(16, 18, 11, 0, Math.PI*2); cx.fill();
    cx.fillStyle = '#228822'; cx.fillRect(14, 5, 4, 8);
    return c.toDataURL();
  }
  // Set canvas fallbacks immediately, then upgrade if image files exist
  itemThumbs[ITEM_PLANK] = makePlankThumb();
  itemThumbs[ITEM_STICK] = makeStickThumb();
  itemThumbs[ITEM_APPLE] = makeAppleThumb();
  for (const [src, id] of [['assets/plank.png', ITEM_PLANK], ['assets/stick.png', ITEM_STICK]]) {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = c.height = 32;
      const cx = c.getContext('2d'); cx.imageSmoothingEnabled = false;
      cx.drawImage(img, 0, 0, img.width, img.height, 0, 0, 32, 32);
      itemThumbs[id] = c.toDataURL();
      updateHotbarUI();
    };
    img.src = src;
  }

  function buildHotbarUI() {
    const el = document.getElementById('hotbar');
    el.innerHTML = '';
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const slot = document.createElement('div');
      slot.className = 'slot';
      slot.addEventListener('click', () => { hotbarSlot = i; updateHotbarUI(); });
      const swatch = document.createElement('div');
      swatch.className = 'swatch';
      slot.appendChild(swatch);
      const num = document.createElement('span');
      num.className = 'num'; num.textContent = i + 1;
      slot.appendChild(num);
      el.appendChild(slot);
    }
    updateHotbarUI();
  }
  function updateHotbarUI() {
    const el = document.getElementById('hotbar');
    if (!el.children.length) { buildHotbarUI(); return; }
    [...el.children].forEach((c, i) => {
      c.classList.toggle('active', i === hotbarSlot);
      const item = inventory[i];
      const swatch = c.querySelector('.swatch');
      const src = slotImage(item);
      swatch.style.backgroundImage = src ? `url(${src})` : 'none';
      let cnt = c.querySelector('.cnt');
      const showCount = item && item.kind !== 'tool' && (item.count || 0) > 1;
      if (showCount) {
        if (!cnt) { cnt = document.createElement('span'); cnt.className = 'cnt'; c.appendChild(cnt); }
        cnt.textContent = item.count;
      } else if (cnt) cnt.remove();
      let db = c.querySelector('.dur-bar');
      const showDur = item && item.kind === 'tool' && item.dur != null;
      if (showDur) {
        const pct = Math.max(0, item.dur / (TOOL_MAX_DUR[item.id] || 60));
        if (!db) { db = document.createElement('div'); db.className = 'dur-bar'; c.appendChild(db); }
        db.style.width = `calc(${Math.round(pct*100)}% - 4px)`;
        db.style.background = durColor(pct);
      } else if (db) db.remove();
    });
  }
  function updateInventoryUI() { updateHotbarUI(); if (invOpen) renderInventoryPanel(); }

  // ── Inventory + crafting overlay ─────────────────────────────────────────
  let invPanelEl = null;
  let cursorEl = null;

  function ensureInvPanel() {
    if (invPanelEl) return;
    invPanelEl = document.createElement('div');
    invPanelEl.id = 'invPanel';
    invPanelEl.innerHTML = `
      <div class="inv-frame">
        <h2 id="invTitle">Inventory</h2>
        <div class="craft-area">
          <div class="craft-grid" id="craftGridEl"></div>
          <div class="craft-arrow">→</div>
          <div class="craft-result" id="craftResultEl"></div>
        </div>
        <h3>Inventory</h3>
        <div class="inv-grid" id="invGrid"></div>
        <h3>Hotbar</h3>
        <div class="inv-grid hotbar" id="invHotbar"></div>
        <p class="inv-hint">
          <b>E</b>/<b>Esc</b> close · Click pick up · Right-click split · Right-click crafting table for 3×3 grid
        </p>
      </div>`;
    invPanelEl.style.display = 'none';
    document.getElementById('mcApp').appendChild(invPanelEl);

    cursorEl = document.createElement('div');
    cursorEl.id = 'invCursor';
    document.body.appendChild(cursorEl);

    document.addEventListener('mousemove', e => {
      if (!invOpen) return;
      cursorEl.style.left = (e.clientX - 19) + 'px';
      cursorEl.style.top  = (e.clientY - 19) + 'px';
    });
  }

  function durColor(pct) { return pct > 0.5 ? '#5c5' : pct > 0.25 ? '#cc5' : '#c44'; }
  function slotHTML(item, extraClass='') {
    if (!item) return `<div class="iv-slot ${extraClass}"></div>`;
    const src = slotImage(item);
    const bg = src ? `style="background-image:url(${src})"` : '';
    const cnt = (item.kind !== 'tool' && (item.count || 0) > 1) ? `<span class="cnt">${item.count}</span>` : '';
    const title = item.kind === 'block' ? '' :
                  item.kind === 'tool' ? (TOOLS[item.id]?.name || '') :
                                          (ITEMS[item.id]?.name || '');
    let durBar = '';
    if (item.kind === 'tool' && item.dur != null) {
      const pct = Math.max(0, item.dur / (TOOL_MAX_DUR[item.id] || 60));
      durBar = `<div class="dur-bar" style="width:calc(${Math.round(pct*100)}% - 4px);background:${durColor(pct)}"></div>`;
    }
    return `<div class="iv-slot filled ${extraClass}" title="${title}"><div class="iv-swatch" ${bg}></div>${cnt}${durBar}</div>`;
  }

  // Click logic: left-click swap/pick up; right-click split (take half) or place 1
  function clickInvSlot(getItem, setItem, e) {
    e.preventDefault();
    const right = (e.button === 2);
    const cur = cursorItem;
    const here = getItem();
    if (right) {
      if (cur && !here) {
        // Place 1
        const placed = (cur.kind === 'tool')
          ? { kind:'tool', id:cur.id }
          : (cur.kind === 'block')
            ? { kind:'block', block:cur.block, count:1 }
            : { kind:'item',  id:cur.id, count:1 };
        setItem(placed);
        if (cur.kind !== 'tool') {
          cur.count -= 1;
          if (cur.count <= 0) cursorItem = null;
        } else cursorItem = null;
      } else if (cur && here && itemKindMatches(here, cur.kind, cur.kind==='block'?cur.block:cur.id) && cur.kind !== 'tool') {
        // Add 1 to existing
        here.count += 1;
        cur.count -= 1;
        if (cur.count <= 0) cursorItem = null;
        setItem(here);
      } else if (!cur && here && here.kind !== 'tool') {
        // Take half
        const half = Math.ceil((here.count || 1) / 2);
        cursorItem = (here.kind === 'block')
          ? { kind:'block', block:here.block, count:half }
          : { kind:'item',  id:here.id, count:half };
        here.count -= half;
        if (here.count <= 0) setItem(null); else setItem(here);
      } else if (!cur && here && here.kind === 'tool') {
        // Tools just pick up whole
        cursorItem = here; setItem(null);
      }
    } else {
      // Left click: stack-merge or swap
      if (cur && here && itemKindMatches(here, cur.kind, cur.kind==='block'?cur.block:cur.id) && cur.kind !== 'tool') {
        here.count += cur.count;
        cursorItem = null;
        setItem(here);
      } else {
        setItem(cur);
        cursorItem = here;
      }
    }
    updateInventoryUI();
  }

  function renderInventoryPanel() {
    if (!invPanelEl) ensureInvPanel();
    document.getElementById('invTitle').textContent = (craftSize === 3) ? 'Crafting Table' : 'Inventory';

    // Crafting grid
    const cg = invPanelEl.querySelector('#craftGridEl');
    cg.style.gridTemplateColumns = `repeat(${craftSize}, 38px)`;
    cg.innerHTML = '';
    for (let r = 0; r < craftSize; r++) for (let c = 0; c < craftSize; c++) {
      const idx = r * 3 + c;
      const div = document.createElement('div');
      div.innerHTML = slotHTML(craftGrid[idx], 'craft-cell');
      const cell = div.firstElementChild;
      cell.addEventListener('mousedown', e => {
        clickInvSlot(
          () => craftGrid[idx],
          (v) => { craftGrid[idx] = v; recomputeCraftResult(); },
          e
        );
      });
      cell.addEventListener('contextmenu', e => e.preventDefault());
      cg.appendChild(cell);
    }
    // Result
    const cr = invPanelEl.querySelector('#craftResultEl');
    cr.innerHTML = slotHTML(craftResult, craftResult ? 'craft-out can' : 'craft-out');
    const resCell = cr.firstElementChild;
    resCell.addEventListener('mousedown', e => {
      e.preventDefault();
      if (!craftResult) return;
      const r = matchRecipe(); if (!r) return;
      const out = makeOutputItem(r);
      // Send straight to inventory, not to cursor
      let added = false;
      if (out.kind === 'tool')       added = addTool(out.id);
      else if (out.kind === 'block') added = addStackable('block', out.block, out.count);
      else                           added = addStackable('item',  out.id,    out.count);
      if (!added) return;
      consumeGridOnce();
      recomputeCraftResult();
      updateInventoryUI();
    });

    // Inventory grid (slots 9..35)
    const grid = invPanelEl.querySelector('#invGrid');
    grid.innerHTML = '';
    for (let i = HOTBAR_SIZE; i < INV_SIZE; i++) {
      const div = document.createElement('div'); div.innerHTML = slotHTML(inventory[i]);
      const cell = div.firstElementChild;
      cell.addEventListener('mousedown', e => {
        clickInvSlot(() => inventory[i], (v) => { inventory[i] = v; }, e);
      });
      cell.addEventListener('contextmenu', e => e.preventDefault());
      grid.appendChild(cell);
    }
    // Hotbar
    const hbar = invPanelEl.querySelector('#invHotbar');
    hbar.innerHTML = '';
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const div = document.createElement('div'); div.innerHTML = slotHTML(inventory[i]);
      const cell = div.firstElementChild;
      cell.addEventListener('mousedown', e => {
        clickInvSlot(() => inventory[i], (v) => { inventory[i] = v; }, e);
      });
      cell.addEventListener('contextmenu', e => e.preventDefault());
      hbar.appendChild(cell);
    }
    // Cursor preview
    cursorEl.innerHTML = cursorItem ? slotHTML(cursorItem, 'cursor-slot') : '';
    cursorEl.style.display = cursorItem ? 'block' : 'none';
  }

  function dropCursorBackToInventory() {
    if (!cursorItem) return;
    if (cursorItem.kind === 'tool') addTool(cursorItem.id);
    else addStackable(cursorItem.kind, cursorItem.kind==='block'?cursorItem.block:cursorItem.id, cursorItem.count);
    cursorItem = null;
  }
  function returnCraftGridToInventory() {
    for (let i = 0; i < 9; i++) {
      const s = craftGrid[i]; if (!s) continue;
      if (s.kind === 'tool') addTool(s.id);
      else addStackable(s.kind, s.kind==='block'?s.block:s.id, s.count);
      craftGrid[i] = null;
    }
  }

  function openInventoryWithCrafting(size) {
    craftSize = size;
    if (!invOpen) toggleInventory();
    else { recomputeCraftResult(); renderInventoryPanel(); }
  }
  function toggleInventory() {
    invOpen = !invOpen;
    ensureInvPanel();
    if (invOpen) {
      if (document.pointerLockElement) document.exitPointerLock();
      inputKeys.fwd = inputKeys.back = inputKeys.left = inputKeys.right = false;
      inputKeys.jump = inputKeys.sprint = false;
      mouseDownLeft = false; mining = null;
      crackMesh.visible = false;
      recomputeCraftResult();
      invPanelEl.style.display = 'flex';
      renderInventoryPanel();
    } else {
      // Return cursor + crafting-grid items to inventory so they're not lost
      dropCursorBackToInventory();
      returnCraftGridToInventory();
      recomputeCraftResult();
      craftSize = 2;
      cursorEl.style.display = 'none';
      invPanelEl.style.display = 'none';
    }
  }

  // ── Boot ────────────────────────────────────────────────────────────────
  function beginPlaying() {
    // Force-load chunks around origin so spawn search has terrain
    lastChunkX = lastChunkZ = null;
    player.pos.set(0.5, WY, 0.5);
    updateChunks();
    const sp = findSpawn();
    player.pos.copy(sp); player.vy = 0; player.yaw = 0; player.pitch = 0;
    lastChunkX = lastChunkZ = null;
    updateChunks();
    // Build initial chunk meshes immediately
    for (const [k, entry] of chunkMeshes) if (entry.dirty) {
      const [cx, cz] = k.split(',').map(Number);
      buildChunkMesh(cx, cz);
    }
    if (roomCode === 'AB67') {
      const maxDur = id => TOOL_MAX_DUR[id] ?? 60;
      inventory[0] = { kind:'tool', id:ITEM_DIAMOND_PICK,  dur:maxDur(ITEM_DIAMOND_PICK)  };
      inventory[1] = { kind:'tool', id:ITEM_DIAMOND_AXE,   dur:maxDur(ITEM_DIAMOND_AXE)   };
      inventory[2] = { kind:'tool', id:ITEM_DIAMOND_SWORD, dur:maxDur(ITEM_DIAMOND_SWORD)  };
      inventory[3] = { kind:'tool', id:ITEM_IRON_SHOVEL,   dur:maxDur(ITEM_IRON_SHOVEL)   };
      inventory[4] = { kind:'block', block:CRAFTING_TABLE, count:16 };
      inventory[5] = { kind:'block', block:WOOD,           count:64 };
      inventory[6] = { kind:'block', block:STONE,          count:64 };
      inventory[7] = { kind:'block', block:DIRT,           count:64 };
    }

    running = true;
    document.getElementById('lobbyPanel').style.display = 'none';
    document.getElementById('waitPanel').style.display = 'none';
    document.getElementById('crosshair').style.display = 'block';
    document.getElementById('hotbar').style.display = 'flex';
    document.getElementById('hudInfo').style.display = 'block';
    document.getElementById('roomBadge').textContent = 'Room: ' + roomCode;
    if (atlasImg.complete && Object.keys(blockThumbs).length === 0) makeAtlasThumbs(atlasImg);
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
    updateChunks();
    processDirtyChunks(3);
    updateMining(dt);
    updateDrops(dt);
    updateHand(dt);
    processLeafDecay();

    waterAnimT += dt * 0.18;
    waterTex.offset.y = -waterAnimT;
    waterTex.offset.x = waterAnimT * 0.5;

    const uw = inWater();
    document.getElementById('underwaterOverlay').style.display = uw ? 'block' : 'none';

    // Dim ambient when underground (no sky access above player's head)
    const headY = Math.floor(player.pos.y) + 1;
    const px = Math.floor(player.pos.x), pz = Math.floor(player.pos.z);
    let hasSky = true;
    for (let sy = headY + 1; sy < WY; sy++) {
      if (SOLID.has(getB(px, sy, pz))) { hasSky = false; break; }
    }
    ambientLight.intensity = hasSky ? 1.1 : 0.15;

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
  function seedFromCode(c) {
    let s = 0; for (const ch of c) s = ((s<<5) - s + ch.charCodeAt(0)) | 0;
    return Math.abs(s) || 1;
  }

  document.getElementById('createBtn').addEventListener('click', async () => {
    if (!await getMyUser()) return;
    roomCode = genCode(); isHost = true;
    worldSeed = seedFromCode(roomCode);
    document.getElementById('lobbyPanel').style.display = 'none';
    resize(); connectRoom(roomCode); beginPlaying();
  });
  document.getElementById('joinBtn').addEventListener('click', async () => {
    const code = document.getElementById('codeInput').value.trim().toUpperCase();
    if (code.length !== 4) { alert('Enter a 4-letter room code.'); return; }
    if (!await getMyUser()) return;
    roomCode = code; isHost = false;
    worldSeed = seedFromCode(roomCode);
    document.getElementById('lobbyPanel').style.display = 'none';
    document.getElementById('waitCode').textContent = code;
    document.getElementById('waitPanel').style.display = 'flex';
    resize(); connectRoom(roomCode);
    // Joiners can begin immediately — terrain is deterministic from the seed.
    setTimeout(() => beginPlaying(), 400);
  });
  document.getElementById('codeInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('joinBtn').click();
  });
  resize();
})();
