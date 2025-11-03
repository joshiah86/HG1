// game.js - Rebalanced difficulty tuning
// Goal: 30-40 rounds for casuals, 60 for skilled, 80 for masters, 100 for perfect + luck

const GAME_CONSTANTS = {
  DIFFICULTY: {
    level: 0.8,                 // 라운드별 난이도 증가폭 완화 (이전 1.9)
    chanceAdjust: 0.08,         // 도박 카드 성공률 증가 (이전 -0.30)
    passiveEveryRounds: 5,      // 패시브 HP 감소 주기 증가 (이전 3)
    passiveAmountBase: 2,       // 기본 패시브 HP 감소량 감소 (이전 4)
    passiveScalingPer100: 5,    // 100라운드당 패시브 스케일링 감소 (이전 12)
    healCooldownRounds: 10,     // HP 회복 쿨다운 감소 (이전 20)
    maxHpCap: 100               // HP 상한은 유지
  },
  CARD_DRAW_COUNT: 3,
  CARD_HIGHLIGHT_DURATION: 180, // milliseconds
  CHANCE_MIN_ADJUSTED: 0.05,    // 최소 도박 성공 확률
  CHANCE_FAILURE_HP_PENALTY_MULTIPLIER: 1.2, // 도박 실패 HP 패널티 감소 (이전 1.6)
  CHANCE_FAILURE_MIN_HP_LOSS: 20, // 도박 실패 최소 HP 손실 감소 (이전 30)
  CHANCE_FAILURE_SCORE_PENALTY_DIVISOR: 8, // 도박 실패 시 점수 패널티 완화 (이전 4)
  HEAL_BASE_MULTIPLIER: 0.6,    // 힐 카드 기본 회복량 증가 (이전 0.35)
  HEAL_ROUND_PENALTY_DIVISOR: 40, // 힐 라운드 패널티 완화 (이전 30)
  HP_CHANGE_MAX_POSITIVE: 15,   // HP 회복 최대치 증가 (이전 8)
  HP_CHANGE_MAX_NEGATIVE: -50,  // HP 손실 최소치 완화 (이전 -80)
  SYNERGY_BLOOD_THRESHOLD: 2,
  SYNERGY_BLOOD_HP_PENALTY_PER_STACK: 3, // 혈액 시너지 페널티 감소 (이전 4)
  SYNERGY_BLOOD_HP_PENALTY_MAX: 12,      // 혈액 시너지 페널티 최대치 감소 (이전 16)
  ROUND_MULTIPLIER_BASE: 50,    // 라운드 승수 기본값 조정 (이전 40)
  ROUND_MULTIPLIER_POWER_BASE: 200, // 라운드 승수 제곱 기준 조정 (이전 160)
  ROUND_MULTIPLIER_POWER_EXPONENT: 2.0, // 라운드 승수 제곱 지수 조정 (이전 2.4)
  GAME_END_ROUND_ALERT: 100
};

let player = {
  score: 0,
  hp: GAME_CONSTANTS.DIFFICULTY.maxHpCap,
  round: 1,
  synergy: { FIRE: 0, MIND: 0, BLOOD: 0, LUCK: 0 },
  lastHealRound: -GAME_CONSTANTS.DIFFICULTY.healCooldownRounds
};
let bestScore = localStorage.getItem('bestScore') ? parseInt(localStorage.getItem('bestScore')) : 0;

// Card definitions rebalanced
const cardDefinitions = [
  // 불타는 일격: HP 손실 감소, 점수 유지
  { name: "불타는 일격", score: 35, hp: -10, synergy: "FIRE", weight: 15, description: "강력한 공격! 약간의 HP 손실이 있습니다." },
  // 집중 명상: HP 회복량 증가, weight 증가하여 더 자주 나오게
  { name: "집중 명상", score: 4, hp: 6, synergy: "MIND", weight: 8, description: "정신을 집중하여 HP를 회복합니다." },
  // 도박사: HP 손실 감소, 성공률 증가, weight 증가
  { name: "도박사", score: 0, hp: 0, chance: 0.45, scoreWin: 90, hpLose: 30, synergy: "LUCK", weight: 10, description: "운에 모든 것을 맡깁니다. 성공 시 큰 점수, 실패 시 큰 피해!" },
  // 계약서: HP 손실 감소, 점수 유지
  { name: "계약서", score: 14, hp: -12, synergy: "BLOOD", weight: 12, description: "강력한 점수를 얻지만, HP를 대가로 지불합니다." },
  // 행운의 부적: 점수 페널티 감소, weight 증가
  { name: "행운의 부적", score: 0, hp: 0, synergy: "LUCK", weight: 7, description: "점수 변화는 없지만, 다음 도박에 행운을 가져올지도 모릅니다." }, // 설명 변경
  // 냉정한 판단: HP 회복량 증가, weight 증가
  { name: "냉정한 판단", score: 0, hp: 3, synergy: "MIND", weight: 5, description: "냉정한 판단으로 약간의 HP를 회복합니다." }
];

// DOM 요소 캐싱 (이전과 동일)
const hudElement = document.getElementById('hud');
const recordElement = document.getElementById('record');
const cardsElement = document.getElementById('cards');

function calculateRoundMultiplier() {
  const diff = GAME_CONSTANTS.DIFFICULTY;
  // 라운드 승수 계산식 완화
  return 1 + (player.round - 1) * diff.level / GAME_CONSTANTS.ROUND_MULTIPLIER_BASE +
         Math.pow(player.round / GAME_CONSTANTS.ROUND_MULTIPLIER_POWER_BASE, GAME_CONSTANTS.ROUND_MULTIPLIER_POWER_EXPONENT);
}

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

function checkGameOver() {
  if (player.hp <= 0) {
    alert(`게임 오버! 최종 점수: ${player.score} (라운드: ${player.round})`);
    resetGame();
  }
}

function weightedSample(n) {
  const pool = [];
  cardDefinitions.forEach(c => {
    for (let i = 0; i < c.weight; i++) {
      pool.push(c);
    }
  });

  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const chosen = [];
  const usedNames = new Set();
  for (let i = 0; i < pool.length && chosen.length < n; i++) {
    const cardName = pool[i].name;
    if (!usedNames.has(cardName)) {
      chosen.push(pool[i]);
      usedNames.add(cardName);
    }
  }
  return chosen;
}

function handleChanceCard(card, multiplier) {
  const diff = GAME_CONSTANTS.DIFFICULTY;
  const baseChance = card.chance || 0;
  // 도박 성공 확률 계산식도 완화
  const adjustedChance = Math.max(GAME_CONSTANTS.CHANCE_MIN_ADJUSTED, baseChance + diff.chanceAdjust - (player.round / 500)); // 라운드 영향 감소

  if (Math.random() < adjustedChance) {
    player.score += Math.floor(card.scoreWin * multiplier);
    return 0; // HP 변화 없음
  } else {
    // 도박 실패 시 HP 손실 및 점수 페널티 완화
    const hpLoss = -Math.max(GAME_CONSTANTS.CHANCE_FAILURE_MIN_HP_LOSS,
                             Math.floor(card.hpLose * GAME_CONSTANTS.CHANCE_FAILURE_HP_PENALTY_MULTIPLIER + player.round / 10)); // 라운드 영향 감소
    player.score = Math.max(0, player.score - Math.floor(player.round / GAME_CONSTANTS.CHANCE_FAILURE_SCORE_PENALTY_DIVISOR));
    return hpLoss;
  }
}

function applyNormalCardEffects(card, multiplier) {
  let hpChange = 0;
  player.score += Math.floor(card.score * multiplier);

  if (card.hp > 0) {
    const canHeal = (player.round - player.lastHealRound) >= GAME_CONSTANTS.DIFFICULTY.healCooldownRounds;
    if (canHeal) {
      // 힐량 증가 및 라운드 페널티 완화
      const baseHeal = Math.max(0, Math.floor(card.hp * GAME_CONSTANTS.HEAL_BASE_MULTIPLIER));
      const roundPenalty = Math.floor(player.round / GAME_CONSTANTS.HEAL_ROUND_PENALTY_DIVISOR);
      hpChange = Math.max(0, baseHeal - roundPenalty);
      player.lastHealRound = player.round;
    } else {
      hpChange = 0;
    }
  } else {
    // HP 손실 라운드 페널티 완화
    hpChange = card.hp - Math.floor(player.round / 30); // 이전 20
  }
  return hpChange;
}

function applySynergyEffects(card, currentHpChange) {
  let hpEffect = currentHpChange;
  if (card.synergy) {
    player.synergy[card.synergy] = (player.synergy[card.synergy] || 0) + 1;

    if (card.synergy === 'BLOOD' && player.synergy.BLOOD >= GAME_CONSTANTS.SYNERGY_BLOOD_THRESHOLD) {
      // 혈액 시너지 페널티 완화
      hpEffect += -Math.min(GAME_CONSTANTS.SYNERGY_BLOOD_HP_PENALTY_MAX,
                            player.synergy.BLOOD * GAME_CONSTANTS.SYNERGY_BLOOD_HP_PENALTY_PER_STACK);
    }
  }
  return hpEffect;
}

function selectCard(card, div) {
  if (div) {
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

  // HP 변화량 상한/하한 재조정
  finalHpChange = Math.min(GAME_CONSTANTS.HP_CHANGE_MAX_POSITIVE, finalHpChange);
  finalHpChange = Math.max(GAME_CONSTANTS.HP_CHANGE_MAX_NEGATIVE, finalHpChange);

  player.hp += finalHpChange;
  player.hp = Math.min(player.hp, GAME_CONSTANTS.DIFFICULTY.maxHpCap);
  player.hp = Math.max(0, player.hp);

  player.round++;
  if (player.score > bestScore) {
    bestScore = player.score;
    localStorage.setItem('bestScore', bestScore);
  }

  // 패시브 HP 감소 적용 완화
  if ((player.round % GAME_CONSTANTS.DIFFICULTY.passiveEveryRounds) === 0) {
    const scale = Math.floor((player.round / 100) * GAME_CONSTANTS.DIFFICULTY.passiveScalingPer100);
    const passiveDamage = GAME_CONSTANTS.DIFFICULTY.passiveAmountBase + scale;
    player.hp -= passiveDamage;
    player.hp = Math.max(0, player.hp);
  }

  updateHUD();
  checkGameOver();

  if (player.round > GAME_CONSTANTS.GAME_END_ROUND_ALERT) {
    alert(`대단합니다 — ${player.round - 1}라운드에 도달했습니다! (극히 드문 업적)`);
  }

  createCards();
}

function getCardColor(tag) {
  switch (tag) {
    case 'FIRE': return '#e74c3c';
    case 'MIND': return '#2ecc71';
    case 'BLOOD': return '#9b59b6';
    case 'LUCK': return '#f1c40f';
    default: return '#ccc';
  }
}

function createCards() {
  if (!cardsElement) return;
  cardsElement.innerHTML = '';

  const roundCards = weightedSample(GAME_CONSTANTS.CARD_DRAW_COUNT);
  roundCards.forEach(card => {
    const div = document.createElement('div');
    div.className = 'card';
    div.style.backgroundColor = getCardColor(card.synergy);
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
    div.tabIndex = 0;

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

updateHUD();
createCards();
