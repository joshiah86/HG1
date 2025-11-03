// game.js — Stronger difficulty tuning
// Goal: make 100 rounds extremely hard and prevent easy HP growth

const DIFFICULTY = {
  level: 1.9,                // stronger ramp
  chanceAdjust: -0.30,       // reduce success rates of chance cards
  passiveEveryRounds: 3,     // passive drain every 3 rounds
  passiveAmountBase: 4,      // base passive drain
  passiveScalingPer100: 12,  // scaling per 100 rounds
  healCooldownRounds: 20,    // long cooldown between heals
  maxHpCap: 100              // strict HP cap
};

let player = { score:0, hp:100, round:1, synergy:{FIRE:0,MIND:0,BLOOD:0,LUCK:0}, lastHealRound:-999 };
let bestScore = 0;

// Card definitions biased toward damaging options (weights set)
const cardDefinitions = [
  {name:"불타는 일격", score:35, hp:-14, synergy:"FIRE", weight:18},
  {name:"집중 명상", score:4, hp:4, synergy:"MIND", weight:2},
  {name:"도박사", score:0, hp:0, chance:0.38, scoreWin:90, hpLose:44, synergy:"LUCK", weight:6},
  {name:"계약서", score:14, hp:-16, synergy:"BLOOD", weight:16},
  {name:"행운의 부적", score:-2, hp:0, synergy:"LUCK", weight:6},
  {name:"냉정한 판단", score:0, hp:1, synergy:"MIND", weight:1}
];

function roundMultiplier(){
  return 1 + (player.round-1) * DIFFICULTY.level / 40 + Math.pow(player.round/160,2.4);
}

function updateHUD(){ const hud=document.getElementById('hud'); if(hud) hud.innerText = `Round: ${player.round} | Score: ${player.score} | HP: ${player.hp}`; const record=document.getElementById('record'); if(record) record.innerText = bestScore>0 && player.score>=bestScore?`New Record! ${bestScore}`:''; }

function checkGameOver(){ if(player.hp<=0){ alert(`Game Over! 최종 점수: ${player.score} (라운드:${player.round})`); resetGame(); } }

function weightedSample(n){ const pool=[]; cardDefinitions.forEach(c=>{ for(let i=0;i<c.weight;i++) pool.push(c); }); for(let i=pool.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [pool[i],pool[j]]=[pool[j],pool[i]]; } const chosen=[]; const used=new Set(); for(let i=0;i<pool.length && chosen.length<n;i++){ const id=pool[i].name; if(!used.has(id)){ chosen.push(pool[i]); used.add(id); } } return chosen; }

function selectCard(card,div){ player.lastChance = card.chance?card:null; if(div){ div.classList.add('highlight'); setTimeout(()=>div.classList.remove('highlight'),180); }
  const mult = roundMultiplier(); let hpChange=0;
  if(card.chance){ const base=card.chance||0; const adjusted = Math.max(0.02, base + DIFFICULTY.chanceAdjust - (player.round/380)); if(Math.random()<adjusted){ player.score += Math.floor(card.scoreWin * mult); } else { hpChange = -Math.max(30, Math.floor(card.hpLose*1.6 + player.round/8)); // heavy failure
      // big score penalty on failure to avoid easy score grind
      player.score = Math.max(0, player.score - Math.floor(player.round/4));
    }
  } else {
    player.score += Math.floor(card.score * mult);
    if(card.hp>0){ const canHeal = (player.round - player.lastHealRound) >= DIFFICULTY.healCooldownRounds; if(canHeal){ const baseHeal = Math.max(0, Math.floor(card.hp*0.35)); const roundPenalty = Math.floor(player.round/30); hpChange = Math.max(0, baseHeal - roundPenalty); player.lastHealRound = player.round; } else { hpChange = 0; } } else { const baseLoss = card.hp; hpChange = baseLoss - Math.floor(player.round/20); }
  
  if(card.synergy){ player.synergy[card.synergy] = (player.synergy[card.synergy]||0)+1; if(card.synergy==='BLOOD' && player.synergy.BLOOD>=2){ hpChange += -Math.min(16, player.synergy.BLOOD*4); } }

  if(hpChange>8) hpChange=8; if(hpChange<-80) hpChange=-80;
  player.hp += hpChange; if(player.hp>DIFFICULTY.maxHpCap) player.hp=DIFFICULTY.maxHpCap; if(player.hp<0) player.hp=0;
  player.round++; if(player.score>bestScore) bestScore=player.score;
  if((player.round % DIFFICULTY.passiveEveryRounds)===0){ const scale = Math.floor((player.round/100)*DIFFICULTY.passiveScalingPer100); const passive = DIFFICULTY.passiveAmountBase + scale; player.hp -= passive; if(player.hp<0) player.hp=0; }
  updateHUD(); if(player.round>100){ alert(`대단합니다 — ${player.round-1}라운드에 도달했습니다! (극히 드문 업적)`); }
  checkGameOver(); createCards(); }

function createCards(){ const cardsDiv=document.getElementById('cards'); if(!cardsDiv) return; cardsDiv.innerHTML=''; const roundCards = weightedSample(3); roundCards.forEach(card=>{ const div=document.createElement('div'); div.className='card'; div.style.backgroundColor=getCardColor(card.synergy); div.innerHTML = `<span class="name">${card.name}</span><span class="meta">${card.chance? 'Chance' : (card.hp>0?`HP+${card.hp}`:`HP${card.hp}`)}</span>`; div.tabIndex=0; div.onclick=()=>selectCard(card,div); div.onkeydown=(e)=>{ if(e.key==='Enter' || e.key===' '){ e.preventDefault(); selectCard(card,div); } }; cardsDiv.appendChild(div); }); }

function getCardColor(tag){ switch(tag){ case 'FIRE': return '#e74c3c'; case 'MIND': return '#2ecc71'; case 'BLOOD': return '#9b59b6'; case 'LUCK': return '#f1c40f'; default: return '#ccc'; } }

function resetGame(){ player = { score:0, hp:100, round:1, synergy:{FIRE:0,MIND:0,BLOOD:0,LUCK:0}, lastHealRound:-999 }; updateHUD(); createCards(); }

updateHUD(); createCards();