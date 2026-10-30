
// Older mobile browsers may refresh on a downward pull even with overscroll-behavior.
let pullStartX=0,pullStartY=0;
document.addEventListener('touchstart',event=>{
  if(event.touches.length!==1)return;
  pullStartX=event.touches[0].clientX;
  pullStartY=event.touches[0].clientY;
},{passive:true});
document.addEventListener('touchmove',event=>{
  if(event.touches.length!==1||!event.cancelable)return;
  const dx=event.touches[0].clientX-pullStartX;
  const dy=event.touches[0].clientY-pullStartY;
  if(dy<=8||dy<=Math.abs(dx))return;
  for(let element=event.target instanceof Element?event.target:null;element&&element!==document.documentElement;element=element.parentElement){
    if(element.scrollHeight>element.clientHeight+1&&element.scrollTop>0)return;
  }
  event.preventDefault();
},{passive:false});
