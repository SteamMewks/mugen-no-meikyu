
(function(global){
  'use strict';
  const bigrams=new Set(Array.isArray(global.MUGEN_JA_BIGRAMS)?global.MUGEN_JA_BIGRAMS:[]);
  const charFreq=(global.MUGEN_JA_CHAR_FREQ&&typeof global.MUGEN_JA_CHAR_FREQ==='object')?global.MUGEN_JA_CHAR_FREQ:{};
  const MAX_CHARS=12;

  function normalizeText(value){
    return String(value??'').normalize('NFKC').replace(/[\r\n\t]/g,' ').trim();
  }
  function toHiragana(value){
    return Array.from(value).map(ch=>{
      const cp=ch.codePointAt(0);
      return cp>=0x30A1&&cp<=0x30F6?String.fromCodePoint(cp-0x60):ch;
    }).join('');
  }
  function isJapaneseLikeChar(ch){
    const cp=ch.codePointAt(0);
    return (cp>=0x3040&&cp<=0x30FF)||(cp>=0x3400&&cp<=0x4DBF)||(cp>=0x4E00&&cp<=0x9FFF)||ch==='々'||ch==='〆'||ch==='ヶ'||ch==='ー'||ch==='・'||ch===' ';
  }
  function isKanaOnly(value){return /^[ぁ-ゖァ-ヺー]+$/u.test(value);}
  function startsWithNaturalReduplication(value){
    const chars=Array.from(value);if(chars.length<4)return false;
    return chars[0]===chars[2]&&chars[1]===chars[3];
  }
  function hasObviousKeyboardMash(value){
    const s=value.toLowerCase().replace(/\s+/g,'');
    return /(qwert|asdf|zxcv|hjkl|12345|23456|34567|45678|56789|09876)/.test(s);
  }
  function kanaBigramStats(value){
    const kana=Array.from(toHiragana(value));let total=0,hits=0;
    for(let i=0;i<kana.length-1;i++){total++;if(bigrams.has(kana[i]+kana[i+1]))hits++;}
    return{total,hits,ratio:total?hits/total:1};
  }
  function kanaCharGeometricFrequency(value){
    const kana=Array.from(toHiragana(value));
    if(!kana.length)return 0;
    let logs=0;
    for(const ch of kana)logs+=Math.log((Number(charFreq[ch])||0)+1);
    return Math.exp(logs/kana.length);
  }
  function segmentKana(value){
    if(typeof Intl==='undefined'||typeof Intl.Segmenter!=='function')return null;
    try{
      const segmenter=new Intl.Segmenter('ja',{granularity:'word'});
      return[...segmenter.segment(value)].filter(x=>x.isWordLike!==false).map(x=>Array.from(x.segment).length);
    }catch(_){return null;}
  }

  function validate(value){
    const normalized=normalizeText(value),chars=Array.from(normalized);
    if(!normalized||chars.length>MAX_CHARS)return{ok:false,reason:'length'};
    const compact=normalized.replace(/\s+/g,'');
    if(!compact)return{ok:false,reason:'empty'};
    if(hasObviousKeyboardMash(compact))return{ok:false,reason:'keyboard'};

    const latinDigits=(compact.match(/[A-Za-z0-9]/g)||[]).length;
    if(latinDigits>=3||/^[A-Za-z0-9]+$/.test(compact))return{ok:false,reason:'latin'};

    const compactChars=Array.from(compact);
    const jpCount=compactChars.filter(isJapaneseLikeChar).length;
    if(jpCount/Math.max(1,compactChars.length)<0.8)return{ok:false,reason:'chars'};
    if(/(.)\1{3,}/u.test(compact))return{ok:false,reason:'repeat'};

    if(isKanaOnly(compact)&&!startsWithNaturalReduplication(compact)){
      const kanaLen=compactChars.length;
      const stat=kanaBigramStats(compact);
      const segments=segmentKana(compact);
      if(segments&&kanaLen>=4&&segments.length>=kanaLen&&segments.every(n=>n===1)){
        // ICUの日本語分かち書きでも全て1文字扱いになる長めのかな列はかなり怪しい。
        if(kanaLen>=5)return{ok:false,reason:'kana-segmentation'};
        if(kanaLen===4&&stat.hits<=1&&kanaCharGeometricFrequency(compact)<180)return{ok:false,reason:'kana-segmentation-short'};
      }
      // Segmenterが無い環境でも、長いかな乱打だけは軽量2-gramで落とす。
      if(kanaLen>=5&&bigrams.size){
        if(stat.hits===0)return{ok:false,reason:'kana-random'};
        if(kanaLen>=8&&stat.ratio<0.14)return{ok:false,reason:'kana-random-long'};
      }
    }
    return{ok:true,normalized};
  }
  global.MugenWordInputFilter=Object.freeze({validate});
})(window);

