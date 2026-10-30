
const SYMBOL_MAX=7;
const SYMBOL_DEFAULT_RESPAWN_RATE=0.08;
const SYMBOL_MIN_START=1;
function getSymbolDungeon(){
	const d=gameState?.dungeon||null;
	return d?.noEnemySymbols?null:d;
}
function getEnemySymbolMax(d){
	if(!d)return SYMBOL_MAX;
	const generated=Math.floor(Number(d.enemySymbolMax));
	if(Number.isFinite(generated)&&generated>=0)return Math.min(SYMBOL_MAX,generated);
	const space=Math.max(1,Number(d.width||0)*Number(d.height||0));
	return Math.min(SYMBOL_MAX,Math.max(SYMBOL_MIN_START,Math.round(Math.sqrt(space)/ 3)));
}
function isWalkableForSymbol(d,x,y){
	if(!d||x<0||y<0||x>=d.width||y>=d.height)return false;
	const tile=d.map?.[y]?.[x];
	return tile===0||tile===2||tile===3||tile===12||tile===14;
}
function isHunterPathTile(d,x,y){
	if(!d||x<0||y<0||x>=d.width||y>=d.height)return false;
	if(x===d.x&&y===d.y){const tile=d.map?.[y]?.[x];return tile!==1&&tile!==8&&tile!==10;}
	return isWalkableForSymbol(d,x,y);
}
function getSeededSymbolBehavior(seedText){
	const rng=createRNG(stringToSeed(String(seedText||'symbol')));
	return rng()<0.30?'hunter':'random';
}
function isSymbolOccupied(d,x,y,ignoreId=null){
	return(d.enemySymbols||[]).some(e=>e.id!==ignoreId&&e.x===x&&e.y===y);
}
function getSymbolSpawnCandidates(d,minDistance=4){
	const out=[];
	for(let y=0;y<d.height;y++){
		for(let x=0;x<d.width;x++){
			if(!isWalkableForSymbol(d,x,y)||(x===d.x&&y===d.y)||isSymbolOccupied(d,x,y))continue;
			if(Math.abs(x-d.x)+Math.abs(y-d.y)<Math.max(1,Number(minDistance)||1))continue;
			out.push({x,y});
		}
	}
	return out;
}
function addEnemySymbol(d,options={}){

let baseResult11;
baseStep11: {

	if(!d||d.isTreasureRoom){ baseResult11=(false); break baseStep11; }
	d.enemySymbols||=[];
	const max=getEnemySymbolMax(d);
	if(max<=0||(!options.ignoreMax&&d.enemySymbols.length>=max)){ baseResult11=(false); break baseStep11; }
	const candidates=getSymbolSpawnCandidates(d,options.minDistance??4);
	if(!candidates.length){ baseResult11=(false); break baseStep11; }
	const point=candidates[Math.floor(Math.random()*candidates.length)];
	const behavior=options.behavior|| (Math.random()<0.30?'hunter':'random');
	d.enemySymbols.push({id:`sym_${Date.now()}_${Math.random().toString(36).slice(2)}`,x:point.x,y:point.y,behavior,spawnReason:options.spawnReason||''});
	{ baseResult11=(true); break baseStep11; }

}
const r=baseResult11;
if(r&&livingEnabledDungeon(d)&&!['arcane_circle','blood_pool'].includes(options.spawnReason)&&Math.random()<.65){const cue=LIVING_DUNGEON_ENEMY_SPAWN_CUES[Math.floor(Math.random()*LIVING_DUNGEON_ENEMY_SPAWN_CUES.length)];log(cue);}return r;
}
function ensureEnemySymbols(forceFill=false){
	const d=getSymbolDungeon();
	if(!d||d.isTreasureRoom)return;
	if(d.isTutorial){setupTutorialFixedEnemySymbol(d);return;}
	d.enemySymbols||=[];
	const generationId=d.objectGenerationId||null;
	if(forceFill&&generationId&&d.enemySymbolsGenerationId!==generationId){
		const max=getEnemySymbolMax(d);
		d.enemySymbols=(Array.isArray(d.initialEnemyPoints)?d.initialEnemyPoints:[])
			.slice(0,max)
			.filter(p=>isWalkableForSymbol(d,p.x,p.y)&&!(p.x===d.x&&p.y===d.y))
			.map((p,i)=>({id:`seed_sym_${generationId}_${i}`,x:p.x,y:p.y,behavior:getSeededSymbolBehavior(`${generationId}:${i}`)}));
		d.enemySymbolsGenerationId=generationId;
		return;
	}
}
function collideEnemySymbolWithPlayer(d){
let baseResult16;
baseStep16: {

	const index=(d.enemySymbols||[]).findIndex(e=>e.x===d.x&&e.y===d.y);
	if(index<0){ baseResult16=(false); break baseStep16; }
	const symbol=d.enemySymbols[index];
	d.enemySymbols.splice(index,1);
	if(d.isTutorial&&symbol?.fixedTutorial&&gameState.tutorialState){
		gameState.tutorialState.fixedEncountersDefeated||={};
		gameState.tutorialState.fixedEncountersDefeated[d.currentDepth]=true;
		if(d.currentDepth===3&&!gameState.tutorialState.cargoLessonSeen){
			gameState.tutorialState.pendingCargoLessonBattle=true;
		}
		saveGame();
	}
	if(gameState.party?.some(c=>c.hp>0))startBattleWithWord();
	{ baseResult16=(true); break baseStep16; }

}
return baseResult16;
}
function getHunterNextStep(d,enemySymbol){
	const startKey=`${enemySymbol.x},${enemySymbol.y}`,targetKey=`${d.x},${d.y}`;
	if(startKey===targetKey)return{x:d.x,y:d.y};
	const queue=[[enemySymbol.x,enemySymbol.y]],seen=new Set([startKey]),firstStep=new Map();
	const dirs=[[0,-1],[1,0],[0,1],[-1,0]];
	for(let qi=0;qi<queue.length;qi++){
		const[x,y]=queue[qi];
		for(const[dx,dy]of dirs){
			const nx=x+dx,ny=y+dy,key=`${nx},${ny}`;
			if(seen.has(key)||!isHunterPathTile(d,nx,ny))continue;
			if(!(nx===d.x&&ny===d.y)&&isSymbolOccupied(d,nx,ny,enemySymbol.id))continue;
			seen.add(key);queue.push([nx,ny]);
			firstStep.set(key,(x===enemySymbol.x&&y===enemySymbol.y)?{x:nx,y:ny}:firstStep.get(`${x},${y}`));
			if(key===targetKey)return firstStep.get(key)||{x:nx,y:ny};
		}
	}
	return null;
}
function moveEnemySymbols(){
const d=gameState?.dungeon;if(livingEnabledDungeon(d)&&Number(d.livingSkipEnemyMove)>0){d.livingSkipEnemyMove=Math.max(0,Number(d.livingSkipEnemyMove)-1);return false;}let baseResult10;
baseStep10: {

	const d=getSymbolDungeon();
	if(!d||d.isTreasureRoom){ baseResult10=(false); break baseStep10; }
	if(d.isTutorial){ baseResult10=(false); break baseStep10; }
	ensureEnemySymbols(false);
	const dirs=[[0,-1],[1,0],[0,1],[-1,0]];
	for(const enemySymbol of d.enemySymbols){
		const choices=dirs.map(([dx,dy])=>({x:enemySymbol.x+dx,y:enemySymbol.y+dy}))
			.filter(p=>isWalkableForSymbol(d,p.x,p.y)&&!isSymbolOccupied(d,p.x,p.y,enemySymbol.id));
		let pick=null;
		if(enemySymbol.behavior==='hunter')pick=getHunterNextStep(d,enemySymbol);
		if(!pick&&choices.length)pick=choices[Math.floor(Math.random()*choices.length)];
		if(!pick)continue;
		enemySymbol.x=pick.x;
		enemySymbol.y=pick.y;
		if(enemySymbol.x===d.x&&enemySymbol.y===d.y){ baseResult10=(collideEnemySymbolWithPlayer(d)); break baseStep10; }
	}
	{ baseResult10=(false); break baseStep10; }

}
return baseResult10;
}
function getSymbolRespawnRate(d){
	const base=Number.isFinite(d?.enemyRate)?clampWordStat(d.enemyRate,0,0.50):SYMBOL_DEFAULT_RESPAWN_RATE;
	const reduction=Math.min(80,getLegacyPower('encounter'))/ 100;
	return Math.max(0,base*(1-reduction));
}
function maybeRespawnSymbol(){
	const d=getSymbolDungeon();
	if(!d||d.isTreasureRoom||d.isTutorial)return;
	d.enemySymbols||=[];
	if(d.enemySymbols.length<getEnemySymbolMax(d)&&Math.random()<getSymbolRespawnRate(d))addEnemySymbol(d);
}
function processEnemySymbolsAfterPlayerStep(){
const d=gameState?.dungeon;if(livingEnabledDungeon(d)&&!gameState.inBattle){livingGetFloorState(d);livingApplyCurrentFloorEffect(d);livingTriggerArcaneCircles(d);livingMoveNpcs(d);livingResolveNpcEnemyCollisions(d);}let baseResult13;
baseStep13: {

	if(gameState?.inBattle){ baseResult13=(undefined); break baseStep13; }
	const d=getSymbolDungeon();
	if(!d){ baseResult13=(undefined); break baseStep13; }
	if(d.questInstance&&d.questReturnJustStarted){d.questReturnJustStarted=false;updateDungeonView();{ baseResult13=(undefined); break baseStep13; }}
	ensureEnemySymbols(false);
	if(collideEnemySymbolWithPlayer(d)){ baseResult13=(undefined); break baseStep13; }
	if(d.isTutorial){updateDungeonView();{ baseResult13=(undefined); break baseStep13; }}
	if(moveEnemySymbols()){ baseResult13=(undefined); break baseStep13; }
	maybeRespawnSymbol();
	updateDungeonView();

}
const r=baseResult13;
if(livingEnabledDungeon(d)&&!gameState.inBattle){livingResolveNpcEnemyCollisions(d);livingEnemyProximityCue(d);updateStairActionButton();refreshMapIfOpen();}return r;
}
function getVisibleEnemySymbols(d){
	const dirs=[[0,-1],[1,0],[0,1],[-1,0]],[fx,fy]=dirs[d.dir],[rx,ry]=dirs[(d.dir+1)%4];
	const tileAt=(x,y)=>x<0||y<0||x>=d.width||y>=d.height?1:d.map[y][x];
	const clearSight=dist=>{for(let s=1;s<dist;s++){const tile=tileAt(d.x+fx*s,d.y+fy*s);if(!(tile===0||tile===2||tile===3||tile===12||tile===14))return false;}return true;};
	const visible=[];for(const e of d.enemySymbols){const dx=e.x-d.x,dy=e.y-d.y,forward=dx*fx+dy*fy,side=dx*rx+dy*ry;if(forward<1||forward>5||side!==0||!clearSight(forward))continue;visible.push({e,forward});}return visible.sort((a,b)=>b.forward-a.forward);
}
function drawEnemySilhouetteFigure(ctx,cx,floorY,dist){
	const scaleTable={1:1,2:.64,3:.43,4:.30,5:.22},s=scaleTable[dist]||.2,bodyH=74*s,bodyW=32*s,headR=9*s,baseY=floorY-(dist-1)*5,headY=baseY-bodyH+headR*1.3;
	ctx.save();const glow=ctx.createRadialGradient(cx,headY+bodyH*.42,2,cx,headY+bodyH*.42,Math.max(14,bodyW*1.3));glow.addColorStop(0,'rgba(180,35,28,0.34)');glow.addColorStop(1,'rgba(180,35,28,0)');ctx.fillStyle=glow;ctx.beginPath();ctx.arc(cx,headY+bodyH*.42,Math.max(14,bodyW*1.3),0,Math.PI*2);ctx.fill();
	ctx.fillStyle='rgba(28,12,10,0.96)';ctx.strokeStyle=dist<=2?'#ff6958':'#c45142';ctx.lineWidth=Math.max(1,2.2*s);ctx.beginPath();ctx.arc(cx,headY,headR,0,Math.PI*2);ctx.fill();ctx.stroke();
	const shoulderY=headY+headR*1.25,hipY=baseY-bodyH*.27;ctx.beginPath();ctx.moveTo(cx-bodyW*.16,shoulderY);ctx.quadraticCurveTo(cx-bodyW*.55,shoulderY+bodyH*.08,cx-bodyW*.46,shoulderY+bodyH*.27);ctx.lineTo(cx-bodyW*.28,hipY);ctx.lineTo(cx-bodyW*.34,baseY);ctx.lineTo(cx-bodyW*.08,baseY);ctx.lineTo(cx,hipY+bodyH*.08);ctx.lineTo(cx+bodyW*.08,baseY);ctx.lineTo(cx+bodyW*.34,baseY);ctx.lineTo(cx+bodyW*.28,hipY);ctx.lineTo(cx+bodyW*.46,shoulderY+bodyH*.27);ctx.quadraticCurveTo(cx+bodyW*.55,shoulderY+bodyH*.08,cx+bodyW*.16,shoulderY);ctx.closePath();ctx.fill();ctx.stroke();
	const eyeY=headY-headR*.08,eyeGap=headR*.38;ctx.fillStyle=dist<=3?'#ff3b30':'#d95a4e';ctx.shadowColor='#ff3b30';ctx.shadowBlur=Math.max(2,5*s);ctx.beginPath();ctx.arc(cx-eyeGap,eyeY,Math.max(.8,1.7*s),0,Math.PI*2);ctx.arc(cx+eyeGap,eyeY,Math.max(.8,1.7*s),0,Math.PI*2);ctx.fill();
	if(dist<=2){ctx.shadowBlur=0;ctx.fillStyle='#ff7868';ctx.font=dist===1?'bold 11px monospace':'bold 10px monospace';ctx.textAlign='center';ctx.textBaseline='bottom';ctx.fillText('ENEMY',cx,baseY+15);}ctx.restore();
}
function drawEnemySilhouettes(){
let baseResult4;
baseStep4: {
const d=gameState.dungeon,canvas=document.getElementById('wireframe');if(gameState?.inBattle||!d||!canvas||!d.enemySymbols||d.isTreasureRoom){ baseResult4=(undefined); break baseStep4; }const ctx=canvas.getContext('2d'),cx=canvas.width/2,floorY=canvas.height*.82;getVisibleEnemySymbols(d).forEach(v=>drawEnemySilhouetteFigure(ctx,cx,floorY,v.forward));
}
const r=baseResult4;
livingDrawNpcs();return r;
}
