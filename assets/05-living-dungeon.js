
const LIVING_DUNGEON_FLOOR_TYPES=Object.freeze({
  poison:{label:'毒沼',mapColor:'#315d34',viewColor:'rgba(45,104,54,.48)',markColor:'#78d783'},
  blood:{label:'血溜まり',mapColor:'#5b1f26',viewColor:'rgba(112,35,45,.46)',markColor:'#ef7a80'},
  mana:{label:'魔力溜まり',mapColor:'#39306c',viewColor:'rgba(74,63,139,.48)',markColor:'#a99cff'},
  mud:{label:'ぬかるみ',mapColor:'#5d492d',viewColor:'rgba(104,78,42,.48)',markColor:'#d4b074'},
  crumble:{label:'崩れかけた床',mapColor:'#696548',viewColor:'rgba(130,123,76,.42)',markColor:'#d8cf85'}
});
const LIVING_DUNGEON_FLOOR_KEYS=Object.keys(LIVING_DUNGEON_FLOOR_TYPES);
const LIVING_DUNGEON_ENEMY_SPAWN_CUES=[
  '👂 どこからか魔物の声が聞こえた……。',
  '👂 迷宮の奥で、何かが低く唸った……。',
  '👂 遠くで石を擦るような音がした……。',
  '👂 一瞬だけ、獣じみた叫びが反響した……。'
];
const LIVING_DUNGEON_CORPSE_EMPTY_TEXT=[
  '🕯️ 装備はすでに持ち去られている。残っているのは、乾いた血痕だけだ。',
  '🕯️ ギルドの古い留め具が残っている。だが、身元を確かめられるものはない。',
  '🕯️ 壁際まで這った跡がある。ここで力尽きたらしい。',
  '🕯️ 荷物は空だった。誰かが先に調べたのかもしれない。'
];
function livingFloorKey(d){return String(Math.max(1,Number(d?.currentDepth)||1));}
function livingEnabledDungeon(d){return !!d&&!d.isTutorial&&!d.isTreasureRoom&&!d.mugenSecretArena&&!d.questInstance&&d.dungeonKind!=='fixed'&&(d.dungeonKind==='normal'||d.dungeonKind==='mugen');}
function livingSeedRng(d,suffix='base'){
  const seed=`LIVING_DUNGEON::${d?.objectGenerationId||d?.specialSeed||d?.name||'dungeon'}::${livingFloorKey(d)}::${suffix}`;
  return createRNG(stringToSeed(seed));
}
function livingShuffle(list,rng){const out=[...list];for(let i=out.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
function livingCellKey(x,y){return `${x},${y}`;}
function livingGetFloorState(d){
  if(!livingEnabledDungeon(d))return null;
  d.livingFloors||={};
  const key=livingFloorKey(d);
  if(!d.livingFloors[key])d.livingFloors[key]=livingGenerateFloorState(d);
  const state=d.livingFloors[key];
  d.livingEnvironment=state.environment;
  d.livingNpcs=state.npcs;
  d.livingCorpses=state.corpses;
  d.livingArcaneCircles=state.circles;
  return state;
}
function livingOverlayOccupied(state,x,y){
  if(!state)return false;
  return (state.npcs||[]).some(n=>!n.gone&&!n.following&&n.x===x&&n.y===y)
    ||(state.corpses||[]).some(c=>!c.resolved&&c.x===x&&c.y===y)
    ||(state.circles||[]).some(c=>!c.resolved&&c.x===x&&c.y===y);
}
function livingRoomCellsAt(d,startX,startY){
  if(!d?.roomMask?.[startY]?.[startX])return[];
  const out=[],seen=new Set(),queue=[[startX,startY]],dirs=[[1,0],[-1,0],[0,1],[0,-1]];
  while(queue.length){
    const[x,y]=queue.shift(),key=livingCellKey(x,y);if(seen.has(key))continue;seen.add(key);
    if(!d.roomMask?.[y]?.[x])continue;
    out.push({x,y});
    for(const[dx,dy]of dirs){const nx=x+dx,ny=y+dy;if(d.roomMask?.[ny]?.[nx]&&!seen.has(livingCellKey(nx,ny)))queue.push([nx,ny]);}
  }
  return out;
}
function livingPlaceEnvironmentPatch(state,d,seed,type,rng){
  if(!state||!seed)return 0;
  const canPaint=(x,y)=>x>0&&y>0&&x<d.width-1&&y<d.height-1&&d.map?.[y]?.[x]===0&&!state.environment?.[y]?.[x]&&!livingOverlayOccupied(state,x,y);
  let cells=[];
  if(type==='mana'){
    cells=canPaint(seed.x,seed.y)?[seed]:[];
  }else if(d.roomMask?.[seed.y]?.[seed.x]){
    cells=livingRoomCellsAt(d,seed.x,seed.y).filter(p=>canPaint(p.x,p.y));
  }else{
    const target=2+Math.floor(rng()*3);  
    const chosen=[],seen=new Set(),frontier=[seed],dirs=[[1,0],[-1,0],[0,1],[0,-1]];
    while(frontier.length&&chosen.length<target){
      const index=Math.floor(rng()*frontier.length),p=frontier.splice(index,1)[0],key=livingCellKey(p.x,p.y);
      if(seen.has(key)){continue;}seen.add(key);
      if(!canPaint(p.x,p.y)||d.roomMask?.[p.y]?.[p.x])continue;
      chosen.push(p);
      const shuffled=livingShuffle(dirs,rng);
      for(const[dx,dy]of shuffled){const nx=p.x+dx,ny=p.y+dy;if(!seen.has(livingCellKey(nx,ny))&&canPaint(nx,ny)&&!d.roomMask?.[ny]?.[nx])frontier.push({x:nx,y:ny});}
    }
    cells=chosen;
  }
  for(const p of cells)state.environment[p.y][p.x]={type};
  return cells.length;
}
function livingGenerateFloorState(d){

  let baseResult15;
baseStep15: {

  const rng=livingSeedRng(d,'layout');
  const state={environment:Array.from({length:d.height},()=>Array(d.width).fill(null)),npcs:[],corpses:[],circles:[],createdAt:Date.now()};
  const startX=Number.isFinite(d.floorStartX)?d.floorStartX:d.x,startY=Number.isFinite(d.floorStartY)?d.floorStartY:d.y;
  const farX=Number.isFinite(d.floorFarX)?d.floorFarX:-99,farY=Number.isFinite(d.floorFarY)?d.floorFarY:-99;
  const enemyPoints=new Set((d.initialEnemyPoints||[]).map(p=>livingCellKey(p.x,p.y)));
  let candidates=[];
  for(let y=1;y<d.height-1;y++)for(let x=1;x<d.width-1;x++){
    if(d.map?.[y]?.[x]!==0)continue;
    if(Math.abs(x-startX)+Math.abs(y-startY)<3)continue;
    if(Math.abs(x-farX)+Math.abs(y-farY)<2)continue;
    if(enemyPoints.has(livingCellKey(x,y)))continue;
    candidates.push({x,y});
  }
  candidates=livingShuffle(candidates,rng);
  let cursor=0;
  const take=(minPlayerDist=0)=>{
    while(cursor<candidates.length){const p=candidates[cursor++];if(Math.abs(p.x-d.x)+Math.abs(p.y-d.y)>=minPlayerDist&&!state.environment?.[p.y]?.[p.x]&&!livingOverlayOccupied(state,p.x,p.y))return p;}return null;
  };
  const area=Math.max(1,d.width*d.height);
  const envCount=Math.max(2,Math.min(6,Math.round(Math.sqrt(area)/3.4)));
  const floorWeights=getModifierFloorEffectWeights(d);
  const pickFloorType=()=>{
    const weighted=LIVING_DUNGEON_FLOOR_KEYS.map(key=>[key,Math.max(0.05,Number(floorWeights[key])||1)]);
    const total=weighted.reduce((sum,[,weight])=>sum+weight,0);
    let roll=rng()*total;
    for(const[key,weight]of weighted){roll-=weight;if(roll<=0)return key;}
    return weighted[weighted.length-1]?.[0]||LIVING_DUNGEON_FLOOR_KEYS[0];
  };
  for(let i=0;i<envCount;i++){
    const p=take(2);if(!p)break;
    const type=pickFloorType();
    livingPlaceEnvironmentPatch(state,d,p,type,rng);
  }
  const npcRoll=rng();
  const npcCount=npcRoll<0.18?2:npcRoll<0.72?1:0;
  const usedNames=new Set();
  for(let i=0;i<npcCount;i++){
    const p=take(4);if(!p)break;
    const roll=rng();const kind=roll<0.30?'guild':roll<0.78?'adventurer':'thug';
    const pool=RANDOM_NAMES.filter(n=>!usedNames.has(n));const baseName=pool.length?pool[Math.floor(rng()*pool.length)]:`旅人${i+1}`;usedNames.add(baseName);
    const service=kind==='adventurer'?(['trade','chest','word','follow'][Math.floor(rng()*4)]):kind;
    state.npcs.push({id:`human_${livingFloorKey(d)}_${i}_${baseName}`,x:p.x,y:p.y,kind,name:kind==='guild'?`巡回員・${baseName}`:baseName,service,interacted:false,gone:false,following:false,steps:0});
  }
  const corpseCount=rng()<0.52?(rng()<0.18?2:1):0;
  for(let i=0;i<corpseCount;i++){
    const p=take(3);if(!p)break;
    const roll=rng();const outcome=roll<0.42?'card':roll<0.68?'undead':'empty';
    state.corpses.push({id:`corpse_${livingFloorKey(d)}_${i}`,x:p.x,y:p.y,outcome,resolved:false});
  }
  if(rng()<0.34){
    const p=take(4);if(p)state.circles.push({id:`circle_${livingFloorKey(d)}_0`,x:p.x,y:p.y,outcome:rng()<0.50?'chest':'enemy',resolved:false});
  }
  { baseResult15=(state); break baseStep15; }

}
const state=baseResult15;

  for(const npc of state?.npcs||[]){if(npc?.kind==='adventurer'&&npc.service==='follow')livingStableFollowerType(npc);}
  return state;

}
function livingEnvironmentAt(d,x,y){const state=getLivingFloorReadState(d);return state?.environment?.[y]?.[x]||null;
}
function livingNpcAt(d,x,y){getLivingFloorReadState(d);return(d?.livingNpcs||[]).find(n=>!n.gone&&!n.following&&n.x===x&&n.y===y)||null;
}
function livingCorpseAt(d,x,y){getLivingFloorReadState(d);return(d?.livingCorpses||[]).find(c=>!c.resolved&&c.x===x&&c.y===y)||null;
}
function livingCircleAt(d,x,y){getLivingFloorReadState(d);return(d?.livingArcaneCircles||[]).find(c=>!c.resolved&&c.x===x&&c.y===y)||null;
}

function livingUpdateLegend(){
  if(!isDungeonMapVisible())return;
  const legend=document.querySelector('.map-legend'),d=gameState?.dungeon;if(!legend)return;
  if(!d?.map||!d?.explored){return;}
  const state=getLivingFloorReadState(d);
  const environment=state?.environment;
  const corpseCells=new Set((d.livingCorpses||[]).filter(c=>!c.resolved&&Number.isInteger(c.x)&&Number.isInteger(c.y)).map(c=>c.x+','+c.y));
  const circleCells=new Set((d.livingArcaneCircles||[]).filter(c=>!c.resolved&&Number.isInteger(c.x)&&Number.isInteger(c.y)).map(c=>c.x+','+c.y));
  const found={down:false,up:false,spring:false,chest:false,trace:false,research:false,trap:false,enemy:false,friendly:false,corpse:false,circle:false,env:new Set()};
  for(let y=0;y<d.height;y++)for(let x=0;x<d.width;x++){
    if(!d.explored?.[y]?.[x])continue;
    const val=d.map?.[y]?.[x];
    if(val===2)found.down=true;else if(val===3)found.up=true;else if(val===12)found.spring=true;else if(val===4||val===13)found.chest=true;else if(val===6)found.trace=true;else if(val===14)found.research=true;else if(val===5&&d.trapsMap?.[y]?.[x]?.revealed)found.trap=true;
    const env=environment?.[y]?.[x];if(env?.type)found.env.add(env.type);
    if(corpseCells.has(x+','+y))found.corpse=true;
    if(circleCells.has(x+','+y))found.circle=true;
  }
  found.enemy=(d.enemySymbols||[]).some(e=>d.explored?.[e.y]?.[e.x]&&Math.max(Math.abs(e.x-d.x),Math.abs(e.y-d.y))<=2);
  found.friendly=(d.livingNpcs||[]).some(n=>!n.gone&&!n.following&&d.explored?.[n.y]?.[n.x]&&Math.max(Math.abs(n.x-d.x),Math.abs(n.y-d.y))<=2);
  const items=[];
  if(found.down)items.push('<span><i style="background:#0088ff"></i>下り階段</span>');
  if(found.up)items.push('<span><i style="background:#ff00ff"></i>上り階段・脱出ポータル</span>');
  if(found.spring)items.push('<span style="color:#62dcff">♨ 泉</span>');
  if(found.chest)items.push('<span><i style="background:#ffd700"></i>宝箱</span>');
  if(found.trace)items.push('<span><i style="background:#66ccff"></i>痕跡</span>');
  if(found.research)items.push('<span><i style="background:#7fd8ff"></i>調査地点</span>');
  if(found.trap)items.push('<span><i style="background:#ff4500"></i>発見した罠</span>');
  if(found.enemy)items.push('<span style="color:#ff5252">● ENEMY</span>');
  if(found.friendly)items.push('<span style="color:#68baff">● FRIENDLY?</span>');
  if(found.corpse)items.push('<span style="color:#aaa">† 屍</span>');
  if(found.circle)items.push('<span style="color:#c7a2ff">◌ 浮遊魔方陣</span>');
  for(const key of LIVING_DUNGEON_FLOOR_KEYS){if(found.env.has(key)){const cfg=LIVING_DUNGEON_FLOOR_TYPES[key];items.push(`<span style="color:${cfg.markColor}">■ ${cfg.label}</span>`);}}
  const legendHtml=items.length?items.join(''):'<span style="color:#888">探索で判明した情報がここに追加される。</span>';
  if(legend.innerHTML!==legendHtml)legend.innerHTML=legendHtml;

}
function livingDrawFloorTint(ctx,d,w,offsetY,viewH,depth,side){
  if(!livingEnabledDungeon(d))return;
  const dx=[0,1,0,-1][d.dir],dy=[-1,0,1,0][d.dir],rx=-dy,ry=dx;
  const tx=d.x+dx*depth+rx*side,ty=d.y+dy*depth+ry*side;
  const env=livingEnvironmentAt(d,tx,ty);if(!env)return;
  const cfg=LIVING_DUNGEON_FLOOR_TYPES[env.type];if(!cfg)return;
  const near=1/depth,far=1/(depth+1);
  const x1=w/2+(side-.5)*w*near,x2=w/2+(side+.5)*w*near,y2=offsetY+viewH/2+(viewH/2)*near;
  const bx1=w/2+(side-.5)*w*far,bx2=w/2+(side+.5)*w*far,by2=offsetY+viewH/2+(viewH/2)*far;
  ctx.save();ctx.fillStyle=cfg.viewColor;ctx.beginPath();ctx.moveTo(x1,y2);ctx.lineTo(x2,y2);ctx.lineTo(bx2,by2);ctx.lineTo(bx1,by2);ctx.closePath();ctx.fill();ctx.restore();
}
function livingDrawCorpse(ctx,cx,floorY,scale){
  const s=Math.max(.25,scale);ctx.save();ctx.translate(cx,floorY-3*s);ctx.rotate(-.10);
  ctx.strokeStyle='#a9a59b';ctx.fillStyle='rgba(76,72,67,.94)';ctx.lineWidth=Math.max(1,1.7*s);
  ctx.beginPath();ctx.ellipse(-4*s,-5*s,8*s,5*s,0,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.beginPath();ctx.moveTo(3*s,-5*s);ctx.lineTo(25*s,-11*s);ctx.lineTo(31*s,-5*s);ctx.lineTo(15*s,0);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.beginPath();ctx.moveTo(13*s,-2*s);ctx.lineTo(28*s,8*s);ctx.moveTo(10*s,-1*s);ctx.lineTo(-2*s,10*s);ctx.stroke();
  if(scale>.45){ctx.fillStyle='#c9c2af';ctx.font=`bold ${Math.max(7,9*s)}px monospace`;ctx.textAlign='center';ctx.fillText('…',8*s,-17*s);}ctx.restore();
}
function livingDrawArcaneCircle(ctx,cx,floorY,scale){
  const s=Math.max(.28,scale),cy=floorY-17*s;ctx.save();ctx.translate(cx,cy);ctx.strokeStyle='#b68cff';ctx.shadowColor='#8e68ff';ctx.shadowBlur=Math.max(4,10*s);ctx.lineWidth=Math.max(1,1.5*s);
  for(const r of[12,19]){ctx.beginPath();ctx.ellipse(0,0,r*s,r*.42*s,0,0,Math.PI*2);ctx.stroke();}
  ctx.rotate(Math.PI/4);ctx.beginPath();for(let i=0;i<4;i++){const a=i*Math.PI/2;const x=Math.cos(a)*13*s,y=Math.sin(a)*5*s;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.closePath();ctx.stroke();ctx.restore();
}
function livingGetVisibleNpcs(d){
  if(!livingEnabledDungeon(d))return[];livingGetFloorState(d);
  const dirs=[[0,-1],[1,0],[0,1],[-1,0]],[fx,fy]=dirs[d.dir],[rx,ry]=dirs[(d.dir+1)%4];
  const clearSight=dist=>{for(let s=1;s<dist;s++){const t=d.map?.[d.y+fy*s]?.[d.x+fx*s];if(!(t===0||t===2||t===3||t===12||t===14))return false;}return true;};
  return(d.livingNpcs||[]).filter(n=>!n.gone&&!n.following).map(n=>{const dx=n.x-d.x,dy=n.y-d.y;return{n,forward:dx*fx+dy*fy,side:dx*rx+dy*ry};}).filter(v=>v.forward>=1&&v.forward<=5&&v.side===0&&clearSight(v.forward)).sort((a,b)=>b.forward-a.forward);
}
function livingDrawNpcFigure(ctx,cx,floorY,dist){
  const scaleTable={1:1,2:.64,3:.43,4:.30,5:.22},s=scaleTable[dist]||.2,bodyH=72*s,bodyW=30*s,headR=8*s,baseY=floorY-(dist-1)*5,headY=baseY-bodyH+headR*1.4;
  ctx.save();const glow=ctx.createRadialGradient(cx,headY+bodyH*.42,2,cx,headY+bodyH*.42,Math.max(14,bodyW*1.4));glow.addColorStop(0,'rgba(40,130,220,.35)');glow.addColorStop(1,'rgba(40,130,220,0)');ctx.fillStyle=glow;ctx.beginPath();ctx.arc(cx,headY+bodyH*.42,Math.max(14,bodyW*1.4),0,Math.PI*2);ctx.fill();
  ctx.fillStyle='rgba(9,24,37,.96)';ctx.strokeStyle=dist<=2?'#68baff':'#3f83bd';ctx.lineWidth=Math.max(1,2*s);ctx.beginPath();ctx.arc(cx,headY,headR,0,Math.PI*2);ctx.fill();ctx.stroke();
  const shoulder=headY+headR*1.25,hip=baseY-bodyH*.27;ctx.beginPath();ctx.moveTo(cx-bodyW*.16,shoulder);ctx.lineTo(cx-bodyW*.44,shoulder+bodyH*.20);ctx.lineTo(cx-bodyW*.27,hip);ctx.lineTo(cx-bodyW*.32,baseY);ctx.lineTo(cx-bodyW*.07,baseY);ctx.lineTo(cx,hip+bodyH*.06);ctx.lineTo(cx+bodyW*.07,baseY);ctx.lineTo(cx+bodyW*.32,baseY);ctx.lineTo(cx+bodyW*.27,hip);ctx.lineTo(cx+bodyW*.44,shoulder+bodyH*.20);ctx.lineTo(cx+bodyW*.16,shoulder);ctx.closePath();ctx.fill();ctx.stroke();
  if(dist<=2){ctx.shadowBlur=0;ctx.fillStyle='#8ed0ff';ctx.font=dist===1?'bold 10px monospace':'bold 9px monospace';ctx.textAlign='center';ctx.textBaseline='bottom';ctx.fillText('FRIENDLY?',cx,baseY+15);}ctx.restore();
}
function livingDrawNpcs(){
  const d=gameState?.dungeon,canvas=document.getElementById('wireframe');if(gameState?.inBattle||!livingEnabledDungeon(d)||!canvas)return;
  const ctx=canvas.getContext('2d'),cx=canvas.width/2,floorY=canvas.height*.82;livingGetVisibleNpcs(d).forEach(v=>livingDrawNpcFigure(ctx,cx,floorY,v.forward));
}

function livingDecorateFullMinimap(){
  const d=gameState?.dungeon,grid=document.getElementById('map-grid');if(!livingEnabledDungeon(d)||!grid)return;getLivingFloorReadState(d);
  const children=grid.children;for(const npc of d.livingNpcs||[]){if(npc.gone||npc.following||!d.explored?.[npc.y]?.[npc.x]||Math.max(Math.abs(npc.x-d.x),Math.abs(npc.y-d.y))>2)continue;const el=children[npc.y*d.width+npc.x];if(!el)continue;const dot=document.createElement('span');dot.style.cssText='position:absolute;left:0;top:0;width:6px;height:6px;border-radius:50%;background:#58b8ff;box-shadow:0 0 4px #58b8ff;';el.append(dot);}

}
function livingApplyCurrentFloorEffect(d){

  const state=livingGetFloorState(d);if(!state)return;
  const env=state.environment?.[d.y]?.[d.x];if(!env)return;
  let terrainEffectApplied=false;
  if(env.type==='poison'){
    terrainEffectApplied=true;
    let affected=0,totalDamage=0,totalInjury=0;
    for(const c of gameState.party||[]){
      if(!c||c.hp<=0)continue;
      affected++;
      const beforeHp=c.hp;
      const beforeInjury=Math.max(0,Number(c.injury)||0);
      const wasHealthy=c.hp>=Math.ceil(c.maxHp*PERMADEATH_SAFETY.healthyStartRatio);
      c.hp=Math.max(wasHealthy?1:0,c.hp-1);
      const actualDamage=Math.max(0,beforeHp-c.hp);
      if(actualDamage>0){
        c.injury=Math.min(Math.max(0,(c.maxHp||1)-1),beforeInjury+actualDamage);
        c.injuryFraction=0;
        c.hp=Math.min(c.hp,getHealthyHpLimit(c));
        rememberFatalDamage(c,'毒沼',actualDamage);
        totalDamage+=actualDamage;
        totalInjury+=Math.max(0,(Number(c.injury)||0)-beforeInjury);
      }
    }
    log(`☠️ 毒沼を踏んだ。隊は1ダメージと同量の負傷を受けた。（${affected}人／HP -${totalDamage}・負傷 +${totalInjury}）`);
    updatePartyUI();
    checkPartyDeaths();
  }else if(env.type==='blood'){
    terrainEffectApplied=true;
    const spawned=addEnemySymbol(d,{behavior:'hunter',spawnReason:'blood_pool',minDistance:2});
    log(spawned?'🩸 血溜まりの臭いに反応し、どこかで魔物が動き出した……。':'🩸 血の臭いが鼻を刺す。周囲の魔物がざわついている……。');
  }else if(env.type==='mana'){
    terrainEffectApplied=true;
    let restored=0;
    forEachOwnedCard(card=>{if(!card||!(card.suit==='🔮'||card.suit==='🌟'))return;const max=getCardUseLimit(card);if(!Number.isFinite(max))return;const before=getCardUses(card);card.usesRemaining=Math.min(max,before+1);restored+=Math.max(0,card.usesRemaining-before);},false);
    log(restored>0?`🔮 魔力溜まりが札に染み込んだ。魔法系の使用回数が ${restored} 回復した。`:'🔮 魔力溜まりの光が身体を抜け、静かに消えた。');
    state.environment[d.y][d.x]=null;
    refreshMapIfOpen();updateDungeonView();
  }else if(env.type==='mud'){
    terrainEffectApplied=true;
    d.livingSkipEnemyMove=Math.max(1,Number(d.livingSkipEnemyMove)||0);
    log('🟫 深いぬかるみに足を取られた。周囲の足音も鈍っている……。');
  }else if(env.type==='crumble'){
    terrainEffectApplied=true;
    if(Math.random()<.38){
      livingTerrainDamage(d,{base:4,maxRatio:.22,cause:'崩れかけた床',lead:'⚠️ 足元の石床が崩れた！ 破片が隊へ降り注ぐ！'});
    }else log('⚠️ 崩れかけた床に再び亀裂が走った。慎重に足を運んだ方がよさそうだ。');
  }
  if(terrainEffectApplied&&!ensureFeatureTipsSeen().terrainEffects){
    gameState.terrainEffectTipPending=true;
    scheduleExplorationTips(120);
  }
  livingUpdateLegend();saveGame();

}
function livingCanNpcMoveTo(d,npc,x,y){
  if(x<0||y<0||x>=d.width||y>=d.height)return false;const tile=d.map?.[y]?.[x];if(!(tile===0||tile===2||tile===3||tile===12||tile===14))return false;
  if((d.livingNpcs||[]).some(n=>n!==npc&&!n.gone&&!n.following&&n.x===x&&n.y===y))return false;
  if(livingCircleAt(d,x,y))return false;return true;
}
function livingMoveNpcs(d){
  if(!livingEnabledDungeon(d)||gameState.inBattle)return;livingGetFloorState(d);const dirs=[[0,-1],[1,0],[0,1],[-1,0]];
  for(const npc of d.livingNpcs||[]){if(npc.gone||npc.following)continue;if(npc.x===d.x&&npc.y===d.y)continue;if(Math.random()<.22)continue;const choices=dirs.map(([dx,dy])=>({x:npc.x+dx,y:npc.y+dy})).filter(p=>livingCanNpcMoveTo(d,npc,p.x,p.y));if(!choices.length)continue;const p=choices[Math.floor(Math.random()*choices.length)];npc.x=p.x;npc.y=p.y;npc.steps=(npc.steps||0)+1;}
}
function livingResolveNpcEnemyCollisions(d){
  if(!livingEnabledDungeon(d)||!Array.isArray(d.enemySymbols))return 0;let defeated=0;
  for(const npc of d.livingNpcs||[]){if(npc.gone||npc.following)continue;for(let i=d.enemySymbols.length-1;i>=0;i--){const e=d.enemySymbols[i];if(e.x!==npc.x||e.y!==npc.y)continue;d.enemySymbols.splice(i,1);defeated++;const dist=Math.abs(npc.x-d.x)+Math.abs(npc.y-d.y);if(dist<=5)log(`⚔️ 【${escapeHtml(npc.name)}】が魔物を撃退した。`);else if(Math.random()<.35)log('⚔️ 遠くで短い剣戟の音が響いた……。');}}
  return defeated;
}
function livingSpawnChestFromTip(d,npc){
  const state=livingGetFloorState(d),rng=Math.random;const candidates=[];for(let y=1;y<d.height-1;y++)for(let x=1;x<d.width-1;x++){
    if(d.map?.[y]?.[x]!==0||state.environment?.[y]?.[x]||livingOverlayOccupied(state,x,y)||(x===d.x&&y===d.y))continue;if(Math.abs(x-d.x)+Math.abs(y-d.y)<3)continue;candidates.push({x,y});
  }
  if(!candidates.length)return false;const p=candidates[Math.floor(rng()*candidates.length)];d.map[p.y][p.x]=4;d.chestInfoMap||=Array.from({length:d.height},()=>Array(d.width).fill(null));d.chestInfoMap[p.y][p.x]=makeNormalChestInfoBySeed(d.objectGenerationId||d.specialSeed||d.name,p.x,p.y,'npc_tip');d.explored[p.y][p.x]=true;d.objectCounts||={};d.objectCounts.chest=(Number(d.objectCounts.chest)||0)+1;log(`🗺️ 【${escapeHtml(npc.name)}】「宝箱を見かけた。座標は (${p.x},${p.y}) だったはずだ」`);refreshMapIfOpen();return true;
}
function livingGiveWordInfo(d,npc){
  if(d.dungeonKind==='mugen'){
    const gain=addMugenWordResearchPoints(d,3,`${npc.name}の情報`);if(gain)log(`🗣️ 【${escapeHtml(npc.name)}】から迷宮の言葉について聞いた。調査記録が具体的になった。`);return gain>0;
  }
  if(d.dungeonKind!=='normal')return false;ensureNormalExplorationSystems();const progress=ensureExplorationProgress();const ids=(d.wordIds||[]).filter(Boolean);if(ids.length){const id=ids[Math.floor(Math.random()*ids.length)];gameState.wordKnowledge[id]=Math.min(999,(Number(gameState.wordKnowledge[id])||0)+1);}
  progress.researchRate=Math.min(100,Math.round((progress.researchRate+15)*10)/10);if(progress.researchRate>=100&&!progress.researchReadyAreaLevel){progress.researchReadyAreaLevel=Math.max(1,Math.round(Number(d.areaLevel)||1));}
  log(`🔎 【${escapeHtml(npc.name)}】からワードの情報を聞いた。記録の発見進捗が ${progress.researchRate}% になった。`);return true;
}
function livingFindTradeItem(){
  const allowed=new Set(['c_potion','c_mana_elixir','c_hi_potion']);for(const char of gameState.party||[]){const deck=getCharacterDeck(char);for(let i=0;i<deck.length;i++){const card=deck[i];if(card&&allowed.has(card.masterId))return{char,deck,index:i,card};}}return null;
}
function livingCreateTradeOffer(d){const pool=getCardMastersForChannel('dungeonTreasure').filter(c=>c&&c.category!=='consumable'&&c.category!=='reward');const master=pool[Math.floor(Math.random()*pool.length)];if(!master)return null;const rarity=rollDropRarity((Number(getDungeonDropLootTier(d))||0)+.35);return createCardInstance(master.masterId,{rarity});}
async function livingTradeWithAdventurer(d,npc){
  const request=livingFindTradeItem(),offer=livingCreateTradeOffer(d);if(!request||!offer){await showGameNotice(`【${npc.name}】「交換できそうな物は今はなさそうだな。またどこかで会ったら頼む」`,{title:'迷宮の探索者'});return;}
  const ok=await showGameConfirm(`【${npc.name}】「その［${request.card.name}］と、俺の［${offer.name}］を交換しないか？」\n\nこちら：［${request.card.name}］\n相手：${cardEffectiveRarity(offer)}［${offer.name}］`,{title:'探索者とのトレード',confirmText:'交換する',cancelText:'断る'});if(!ok)return;
  if(request.deck[request.index]!==request.card)return;request.deck.splice(request.index,1);const routed=addDungeonCardToPlayerOrStorage(offer);log(`🤝 【${escapeHtml(npc.name)}】と交換した。［${escapeHtml(offer.name)}］を受け取った。${routed.location==='deck'?` 【${escapeHtml(routed.ownerName)}】が所持した。`:''}`);saveGame();
}
async function livingStartTemporaryFollower(d,npc){

  if(d.livingFollower){await showGameNotice(`【${npc.name}】「もう同行者がいるみたいだ。今回はやめておこう」`,{title:`探索者・${npc.name}`});return false;}
  const type=livingStableFollowerType(npc),reward=type==='escort'?livingCreateEscortReward(d,npc):null;
  const accepted=await showGameConfirm(livingFollowerIntro(npc,type,livingEscortRewardText(reward)),{
    title:`探索者・${npc.name}`,
    confirmText:type==='escort'?'護衛を引き受ける':'同行する',
    cancelText:'断る'
  });
  if(!accepted)return false;
  d.livingFollower={
    id:npc.id,name:npc.name,type,joinedDepth:d.currentDepth,
    reward:reward||null,rewardClaimed:false,lastSupportTurn:0
  };
  npc.following=true;npc.interacted=true;
  if(type==='assist')log(`🧭 【${escapeHtml(npc.name)}】が次の階まで同行し、戦闘では後方から援護してくれる。`);
  else if(type==='mutual')log(`🧭 【${escapeHtml(npc.name)}】と次の階まで短期の共同戦線を組んだ。`);
  else log(`🧭 【${escapeHtml(npc.name)}】の脱出護衛を引き受けた。町まで送り届ければ報酬を受け取れる。`);
  updateStairActionButton();saveGame();return true;

}
function livingEndFollowerIfNeeded(d){

  const f=d?.livingFollower;if(!f)return;
  if(f.type==='escort')return;
  if(Number(d.currentDepth)===Number(f.joinedDepth))return;
  const name=f.name;
  const npc=(d.livingNpcs||[]).find(n=>n.id===f.id);if(npc){npc.following=false;npc.gone=true;}
  d.livingFollower=null;
  log(f.type==='assist'?`🧭 【${escapeHtml(name)}】「この先は別方向だ。ここまでだな。気をつけて」`:`🧭 【${escapeHtml(name)}】「契約はここまでだ。また縁があれば組もう」`);

}
function livingHealPartyByPatrol(npc){
  let healed=0,treated=0;(gameState.party||[]).forEach(c=>{if(!c||c.hp<=0)return;const before=c.hp;healNormalHp(c,Math.ceil(c.maxHp*.28));healed+=Math.max(0,c.hp-before);if((c.injury||0)>0)treated+=treatInjury(c,Math.ceil(c.maxHp*.10));});updatePartyUI();log(`🩹 【${escapeHtml(npc.name)}】が応急処置をしてくれた。（HP +${healed} / 負傷治療 ${treated}）`);saveGame();
}
async function livingInteractGuild(npc){
  const injured=!npc.interacted&&(gameState.party||[]).some(c=>c&&c.hp>0&&(c.hp<getHealthyHpLimit(c)||(c.injury||0)>0));
  if(injured){const heal=await showGameConfirm(`【${npc.name}】「ギルドの巡回だ。傷を見せてみろ。応急処置ならできる」`,{title:'ギルド巡回員',confirmText:'手当てを受ける',cancelText:'帰還の相談'});if(heal){livingHealPartyByPatrol(npc);npc.interacted=true;return;}}
  const back=await showGameConfirm(`【${npc.name}】「ここからなら帰還路まで案内できる。探索を切り上げるなら護衛するぞ」`,{title:'ギルド巡回員',confirmText:'町へ帰還する',cancelText:'探索を続ける'});if(back){clearLog();log(`🏛️ 【${escapeHtml(npc.name)}】の案内で安全な帰還路へ向かった。`);escapeDungeon();}
}
async function livingInteractThug(d,npc){

  if(!d||!npc||npc.gone)return;
  const toll=Math.max(50,Math.min(500,Math.round((Number(d.areaLevel)||1)*35/10)*10));
  const gold=Math.max(0,Number(gameState.player?.gold)||0);
  if(gold>=toll){
    const pay=await showGameConfirm(
      `【${npc.name}】「この先を通るなら ${toll}G 置いていけ」\n\n金を渡さないなら、力ずくで通るしかない。`,
      {title:'人影',confirmText:`${toll}G払う`,cancelText:'戦う'}
    );
    if(pay){
      gameState.player.gold-=toll;
      npc.gone=true;
      clearLog();
      log(`💰 ${toll}G を渡すと、男たちは満足そうに道を空け、そのまま姿を消した。`);
      updateDungeonView();updateStairActionButton();refreshMapIfOpen();saveGame();
      return;
    }
    livingStartThugStrongBattle(d,npc);
    return;
  }
  await showGameNotice(
    `【${npc.name}】「金がない？　なら話は早いな」\n\n要求額は ${toll}G。手持ちでは払えない。`,
    {title:'人影'}
  );
  livingStartThugStrongBattle(d,npc);

}
async function livingInteractAdventurer(d,npc){

  if(npc.interacted&&!npc.following){await showGameNotice(`【${npc.name}】「俺はもう少しこの辺りを見てから戻るよ」`,{title:`探索者・${npc.name}`});return;}
  if(npc.service==='follow')await livingStartTemporaryFollower(d,npc);
  else if(await livingExplorerInfoConversation(d,npc))npc.interacted=true;
  updateDungeonView();updateStairActionButton();saveGame();

}
async function livingInteractNpc(npc){const d=gameState?.dungeon;if(!d||!npc)return;if(npc.kind==='guild')return livingInteractGuild(npc);if(npc.kind==='thug')return livingInteractThug(d,npc);return livingInteractAdventurer(d,npc);}
async function livingSearchCorpse(corpse){

  const d=gameState?.dungeon;
  if(!d||!corpse||corpse.resolved)return;
  const priest=livingFindActivePriest();
  if(priest)livingPurifyCorpse(priest,corpse);
  corpse.resolved=true;
  updateStairActionButton();

  if(corpse.outcome==='card'){
    const pool=getCardMastersForChannel('dungeonTreasure').filter(Boolean);
    const master=pool[Math.floor(Math.random()*pool.length)];
    if(!priest)clearLog();
    log(priest?'🕯️ 浄化を終えて荷物を確かめると、まだ使えそうな札が残っていた。':'🕯️ 屍の荷物を調べると、まだ使えそうな札が残っていた。');
    if(master)gainCardInDungeon(master.masterId);
    updateDungeonView();refreshMapIfOpen();saveGame();
    return;
  }

  if(corpse.outcome==='undead'){
    if(priest){
      log(`✝️ 【${escapeHtml(priest.name)}】「……これで大丈夫。もう起き上がることはないよ」`);
      log('🕯️ 屍を調べたが、持ち帰れそうな物は残っていなかった。');
      updateDungeonView();refreshMapIfOpen();saveGame();
      return;
    }
    clearLog();
    log('🕯️ 屍に手を伸ばした、その瞬間――指が動いた。');
    log('⚠️ 不意を突かれた！　隊は体勢を整えられない！');
    const old=[...(d.topCategories||[])];
    d.topCategories=['undead',...old.filter(c=>c!=='undead')];
    startBattleWithWord();
    d.topCategories=old;
    if(battleState.enemies?.[0])battleState.enemies[0].name='起き上がった屍';
    // 外部同行者も奇襲の最初の一手には間に合わない。
    if(d.livingFollower)d.livingFollower.lastSupportTurn=Math.max(1,Number(gameState.turn)||1);
    saveGame();
    await executeTurnWithSpeedOrder({
      skipAllAllies:true,
      turnReason:'💀 屍からの不意打ち！ 味方は行動できず、敵だけが襲いかかる！'
    });
    return;
  }

  if(!priest)clearLog();
  log(LIVING_DUNGEON_CORPSE_EMPTY_TEXT[Math.floor(Math.random()*LIVING_DUNGEON_CORPSE_EMPTY_TEXT.length)]);
  updateDungeonView();refreshMapIfOpen();saveGame();

}
function livingTriggerArcaneCircles(d){
  if(!livingEnabledDungeon(d))return false;livingGetFloorState(d);let triggered=false;
  for(const circle of d.livingArcaneCircles||[]){if(circle.resolved)continue;if(Math.max(Math.abs(circle.x-d.x),Math.abs(circle.y-d.y))>1)continue;circle.resolved=true;triggered=true;
    if(circle.outcome==='chest'){
      d.map[circle.y][circle.x]=4;d.chestInfoMap||=Array.from({length:d.height},()=>Array(d.width).fill(null));d.chestInfoMap[circle.y][circle.x]=makeNormalChestInfoBySeed(d.objectGenerationId||d.specialSeed||d.name,circle.x,circle.y,'arcane_circle');d.explored[circle.y][circle.x]=true;d.objectCounts||={};d.objectCounts.chest=(Number(d.objectCounts.chest)||0)+1;log('🌀 宙に浮いていた魔方陣が回転を始めた――光が収束し、宝箱が現れた！');
    }else{
      d.enemySymbols||=[];if(!isSymbolOccupied(d,circle.x,circle.y)){d.enemySymbols.push({id:`circle_enemy_${Date.now()}_${Math.random().toString(36).slice(2)}`,x:circle.x,y:circle.y,behavior:'hunter',spawnReason:'arcane_circle'});}else addEnemySymbol(d,{behavior:'hunter',ignoreMax:true,spawnReason:'arcane_circle',minDistance:1});log('🌀 魔方陣が脈打った――光の中から魔物の影が現れた！');
    }
  }
  if(triggered){refreshMapIfOpen();updateDungeonView();saveGame();}return triggered;
}
function livingEnemyProximityCue(d){
  if(!livingEnabledDungeon(d)||gameState.inBattle)return;const enemies=d.enemySymbols||[];if(!enemies.length){d.livingEnemyCueBand=99;return;}const nearest=Math.min(...enemies.map(e=>Math.abs(e.x-d.x)+Math.abs(e.y-d.y)));const band=nearest<=1?1:nearest<=2?2:nearest<=4?3:99;const last=Number(d.livingEnemyCueBand)||99;if(band>=last){if(band===99)d.livingEnemyCueBand=99;return;}d.livingEnemyCueBand=band;if(band===1)log('👂 すぐ近くで、荒い息遣いが聞こえる……。');else if(band===2)log('👂 曲がり角の向こうで、爪が床を擦る音がした……。');else if(band===3&&Math.random()<.75)log('👂 近くで何かが動く気配がする……。');
}
function livingDrawNearbyNpcDots(ctx,d,w){
  if(!livingEnabledDungeon(d))return;const size=12,gap=1,pad=4,side=size*3+gap*2+pad*2,x0=w-side-5,y0=28;ctx.save();for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){const x=d.x+ox,y=d.y+oy;if(!d.explored?.[y]?.[x]||!livingNpcAt(d,x,y))continue;const left=x0+pad+(ox+1)*(size+gap),top=y0+pad+(oy+1)*(size+gap);ctx.fillStyle='#58b8ff';ctx.beginPath();ctx.arc(left+2.8,top+2.8,2.7,0,Math.PI*2);ctx.fill();}ctx.restore();
}



livingUpdateLegend();
if(gameState?.dungeon){livingGetFloorState(gameState.dungeon);updateDungeonView();updateStairActionButton();}

