// game.js - Stronger difficulty tuning
// Goal: make 100 rounds extremely hard and prevent easy HP growth

// 1. 상수(Constants) 관리 강화: 모든 상수를 한 곳에 모아 관리
const GAME_CONSTANTS = {
  DIFFICULTY: {
    level: 1.9,                // stronger ramp
    chanceAdjust: -0.30,       // reduce success rates of chance cards
    passiveEveryRounds: 3,     // passive drain every 3 rounds
    passiveAmountBase: 4,      // base passive drain
    passiveScalingPer100: 12,  // scaling per 100 rounds
    healCooldownRounds: 20,    // long cooldown between heals
    maxHpCap: 100              // strict HP cap
  },
  CARD_DRAW_COUNT: 3,
  CARD_HIGHLIGHT_DURATION: 180, // milliseconds
  CHANCE_MIN_ADJUSTED: 0.02,
  CHANCE_FAILURE_HP_PENALTY_MULTIPLIER: 1.6,
  CHANCE_FAILURE_MIN_HP_LOSS: 30,
  CHANCE_FAILURE_SCORE_PENALTY_DIVISOR: 4,
  HEAL_BASE_MULTIPLIER: 0.35,
  HEAL_ROUND_PENALTY_DIVISOR: 30,
  HP_CHANGE_MAX_POSITIVE: 8,
  HP_CHANGE_MAX_NEGATIVE: -80,
  SYNERGY_BLOOD_THRESHOLD: 2,
  SYNERGY_BLOOD_HP_PENALTY_PER_STACK: 4,
  SYNERGY_BLOOD_HP_PENALTY_MAX: 16,
  ROUND_MULTIPLIER_BASE: 40,
  ROUND_MULTIPLIER_POWER_BASE: 160,
  ROUND_MULTIPLIER_POWER_EXPONENT: 2.4,
  GAME_END_ROUND_ALERT: 100
};

let player = {
  score: 0,
  hp: GAME_CONSTANTS.DIFFICULTY.maxHpCap, // 시작 HP는 최대 HP로 설정
  round: 1,
  synergy: { FIRE: 0, MIND: 0, BLOOD: 0, LUCK: 0 },
  lastHealRound: -GAME_CONSTANTS.DIFFICULTY.healCooldownRounds // 첫 힐 가능하도록 초기화
};
let bestScore = localStorage.getItem('bestScore') ? parseInt(localStorage.getItem('bestScore')) : 0; // 10. bestScore 로컬 스토리지에 저장

// Card definitions biased toward damaging options (weights set)
const cardDefinitions = [
  { name: "불타는 일격", score: 35, hp: -14, synergy: "FIRE", weight: 18, description: "강력한 공격! HP 손실이 있습니다." },
  { name: "집중 명상", score: 4, hp: 4, synergy: "MIND", weight: 2, description: "정신을 집중하여 약간의 HP를 회복합니다." },
  { name: "도박사", score: 0, hp: 0, chance: 0.38, scoreWin: 90, hpLose: 44, synergy: "LUCK", weight: 6, description: "운에 모든 것을 맡깁니다. 성공 시 큰 점수, 실패 시 막대한 피해!" },
  { name: "계약서", score: 14, hp: -16, synergy: "BLOOD", weight: 16, description: "강력한 점수를 얻지만, HP를 대가로 지불합니다." },
  { name: "행운의 부적", score: -2, hp: 0, synergy: "LUCK", weight: 6, description: "점수가 약간 줄지만, 운이 따르기를 바랍니다." },
  { name: "냉정한 판단", score: 0, hp: 1, synergy: "MIND", weight: 1, description: "냉정한 판단으로 아주 약간의 HP를 회복합니다." }
];

// DOM 요소 캐싱
const hudElement = document.getElementById('hud');
const recordElement = document.getElementById('record');
const cardsElement = document.getElementById('cards');

// 2. 함수 분리 및 모듈화: 라운드 승수 계산
function calculateRoundMultiplier() {
  const diff = GAME_CONSTANTS.DIFFICULTY;
  return 1 + (player.round - 1) * diff.level / GAME_CONSTANTS.ROUND_MULTIPLIER_BASE +
         Math.pow(player.round / GAME_CONSTANTS.ROUND_MULTIPLIER_POWER_BASE, GAME_CONSTANTS.ROUND_MULTIPLIER_POWER_EXPONENT);
}

// 3. UI 업데이트 로직 중앙화
function updateHUD() {
  if (hudElement) {
    hudElement.innerHTML = `
      <span>라운드: ${player.round}</span>
      <span>점수: ${player.score}</span>
      <span>HP: ${player.hp}/${GAME_CONSTANTS.DIFFICULTY.maxHpCap}</span>
    `;
  }
  if (recordElement) {
    if (player.score >= bestScore && bestScore > 0) {
      recordElement.innerText = `새로운 기록! ${bestScore}`;
    } else if (bestScore > 0) {
      recordElement.innerText = `최고 기록: ${bestScore}`;
    } else {
      recordElement.innerText = '';
    }
  }
}

// 게임 오버 체크
function checkGameOver() {
  if (player.hp <= 0) {
    alert(`게임 오버! 최종 점수: ${player.score} (라운드: ${player.round})`);
    resetGame();
  }
}

// 가중치 기반 카드 샘플링 (Set을 사용하여 중복 방지 로직 개선)
function weightedSample(n) {
  const pool = [];
  cardDefinitions.forEach(c => {
    for (let i = 0; i < c.weight; i++) {
      pool.push(c);
    }
  });

  // Fisher-Yates shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const chosen = [];
  const usedNames = new Set(); // 카드의 name 속성으로 중복을 확인
  for (let i = 0; i < pool.length && chosen.length < n; i++) {
    const cardName = pool[i].name;
    if (!usedNames.has(cardName)) {
      chosen.push(pool[i]);
      usedNames.add(cardName);
    }
  }
  return chosen;
}

// 2. 함수 분리 및 모듈화: 찬스 카드 처리
function handleChanceCard(card, multiplier) {
  const diff = GAME_CONSTANTS.DIFFICULTY;
  const baseChance = card.chance || 0;
  const adjustedChance = Math.max(GAME_CONSTANTS.CHANCE_MIN_ADJUSTED, baseChance + diff.chanceAdjust - (player.round / 380));

  if (Math.random() < adjustedChance) {
    player.score += Math.floor(card.scoreWin * multiplier);
    return 0; // HP 변화 없음
  } else {
    // 7. 매직 넘버 제거 및 로직 명확화
    const hpLoss = -Math.max(GAME_CONSTANTS.CHANCE_FAILURE_MIN_HP_LOSS,
                             Math.floor(card.hpLose * GAME_CONSTANTS.CHANCE_FAILURE_HP_PENALTY_MULTIPLIER + player.round / 8));
    player.score = Math.max(0, player.score - Math.floor(player.round / GAME_CONSTANTS.CHANCE_FAILURE_SCORE_PENALTY_DIVISOR));
    return hpLoss;
  }
}

// 2. 함수 분리 및 모듈화: 일반 카드 효과 적용
function applyNormalCardEffects(card, multiplier) {
  let hpChange = 0;
  player.score += Math.floor(card.score * multiplier);

  // 9. HP 회복 로직 개선
  if (card.hp > 0) {
    const canHeal = (player.round - player.lastHealRound) >= GAME_CONSTANTS.DIFFICULTY.healCooldownRounds;
    if (canHeal) {
      const baseHeal = Math.max(0, Math.floor(card.hp * GAME_CONSTANTS.HEAL_BASE_MULTIPLIER));
      const roundPenalty = Math.floor(player.round / GAME_CONSTANTS.HEAL_ROUND_PENALTY_DIVISOR);
      hpChange = Math.max(0, baseHeal - roundPenalty);
      player.lastHealRound = player.round;
    } else {
      hpChange = 0; // 쿨다운 중에는 회복 없음
    }
  } else {
    hpChange = card.hp - Math.floor(player.round / 20); // HP 손실은 라운드에 따라 증가
  }
  return hpChange;
}

// 8. 시너지 계산 로직 분리
function applySynergyEffects(card, currentHpChange) {
  let hpEffect = currentHpChange;
  if (card.synergy) {
    player.synergy[card.synergy] = (player.synergy[card.synergy] || 0) + 1;

    if (card.synergy === 'BLOOD' && player.synergy.BLOOD >= GAME_CONSTANTS.SYNERGY_BLOOD_THRESHOLD) {
      // 혈액 시너지: 쌓일수록 HP 손실 증가
      hpEffect += -Math.min(GAME_CONSTANTS.SYNERGY_BLOOD_HP_PENALTY_MAX,
                            player.synergy.BLOOD * GAME_CONSTANTS.SYNERGY_BLOOD_HP_PENALTY_PER_STACK);
    }
    // 다른 시너지 효과도 여기에 추가할 수 있습니다.
  }
  return hpEffect;
}


// 카드 선택 및 효과 적용
function selectCard(card, div) {
  if (div) { // 시각적 피드백
    div.classList.add('highlight');
    setTimeout(() => div.classList.remove('highlight'), GAME_CONSTANTS.CARD_HIGHLIGHT_DURATION);
  }

  const multiplier = calculateRoundMultiplier();
  let finalHpChange = 0;

  if (card.chance) {
    finalHpChange = handleChanceCard(card, multiplier);
  } else {
    finalHpChange = applyNormalCardEffects(card, multiplier);
  }

  finalHpChange = applySynergyEffects(card, finalHpChange);

  // HP 변화량 상한/하한 적용 (과도한 회복/손실 방지)
  finalHpChange = Math.min(GAME_CONSTANTS.HP_CHANGE_MAX_POSITIVE, finalHpChange);
  finalHpChange = Math.max(GAME_CONSTANTS.HP_CHANGE_MAX_NEGATIVE, finalHpChange);

  player.hp += finalHpChange;
  player.hp = Math.min(player.hp, GAME_CONSTANTS.DIFFICULTY.maxHpCap); // 최대 HP 제한
  player.hp = Math.max(0, player.hp); // HP는 0 미만이 될 수 없음

  player.round++;
  if (player.score > bestScore) {
    bestScore = player.score;
    localStorage.setItem('bestScore', bestScore); // 10. 최고 점수 저장
  }

  // 패시브 HP 감소 적용
  if ((player.round % GAME_CONSTANTS.DIFFICULTY.passiveEveryRounds) === 0) {
    const scale = Math.floor((player.round / 100) * GAME_CONSTANTS.DIFFICULTY.passiveScalingPer100);
    const passiveDamage = GAME_CONSTANTS.DIFFICULTY.passiveAmountBase + scale;
    player.hp -= passiveDamage;
    player.hp = Math.max(0, player.hp); // HP는 0 미만이 될 수 없음
  }

  updateHUD();
  checkGameOver();

  if (player.round > GAME_CONSTANTS.GAME_END_ROUND_ALERT) {
    alert(`대단합니다 — ${player.round - 1}라운드에 도달했습니다! (극히 드문 업적)`);
    // 이 시점에서 게임을 계속 진행할지, 리셋할지 등을 결정할 수 있습니다.
    // 현재는 그냥 알림만 뜨고 게임은 계속 진행됩니다.
  }

  createCards(); // 다음 라운드 카드 생성
}

// 카드 색상 정의
function getCardColor(tag) {
  switch (tag) {
    case 'FIRE': return '#e74c3c'; // 불
    case 'MIND': return '#2ecc71'; // 정신
    case 'BLOOD': return '#9b59b6'; // 피
    case 'LUCK': return '#f1c40f'; // 행운
    default: return '#ccc'; // 기본
  }
}

// 카드 생성 (4. 이벤트 리스너 개선)
function createCards() {
  if (!cardsElement) return;
  cardsElement.innerHTML = ''; // 기존 카드 제거

  const roundCards = weightedSample(GAME_CONSTANTS.CARD_DRAW_COUNT);
  roundCards.forEach(card => {
    const div = document.createElement('div');
    div.className = 'card';
    div.style.backgroundColor = getCardColor(card.synergy);
    // 11. 카드 메타 정보 상세화
    let metaText = '';
    if (card.chance) {
      metaText = `성공 시 +${card.scoreWin}점, 실패 시 HP-${card.hpLose} (${Math.round(card.chance * 100)}%)`;
    } else {
      metaText = `점수: ${card.score > 0 ? '+' : ''}${card.score}, HP: ${card.hp > 0 ? '+' : ''}${card.hp}`;
    }

    div.innerHTML = `
      <span class="name">${card.name}</span>
      <span class="meta">${metaText}</span>
      <span class="description">${card.description || ''}</span>
    `;
    div.tabIndex = 0; // 접근성을 위해 tabIndex 추가

    // addEventListener 사용
    div.addEventListener('click', () => selectCard(card, div));
    div.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectCard(card, div);
      }
    });
    cardsElement.appendChild(div);
  });
}

// 게임 리셋
function resetGame() {
  player = {
    score: 0,
    hp: GAME_CONSTANTS.DIFFICULTY.maxHpCap,
    round: 1,
    synergy: { FIRE: 0, MIND: 0, BLOOD: 0, LUCK: 0 },
    lastHealRound: -GAME_CONSTANTS.DIFFICULTY.healCooldownRounds
  };
  updateHUD();
  createCards();
}

// 게임 초기화
updateHUD();
createCards();
