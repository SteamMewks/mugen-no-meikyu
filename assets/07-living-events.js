


// 足元に立つまでは青い人影の正体を操作UIから明かさない。


function livingStartThugStrongBattle(d,npc){
  if(!d||!npc)return;
  // 戦闘開始だけでは消さない。倒した時だけ迷宮から姿を消す。
  d.livingThugCombatNpcId=npc.id;
  clearLog();
  log(`⚔️ 【${escapeHtml(npc.name)}】「なら、持ってる物ごと置いていけ！」`);
  // 強敵の能力計算を使い、全員を盗賊ベースのゴロツキとして戦闘開始前に生成する。
  startStrongEnemyBattle({livingThug:npc});
  saveGame();
}

// ゴロツキは「払う／戦う」。話しかけた以上、拒否してそのまま立ち去ることはできない。


function livingFindActivePriest(){
  return (gameState.party||[]).find(c=>c&&c.hp>0&&c.jobType==='priest')||null;
}
function livingPurifyCorpse(priest,corpse){
  if(!priest||!corpse)return false;
  clearLog();
  log(`🙏 【${escapeHtml(priest.name)}】が屍の前で足を止め、静かに祈りを捧げた。`);
  log('✨ 淡い光が屍を包み、残っていた淀んだ気配が消えていく……。');
  corpse.purified=true;
  return true;
}

// 屍：神官がいれば必ず先に浄化。いなければアンデッド化時に敵だけが先制1ターン動く。


// 壁の基礎テクスチャは通常迷宮では第2語（地形）に固定で紐付く。
 // 同じ第2語なら、他の侵入語や階層が変わっても建築様式は変化しない。
 // 特殊床による染み・亀裂は、この基礎壁の上へ別レイヤーとして重なる。
const LIVING_WALL_TEXTURES=Object.freeze(['ashlar','brick','strata','rough','vein','scarred']);
const LIVING_TERRAIN_WALL_TEXTURE=Object.freeze({
  t01:'rough',          // 洞窟
  t02:'steam_corridor', // 蒸気回廊
  t03:'scarred',        // 廃墟
  t04:'rough',          // 樹海
  t05:'strata',         // 火口
  t06:'ashlar',         // 墓地
  t07:'rough',          // 沼地
  t08:'brick',          // 地下水路
  t09:'vein',           // 鉱山
  t10:'ashlar',         // 城塞
  t11:'ashlar',         // 霊廟
  t12:'scarred',        // 魔窟
  t13:'rough',          // 竜巣
  t14:'rough',          // 蟲穴
  t15:'ashlar',         // 聖域
  t16:'arcane_factory', // 魔導工廠
  t17:'strata',         // 奈落
  t18:'scarred',        // 古戦場
  t19:'vein',           // 幻界
  t20:'scarred',        // 混沌領域
  t21:'ashlar',         // 氷宮
  t22:'ashlar',         // 天空庭園
  t23:'brick',          // 沈没都市
  t24:'clockwork',      // 時計塔
  t25:'vein',           // 星海
  t26:'vein',           // 晶洞
  t27:'scarred',        // 獄門
  t28:'engine_city',    // 機関都市
  t29:'ashlar',         // 無限回廊
  t30:'ashlar',         // 鏡界
  t31:'brick',          // 記憶庫
  t32:'ashlar'          // 虚空城
});
function livingFloorWallTexture(d){
  if(!d)return'ashlar';

  // 通常迷宮：第2語（terrain）のIDをそのまま視覚テーマのキーにする。
  if(d.dungeonKind==='normal'){
    const terrainId=String(d.wordIds?.[1]||'');
    if(LIVING_TERRAIN_WALL_TEXTURE[terrainId])return LIVING_TERRAIN_WALL_TEXTURE[terrainId];

    // 自由入力の第2語も、語そのものに固定された壁になる。
    const terrainWord=String(d.wordNames?.[1]||terrainId||'terrain');
    const seed=stringToSeed(`WALL_TEXTURE_TERRAIN_WORD::${terrainWord}`);
    return LIVING_WALL_TEXTURES[Math.abs(seed)%LIVING_WALL_TEXTURES.length];
  }

  // 夢幻迷宮は単語全体が侵入語なので、その語に対して固定。
  const invasionWord=String(d.name||d.specialSeed||'mugen');
  const seed=stringToSeed(`WALL_TEXTURE_INVASION_WORD::${invasionWord}`);
  return LIVING_WALL_TEXTURES[Math.abs(seed)%LIVING_WALL_TEXTURES.length];
}
function livingTexturePolygon(ctx,points,texture,scale){
  if(!points?.length)return;
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const ww=Math.max(1,maxX-minX),hh=Math.max(1,maxY-minY);
  if(ww<3||hh<3)return;
  ctx.save();
  ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);ctx.closePath();ctx.clip();
  ctx.globalAlpha=Math.min(.42,.18+.10*Math.max(.25,scale));
  ctx.strokeStyle='#b28a48';ctx.fillStyle='#8a6b3d';ctx.lineWidth=Math.max(.55,1.05*scale);

  const line=(x1,y1,x2,y2)=>{ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();};
  if(texture==='ashlar'){
    const rows=4;for(let r=1;r<rows;r++){const y=minY+hh*r/rows;line(minX,y,maxX,y);}
    for(let r=0;r<rows;r++){const y1=minY+hh*r/rows,y2=minY+hh*(r+1)/rows,offset=r%2?.25:.5;for(let k=0;k<3;k++){const x=minX+ww*((k+offset)/3);line(x,y1,x,y2);}}
  }else if(texture==='brick'){
    const rows=5;for(let r=1;r<rows;r++){const y=minY+hh*r/rows;line(minX,y,maxX,y);}for(let r=0;r<rows;r++){const y1=minY+hh*r/rows,y2=minY+hh*(r+1)/rows;const off=(r%2)*.5;for(let k=0;k<4;k++){const x=minX+ww*((k+off)/4);line(x,y1,x,y2);}}
  }else if(texture==='strata'){
    for(const f of[.18,.34,.52,.69,.84]){const y=minY+hh*f;ctx.beginPath();ctx.moveTo(minX,y);ctx.quadraticCurveTo(minX+ww*.35,y+hh*.035,minX+ww*.58,y-hh*.025);ctx.quadraticCurveTo(minX+ww*.82,y+hh*.02,maxX,y);ctx.stroke();}
  }else if(texture==='rough'){
    for(const [a,b,c,d] of[[.12,.18,.34,.31],[.38,.08,.52,.24],[.68,.16,.88,.32],[.20,.58,.42,.46],[.55,.70,.78,.54],[.32,.92,.48,.73]])line(minX+ww*a,minY+hh*b,minX+ww*c,minY+hh*d);
    for(const [x,y] of[[.18,.42],[.63,.39],[.82,.73],[.39,.66]]){ctx.beginPath();ctx.arc(minX+ww*x,minY+hh*y,Math.max(.7,1.4*scale),0,Math.PI*2);ctx.fill();}
  }else if(texture==='vein'){
    ctx.lineWidth=Math.max(.65,1.25*scale);for(const off of[-.18,.08,.30]){ctx.beginPath();ctx.moveTo(minX+ww*(.08+off),maxY);ctx.bezierCurveTo(minX+ww*(.30+off),minY+hh*.72,minX+ww*(.42+off),minY+hh*.40,minX+ww*(.70+off),minY);ctx.stroke();}
  }else if(texture==='steam_corridor'){
    ctx.strokeStyle='#a68b59';ctx.fillStyle='#b99b64';
    ctx.lineWidth=Math.max(.65,1.05*scale);
    line(minX,minY+hh*.52,maxX,minY+hh*.52);
    line(minX+ww*.58,minY,minX+ww*.58,maxY);
    const rivetR=Math.max(.6,1.15*scale);
    for(const x of[.06,.55,.61,.94])for(const y of[.07,.49,.56,.93]){
      ctx.beginPath();ctx.arc(minX+ww*x,minY+hh*y,rivetR,0,Math.PI*2);ctx.fill();
    }
    ctx.lineWidth=Math.max(1.2,2.5*scale);
    ctx.beginPath();
    ctx.moveTo(minX-ww*.04,minY+hh*.30);
    ctx.lineTo(minX+ww*.28,minY+hh*.30);
    ctx.quadraticCurveTo(minX+ww*.36,minY+hh*.30,minX+ww*.36,minY+hh*.22);
    ctx.lineTo(minX+ww*.36,minY-hh*.03);
    ctx.stroke();
    ctx.lineWidth=Math.max(.8,1.5*scale);
    for(const x of[.12,.27]){
      line(minX+ww*x,minY+hh*.265,minX+ww*x,minY+hh*.335);
      line(minX+ww*(x+.018),minY+hh*.265,minX+ww*(x+.018),minY+hh*.335);
    }
    ctx.lineWidth=Math.max(.8,1.45*scale);
    ctx.beginPath();
    ctx.moveTo(minX+ww*.72,minY-hh*.02);
    ctx.lineTo(minX+ww*.72,minY+hh*.70);
    ctx.quadraticCurveTo(minX+ww*.72,minY+hh*.78,minX+ww*.80,minY+hh*.78);
    ctx.lineTo(maxX+ww*.03,minY+hh*.78);
    ctx.stroke();
    const vx=minX+ww*.72,vy=minY+hh*.47,vr=Math.max(2.5,Math.min(ww,hh)*.075);
    ctx.beginPath();ctx.arc(vx,vy,vr,0,Math.PI*2);ctx.stroke();
    line(vx-vr,vy,vx+vr,vy);line(vx,vy-vr,vx,vy+vr);
    ctx.lineWidth=Math.max(.65,1.1*scale);
    line(minX+ww*.31,minY+hh*.30,minX+ww*.31,minY+hh*.43);
    line(minX+ww*.27,minY+hh*.43,minX+ww*.35,minY+hh*.43);
  }else if(texture==='arcane_factory'){
    ctx.strokeStyle='#a68b59';ctx.fillStyle='#b99b64';
    ctx.lineWidth=Math.max(.65,1.05*scale);
    for(const f of[.28,.62])line(minX,minY+hh*f,maxX,minY+hh*f);
    line(minX+ww*.48,minY,minX+ww*.48,maxY);
    const rivetR=Math.max(.6,1.1*scale);
    for(const x of[.05,.45,.51,.95])for(const y of[.06,.25,.65,.94]){
      ctx.beginPath();ctx.arc(minX+ww*x,minY+hh*y,rivetR,0,Math.PI*2);ctx.fill();
    }
    ctx.lineWidth=Math.max(1.1,2.2*scale);
    ctx.beginPath();ctx.moveTo(minX-ww*.02,minY+hh*.18);ctx.lineTo(maxX+ww*.02,minY+hh*.18);ctx.stroke();
    ctx.beginPath();ctx.moveTo(minX+ww*.18,minY-hh*.02);ctx.lineTo(minX+ww*.18,maxY+hh*.02);ctx.stroke();
    ctx.lineWidth=Math.max(.7,1.35*scale);
    for(const x of[.34,.70]){line(minX+ww*x,minY+hh*.145,minX+ww*x,minY+hh*.215);}
    const hx=minX+ww*.70,hy=minY+hh*.62,hr=Math.max(3,Math.min(ww,hh)*.12);
    ctx.beginPath();ctx.arc(hx,hy,hr,0,Math.PI*2);ctx.stroke();
    ctx.beginPath();ctx.arc(hx,hy,hr*.72,0,Math.PI*2);ctx.stroke();
    for(let i=0;i<6;i++){const a=Math.PI*2*i/6;ctx.beginPath();ctx.arc(hx+Math.cos(a)*hr*.86,hy+Math.sin(a)*hr*.86,rivetR*.7,0,Math.PI*2);ctx.fill();}
    ctx.lineWidth=Math.max(.55,.95*scale);
    const ay=minY+hh*.82;
    line(minX+ww*.10,ay,maxX-ww*.08,ay);
    line(minX+ww*.10,ay-hh*.035,maxX-ww*.08,ay-hh*.035);
  }else if(texture==='clockwork'){
    ctx.strokeStyle='#aa8d58';ctx.fillStyle='#b99b64';
    ctx.lineWidth=Math.max(.65,1.05*scale);
    line(minX+ww*.12,minY,minX+ww*.12,maxY);
    line(minX+ww*.88,minY,minX+ww*.88,maxY);
    line(minX,minY+hh*.18,maxX,minY+hh*.18);
    line(minX,minY+hh*.84,maxX,minY+hh*.84);
    const gear=(gx,gy,gr,teeth)=>{
      ctx.beginPath();ctx.arc(gx,gy,gr,0,Math.PI*2);ctx.stroke();
      ctx.beginPath();ctx.arc(gx,gy,gr*.28,0,Math.PI*2);ctx.stroke();
      for(let i=0;i<teeth;i++){const a=Math.PI*2*i/teeth;
        line(gx+Math.cos(a)*gr*.88,gy+Math.sin(a)*gr*.88,gx+Math.cos(a)*gr*1.12,gy+Math.sin(a)*gr*1.12);
      }
      for(let i=0;i<4;i++){const a=Math.PI*i/2;line(gx+Math.cos(a)*gr*.28,gy+Math.sin(a)*gr*.28,gx+Math.cos(a)*gr*.82,gy+Math.sin(a)*gr*.82);}
    };
    const r1=Math.max(3,Math.min(ww,hh)*.18),r2=r1*.68;
    gear(minX+ww*.42,minY+hh*.50,r1,10);
    gear(minX+ww*.68,minY+hh*.61,r2,8);
    ctx.beginPath();ctx.arc(minX+ww*.42,minY+hh*.50,Math.max(.8,1.5*scale),0,Math.PI*2);ctx.fill();
    line(minX+ww*.42,minY+hh*.50,minX+ww*.68,minY+hh*.61);
  }else if(texture==='engine_city'){
    ctx.strokeStyle='#a48756';ctx.fillStyle='#b99b64';
    ctx.lineWidth=Math.max(.7,1.15*scale);
    for(const f of[.25,.50,.75])line(minX,minY+hh*f,maxX,minY+hh*f);
    line(minX+ww*.40,minY,minX+ww*.40,maxY);
    line(minX+ww*.78,minY,minX+ww*.78,maxY);
    const rivetR=Math.max(.6,1.15*scale);
    for(const x of[.04,.37,.43,.75,.81,.96])for(const y of[.04,.22,.53,.78,.96]){
      ctx.beginPath();ctx.arc(minX+ww*x,minY+hh*y,rivetR,0,Math.PI*2);ctx.fill();
    }
    ctx.lineWidth=Math.max(1.35,2.8*scale);
    ctx.beginPath();ctx.moveTo(minX-ww*.03,minY+hh*.68);ctx.lineTo(maxX+ww*.03,minY+hh*.68);ctx.stroke();
    ctx.lineWidth=Math.max(.8,1.45*scale);
    for(const x of[.18,.58,.86]){
      line(minX+ww*x,minY+hh*.635,minX+ww*x,minY+hh*.725);
      line(minX+ww*(x+.02),minY+hh*.635,minX+ww*(x+.02),minY+hh*.725);
      line(minX+ww*(x+.01),minY+hh*.57,minX+ww*(x+.01),minY+hh*.635);
    }
    const px=minX+ww*.61,py=minY+hh*.32,pr=Math.max(2.8,Math.min(ww,hh)*.085);
    ctx.beginPath();ctx.arc(px,py,pr,0,Math.PI*2);ctx.stroke();
    line(px,py,px+pr*.45,py-pr*.25);
    line(px,py+pr,px,py+pr*1.55);
    const hx=minX+ww*.20,hy=minY+hh*.34,hw=ww*.20,hhatch=hh*.20;
    ctx.strokeRect(hx-hw/2,hy-hhatch/2,hw,hhatch);
    for(const [dx,dy] of[[-.08,-.07],[.08,-.07],[-.08,.07],[.08,.07]]){
      ctx.beginPath();ctx.arc(hx+ww*dx,hy+hh*dy,rivetR*.65,0,Math.PI*2);ctx.fill();
    }
  }else{
    ctx.lineWidth=Math.max(.65,1.15*scale);for(const [a,b,c,d,e,f] of[[.20,.02,.25,.38,.12,.72],[.63,.00,.58,.28,.74,.52],[.42,.48,.54,.66,.46,.98],[.82,.42,.73,.67,.88,.91]]){ctx.beginPath();ctx.moveTo(minX+ww*a,minY+hh*b);ctx.lineTo(minX+ww*c,minY+hh*d);ctx.lineTo(minX+ww*e,minY+hh*f);ctx.stroke();}
  }
  ctx.restore();
}

function livingTexturePlane(ctx,points,texture,scale,plane){
  if(!points?.length)return;
  const p0=points[0],p1=points[1],p2=points[2],p3=points[3];
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const ww=Math.max(1,maxX-minX),hh=Math.max(1,maxY-minY);
  if(ww<4||hh<2)return;

  const lerp=(a,b,t)=>a+(b-a)*t;
  const pt=(a,b,t)=>[lerp(a[0],b[0],t),lerp(a[1],b[1],t)];
  const across=(t,a=0,b=1)=>{
    const l=pt(p0,p3,t),r=pt(p1,p2,t);
    return [pt(l,r,a),pt(l,r,b)];
  };
  const long=(u,a=0,b=1)=>{
    const n=pt(p0,p1,u),f=pt(p3,p2,u);
    return [pt(n,f,a),pt(n,f,b)];
  };

  ctx.save();
  ctx.beginPath();ctx.moveTo(p0[0],p0[1]);ctx.lineTo(p1[0],p1[1]);ctx.lineTo(p2[0],p2[1]);ctx.lineTo(p3[0],p3[1]);ctx.closePath();ctx.clip();

  const isFloor=plane==='floor';
  ctx.globalAlpha=isFloor?Math.min(.34,.18+.09*Math.max(.25,scale)):Math.min(.23,.11+.06*Math.max(.25,scale));
  ctx.strokeStyle=isFloor?'#b28a48':'#8f8066';
  ctx.fillStyle=isFloor?'#9f7a42':'#7f745f';
  ctx.lineWidth=Math.max(.5,(isFloor?.95:.72)*scale);

  const line=(a,b)=>{
    ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();
  };
  const segAcross=(t,a,b)=>{const s=across(t,a,b);line(s[0],s[1]);};
  const segLong=(u,a,b)=>{const s=long(u,a,b);line(s[0],s[1]);};

  if(texture==='ashlar'){
    const rows=isFloor?[.18,.38,.58,.76,.89]:[.30,.58,.80];
    rows.forEach(t=>segAcross(t,0,1));
    const cols=isFloor?[.25,.50,.75]:[.33,.67];
    cols.forEach((u,i)=>segLong(u,isFloor?(i%2?0:.20):.10,1));
  }else if(texture==='brick'){
    const rows=isFloor?[.14,.29,.45,.61,.76,.88]:[.26,.50,.72,.88];
    rows.forEach(t=>segAcross(t,0,1));
    rows.slice(0,-1).forEach((t,i)=>{
      const next=rows[i+1],off=i%2?.18:0;
      for(const u of isFloor?[.25+off,.50+off,.75+off]:[.35+off,.70+off]){
        if(u<.95)segLong(u,t,next);
      }
    });
  }else if(texture==='strata'){
    const vals=isFloor?[.18,.34,.51,.68,.83]:[.28,.52,.73];
    for(const t of vals){
      const a=across(t,0,1),m=pt(a[0],a[1],.52);
      const bend=(isFloor?1:-1)*hh*(.015+.012*(1-t));
      ctx.beginPath();ctx.moveTo(a[0][0],a[0][1]);
      ctx.quadraticCurveTo(m[0],m[1]+bend,a[1][0],a[1][1]);ctx.stroke();
    }
  }else if(texture==='rough'){
    const cracks=isFloor
      ? [[.12,.10,.32,.40],[.66,.05,.55,.44],[.30,.52,.45,.88],[.80,.42,.68,.82]]
      : [[.18,.18,.33,.54],[.58,.10,.72,.42],[.42,.55,.30,.86]];
    for(const [u1,t1,u2,t2] of cracks){
      const a=pt(...across(t1,0,1),u1),b=pt(...across(t2,0,1),u2);
      line(a,b);
    }
    if(isFloor){
      for(const [u,t] of [[.22,.46],[.70,.62],[.44,.79]]){
        const a=across(t,0,1),c=pt(a[0],a[1],u);
        ctx.beginPath();ctx.arc(c[0],c[1],Math.max(.45,1.05*scale),0,Math.PI*2);ctx.fill();
      }
    }
  }else if(texture==='vein'){
    const us=isFloor?[.20,.48,.74]:[.31,.67];
    for(const u of us){
      const a=long(u,0,1),mid=pt(a[0],a[1],.52);
      ctx.beginPath();ctx.moveTo(a[0][0],a[0][1]);
      ctx.quadraticCurveTo(mid[0]+ww*(u-.5)*.05,mid[1],a[1][0],a[1][1]);ctx.stroke();
    }
  }else if(texture==='scarred'){
    const marks=isFloor
      ? [[.14,.22,.42,.49],[.42,.49,.30,.72],[.68,.18,.55,.42],[.55,.42,.77,.73]]
      : [[.22,.18,.41,.45],[.41,.45,.32,.70],[.66,.30,.78,.58]];
    for(const [u1,t1,u2,t2] of marks){
      const a=pt(...across(t1,0,1),u1),b=pt(...across(t2,0,1),u2);line(a,b);
    }
  }else if(texture==='steam_corridor'){
    if(isFloor){
      [.26,.52,.76].forEach(t=>segAcross(t,0,1));
      [.18,.82].forEach(u=>segLong(u,0,1));
      [.34,.66].forEach(u=>segLong(u,.12,.92));
    }else{
      ctx.lineWidth=Math.max(.75,1.35*scale);
      [.30,.70].forEach(u=>segLong(u,0,1));
      ctx.lineWidth=Math.max(.5,.72*scale);
      [.36,.68].forEach(t=>segAcross(t,.08,.92));
    }
  }else if(texture==='arcane_factory'){
    if(isFloor){
      [.24,.50,.74].forEach(t=>segAcross(t,0,1));
      [.22,.52,.78].forEach(u=>segLong(u,0,1));
      ctx.lineWidth=Math.max(.45,.70*scale);
      [.43,.47].forEach(u=>segLong(u,.08,.94));
    }else{
      [.28,.62].forEach(t=>segAcross(t,.05,.95));
      [.35,.39,.70].forEach(u=>segLong(u,.05,.95));
    }
  }else if(texture==='clockwork'){
    if(isFloor){
      [.28,.50,.72].forEach(t=>segAcross(t,.08,.92));
      [.20,.40,.60,.80].forEach(u=>segLong(u,.10,.92));
      const c=pt(pt(p0,p1,.5),pt(p3,p2,.5),.58);
      const r=Math.max(1.8,Math.min(ww,hh)*.10);
      ctx.beginPath();ctx.arc(c[0],c[1],r,0,Math.PI*2);ctx.stroke();
    }else{
      [.18,.82].forEach(u=>segLong(u,0,1));
      [.30,.70].forEach(t=>segAcross(t,.04,.96));
      const c=pt(pt(p0,p1,.5),pt(p3,p2,.5),.48);
      ctx.beginPath();ctx.arc(c[0],c[1],Math.max(1.3,Math.min(ww,hh)*.075),0,Math.PI*2);ctx.stroke();
    }
  }else if(texture==='engine_city'){
    if(isFloor){
      [.22,.46,.70,.86].forEach(t=>segAcross(t,0,1));
      [.18,.50,.82].forEach(u=>segLong(u,0,1));
      ctx.lineWidth=Math.max(.75,1.25*scale);
      [.46,.54].forEach(u=>segLong(u,.04,.98));
    }else{
      ctx.lineWidth=Math.max(.8,1.45*scale);
      [.24,.76].forEach(u=>segLong(u,0,1));
      ctx.lineWidth=Math.max(.5,.78*scale);
      [.25,.53,.78].forEach(t=>segAcross(t,.02,.98));
    }
  }else{
    // 未知のテクスチャでも、床と天井で密度を変えた亀裂を出す。
    const vals=isFloor?[.24,.49,.73]:[.36,.68];
    vals.forEach((t,i)=>{
      const a=across(t,.16+i*.05,.82-i*.04);line(a[0],a[1]);
    });
  }

  ctx.restore();
}

function livingDrawFloorWallBaseTexture(ctx,d,w,offsetY,viewH,depth,side,dx,dy,rx,ry){
  if(!livingEnabledDungeon(d))return;
  const near=1/depth,far=1/(depth+1),tx=d.x+dx*depth+rx*side,ty=d.y+dy*depth+ry*side,tile=getDungeonViewTile(d,tx,ty);
  const x1=w/2+(side-.5)*w*near,x2=w/2+(side+.5)*w*near,y1=offsetY+viewH/2-(viewH/2)*near,y2=offsetY+viewH/2+(viewH/2)*near;
  const bx1=w/2+(side-.5)*w*far,bx2=w/2+(side+.5)*w*far,by1=offsetY+viewH/2-(viewH/2)*far,by2=offsetY+viewH/2+(viewH/2)*far;
  const texture=livingFloorWallTexture(d);
  if(tile===1||tile===10){livingTexturePolygon(ctx,[[x1,y1],[x2,y1],[x2,y2],[x1,y2]],texture,near);return;}
  if(getDungeonViewTile(d,tx-rx,ty-ry)===1)livingTexturePolygon(ctx,[[x1,y1],[bx1,by1],[bx1,by2],[x1,y2]],texture,near);
  if(getDungeonViewTile(d,tx+rx,ty+ry)===1)livingTexturePolygon(ctx,[[x2,y1],[bx2,by1],[bx2,by2],[x2,y2]],texture,near);
}
function livingDrawFloorCeilingBaseTexture(ctx,d,w,offsetY,viewH,depth,side,dx,dy,rx,ry){
  if(!livingEnabledDungeon(d))return;
  const near=1/depth,far=1/(depth+1),tx=d.x+dx*depth+rx*side,ty=d.y+dy*depth+ry*side,tile=getDungeonViewTile(d,tx,ty);
  if(tile===1||tile===10)return;

  const x1=w/2+(side-.5)*w*near,x2=w/2+(side+.5)*w*near,y1=offsetY+viewH/2-(viewH/2)*near,y2=offsetY+viewH/2+(viewH/2)*near;
  const bx1=w/2+(side-.5)*w*far,bx2=w/2+(side+.5)*w*far,by1=offsetY+viewH/2-(viewH/2)*far,by2=offsetY+viewH/2+(viewH/2)*far;
  const texture=livingFloorWallTexture(d);

  // 同じ地形テーマを使いながら、床は暖色・高密度、天井は灰色寄り・低密度に描き分ける。
  livingTexturePlane(ctx,[[x1,y2],[x2,y2],[bx2,by2],[bx1,by2]],texture,near,'floor');
  livingTexturePlane(ctx,[[x1,y1],[x2,y1],[bx2,by1],[bx1,by1]],texture,near,'ceiling');
}


