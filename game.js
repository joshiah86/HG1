// 플레이어 상태
let player = {score:0, hp:100, round:1, synergy:{FIRE:0, MIND:0, BLOOD:0, LUCK:0}, lastChance:null};
let bestScore = 0;

// 카드 정의
const cards = [
  {name:"불타는 일격",score:20,hp:-5,synergy:"FIRE"},
  {name:"집중 명상",score:10,hp:5,synergy:"MIND"},
  {name:"도박사",score:0,hp:0,chance:0.5,scoreWin:50,hpLose:20,synergy:"LUCK"},
  {name:"계약서",score:5,hp:-5,synergy:"BLOOD"},
  {name:"행운의 부적",score:-5,hp:0,synergy:"LUCK"},
  {name:"냉정한 판단",score:0,hp:5,synergy:"MIND"}
];

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

// HUD 업데이트
function updateHUD(){
  document.getElementById('hud').innerText = `Round: ${player.round} | Score: ${player.score} | HP: ${player.hp}`;
  document.getElementById('record').innerText = bestScore > 0 && player.score >= bestScore ? `New Record! ${bestScore}` : '';
}

// 게임 오버 체크
function checkGameOver(){
  if(player.hp <= 0){
    alert(`Game Over! 최종 점수: ${player.score}`);
    resetGame();
  }
}

// 카드 선택 처리
function selectCard(card, div){
  player.lastChance = card.chance ? card : null;
  div.classList.add('highlight');
  setTimeout(()=>div.classList.remove('highlight'), 300);

  const difficultyFactor = 1 + player.round/50;
  let hpChange = 0;

  if(card.chance){
    if(Math.random() < card.chance){
      player.score += Math.floor(card.scoreWin * difficultyFactor);
    } else {
      hpChange = -Math.max(20, Math.floor(card.hpLose * 1.2));
    }
  } else {
    player.score += Math.floor(card.score * difficultyFactor);
    hpChange = Math.min(card.hp,10); 
  }

  if(card.synergy){
    player.synergy[card.synergy] = (player.synergy[card.synergy]||0)+1;
    if(player.synergy.BLOOD >=2) hpChange += Math.min(5,10);
  }

  if(hpChange > 10) hpChange = 10;
  if(hpChange < -20) hpChange = -20;
  player.hp += hpChange;
  if(player.hp <0) player.hp=0;

  player.round++;
  if(player.score > bestScore) bestScore = player.score;
  updateHUD();
  checkGameOver();
  createCards();
}

// 카드 3장 생성
function createCards(){
  const cardsDiv = document.getElementById('cards');
  cardsDiv.innerHTML = '';
  const roundCards = cards.sort(()=>0.5-Math.random()).slice(0,3);

  roundCards.forEach(card=>{
    const div = document.createElement('div');
    div.className = 'card';
    div.style.backgroundColor = getCardColor(card.synergy);
    div.innerText = card.name;
    div.onclick = () => selectCard(card, div);
    cardsDiv.appendChild(div);
  });
}

// 게임 초기화
function resetGame(){
  player = {score:0, hp:100, round:1, synergy:{FIRE:0, MIND:0, BLOOD:0, LUCK:0}, lastChance:null};
  updateHUD();
  createCards();
}

// 게임 시작
updateHUD();
createCards();