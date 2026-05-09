(() => {
  // ── Block IDs ────────────────────────────────────────────────────────────
  const AIR=0, SAND=1, GRASS=2, DIRT=3, STONE=4, SNOW=5, LEAVES=6, WOOD=7, WATER=8;
  const BEDROCK = 9;
  const CRAFTING_TABLE = 10;
  const PLANK = 11;
  const COAL_ORE=12, IRON_ORE=13, COPPER_ORE=14, GOLD_ORE=15, REDSTONE_ORE=16, DIAMOND_ORE=17;
  const FURNACE = 18;
  const WOOL = 19;
  const BED  = 20;
  const CHEST = 21;
  const TORCH = 22;
  const ORES = [COAL_ORE, IRON_ORE, COPPER_ORE, GOLD_ORE, REDSTONE_ORE, DIAMOND_ORE];
  const ATLAS_BLOCKS = [SAND, GRASS, DIRT, STONE, SNOW, LEAVES, WOOD]; // in tex_array_0.png
  const SOLID = new Set([SAND,GRASS,DIRT,STONE,SNOW,LEAVES,WOOD,BEDROCK,CRAFTING_TABLE,PLANK,
                         COAL_ORE,IRON_ORE,COPPER_ORE,GOLD_ORE,REDSTONE_ORE,DIAMOND_ORE,FURNACE,WOOL,BED,CHEST]);

  // ── World dims (chunked, infinite) ───────────────────────────────────────
  const CHUNK_W = 32;
  const WY = 64;
  const SEA_LEVEL = 10;
  const ATLAS_LAYERS = 8;
  const MESH_DIST = 4;  // build visible meshes within this chunk radius
  const GEN_DIST  = 5;  // pre-generate data one ring beyond so edge faces cull correctly

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

  const ITEM_PLANK = 106, ITEM_STICK = 107, ITEM_APPLE = 108, ITEM_BEEF = 109, ITEM_COOKED_BEEF = 110;
  const ITEM_WOOL = 151;
  const FOOD_RESTORE = { [ITEM_APPLE]: 4, [ITEM_BEEF]: 3, [ITEM_COOKED_BEEF]: 8 };
  const ITEM_IRON = 201, ITEM_DIAMOND_GEM = 202, ITEM_GOLD = 203, ITEM_COAL = 204;
  const ITEMS = {
    [ITEM_PLANK]: { name: 'Plank' },
    [ITEM_STICK]: { name: 'Stick' },
    [ITEM_APPLE]: { name: 'Apple' },
    [ITEM_BEEF]:        { name: 'Raw Beef' },
    [ITEM_COOKED_BEEF]: { name: 'Cooked Beef' },
    [ITEM_WOOL]:        { name: 'Wool' },
    [ITEM_IRON]:        { name: 'Iron Ingot' },
    [ITEM_DIAMOND_GEM]: { name: 'Diamond' },
    [ITEM_GOLD]:        { name: 'Gold Ingot' },
    [ITEM_COAL]:        { name: 'Coal' },
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
    // Furnace: 8 stone in a ring (requires crafting table)
    { shape:['sss','s s','sss'], key:{ s:['block', STONE] }, out:['block', FURNACE, 1] },
    // Chest: 8 wood planks in a ring (requires crafting table)
    { shape:['www','w w','www'], key:{ w:['block', WOOD] }, out:['block', CHEST, 1] },
    // Bed: 3 wool (top) + 3 planks (bottom) — requires crafting table
    { shape:['www','ppp'], key:{ w:['block', WOOL], p:['item', ITEM_PLANK] }, out:['block', BED, 1] },
    // Torch: coal over stick → 4 torches
    { shape:['c','s'], key:{ c:['item', ITEM_COAL], s:['item', ITEM_STICK] }, out:['block', TORCH, 4] },
    // Pickaxes (3-wide top row, requires crafting table)
    { shape:['ppp',' s ',' s '], key:{ p:['item',ITEM_PLANK],       s:['item',ITEM_STICK] }, out:['tool', ITEM_WOOD_PICK, 1] },
    { shape:['ppp',' s ',' s '], key:{ p:['block',STONE],           s:['item',ITEM_STICK] }, out:['tool', ITEM_STONE_PICK, 1] },
    { shape:['ppp',' s ',' s '], key:{ p:['item',ITEM_IRON],        s:['item',ITEM_STICK] }, out:['tool', ITEM_IRON_PICK, 1] },
    { shape:['ppp',' s ',' s '], key:{ p:['item',ITEM_DIAMOND_GEM], s:['item',ITEM_STICK] }, out:['tool', ITEM_DIAMOND_PICK, 1] },
    // Axes
    { shape:['pp','ps',' s'],    key:{ p:['item',ITEM_PLANK],       s:['item',ITEM_STICK] }, out:['tool', ITEM_WOOD_AXE, 1] },
    { shape:['pp','ps',' s'],    key:{ p:['block',STONE],           s:['item',ITEM_STICK] }, out:['tool', ITEM_STONE_AXE, 1] },
    { shape:['pp','ps',' s'],    key:{ p:['item',ITEM_IRON],        s:['item',ITEM_STICK] }, out:['tool', ITEM_IRON_AXE, 1] },
    { shape:['pp','ps',' s'],    key:{ p:['item',ITEM_DIAMOND_GEM], s:['item',ITEM_STICK] }, out:['tool', ITEM_DIAMOND_AXE, 1] },
    // Shovels
    { shape:['p','s','s'],       key:{ p:['item',ITEM_PLANK],       s:['item',ITEM_STICK] }, out:['tool', ITEM_WOOD_SHOVEL, 1] },
    { shape:['p','s','s'],       key:{ p:['block',STONE],           s:['item',ITEM_STICK] }, out:['tool', ITEM_STONE_SHOVEL, 1] },
    { shape:['p','s','s'],       key:{ p:['item',ITEM_IRON],        s:['item',ITEM_STICK] }, out:['tool', ITEM_IRON_SHOVEL, 1] },
    // Swords
    { shape:['p','p','s'],       key:{ p:['item',ITEM_PLANK],       s:['item',ITEM_STICK] }, out:['tool', ITEM_WOOD_SWORD, 1] },
    { shape:['p','p','s'],       key:{ p:['block',STONE],           s:['item',ITEM_STICK] }, out:['tool', ITEM_STONE_SWORD, 1] },
    { shape:['p','p','s'],       key:{ p:['item',ITEM_IRON],        s:['item',ITEM_STICK] }, out:['tool', ITEM_IRON_SWORD, 1] },
    { shape:['p','p','s'],       key:{ p:['item',ITEM_DIAMOND_GEM], s:['item',ITEM_STICK] }, out:['tool', ITEM_DIAMOND_SWORD, 1] },
  ];

  const BLOCK_TOOL = {
    [SAND]:'shovel', [DIRT]:'shovel', [GRASS]:'shovel', [SNOW]:'shovel',
    [WOOD]:'axe',    [LEAVES]:'sword', [CRAFTING_TABLE]:'axe', [PLANK]:'axe', [FURNACE]:'pickaxe',
    [WOOL]:'sword',  [BED]:'axe', [CHEST]:'axe', [TORCH]:'shovel',
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
    [WOOD]: 0.9, [LEAVES]: 0.2, [STONE]: 1.5, [CRAFTING_TABLE]: 1.5, [PLANK]: 0.75, [FURNACE]: 1.5,
    [WOOL]: 0.8, [BED]: 0.2, [CHEST]: 1.0, [TORCH]: 0.05,
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

  // ── Furnace smelting ─────────────────────────────────────────────────────
  // Key: block ID (for ores) or item ID (for food). Value: what it smelts into.
  const SMELT_RECIPES = new Map([
    [COAL_ORE,    { outKind:'item', outId:ITEM_COAL,        count:4 }],
    [IRON_ORE,    { outKind:'item', outId:ITEM_IRON,        count:1 }],
    [GOLD_ORE,    { outKind:'item', outId:ITEM_GOLD,        count:1 }],
    [DIAMOND_ORE, { outKind:'item', outId:ITEM_DIAMOND_GEM, count:1 }],
    [ITEM_BEEF,   { outKind:'item', outId:ITEM_COOKED_BEEF, count:1 }],
  ]);
  // Fuel burn durations in seconds (sticks shortest, wooden pickaxe longest)
  const FUEL_SECONDS = new Map([
    [ITEM_COAL, 80],
    [WOOD, 15],   [PLANK, 7],   [ITEM_PLANK, 7],
    [ITEM_STICK, 5],
    [ITEM_WOOD_PICK, 25], [ITEM_WOOD_AXE, 22],
    [ITEM_WOOD_SHOVEL, 18], [ITEM_WOOD_SWORD, 20],
  ]);
  // Keep alias so _isFuel still works
  const SMELT_FUEL = FUEL_SECONDS;

  // All items available in creative mode — must come after all ITEM_* constants
  const CREATIVE_PALETTE = [
    { kind:'block', block:GRASS },  { kind:'block', block:STONE },
    { kind:'block', block:SAND },   { kind:'block', block:SNOW },   { kind:'block', block:WOOD },
    { kind:'block', block:PLANK },  { kind:'block', block:LEAVES }, { kind:'block', block:CRAFTING_TABLE },
    { kind:'block', block:WATER },  { kind:'block', block:FURNACE },  { kind:'block', block:WOOL },
    { kind:'block', block:BED },   { kind:'block', block:CHEST },   { kind:'block', block:TORCH },
    { kind:'block', block:COAL_ORE },
    { kind:'block', block:IRON_ORE },{ kind:'block', block:COPPER_ORE },{ kind:'block', block:GOLD_ORE },
    { kind:'block', block:REDSTONE_ORE },{ kind:'block', block:DIAMOND_ORE },{ kind:'block', block:BEDROCK },
    { kind:'item',  id:ITEM_PLANK },{ kind:'item',  id:ITEM_STICK },{ kind:'item',  id:ITEM_APPLE },
    { kind:'item',  id:ITEM_BEEF }, { kind:'item',  id:ITEM_COOKED_BEEF },
    { kind:'item',  id:ITEM_IRON }, { kind:'item',  id:ITEM_DIAMOND_GEM },
    { kind:'item',  id:ITEM_GOLD }, { kind:'item',  id:ITEM_COAL },
    { kind:'tool',  id:ITEM_WOOD_PICK },  { kind:'tool', id:ITEM_STONE_PICK },
    { kind:'tool',  id:ITEM_IRON_PICK },  { kind:'tool', id:ITEM_DIAMOND_PICK },
    { kind:'tool',  id:ITEM_WOOD_AXE },   { kind:'tool', id:ITEM_STONE_AXE },
    { kind:'tool',  id:ITEM_IRON_AXE },   { kind:'tool', id:ITEM_DIAMOND_AXE },
    { kind:'tool',  id:ITEM_WOOD_SHOVEL },{ kind:'tool', id:ITEM_STONE_SHOVEL },
    { kind:'tool',  id:ITEM_IRON_SHOVEL },
    { kind:'tool',  id:ITEM_WOOD_SWORD }, { kind:'tool', id:ITEM_STONE_SWORD },
    { kind:'tool',  id:ITEM_IRON_SWORD }, { kind:'tool', id:ITEM_DIAMOND_SWORD },
  ];

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
    if (t && t.kind === BLOCK_TOOL[block]) {
      speedMultiplier = TIER_SPEED[t.tier];          // right tool: full bonus
    } else if (t) {
      speedMultiplier = 1 + (TIER_SPEED[t.tier] - 1) * 0.25; // wrong tool: 25% of tier bonus
    }
    if (inWater()) speedMultiplier *= 0.5;
    let damage = speedMultiplier / hardness;
    damage /= canHarvest(block, itemId) ? 30 : 100;
    if (damage >= 1) return 0;
    return Math.ceil(1 / damage) / 20;
  }

  // ── Physics ──────────────────────────────────────────────────────────────
  const WALK = 4.5, SPRINT = 6.5, JUMP_VEL = 7.0, GRAVITY = -28, MAX_FALL = 60;
  const PW = 0.3, PH = 1.8, EYE = 1.6, REACH = 5.5;

  // ── State ────────────────────────────────────────────────────────────────
  let myId='', myName='Player', myColor=0xe74c3c;
  // Unique per browser tab so two people on the same account can still see each other
  const clientId = Math.random().toString(36).slice(2, 10);
  let others = {};
  let channel=null, isHost=false, roomCode='', worldSeed=1;
  let hotbarSlot=0, running=false;
  const player = { pos: new THREE.Vector3(0,0,0), vy:0, grounded:false, yaw:0, pitch:0 };
  const inputKeys = { fwd:false, back:false, left:false, right:false, jump:false, sprint:false, ctrl:false };

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

  // ── Game type / mode / survival stats ────────────────────────────────────
  // gameType: 'sp' = singleplayer (no channel), 'mp' = multiplayer, 'pvp' = pvp arena
  let gameType = 'sp';
  let gameMode = 'survival'; // 'survival' | 'creative'
  let pvpEnabled = false;
  let flying = false, flyVy = 0, lastSpaceTime = 0;
  let playerHealth = 20, maxHealth = 20;
  let playerHunger = 20, maxHunger = 20;
  let hungerTimer = 0, healTimer = 0;
  let airPeakY = null, prevWasGrounded = true;
  let hitFlashTimer = 0;
  let playerAir = 15, maxAir = 15; // seconds of air (15s like Java MC)
  let airDmgTimer = 0;
  let pvpCooldown = 0;
  let pvpKills = 0; // kill counter for current pvp session
  let playerDead = false; // true while death screen is showing; loop keeps running
  let autosaveInterval = null;
  let worldTime = 0; // seconds elapsed; day/night cycle = DAY_LENGTH
  let spawnPoint = null; // custom respawn point set by sleeping in a bed
  let playerSpeed = 5.5;  // default walk speed (replaces hardcoded WALK)
  let jumpStrength = JUMP_VEL; // reset to JUMP_VEL on every game start
  const DAY_LENGTH = 300; // ~2.5 min day + ~2.5 min night (5 min full cycle)

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
  blockGeos[PLANK] = new THREE.BoxGeometry(1, 1, 1);

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

  // Plank texture (canvas-generated warm brown with grain lines)
  const _plankC = document.createElement('canvas'); _plankC.width = _plankC.height = 16;
  const _plankCx = _plankC.getContext('2d');
  _plankCx.fillStyle = '#c8954a'; _plankCx.fillRect(0, 0, 16, 16);
  _plankCx.fillStyle = '#b07838';
  for (let row = 0; row < 16; row += 4) _plankCx.fillRect(0, row, 16, 1);
  _plankCx.fillStyle = '#7a5230';
  _plankCx.fillRect(0, 7, 16, 1); _plankCx.fillRect(0, 8, 16, 1);
  const plankTex = new THREE.CanvasTexture(_plankC);
  plankTex.magFilter = THREE.NearestFilter; plankTex.minFilter = THREE.NearestFilter;
  plankTex.colorSpace = THREE.SRGBColorSpace;
  const plankMat = new THREE.MeshLambertMaterial({ map: plankTex });
  // Plank block thumbnail
  (() => {
    const tc = document.createElement('canvas'); tc.width = tc.height = 32;
    const tcx = tc.getContext('2d'); tcx.imageSmoothingEnabled = false;
    tcx.drawImage(_plankC, 0, 0, 16, 16, 0, 0, 32, 32);
    blockThumbs[PLANK] = tc.toDataURL();
  })();

  // Furnace texture
  const _furnaceC = document.createElement('canvas'); _furnaceC.width = _furnaceC.height = 16;
  (() => {
    const cx = _furnaceC.getContext('2d');
    cx.fillStyle = '#6b6b6b'; cx.fillRect(0, 0, 16, 16);         // stone base
    cx.fillStyle = '#555';     cx.fillRect(0, 0, 16, 1);          // top edge
    cx.fillStyle = '#555';     cx.fillRect(0, 0, 1, 16);          // left edge
    // Door frame
    cx.fillStyle = '#333';     cx.fillRect(3, 5, 10, 8);          // door recess
    // Fire glow inside
    cx.fillStyle = '#ff8800';  cx.fillRect(4, 8, 8, 4);
    cx.fillStyle = '#ffdd00';  cx.fillRect(5, 9, 6, 2);
    cx.fillStyle = '#fff';     cx.fillRect(7, 10, 2, 1);
    // Door arch top
    cx.fillStyle = '#222';     cx.fillRect(4, 5, 8, 2);
  })();
  const furnaceTex = new THREE.CanvasTexture(_furnaceC);
  furnaceTex.magFilter = THREE.NearestFilter; furnaceTex.minFilter = THREE.NearestFilter;
  furnaceTex.colorSpace = THREE.SRGBColorSpace;
  const furnaceMat = new THREE.MeshLambertMaterial({ map: furnaceTex });
  (() => {
    const tc = document.createElement('canvas'); tc.width = tc.height = 32;
    tc.getContext('2d').drawImage(_furnaceC, 0, 0, 16, 16, 0, 0, 32, 32);
    blockThumbs[FURNACE] = tc.toDataURL();
  })();

  // Wool texture (white fluffy)
  const _woolC = document.createElement('canvas'); _woolC.width = _woolC.height = 16;
  (() => {
    const cx = _woolC.getContext('2d');
    cx.fillStyle = '#eeeedd'; cx.fillRect(0,0,16,16);
    cx.fillStyle = '#dddccc';
    for (let i=0;i<16;i+=4) { cx.fillRect(i,0,2,16); cx.fillRect(0,i,16,2); }
    cx.fillStyle = '#ccccbb'; cx.fillRect(0,0,16,1); cx.fillRect(0,0,1,16);
  })();
  const woolTex = new THREE.CanvasTexture(_woolC);
  woolTex.magFilter = THREE.NearestFilter; woolTex.minFilter = THREE.NearestFilter;
  woolTex.colorSpace = THREE.SRGBColorSpace;
  const woolMat = new THREE.MeshLambertMaterial({ map: woolTex });
  (() => {
    const tc = document.createElement('canvas'); tc.width = tc.height = 32;
    tc.getContext('2d').drawImage(_woolC, 0, 0, 16, 16, 0, 0, 32, 32);
    blockThumbs[WOOL] = tc.toDataURL();
  })();
  // Try loading wool.png
  (() => {
    const img = new Image();
    img.onload = () => {
      const t = new THREE.TextureLoader().load('assets/wool.png');
      t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
      t.colorSpace = THREE.SRGBColorSpace;
      woolMat.map = t; woolMat.needsUpdate = true;
      const tc = document.createElement('canvas'); tc.width = tc.height = 32;
      const ctx = tc.getContext('2d'); ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, 32, 32);
      blockThumbs[WOOL] = tc.toDataURL();
      updateHotbarUI?.();
    };
    img.src = 'assets/wool.png';
  })();

  // Bed texture (red/brown)
  const _bedC = document.createElement('canvas'); _bedC.width = _bedC.height = 16;
  (() => {
    const cx = _bedC.getContext('2d');
    cx.fillStyle = '#c0392b'; cx.fillRect(0,0,16,16);
    cx.fillStyle = '#922b21'; cx.fillRect(0,0,16,2); cx.fillRect(0,14,16,2);
    cx.fillStyle = '#7b241c'; cx.fillRect(7,0,2,16);
    cx.fillStyle = '#f5b7b1'; cx.fillRect(1,3,6,10);
  })();
  const bedTex = new THREE.CanvasTexture(_bedC);
  bedTex.magFilter = THREE.NearestFilter; bedTex.minFilter = THREE.NearestFilter;
  bedTex.colorSpace = THREE.SRGBColorSpace;
  const bedMat = new THREE.MeshLambertMaterial({ map: bedTex });
  (() => {
    const tc = document.createElement('canvas'); tc.width = tc.height = 32;
    tc.getContext('2d').drawImage(_bedC, 0, 0, 16, 16, 0, 0, 32, 32);
    blockThumbs[BED] = tc.toDataURL();
  })();
  // Try loading bed.png
  (() => {
    const img = new Image();
    img.onload = () => {
      const t = new THREE.TextureLoader().load('assets/bed.png');
      t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
      t.colorSpace = THREE.SRGBColorSpace;
      bedMat.map = t; bedMat.needsUpdate = true;
      const tc = document.createElement('canvas'); tc.width = tc.height = 32;
      const ctx = tc.getContext('2d'); ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, 32, 32);
      blockThumbs[BED] = tc.toDataURL();
      updateHotbarUI?.();
    };
    img.src = 'assets/bed.png';
  })();

  // Chest texture (brown wood with darker lid line)
  const _chestC = document.createElement('canvas'); _chestC.width = _chestC.height = 16;
  (() => {
    const cx = _chestC.getContext('2d');
    cx.fillStyle = '#7a4a1e'; cx.fillRect(0,0,16,16);
    cx.fillStyle = '#5a3010'; cx.fillRect(0,7,16,2);   // lid divider
    cx.fillStyle = '#c8a060'; cx.fillRect(0,0,16,1);   // top edge
    cx.fillStyle = '#c8a060'; cx.fillRect(0,0,1,16);   // left edge
    cx.fillStyle = '#ffd080'; cx.fillRect(6,8,4,3);    // latch
  })();
  const chestTex = new THREE.CanvasTexture(_chestC);
  chestTex.magFilter = THREE.NearestFilter; chestTex.minFilter = THREE.NearestFilter;
  chestTex.colorSpace = THREE.SRGBColorSpace;
  const chestMat = new THREE.MeshLambertMaterial({ map: chestTex });
  (() => {
    const tc = document.createElement('canvas'); tc.width = tc.height = 32;
    tc.getContext('2d').drawImage(_chestC, 0, 0, 16, 16, 0, 0, 32, 32);
    blockThumbs[CHEST] = tc.toDataURL();
  })();
  // Try loading chestfront.jpeg / chestsides.jpeg
  (() => {
    const front = new Image(), side = new Image();
    let frontLoaded = false, sideLoaded = false;
    const tryApply = () => {
      if (!frontLoaded || !sideLoaded) return;
      // Use front texture for all faces (simplest approach)
      const t = new THREE.TextureLoader().load(front.src);
      t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
      t.colorSpace = THREE.SRGBColorSpace;
      chestMat.map = t; chestMat.needsUpdate = true;
      const tc = document.createElement('canvas'); tc.width = tc.height = 32;
      const ctx = tc.getContext('2d'); ctx.imageSmoothingEnabled = false;
      ctx.drawImage(front, 0, 0, front.width, front.height, 0, 0, 32, 32);
      blockThumbs[CHEST] = tc.toDataURL();
      if (running) { markAllChunksDirty(); updateHotbarUI(); }
    };
    front.onload = () => { frontLoaded = true; tryApply(); };
    side.onload  = () => { sideLoaded  = true; tryApply(); };
    front.onerror = () => { frontLoaded = true; tryApply(); };
    side.onerror  = () => { sideLoaded  = true; tryApply(); };
    front.src = 'assets/chestfront.png';
    side.src  = 'assets/chestsides.png';
  })();
  blockGeos[CHEST] = blockGeos[STONE];

  // ── Torch ────────────────────────────────────────────────────────────────
  // Torch is rendered as a custom object (not in chunk instanced mesh).
  // blockThumbs[TORCH] = small icon for hotbar/inventory.
  (() => {
    const tc = document.createElement('canvas'); tc.width = tc.height = 32;
    const cx = tc.getContext('2d');
    cx.fillStyle = '#8B5E3C'; cx.fillRect(14, 10, 4, 18); // stick
    cx.fillStyle = '#FF9900'; cx.fillRect(12, 5, 8, 8);   // flame body
    cx.fillStyle = '#FFEE44'; cx.fillRect(14, 3, 4, 4);   // flame tip
    cx.fillStyle = '#FF5500'; cx.fillRect(11, 7, 3, 4);   // flame left
    cx.fillStyle = '#FF5500'; cx.fillRect(18, 7, 3, 4);   // flame right
    blockThumbs[TORCH] = tc.toDataURL();
  })();

  // Pool of torch Three.js groups indexed by "wx,y,wz"
  const torchObjects = new Map();
  let torchScanDirty = true; // rebuild torch objects after chunk changes

  function _makeTorchMesh() {
    const grp = new THREE.Group();
    grp.frustumCulled = false;
    const pole = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.5, 0.1),
      new THREE.MeshLambertMaterial({ color: 0x8B5E3C })
    );
    pole.position.y = 0.3; grp.add(pole);
    const flame = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.2, 0.18),
      new THREE.MeshBasicMaterial({ color: 0xff9900 })
    );
    flame.position.y = 0.65; grp.add(flame);
    const tip = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.14, 0.1),
      new THREE.MeshBasicMaterial({ color: 0xffee44 })
    );
    tip.position.y = 0.8; grp.add(tip);
    return grp;
  }

  function _updateTorchObjects() {
    torchScanDirty = false;
    const pcx = Math.floor(player.pos.x / CHUNK_W);
    const pcz = Math.floor(player.pos.z / CHUNK_W);
    const seen = new Set();
    for (let dcx = -MESH_DIST; dcx <= MESH_DIST; dcx++) {
      for (let dcz = -MESH_DIST; dcz <= MESH_DIST; dcz++) {
        const cx = pcx + dcx, cz = pcz + dcz;
        if (!chunks.has(ckey(cx, cz))) continue;
        for (let lx = 0; lx < CHUNK_W; lx++) for (let lz = 0; lz < CHUNK_W; lz++) {
          const wx = cx * CHUNK_W + lx, wz = cz * CHUNK_W + lz;
          for (let y = 0; y < WY; y++) {
            if (getB(wx, y, wz) !== TORCH) continue;
            const key = wx + ',' + y + ',' + wz;
            seen.add(key);
            if (!torchObjects.has(key)) {
              const m = _makeTorchMesh();
              // Check for adjacent solid block to wall-mount the torch
              const wallDirs = [
                { dx:  1, dz:  0, rz:  0.38, rx:  0,    xOff:  0.32, zOff:  0    },
                { dx: -1, dz:  0, rz: -0.38, rx:  0,    xOff: -0.32, zOff:  0    },
                { dx:  0, dz:  1, rz:  0,    rx:  0.38, xOff:  0,    zOff:  0.32 },
                { dx:  0, dz: -1, rz:  0,    rx: -0.38, xOff:  0,    zOff: -0.32 },
              ];
              let tx = wx+0.5, ty = y, tz = wz+0.5;
              for (const w of wallDirs) {
                if (SOLID.has(getB(wx+w.dx, y, wz+w.dz))) {
                  tx += w.xOff; tz += w.zOff; ty += 0.2;
                  m.rotation.z = w.rz; m.rotation.x = w.rx;
                  break;
                }
              }
              m.position.set(tx, ty, tz);
              scene.add(m); torchObjects.set(key, m);
            }
          }
        }
      }
    }
    for (const [k, m] of torchObjects) {
      if (!seen.has(k)) { scene.remove(m); torchObjects.delete(k); }
    }
  }

  // Wool item thumbnail
  itemThumbs[ITEM_WOOL] = blockThumbs[WOOL]; // same as block

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

  // ── View-model hand ──────────────────────────────────────────────────────
  const hand = new THREE.Group();
  hand.position.set(0.42, -0.45, -0.65);
  hand.rotation.x = -0.35;
  camera.add(hand);
  let armSwing = 0;

  const handFlesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.55, 0.18),
    new THREE.MeshLambertMaterial({ color: 0xf5c896 })
  );
  hand.add(handFlesh);

  // Cache loaded tool textures so we don't reload every frame
  const _toolTexCache = {};
  function _getToolTex(src) {
    if (!_toolTexCache[src]) {
      const t = new THREE.TextureLoader().load(src);
      t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
      _toolTexCache[src] = t;
    }
    return _toolTexCache[src];
  }

  let handItemMesh = null;
  let _lastHandKey = '';

  function refreshHandItem() {
    if (handItemMesh) { hand.remove(handItemMesh); handItemMesh.geometry?.dispose(); handItemMesh = null; }
    const slot = inventory[hotbarSlot];
    if (!slot) { handFlesh.visible = true; return; }

    if (slot.kind === 'tool') {
      const tdef = TOOLS[slot.id];
      if (tdef?.img) {
        const tex = _getToolTex(tdef.img);
        const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.1, side: THREE.DoubleSide });
        // Large plane so the tool is clearly readable; tilted like holding it
        handItemMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), mat);
        handItemMesh.position.set(0.12, 0.05, -0.1);
        handItemMesh.rotation.set(-0.18, 0.18, 0.55);
        hand.add(handItemMesh);
        handFlesh.visible = false;
      } else { handFlesh.visible = true; }

    } else if (slot.kind === 'block') {
      const id = slot.block;
      if (id === TORCH) {
        const tex = _getToolTex('assets/torch.png');
        const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.1, side: THREE.DoubleSide });
        handItemMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), mat);
        handItemMesh.position.set(0.08, 0.02, -0.05);
        handItemMesh.rotation.set(-0.1, 0.15, 0.42);
      } else {
        const mat = (id === CRAFTING_TABLE) ? craftingTableMat
                  : (id === WATER)          ? waterMaterial
                  : (id === PLANK)          ? plankMat
                  : (id === FURNACE)        ? furnaceMat
                  : (id === WOOL)           ? woolMat
                  : (id === BED)            ? bedMat
                  : (id === CHEST)          ? chestMat
                  : (oreMaterials[id])      ? oreMaterials[id]
                                            : blockMaterial;
        const geo = (blockGeos[id] || blockGeos[STONE]).clone();
        geo.scale(0.42, 0.42, 0.42);
        handItemMesh = new THREE.Mesh(geo, mat);
        handItemMesh.position.set(0.04, -0.04, 0);
        handItemMesh.rotation.set(0.3, -0.45, 0.2);
      }
      hand.add(handItemMesh);
      handFlesh.visible = false;

    } else if (slot.kind === 'item') {
      const thumb = itemThumbs[slot.id];
      if (thumb) {
        const tex = _getToolTex(thumb);
        const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.05, side: THREE.DoubleSide });
        handItemMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), mat);
        handItemMesh.position.set(0.08, 0.02, -0.05);
        handItemMesh.rotation.set(-0.1, 0.15, 0.42);
        hand.add(handItemMesh);
        handFlesh.visible = false;
      } else { handFlesh.visible = true; }
    } else {
      handFlesh.visible = true;
    }
  }

  // ── Third-person player mesh ─────────────────────────────────────────────
  // Proportions: legs 0-0.75, torso 0.75-1.5, head 1.5-2.0
  let thirdPerson = false;
  const playerMeshGroup = new THREE.Group();

  const _pmLegR = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.75, 0.4),
    new THREE.MeshLambertMaterial({ color: 0x1a237e }));
  _pmLegR.position.set(0.15, 0.375, 0);
  playerMeshGroup.add(_pmLegR);

  const _pmLegL = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.75, 0.4),
    new THREE.MeshLambertMaterial({ color: 0x1a237e }));
  _pmLegL.position.set(-0.15, 0.375, 0);
  playerMeshGroup.add(_pmLegL);

  const _pmBody = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.75, 0.4),
    new THREE.MeshLambertMaterial({ color: 0x3f51b5 }));
  _pmBody.position.y = 1.125;
  playerMeshGroup.add(_pmBody);

  const _pmHead = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5),
    new THREE.MeshLambertMaterial({ color: 0xffd6a8 }));
  _pmHead.position.y = 1.75;
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
      // Three.js BoxGeometry face order: +X, -X, +Y, -Y, +Z(front), -Z(back)
      _pmHead.material = [
        faceMat( 0,8,8,8), faceMat(16,8,8,8),
        faceMat( 8,0,8,8), faceMat(16,0,8,8),
        faceMat( 8,8,8,8), faceMat(24,8,8,8),
      ];
      _pmBody.material = [
        faceMat(28,20,4,12), faceMat(16,20,4,12),
        faceMat(20,16,8,4),  faceMat(28,16,8,4),
        faceMat(32,20,8,12), faceMat(20,20,8,12),
      ];
      // Right leg skin: x=0-16 y=16-32 block
      _pmLegR.material = [
        faceMat(0,20,4,12), faceMat(8,20,4,12),
        faceMat(4,16,4,4),  faceMat(8,16,4,4),
        faceMat(12,20,4,12),faceMat(4,20,4,12),
      ];
      // Left leg: 64x64 skins have it at x=16-32 y=48-64.
      // Check logical height (actual px / scale factor) so high-res 128x64 skins don't false-positive.
      const logicalH = img.height / S;
      _pmLegL.material = logicalH >= 64 ? [
        faceMat(24,52,4,12), faceMat(16,52,4,12),
        faceMat(20,48,4,4),  faceMat(24,48,4,4),
        faceMat(28,52,4,12), faceMat(20,52,4,12),
      ] : [
        // Mirror right leg for 64x32 skins (swap L/R side faces)
        faceMat(8,20,4,12), faceMat(0,20,4,12),
        faceMat(4,16,4,4),  faceMat(8,16,4,4),
        faceMat(4,20,4,12), faceMat(12,20,4,12),
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
    // TORCH is non-solid/transparent — faces adjacent to it should be visible
    const ok = b => isWater ? (b === AIR) : (b === AIR || b === WATER || b === TORCH);
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
    forest:   { baseH:24, mtnAmp:26, hillAmp:14, detAmp: 7, surf:GRASS, snowH:54, treeRate:0.08  },
    plains:   { baseH:22, mtnAmp:16, hillAmp: 9, detAmp: 4, surf:GRASS, snowH:54, treeRate:0.018 },
    savanna:  { baseH:23, mtnAmp:20, hillAmp:11, detAmp: 6, surf:GRASS, snowH:999,treeRate:0.50  },
    desert:   { baseH:22, mtnAmp:18, hillAmp: 9, detAmp: 6, surf:SAND,  snowH:999,treeRate:0     },
    cold:     { baseH:23, mtnAmp:20, hillAmp:11, detAmp: 5, surf:SNOW,  snowH:10, treeRate:0.018 },
    mountain: { baseH:44, mtnAmp:72, hillAmp:24, detAmp:10, surf:STONE, snowH:48, treeRate:0.015 },
  };
  function getBiome(wx, wz) {
    const temp  = noise2(wx, wz, 0.006, worldSeed ^ 0xbabe1);
    const rough = noise2(wx, wz, 0.007, worldSeed ^ 0xdead3);
    const moist = noise2(wx, wz, 0.006, worldSeed ^ 0xcafe2);
    if (rough > 0.45) return 'mountain';
    if (temp > 0.82 && moist < 0.22) return 'desert';
    if (temp > 0.58) return 'savanna';
    if (temp < 0.15) return 'cold';
    if (moist < 0.38) return 'plains';
    return 'forest';
  }
  function heightAt(wx, wz) {
    const n2 = noise2(wx, wz, 0.032, worldSeed^0x9e37) - 0.50;  // hill scale
    const n3 = noise2(wx, wz, 0.14,  worldSeed^0x12af);          // fine detail
    // Blend biome base height over 24-block radius
    let bH=0, bD=0, tw=0;
    for (let dz=-24; dz<=24; dz+=8) {
      for (let dx=-24; dx<=24; dx+=8) {
        const d2=dx*dx+dz*dz; if (d2>24*24) continue;
        const w=1-Math.sqrt(d2)/24;
        const b=BIOMES[getBiome(wx+dx, wz+dz)];
        bH+=b.baseH*w; bD+=b.detAmp*w; tw+=w;
      }
    }
    // Dedicated mountain ridge noise — two octaves so peaks appear every ~50 blocks
    const mRaw = noise2(wx, wz, 0.018, worldSeed^0xbe3f) * 0.65
               + noise2(wx, wz, 0.009, worldSeed^0xca77) * 0.35;
    const mtnBoost = mRaw > 0.35 ? Math.pow((mRaw - 0.35) / 0.65, 1.3) * 38 : 0;
    const h = bH/tw + n2*10 + n3*(bD/tw) + mtnBoost;
    return Math.max(2, Math.min(WY-4, Math.floor(h)));
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

    // PvP: flat infinite grass arena, no terrain variation
    if (gameType === 'pvp') {
      for (let lz = 0; lz < CHUNK_W; lz++) for (let lx = 0; lx < CHUNK_W; lx++) {
        set(lx, 0, lz, BEDROCK);
        for (let y = 1; y < SEA_LEVEL - 1; y++) set(lx, y, lz, STONE);
        set(lx, SEA_LEVEL - 1, lz, DIRT);
        set(lx, SEA_LEVEL,     lz, GRASS);
      }
      return buf;
    }

    // Sample biome at chunk centre for consistent surface rules
    const biome = getBiome(cx * CHUNK_W + CHUNK_W/2, cz * CHUNK_W + CHUNK_W/2);
    const bp = BIOMES[biome];

    const heights = new Int32Array(CHUNK_W * CHUNK_W);
    const biomes  = new Array(CHUNK_W * CHUNK_W);
    for (let lz = 0; lz < CHUNK_W; lz++) {
      for (let lx = 0; lx < CHUNK_W; lx++) {
        const wx = cx * CHUNK_W + lx, wz = cz * CHUNK_W + lz;
        // Blend biome surface type over 24-block radius for gradual transitions
        const biomeWeights = {};
        for (let bz=-24; bz<=24; bz+=12) for (let bx=-24; bx<=24; bx+=12) {
          const d2=bx*bx+bz*bz; if (d2>576) continue;
          const bw=1-Math.sqrt(d2)/24;
          const bn=getBiome(wx+bx,wz+bz);
          biomeWeights[bn]=(biomeWeights[bn]||0)+bw;
        }
        const col_biome = Object.keys(biomeWeights).reduce((a,b)=>biomeWeights[a]>biomeWeights[b]?a:b);
        const col_bp = BIOMES[col_biome];
        const h = heightAt(wx, wz);
        heights[lz * CHUNK_W + lx] = h;
        biomes[lz * CHUNK_W + lx]  = col_biome;
        for (let y = 0; y < h; y++) {
          if (y === 0) set(lx, y, lz, BEDROCK);
          else if (y < h - 4) set(lx, y, lz, STONE);
          else set(lx, y, lz, DIRT);
        }
        const surf = h - 1;
        if (surf >= 46)                    set(lx, surf, lz, SNOW);
        else if (surf >= 38)               set(lx, surf, lz, STONE);
        else if (surf <= SEA_LEVEL - 1)    set(lx, surf, lz, SAND);
        else                               set(lx, surf, lz, col_bp.surf);
        for (let y = h; y <= SEA_LEVEL; y++) set(lx, y, lz, WATER);
      }
    }

    // Cave carving
    for (let lz = 0; lz < CHUNK_W; lz++) {
      for (let lx = 0; lx < CHUNK_W; lx++) {
        const wx = cx * CHUNK_W + lx, wz = cz * CHUNK_W + lz;
        const h = heights[lz * CHUNK_W + lx];
        for (let y = 1; y < h - 1; y++) {
          const idx = (y * CHUNK_W + lz) * CHUNK_W + lx;
          // Worm tunnels: lower frequency = longer tunnels
          const n1 = noise3(wx, y, wz, 0.028, worldSeed ^ 0xc0ffee);
          const n2 = noise3(wx, y, wz, 0.028, worldSeed ^ 0xdeadbe);
          if (Math.abs(n1 - 0.5) < 0.15 && Math.abs(n2 - 0.5) < 0.15)
            { buf[idx] = AIR; continue; }
          // Wide canyon tunnels at a different scale for variety
          const n5 = noise3(wx, y, wz, 0.014, worldSeed ^ 0xa1b2c3);
          const n6 = noise3(wx, y, wz, 0.014, worldSeed ^ 0xd4e5f6);
          if (Math.abs(n5 - 0.5) < 0.10 && Math.abs(n6 - 0.5) < 0.10)
            { buf[idx] = AIR; continue; }
          // Cheese caverns: larger blobs
          const n3 = noise3(wx, y, wz, 0.018, worldSeed ^ 0xf00d);
          if (n3 > 0.74)
            { buf[idx] = AIR; continue; }
          // Spaghetti caves: long narrow tunnels
          const n4 = noise3(wx, y, wz, 0.045, worldSeed ^ 0x5ca1ab1e);
          if (Math.abs(n4 - 0.5) < 0.072)
            buf[idx] = AIR;
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
      { id: COAL_ORE,     minY: 6,  maxY: 18, count: 32, vein: 8 },
      { id: COPPER_ORE,   minY: 5,  maxY: 15, count: 18, vein: 7 },
      { id: IRON_ORE,     minY: 4,  maxY: 14, count: 24, vein: 7 },
      { id: GOLD_ORE,     minY: 2,  maxY:  9, count: 10, vein: 6 },
      { id: REDSTONE_ORE, minY: 2,  maxY:  8, count: 10, vein: 6 },
      { id: DIAMOND_ORE,  minY: 1,  maxY:  5, count:  6, vein: 5 },
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
    torchScanDirty = true;
  }
  function markAllChunksDirty() {
    for (const m of chunkMeshes.values()) m.dirty = true;
    torchScanDirty = true;
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
      if (b === AIR || b === TORCH) continue; // torches rendered separately
      if (!isFaceVisible(b, x0 + lx, y, z0 + lz)) continue;
      counts[b] = (counts[b] || 0) + 1;
    }

    const dummy = new THREE.Object3D();
    for (const idStr of Object.keys(counts)) {
      const id = +idStr;
      const geo = blockGeos[id] || blockGeos[STONE];
      const mat = (id === WATER)          ? waterMaterial
                : (id === CRAFTING_TABLE) ? craftingTableMat
                : (id === PLANK)          ? plankMat
                : (id === FURNACE)        ? furnaceMat
                : (id === WOOL)           ? woolMat
                : (id === BED)            ? bedMat
                : (id === CHEST)          ? chestMat
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
    const ox = Math.floor(player.pos.x), oz = Math.floor(player.pos.z);
    for (let r = 0; r < CHUNK_W * (MESH_DIST + 1); r++) {
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const x = ox + dx, z = oz + dz;
        const cx = Math.floor(x / CHUNK_W), cz = Math.floor(z / CHUNK_W);
        if (!chunks.has(ckey(cx, cz))) continue;
        // Scan top-down for the highest non-tree solid block with 2 blocks headroom
        for (let y = WY - 2; y > SEA_LEVEL; y--) {
          const b = getB(x, y, z);
          if (!isSolidAt(x, y, z)) continue;
          if (b === WOOD || b === LEAVES) continue; // skip tree parts
          if (isSolidAt(x, y+1, z) || isSolidAt(x, y+2, z)) continue;
          return new THREE.Vector3(x + 0.5, y + 1, z + 0.5);
        }
      }
    }
    return new THREE.Vector3(ox + 0.5, WY / 2, oz + 0.5);
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
  function headInWater() {
    return getB(Math.floor(player.pos.x), Math.floor(player.pos.y + EYE), Math.floor(player.pos.z)) === WATER;
  }
  function updateAirHUD(show) {
    const row = document.getElementById('airRow');
    if (!row) return;
    row.style.display = show ? 'flex' : 'none';
    if (!show) return;
    row.innerHTML = '';
    for (let i = 0; i < 10; i++) {
      const span = document.createElement('span');
      span.className = 'hud-air';
      const filled = playerAir / maxAir > i / 10;
      span.textContent = filled ? '◉' : '○';
      span.style.color = filled ? '#5cf' : '#444';
      row.appendChild(span);
    }
  }

  function tick(dt) {
    if (playerDead) return; // freeze player while death screen is up
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
    let speed = (gameMode === 'creative' && flying && inputKeys.ctrl) ? playerSpeed * 4.0
              : (inputKeys.sprint && f > 0) ? playerSpeed * 1.45 : playerSpeed;
    if (inWaterNow) speed *= 0.6;
    const vx = dxn * speed, vz = dzn * speed;

    let wasGrounded = isGrounded(player.pos.x, player.pos.y, player.pos.z);
    const newX = player.pos.x + vx * dt;
    if (!collidesAt(newX, player.pos.y, player.pos.z)) player.pos.x = newX;
    else if (!flying && (wasGrounded || inWaterNow) && !collidesAt(newX, player.pos.y + 1.0, player.pos.z)
             && !collidesAt(player.pos.x, player.pos.y + 1.0, player.pos.z)) {
      player.pos.x = newX; player.pos.y += 1.0;
    }
    const newZ = player.pos.z + vz * dt;
    if (!collidesAt(player.pos.x, player.pos.y, newZ)) player.pos.z = newZ;
    else if (!flying && (wasGrounded || inWaterNow) && !collidesAt(player.pos.x, player.pos.y + 1.0, newZ)
             && !collidesAt(player.pos.x, player.pos.y + 1.0, player.pos.z)) {
      player.pos.z = newZ; player.pos.y += 1.0;
    }

    wasGrounded = isGrounded(player.pos.x, player.pos.y, player.pos.z);

    if (gameMode === 'creative' && flying) {
      // Creative fly — direct velocity, no momentum (prevents oscillation)
      //   Space = rise · Shift = descend · Ctrl = faster
      const flySpeed = inputKeys.ctrl ? 22 : 9;
      flyVy = inputKeys.jump ? flySpeed : inputKeys.sprint ? -flySpeed : 0;
      if (flyVy !== 0) {
        const newY = player.pos.y + flyVy * dt;
        if (!collidesAt(player.pos.x, newY, player.pos.z)) player.pos.y = newY;
        // on collision just don't move — no velocity reset needed since it's direct
      }
      player.vy = 0; player.grounded = false;
    } else {
      if (inputKeys.jump && wasGrounded) {
        player.vy = jumpStrength; player.grounded = false;
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
        if (gameMode === 'survival') takeDamage(4); // void damage
        const sp = findSpawn(); player.pos.copy(sp); player.vy = 0;
      }
    }

    // ── Fall damage (survival only, not in PvP) ─────────────────────────
    if (gameMode === 'survival' && !flying && gameType !== 'pvp') {
      if (!player.grounded) {
        if (airPeakY === null || player.pos.y > airPeakY) airPeakY = player.pos.y;
      } else if (!prevWasGrounded && airPeakY !== null) {
        const fallDist = airPeakY - player.pos.y;
        if (fallDist > 4 && !inWater()) takeDamage(Math.floor(fallDist - 4));
        airPeakY = null;
      }
    }
    prevWasGrounded = player.grounded;

    if (thirdPerson) {
      const DIST = 4;
      const px = player.pos.x, py = player.pos.y, pz = player.pos.z;
      const eyeY = py + EYE;
      // Orbit camera: sits DIST behind the player eye in both yaw and pitch planes
      // forward direction = (-sin(yaw)*cos(pitch), sin(pitch), -cos(yaw)*cos(pitch))
      // camera goes the opposite way
      const camX = px + Math.sin(player.yaw) * Math.cos(player.pitch) * DIST;
      const camY = eyeY - Math.sin(player.pitch) * DIST;
      const camZ = pz + Math.cos(player.yaw) * Math.cos(player.pitch) * DIST;
      camera.position.set(camX, camY, camZ);
      camera.lookAt(px, eyeY, pz);
      hand.visible = false;
      playerMeshGroup.position.set(px, py, pz);
      playerMeshGroup.rotation.y = player.yaw;
      _pmHead.rotation.x = player.pitch;
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
  function triggerWaterSpread(x, y, z) {
    // Water was just placed — spread it downward then sideways
    const visited = new Set([ek(x,y,z)]);
    const queue = [[x,y,z,0]];
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
    // Gravity blocks: cascade any sand/snow fall upward from cleared block
    let clearY = y;
    while (clearY + 1 < WY && (getB(x, clearY+1, z) === SAND || getB(x, clearY+1, z) === SNOW)) {
      const fromY = clearY + 1;
      const fallingB = getB(x, fromY, z);
      let landY = clearY;
      while (landY > 0 && getB(x, landY-1, z) === AIR) landY--;
      setB(x, fromY, z, AIR);      bcast('block', {x, y:fromY, z, v:AIR});
      setB(x, landY, z, fallingB); bcast('block', {x, y:landY, z, v:fallingB});
      clearY = fromY;
    }
    // Water flow from adjacent water sources
    triggerFlow(x, y, z);
  }

  // ── Mining ───────────────────────────────────────────────────────────────
  let mouseDownLeft = false;
  let mining = null;
  let mobAttackCooldown = 0;

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
      if (total === Infinity || total == null) return;
      // total=0 means instant-mine; use a tiny floor so the crack animation still ticks once
      mining = { x: hit.x, y: hit.y, z: hit.z, timer: 0, total: Math.max(total, 0.05), block: blk, tool };
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
        const t = mining.tool != null ? TOOLS[mining.tool] : null;
        // Only snow requires the right tool kind (shovel) to drop — everything else drops freely
        const needsShovel = blk === SNOW;
        const hasShovel = t && t.kind === 'shovel';
        if (!needsShovel || hasShovel) {
          spawnDrop(bx + 0.5, by + 0.5, bz + 0.5, blk === GRASS ? DIRT : blk);
          if (blk === WOOD) queueLeafDecay(bx, by, bz);
        }
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
    // Right-click on furnace → open furnace UI
    if (getB(hit.x, hit.y, hit.z) === FURNACE) {
      openFurnace(hit.x, hit.y, hit.z); return;
    }
    // Right-click on chest → open chest inventory
    if (getB(hit.x, hit.y, hit.z) === CHEST) {
      openChest(); return;
    }
    // Right-click on bed → set respawn point
    if (getB(hit.x, hit.y, hit.z) === BED) {
      spawnPoint = { x: player.pos.x, y: player.pos.y, z: player.pos.z };
      const toast = document.createElement('div');
      toast.style.cssText='position:absolute;top:40%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.75);color:#fff;font:bold 1.1rem sans-serif;padding:12px 24px;border-radius:10px;z-index:50;pointer-events:none;';
      toast.textContent='💤 Respawn point set!';
      document.getElementById('mcApp').appendChild(toast);
      setTimeout(()=>toast.remove(), 2000);
      return;
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
    if (!slot.infinite && gameMode !== 'creative') {
      slot.count--;
      if (slot.count <= 0) inventory[hotbarSlot] = null;
    }
    updateHotbarUI();
    bcast('block', { x:px, y:py, z:pz, v:blk });
    if (blk === WATER) triggerWaterSpread(px, py, pz);
  }

  // ── Eating ───────────────────────────────────────────────────────────────
  function tryEat() {
    const slot = inventory[hotbarSlot];
    if (!slot || slot.kind !== 'item') return false;
    const restore = FOOD_RESTORE[slot.id];
    if (restore == null) return false;
    // Allow eating unless both hunger and health are completely full
    if (gameMode === 'survival' && playerHunger >= maxHunger && playerHealth >= maxHealth) return false;
    playerHunger = Math.min(maxHunger, playerHunger + restore);
    playerHealth  = Math.min(maxHealth,  playerHealth  + Math.floor(restore / 2));
    updateHealthHUD();
    if (!slot.infinite && gameMode !== 'creative') {
      slot.count--;
      if (slot.count <= 0) inventory[hotbarSlot] = null;
    }
    updateHotbarUI();
    return true;
  }

  // ── Dropped items ────────────────────────────────────────────────────────
  const drops = [];
  const ITEM_DROP_COLOR = {
    [ITEM_STICK]: 0xa07030, [ITEM_APPLE]: 0xdd2211,
    [ITEM_IRON]: 0xcccccc, [ITEM_DIAMOND_GEM]: 0x55eeff,
    [ITEM_GOLD]: 0xffcc00, [ITEM_COAL]: 0x333333,
  };

  function _spawnDrop(x, y, z, blockId, itemId) {
    if (gameMode === 'creative') return; // creative has infinite items, no drops needed
    let mesh;
    if (itemId != null) {
      const thumb = itemThumbs[itemId];
      if (thumb) {
        const tex = new THREE.TextureLoader().load(thumb);
        tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
        const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.05, side: THREE.DoubleSide });
        mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.38), mat);
      } else {
        const geo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
        const mat = new THREE.MeshLambertMaterial({ color: ITEM_DROP_COLOR[itemId] || 0xffffff });
        mesh = new THREE.Mesh(geo, mat);
      }
    } else {
      const baseGeo = blockGeos[blockId] || blockGeos[STONE];
      const geo = baseGeo.clone();
      geo.scale(0.32, 0.32, 0.32);
      const mat = (blockId === WATER)          ? waterMaterial
                : (blockId === CRAFTING_TABLE) ? craftingTableMat
                : (blockId === PLANK)          ? plankMat
                : (blockId === FURNACE)        ? furnaceMat
                : (blockId === WOOL)           ? woolMat
                : (blockId === BED)            ? bedMat
                : (blockId === CHEST)          ? chestMat
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

  // ── Mobs ──────────────────────────────────────────────────────────────────
  const MOB_DEFS = {
    cow: {
      health: 10, speed: 2.2, hostile: false,
      drop: ITEM_BEEF, dropMin: 1, dropMax: 2,
      bodyColor: 0x5c3317, headColor: 0x7a4420,
    },
    sheep: {
      health: 8, speed: 2.0, hostile: false,
      dropBlock: WOOL, dropMin: 1, dropMax: 2,
      bodyColor: 0xe8e8e0, headColor: 0xddddcc,
    },
    zombie: {
      health: 20, speed: 3.2, hostile: true,
      drop: null, dropMin: 0, dropMax: 0,
      bodyColor: 0x3a7a50, headColor: 0x55aa70,
    },
  };
  const MAX_COWS = 6, MAX_ZOMBIES = 5;
  let mobs = [];
  let mobIdCtr = 0;
  let mobSpawnTimer = 5;

  function isNight() { return (worldTime % DAY_LENGTH) / DAY_LENGTH > 0.5; }
  function dayFrac()  { return (worldTime % DAY_LENGTH) / DAY_LENGTH; }

  function inSunlight(x, y, z) {
    for (let dy = 1; dy <= 20; dy++) {
      if (isSolidAt(Math.floor(x), Math.floor(y) + dy, Math.floor(z))) return false;
    }
    return true;
  }

  function _makeMobMesh(type) {
    const def = MOB_DEFS[type];
    const grp = new THREE.Group();
    grp.frustumCulled = false;
    const mk = (geo, col) => {
      const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: col }));
      m.frustumCulled = false; return m;
    };
    // Helper: slice one face from a skin image and return a MeshLambertMaterial
    const faceMat = (img, sx, sy, sw, sh) => {
      const S = img.width / 64;
      const c = document.createElement('canvas'); c.width = sw; c.height = sh;
      const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, sx*S, sy*S, sw*S, sh*S, 0, 0, sw, sh);
      const t = new THREE.CanvasTexture(c);
      t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
      return new THREE.MeshLambertMaterial({ map: t });
    };
    if (type === 'cow') {
      const body = mk(new THREE.BoxGeometry(0.9, 0.65, 1.4), def.bodyColor);
      body.position.set(0, 0.95, 0); grp.add(body);
      const head = mk(new THREE.BoxGeometry(0.55, 0.5, 0.55), def.headColor);
      head.position.set(0, 1.45, -0.68); grp.add(head);
      const nose = mk(new THREE.BoxGeometry(0.32, 0.2, 0.08), 0xffb3a0);
      nose.position.set(0, 1.33, -0.95); grp.add(nose);
      const legPositions = [[0.27, 0.47], [-0.27, 0.47], [0.27, -0.47], [-0.27, -0.47]];
      const legs = [];
      for (const [lx, lz] of legPositions) {
        const leg = mk(new THREE.BoxGeometry(0.22, 0.65, 0.22), def.bodyColor);
        leg.position.set(lx, 0.325, lz); grp.add(leg); legs.push(leg);
      }
      grp.userData.legs = legs;
      // Apply cow.png skin
      const img = new Image();
      img.onload = () => {
        // Cow skin: head front at roughly same coords as Steve
        head.material = [
          faceMat(img, 0,8,8,8), faceMat(img,16,8,8,8),
          faceMat(img, 8,0,8,8), faceMat(img,16,0,8,8),
          faceMat(img, 8,8,8,8), faceMat(img,24,8,8,8),
        ];
        body.material = [
          faceMat(img,28,20,4,12), faceMat(img,16,20,4,12),
          faceMat(img,20,16,8,4),  faceMat(img,28,16,8,4),
          faceMat(img,32,20,8,12), faceMat(img,20,20,8,12),
        ];
        for (const leg of legs) {
          leg.material = [
            faceMat(img,0,20,4,12), faceMat(img,8,20,4,12),
            faceMat(img,4,16,4,4),  faceMat(img,8,16,4,4),
            faceMat(img,12,20,4,12),faceMat(img,4,20,4,12),
          ];
        }
      };
      img.src = 'assets/cow.png';
    } else if (type === 'sheep') {
      // Sheep: fluffy body
      const body = mk(new THREE.BoxGeometry(0.85, 0.7, 1.3), def.bodyColor);
      body.position.set(0, 0.88, 0); grp.add(body);
      const head = mk(new THREE.BoxGeometry(0.5, 0.5, 0.5), def.headColor);
      head.position.set(0, 1.4, -0.58); grp.add(head);
      const legPositions = [[0.24,0.42],[-0.24,0.42],[0.24,-0.42],[-0.24,-0.42]];
      const legs = [];
      for (const [lx,lz] of legPositions) {
        const leg = mk(new THREE.BoxGeometry(0.2,0.6,0.2), def.bodyColor);
        leg.position.set(lx,0.3,lz); grp.add(leg); legs.push(leg);
      }
      grp.userData.legs = legs;
      // Try sheep.png skin
      const img = new Image();
      img.onload = () => {
        const S = img.width / 64;
        const fm = (sx,sy,sw,sh) => {
          const c = document.createElement('canvas'); c.width=sw; c.height=sh;
          const ctx=c.getContext('2d'); ctx.imageSmoothingEnabled=false;
          ctx.drawImage(img,sx*S,sy*S,sw*S,sh*S,0,0,sw,sh);
          const t=new THREE.CanvasTexture(c); t.magFilter=THREE.NearestFilter; t.minFilter=THREE.NearestFilter;
          return new THREE.MeshLambertMaterial({map:t});
        };
        head.material=[fm(0,8,8,8),fm(16,8,8,8),fm(8,0,8,8),fm(16,0,8,8),fm(8,8,8,8),fm(24,8,8,8)];
        body.material=[fm(28,20,4,12),fm(16,20,4,12),fm(20,16,8,4),fm(28,16,8,4),fm(32,20,8,12),fm(20,20,8,12)];
        for(const leg of legs) leg.material=[fm(0,20,4,12),fm(8,20,4,12),fm(4,16,4,4),fm(8,16,4,4),fm(12,20,4,12),fm(4,20,4,12)];
      };
      img.src='assets/sheep.png';
    } else {
      // Zombie: humanoid, arms outstretched
      const legR = mk(new THREE.BoxGeometry(0.29, 0.75, 0.4), def.bodyColor);
      legR.position.set(0.15, 0.375, 0); grp.add(legR);
      const legL = mk(new THREE.BoxGeometry(0.29, 0.75, 0.4), def.bodyColor);
      legL.position.set(-0.15, 0.375, 0); grp.add(legL);
      const body = mk(new THREE.BoxGeometry(0.6, 0.75, 0.4), def.bodyColor);
      body.position.y = 1.125; grp.add(body);
      const head = mk(new THREE.BoxGeometry(0.5, 0.5, 0.5), def.headColor);
      head.position.y = 1.75; grp.add(head);
      const armR = mk(new THREE.BoxGeometry(0.29, 0.75, 0.4), def.bodyColor);
      armR.rotation.x = -Math.PI / 2;
      armR.position.set(0.45, 1.3, -0.4); grp.add(armR);
      const armL = mk(new THREE.BoxGeometry(0.29, 0.75, 0.4), def.bodyColor);
      armL.rotation.x = -Math.PI / 2;
      armL.position.set(-0.45, 1.3, -0.4); grp.add(armL);
      grp.userData.legR = legR; grp.userData.legL = legL;
      // Apply zombie.png skin (same UV layout as Steve)
      const img = new Image();
      img.onload = () => {
        head.material = [
          faceMat(img, 0,8,8,8), faceMat(img,16,8,8,8),
          faceMat(img, 8,0,8,8), faceMat(img,16,0,8,8),
          faceMat(img, 8,8,8,8), faceMat(img,24,8,8,8),
        ];
        body.material = [
          faceMat(img,28,20,4,12), faceMat(img,16,20,4,12),
          faceMat(img,20,16,8,4),  faceMat(img,28,16,8,4),
          faceMat(img,32,20,8,12), faceMat(img,20,20,8,12),
        ];
        legR.material = [
          faceMat(img,0,20,4,12), faceMat(img,8,20,4,12),
          faceMat(img,4,16,4,4),  faceMat(img,8,16,4,4),
          faceMat(img,12,20,4,12),faceMat(img,4,20,4,12),
        ];
        legL.material = legR.material; // mirror for simplicity
        armR.material = body.material;
        armL.material = body.material;
      };
      img.src = 'assets/zombie.png';
    }
    scene.add(grp);
    return grp;
  }

  function _spawnMob(type, x, y, z) {
    const def = MOB_DEFS[type];
    const mesh = _makeMobMesh(type);
    mesh.position.set(x, y, z);
    mobs.push({
      id: mobIdCtr++, type, def,
      pos: { x, y, z }, vy: 0, grounded: false,
      health: def.health,
      mesh,
      walkTimer: Math.random() * 4,
      walkAngle: Math.random() * Math.PI * 2,
      walkAngleActive: true,
      attackTimer: 0,
      walkLegT: 0,
      knockX: 0, knockZ: 0,
      hitFlash: 0,
    });
  }

  function _trySpawnMobs() {
    const px = player.pos.x, py = player.pos.y, pz = player.pos.z;
    const night = isNight();
    let cows = 0, zombies = 0;
    for (const m of mobs) {
      const dx = m.pos.x - px, dz = m.pos.z - pz;
      if (dx*dx + dz*dz < 64*64) {
        if (m.type === 'cow') cows++;
        else if (m.type === 'zombie') zombies++;
      }
    }
    const MAX_SHEEP = 4;
    let sheep_count = 0;
    for (const m of mobs) { const dx=m.pos.x-px,dz=m.pos.z-pz; if(dx*dx+dz*dz<64*64&&m.type==='sheep') sheep_count++; }
    // Try spawn cow (day only)
    if (!night && cows < MAX_COWS) {
      for (let a = 0; a < 10; a++) {
        const ang = Math.random() * Math.PI * 2;
        const dist = 18 + Math.random() * 30;
        const sx = Math.round(px + Math.cos(ang) * dist);
        const sz = Math.round(pz + Math.sin(ang) * dist);
        for (let gy = Math.min(WY-2, Math.floor(py) + 24); gy >= 2; gy--) {
          if (isSolidAt(sx, gy, sz) && !isSolidAt(sx, gy+1, sz) && !isSolidAt(sx, gy+2, sz)) {
            if (getB(sx, gy, sz) === GRASS) {
              _spawnMob('cow', sx + 0.5, gy + 1, sz + 0.5);
            }
            break;
          }
        }
        if (mobs.filter(m=>m.type==='cow').length > cows) break;
      }
    }
    // Try spawn sheep (day only, like cows)
    if (!night && sheep_count < MAX_SHEEP) {
      for (let a = 0; a < 8; a++) {
        const ang = Math.random() * Math.PI * 2;
        const dist = 18 + Math.random() * 28;
        const sx = Math.round(px + Math.cos(ang) * dist);
        const sz = Math.round(pz + Math.sin(ang) * dist);
        for (let gy = Math.min(WY-2, Math.floor(py) + 24); gy >= 2; gy--) {
          if (isSolidAt(sx,gy,sz) && !isSolidAt(sx,gy+1,sz) && !isSolidAt(sx,gy+2,sz)) {
            if (getB(sx,gy,sz) === GRASS) { _spawnMob('sheep', sx+0.5, gy+1, sz+0.5); }
            break;
          }
        }
        if (mobs.filter(m=>m.type==='sheep').length > sheep_count) break;
      }
    }
    // Try spawn zombie (night only, survival only)
    if (night && zombies < MAX_ZOMBIES && gameMode === 'survival') {
      for (let a = 0; a < 10; a++) {
        const ang = Math.random() * Math.PI * 2;
        const dist = 16 + Math.random() * 24;
        const sx = Math.round(px + Math.cos(ang) * dist);
        const sz = Math.round(pz + Math.sin(ang) * dist);
        for (let gy = Math.min(WY-2, Math.floor(py) + 20); gy >= 2; gy--) {
          if (isSolidAt(sx, gy, sz) && !isSolidAt(sx, gy+1, sz) && !isSolidAt(sx, gy+2, sz)) {
            _spawnMob('zombie', sx + 0.5, gy + 1, sz + 0.5);
            break;
          }
        }
        if (mobs.filter(m=>m.type==='zombie').length > zombies) break;
      }
    }
  }

  function _killMob(mob) {
    const { def, pos } = mob;
    if (def.drop) {
      const n = def.dropMin + Math.floor(Math.random() * (def.dropMax - def.dropMin + 1));
      if (n > 0) spawnItemDrop(pos.x, pos.y + 0.5, pos.z, def.drop);
    }
    if (def.dropBlock) {
      const n = def.dropMin + Math.floor(Math.random() * (def.dropMax - def.dropMin + 1));
      if (n > 0) spawnDrop(pos.x, pos.y + 0.5, pos.z, def.dropBlock);
    }
    scene.remove(mob.mesh);
    const idx = mobs.indexOf(mob);
    if (idx >= 0) mobs.splice(idx, 1);
  }

  function hitMob(mob, damage) {
    mob.health -= damage;
    mob.hitFlash = 0.25; // seconds of red tint
    // Flash red
    mob.mesh.traverse(child => {
      if (child.isMesh) {
        child.userData._origColor = child.userData._origColor ?? (Array.isArray(child.material)
          ? child.material.map(m => m.color?.getHex?.() ?? 0xffffff)
          : child.material.color?.getHex?.() ?? 0xffffff);
        const setRed = m => { if (m.color) m.color.setHex(0xff2222); };
        if (Array.isArray(child.material)) child.material.forEach(setRed);
        else setRed(child.material);
      }
    });
    // Knockback away from player
    const dx = mob.pos.x - player.pos.x, dz = mob.pos.z - player.pos.z;
    const len = Math.hypot(dx, dz) || 1;
    mob.vy = 4;
    mob.knockX = (dx / len) * 6;
    mob.knockZ = (dz / len) * 6;
    if (mob.health <= 0) { _killMob(mob); return true; }
    return false;
  }

  function tryMobAttack() {
    const eyePos = camera.position.clone();
    const fwd = new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion).normalize();
    const toolId = getSelectedTool();
    const tool = TOOLS[toolId];
    // Creative mode: one-shot kill; survival: normal damage
    const damage = gameMode === 'creative' ? Infinity
      : !tool ? 1
      : tool.kind === 'sword'   ? 3 + tool.tier
      : tool.kind === 'axe'     ? 2 + tool.tier
      : tool.kind === 'pickaxe' ? 1 + (tool.tier >> 1)
      : 1; // shovel / fist
    let bestMob = null, bestDist = REACH + 1;
    for (const mob of mobs) {
      const mp = new THREE.Vector3(mob.pos.x, mob.pos.y + 0.9, mob.pos.z);
      const toM = mp.clone().sub(eyePos);
      const dist = toM.length();
      if (dist > REACH) continue;
      if (toM.normalize().dot(fwd) < 0.55) continue;
      if (dist < bestDist) { bestDist = dist; bestMob = mob; }
    }
    if (!bestMob) return false;
    hitMob(bestMob, damage);
    armSwing = Math.PI * 0.4;
    return true;
  }

  // ── Grass spread ─────────────────────────────────────────────────────────
  let _grassTimer = 0;
  function updateGrassSpread(dt) {
    _grassTimer -= dt;
    if (_grassTimer > 0) return;
    _grassTimer = 2; // run every ~2 seconds

    // Sample a small patch of blocks around the player
    const px = Math.round(player.pos.x), pz = Math.round(player.pos.z);
    const R = 16;
    for (let i = 0; i < 12; i++) {
      const bx = px + Math.floor(Math.random() * (R*2+1)) - R;
      const bz = pz + Math.floor(Math.random() * (R*2+1)) - R;
      for (let by = 0; by < WY - 1; by++) {
        if (getB(bx, by, bz) !== DIRT) continue;
        if (getB(bx, by + 1, bz) !== AIR) continue; // must have air above

        // Check for a grass neighbour within ±1 horizontally and ±2 vertically
        let hasGrass = false;
        outer: for (let dx = -1; dx <= 1; dx++) {
          for (let dz = -1; dz <= 1; dz++) {
            for (let dy = -2; dy <= 2; dy++) {
              if (getB(bx+dx, by+dy, bz+dz) === GRASS) { hasGrass = true; break outer; }
            }
          }
        }
        if (!hasGrass) continue;

        // ~15% chance to spread per candidate per 2-second tick
        if (Math.random() > 0.15) continue;

        setB(bx, by, bz, GRASS);
        bcast('block', { x:bx, y:by, z:bz, v:GRASS });
      }
    }
  }

  function updateMobs(dt) {
    mobSpawnTimer -= dt;
    if (mobSpawnTimer <= 0) { mobSpawnTimer = 8; _trySpawnMobs(); }

    const px = player.pos.x, py = player.pos.y, pz = player.pos.z;
    const night = isNight();

    for (let i = mobs.length - 1; i >= 0; i--) {
      const mob = mobs[i];
      const { pos } = mob;

      // Despawn if very far
      const dx = pos.x - px, dz = pos.z - pz;
      if (dx*dx + dz*dz > 96*96) { scene.remove(mob.mesh); mobs.splice(i, 1); continue; }

      // Gravity
      mob.vy = Math.max(mob.vy + GRAVITY * dt, -20);
      const newY = pos.y + mob.vy * dt;
      const bx = Math.floor(pos.x), bz = Math.floor(pos.z);
      if (mob.vy < 0 && isSolidAt(bx, Math.floor(newY - 0.05), bz)) {
        pos.y = Math.ceil(newY - 0.05);
        mob.vy = 0; mob.grounded = true;
      } else if (mob.vy > 0 && isSolidAt(bx, Math.floor(newY + 1.9), bz)) {
        pos.y = Math.floor(newY + 1.9) - 1.9;
        mob.vy = 0;
      } else {
        pos.y = newY;
        mob.grounded = (mob.vy === 0);
      }

      // Knockback decay
      mob.knockX *= Math.pow(0.004, dt);
      mob.knockZ *= Math.pow(0.004, dt);

      mob.walkLegT += dt * 3;

      // Hit flash restore
      if (mob.hitFlash > 0) {
        mob.hitFlash -= dt;
        if (mob.hitFlash <= 0) {
          mob.mesh.traverse(child => {
            if (child.isMesh && child.userData._origColor != null) {
              const orig = child.userData._origColor;
              const restore = (m, c) => { if (m.color) m.color.setHex(typeof c === 'number' ? c : 0xffffff); };
              if (Array.isArray(child.material)) child.material.forEach((m,i) => restore(m, Array.isArray(orig) ? orig[i] : orig));
              else restore(child.material, orig);
              delete child.userData._origColor;
            }
          });
        }
      }

      if (mob.def.hostile) {
        // ── Zombie AI ──
        mob.attackTimer -= dt;
        const distXZ = Math.hypot(pos.x - px, pos.z - pz);

        // Burn in daylight when above ground
        if (!night && inSunlight(pos.x, pos.y + 1, pos.z)) {
          mob.health -= dt * 4;
          if (mob.health <= 0) { _killMob(mob); continue; }
        }

        if (distXZ < 22) {
          // Chase player
          const angle = Math.atan2(pz - pos.z, px - pos.x);
          mob.mesh.rotation.y = -(angle - Math.PI / 2);
          const spd = mob.def.speed;
          const mvx = Math.cos(angle) * spd * dt + mob.knockX * dt;
          const mvz = Math.sin(angle) * spd * dt + mob.knockZ * dt;
          const nx = pos.x + mvx, nz = pos.z + mvz;
          const my = Math.floor(pos.y);
          if (!isSolidAt(Math.floor(nx), my, bz) && !isSolidAt(Math.floor(nx), my+1, bz))
            pos.x = nx;
          else if (mob.grounded) mob.vy = JUMP_VEL; // try to jump over
          if (!isSolidAt(bx, my, Math.floor(nz)) && !isSolidAt(bx, my+1, Math.floor(nz)))
            pos.z = nz;

          // Attack player when close
          if (distXZ < 1.5 && Math.abs(pos.y - py) < 2 && mob.attackTimer <= 0) {
            mob.attackTimer = 1.2;
            takeDamage(1);
          }
        }

        // Leg swing
        if (mob.mesh.userData.legR) {
          mob.mesh.userData.legR.rotation.x =  Math.sin(mob.walkLegT) * 0.5;
          mob.mesh.userData.legL.rotation.x = -Math.sin(mob.walkLegT) * 0.5;
        }

      } else {
        // ── Cow AI ──
        mob.walkTimer -= dt;
        if (mob.walkTimer <= 0) {
          mob.walkTimer = 3 + Math.random() * 5;
          mob.walkAngleActive = Math.random() < 0.7;
          if (mob.walkAngleActive) mob.walkAngle = Math.random() * Math.PI * 2;
        }
        if (mob.walkAngleActive) {
          const spd = mob.def.speed * 0.45;
          const mvx = Math.cos(mob.walkAngle) * spd * dt + mob.knockX * dt;
          const mvz = Math.sin(mob.walkAngle) * spd * dt + mob.knockZ * dt;
          const nx = pos.x + mvx, nz = pos.z + mvz;
          const my = Math.floor(pos.y);
          if (!isSolidAt(Math.floor(nx), my, bz) && !isSolidAt(Math.floor(nx), my+1, bz))
            pos.x = nx;
          if (!isSolidAt(bx, my, Math.floor(nz)) && !isSolidAt(bx, my+1, Math.floor(nz)))
            pos.z = nz;
          mob.mesh.rotation.y = -(mob.walkAngle - Math.PI / 2);
        }
        // Leg animation for cow
        if (mob.mesh.userData.legs) {
          const legs = mob.mesh.userData.legs;
          const sw = mob.walkAngleActive ? Math.sin(mob.walkLegT) * 0.4 : 0;
          legs[0].rotation.x =  sw; legs[1].rotation.x = -sw;
          legs[2].rotation.x = -sw; legs[3].rotation.x =  sw;
        }
      }

      mob.mesh.position.set(pos.x, pos.y, pos.z);
    }
  }

  function updateHand(dt) {
    // Refresh item mesh when held slot/item changes
    const s = inventory[hotbarSlot];
    const key = hotbarSlot + '_' + (s ? s.kind + (s.id ?? s.block ?? '') : '');
    if (key !== _lastHandKey) { _lastHandKey = key; refreshHandItem(); }

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
  function addStackable(kind, id, n) {
    const MAX = 64;
    let rem = n;
    // Fill existing partial stacks first
    for (let i = 0; i < INV_SIZE && rem > 0; i++) {
      const s = inventory[i];
      if (s && itemKindMatches(s, kind, id) && (s.count || 1) < MAX) {
        const add = Math.min(rem, MAX - (s.count || 1));
        s.count = (s.count || 1) + add;
        rem -= add;
      }
    }
    // Then start new slots for the overflow
    while (rem > 0) {
      let placed = false;
      for (let i = 0; i < INV_SIZE; i++) {
        if (!inventory[i]) {
          const add = Math.min(rem, MAX);
          inventory[i] = (kind === 'block') ? { kind, block: id, count: add } : { kind, id, count: add };
          rem -= add; placed = true; break;
        }
      }
      if (!placed) break;
    }
    updateInventoryUI();
    return rem < n;
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
    grp.frustumCulled = false;
    const mk = (geo, col) => {
      const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: col }));
      m.frustumCulled = false; return m;
    };
    const legR = mk(new THREE.BoxGeometry(0.29,0.75,0.4), color);
    legR.position.set(0.15, 0.375, 0); grp.add(legR);
    const legL = mk(new THREE.BoxGeometry(0.29,0.75,0.4), color);
    legL.position.set(-0.15, 0.375, 0); grp.add(legL);
    const body = mk(new THREE.BoxGeometry(0.6,0.75,0.4), color);
    body.position.y = 1.125; grp.add(body);
    const head = mk(new THREE.BoxGeometry(0.5,0.5,0.5), 0xffd6a8);
    head.position.y = 1.75; grp.add(head);
    scene.add(grp);
    // Apply Steve skin to remote player
    const sImg = new Image();
    sImg.onload = () => {
      const S = sImg.width / 64;
      const fmat = (sx, sy, sw, sh) => {
        const c = document.createElement('canvas'); c.width = sw; c.height = sh;
        const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false;
        ctx.drawImage(sImg, sx*S, sy*S, sw*S, sh*S, 0, 0, sw, sh);
        const t = new THREE.CanvasTexture(c);
        t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
        return new THREE.MeshLambertMaterial({ map: t });
      };
      head.material = [
        fmat( 0,8,8,8), fmat(16,8,8,8),
        fmat( 8,0,8,8), fmat(16,0,8,8),
        fmat( 8,8,8,8), fmat(24,8,8,8),
      ];
      body.material = [
        fmat(28,20,4,12), fmat(16,20,4,12),
        fmat(20,16,8,4),  fmat(28,16,8,4),
        fmat(32,20,8,12), fmat(20,20,8,12),
      ];
      legR.material = [
        fmat(0,20,4,12), fmat(8,20,4,12),
        fmat(4,16,4,4),  fmat(8,16,4,4),
        fmat(12,20,4,12),fmat(4,20,4,12),
      ];
      const logH = sImg.height / S;
      legL.material = logH >= 64 ? [
        fmat(24,52,4,12), fmat(16,52,4,12),
        fmat(20,48,4,4),  fmat(24,48,4,4),
        fmat(28,52,4,12), fmat(20,52,4,12),
      ] : legR.material;
    };
    sImg.src = 'assets/steve.png';

    // Right-hand item holder (small cube, updated by updateOtherHeld)
    const handHolder = new THREE.Group();
    handHolder.position.set(0.45, 1.0, -0.3); // right arm, lower
    grp.add(handHolder);

    const label = document.createElement('div');
    label.className = 'name-tag'; label.textContent = name;
    document.getElementById('nameTags').appendChild(label);
    others[id] = { mesh: grp, label, handHolder, heldKey:'', x:0, y:0, z:0, yaw:0, name, color };
    return others[id];
  }

  function updateOtherHeld(o, held) {
    if (!o.handHolder) return;
    const key = held ? JSON.stringify(held) : 'empty';
    if (o.heldKey === key) return; // no change
    o.heldKey = key;
    // Clear previous
    while (o.handHolder.children.length) {
      const c = o.handHolder.children[0];
      c.geometry?.dispose();
      o.handHolder.remove(c);
    }
    if (!held) return;
    let mesh;
    if (held.k === 'tool') {
      const tdef = TOOLS[held.id];
      if (tdef?.img) {
        const tex = _getToolTex(tdef.img);
        const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.1, side: THREE.DoubleSide });
        mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.35), mat);
        mesh.rotation.set(-0.1, 0.2, 0.5);
      }
    } else if (held.k === 'block') {
      if (held.bl === TORCH) {
        const tex = _getToolTex('assets/torch.png');
        const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.1, side: THREE.DoubleSide });
        mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.25), mat);
        mesh.rotation.set(-0.1, 0.15, 0.42);
      } else {
        const bmat = (held.bl === CRAFTING_TABLE) ? craftingTableMat
                 : (held.bl === FURNACE)          ? furnaceMat
                 : (held.bl === WOOL)             ? woolMat
                 : (held.bl === BED)              ? bedMat
                 : (held.bl === CHEST)            ? chestMat
                 : (oreMaterials[held.bl])        ? oreMaterials[held.bl]
                                                  : blockMaterial;
        const geo = (blockGeos[held.bl] || blockGeos[STONE]).clone();
        geo.scale(0.22, 0.22, 0.22);
        mesh = new THREE.Mesh(geo, bmat);
        mesh.rotation.set(0.3, -0.45, 0.2);
      }
    } else if (held.k === 'item') {
      const thumb = itemThumbs[held.id];
      if (thumb) {
        const tex = _getToolTex(thumb);
        const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.05, side: THREE.DoubleSide });
        mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), mat);
        mesh.rotation.set(-0.1, 0.15, 0.42);
      }
    }
    if (mesh) { mesh.frustumCulled = false; o.handHolder.add(mesh); }
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
    const arr = [];
    for (const [k, v] of edits) {
      const [x,y,z] = k.split(',').map(Number);
      arr.push([x, y, z, v]);
    }
    // Include seed, gameMode and gameType so joiners generate the exact same world
    bcast('edits', { seed: worldSeed, gm: gameMode, gt: gameType, e: arr });
  }
  function applyEditsBatch(arr, seed, gm, gt) {
    if (seed && seed !== worldSeed) {
      // Update seed so beginPlaying() generates the correct terrain.
      // If the game is already running we need a full terrain reset.
      worldSeed = seed;
      if (gm) gameMode = gm;
      if (gt) gameType = gt;
      if (running) {
        // Tear down existing chunks safely then rebuild
        for (const [, entry] of chunkMeshes) {
          for (const m of Object.values(entry.meshes)) scene.remove(m);
        }
        chunks.clear(); chunkMeshes.clear();
        updateChunks();
      }
      // If not yet running, beginPlaying() will generate terrain from the updated seed
    }
    for (const [x, y, z, v] of arr) {
      edits.set(ek(x,y,z), v);
      setBLocalOnly(x, y, z, v);
    }
    if (running) {
      markAllChunksDirty();
    } else if (!isHost) {
      // Edits received from host while waiting — now it's safe to start
      beginPlaying();
    }
  }

  function connectRoom(code) {
    if (channel) sb.removeChannel(channel);
    channel = sb.channel('mc3d:'+code);
    channel.on('presence', { event:'sync' }, () => {
      const all = Object.values(channel.presenceState()).flat();
      document.getElementById('onlineBadge').textContent = '👤 ' + all.length + ' online';
      // Create meshes for anyone already in the room when we join
      for (const p of all) {
        if (p.clientId && p.clientId !== clientId)
          ensureOther(p.clientId, p.color ?? 0x3498db, p.displayName ?? 'Player');
      }
      if (isHost) sendEdits();
    });
    channel.on('presence', { event:'leave' }, ({ leftPresences }) => {
      const arr = Array.isArray(leftPresences) ? leftPresences : Object.values(leftPresences).flat();
      arr.forEach(p => { if (p?.clientId && p.clientId !== clientId) removeOther(p.clientId); });
    });
    channel.on('broadcast', { event:'req_edits' }, () => { if (isHost) sendEdits(); });
    channel.on('broadcast', { event:'edits' }, ({ payload }) => applyEditsBatch(payload.e || [], payload.seed, payload.gm, payload.gt));
    channel.on('broadcast', { event:'block' }, ({ payload }) => {
      edits.set(ek(payload.x, payload.y, payload.z), payload.v);
      setBLocalOnly(payload.x, payload.y, payload.z, payload.v);
    });
    channel.on('broadcast', { event:'move' }, ({ payload }) => {
      if (!payload || payload.id === clientId) return;
      const o = ensureOther(payload.id, payload.color, payload.name);
      o.x=payload.x; o.y=payload.y; o.z=payload.z; o.yaw=payload.yaw;
      o.mesh.position.set(o.x, o.y, o.z);
      updateOtherHeld(o, payload.held ?? null);
      o.mesh.rotation.y = o.yaw;
    });
    channel.on('broadcast', { event:'pvp_hit' }, ({ payload }) => {
      if (!payload) return;
      if (payload.targetId === clientId) {
        takeDamage(payload.damage);
        // Knockback: launch player away from attacker
        if (payload.kbx !== undefined) {
          const KBF = 14; // knockback force
          player.vy = 8;  // knock up
          player.pos.x += payload.kbx * KBF * 0.016;
          player.pos.z += payload.kbz * KBF * 0.016;
        }
        // Show who hit you
        const attName = payload.attackerName || 'Someone';
        showToast(`💥 Hit by ${attName} (-${payload.damage} HP)`, '#ff6666');
        if (playerHealth <= 0) {
          // Broadcast death so attacker gets kill credit
          bcast('pvp_death', { victimId: clientId, victimName: myName, killerId: payload.attackerId });
        }
      }
    });
    channel.on('broadcast', { event:'pvp_death' }, ({ payload }) => {
      if (!payload) return;
      if (payload.killerId === clientId) {
        pvpKills++;
        const modeTag = document.getElementById('gameModeTag');
        if (modeTag) modeTag.textContent = `⚔️ PvP · ${pvpKills} kill${pvpKills!==1?'s':''}`;
        showToast(`⚔️ You killed ${payload.victimName || 'someone'}! (${pvpKills} kill${pvpKills!==1?'s':''})`, '#ffe066');
      } else {
        showToast(`💀 ${payload.victimName || '?'} was slain`, '#aaa');
      }
    });
    channel.subscribe(async status => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT')
        console.error('[MC3D] channel error:', status);
      if (status !== 'SUBSCRIBED') return;
      await channel.track({ userId: myId, clientId, displayName: myName, color: myColor });
      if (!isHost) {
        bcast('req_edits', {});
        setTimeout(() => bcast('req_edits', {}), 1500);
      }
    });

    // Non-hosts receive mob positions + worldTime from host
    channel.on('broadcast', { event:'mob_sync' }, ({ payload }) => {
      if (!payload || isHost) return;
      // Sync world time so sky cycle matches
      if (payload.wt !== undefined) worldTime = payload.wt;
      const incoming = payload.mobs || [];
      const inIds = new Set(incoming.map(m => m.id));
      // Remove mobs that are gone
      for (let i = mobs.length - 1; i >= 0; i--) {
        if (!inIds.has(mobs[i].id)) { scene.remove(mobs[i].mesh); mobs.splice(i, 1); }
      }
      // Add or update
      for (const pm of incoming) {
        let mob = mobs.find(m => m.id === pm.id);
        if (!mob) {
          const mesh = _makeMobMesh(pm.type);
          mesh.position.set(pm.x, pm.y, pm.z);
          scene.add(mesh);
          mob = { id: pm.id, type: pm.type, def: MOB_DEFS[pm.type],
                  mesh, pos: { x:pm.x, y:pm.y, z:pm.z }, health: pm.hp, vy:0, grounded:true };
          mobs.push(mob);
        } else {
          mob.pos.x = pm.x; mob.pos.y = pm.y; mob.pos.z = pm.z; mob.health = pm.hp;
          mob.mesh.position.set(pm.x, pm.y, pm.z);
          mob.mesh.rotation.y = pm.ry;
        }
      }
    });
  }

  // ── Input ────────────────────────────────────────────────────────────────
  let pointerLocked = false;
  canvas.addEventListener('click', () => { if (running && !invOpen) canvas.requestPointerLock(); });
  document.addEventListener('pointerlockchange', () => {
    pointerLocked = document.pointerLockElement === canvas;
    document.getElementById('lockHint').style.display = (running && !pointerLocked && !invOpen && !furnaceOpen && !chestOpen && !settingsOpen) ? 'block' : 'none';
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
    if (e.button === 0) { mouseDownLeft = true; if (pvpEnabled) tryPvpAttack(); tryMobAttack(); }
    else if (e.button === 2) { if (!tryEat()) placeBlock(); }
  });
  document.addEventListener('mouseup', e => {
    if (e.button === 0) {
      mouseDownLeft = false; mining = null; crackMesh.visible = false;
    }
  });
  document.addEventListener('contextmenu', e => { if (pointerLocked || invOpen || furnaceOpen || chestOpen || settingsOpen) e.preventDefault(); });

  document.addEventListener('keydown', e => {
    if (!running) return;
    if (e.code === 'KeyX') {
      if (settingsOpen) closeSettings(); else openSettings();
      e.preventDefault(); return;
    }
    if (e.code === 'KeyE') {
      if (furnaceOpen) { closeFurnace(); e.preventDefault(); return; }
      if (chestOpen)   { closeChest();   e.preventDefault(); return; }
      if (invOpen)     { toggleInventory(); e.preventDefault(); return; }
      // If looking at a crafting table, open 3×3; otherwise open normal 2×2 inventory
      const hit = pointerLocked ? raycastBlock() : null;
      if (hit && getB(hit.x, hit.y, hit.z) === CRAFTING_TABLE) {
        openInventoryWithCrafting(3);
      } else {
        toggleInventory();
      }
      e.preventDefault(); return;
    }
    if (e.code === 'F5') { thirdPerson = !thirdPerson; e.preventDefault(); return; }
    if (e.code === 'Escape' && settingsOpen) { closeSettings(); return; }
    if (e.code === 'Escape' && furnaceOpen) { closeFurnace(); return; }
    if (e.code === 'Escape' && chestOpen)   { closeChest();   return; }
    if (e.code === 'Escape' && invOpen) { toggleInventory(); return; }
    if (invOpen || furnaceOpen || chestOpen || settingsOpen) return;
    if (e.code === 'KeyW' || e.code === 'ArrowUp')    inputKeys.fwd = true;
    if (e.code === 'KeyS' || e.code === 'ArrowDown')  inputKeys.back = true;
    if (e.code === 'KeyA' || e.code === 'ArrowLeft')  inputKeys.left = true;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') inputKeys.right = true;
    if (e.code === 'Space') {
      if (gameMode === 'creative') {
        const now = Date.now();
        if (now - lastSpaceTime < 300) { flying = !flying; flyVy = 0; }
        lastSpaceTime = now;
      }
      inputKeys.jump = true; e.preventDefault();
    }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') inputKeys.sprint = true;
    if (e.code === 'ControlLeft' || e.code === 'ControlRight') { inputKeys.ctrl = true; e.preventDefault(); }
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
    if (e.code === 'ControlLeft' || e.code === 'ControlRight') inputKeys.ctrl = false;
  });
  let _lastScroll = 0;
  document.addEventListener('wheel', e => {
    if (!running) return;
    if (invOpen || furnaceOpen || chestOpen || settingsOpen) return;
    e.preventDefault();
    const now = Date.now();
    if (now - _lastScroll < 150) return;
    _lastScroll = now;
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
  function makeIngotThumb(fill, stripe) {
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const cx = c.getContext('2d');
    cx.fillStyle = fill;    cx.fillRect(4, 10, 24, 12);
    cx.fillStyle = stripe;  cx.fillRect(4, 10, 24, 4);
    cx.strokeStyle = '#00000055'; cx.lineWidth = 1; cx.strokeRect(4, 10, 24, 12);
    return c.toDataURL();
  }
  function makeGemThumb(fill) {
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const cx = c.getContext('2d');
    cx.fillStyle = fill;
    cx.beginPath(); cx.moveTo(16,4); cx.lineTo(28,12); cx.lineTo(28,20); cx.lineTo(16,28); cx.lineTo(4,20); cx.lineTo(4,12); cx.closePath(); cx.fill();
    cx.strokeStyle = '#00000066'; cx.lineWidth = 1; cx.stroke();
    return c.toDataURL();
  }
  function makeCoalThumb() {
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const cx = c.getContext('2d');
    cx.fillStyle = '#222'; cx.fillRect(8, 8, 16, 16);
    cx.fillStyle = '#444'; cx.fillRect(8, 8, 8, 8);
    cx.strokeStyle = '#000'; cx.lineWidth = 1; cx.strokeRect(8, 8, 16, 16);
    return c.toDataURL();
  }
  // Set canvas fallbacks immediately, then upgrade if image files exist
  itemThumbs[ITEM_PLANK]       = makePlankThumb();
  itemThumbs[ITEM_IRON]        = makeIngotThumb('#ccc', '#eee');
  itemThumbs[ITEM_GOLD]        = makeIngotThumb('#fc0', '#ffe066');
  itemThumbs[ITEM_DIAMOND_GEM] = makeGemThumb('#4deeff');
  itemThumbs[ITEM_COAL]        = makeCoalThumb();
  itemThumbs[ITEM_STICK] = makeStickThumb();
  itemThumbs[ITEM_APPLE] = makeAppleThumb();
  itemThumbs[ITEM_COOKED_BEEF] = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const cx = c.getContext('2d');
    cx.fillStyle = '#5c1a00'; cx.fillRect(4, 10, 24, 14);
    cx.fillStyle = '#8b3000'; cx.fillRect(4, 10, 24, 5);
    cx.fillStyle = '#c44a00'; cx.fillRect(6, 11, 7, 2);
    cx.fillStyle = '#3a0a00'; cx.fillRect(4, 22, 24, 2);
    cx.strokeStyle = '#2a0500'; cx.lineWidth = 1; cx.strokeRect(4, 10, 24, 14);
    return c.toDataURL();
  })();
  itemThumbs[ITEM_BEEF]  = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const cx = c.getContext('2d');
    cx.fillStyle = '#8B2500'; cx.fillRect(4, 10, 24, 14);
    cx.fillStyle = '#c84000'; cx.fillRect(4, 10, 24, 6);
    cx.fillStyle = '#ff6a30'; cx.fillRect(6, 12, 8, 3);
    cx.fillStyle = '#4a1200'; cx.fillRect(4, 22, 24, 2);
    cx.strokeStyle = '#3a0e00'; cx.lineWidth = 1; cx.strokeRect(4, 10, 24, 14);
    return c.toDataURL();
  })();
  for (const [src, id] of [
    ['assets/plank.png',      ITEM_PLANK],
    ['assets/stick.png',      ITEM_STICK],
    ['assets/apple.png',      ITEM_APPLE],
    ['assets/rawbeef.png',   ITEM_BEEF],
    ['assets/steak.png',     ITEM_COOKED_BEEF],
    ['assets/goldingot.png',  ITEM_GOLD],
    ['assets/ironingot.png',  ITEM_IRON],
    ['assets/diamond.png',   ITEM_DIAMOND_GEM],
    ['assets/wool.png',      ITEM_WOOL],
  ]) {
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
  // Load idle + active furnace textures; swap when smelting starts/stops
  let furnaceIdleTex = null, furnaceActiveTex = null;
  (() => {
    const loadTex = (src, cb) => {
      const img = new Image();
      img.onload = () => {
        const t = new THREE.TextureLoader().load(img.src);
        t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
        t.colorSpace = THREE.SRGBColorSpace;
        cb(t, img);
      };
      img.src = src;
    };
    loadTex('assets/idlefurnace.png', (t, img) => {
      furnaceIdleTex = t;
      furnaceMat.map = t; furnaceMat.needsUpdate = true;
      const tc = document.createElement('canvas'); tc.width = tc.height = 32;
      tc.getContext('2d').drawImage(img, 0, 0, img.width, img.height, 0, 0, 32, 32);
      blockThumbs[FURNACE] = tc.toDataURL();
      updateHotbarUI();
    });
    loadTex('assets/furnaceusing.png', (t) => { furnaceActiveTex = t; });
  })();
  function _setFurnaceActive(active) {
    const tex = active ? (furnaceActiveTex || furnaceIdleTex) : furnaceIdleTex;
    if (tex && furnaceMat.map !== tex) { furnaceMat.map = tex; furnaceMat.needsUpdate = true; }
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
      const showCount = item && item.kind !== 'tool' && (item.infinite || (item.count || 0) > 1);
      if (showCount) {
        if (!cnt) { cnt = document.createElement('span'); cnt.className = 'cnt'; c.appendChild(cnt); }
        cnt.textContent = item.infinite ? '∞' : item.count;
      } else if (cnt) cnt.remove();
      let db = c.querySelector('.dur-bar');
      const showDur = item && item.kind === 'tool' && item.dur != null && !item.infinite;
      if (showDur) {
        const pct = Math.max(0, item.dur / (TOOL_MAX_DUR[item.id] || 60));
        if (!db) { db = document.createElement('div'); db.className = 'dur-bar'; c.appendChild(db); }
        db.style.width = `calc(${Math.round(pct*100)}% - 4px)`;
        db.style.background = durColor(pct);
      } else if (db) db.remove();
    });
  }
  function updateInventoryUI() { updateHotbarUI(); if (invOpen) renderInventoryPanel(); }

  // ── Chest inventory ───────────────────────────────────────────────────────
  let chestOpen = false;
  let chestInventory = Array(27).fill(null);
  let chestPanelEl = null;

  // ── Furnace overlay ───────────────────────────────────────────────────────
  let furnacePanelEl = null;
  let furnaceOpen = false;
  let activeFurnaceKey = null; // "x,y,z" of the currently-open furnace
  // Per-furnace persistent state: key "x,y,z" → {slotIn,slotFuel,slotOut,fuelTimer,fuelMax,smeltTimer}
  const furnaceStates = new Map();
  function _getFurnaceState(key) {
    if (!furnaceStates.has(key))
      furnaceStates.set(key, { slotIn:null, slotFuel:null, slotOut:null, fuelTimer:0, fuelMax:1, smeltTimer:0 });
    return furnaceStates.get(key);
  }
  // Shorthand: active furnace state (null-safe)
  const _afs = () => activeFurnaceKey ? _getFurnaceState(activeFurnaceKey) : { slotIn:null,slotFuel:null,slotOut:null,fuelTimer:0,fuelMax:1,smeltTimer:0 };
  const FURNACE_SMELT_TIME = 10; // default fallback smelt time
  const SMELT_TIMES = new Map([
    [ITEM_BEEF,    3 ],  // food: fast
    [COAL_ORE,     8 ],  // coal ore: medium
    [IRON_ORE,    10 ],  // iron: medium-slow
    [COPPER_ORE,  10 ],
    [GOLD_ORE,    15 ],  // gold: slow
    [DIAMOND_ORE, 20 ],  // diamond: very slow
  ]);

  function _furnaceThumb(slot) {
    if (!slot) return '';
    if (slot.kind === 'block')  return blockThumbs[slot.block] || '';
    if (slot.kind === 'item')   return itemThumbs[slot.id]  || '';
    return '';
  }

  function _furnaceSlotHTML(id, slot, label) {
    const thumb = _furnaceThumb(slot);
    const name  = slot ? (slot.kind === 'block'
      ? (slot.block === GRASS ? 'Dirt / Grass' : Object.entries({DIRT,STONE,SAND,SNOW,WOOD,WATER,BEDROCK,CRAFTING_TABLE,PLANK,COAL_ORE,IRON_ORE,COPPER_ORE,GOLD_ORE,REDSTONE_ORE,DIAMOND_ORE}).find(([,v])=>v===slot.block)?.[0] || 'Block')
      : (ITEMS[slot.id]?.name || 'Item')) : '';
    return `<div class="furnace-slot ${slot?'filled':''}" data-slot="${id}" title="${name}">
      ${thumb ? `<div class="iv-swatch" style="background-image:url('${thumb}')"></div>` : `<span class="furnace-slot-label">${label}</span>`}
      ${slot && slot.count > 1 ? `<span class="cnt">${slot.count}</span>` : ''}
    </div>`;
  }

  function _smeltInput(slot) {
    if (!slot) return null;
    const key = slot.kind === 'block' ? slot.block : slot.id;
    return SMELT_RECIPES.get(key) || null;
  }

  function _isFuel(slot) {
    if (!slot) return false;
    if (slot.kind === 'item')  return SMELT_FUEL.has(slot.id);
    if (slot.kind === 'block') return SMELT_FUEL.has(slot.block);
    return false;
  }

  function _tickFurnaceState(fs) {
    if (!fs.slotIn || !_smeltInput(fs.slotIn)) {
      fs.smeltTimer = 0;
      return false; // not active
    }
    if (fs.fuelTimer <= 0) {
      if (!_isFuel(fs.slotFuel)) return false;
      const fkey = fs.slotFuel.kind === 'block' ? fs.slotFuel.block : fs.slotFuel.id;
      fs.fuelMax = FUEL_SECONDS.get(fkey) || 10;
      fs.fuelTimer = fs.fuelMax;
      fs.slotFuel.count = (fs.slotFuel.count || 1) - 1;
      if (fs.slotFuel.count <= 0) fs.slotFuel = null;
    }
    if (fs.fuelTimer <= 0) return false;
    fs.fuelTimer = Math.max(0, fs.fuelTimer - _tickFurnaceState._dt);
    fs.smeltTimer += _tickFurnaceState._dt;
    const sk = fs.slotIn.kind === 'block' ? fs.slotIn.block : fs.slotIn.id;
    const sd = SMELT_TIMES.get(sk) || FURNACE_SMELT_TIME;
    while (fs.smeltTimer >= sd && fs.slotIn) {
      fs.smeltTimer -= sd;
      const rec = _smeltInput(fs.slotIn);
      if (!rec) { fs.smeltTimer = 0; break; }
      fs.slotIn.count = (fs.slotIn.count || 1) - 1;
      if (fs.slotIn.count <= 0) fs.slotIn = null;
      if (!fs.slotOut) {
        fs.slotOut = rec.outKind === 'block'
          ? { kind:'block', block:rec.outId, count:rec.count }
          : { kind:'item',  id:rec.outId,    count:rec.count };
      } else {
        fs.slotOut.count = (fs.slotOut.count || 0) + rec.count;
      }
    }
    return true; // was active
  }

  function updateFurnace(dt) {
    _tickFurnaceState._dt = dt;
    let anyActive = false;
    for (const fs of furnaceStates.values()) {
      if (_tickFurnaceState(fs)) anyActive = true;
    }
    const afs = _afs();
    const isActive = afs.fuelTimer > 0 && !!_smeltInput(afs.slotIn);
    _setFurnaceActive(isActive);
    if (furnaceOpen) renderFurnacePanel();
  }

  function renderFurnacePanel() {
    if (!furnacePanelEl) return;
    ensureInvPanel(); // ensure cursorEl exists
    // ── helpers ───────────────────────────────────────────────────────────
    const sHTML = (slotKey, slot, placeholder) => {
      const thumb = !slot ? '' : slot.kind==='block' ? (blockThumbs[slot.block]||'') : slot.kind==='item' ? (itemThumbs[slot.id]||'') : (TOOLS[slot.id]?.img ? '' : '');
      const cnt = slot ? (slot.infinite ? '∞' : slot.count > 1 ? slot.count : '') : '';
      const dur = slot?.kind==='tool' ? `<div class="dur-bar" style="width:${Math.round((slot.dur||0)/(TOOL_MAX_DUR[slot.id]||60)*34)}px;background:${slot.dur>20?'#5f5':'#f55'}"></div>` : '';
      return `<div class="iv-slot fsl${slot?' filled':''}" data-key="${slotKey}" title="${slot?((ITEMS[slot.id]?.name||TOOLS[slot.id]?.name||'Block')):''}">
        ${thumb ? `<div class="iv-swatch" style="background-image:url('${thumb}')"></div>` : (slot?.kind==='tool'&&TOOLS[slot.id]?.img ? `<div class="iv-swatch" style="background-image:url('${TOOLS[slot.id].img}')"></div>` : (slot ? `<div class="iv-swatch" style="background:#555"></div>` : `<span style="font-size:0.6rem;color:rgba(255,255,255,0.2)">${placeholder||''}</span>`))}
        ${cnt ? `<span class="cnt">${cnt}</span>` : ''}${dur}
      </div>`;
    };

    // Build inventory HTML (left side: rows 0-2 of main, then hotbar)
    let invHTML = '<div class="furn-inv-col">';
    invHTML += '<div class="furn-col-title">Inventory</div>';
    invHTML += '<div class="inv-grid" style="grid-template-columns:repeat(9,34px);gap:2px">';
    for (let i = 0; i < INV_SIZE; i++) invHTML += sHTML('inv'+i, inventory[i], '');
    invHTML += '</div></div>';

    // Furnace right side — auto-smelting with progress bars
    const afs = _afs();
    const isActive = afs.fuelTimer > 0 && !!_smeltInput(afs.slotIn);
    const fuelPct  = afs.fuelMax > 0 ? afs.fuelTimer / afs.fuelMax : 0;
    const _sk = afs.slotIn ? (afs.slotIn.kind==='block' ? afs.slotIn.block : afs.slotIn.id) : 0;
    const _sd = SMELT_TIMES.get(_sk) || FURNACE_SMELT_TIME;
    const smeltPct = afs.smeltTimer / _sd;
    let furnHTML = '<div class="furn-slots-col">';
    furnHTML += '<div class="furn-col-title">🔥 Furnace</div>';
    furnHTML += '<div class="furn-slots-body">';
    furnHTML += `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
      <div style="display:flex;flex-direction:column;gap:4px;align-items:center">
        <span style="font-size:0.62rem;color:rgba(255,255,255,0.4)">Input</span>
        ${sHTML('fin', afs.slotIn, 'Ore')}
        <div style="width:34px;height:6px;background:rgba(0,0,0,0.4);border-radius:3px;margin-top:2px" title="Fuel remaining">
          <div style="height:100%;width:${Math.round(fuelPct*100)}%;background:${fuelPct>0.3?'#f90':'#f44'};border-radius:3px;transition:width 0.3s"></div>
        </div>
        <span style="font-size:0.62rem;color:rgba(255,255,255,0.4)">Fuel</span>
        ${sHTML('ffuel', afs.slotFuel, 'Coal')}
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:3px">
        <div style="font:bold 20px monospace;color:rgba(255,180,50,${isActive?'1.0':'0.25'})">→</div>
        <div style="width:36px;height:5px;background:rgba(0,0,0,0.4);border-radius:3px" title="Smelt progress">
          <div style="height:100%;width:${Math.round(smeltPct*100)}%;background:#5ef;border-radius:3px;transition:width 0.2s"></div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
        <span style="font-size:0.62rem;color:rgba(255,255,255,0.4)">Output</span>
        ${sHTML('fout', afs.slotOut, '—')}
      </div>
    </div>`;
    if (!_isFuel(afs.slotFuel) && !afs.slotIn) {
      furnHTML += `<p style="font-size:0.65rem;color:rgba(255,255,255,0.35);text-align:center;margin:4px 0">Place ore + fuel to auto-smelt</p>`;
    } else if (isActive) {
      furnHTML += `<p style="font-size:0.65rem;color:#5ef;text-align:center;margin:4px 0">⚙️ Smelting…</p>`;
    } else if (_smeltInput(afs.slotIn) && !_isFuel(afs.slotFuel)) {
      furnHTML += `<p style="font-size:0.65rem;color:#fa0;text-align:center;margin:4px 0">⚠️ Needs fuel</p>`;
    }
    furnHTML += '</div></div>';

    furnacePanelEl.innerHTML = `
      <div style="background:#2d3a7b;border:2px solid rgba(255,255,255,0.2);border-radius:12px;padding:14px 16px;max-width:98vw;max-height:92vh;overflow:auto;color:#fff;font-family:system-ui,sans-serif">
        <div style="display:flex;gap:18px;flex-wrap:wrap">
          ${invHTML}
          <div style="width:1px;background:rgba(255,255,255,0.1);margin:0 4px"></div>
          ${furnHTML}
        </div>
        <p style="font-size:0.72rem;opacity:0.45;text-align:center;margin-top:10px">Click item to pick up · click slot to place · <b>E</b>/<b>Esc</b> close</p>
      </div>`;

    // Slot click handling (cursor-item drag)
    furnacePanelEl.querySelectorAll('.fsl').forEach(el => {
      el.addEventListener('mousedown', e => {
        e.stopPropagation();
        const key = el.dataset.key;
        // Get current slot content
        const cfs = _afs();
        const getSlot = k => {
          if (k.startsWith('inv')) return inventory[+k.slice(3)];
          if (k==='fin') return cfs.slotIn;
          if (k==='ffuel') return cfs.slotFuel;
          if (k==='fout') return null; // read-only trigger
          return null;
        };
        const setSlot = (k, v) => {
          if (k.startsWith('inv')) { inventory[+k.slice(3)] = v; }
          else if (k==='fin')   cfs.slotIn = v;
          else if (k==='ffuel') cfs.slotFuel = v;
        };

        if (key === 'fout') {
          // Collect output into inventory
          if (!cfs.slotOut) return;
          const added = cfs.slotOut.kind === 'block'
            ? addStackable('block', cfs.slotOut.block, cfs.slotOut.count)
            : addStackable('item',  cfs.slotOut.id,    cfs.slotOut.count);
          if (added) { cfs.slotOut = null; renderFurnacePanel(); updateHotbarUI(); }
          return;
        }

        if (!cursorItem) {
          // Pick up
          const here = getSlot(key);
          if (!here) return;
          if (here.infinite) { cursorItem = { ...here, infinite: false, count: 64 }; }
          else { cursorItem = here; setSlot(key, null); }
        } else {
          // Place
          const here = getSlot(key);
          if (!here) {
            setSlot(key, cursorItem); cursorItem = null;
          } else if (here.kind === cursorItem.kind &&
            (here.kind==='block'?here.block===cursorItem.block:here.id===cursorItem.id) &&
            here.kind!=='tool') {
            // Stack
            const add = Math.min(cursorItem.count||1, 64-(here.count||1));
            here.count = (here.count||1) + add;
            cursorItem.count = (cursorItem.count||1) - add;
            if (cursorItem.count <= 0) cursorItem = null;
          } else {
            // Swap
            const tmp = here; setSlot(key, cursorItem); cursorItem = tmp;
          }
        }
        // Update cursor display
        if (cursorEl) {
          cursorEl.innerHTML = cursorItem ? slotHTML(cursorItem, 'cursor-slot') : '';
          cursorEl.style.display = cursorItem ? 'block' : 'none';
        }
        updateHotbarUI(); renderFurnacePanel();
      });
    });
  }

  function openFurnace(wx, wy, wz) {
    if (furnaceOpen) return;
    activeFurnaceKey = `${wx},${wy},${wz}`;
    _getFurnaceState(activeFurnaceKey); // ensure entry exists
    furnaceOpen = true;
    if (document.pointerLockElement) document.exitPointerLock();
    inputKeys.fwd = inputKeys.back = inputKeys.left = inputKeys.right = false;
    inputKeys.jump = inputKeys.sprint = false;
    mouseDownLeft = false; mining = null;
    if (!furnacePanelEl) {
      furnacePanelEl = document.createElement('div');
      furnacePanelEl.id = 'furnacePanel';
      furnacePanelEl.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,0.55);' +
        'display:flex;align-items:center;justify-content:center;z-index:30;font-family:system-ui,sans-serif;color:#fff;';
      document.getElementById('mcApp').appendChild(furnacePanelEl);
    }
    furnacePanelEl.style.display = 'flex';
    renderFurnacePanel();
  }

  function closeFurnace() {
    if (!furnaceOpen) return;
    furnaceOpen = false;
    // Items stay inside the furnace — do NOT return to inventory
    updateHotbarUI();
    if (furnacePanelEl) furnacePanelEl.style.display = 'none';
  }

  // ── Chest panel ──────────────────────────────────────────────────────────
  function renderChestPanel() {
    if (!chestPanelEl) return;
    ensureInvPanel();
    const sHTML = (slotKey, slot, placeholder) => {
      const thumb = !slot ? '' : slot.kind==='block' ? (blockThumbs[slot.block]||'') : slot.kind==='item' ? (itemThumbs[slot.id]||'') : (TOOLS[slot.id]?.img || '');
      const cnt = slot ? (slot.infinite ? '∞' : slot.count > 1 ? slot.count : '') : '';
      const dur = slot?.kind==='tool' ? `<div class="dur-bar" style="width:${Math.round((slot.dur||0)/(TOOL_MAX_DUR[slot.id]||60)*34)}px;background:${slot.dur>20?'#5f5':'#f55'}"></div>` : '';
      return `<div class="iv-slot fsl${slot?' filled':''}" data-key="${slotKey}" title="${slot?((ITEMS[slot.id]?.name||TOOLS[slot.id]?.name||'Block')):''}">
        ${thumb ? `<div class="iv-swatch" style="background-image:url('${thumb}')"></div>` : (slot?.kind==='tool'&&TOOLS[slot.id]?.img ? `<div class="iv-swatch" style="background-image:url('${TOOLS[slot.id].img}')"></div>` : (slot ? `<div class="iv-swatch" style="background:#555"></div>` : `<span style="font-size:0.6rem;color:rgba(255,255,255,0.2)">${placeholder||''}</span>`))}
        ${cnt ? `<span class="cnt">${cnt}</span>` : ''}${dur}
      </div>`;
    };

    let invHTML = '<div class="furn-inv-col">';
    invHTML += '<div class="furn-col-title">Inventory</div>';
    invHTML += '<div class="inv-grid" style="grid-template-columns:repeat(9,34px);gap:2px">';
    for (let i = 0; i < INV_SIZE; i++) invHTML += sHTML('inv'+i, inventory[i], '');
    invHTML += '</div></div>';

    let chestHTML = '<div class="furn-slots-col">';
    chestHTML += '<div class="furn-col-title">📦 Chest</div>';
    chestHTML += '<div class="inv-grid" style="grid-template-columns:repeat(9,34px);gap:2px">';
    for (let i = 0; i < 27; i++) chestHTML += sHTML('chest'+i, chestInventory[i], '');
    chestHTML += '</div></div>';

    chestPanelEl.innerHTML = `
      <div style="background:#2d3a7b;border:2px solid rgba(255,255,255,0.2);border-radius:12px;padding:14px 16px;max-width:98vw;max-height:92vh;overflow:auto;color:#fff;font-family:system-ui,sans-serif">
        <div style="display:flex;gap:18px;flex-wrap:wrap">
          ${invHTML}
          <div style="width:1px;background:rgba(255,255,255,0.1);margin:0 4px"></div>
          ${chestHTML}
        </div>
        <p style="font-size:0.72rem;opacity:0.45;text-align:center;margin-top:10px">Click item to pick up · click slot to place · <b>E</b>/<b>Esc</b> close</p>
      </div>`;

    chestPanelEl.querySelectorAll('.fsl').forEach(el => {
      el.addEventListener('mousedown', e => {
        e.stopPropagation();
        const key = el.dataset.key;
        const getSlot = k => {
          if (k.startsWith('inv'))   return inventory[+k.slice(3)];
          if (k.startsWith('chest')) return chestInventory[+k.slice(5)];
          return null;
        };
        const setSlot = (k, v) => {
          if (k.startsWith('inv'))   { inventory[+k.slice(3)] = v; }
          else if (k.startsWith('chest')) { chestInventory[+k.slice(5)] = v; }
        };
        if (!cursorItem) {
          const here = getSlot(key);
          if (!here) return;
          if (here.infinite) { cursorItem = { ...here, infinite: false, count: 64 }; }
          else { cursorItem = here; setSlot(key, null); }
        } else {
          const here = getSlot(key);
          if (!here) {
            setSlot(key, cursorItem); cursorItem = null;
          } else if (here.kind === cursorItem.kind &&
            (here.kind==='block'?here.block===cursorItem.block:here.id===cursorItem.id) &&
            here.kind!=='tool') {
            const add = Math.min(cursorItem.count||1, 64-(here.count||1));
            here.count = (here.count||1) + add;
            cursorItem.count = (cursorItem.count||1) - add;
            if (cursorItem.count <= 0) cursorItem = null;
          } else {
            const tmp = here; setSlot(key, cursorItem); cursorItem = tmp;
          }
        }
        if (cursorEl) {
          cursorEl.innerHTML = cursorItem ? slotHTML(cursorItem, 'cursor-slot') : '';
          cursorEl.style.display = cursorItem ? 'block' : 'none';
        }
        updateHotbarUI(); renderChestPanel();
      });
    });
  }

  function openChest() {
    if (chestOpen) return;
    chestOpen = true;
    if (document.pointerLockElement) document.exitPointerLock();
    inputKeys.fwd = inputKeys.back = inputKeys.left = inputKeys.right = false;
    inputKeys.jump = inputKeys.sprint = false;
    mouseDownLeft = false; mining = null;
    if (!chestPanelEl) {
      chestPanelEl = document.createElement('div');
      chestPanelEl.id = 'chestPanel';
      chestPanelEl.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,0.55);' +
        'display:flex;align-items:center;justify-content:center;z-index:30;font-family:system-ui,sans-serif;color:#fff;';
      document.getElementById('mcApp').appendChild(chestPanelEl);
    }
    chestPanelEl.style.display = 'flex';
    renderChestPanel();
  }

  function closeChest() {
    if (!chestOpen) return;
    chestOpen = false;
    dropCursorBackToInventory();
    updateHotbarUI();
    if (chestPanelEl) chestPanelEl.style.display = 'none';
  }

  // ── Settings panel (key X) ────────────────────────────────────────────────
  let settingsPanelEl = null;
  let settingsOpen = false;

  function openSettings() {
    if (settingsOpen) return;
    settingsOpen = true;
    if (document.pointerLockElement) document.exitPointerLock();
    inputKeys.fwd = inputKeys.back = inputKeys.left = inputKeys.right = false;
    inputKeys.jump = inputKeys.sprint = false;
    mouseDownLeft = false; mining = null;
    // Always (re)create so there's no stale display/style state
    if (settingsPanelEl) settingsPanelEl.remove();
    settingsPanelEl = document.createElement('div');
    settingsPanelEl.id = 'settingsPanel';
    settingsPanelEl.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,0.65);' +
      'display:flex;align-items:center;justify-content:center;z-index:40;font-family:system-ui,sans-serif;color:#fff;';
    document.getElementById('mcApp').appendChild(settingsPanelEl);
    renderSettingsPanel();
  }

  function closeSettings() {
    if (!settingsOpen) return;
    settingsOpen = false;
    if (settingsPanelEl) { settingsPanelEl.remove(); settingsPanelEl = null; }
  }

  function renderSettingsPanel() {
    if (!settingsPanelEl) return;
    const modeLabel = gameMode === 'creative' ? '🎨 Creative' : '⚔️ Survival';
    const modeSwitch = gameMode === 'creative' ? '⚔️ Switch to Survival' : '🎨 Switch to Creative';
    const showModeSwitch = gameType !== 'pvp';
    const typeLabel = gameType === 'pvp' ? 'PvP Arena' : gameType === 'mp' ? 'Multiplayer' : 'Singleplayer';
    settingsPanelEl.innerHTML = `
      <div class="inv-frame" style="max-width:340px;text-align:center">
        <h2>⚙️ Settings</h2>
        <p style="color:rgba(255,255,255,0.5);font-size:0.8rem;margin-bottom:16px">
          ${modeLabel} · ${typeLabel}
        </p>
        <div style="margin:12px 0;text-align:left">
          <label style="font-size:0.8rem;color:rgba(255,255,255,0.7)">
            Walk Speed: <span id="speedVal">${playerSpeed.toFixed(1)}</span>
          </label>
          <input type="range" id="speedSlider" min="3" max="15" step="0.5" value="${playerSpeed}"
            style="width:100%;margin:4px 0">
        </div>
        <div style="margin:12px 0;text-align:left">
          <label style="font-size:0.8rem;color:rgba(255,255,255,0.7)">
            Jump Height: <span id="jumpVal">${jumpStrength.toFixed(1)}</span>
          </label>
          <input type="range" id="jumpSlider" min="4" max="12" step="0.5" value="${jumpStrength}"
            style="width:100%;margin:4px 0">
        </div>
        <button class="mc-big-btn" id="settingsResume">▶ Resume</button>
        ${showModeSwitch ? `<button class="mc-big-btn" id="settingsModeSwitch" style="background:#a78bfa;color:#fff">${modeSwitch}</button>` : ''}
        <button class="mc-big-btn" id="settingsLeave" style="background:linear-gradient(135deg,#ef4444,#b91c1c);color:#fff">🚪 Leave World</button>
      </div>`;
    settingsPanelEl.querySelector('#settingsResume').onclick = () => closeSettings();
    settingsPanelEl.querySelector('#speedSlider').oninput = function() {
      playerSpeed = +this.value;
      settingsPanelEl.querySelector('#speedVal').textContent = playerSpeed.toFixed(1);
    };
    settingsPanelEl.querySelector('#jumpSlider').oninput = function() {
      jumpStrength = +this.value;
      settingsPanelEl.querySelector('#jumpVal').textContent = jumpStrength.toFixed(1);
    };
    const _modeSwitchBtn = settingsPanelEl.querySelector('#settingsModeSwitch');
    if (_modeSwitchBtn) _modeSwitchBtn.onclick = () => {
      gameMode = gameMode === 'creative' ? 'survival' : 'creative';
      flying = false; flyVy = 0;
      const hhHud = document.getElementById('healthHungerHud');
      if (hhHud) hhHud.style.display = gameMode === 'survival' ? 'flex' : 'none';
      const modeTag = document.getElementById('gameModeTag');
      if (modeTag) {
        const tl = gameType === 'pvp' ? ' · PvP' : gameType === 'sp' ? ' · Solo' : ' · Multi';
        modeTag.textContent = (gameMode === 'creative' ? '🎨 Creative' : '⚔️ Survival') + tl;
        modeTag.style.color = gameMode === 'creative' ? '#a78bfa' : '#86efac';
      }
      closeSettings();
    };
    settingsPanelEl.querySelector('#settingsLeave').onclick = () => {
      saveWorld();
      running = false;
      closeSettings();
      if (furnaceOpen) closeFurnace();
      if (chestOpen)   closeChest();
      if (invOpen) toggleInventory();
      if (channel) { sb.removeChannel(channel); channel = null; }
      for (const m of mobs) scene.remove(m.mesh); mobs = [];
      document.getElementById('deathScreen').style.display = 'none';
      document.getElementById('crosshair').style.display = 'none';
      document.getElementById('hotbar').style.display = 'none';
      document.getElementById('hudInfo').style.display = 'none';
      document.getElementById('healthHungerHud').style.display = 'none';
      document.getElementById('gameModeTag').style.display = 'none';
      document.getElementById('lobbyPanel').style.display = 'flex';
      showStep('lstep1');
    };
  }

  // ── Inventory + crafting overlay ─────────────────────────────────────────
  let invPanelEl = null;
  let cursorEl = null;

  function ensureInvPanel() {
    if (invPanelEl) return;
    invPanelEl = document.createElement('div');
    invPanelEl.id = 'invPanel';
    if (gameMode === 'creative') {
      invPanelEl.innerHTML = `<div class="inv-frame"></div>`;
    } else {
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
    }
    invPanelEl.style.display = 'none';
    document.getElementById('mcApp').appendChild(invPanelEl);

    cursorEl = document.createElement('div');
    cursorEl.id = 'invCursor';
    document.body.appendChild(cursorEl);

    document.addEventListener('mousemove', e => {
      if (!invOpen && !furnaceOpen && !chestOpen) return;
      cursorEl.style.left = (e.clientX - 19) + 'px';
      cursorEl.style.top  = (e.clientY - 19) + 'px';
    });
  }

  function durColor(pct) { return pct > 0.5 ? '#5c5' : pct > 0.25 ? '#cc5' : '#c44'; }
  function slotHTML(item, extraClass='') {
    if (!item) return `<div class="iv-slot ${extraClass}"></div>`;
    const src = slotImage(item);
    const bg = src ? `style="background-image:url(${src})"` : '';
    const cnt = (item.kind !== 'tool' && (item.infinite || (item.count || 0) > 1))
      ? `<span class="cnt">${item.infinite ? '∞' : item.count}</span>` : '';
    const title = item.kind === 'block' ? '' :
                  item.kind === 'tool' ? (TOOLS[item.id]?.name || '') :
                                          (ITEMS[item.id]?.name || '');
    let durBar = '';
    if (item.kind === 'tool' && item.dur != null && !item.infinite) {
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
    if (gameMode === 'creative') {
      const frame = invPanelEl.querySelector('.inv-frame');
      frame.innerHTML = `
        <div style="display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap">
          <div style="flex:0 0 auto">
            <h2 style="margin:0 0 6px;font-size:1rem">🎨 Items</h2>
            <div id="creativePaletteGrid" class="creative-palette-grid"></div>
            <p class="inv-hint" style="margin-top:6px">Click to pick up · drag to inventory</p>
          </div>
          <div style="flex:0 0 auto">
            <h2 style="margin:0 0 6px;font-size:1rem">🎒 Inventory</h2>
            <div class="inv-grid" id="invGrid" style="grid-template-columns:repeat(9,34px);gap:2px;margin-bottom:6px"></div>
            <div class="inv-grid hotbar" id="invHotbar" style="grid-template-columns:repeat(9,34px);gap:2px"></div>
            <div style="display:flex;align-items:center;gap:8px;margin-top:10px">
              <div class="craft-grid" id="craftGridEl" style="grid-template-columns:repeat(${craftSize},34px)"></div>
              <div class="craft-arrow">→</div>
              <div class="craft-result" id="craftResultEl"></div>
            </div>
            <p class="inv-hint" style="margin-top:6px"><b>E</b>/<b>Esc</b> close · face crafting table + press E for 3×3</p>
          </div>
        </div>
      `;
      // Left panel — creative palette (no leaves)
      const pg = frame.querySelector('#creativePaletteGrid');
      for (const entry of CREATIVE_PALETTE) {
        if (entry.kind === 'block' && entry.block === LEAVES) continue; // no leaves
        const src = entry.kind === 'block' ? (blockThumbs[entry.block] || null)
                  : entry.kind === 'tool'  ? (TOOLS[entry.id]?.img || null)
                  :                          (itemThumbs[entry.id] || null);
        const title = entry.kind === 'tool' ? (TOOLS[entry.id]?.name || '')
                    : entry.kind === 'item' ? (ITEMS[entry.id]?.name || '') : '';
        const cell = document.createElement('div');
        cell.className = 'iv-slot filled'; cell.title = title;
        cell.innerHTML = `<div class="iv-swatch"${src ? ` style="background-image:url(${src})"` : ''}></div>`;
        cell.addEventListener('mousedown', e => {
          e.preventDefault();
          if (cursorItem) { cursorItem = null; }  // drop cursor item if returning to palette
          else {
            // Pick up infinite stack onto cursor
            if (entry.kind === 'block')      cursorItem = { kind:'block', block:entry.block, count:64, infinite:true };
            else if (entry.kind === 'item')  cursorItem = { kind:'item',  id:entry.id,       count:64, infinite:true };
            else                             cursorItem = { kind:'tool',  id:entry.id, dur:99999, infinite:true };
          }
          renderInventoryPanel();
        });
        cell.addEventListener('contextmenu', e => e.preventDefault());
        pg.appendChild(cell);
      }
      // Right panel — main inventory (rows above hotbar)
      const ig = frame.querySelector('#invGrid');
      for (let i = HOTBAR_SIZE; i < INV_SIZE; i++) {
        const div = document.createElement('div'); div.innerHTML = slotHTML(inventory[i]);
        const cell = div.firstElementChild;
        cell.addEventListener('mousedown', e => { clickInvSlot(() => inventory[i], (v) => { inventory[i] = v; }, e); });
        cell.addEventListener('contextmenu', e => e.preventDefault());
        ig.appendChild(cell);
      }
      // Hotbar
      const hbar = frame.querySelector('#invHotbar');
      for (let i = 0; i < HOTBAR_SIZE; i++) {
        const div = document.createElement('div'); div.innerHTML = slotHTML(inventory[i]);
        const cell = div.firstElementChild;
        cell.addEventListener('mousedown', e => { clickInvSlot(() => inventory[i], (v) => { inventory[i] = v; }, e); });
        cell.addEventListener('contextmenu', e => e.preventDefault());
        hbar.appendChild(cell);
      }
      // Crafting grid — 2×2 by default, 3×3 when at crafting table
      const cg2 = frame.querySelector('#craftGridEl');
      cg2.style.gridTemplateColumns = `repeat(${craftSize}, 34px)`;
      cg2.innerHTML = '';
      for (let r = 0; r < craftSize; r++) for (let c = 0; c < craftSize; c++) {
        const idx = r * 3 + c;
        const div = document.createElement('div');
        div.innerHTML = slotHTML(craftGrid[idx], 'craft-cell');
        const cell = div.firstElementChild;
        cell.addEventListener('mousedown', e => { clickInvSlot(() => craftGrid[idx], (v) => { craftGrid[idx] = v; recomputeCraftResult(); }, e); });
        cell.addEventListener('contextmenu', e => e.preventDefault());
        cg2.appendChild(cell);
      }
      const cr2 = frame.querySelector('#craftResultEl');
      cr2.innerHTML = slotHTML(craftResult, craftResult ? 'craft-out can' : 'craft-out');
      cr2.firstElementChild?.addEventListener('mousedown', e => {
        e.preventDefault(); if (!craftResult) return;
        const r = matchRecipe(); if (!r) return;
        // Creative: just consume ingredients, don't add output (already infinite)
        consumeGridOnce(); recomputeCraftResult(); renderInventoryPanel();
      });
      cursorEl.innerHTML = cursorItem ? slotHTML(cursorItem, 'cursor-slot') : '';
      cursorEl.style.display = cursorItem ? 'block' : 'none';
      return;
    }
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

  // ── Health HUD ───────────────────────────────────────────────────────────
  function updateHealthHUD() {
    const hRow = document.getElementById('healthRow');
    const fRow = document.getElementById('hungerRow');
    if (!hRow) return;
    hRow.innerHTML = '';
    for (let i = 0; i < 10; i++) {
      const hp = playerHealth - i * 2;
      const span = document.createElement('span');
      span.className = 'hud-heart';
      if (hp >= 2)      { span.textContent = '♥'; span.style.color = '#e33'; }
      else if (hp === 1){ span.textContent = '♥'; span.style.color = '#e33'; span.style.opacity = '0.5'; }
      else              { span.textContent = '♡'; span.style.color = '#555'; }
      hRow.appendChild(span);
    }
    fRow.innerHTML = '';
    for (let i = 0; i < 10; i++) {
      const fp = playerHunger - i * 2;
      const span = document.createElement('span');
      span.className = 'hud-food';
      if (fp >= 2)      { span.textContent = '◉'; span.style.color = '#c84'; }
      else if (fp === 1){ span.textContent = '◉'; span.style.color = '#c84'; span.style.opacity = '0.5'; }
      else              { span.textContent = '○'; span.style.color = '#444'; }
      fRow.appendChild(span);
    }
  }

  // ── PvP ──────────────────────────────────────────────────────────────────
  function showToast(msg, color) {
    const el = document.createElement('div');
    el.style.cssText = `position:absolute;top:38%;left:50%;transform:translate(-50%,-50%);
      background:rgba(0,0,0,0.78);color:${color||'#fff'};font:bold 1.1rem sans-serif;
      padding:10px 22px;border-radius:10px;z-index:60;pointer-events:none;
      transition:opacity 0.4s;text-align:center;`;
    el.textContent = msg;
    document.getElementById('mcApp').appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; }, 1400);
    setTimeout(() => el.remove(), 1900);
  }

  function tryPvpAttack() {
    if (pvpCooldown > 0) return;
    const toolId = getSelectedTool();
    const tool = TOOLS[toolId];
    const damage = !tool ? 1
      : tool.kind === 'sword'   ? 3 + tool.tier
      : tool.kind === 'axe'     ? 2 + tool.tier
      : tool.kind === 'pickaxe' ? 1 + (tool.tier >> 1)
      : 1;

    const eyePos = camera.position.clone();
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
    let bestId = null, bestDist = REACH + 1;
    for (const [id, o] of Object.entries(others)) {
      if (!o.mesh) continue;
      const op = new THREE.Vector3(o.x, o.y + 0.9, o.z);
      const toP = op.clone().sub(eyePos);
      const dist = toP.length();
      if (dist > REACH + 1) continue;
      if (toP.normalize().dot(fwd) < 0.65) continue;
      if (dist < bestDist) { bestDist = dist; bestId = id; }
    }
    if (!bestId) return;
    pvpCooldown = 0.5;
    // Compute knockback direction (attacker → target, XZ only)
    const tgt = others[bestId];
    const kbDx = tgt ? tgt.x - player.pos.x : 0;
    const kbDz = tgt ? tgt.z - player.pos.z : 0;
    const kbLen = Math.sqrt(kbDx*kbDx + kbDz*kbDz) || 1;
    bcast('pvp_hit', { targetId: bestId, damage, attackerId: clientId, attackerName: myName,
                       kbx: kbDx/kbLen, kbz: kbDz/kbLen });
    // Swing arm animation
    armSwing = Math.PI * 0.4;
  }

  function takeDamage(amount) {
    if (gameMode !== 'survival') return;
    playerHealth = Math.max(0, playerHealth - amount);
    updateHealthHUD();
    const flash = document.getElementById('damageFlash');
    if (flash) { flash.classList.add('hit'); hitFlashTimer = 0.35; }
    if (playerHealth <= 0) showDeathScreen();
  }

  function showDeathScreen() {
    playerDead = true;
    if (document.pointerLockElement) document.exitPointerLock();
    inputKeys.fwd = inputKeys.back = inputKeys.left = inputKeys.right = false;
    inputKeys.jump = inputKeys.sprint = false;
    mouseDownLeft = false; mining = null;
    document.getElementById('deathScreen').style.display = 'flex';
    // Loop keeps running so sky/mobs continue
  }

  window.mc3dRespawn = function() {
    playerHealth = maxHealth; playerHunger = maxHunger;
    playerAir = maxAir; airDmgTimer = 0;
    flying = false; flyVy = 0; airPeakY = null;
    const sp = spawnPoint ? new THREE.Vector3(spawnPoint.x, spawnPoint.y, spawnPoint.z) : findSpawn();
    player.pos.copy(sp); player.vy = 0;
    document.getElementById('deathScreen').style.display = 'none';
    playerDead = false;
    updateHealthHUD();
  };

  // ── World Save / Load ────────────────────────────────────────────────────
  async function saveWorld() {
    if (!roomCode || !running || !myId) return;
    try {
      const data = {
        seed: worldSeed, gm: gameMode, gt: gameType,
        e: [...edits.entries()],
        inv: inventory.map(s => s ? { ...s } : null),
        pos: [+player.pos.x.toFixed(1), +player.pos.y.toFixed(1), +player.pos.z.toFixed(1)],
        t: Date.now(),
        worldTime: +worldTime.toFixed(1),
        spawnPt: spawnPoint ? [+spawnPoint.x.toFixed(1), +spawnPoint.y.toFixed(1), +spawnPoint.z.toFixed(1)] : null,
        furnaces: [...furnaceStates.entries()].map(([k,fs]) => [k, {
          slotIn:fs.slotIn, slotFuel:fs.slotFuel, slotOut:fs.slotOut,
          fuelTimer:+fs.fuelTimer.toFixed(2), fuelMax:+fs.fuelMax.toFixed(2), smeltTimer:+fs.smeltTimer.toFixed(2)
        }]),
      };
      await sb.from('mc3d_worlds').upsert(
        { user_id: myId, room_code: roomCode, data, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,room_code' }
      );
    } catch(err) { console.warn('[save]', err); }
  }

  async function _getSavedWorlds() {
    if (!myId) return [];
    try {
      const { data: rows } = await sb.from('mc3d_worlds')
        .select('room_code, data, updated_at')
        .eq('user_id', myId)
        .order('updated_at', { ascending: false })
        .limit(5);
      return (rows || []).map(r => ({ code: r.room_code, ...r.data }));
    } catch { return []; }
  }

  async function renderSavedWorlds(containerId, filterGt) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '<div class="saved-worlds-label" style="opacity:0.4">Loading…</div>';
    // Ensure authenticated so we can read saves
    if (!myId) await getMyUser();
    let worlds = await _getSavedWorlds();
    // Filter by game type: sp shows solo worlds, mp shows multiplayer worlds
    if (filterGt) {
      if (filterGt === 'sp') worlds = worlds.filter(w => !w.gt || w.gt === 'sp');
      else if (filterGt === 'mp') worlds = worlds.filter(w => w.gt === 'mp');
    }
    if (!worlds.length) { el.innerHTML = ''; return; }
    el.innerHTML = '<div class="saved-worlds-label">Continue a world</div>' +
      worlds.map(w => {
        const dt = w.t ? new Date(w.t).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '';
        const icon = w.gm === 'creative' ? '🎨' : '⚔️';
        return `<div class="saved-world-row" data-code="${w.code}">
          <span class="saved-world-code">${w.code}</span>
          <span class="saved-world-meta">${icon} ${dt}</span>
          <button class="saved-cont-btn" data-action="play">▶ Play</button>
          <button class="saved-del-btn" data-action="del">✕</button>
        </div>`;
      }).join('');
    el.addEventListener('click', async e => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const row = btn.closest('.saved-world-row');
      const code = row?.dataset.code;
      if (!code) return;
      if (btn.dataset.action === 'del') {
        try { await sb.from('mc3d_worlds').delete().eq('user_id', myId).eq('room_code', code); } catch {}
        renderSavedWorlds(containerId, filterGt);
      } else if (btn.dataset.action === 'play') {
        await continueWorld(code);
      }
    }, { once: false });
  }

  async function continueWorld(code) {
    if (!await getMyUser()) return;
    let saved = null;
    try {
      const { data: row } = await sb.from('mc3d_worlds')
        .select('data').eq('user_id', myId).eq('room_code', code).single();
      saved = row?.data;
    } catch {}
    if (!saved) return;
    roomCode = code;
    worldSeed = saved.seed;
    gameMode = saved.gm || 'survival';
    gameType = saved.gt || 'sp';
    isHost = true;
    // Advance worldTime by real-world elapsed seconds since last save so the
    // day/night cycle keeps running even while the tab was closed
    const savedAt = saved.t || Date.now();
    const elapsed = Math.max(0, (Date.now() - savedAt) / 1000);
    worldTime = (saved.worldTime || 0) + elapsed;
    if (saved.spawnPt) spawnPoint = { x: saved.spawnPt[0], y: saved.spawnPt[1], z: saved.spawnPt[2] };
    for (const [k, v] of (saved.e || [])) edits.set(k, v);
    for (let i = 0; i < INV_SIZE; i++) inventory[i] = saved.inv?.[i] ?? null;
    furnaceStates.clear();
    for (const [k, fs] of (saved.furnaces || [])) furnaceStates.set(k, { ...fs });
    const savedPos = saved.pos;
    document.getElementById('lobbyPanel').style.display = 'none';
    resize();
    if (gameType !== 'sp') connectRoom(code);
    beginPlaying();
    if (savedPos) { player.pos.set(savedPos[0], savedPos[1], savedPos[2]); player.vy = 0; }
  }

  // ── Boot ────────────────────────────────────────────────────────────────
  function findNonDesertOrigin() {
    // Scan biomes cheaply (no chunk generation) to find nearest non-desert chunk
    for (let r = 0; r < 30; r++) {
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const wx = dx * CHUNK_W + CHUNK_W / 2;
        const wz = dz * CHUNK_W + CHUNK_W / 2;
        if (getBiome(wx, wz) !== 'desert') return { x: wx, z: wz };
      }
    }
    return { x: 0.5, z: 0.5 };
  }

  // ── PvP Arena builder ────────────────────────────────────────────────────
  const PVP_SPAWN_Y = SEA_LEVEL + 1; // surface is at SEA_LEVEL, player stands 1 above
  const PVP_SPAWNS = [
    [8.5,0,8.5],[-8.5,0,8.5],[8.5,0,-8.5],[-8.5,0,-8.5],
    [8.5,0,0.5],[-8.5,0,0.5],[0.5,0,8.5],[0.5,0,-8.5],
  ].map(([x,,z]) => [x, PVP_SPAWN_Y, z]);

  function beginPlaying() {
    if (running) return; // guard against double-call
    // Clear any stale world geometry from previous sessions
    for (const [, entry] of chunkMeshes) {
      for (const m of Object.values(entry.meshes)) scene.remove(m);
    }
    chunks.clear(); chunkMeshes.clear();
    lastChunkX = lastChunkZ = null;
    if (gameType === 'pvp') {
      player.pos.set(0, WY, 0);
      updateChunks();
      const spIdx = Math.abs(clientId.split('').reduce((h,c)=>((h<<5)-h+c.charCodeAt(0))|0, 0)) % PVP_SPAWNS.length;
      const sp = PVP_SPAWNS[spIdx];
      // Ensure the spawn chunk is generated before placing the player
      const scx = Math.floor(sp[0] / CHUNK_W), scz = Math.floor(sp[2] / CHUNK_W);
      if (!chunks.has(ckey(scx, scz))) chunks.set(ckey(scx, scz), generateChunk(scx, scz));
      // Scan for actual surface y so player doesn't spawn in air
      let spawnY = SEA_LEVEL + 1;
      for (let y = WY - 2; y > 0; y--) {
        if (isSolidAt(Math.floor(sp[0]), y, Math.floor(sp[2])) && getB(Math.floor(sp[0]), y+1, Math.floor(sp[2])) === AIR) {
          spawnY = y + 1; break;
        }
      }
      player.pos.set(sp[0], spawnY, sp[2]);
      player.vy = 0; player.yaw = Math.PI; player.pitch = 0;
    } else {
      // Prefer spawning in a non-desert biome
      const origin = findNonDesertOrigin();
      player.pos.set(origin.x, WY, origin.z);
      updateChunks();
      const sp = findSpawn();
      player.pos.copy(sp); player.vy = 0; player.yaw = 0; player.pitch = 0;
    }
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

    if (gameType === 'pvp') {
      // PvP starter kit — bring the heat
      const md = id => TOOL_MAX_DUR[id] ?? 60;
      inventory[0] = { kind:'tool', id:ITEM_DIAMOND_SWORD, dur:md(ITEM_DIAMOND_SWORD) };
      inventory[1] = { kind:'tool', id:ITEM_DIAMOND_AXE,   dur:md(ITEM_DIAMOND_AXE)  };
      inventory[2] = { kind:'tool', id:ITEM_DIAMOND_PICK,  dur:md(ITEM_DIAMOND_PICK)  };
      inventory[3] = { kind:'item', id:ITEM_COOKED_BEEF, count:16 };
      inventory[4] = { kind:'item', id:ITEM_APPLE, count:16 };
      inventory[5] = { kind:'block', block:STONE, count:64 };
      inventory[6] = { kind:'block', block:WOOD,  count:32 };
      inventory[7] = { kind:'block', block:TORCH, count:64 };
    }

    if (gameMode === 'creative') {
      // Infinite block palette — fills the whole inventory, never runs out
      const palette = [
        GRASS, DIRT, STONE, SAND, SNOW, WOOD, PLANK, LEAVES,
        CRAFTING_TABLE, WATER, COAL_ORE, IRON_ORE, COPPER_ORE,
        GOLD_ORE, DIAMOND_ORE, REDSTONE_ORE, BEDROCK,
      ];
      palette.forEach((b, i) => {
        if (i < INV_SIZE) inventory[i] = { kind:'block', block:b, count:64, infinite:true };
      });
    }

    running = true;
    pvpEnabled = (gameType === 'pvp');
    playerHealth = maxHealth; playerHunger = maxHunger;
    jumpStrength = JUMP_VEL; playerSpeed = 5.5; // always reset settings to default
    flying = false; flyVy = 0; airPeakY = null; prevWasGrounded = true;
    pvpCooldown = 0; pvpKills = 0; playerDead = false; hungerTimer = 0; healTimer = 0;
    // Clear any leftover mobs from a previous session
    for (const m of mobs) scene.remove(m.mesh);
    mobs = []; mobSpawnTimer = 5; worldTime = 0;
    // Reset furnace
    furnaceOpen = false; activeFurnaceKey = null; furnaceStates.clear();
    if (furnacePanelEl) furnacePanelEl.style.display = 'none';
    // Reset chest
    chestOpen = false;
    if (chestPanelEl) chestPanelEl.style.display = 'none';
    settingsOpen = false;
    if (settingsPanelEl) { settingsPanelEl.remove(); settingsPanelEl = null; }

    document.getElementById('lobbyPanel').style.display = 'none';
    document.getElementById('waitPanel').style.display = 'none';
    document.getElementById('crosshair').style.display = 'block';
    document.getElementById('hotbar').style.display = 'flex';
    document.getElementById('hudInfo').style.display = 'block';

    // Health/hunger HUD (survival only)
    const hhHud = document.getElementById('healthHungerHud');
    if (hhHud) hhHud.style.display = gameMode === 'survival' ? 'flex' : 'none';
    updateHealthHUD();

    // Game mode tag
    const modeTag = document.getElementById('gameModeTag');
    if (modeTag) {
      modeTag.style.display = 'block';
      const typeLabel = gameType === 'pvp' ? ` · PvP · 0 kills` : gameType === 'sp' ? ' · Solo' : ' · Multi';
      modeTag.textContent = (gameMode === 'creative' ? '🎨 Creative' : '⚔️ Survival') + typeLabel;
      modeTag.style.color = gameMode === 'creative' ? '#a78bfa' : '#86efac';
    }

    // Mode toast — big centre flash so you can't miss it
    const toast = document.createElement('div');
    toast.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);' +
      'background:rgba(0,0,0,0.75);color:#fff;font:bold 1.5rem "Trebuchet MS",sans-serif;' +
      'padding:18px 36px;border-radius:14px;z-index:50;pointer-events:none;' +
      'text-align:center;letter-spacing:1px;transition:opacity 0.6s;';
    toast.textContent = (gameMode === 'creative' ? '🎨 Creative Mode' : '⚔️ Survival Mode');
    document.getElementById('mcApp').appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; }, 1800);
    setTimeout(() => toast.remove(), 2400);

    if (gameType === 'sp') {
      document.getElementById('roomBadge').textContent = '🔒 Singleplayer';
    } else if (gameType === 'pvp') {
      document.getElementById('roomBadge').textContent = '⚔️ PvP Arena · Room: ' + roomCode;
    } else {
      document.getElementById('roomBadge').textContent = 'Room: ' + roomCode;
    }

    if (atlasImg.complete && Object.keys(blockThumbs).length === 0) makeAtlasThumbs(atlasImg);
    else buildHotbarUI();

    // Autosave every 30s for singleplayer/multiplayer (not PvP arena)
    if (autosaveInterval) clearInterval(autosaveInterval);
    autosaveInterval = setInterval(saveWorld, 30000);
    window.addEventListener('beforeunload', () => { saveWorld(); }); // fire-and-forget on tab close

    resize();
    last = performance.now();
    requestAnimationFrame(loop);
  }

  let last = 0, moveBcastTimer = 0, waterAnimT = 0, mobSyncTimer = 0;
  function loop(now) {
    if (!running) return;
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    // PvP: always day; creative: no day/night cycle
    if (gameType !== 'pvp' && gameMode !== 'creative') worldTime += dt;
    tick(dt);
    updateChunks();
    processDirtyChunks(3);
    updateMining(dt);
    // Repeated mob attack while holding left click (0.5s cooldown)
    if (mouseDownLeft) {
      mobAttackCooldown -= dt;
      if (mobAttackCooldown <= 0 && tryMobAttack()) mobAttackCooldown = 0.5;
    } else { mobAttackCooldown = 0; }
    updateDrops(dt);
    updateFurnace(dt);
    // Only host (or singleplayer) simulates mob AI + grass spread
    if (gameType === 'sp' || isHost) { updateMobs(dt); updateGrassSpread(dt); }

    // Host broadcasts mob state to non-hosts every 500ms
    if (channel && isHost) {
      mobSyncTimer += dt;
      if (mobSyncTimer >= 0.5) {
        mobSyncTimer = 0;
        bcast('mob_sync', {
          wt: +worldTime.toFixed(1),
          mobs: mobs.map(m => ({
            id: m.id, type: m.type,
            x: +m.pos.x.toFixed(1), y: +m.pos.y.toFixed(1), z: +m.pos.z.toFixed(1),
            ry: +m.mesh.rotation.y.toFixed(2), hp: m.health
          }))
        });
      }
    }
    updateHand(dt);
    if (torchScanDirty) _updateTorchObjects();
    processLeafDecay();

    waterAnimT += dt * 0.18;
    waterTex.offset.y = -waterAnimT;
    waterTex.offset.x = waterAnimT * 0.5;

    // ── Day / Night sky ───────────────────────────────────────────────────
    const _lerpHex = (a, b, t) => {
      const ar=(a>>16)&255,ag=(a>>8)&255,ab=a&255;
      const br=(b>>16)&255,bg=(b>>8)&255,bb=b&255;
      return ((ar+((br-ar)*t)|0)<<16)|((ag+((bg-ag)*t)|0)<<8)|((ab+((bb-ab)*t)|0));
    };

    let _skyHex, _nightFac;
    if (gameType === 'pvp' || gameMode === 'creative') {
      // PvP / creative: always bright midday, no cycle
      _skyHex = 0x88c5ff; _nightFac = 1.0;
      sun.position.set(0, 120, 40); sun.intensity = 1.0;
    } else {
      const _df = dayFrac();
      if (_df < 0.05)       _skyHex = _lerpHex(0x1a0a2e, 0xff7733, _df / 0.05);
      else if (_df < 0.10)  _skyHex = _lerpHex(0xff7733, 0x88c5ff, (_df-0.05)/0.05);
      else if (_df < 0.40)  _skyHex = 0x88c5ff;
      else if (_df < 0.50)  _skyHex = _lerpHex(0x88c5ff, 0xff5500, (_df-0.40)/0.10);
      else if (_df < 0.55)  _skyHex = _lerpHex(0xff5500, 0x1a0a2e, (_df-0.50)/0.05);
      else                  _skyHex = 0x1a0a2e;
      _nightFac = (_df < 0.4) ? 1.0
               : (_df < 0.55) ? 1.0 - ((_df-0.4)/0.15)*0.95
               : (_df > 0.9)  ? (_df-0.9)/0.10 * 0.95
               : 0.05;
      const _sunAngle = _df * Math.PI * 2;
      sun.position.set(Math.sin(_sunAngle)*120, Math.cos(_sunAngle)*120, 40);
      sun.intensity = Math.max(0, Math.cos(_sunAngle) * 1.2);
    }
    scene.background.setHex(_skyHex);

    const uw = headInWater();
    document.getElementById('underwaterOverlay').style.display = uw ? 'block' : 'none';
    if (uw) {
      scene.fog.color.setHex(0x001a66);
      scene.fog.near = 2; scene.fog.far = 14;
    } else {
      scene.fog.color.setHex(_skyHex);
      if (gameMode === 'creative') {
        scene.fog.near = 48; scene.fog.far = 96;
      } else {
        const altT = Math.max(0, Math.min(1, (player.pos.y - 32) / 24));
        scene.fog.near = 100 - altT * 72;
        scene.fog.far  = 240 - altT * 160;
      }
    }

    // Sky-light + torch-light ambient calculation
    {
      const py = Math.floor(player.pos.y) + 1;
      const px = Math.floor(player.pos.x), pz = Math.floor(player.pos.z);
      const R = 12;
      let bestSky = 0;
      outer: for (let dx = -R; dx <= R; dx++) {
        for (let dz = -R; dz <= R; dz++) {
          const hDist = Math.abs(dx) + Math.abs(dz);
          if (hDist > R) continue;
          let colLight = 15;
          for (let sy = WY - 1; sy > py && colLight > 0; sy--) {
            const b = getB(px + dx, sy, pz + dz);
            if      (b === LEAVES) colLight = Math.max(0, colLight - 1);
            else if (b === WATER)  colLight = Math.max(0, colLight - 2);
            else if (SOLID.has(b)) { colLight = 0; break; }
          }
          const effective = Math.max(0, colLight - hDist);
          if (effective > bestSky) {
            bestSky = effective;
            if (bestSky >= 15) break outer;
          }
        }
      }
      // Torch light: boost ambient near torches (radius 8 blocks)
      let torchBoost = 0;
      for (const key of torchObjects.keys()) {
        const parts = key.split(',');
        const dist = Math.sqrt(
          (px - +parts[0]) ** 2 + (py - +parts[1] - 0.5) ** 2 + (pz - +parts[2]) ** 2
        );
        if (dist < 8) torchBoost = Math.max(torchBoost, (1 - dist / 8) * 0.85);
      }
      const skyTarget = (0.05 + (bestSky / 15) * (1.1 - 0.05)) * _nightFac;
      const targetIntensity = Math.max(skyTarget, torchBoost);
      ambientLight.intensity += (targetIntensity - ambientLight.intensity) * Math.min(1, dt * 5);
    }

    // ── Survival tick ─────────────────────────────────────────────────────
    if (gameMode === 'survival') {
      pvpCooldown = Math.max(0, pvpCooldown - dt);
      // Drowning
      const submerged = headInWater();
      if (submerged) {
        playerAir = Math.max(0, playerAir - dt);
        if (playerAir <= 0) {
          airDmgTimer += dt;
          if (airDmgTimer >= 1) { airDmgTimer = 0; takeDamage(2); }
        }
      } else {
        playerAir = Math.min(maxAir, playerAir + dt * 2.5);
        airDmgTimer = 0;
      }
      updateAirHUD(submerged && playerAir < maxAir - 0.1);
      // Hunger drain: standing still = 0, walking = 1pt/150s (~50 min), sprinting = 1pt/50s (~17 min)
      const _moving = inputKeys.fwd || inputKeys.back || inputKeys.left || inputKeys.right;
      if (inputKeys.sprint && _moving) hungerTimer += dt / 50;
      else if (_moving)                hungerTimer += dt / 150;
      if (hungerTimer >= 1) {
        hungerTimer -= 1;
        playerHunger = Math.max(0, playerHunger - 1);
        updateHealthHUD();
      }
      // Starve damage when hunger = 0
      if (playerHunger === 0) {
        healTimer += dt;
        if (healTimer >= 2) { healTimer = 0; takeDamage(1); }
      } else {
        // Heal when hunger full
        healTimer += dt;
        if (healTimer >= 3 && playerHunger >= 18 && playerHealth < maxHealth) {
          healTimer = 0; playerHealth = Math.min(maxHealth, playerHealth + 1); updateHealthHUD();
        }
      }
      // Damage flash fade
      if (hitFlashTimer > 0) {
        hitFlashTimer -= dt;
        if (hitFlashTimer <= 0) document.getElementById('damageFlash')?.classList.remove('hit');
      }
    }

    moveBcastTimer += dt;
    if (moveBcastTimer > 0.05) {
      moveBcastTimer = 0;
      // Compact held-item descriptor for other clients to render
      const _hs = inventory[hotbarSlot];
      const _held = !_hs ? null
        : _hs.kind === 'tool'  ? { k:'t', id:_hs.id }
        : _hs.kind === 'block' ? { k:'b', bl:_hs.block }
        : _hs.kind === 'item'  ? { k:'i', id:_hs.id }
        : null;
      bcast('move', {
        id: clientId, name: myName, color: myColor,
        x: +player.pos.x.toFixed(2), y: +player.pos.y.toFixed(2), z: +player.pos.z.toFixed(2),
        yaw: +player.yaw.toFixed(2),
        held: _held,
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

  // ── Lobby wizard ────────────────────────────────────────────────────────
  const ALL_STEPS = ['lstep1','lstep2','lstep3sp','lstep3mp','lstep3pvp'];
  function showStep(id) {
    ALL_STEPS.forEach(s => { const el = document.getElementById(s); if (el) el.style.display = 'none'; });
    const el = document.getElementById(id); if (el) el.style.display = '';
  }

  // Back buttons
  document.querySelectorAll('.back-btn').forEach(btn => {
    btn.addEventListener('click', () => showStep(btn.dataset.back));
  });

  // Step 1: choose game type
  document.querySelectorAll('#lstep1 .choice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      gameType = btn.dataset.next;
      if (gameType === 'pvp') showStep('lstep3pvp');
      else showStep('lstep2');
    });
  });

  // Step 2: choose mode → step 3
  document.querySelectorAll('#lstep2 .choice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      gameMode = btn.dataset.mode;
      showStep(gameType === 'sp' ? 'lstep3sp' : 'lstep3mp');
      renderSavedWorlds(gameType === 'sp' ? 'spSavedWorlds' : 'mpSavedWorlds', gameType);
    });
  });

  // ── Singleplayer ─────────────────────────────────────────────────────────
  document.getElementById('spPlayBtn').addEventListener('click', async () => {
    if (!await getMyUser()) return;
    roomCode = genCode(); isHost = true;
    worldSeed = Math.floor(Math.random() * 2147483647) + 1;
    document.getElementById('lobbyPanel').style.display = 'none';
    resize(); beginPlaying();
  });

  // ── Multiplayer ──────────────────────────────────────────────────────────
  document.getElementById('createBtn').addEventListener('click', async () => {
    if (!await getMyUser()) return;
    roomCode = genCode(); isHost = true;
    worldSeed = Math.floor(Math.random() * 2147483647) + 1;
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
    document.getElementById('waitMsg').textContent = 'Looking for world…';
    resize(); connectRoom(roomCode);
    // beginPlaying() is called by applyEditsBatch once the host's world arrives.
    // Fallback: if no edits received within 7s, start with local seed anyway.
    setTimeout(() => { if (!running) beginPlaying(); }, 7000);
  });
  document.getElementById('codeInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('joinBtn').click();
  });

  // ── PvP Arena ────────────────────────────────────────────────────────────
  document.getElementById('pvpJoinBtn').addEventListener('click', async () => {
    if (!await getMyUser()) return;
    roomCode = 'PVP1'; gameMode = 'survival'; gameType = 'pvp';
    worldSeed = seedFromCode('PVP1');
    isHost = false;
    document.getElementById('lobbyPanel').style.display = 'none';
    document.getElementById('waitCode').textContent = 'PVP1';
    document.getElementById('waitPanel').style.display = 'flex';
    resize(); connectRoom('PVP1');
    setTimeout(() => {
      if (Object.keys(others).length === 0) isHost = true;
      if (!running) beginPlaying();
    }, 800);
  });

  resize();
})();
