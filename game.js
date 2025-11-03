// 게임 상태
let score = 0;
let hp = 100;
let round = 1;
let bestScore = 0;
let playerSynergy = {FIRE:0, MIND:0, BLOOD:0, LUCK:0};
let lastChanceCard = null;

// 카드 풀
const baseCards = [
  {name:"불타는 일격",score:20,hp:-5,synergy:"FIRE",tier:1},
  {name:"집중 명상",score:10,hp:5,synergy:"MIND",tier:1},
  {name:"도박사",score:0,hp:0,chance:0.5,scoreWin:50,hpLose:20,synergy:"LUCK",tier:2},
  {name:"계약서",score:5,hp:-5,synergy:"BLOOD",tier:1},
  {name:"안전 제어",score:-5,hp:0,synergy:"MIND",tier:1},
  {name:"화염 증폭기",score:15,hp:0,synergy:"FIRE",tier:2},
  {name:"생명 흡수",score:20,hp:5,synergy:"BLOOD",tier:2},
  {name:"불안한 거래",score:0,hp:0,chance:0.5,scoreWin:80,hpLose:25,synergy:"LUCK",tier:3},
  {name:"행운의 부적",score:-5,hp:0,synergy:"LUCK",tier:1},
  {name:"냉정한 판단",score:0,hp:5,synergy:"MIND",tier:2}
];

// HUD 업데이트
function updateHUD(){
  document.getElementById('hud').innerText = `Round: ${round} / Score: ${score} / HP: ${hp}`;
  document.getElementById('record').innerText = bestScore > 0 ? `New Record: ${bestScore}` : '';
}

// 카드 색상
function getCardColor(tag){
  switch(tag){
    case "FIRE": return "#e74c3c";
    case "MIND": return "#2ecc71";
    case "BLOOD": return "#9b59b6";
    case "LUCK": return "#f1c40f";
    default: return "#ccc";
  }
}

// 난이도 카드 필터
function getAvailableCards(){
  const maxTier = Math.min(3, Math.ceil(round/30));
  return baseCards.filter(c => c.tier <= maxTier);
}

// 카드 3장 생성
function createCards(){
  const cardsDiv = document.getElementById('cards');
  cardsDiv.innerHTML = '';
  const pool = getAvailableCards().sort(()=>0.5-Math.random());
  const roundCards = pool.slice(0,3);

  roundCards.forEach(card=>{
    const div = document.createElement('div');
    div.className = 'card';
    div.style.backgroundColor = getCardColor(card.synergy);
    div.innerText = card.name;
    div.onclick = () => selectCard(card, div);
    cardsDiv.appendChild(div);
  });
}

// 시너지 보너스 적용 (한 라운드 HP 증가 제한)
function applySynergy(){
  const maxHpBonusPerRound = 10; // 한 라운드 최대 HP 증가 제한
  let bonusHP = 0;

  if(playerSynergy.FIRE >= 2) score += Math.min(50, 20 + Math.floor(round/10));
  if(playerSynergy.BLOOD >= 2) bonusHP += Math.min(5 + Math.floor(round/15), maxHpBonusPerRound);
  if(playerSynergy.LUCK >= 2 && lastChanceCard) lastChanceCard.chance = Math.min(0.9, lastChanceCard.chance + 0.05*Math.floor(round/20));

  hp += bonusHP;
}

// 카드 선택 처리
function selectCard(card, div){
  lastChanceCard = card.chance ? card : null;

  // 카드 클릭 깜빡임
  div.classList.add('highlight');
  setTimeout(()=>div.classList.remove('highlight'), 500);

  const difficultyFactor = 1 + round/50;
  let hpChange = 0;

  if(card.chance){
    if(Math.random() < card.chance){
      score += Math.floor(card.scoreWin * difficultyFactor);
    } else {
      hpChange = -Math.max(20, Math.floor(card.hpLose * 1.2)); // 실패 시 HP 감소 강화
    }
  } else {
    score += Math.floor(card.score * difficultyFactor);
    hpChange = card.hp;
  }

  // HP 증가 제한 적용
  const maxHpChangePerRound = 10;
  if(hpChange > maxHpChangePerRound) hpChange = maxHpChangePerRound;
  if(hpChange < -maxHpChangePerRound) hpChange = -maxHpChangePerRound;
  hp += hpChange;

  if(card.synergy) playerSynergy[card.synergy] = (playerSynergy[card.synergy]||0)+1;
  applySynergy();

  if(hp < 0) hp = 0;

  round++;
  if(score > bestScore) bestScore = score;
  updateHUD();

  if(hp <= 0){
    alert(`Game Over! 최종 점수: ${score}`);
    resetGame();
  } else {
    createCards();
  }
}

// 게임 초기화
function resetGame(){
  score = 0; hp = 100; round = 1;
  playerSynergy = {FIRE:0, MIND:0, BLOOD:0, LUCK:0};
  lastChanceCard = null;
  updateHUD();
  createCards();
}

// 초기화
updateHUD();
createCards();
