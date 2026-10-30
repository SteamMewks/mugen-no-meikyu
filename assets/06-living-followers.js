

const LIVING_FOLLOW_PROFILES=Object.freeze({
  assist:{label:'助力',cadence:2,attackRatio:.045,healRatio:.10,guardRatio:.09},
  mutual:{label:'相互協力',cadence:3,attackRatio:.040,healRatio:.06,guardRatio:.06},
  escort:{label:'護衛依頼',cadence:3,attackRatio:.020,healRatio:.04,guardRatio:.05}
});

function livingStableFollowerType(npc){
  if(npc?.followType)return npc.followType;
  const seed=stringToSeed(`LIVING_FOLLOW_TYPE::${npc?.id||npc?.name||'traveler'}`);
  const rng=createRNG(seed),roll=rng();
  npc.followType=roll<.38?'assist':roll<.70?'mutual':'escort';
  return npc.followType;
}


function livingTerrainDamage(d,{base,maxRatio,cause,lead}){
  const baseDmg=Math.max(1,Math.floor(Math.max(1,base)*(Number(d?.danger)||1)));
  const legacyTerrainReduction=Math.min(75,getLegacyPower('terrainGuard'))/100;
  let totalDamage=0,affected=0;
  for(const c of gameState.party||[]){
    if(!c||c.hp<=0)continue;
    affected++;
    const beforeHp=c.hp;
    const capped=Math.max(1,Math.min(varyCalculatedAmount(baseDmg),Math.max(1,Math.floor(c.maxHp*maxRatio))));
    const wasHealthy=c.hp>=Math.ceil(c.maxHp*PERMADEATH_SAFETY.healthyStartRatio);
    const mitigated=Math.max(1,Math.floor(capped*(1-legacyTerrainReduction)));
    const finalDmg=capDamageForHeroLastStand(c,mitigated);
    c.hp=Math.max(wasHealthy?1:0,c.hp-finalDmg);
    const actualDmg=Math.max(0,beforeHp-c.hp);
    addInjury(c,actualDmg);
    rememberFatalDamage(c,cause,actualDmg);
    totalDamage+=actualDmg;
  }
  const average=affected?Math.round(totalDamage/affected*10)/10:0;
  log(`${lead} 隊は平均 ${average}ダメージを受けた。`);
  updatePartyUI();
  checkPartyDeaths();
  return average;
}


function livingFollowerIntro(npc,type,rewardText=''){
  if(type==='assist')return `【${npc.name}】「同じ方向みたいだな。ここは魔物が多い。次の階までなら、こっちから援護するよ」`;
  if(type==='mutual')return `【${npc.name}】「単独で進むには少し面倒な区画だ。次の階まで共同戦線といかないか？　互いに援護する、それだけの短期契約だ」`;
  return `【${npc.name}】「頼みがある。ここから町まで護衛してくれないか？　無事に戻れたら${rewardText||'礼はする'}」`;
}
function livingCreateEscortReward(d,npc){
  if(npc.escortReward)return npc.escortReward;
  const rng=createRNG(stringToSeed(`LIVING_ESCORT_REWARD::${d?.objectGenerationId||d?.name||''}::${npc.id}`));
  const area=Math.max(1,Number(d?.areaLevel)||1),roll=rng();
  if(roll<.62){
    const amount=Math.max(100,Math.round((90+area*30)*(0.9+rng()*.25)/10)*10);
    npc.escortReward={kind:'gold',amount};
  }else{
    const pool=getCardMastersForChannel('dungeonTreasure').filter(c=>c&&c.category!=='consumable'&&c.category!=='reward');
    const master=pool.length?pool[Math.floor(rng()*pool.length)]:null;
    if(master)npc.escortReward={kind:'card',masterId:master.masterId,rarity:area>=20?'SR':area>=8?'R':'N',name:master.name};
    else npc.escortReward={kind:'gold',amount:Math.max(100,Math.round((100+area*30)/10)*10)};
  }
  return npc.escortReward;
}
function livingEscortRewardText(reward){
  if(!reward)return'礼はする';
  if(reward.kind==='gold')return`${reward.amount}G払う`;
  return`${reward.rarity||'R'}［${reward.name||'カード'}］を渡す`;
}


async function livingExplorerInfoConversation(d,npc){
  if(npc.service==='chest'){
    const ok=await showGameConfirm(`【${npc.name}】「さっき妙な宝箱を見た。場所なら地図に書けるけど、知りたいか？」`,{title:`探索者・${npc.name}`,confirmText:'教えてもらう',cancelText:'別れる'});
    if(!ok)return false;
    if(!livingSpawnChestFromTip(d,npc))await showGameNotice(`【${npc.name}】「……悪い。目印が似すぎて場所を見失ったみたいだ」`,{title:`探索者・${npc.name}`});
    return true;
  }
  if(npc.service==='word'){
    const ok=await showGameConfirm(`【${npc.name}】「この迷宮の言葉について、気になる記録を拾った。そっちの調査にも使えるかもしれない」`,{title:`探索者・${npc.name}`,confirmText:'話を聞く',cancelText:'別れる'});
    if(!ok)return false;livingGiveWordInfo(d,npc);return true;
  }
  if(npc.service==='trade'){
    const ok=await showGameConfirm(`【${npc.name}】「ちょうど物資を整理してたところだ。使わない札があるなら交換しないか？」`,{title:`探索者・${npc.name}`,confirmText:'品を見る',cancelText:'別れる'});
    if(!ok)return false;await livingTradeWithAdventurer(d,npc);return true;
  }
  return false;
}


// 同行者は遭遇そのものを消さない。戦闘へ入り、そこで援護する。


function livingFollowerChooseSupport(follower){
  const party=(gameState.party||[]).filter(c=>c&&c.hp>0),enemies=(battleState.enemies||[]).filter(e=>e&&e.hp>0);
  if(!party.length||!enemies.length)return null;
  const weakest=[...party].sort((a,b)=>(a.hp/Math.max(1,a.maxHp))-(b.hp/Math.max(1,b.maxHp)))[0];
  const hpRatio=weakest.hp/Math.max(1,weakest.maxHp);
  if(follower.type==='assist'&&hpRatio<.62)return{kind:'heal',target:weakest};
  if(follower.type==='escort'&&hpRatio<.45)return{kind:'heal',target:weakest};
  if(hpRatio<.72&&Math.random()<.45)return{kind:'guard',target:weakest};
  if(follower.type==='escort'&&Math.random()<.50)return{kind:'guard',target:weakest};
  return{kind:'attack',target:enemies.sort((a,b)=>a.hp-b.hp)[0]};
}
function livingFollowerBattleSupport(d,completedTurn){
  const follower=d?.livingFollower;if(!follower||!gameState.inBattle)return false;
  const profile=LIVING_FOLLOW_PROFILES[follower.type]||LIVING_FOLLOW_PROFILES.mutual;
  if(completedTurn<1||completedTurn%profile.cadence!==0||Number(follower.lastSupportTurn)===completedTurn)return false;
  const action=livingFollowerChooseSupport(follower);if(!action)return false;follower.lastSupportTurn=completedTurn;
  if(action.kind==='heal'){
    const amount=healNormalHp(action.target,Math.max(1,Math.ceil(action.target.maxHp*profile.healRatio)));
    if(amount>0)log(`🤝 【${escapeHtml(follower.name)}】「まだ動けるな」 援護で【${escapeHtml(action.target.name)}】のHPが ${combatLogValue(amount,'heal')} 回復！`);
  }else if(action.kind==='guard'){
    const amount=addShieldWithCap(action.target,Math.max(1,Math.ceil(action.target.maxHp*profile.guardRatio)));
    if(amount>0)log(`🤝 【${escapeHtml(follower.name)}】が敵を牽制した！ 【${escapeHtml(action.target.name)}】にシールド ${amount}。`);
  }else{
    const target=action.target,before=target.hp;
    const dmg=capSummonaFinalSceneDamage(target,Math.max(1,Math.min(target.hp,Math.ceil(target.maxHp*profile.attackRatio))));
    target.hp=Math.max(0,target.hp-dmg);
    log(`🤝 【${escapeHtml(follower.name)}】の援護攻撃！ 【${escapeHtml(target.name)}】に ${combatLogValue(before-target.hp,'damage')} ダメージ。`);
  }
  updateBattleUI();
  if(gameState.inBattle)checkBattleEnd();
  saveGame();return true;
}


function livingGrantEscortReward(d){
  const f=d?.livingFollower;if(!f||f.type!=='escort'||f.rewardClaimed)return false;
  f.rewardClaimed=true;
  const reward=f.reward;
  if(reward?.kind==='gold'){
    gameState.player.gold=(Number(gameState.player.gold)||0)+Math.max(0,Number(reward.amount)||0);
    log(`💰 【${escapeHtml(f.name)}】「助かった。約束の礼だ」 護衛報酬 ${reward.amount}G を受け取った。`);
  }else if(reward?.kind==='card'&&reward.masterId){
    const card=createCardInstance(reward.masterId,{rarity:reward.rarity||'R'});
    const routed=addDungeonCardToPlayerOrStorage(card);
    if(routed.location==='lost'){
      ensureMetaSystems();gameState.cardStorage||=[];gameState.cardStorage.push(card);
      log(`🎴 【${escapeHtml(f.name)}】「約束の札だ」 ${cardEffectiveRarity(card)}［${escapeHtml(card.name)}］を受け取り、カード鞄へ送った。`);
    }else log(`🎴 【${escapeHtml(f.name)}】「約束の札だ」 ${cardEffectiveRarity(card)}［${escapeHtml(card.name)}］を受け取った。`);
  }else log(`🤝 【${escapeHtml(f.name)}】を無事に町まで送り届けた。`);
  saveGame();return true;
}
function livingTryCompleteEscortReturn(d){if(!d||gameState.dungeon===d)return false;return livingGrantEscortReward(d);}


function livingWallEnvForWall(d,x,y){
  const candidates=[[1,0],[-1,0],[0,1],[0,-1]];
  for(const[ox,oy]of candidates){const env=livingEnvironmentAt(d,x+ox,y+oy);if(env)return env;}
  return null;
}
function livingWallColors(type){
  return{
    poison:{fill:'rgba(42,104,51,.25)',line:'rgba(111,194,119,.50)'},
    blood:{fill:'rgba(116,29,40,.25)',line:'rgba(210,76,84,.52)'},
    mana:{fill:'rgba(70,54,143,.26)',line:'rgba(170,145,255,.56)'},
    mud:{fill:'rgba(98,70,35,.26)',line:'rgba(181,143,83,.42)'},
    crumble:{fill:'rgba(119,112,70,.20)',line:'rgba(206,195,126,.46)'}
  }[type]||{fill:'rgba(80,80,80,.18)',line:'rgba(170,170,170,.35)'};
}
function livingPaintWallTexture(ctx,points,type,scale=1){
  if(!points?.length)return;const c=livingWallColors(type),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),ww=maxX-minX,hh=maxY-minY;
  ctx.save();ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);for(const p of points.slice(1))ctx.lineTo(p[0],p[1]);ctx.closePath();ctx.clip();ctx.fillStyle=c.fill;ctx.fillRect(minX,minY,ww,hh);ctx.strokeStyle=c.line;ctx.lineWidth=Math.max(.6,1.1*scale);ctx.globalAlpha=.9;
  if(type==='poison'){
    for(const t of[.22,.48,.73]){const x=minX+ww*t;ctx.beginPath();ctx.moveTo(x,minY);ctx.lineTo(x-ww*.03,minY+hh*.35);ctx.lineTo(x+ww*.015,minY+hh*.68);ctx.stroke();}
  }else if(type==='blood'){
    for(const t of[.18,.53,.78]){ctx.beginPath();ctx.moveTo(minX+ww*t,minY+hh*.08);ctx.lineTo(minX+ww*(t-.06),minY+hh*.58);ctx.stroke();}
    ctx.fillStyle=c.line;for(const t of[.30,.66,.84]){ctx.beginPath();ctx.arc(minX+ww*t,minY+hh*(.35+t*.25),Math.max(.7,1.4*scale),0,Math.PI*2);ctx.fill();}
  }else if(type==='mana'){
    ctx.beginPath();ctx.moveTo(minX+ww*.18,minY+hh*.74);ctx.lineTo(minX+ww*.38,minY+hh*.28);ctx.lineTo(minX+ww*.55,minY+hh*.62);ctx.lineTo(minX+ww*.78,minY+hh*.22);ctx.stroke();
    ctx.beginPath();ctx.ellipse(minX+ww*.53,minY+hh*.47,Math.max(2,ww*.12),Math.max(1,hh*.08),0,0,Math.PI*2);ctx.stroke();
  }else if(type==='mud'){
    for(const y of[.62,.76,.88]){ctx.beginPath();ctx.moveTo(minX,minY+hh*y);ctx.quadraticCurveTo(minX+ww*.45,minY+hh*(y-.06),maxX,minY+hh*y);ctx.stroke();}
  }else if(type==='crumble'){
    ctx.beginPath();ctx.moveTo(minX+ww*.50,minY);ctx.lineTo(minX+ww*.43,minY+hh*.35);ctx.lineTo(minX+ww*.58,minY+hh*.53);ctx.lineTo(minX+ww*.48,maxY);ctx.stroke();
    ctx.beginPath();ctx.moveTo(minX+ww*.43,minY+hh*.35);ctx.lineTo(minX+ww*.24,minY+hh*.49);ctx.moveTo(minX+ww*.58,minY+hh*.53);ctx.lineTo(minX+ww*.77,minY+hh*.68);ctx.stroke();
  }
  ctx.restore();
}
function livingDrawWallStains(ctx,d,w,offsetY,viewH,depth,side,dx,dy,rx,ry){
  if(!livingEnabledDungeon(d))return;
  const near=1/depth,far=1/(depth+1),tx=d.x+dx*depth+rx*side,ty=d.y+dy*depth+ry*side,tile=getDungeonViewTile(d,tx,ty);
  const x1=w/2+(side-.5)*w*near,x2=w/2+(side+.5)*w*near,y1=offsetY+viewH/2-(viewH/2)*near,y2=offsetY+viewH/2+(viewH/2)*near;
  const bx1=w/2+(side-.5)*w*far,bx2=w/2+(side+.5)*w*far,by1=offsetY+viewH/2-(viewH/2)*far,by2=offsetY+viewH/2+(viewH/2)*far;
  if(tile===1||tile===10){const env=livingWallEnvForWall(d,tx,ty);if(env)livingPaintWallTexture(ctx,[[x1,y1],[x2,y1],[x2,y2],[x1,y2]],env.type,near);return;}
  const env=livingEnvironmentAt(d,tx,ty);if(!env)return;
  if(getDungeonViewTile(d,tx-rx,ty-ry)===1)livingPaintWallTexture(ctx,[[x1,y1],[bx1,by1],[bx1,by2],[x1,y2]],env.type,near);
  if(getDungeonViewTile(d,tx+rx,ty+ry)===1)livingPaintWallTexture(ctx,[[x2,y1],[bx2,by1],[bx2,by2],[x2,y2]],env.type,near);
}


// treasure roomへ移るケースでも、次階までの同行はそこで終了。護衛依頼だけは町まで継続。


