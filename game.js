// game.js - Rebalanced difficulty with more diverse choices and less focus on pure HP drain

const GAME_CONSTANTS = {
  DIFFICULTY: {
    level: 0.6,                 // 라운드별 난이도 증가폭 대폭 완화 (이전 0.8)
    chanceAdjust: 0.12,         // 도박 카드 성공률 증가 (이전 0.08)
    passiveEveryRounds: 7,      // 패시브 HP 감소 주기 증가 (이전 5)
    passiveAmountBase: 1,       // 기본 패시브 HP 감소량 최소화 (이전 2)
    passiveScalingPer100: 3,    // 100라운드당 패시브 스케일링 최소화 (이전 5)
    healCooldownRounds: 7,      // HP 회복 쿨다운 감소 (이전 10)
    maxHpCap: 100               // HP 상한은 유지
  },
  CARD_DRAW_COUNT: 3,
  CARD_HIGHLIGHT_DURATION: 180, // milliseconds
  CHANCE_MIN_ADJUSTED: 0.10,    // 최소 도박 성공 확률 증가
  CHANCE_FAILURE_HP_PENALTY_MULTIPLIER: 1.0, // 도박 실패 HP 패널티 더 감소 (이전 1.2)
  CHANCE_FAILURE_MIN_HP_LOSS: 15, // 도박 실패 최소 HP 손실 감소 (이전 20)
  CHANCE_FAILURE_SCORE_PENALTY_DIVISOR: 10, // 도박 실패 시 점수 패널티 완화 (이전 8)
  HEAL_BASE_MULTIPLIER: 0.8,    // 힐 카드 기본 회복량 증가 (이전 0.6)
  HEAL_ROUND_PENALTY_DIVISOR: 50, // 힐 라운드 패널티 더 완화 (이전 40)
  HP_CHANGE_MAX_POSITIVE: 20,   // HP 회복 최대치 증가 (이전 15)
  HP_CHANGE_MAX_NEGATIVE: -40,  // HP 손실 최소치 더 완화 (이전 -50)
  SYNERGY_BLOOD_THRESHOLD: 2,
  SYNERGY_BLOOD_HP_PENALTY_PER_STACK: 2, // 혈액 시너지 페널티 감소 (이전 3)
  SYNERGY_BLOOD_HP_PENALTY_MAX: 10,      // 혈액 시너지 페널티 최대치 감소 (이전 12)
  ROUND_MULTIPLIER_BASE: 60,    // 라운드 승수 기본값 조정 (이전 50)
  ROUND_MULTIPLIER_POWER_BASE: 250, // 라운드 승수 제곱 기준 조정 (이전 200)
  ROUND_MULTIPLIER_POWER_EXPONENT: 1.8, // 라운드 승수 제곱 지수 조정 (이전 2.0)
  GAME_END_ROUND_ALERT: 100
};

let player = {
  score: 0,
  hp: GAME_CONSTANTS.DIFFICULTY.maxHpCap,
  round: 1,
  synergy: { FIRE: 0, MIND: 0, BLOOD: 0, LUCK: 0 },
  lastHealRound: -GAME_CONSTANTS.DIFFICULTY.healCooldownRounds,
  tempDamageReduction: 0, // 다음 라운드에 받는 피해 감소 (새로운 상태)
  nextCardBoost: null,    // 다음 카드 드로우에 영향 (새로운 상태)
  passiveImmunityRounds: 0 // 패시브 피해 면역 라운드 수
};
let bestScore = localStorage.getItem('bestScore') ? parseInt(localStorage.getItem('bestScore')) : 0;

// Card definitions rebalanced with more diverse options
const cardDefinitions = [
  // 1. 불타는 일격 (FIRE): 점수 획득, 적절한 HP 손실.
  { name: "불타는 일격", score: 40, hp: -8, synergy: "FIRE", weight: 12, description: "강력한 일격! HP가 약간 감소합니다." },

  // 2. 집중 명상 (MIND): 안정적인 HP 회복.
  { name: "집중 명상", score: 8, hp: 10, synergy: "MIND", weight: 10, description: "정신을 집중하여 상당한 HP를 회복합니다." },

  // 3. 도박사 (LUCK): 위험을 줄이고 보상은 유지. 여전히 고수익-고위험 선택지.
  { name: "도박사", score: 0, hp: 0, chance: 0.55, scoreWin: 100, hpLose: 25, synergy: "LUCK", weight: 8, description: "성공 시 막대한 점수, 실패 시 HP 손실! 운을 시험합니다." },

  // 4. 계약서 (BLOOD): 높은 점수, 중간 HP 손실.
  { name: "계약서", score: 25, hp: -15, synergy: "BLOOD", weight: 10, description: "높은 점수를 얻지만, HP를 대가로 지불합니다." },

  // 5. 행운의 부적 (LUCK): 다음 도박 카드 성공률 증가 (시너지)
  { name: "행운의 부적", score: 5, hp: 0, synergy: "LUCK", weight: 7, description: "약간의 점수와 함께, 다음 도박의 성공률을 높입니다." },

  // 6. 냉정한 판단 (MIND): 소량의 HP 회복, 점수도 얻을 수 있음.
  { name: "냉정한 판단", score: 10, hp: 5, synergy: "MIND", weight: 7, description: "냉정한 판단으로 약간의 HP와 점수를 얻습니다." },

  // --- 새로운 카드 ---

  // 7. 방어 태세 (MIND): 다음 라운드 피해 감소 (새로운 메커니즘)
  { name: "방어 태세", score: -5, hp: 0, synergy: "MIND", weight: 6, description: "점수가 약간 줄지만, 다음 라운드에 받는 피해를 크게 줄입니다.", effect: "damage_reduction", effectAmount: 0.5 },

  // 8. 피의 대가 (BLOOD): 높은 점수, 큰 HP 손실, 다음 라운드 BLOOD 카드 확률 증가 (새로운 메커니즘)
  { name: "피의 대가", score: 50, hp: -25, synergy: "BLOOD", weight: 5, description: "매우 높은 점수를 얻지만, 막대한 HP 손실과 함께 다음 라운드에 피 카드 확률이 높아집니다.", effect: "next_card_boost", boostType: "BLOOD", boostAmount: 1.5 },

  // 9. 시간 왜곡 (MIND): 패시브 HP 감소 턴 초기화 또는 면역 (새로운 메커니즘)
  { name: "시간 왜곡", score: 0, hp: 0, synergy: "MIND", weight: 4, description: "점수나 HP 변화 없이, 다음 3라운드 동안 패시브 HP 감소 효과를 받지 않습니다.", effect: "passive_immunity", immunityRounds: 3 },

  // 10. 기회 포착 (LUCK): 낮은 리스크의 도박
  { name: "기회 포착", score: 10, hp: 0, chance: 0.7, scoreWin: 40, hpLose: 10, synergy: "LUCK", weight: 8, description: "작은 위험으로 중간 점수를 노립니다. 실패 시 손실도 적습니다." }
];

// DOM 요소 캐싱 (이전과 동일)
const hudElement = document.getElementById('hud');
const recordElement = document.getElementById('record');
const cardsElement = document.getElementById('cards');

function calculateRoundMultiplier() {
  const diff = GAME_CONSTANTS.DIFFICULTY;
  return 1 + (player.round - 1) * diff.level / GAME_CONSTANTS.ROUND_MULTIPLIER_BASE +
         Math.pow(player.round / GAME_CONSTANTS.ROUND_MULTIPLIER_POWER_BASE, GAME_CONSTANTS.ROUND_MULTIPLIER_POWER_EXPONENT);
}

function updateHUD() {
  if (hudElement) {
    hudElement.innerHTML = `
      <span>라운드: ${player.round}</span>
      <span>점수: ${player.score}</span>
      <span>HP: ${player.hp}/${GAME_CONSTANTS.DIFFICULTY.maxHpCap}</span>
      ${player.tempDamageReduction > 0 ? `<span style="color: lightblue;">방어 태세: ${Math.round(player.tempDamageReduction * 100)}% 피해 감소</span>` : ''}
      ${player.passiveImmunityRounds > 0 ? `<span style="color: lightgreen;">패시브 면역: ${player.passiveImmunityRounds}라운드</span>` : ''}
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
    // nextCardBoost 효과가 있다면 해당 유형의 카드 가중치 증가
    let effectiveWeight = c.weight;
    if (player.nextCardBoost && c.synergy === player.nextCardBoost.boostType) {
        effectiveWeight *= player.nextCardBoost.boostAmount;
    }

    for (let i = 0; i < effectiveWeight; i++) {
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
  let baseChance = card.chance || 0;

  // 행운의 부적 효과 적용
  if (card.synergy === "LUCK" && player.synergy.LUCK > 0) {
    baseChance += (player.synergy.LUCK * 0.03); // LUCK 시너지 스택당 성공률 증가
  }

  const adjustedChance = Math.max(GAME_CONSTANTS.CHANCE_MIN_ADJUSTED, baseChance + diff.chanceAdjust - (player.round / 500));

  if (Math.random() < adjustedChance) {
    player.score += Math.floor(card.scoreWin * multiplier);
    return 0;
  } else {
    const hpLoss = -Math.max(GAME_CONSTANTS.CHANCE_FAILURE_MIN_HP_LOSS,
                             Math.floor(card.hpLose * GAME_CONSTANTS.CHANCE_FAILURE_HP_PENALTY_MULTIPLIER + player.round / 15)); // 라운드 영향 더 감소
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
      const baseHeal = Math.max(0, Math.floor(card.hp * GAME_CONSTANTS.HEAL_BASE_MULTIPLIER));
      const roundPenalty = Math.floor(player.round / GAME_CONSTANTS.HEAL_ROUND_PENALTY_DIVISOR);
      hpChange = Math.max(0, baseHeal - roundPenalty);
      player.lastHealRound = player.round;
    } else {
      hpChange = 0;
    }
  } else {
    hpChange = card.hp - Math.floor(player.round / 40); // HP 손실 라운드 페널티 더욱 완화
  }
  return hpChange;
}

function applySynergyEffects(card, currentHpChange) {
  let hpEffect = currentHpChange;
  if (card.synergy) {
    player.synergy[card.synergy] = (player.synergy[card.synergy] || 0) + 1;

    if (card.synergy === 'BLOOD' && player.synergy.BLOOD >= GAME_CONSTANTS.SYNERGY_BLOOD_THRESHOLD) {
      hpEffect += -Math.min(GAME_CONSTANTS.SYNERGY_BLOOD_HP_PENALTY_MAX,
                            player.synergy.BLOOD * GAME_CONSTANTS.SYNERGY_BLOOD_HP_PENALTY_PER_STACK);
    }
  }
  return hpEffect;
}

// 새로운 카드 효과를 처리하는 함수
function applySpecialCardEffects(card) {
    if (card.effect) {
        switch (card.effect) {
            case "damage_reduction":
                player.tempDamageReduction = card.effectAmount; // 다음 라운드 피해 감소율 설정
                break;
            case "next_card_boost":
                player.nextCardBoost = { boostType: card.boostType, boostAmount: card.boostAmount }; // 다음 카드 드로우 가중치 설정
                break;
            case "passive_immunity":
                player.passiveImmunityRounds = card.immunityRounds; // 패시브 피해 면역 설정
                break;
            // 다른 특수 효과가 추가되면 여기에 case 추가
        }
    }
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
  applySpecialCardEffects(card); // 특수 효과 적용

  // 임시 피해 감소 효과 적용
  if (player.tempDamageReduction > 0 && finalHpChange < 0) { // HP 감소 효과에만 적용
      finalHpChange = Math.floor(finalHpChange * (1 - player.tempDamageReduction));
  }
  
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

  // 패시브 HP 감소 적용 (면역 체크)
  if (player.passiveImmunityRounds <= 0 && (player.round % GAME_CONSTANTS.DIFFICULTY.passiveEveryRounds) === 0) {
    const scale = Math.floor((player.round / 100) * GAME_CONSTANTS.DIFFICULTY.passiveScalingPer100);
    const passiveDamage = GAME_CONSTANTS.DIFFICULTY.passiveAmountBase + scale;
    player.hp -= passiveDamage;
    player.hp = Math.max(0, player.hp);
  }

  // 다음 라운드를 위한 임시 상태 초기화
  player.tempDamageReduction = 0; // 다음 라운드 시작 전에 초기화
  player.nextCardBoost = null; // 카드 선택 후 부스트 초기화
  if (player.passiveImmunityRounds > 0) {
      player.passiveImmunityRounds--; // 면역 라운드 감소
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
    lastHealRound: -GAME_CONSTANTS.DIFFICULTY.healCooldownRounds,
    tempDamageReduction: 0,
    nextCardBoost: null,
    passiveImmunityRounds: 0
  };
  updateHUD();
  createCards();
}

updateHUD();
createCards();
