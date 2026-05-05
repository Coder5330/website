(() => {
  // ── Constants ────────────────────────────────────────────────────────────
  const W = 128, H = 60;
  const T = 32;
  const GRAVITY = 22, JUMP = 10.5, WALK = 6, MAX_FALL = 18;
  const PW = 0.75, PH = 1.85, REACH = 5.5;

  const AIR=0,GRASS=1,DIRT=2,STONE=3,WOOD=4,LEAVES=5,SAND=6,PLANK=7,COBBLE=8;

  const BLK = {
    [GRASS]:  { fill:'#7a5230', top:'#5aac44', solid:true  },
    [DIRT]:   { fill:'#8a5e30', top:null,      solid:true  },
    [STONE]:  { fill:'#808080', top:null,      solid:true  },
    [WOOD]:   { fill:'#7a4f28', top:null,      solid:true  },
    [LEAVES]: { fill:'#3a8c4a', top:null,      solid:false },
    [SAND]:   { fill:'#e5d68a', top:null,      solid:true  },
    [PLANK]:  { fill:'#c8954a', top:null,      solid:true  },
    [COBBLE]: { fill:'#909090', top:null,      solid:true  },
  };

  const HOTBAR = [GRASS,DIRT,STONE,WOOD,PLANK,COBBLE,SAND];
  const PCOLORS = ['#e74c3c','#3498db','#2ecc71','#f1c40f','#9b59b6','#1abc9c','#e67e22','#e91e63'];

  // ── State ────────────────────────────────────────────────────────────────
  let world=null, myPlayer=null;
  let myId='', myName='Player', myColor=PCOLORS[0];
  let others={}, channel=null, isHost=false, roomCode='';
  let hotbarSlot=0, running=false, lastFrame=0, moveBcastTimer=0;
  let targetBx=-1, targetBy=-1, worldTimeout=null;
  const keys={left:false,right:false,up:false};
  const cam={x:0,y:0};

  // ── World helpers ────────────────────────────────────────────────────────
  const get=(x,y)=>{ if(x<0||x>=W) return AIR; if(y<0) return AIR; if(y>=H) return STONE; return world[y*W+x]; };
  const set=(x,y,v)=>{ if(x>=0&&x<W&&y>=0&&y<H) world[y*W+x]=v; };
  const solid=(x,y)=>{ const b=get(x,y); return b!==AIR&&BLK[b]?.solid!==false; };

  // ── World generation ─────────────────────────────────────────────────────
  function generateWorld() {
    world = new Uint8Array(W*H);
    let s=Math.random()*999;
    const rng=()=>{ s=(s*9301+49297)%233280; return s/233280; };

    const surf=new Int32Array(W);
    for(let x=0;x<W;x++){
      surf[x]=Math.round(H*0.42+Math.sin(x*0.11)*3+Math.sin(x*0.05+1.1)*6+Math.sin(x*0.023+2.2)*10);
      surf[x]=Math.max(10,Math.min(H-8,surf[x]));
    }
    for(let x=0;x<W;x++){
      const h=surf[x];
      set(x,h,GRASS);
      for(let y=h+1;y<=h+3;y++) set(x,y,DIRT);
      for(let y=h+4;y<H;y++) set(x,y,STONE);
    }
    // Caves
    for(let n=0;n<30;n++){
      let cx=Math.floor(rng()*W), cy=Math.floor(H*0.55+rng()*(H*0.35));
      for(let i=0;i<25;i++){
        for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++) if(rng()<0.65) set(cx+dx,cy+dy,AIR);
        cx=Math.max(1,Math.min(W-2,cx+Math.round(rng()*2-1)));
        cy=Math.max(12,Math.min(H-2,cy+Math.round(rng()*2-1)));
      }
    }
    // Sand
    for(let x=1;x<W-1;x++) if(surf[x]>H*0.47&&rng()<0.1) for(let dy=0;dy<3;dy++) set(x,surf[x]+dy,SAND);
    // Trees
    for(let x=3;x<W-4;x++){
      if(get(x,surf[x])===GRASS&&rng()<0.1){
        const th=4+Math.floor(rng()*2);
        for(let dy=1;dy<=th;dy++) set(x,surf[x]-dy,WOOD);
        for(let dy=-2;dy<=0;dy++) for(let dx=-2;dx<=2;dx++) if(get(x+dx,surf[x]-th+dy)===AIR) set(x+dx,surf[x]-th+dy,LEAVES);
        set(x,surf[x]-th-1,LEAVES);
      }
    }
  }

  function findSpawn(){
    const mid=Math.floor(W/2);
    for(let dx=0;dx<W;dx++){
      for(const x of [mid+dx,mid-dx]){
        if(x<0||x>=W) continue;
        for(let y=5;y<H-3;y++) if(!solid(x,y)&&!solid(x,y+1)&&solid(x,y+2)) return {x:x+(1-PW)/2,y};
      }
    }
    return {x:W/2,y:H*0.38};
  }

  // ── Physics ──────────────────────────────────────────────────────────────
  function physicsTick(dt){
    const p=myPlayer;
    p.vx=keys.left?-WALK:keys.right?WALK:0;
    p.vy=Math.min(p.vy+GRAVITY*dt,MAX_FALL);
    if(keys.up&&p.grounded){ p.vy=-JUMP; p.grounded=false; }

    p.x+=p.vx*dt;
    { const tx=p.vx>0?Math.floor(p.x+PW):Math.floor(p.x);
      let hit=false;
      for(let ty=Math.floor(p.y+0.05);ty<=Math.floor(p.y+PH-0.05);ty++) if(solid(tx,ty)){hit=true;break;}
      if(hit){ p.x=p.vx>0?tx-PW-0.001:tx+1+0.001; p.vx=0; } }

    p.grounded=false;
    p.y+=p.vy*dt;
    { const ty=p.vy>0?Math.floor(p.y+PH):Math.floor(p.y);
      let hit=false;
      for(let tx=Math.floor(p.x+0.05);tx<=Math.floor(p.x+PW-0.05);tx++) if(solid(tx,ty)){hit=true;break;}
      if(hit){ if(p.vy>0){p.y=ty-PH-0.001;p.grounded=true;}else p.y=ty+1+0.001; p.vy=0; } }

    if(p.x<0){p.x=0;p.vx=0;} if(p.x+PW>W){p.x=W-PW;p.vx=0;}
    if(p.y>H+2){ const sp=findSpawn(); p.x=sp.x; p.y=sp.y; p.vy=0; }
  }

  // ── Camera ───────────────────────────────────────────────────────────────
  function updateCamera(){
    const tw=canvas.width/T, th=canvas.height/T;
    const tx=myPlayer.x+PW/2-tw/2, ty=myPlayer.y+PH/2-th/2;
    cam.x+=(Math.max(0,Math.min(W-tw,tx))-cam.x)*0.12;
    cam.y+=(Math.max(0,Math.min(H-th,ty))-cam.y)*0.12;
  }

  // ── Render ───────────────────────────────────────────────────────────────
  function render(){
    const cw=canvas.width, ch=canvas.height;
    const sky=ctx.createLinearGradient(0,0,0,ch);
    sky.addColorStop(0,'#4498cc'); sky.addColorStop(1,'#87d0f0');
    ctx.fillStyle=sky; ctx.fillRect(0,0,cw,ch);

    const x0=Math.max(0,Math.floor(cam.x)-1), x1=Math.min(W,x0+Math.ceil(cw/T)+2);
    const y0=Math.max(0,Math.floor(cam.y)-1), y1=Math.min(H,y0+Math.ceil(ch/T)+2);
    for(let ty=y0;ty<y1;ty++) for(let tx=x0;tx<x1;tx++){
      const b=get(tx,ty); if(b===AIR) continue;
      const info=BLK[b]; if(!info) continue;
      const sx=Math.round((tx-cam.x)*T), sy=Math.round((ty-cam.y)*T);
      ctx.fillStyle=info.fill; ctx.fillRect(sx,sy,T,T);
      if(info.top){ ctx.fillStyle=info.top; ctx.fillRect(sx,sy,T,Math.max(3,Math.round(T*0.18))); }
      ctx.strokeStyle='rgba(0,0,0,0.1)'; ctx.strokeRect(sx+.5,sy+.5,T-1,T-1);
    }

    if(targetBx>=0&&get(targetBx,targetBy)!==AIR){
      const sx=Math.round((targetBx-cam.x)*T), sy=Math.round((targetBy-cam.y)*T);
      ctx.fillStyle='rgba(255,255,255,0.22)'; ctx.fillRect(sx,sy,T,T);
      ctx.strokeStyle='#000'; ctx.lineWidth=2; ctx.strokeRect(sx,sy,T,T); ctx.lineWidth=1;
    }

    for(const op of Object.values(others)) drawPlayer(op.x,op.y,op.color,op.name);
    if(myPlayer) drawPlayer(myPlayer.x,myPlayer.y,myColor,myName,true);
    drawHUD();
  }

  function drawPlayer(x,y,color,name,isMe=false){
    const sx=(x-cam.x)*T, sy=(y-cam.y)*T, pw=PW*T, ph=PH*T;
    ctx.fillStyle='rgba(0,0,0,0.18)'; ctx.fillRect(sx+2,sy+ph+1,pw-2,4);
    ctx.fillStyle=color; ctx.fillRect(sx,sy,pw,ph);
    if(isMe){ ctx.strokeStyle='rgba(255,255,255,0.8)'; ctx.strokeRect(sx+.5,sy+.5,pw-1,ph-1); }
    ctx.fillStyle='#fff'; ctx.fillRect(sx+4,sy+5,5,5); ctx.fillRect(sx+pw-9,sy+5,5,5);
    ctx.fillStyle='#222'; ctx.fillRect(sx+6,sy+7,2,2); ctx.fillRect(sx+pw-7,sy+7,2,2);
    ctx.save(); ctx.font='bold 11px monospace';
    const tw2=ctx.measureText(name).width;
    ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(sx+pw/2-tw2/2-3,sy-17,tw2+6,14);
    ctx.fillStyle=isMe?'#ffe66d':'#fff'; ctx.fillText(name,sx+pw/2-tw2/2,sy-6); ctx.restore();
  }

  function drawHUD(){
    const ss=34,gap=3,total=HOTBAR.length*(ss+gap)-gap;
    let hx=(canvas.width-total)/2; const hy=canvas.height-ss-8;
    HOTBAR.forEach((b,i)=>{
      const sel=i===hotbarSlot;
      ctx.fillStyle=sel?'rgba(255,230,109,0.9)':'rgba(0,0,0,0.55)';
      ctx.fillRect(hx-2,hy-2,ss+4,ss+4);
      const info=BLK[b];
      if(info){ ctx.fillStyle=info.fill; ctx.fillRect(hx+4,hy+4,ss-8,ss-8);
        if(info.top){ ctx.fillStyle=info.top; ctx.fillRect(hx+4,hy+4,ss-8,Math.round((ss-8)*0.2)); } }
      ctx.save(); ctx.font='10px monospace';
      ctx.fillStyle=sel?'#333':'rgba(255,255,255,0.7)'; ctx.fillText(i+1,hx+2,hy+12); ctx.restore();
      hx+=ss+gap;
    });
    ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.fillRect(8,8,128,22);
    ctx.save(); ctx.font='bold 12px monospace'; ctx.fillStyle='#ffe66d'; ctx.fillText('Room: '+roomCode,14,24); ctx.restore();
    const cnt=Object.keys(others).length+1;
    ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.fillRect(8,34,84,20);
    ctx.save(); ctx.font='12px sans-serif'; ctx.fillStyle='#fff'; ctx.fillText('👤 '+cnt+' online',12,49); ctx.restore();
  }

  // ── Input ────────────────────────────────────────────────────────────────
  document.addEventListener('keydown',e=>{
    if(!running) return;
    if(e.key==='a'||e.key==='ArrowLeft'){keys.left=true;e.preventDefault();}
    if(e.key==='d'||e.key==='ArrowRight'){keys.right=true;e.preventDefault();}
    if(e.key==='w'||e.key==='ArrowUp'||e.key===' '){keys.up=true;e.preventDefault();}
    const n=parseInt(e.key); if(n>=1&&n<=HOTBAR.length) hotbarSlot=n-1;
  });
  document.addEventListener('keyup',e=>{
    if(e.key==='a'||e.key==='ArrowLeft') keys.left=false;
    if(e.key==='d'||e.key==='ArrowRight') keys.right=false;
    if(e.key==='w'||e.key==='ArrowUp'||e.key===' ') keys.up=false;
  });

  // ── Canvas ───────────────────────────────────────────────────────────────
  const canvas=document.getElementById('gameCanvas');
  const ctx=canvas.getContext('2d');

  function resizeCanvas(){
    const app=document.getElementById('craftApp');
    canvas.width=app.clientWidth; canvas.height=app.clientHeight;
  }
  window.addEventListener('resize',resizeCanvas);

  canvas.addEventListener('mousemove',e=>{
    if(!running||!myPlayer) return;
    const r=canvas.getBoundingClientRect();
    const sx=canvas.width/r.width, sy2=canvas.height/r.height;
    const mx=(e.clientX-r.left)*sx/T+cam.x, my=(e.clientY-r.top)*sy2/T+cam.y;
    targetBx=Math.floor(mx); targetBy=Math.floor(my);
    const dx=mx-(myPlayer.x+PW/2), dy=my-(myPlayer.y+PH/2);
    if(Math.sqrt(dx*dx+dy*dy)>REACH){targetBx=-1;targetBy=-1;}
  });
  canvas.addEventListener('mouseleave',()=>{targetBx=-1;targetBy=-1;});

  canvas.addEventListener('click',e=>{
    if(!running||targetBx<0||get(targetBx,targetBy)===AIR) return;
    set(targetBx,targetBy,AIR); bcast('block',{x:targetBx,y:targetBy,v:AIR});
  });

  canvas.addEventListener('contextmenu',e=>{
    e.preventDefault();
    if(!running||!myPlayer) return;
    const r=canvas.getBoundingClientRect();
    const sx=canvas.width/r.width, sy2=canvas.height/r.height;
    const mx=(e.clientX-r.left)*sx/T+cam.x, my=(e.clientY-r.top)*sy2/T+cam.y;
    const bx=Math.floor(mx), by2=Math.floor(my);
    const dx=mx-(myPlayer.x+PW/2), dy=my-(myPlayer.y+PH/2);
    if(Math.sqrt(dx*dx+dy*dy)>REACH||get(bx,by2)!==AIR) return;
    if(bx>=Math.floor(myPlayer.x)&&bx<Math.ceil(myPlayer.x+PW)&&
       by2>=Math.floor(myPlayer.y)&&by2<Math.ceil(myPlayer.y+PH)) return;
    const blk=HOTBAR[hotbarSlot]; set(bx,by2,blk); bcast('block',{x:bx,y:by2,v:blk});
  });

  canvas.addEventListener('wheel',e=>{
    if(!running) return; e.preventDefault();
    hotbarSlot=(hotbarSlot+(e.deltaY>0?1:-1)+HOTBAR.length)%HOTBAR.length;
  },{passive:false});

  // ── Multiplayer ──────────────────────────────────────────────────────────
  function bcast(event,payload){ if(channel) channel.send({type:'broadcast',event,payload}); }

  function connectRoom(code){
    if(channel) sb.removeChannel(channel);
    channel=sb.channel('craft:'+code);

    channel.on('presence',{event:'sync'},()=>{ if(isHost&&world) sendWorld(); });
    channel.on('presence',{event:'leave'},({leftPresences})=>{
      const arr=Array.isArray(leftPresences)?leftPresences:Object.values(leftPresences).flat();
      arr.forEach(p=>{ if(p&&p.userId) delete others[p.userId]; });
    });
    channel.on('broadcast',{event:'req_world'},()=>{ if(isHost&&world) sendWorld(); });
    channel.on('broadcast',{event:'world'},({payload})=>{
      if(world) return;
      if(worldTimeout){clearTimeout(worldTimeout);worldTimeout=null;}
      world=new Uint8Array(atob(payload.d).split('').map(c=>c.charCodeAt(0)));
      beginPlaying();
    });
    channel.on('broadcast',{event:'block'},({payload})=>{ set(payload.x,payload.y,payload.v); });
    channel.on('broadcast',{event:'move'},({payload})=>{
      if(payload.id===myId) return;
      others[payload.id]={x:payload.x,y:payload.y,name:payload.name,color:payload.color};
    });

    channel.subscribe(async status=>{
      if(status!=='SUBSCRIBED') return;
      await channel.track({userId:myId,displayName:myName});
      if(!isHost){
        bcast('req_world',{});
        setTimeout(()=>bcast('req_world',{}),1500);
        setTimeout(()=>bcast('req_world',{}),4000);
      }
    });
  }

  function sendWorld(){
    let s=''; world.forEach(b=>s+=String.fromCharCode(b));
    bcast('world',{d:btoa(s)});
  }

  // ── Game loop ────────────────────────────────────────────────────────────
  function beginPlaying(){
    const sp=findSpawn();
    myPlayer={x:sp.x,y:sp.y,vx:0,vy:0,grounded:false};
    cam.x=myPlayer.x-canvas.width/T/2; cam.y=myPlayer.y-canvas.height/T/2;
    running=true;
    document.getElementById('lobbyPanel').style.display='none';
    document.getElementById('waitPanel').style.display='none';
    lastFrame=performance.now();
    requestAnimationFrame(loop);
  }

  function loop(now){
    if(!running) return;
    const dt=Math.min((now-lastFrame)/1000,0.05); lastFrame=now;
    physicsTick(dt); updateCamera();
    moveBcastTimer+=dt;
    if(moveBcastTimer>0.05){
      moveBcastTimer=0;
      bcast('move',{id:myId,name:myName,color:myColor,x:+myPlayer.x.toFixed(2),y:+myPlayer.y.toFixed(2)});
    }
    render();
    requestAnimationFrame(loop);
  }

  // ── Auth + UI ────────────────────────────────────────────────────────────
  async function getMyUser(){
    const {data:{session}}=await sb.auth.getSession();
    if(!session) return false;
    myId=session.user.id; myName=session.user.user_metadata?.display_name||session.user.email?.split('@')[0]||'Player';
    let h=0; for(const c of myId) h=((h<<5)-h+c.charCodeAt(0))|0;
    myColor=PCOLORS[Math.abs(h)%PCOLORS.length]; return true;
  }

  function genCode(){ const p='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let c=''; for(let i=0;i<4;i++) c+=p[Math.floor(Math.random()*p.length)]; return c; }

  document.getElementById('createBtn').addEventListener('click',async()=>{
    if(!await getMyUser()) return;
    roomCode=genCode(); isHost=true;
    document.getElementById('lobbyPanel').style.display='none';
    resizeCanvas(); generateWorld(); connectRoom(roomCode); beginPlaying();
  });

  document.getElementById('joinBtn').addEventListener('click',async()=>{
    const code=document.getElementById('codeInput').value.trim().toUpperCase();
    if(code.length!==4){alert('Enter a 4-letter room code.');return;}
    if(!await getMyUser()) return;
    roomCode=code; isHost=false;
    document.getElementById('lobbyPanel').style.display='none';
    document.getElementById('waitCode').textContent=code;
    document.getElementById('waitPanel').style.display='flex';
    resizeCanvas(); connectRoom(roomCode);
    worldTimeout=setTimeout(()=>{ document.getElementById('waitMsg').textContent='Room not found. Check the code and try again.'; },12000);
  });

  document.getElementById('codeInput').addEventListener('keydown',e=>{ if(e.key==='Enter') document.getElementById('joinBtn').click(); });

  resizeCanvas();
})();
