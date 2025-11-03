// game.js - Final rebalance: Addressing HP calculation clarity and early-game choice variety

const GAME_CONSTANTS = {
  DIFFICULTY: {
    level: 0.4,                 // 라운드별 난이도 증가폭 더욱 완화 (이전 0.6)
    chanceAdjust: 0.15,         // 도박 카드 성공률 증가 (이전 0.12)
    passiveEveryRounds: 10,     // 패시브 HP 감소 주기 대폭 증가 (이전 7)
    passiveAmountBase: 0,       // 기본 패시브 HP 감소량 0 (초반 영향 최소화, 스케일링으로만 증가) (이전 1)
    passiveScalingPer100: 2,    // 100라운드당 패시브 스케일링 더욱 최소화 (이전 3)
    healCooldownRounds: 5,      // HP 회복 쿨다운 더욱 감소 (이전 7)
    maxHpCap: 100               // HP 상한 유지
  },
  CARD_DRAW_COUNT: 3,
  CARD_HIGHLIGHT_DURATION: 180, // milliseconds
  CHANCE_MIN_ADJUSTED: 0.15,    // 최소 도박 성공 확률 증가
  CHANCE_FAILURE_HP_PENALTY_MULTIPLIER: 0.8, // 도박 실패 HP 패널티 대폭 감소 (이전 1.0)
  CHANCE_FAILURE_MIN_HP_LOSS: 10, // 도박 실패 최소 HP 손실 감소 (이전 15)
  CHANCE_FAILURE_SCORE_PENALTY_DIVISOR: 12, // 도박 실패 시 점수 패널티 더욱 완화 (이전 10)
  HEAL_BASE_MULTIPLIER: 1.0,    // 힐 카드 기본 회복량 최대화 (이전 0.8)
  HEAL_ROUND_PENALTY_DIVISOR: 70, // 힐 라운드 페널티 대폭 완화 (이전 50)
  HP_CHANGE_MAX_POSITIVE: 25,   // HP 회복 최대치 증가 (이전 20)
  HP_CHANGE_MAX_NEGATIVE: -30,  // HP 손실 최소치 더욱 완화 (이전 -40)
  SYNERGY_BLOOD_THRESHOLD: 2,
  SYNERGY_BLOOD_HP_PENALTY_PER_STACK: 1, // 혈액 시너지 페널티 최소화 (이전 2)
  SYNERGY_BLOOD_HP_PENALTY_MAX: 8,       // 혈액 시너지 페널티 최대치 감소 (이전 10)
  ROUND_MULTIPLIER_BASE: 80,    // 라운드 승수 기본값 더욱 조정 (이전 60)
  ROUND_MULTIPLIER_POWER_BASE: 300, // 라운드 승수 제곱 기준 더욱 조정 (이전 250)
  ROUND_MULTIPLIER_POWER_EXPONENT: 1.5, // 라운드 승수 제곱 지수 더욱 완화 (이전 1.8)
  GAME_END_ROUND_ALERT: 100,
  // HP 계산 로직 설명을 위한 상수 추가
  BASE_HP_PENALTY_DIVISOR_NORMAL: 50, // 일반 HP 감소 카드 라운드 패널티
  BASE_HP_PENALTY_DIVISOR_CHANCE: 20, // 도박 실패 HP 감소 카드 라운드 패널티
};

let player = {
  score: 0,
  hp: GAME_CONSTANTS.DIFFICULTY.maxHpCap,
  round: 1,
  synergy: { FIRE: 0, MIND: 0, BLOOD: 0, LUCK: 0 },
  lastHealRound: -GAME_CONSTANTS.DIFFICULTY.healCooldownRounds,
  tempDamageReduction: 0,
  nextCardBoost: null,
  passiveImmunityRounds: 0
};
let bestScore = localStorage.getItem('bestScore') ? parseInt(localStorage.getItem('bestScore')) : 0;

// Card definitions rebalanced with more diverse options and weight adjustments
const cardDefinitions = [
  // 1. 불타는 일격 (FIRE): 점수 획득, 적절한 HP 손실. (중반 이후 주요 딜 카드)
  { name: "불타는 일격", score: 40, hp: -8, synergy: "FIRE", weight: 8, description: "강력한 일격! HP가 약간 감소합니다." },

  // 2. 집중 명상 (MIND): 안정적인 HP 회복. (초반 핵심 힐 카드)
  { name: "집중 명상", score: 8, hp: 12, synergy: "MIND", weight: 15, description: "정신을 집중하여 상당한 HP를 회복합니다." },

  // 3. 도박사 (LUCK): 위험을 줄이고 보상은 유지. (초반에도 시도해볼 만한 카드)
  { name: "도박사", score: 0, hp: 0, chance: 0.6, scoreWin: 100, hpLose: 20, synergy: "LUCK", weight: 10, description: "성공 시 막대한 점수, 실패 시 HP 손실! 운을 시험합니다." },

  // 4. 계약서 (BLOOD): 높은 점수, 중간 HP 손실. (고득점용, HP 여유 있을 때)
  { name: "계약서", score: 25, hp: -12, synergy: "BLOOD", weight: 8, description: "높은 점수를 얻지만, HP를 대가로 지불합니다." },

  // 5. 행운의 부적 (LUCK): 다음 도박 카드 성공률 증가 (시너지). (도박 빌드 보조)
  { name: "행운의 부적", score: 5, hp: 0, synergy: "LUCK", weight: 10, description: "약간의 점수와 함께, 다음 도박의 성공률을 높입니다." },

  // 6. 냉정한 판단 (MIND): 소량의 HP 회복, 점수도 얻을 수 있음. (꾸준한 HP 관리)
  { name: "냉정한 판단", score: 10, hp: 6, synergy: "MIND", weight: 12, description: "냉정한 판단으로 약간의 HP와 점수를 얻습니다." },

  // 7. 방어 태세 (MIND): 다음 라운드 피해 감소. (위험한 라운드 대비)
  { name: "방어 태세", score: -5, hp: 0, synergy: "MIND", weight: 8, description: "점수가 약간 줄지만, 다음 라운드에 받는 피해를 크게 줄입니다.", effect: "damage_reduction", effectAmount: 0.6 }, // 피해 감소량 증가

  // 8. 피의 대가 (BLOOD): 높은 점수, 큰 HP 손실, 다음 라운드 BLOOD 카드 확률 증가. (하이리스크 하이리턴 후반 전략)
  { name: "피의 대가", score: 50, hp: -20, synergy: "BLOOD", weight: 6, description: "매우 높은 점수를 얻지만, HP 손실과 함께 다음 라운드에 피 카드 확률이 높아집니다.", effect: "next_card_boost", boostType: "BLOOD", boostAmount: 1.8 }, // HP 손실 감소, 부스트량 증가

  // 9. 시간 왜곡 (MIND): 패시브 HP 감소 턴 초기화 또는 면역. (장기 HP 관리)
  { name: "시간 왜곡", score: 0, hp: 0, synergy: "MIND", weight: 5, description: "점수나 HP 변화 없이, 다음 4라운드 동안 패시브 HP 감소 효과를 받지 않습니다.", effect: "passive_immunity", immunityRounds: 4 }, // 면역 라운드 증가

  // 10. 기회 포착 (LUCK): 낮은 리스크의 도박. (초반 운 요소 도입)
  { name: "기회 포착", score: 10, hp: 0, chance: 0.75, scoreWin: 40, hpLose: 8, synergy: "LUCK", weight: 10, description: "작은 위험으로 중간 점수를 노립니다. 실패 시 손실도 적습니다." },

  // --- 새로운 카드 ---

  // 11. 생명력 흡수 (BLOOD): 점수와 소량의 HP 회복, BLOOD 시너지 스택에 따라 HP 손실. (초반 BLOOD 선택지)
  { name: "생명력 흡수", score: 15, hp: 5, synergy: "BLOOD", weight: 12, description: "점수를 얻고 HP를 소량 회복합니다. 피 시너지 스택이 쌓이면 위험해집니다.", effect: "blood_drain_synergy" },

  // 12. 성찰 (MIND): 점수 없이 HP 회복, 다음 MIND 카드 확률 증가. (MIND 빌드 보조)
  { name: "성찰", score: 0, hp: 8, synergy: "MIND", weight: 10, description: "HP를 회복하고 다음 라운드에 정신 카드가 나올 확률을 높입니다.", effect: "next_card_boost", boostType: "MIND", boostAmount: 1.5 }
];

// DOM 요소 캐싱
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

  if (card.synergy === "LUCK" && player.synergy.LUCK > 0) {
    baseChance += (player.synergy.LUCK * 0.03); // LUCK 시너지 스택당 성공률 증가
  }

  const adjustedChance = Math.max(GAME_CONSTANTS.CHANCE_MIN_ADJUSTED, baseChance + diff.chanceAdjust - (player.round / 600)); // 라운드 영향 더 감소

  if (Math.random() < adjustedChance) {
    player.score += Math.floor(card.scoreWin * multiplier);
    return 0;
  } else {
    // 도박 실패 시 HP 손실 및 점수 페널티 완화
    let hpLoss = -Math.max(GAME_CONSTANTS.CHANCE_FAILURE_MIN_HP_LOSS,
                             Math.floor(card.hpLose * GAME_CONSTANTS.CHANCE_FAILURE_HP_PENALTY_MULTIPLIER + player.round / GAME_CONSTANTS.BASE_HP_PENALTY_DIVISOR_CHANCE)); // 라운드 영향 줄임
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
    // HP 손실 라운드 페널티 완화
    hpChange = card.hp - Math.floor(player.round / GAME_CONSTANTS.BASE_HP_PENALTY_DIVISOR_NORMAL); // 라운드 영향 줄임
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

function applySpecialCardEffects(card, currentHpChange) {
    let hpEffect = currentHpChange;
    if (card.effect) {
        switch (card.effect) {
            case "damage_reduction":
                player.tempDamageReduction = card.effectAmount;
                break;
            case "next_card_boost":
                player.nextCardBoost = { boostType: card.boostType, boostAmount: card.boostAmount };
                break;
            case "passive_immunity":
                player.passiveImmunityRounds = card.immunityRounds;
                break;
            case "blood_drain_synergy":
                // 생명력 흡수: BLOOD 시너지 스택당 HP 손실 증가
                const bloodSynergyDrain = player.synergy.BLOOD > 0 ? (player.synergy.BLOOD * 2) : 0; // 스택당 2 HP 추가 감소
                hpEffect -= bloodSynergyDrain;
                break;
        }
    }
    return hpEffect;
}


// UI에 표시될 예상 HP 변화량을 계산하는 함수 추가
function calculateDisplayedHpChange(card, isChanceCard) {
    const multiplier = calculateRoundMultiplier();
    let effectiveHpChange = 0;
    let roundPenalty = 0;

    if (isChanceCard) {
        // 도박 카드는 성공/실패에 따라 달라지므로, 실패 시나리오를 기준으로 표시 (가장 나쁜 경우)
        effectiveHpChange = -Math.max(GAME_CONSTANTS.CHANCE_FAILURE_MIN_HP_LOSS,
                                     Math.floor(card.hpLose * GAME_CONSTANTS.CHANCE_FAILURE_HP_PENALTY_MULTIPLIER + player.round / GAME_CONSTANTS.BASE_HP_PENALTY_DIVISOR_CHANCE));
    } else {
        if (card.hp > 0) {
            // 회복 카드
            roundPenalty = Math.floor(player.round / GAME_CONSTANTS.HEAL_ROUND_PENALTY_DIVISOR);
            effectiveHpChange = Math.max(0, Math.floor(card.hp * GAME_CONSTANTS.HEAL_BASE_MULTIPLIER) - roundPenalty);
            // 쿨다운 중이라면 회복량 0으로 표시
            if ((player.round - player.lastHealRound) < GAME_CONSTANTS.DIFFICULTY.healCooldownRounds) {
                effectiveHpChange = 0;
            }
        } else {
            // HP 손실 카드
            roundPenalty = Math.floor(player.round / GAME_CONSTANTS.BASE_HP_PENALTY_DIVISOR_NORMAL);
            effectiveHpChange = card.hp - roundPenalty;
        }
    }
    
    // 시너지 효과 및 특수 효과는 미리 예측하기 어려우므로, 기본 효과만 표시
    // '생명력 흡수' 카드는 예외적으로 시너지에 따른 HP 변화를 보여줌
    if (card.effect === "blood_drain_synergy") {
        const bloodSynergyDrain = player.synergy.BLOOD > 0 ? (player.synergy.BLOOD * 2) : 0;
        effectiveHpChange -= bloodSynergyDrain;
    }

    // 최종적으로 상한/하한 적용 (UI에서도 보여지는 값에 가깝게)
    effectiveHpChange = Math.min(GAME_CONSTANTS.HP_CHANGE_MAX_POSITIVE, effectiveHpChange);
    effectiveHpChange = Math.max(GAME_CONSTANTS.HP_CHANGE_MAX_NEGATIVE, effectiveHpChange);

    return effectiveHpChange;
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
  finalHpChange = applySpecialCardEffects(card, finalHpChange); // 특수 효과는 HP 변화에도 영향을 줄 수 있으므로

  // 임시 피해 감소 효과 적용
  if (player.tempDamageReduction > 0 && finalHpChange < 0) {
      finalHpChange = Math.floor(finalHpChange * (1 - player.tempDamageReduction));
  }
  
  // HP 변화량 상한/하한 적용
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
    if (passiveDamage > 0) { // 0일 경우엔 표시하지 않음
        player.hp -= passiveDamage;
        player.hp = Math.max(0, player.hp);
        // 패시브 데미지 발생 알림 (선택 사항)
        // console.log(`라운드 ${player.round}: 패시브 HP ${passiveDamage} 감소!`);
    }
  }

  player.tempDamageReduction = 0;
  player.nextCardBoost = null;
  if (player.passiveImmunityRounds > 0) {
      player.passiveImmunityRounds--;
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
    const isChanceCard = card.chance !== undefined;
    const displayedHpChange = calculateDisplayedHpChange(card, isChanceCard); // UI에 표시될 HP 변화량 계산

    if (isChanceCard) {
      metaText = `성공 시 +${Math.floor(card.scoreWin * calculateRoundMultiplier())}점, 실패 시 HP${displayedHpChange} (${Math.round(card.chance * 100)}%)`;
    } else {
        const displayedScore = Math.floor(card.score * calculateRoundMultiplier());
        metaText = `점수: ${displayedScore > 0 ? '+' : ''}${displayedScore}, HP: ${displayedHpChange > 0 ? '+' : ''}${displayedHpChange}`;
        // 힐 카드 쿨다운 중일 경우 표시
        if (card.hp > 0 && (player.round - player.lastHealRound) < GAME_CONSTANTS.DIFFICULTY.healCooldownRounds) {
            metaText += " (쿨다운)";
        }
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
