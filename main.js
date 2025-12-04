let money = 0;
let perClick = 1;
let upgradeCost = 10;
let flowerCost = 20;
let flowerIncome = 1;
let flowerIncomeUpgradeCost = 50;

// 피버/상점 기준값
const feverThresholdBase = 500;
const feverDurationBase = 5000;

let feverThreshold = feverThresholdBase;
let feverDuration = feverDurationBase;
let clickGauge = 0;
let isFever = false;
let feverMultiplier = 1;
let feverCountdownId = null;
let feverRemainingMs = feverDuration;

// 상점용 업그레이드 관련 변수
const birdEggChanceBase = 0.1;
let birdEggChance = birdEggChanceBase;           // 새 한 마리당 알 낳을 확률
let birdEggChanceCost = 2000;
const birdEggChanceStep = 0.05;
const birdEggChanceMax = 0.9;
const birdEggMaxLevel = Math.round((birdEggChanceMax - birdEggChanceBase) / birdEggChanceStep);

const birdSpawnMinBase = 15000;
const birdSpawnMaxBase = 60000;
let birdSpawnMin = birdSpawnMinBase;          // 새 등장 간 최소 딜레이(ms)
let birdSpawnMax = birdSpawnMaxBase;          // 최대 딜레이(ms)
let birdSpawnCost = 2500;
const birdSpawnFactor = 0.9;       // 업그레이드 시 10%씩 빨라짐
const birdSpawnMinLimit = 4000;    // 너무 빠르지 않도록 하한
let birdSpeedLevel = 0;
const birdSpeedMaxLevel = 10;

let feverDurationCost = 3000;
const feverDurationStep = 1000;    // +1초
const feverDurationMax = 15000;
const feverDurationMaxLevel = Math.round((feverDurationMax - feverDurationBase) / feverDurationStep);

let feverThresholdCost = 2200;
const feverThresholdStep = -50;    // -50 클릭
const feverThresholdMin = 100;
const feverThresholdMaxLevel = Math.round((feverThresholdBase - feverThresholdMin) / Math.abs(feverThresholdStep));

// 레이드 관련
const bossOverlay = document.getElementById('boss-overlay');
const bossHpFill = document.getElementById('boss-hp-fill');
const bossHpText = document.getElementById('boss-hp-text');
const bossSpritePreview = document.getElementById('boss-sprite');
const perClickRow = document.getElementById('per-click-row');
const bossUi = document.getElementById('boss-ui');
const bossUiTimer = document.getElementById('boss-ui-timer');
const bossUiHpFill = document.getElementById('boss-ui-hp-fill');
const bossUiName = document.getElementById('boss-ui-name');
const bossBattleLayer = document.getElementById('boss-battle-layer');
const bossSurrenderBtn = document.getElementById('boss-surrender-btn');
const upgradeContainer = document.getElementById('upgrade-container');

const bossMaxHp = 15000;
let bossHp = bossMaxHp;
let isRaid = false;
const bossTimeLimit = 30000; // 30초
let bossTimeRemaining = bossTimeLimit;
let bossTimerId = null;
let bossFieldEntity = null;
let bossFieldImg = null;

function updateUI() {
  document.getElementById('money-display').innerText = `💰 ${money}원`;
  document.getElementById('per-click').innerText = perClick;
  document.getElementById('upgrade-cost').innerText = upgradeCost;
  document.getElementById('flower-cost').innerText = flowerCost;
  document.getElementById('flower-income').innerText = flowerIncome;
  document.getElementById('flower-income-upgrade-cost').innerText = flowerIncomeUpgradeCost;
  updateFeverUI();
}

function updateFeverUI(remainingOverride) {
  const labelEl = document.getElementById('fever-label');
  const countEl = document.getElementById('fever-count');
  const fillEl = document.getElementById('fever-fill');
  if (!labelEl || !countEl || !fillEl) return;

  if (isFever) {
    const ms = typeof remainingOverride === 'number' ? remainingOverride : feverRemainingMs;
    const seconds = Math.max(ms / 1000, 0).toFixed(1);
    labelEl.textContent = '피버타임!';
    countEl.textContent = `${seconds}s`;
    const percent = Math.max((ms / feverDuration) * 100, 0);
    fillEl.style.width = `${percent}%`;
    fillEl.style.background = '#ff7f50';
  } else {
    labelEl.textContent = '피버 게이지';
    countEl.textContent = `${clickGauge} / ${feverThreshold}`;
    const percent = Math.min((clickGauge / feverThreshold) * 100, 100);
    fillEl.style.width = `${percent}%`;
    fillEl.style.background = '#7cff7c';
  }
}

function incrementFeverGauge() {
  if (isFever) return;
  if (clickGauge >= feverThreshold) return;
  clickGauge++;
  if (clickGauge >= feverThreshold) {
    clickGauge = feverThreshold;
    updateFeverUI();
    startFever();
  } else {
    updateFeverUI();
  }
}

function startFever() {
  if (isFever) return;
  isFever = true;
  feverMultiplier = 2;
  feverRemainingMs = feverDuration;
  updateFeverUI(feverRemainingMs);
  if (feverCountdownId) clearInterval(feverCountdownId);
  feverCountdownId = setInterval(() => {
    feverRemainingMs -= 100;
    if (feverRemainingMs <= 0) {
      endFever();
    } else {
      updateFeverUI(feverRemainingMs);
    }
  }, 100);
}

function endFever() {
  isFever = false;
  feverMultiplier = 1;
  clickGauge = 0;
  if (feverCountdownId) {
    clearInterval(feverCountdownId);
    feverCountdownId = null;
  }
  updateFeverUI();
}

// 클릭 시 돈 증가 / 보스 데미지
document.body.addEventListener('click', (e) => {
  const clickedShop = e.target.closest && e.target.closest('#shop-panel');
  const clickedBoss = e.target.closest && e.target.closest('#boss-panel');
  // 상점/보스 UI 위에서는 돈 증가 무시
  if (clickedShop || clickedBoss) return;
  // 상점/보스 버튼 클릭 무시
  if (['upgrade-btn', 'shop-btn', 'boss-btn'].includes(e.target.id)) return;
  const amount = perClick * feverMultiplier;

  if (isRaid) {
    // 레이드 중: 돈 대신 보스에게 데미지
    applyBossDamage(amount);
    incrementFeverGauge();
  } else {
    // 평상시: 돈 증가
    money += amount;
    updateUI();
    incrementFeverGauge();

    // 클릭 애니메이션 생성
    const plus = document.createElement('div');
    plus.id = 'plus-text';
    plus.style.left = `${e.pageX}px`;
    plus.style.top = `${e.pageY}px`;
    plus.textContent = `+${amount}`;
    document.body.appendChild(plus);

    // 애니메이션 끝나면 제거
    setTimeout(() => {
      plus.remove();
    }, 700);
  }
});

// 업그레이드 버튼 클릭
document.getElementById('upgrade-btn').addEventListener('click', (e) => {
  if (money >= upgradeCost) {
    money -= upgradeCost;
    perClick++;
    // 업그레이드 비용은 2배씩 증가
    upgradeCost = Math.floor(upgradeCost * 2);
    updateUI();
  } else {
    // 돈이 부족할 때 효과(예: 버튼 흔들림)
    const btn = document.getElementById('upgrade-btn');
    btn.style.transform = 'scale(1.1)';
    setTimeout(() => {
      btn.style.transform = '';
    }, 100);
  }
});

let flowerCount = 0;
document.getElementById('flower-btn').addEventListener('click', () => {
  if (money >= flowerCost) {
    money -= flowerCost;
    flowerCost = Math.floor(flowerCost * 2);
    updateUI();
    const flower = document.createElement('img');
    flower.src = 'img/flower.png';
    flower.alt = 'flower';
    flower.style.position = 'absolute';
    flower.style.width = '180px';
    flower.style.height = '180px';
    flower.style.pointerEvents = 'none';
    // 아래쪽 1/3 영역에만 생성
    const minY = window.innerHeight * (2 / 3);
    const maxY = window.innerHeight - 70;
    const minX = 0;
    const maxX = window.innerWidth - 180;
    let x = Math.random() * (maxX - minX) + minX;
    const y = Math.random() * (maxY - minY) + minY;
    flower.style.left = `${x}px`;
    flower.style.top = `${y}px`;
    document.body.appendChild(flower);

    // 좌우로 계속 움직이는 애니메이션
    let direction = Math.random() < 0.5 ? 1 : -1;
    let speed = 1 + Math.random() * 1.5; // 1~2.5px/frame
    function moveFlower() {
      x += direction * speed;
      // 화면 끝에 닿으면 방향 반전
      if (x <= minX) {
        x = minX;
        direction = 1;
      } else if (x >= maxX) {
        x = maxX;
        direction = -1;
      }
      flower.style.left = `${x}px`;
      requestAnimationFrame(moveFlower);
    }
    moveFlower();

    // 꽃 개수 증가
    flowerCount++;
  } else {
    // 돈이 부족할 때 효과(예: 버튼 흔들림)
    const btn = document.getElementById('flower-btn');
    btn.style.transform = 'scale(1.1)';
    setTimeout(() => {
      btn.style.transform = '';
    }, 100);
  }
});

// 꽃 자동 수익 / 자동 데미지 (1초마다)
setInterval(() => {
  if (flowerCount <= 0) return;

  if (isRaid) {
    // 레이드 중: 꽃이 자동으로 보스에게 데미지
    const totalDamage = flowerCount * flowerIncome * feverMultiplier;
    applyBossDamage(totalDamage);
  } else {
    // 평상시: 자동 수익 + 이펙트
    const flowers = document.querySelectorAll('img[alt="flower"]');
    flowers.forEach((flower) => {
      const rect = flower.getBoundingClientRect();
      const plus = document.createElement('div');
      plus.className = 'plus-flower';
      plus.textContent = `+${flowerIncome * feverMultiplier}`;
      plus.style.position = 'absolute';
      plus.style.left = `${rect.left + rect.width / 2 - 15 + window.scrollX}px`;
      plus.style.top = `${rect.top - 20 + window.scrollY}px`;
      plus.style.color = 'yellow';
      plus.style.fontWeight = 'bold';
      plus.style.fontSize = '28px';
      plus.style.pointerEvents = 'none';
      plus.style.animation = 'floatUp 0.7s ease-out';
      plus.style.zIndex = 2000;
      document.body.appendChild(plus);
      setTimeout(() => plus.remove(), 700);
    });
    money += flowerCount * flowerIncome * feverMultiplier;
    updateUI();
  }
}, 1000);

// 꽃 수익 업그레이드 버튼 클릭
document.getElementById('flower-income-upgrade-btn').addEventListener('click', () => {
  if (money >= flowerIncomeUpgradeCost) {
    money -= flowerIncomeUpgradeCost;
    flowerIncome++;
    flowerIncomeUpgradeCost = Math.floor(flowerIncomeUpgradeCost * 2);
    updateUI();
  } else {
    // 돈이 부족할 때 효과(예: 버튼 흔들림)
    const btn = document.getElementById('flower-income-upgrade-btn');
    btn.style.transform = 'scale(1.1)';
    setTimeout(() => {
      btn.style.transform = '';
    }, 100);
  }
});

// 상점 UI 제어 및 업그레이드 로직
function updateShopUI() {
  const eggDesc = document.getElementById('shop-egg-desc');
  const birdDesc = document.getElementById('shop-birdspeed-desc');
  const feverDurDesc = document.getElementById('shop-feverdur-desc');
  const feverThDesc = document.getElementById('shop-feverth-desc');
  if (!eggDesc || !birdDesc || !feverDurDesc || !feverThDesc) return;

  eggDesc.textContent =
    `현재: ${(birdEggChance * 100).toFixed(0)}%  |  +${(birdEggChanceStep * 100).toFixed(0)}%  |  최대: ${(birdEggChanceMax * 100).toFixed(0)}%  |  가격: ${birdEggChanceCost}원`;

  birdDesc.textContent =
    `현재: ${(birdSpawnMin / 1000).toFixed(1)}초 ~ ${(birdSpawnMax / 1000).toFixed(1)}초  |  -10% 간격  |  가격: ${birdSpawnCost}원`;

  feverDurDesc.textContent =
    `현재: ${(feverDuration / 1000).toFixed(1)}초  |  +${(feverDurationStep / 1000).toFixed(1)}초  |  최대: ${(feverDurationMax / 1000).toFixed(1)}초  |  가격: ${feverDurationCost}원`;

  feverThDesc.textContent =
    `현재: ${feverThreshold}회  |  ${feverThresholdStep}회  |  최소: ${feverThresholdMin}회  |  가격: ${feverThresholdCost}원`;

  // 프로그레스 바 업데이트 (강화 1번당 1칸)
  const eggLevel = Math.round((birdEggChance - birdEggChanceBase) / birdEggChanceStep);
  updateShopBar('shop-egg-bar', eggLevel, birdEggMaxLevel);

  updateShopBar('shop-birdspeed-bar', birdSpeedLevel, birdSpeedMaxLevel);

  const feverDurLevel = Math.round((feverDuration - feverDurationBase) / feverDurationStep);
  updateShopBar('shop-feverdur-bar', feverDurLevel, feverDurationMaxLevel);

  const feverThLevel = Math.round((feverThresholdBase - feverThreshold) / Math.abs(feverThresholdStep));
  updateShopBar('shop-feverth-bar', feverThLevel, feverThresholdMaxLevel);
}

function updateShopBar(id, level, maxLevel) {
  const bar = document.getElementById(id);
  if (!bar) return;
  let segs = bar.querySelectorAll('.shop-bar-seg');
  if (!segs.length || segs.length !== maxLevel) {
    // 처음 한 번만, 혹은 maxLevel 변경 시 다시 생성
    bar.innerHTML = '';
    for (let i = 0; i < maxLevel; i++) {
      const seg = document.createElement('div');
      seg.className = 'shop-bar-seg';
      bar.appendChild(seg);
    }
    segs = bar.querySelectorAll('.shop-bar-seg');
  }
  const activeCount = Math.max(0, Math.min(maxLevel, level));
  segs.forEach((seg, idx) => {
    seg.classList.toggle('active', idx < activeCount);
  });
}

function flashButton(btn) {
  if (!btn) return;
  btn.style.transform = 'scale(1.05)';
  btn.style.boxShadow = '0 0 10px rgba(255,0,0,0.7)';
  setTimeout(() => {
    btn.style.transform = '';
    btn.style.boxShadow = '';
  }, 150);
}

const shopBtn = document.getElementById('shop-btn');
const shopPanel = document.getElementById('shop-panel');
const shopCloseBtn = document.getElementById('shop-close-btn');

if (shopBtn && shopPanel) {
  shopBtn.addEventListener('click', () => {
    shopPanel.classList.add('open');
    updateShopUI();
  });
}
if (shopCloseBtn && shopPanel) {
  shopCloseBtn.addEventListener('click', () => {
    shopPanel.classList.remove('open');
  });
}

// 각 상점 아이템 버튼 이벤트
const eggBtn = document.getElementById('shop-egg-btn');
if (eggBtn) {
  eggBtn.addEventListener('click', () => {
    if (birdEggChance >= birdEggChanceMax) return;
    if (money < birdEggChanceCost) {
      flashButton(eggBtn);
      return;
    }
    money -= birdEggChanceCost;
    birdEggChance = Math.min(birdEggChance + birdEggChanceStep, birdEggChanceMax);
    birdEggChanceCost = Math.floor(birdEggChanceCost * 1.7);
    updateUI();
    updateShopUI();
  });
}

const birdSpeedBtn = document.getElementById('shop-birdspeed-btn');
if (birdSpeedBtn) {
  birdSpeedBtn.addEventListener('click', () => {
    if (birdSpeedLevel >= birdSpeedMaxLevel) return;
    if (money < birdSpawnCost) {
      flashButton(birdSpeedBtn);
      return;
    }
    money -= birdSpawnCost;
    birdSpawnMin = Math.max(Math.floor(birdSpawnMin * birdSpawnFactor), birdSpawnMinLimit);
    birdSpawnMax = Math.max(Math.floor(birdSpawnMax * birdSpawnFactor), birdSpawnMinLimit + 2000);
    birdSpeedLevel++;
    birdSpawnCost = Math.floor(birdSpawnCost * 1.7);
    updateUI();
    updateShopUI();
  });
}

const feverDurBtn = document.getElementById('shop-feverdur-btn');
if (feverDurBtn) {
  feverDurBtn.addEventListener('click', () => {
    if (feverDuration >= feverDurationMax) return;
    if (money < feverDurationCost) {
      flashButton(feverDurBtn);
      return;
    }
    money -= feverDurationCost;
    feverDuration = Math.min(feverDuration + feverDurationStep, feverDurationMax);
    feverDurationCost = Math.floor(feverDurationCost * 1.7);
    updateUI();
    updateShopUI();
  });
}

const feverThBtn = document.getElementById('shop-feverth-btn');
if (feverThBtn) {
  feverThBtn.addEventListener('click', () => {
    if (feverThreshold <= feverThresholdMin) return;
    if (money < feverThresholdCost) {
      flashButton(feverThBtn);
      return;
    }
    money -= feverThresholdCost;
    feverThreshold = Math.max(feverThreshold + feverThresholdStep, feverThresholdMin);
    feverThresholdCost = Math.floor(feverThresholdCost * 1.7);
    updateUI();
    updateShopUI();
  });
}

// 보스 레이드 UI
const bossBtn = document.getElementById('boss-btn');
const bossCloseBtn = document.getElementById('boss-close-btn');
const bossStartBtn = document.getElementById('boss-start-btn');

if (bossBtn && bossOverlay) {
  bossBtn.addEventListener('click', () => {
    if (isRaid) {
      alert('이미 레이드가 진행 중입니다!');
      return;
    }
    bossOverlay.classList.add('open');
    updateBossUI();
  });
}
if (bossCloseBtn && bossOverlay) {
  bossCloseBtn.addEventListener('click', () => {
    bossOverlay.classList.remove('open');
  });
}
if (bossOverlay) {
  bossOverlay.addEventListener('click', (e) => {
    if (e.target === bossOverlay) {
      bossOverlay.classList.remove('open');
    }
  });
}
if (bossStartBtn) {
  bossStartBtn.addEventListener('click', () => {
    startRaid();
  });
}
if (bossSurrenderBtn) {
  bossSurrenderBtn.addEventListener('click', () => {
    if (!isRaid) return;
    const confirmGiveUp = confirm('정말 레이드를 포기할까요?');
    if (confirmGiveUp) {
      endRaid(false);
    }
  });
}

function updateBossUI() {
  const ratio = Math.max(0, Math.min(1, bossHp / bossMaxHp));
  if (bossHpFill) bossHpFill.style.width = `${ratio * 100}%`;
  if (bossHpText) bossHpText.textContent = `${bossHp.toLocaleString()} HP`;
  if (bossUiHpFill) bossUiHpFill.style.width = `${ratio * 100}%`;
}

function updateBossTimerUI() {
  if (bossUiTimer) {
    bossUiTimer.textContent = `${Math.max(0, bossTimeRemaining / 1000).toFixed(1)}s`;
  }
}

function applyBossDamage(amount) {
  if (!isRaid || amount <= 0) return;
  bossHp = Math.max(0, bossHp - Math.floor(amount));
  updateBossUI();
  spawnBossDamageText(amount);
  if (bossHp <= 0) {
    endRaid(true);
  }
}

function spawnBossDamageText(amount) {
  const target = bossFieldImg || bossSpritePreview;
  if (!target) return;
  const rect = target.getBoundingClientRect();
  const x = rect.left + rect.width / 2 + window.scrollX;
  const y = rect.top + rect.height * 0.2 + window.scrollY;
  const dmg = document.createElement('div');
  dmg.className = 'boss-damage';
  dmg.style.left = `${x}px`;
  dmg.style.top = `${y}px`;
  dmg.textContent = `-${Math.floor(amount)}`;
  document.body.appendChild(dmg);
  setTimeout(() => dmg.remove(), 700);
}

function spawnBossOnField() {
  removeBossOnField();
  const wrapper = document.createElement('div');
  wrapper.id = 'boss-field-entity';
  const shadow = document.createElement('div');
  shadow.className = 'boss-field-shadow';
  const img = document.createElement('img');
  img.src = 'img/mudang.png';
  img.alt = '무당벌레';
  wrapper.appendChild(shadow);
  wrapper.appendChild(img);
  document.body.appendChild(wrapper);
  bossFieldEntity = wrapper;
  bossFieldImg = img;
}

function removeBossOnField() {
  if (bossFieldEntity) {
    bossFieldEntity.remove();
    bossFieldEntity = null;
    bossFieldImg = null;
  }
}

function startRaid() {
  if (isRaid) return;
  isRaid = true;
  bossHp = bossMaxHp;
  bossTimeRemaining = bossTimeLimit;
  spawnBossOnField();
  if (bossBattleLayer) bossBattleLayer.classList.add('active');
  if (bossUi) bossUi.classList.add('active');
  updateBossUI();
  updateBossTimerUI();
  if (bossOverlay) bossOverlay.classList.remove('open');
  if (bossStartBtn) {
    bossStartBtn.disabled = true;
    bossStartBtn.textContent = '레이드 진행중';
  }
  if (perClickRow) perClickRow.style.display = 'none';
  if (upgradeContainer) upgradeContainer.style.display = 'none';
  if (bossTimerId) clearInterval(bossTimerId);
  bossTimerId = setInterval(() => {
    bossTimeRemaining -= 100;
    if (bossTimeRemaining < 0) bossTimeRemaining = 0;
    updateBossTimerUI();
    if (bossTimeRemaining <= 0) {
      endRaid(false);
    }
  }, 100);
}

function endRaid(success) {
  if (!isRaid) {
    if (bossOverlay) bossOverlay.classList.remove('open');
    bossHp = bossMaxHp;
    updateBossUI();
    return;
  }
  isRaid = false;
  removeBossOnField();
  if (bossBattleLayer) bossBattleLayer.classList.remove('active');
  if (bossUi) bossUi.classList.remove('active');
  if (bossTimerId) {
    clearInterval(bossTimerId);
    bossTimerId = null;
  }
  bossTimeRemaining = bossTimeLimit;
  updateBossTimerUI();
  if (bossStartBtn) {
    bossStartBtn.disabled = false;
    bossStartBtn.textContent = '레이드 시작';
  }
  if (perClickRow) perClickRow.style.display = '';
  if (upgradeContainer) upgradeContainer.style.display = '';
  if (bossOverlay) bossOverlay.classList.remove('open');
  bossHp = bossMaxHp;
  updateBossUI();
  if (success) {
    flowerIncome = Math.floor(flowerIncome * 1.2);
    updateUI();
    alert('무당벌레 레이드 클리어! 🌸 꽃 수익이 20% 증가했습니다.');
  } else {
    alert('레이드 실패! 제한 시간 내에 처치하지 못했습니다.');
  }
}

// 새와 알 소환 함수
function spawnBirdAndEgg() {
  // 새 생성 (bird.png)
  const bird = document.createElement('img');
  bird.src = 'img/bird.png';
  bird.alt = 'bird';
  bird.style.position = 'absolute';
  bird.style.top = '0px';
  bird.style.width = '300px';
  bird.style.height = '195px';
  bird.style.zIndex = 4000;
  bird.style.pointerEvents = 'none';
  bird.style.userSelect = 'none';
  // 새가 왼쪽에서 오른쪽 또는 오른쪽에서 왼쪽으로 랜덤하게 이동
  const fromLeft = Math.random() < 0.5;
  let birdX = fromLeft ? -180 : window.innerWidth;
  bird.style.left = birdX + 'px';
  // 왼쪽에서 오른쪽으로 이동할 때 이미지 뒤집기 (새 이미지가 기본적으로 왼쪽을 향하고 있다고 가정)
  if (fromLeft) {
    bird.style.transform = 'scaleX(-1)';
  }
  document.body.appendChild(bird);

  // 새 이동 속도 및 방향
  const speed = 3 + Math.random() * 2; // px/frame
  const targetX = fromLeft ? window.innerWidth : -180;
  // 알을 떨어뜨릴 위치(새가 화면 중간쯤에 왔을 때)
  const eggDropX = fromLeft
    ? Math.random() * (window.innerWidth * 0.5) + window.innerWidth * 0.25
    : Math.random() * (window.innerWidth * 0.5) + window.innerWidth * 0.25;
  let eggDropped = false;
  // 이 새가 알을 낳을지 사전에 결정 (birdEggChance 확률)
  const shouldDropEgg = Math.random() < birdEggChance;

  function moveBird() {
    birdX += fromLeft ? speed : -speed;
    bird.style.left = birdX + 'px';
    // 알 떨어뜨리기
    if (
      !eggDropped &&
      shouldDropEgg &&
      ((fromLeft && birdX >= eggDropX) || (!fromLeft && birdX <= eggDropX))
    ) {
      eggDropped = true;
      // 새의 중앙 아래에서 알 떨어뜨림 (새의 너비가 300px이므로 중앙은 +150px)
      const birdCenterX = birdX + 150;
      spawnEgg(birdCenterX, 80);
    }
    // 새가 화면을 벗어나면 제거
    if ((fromLeft && birdX > window.innerWidth) || (!fromLeft && birdX < -180)) {
      bird.remove();
    } else {
      requestAnimationFrame(moveBird);
    }
  }
  moveBird();
}

// 알 떨어뜨리기 함수
function spawnEgg(x, startY) {
  const egg = document.createElement('img');
  egg.src = 'img/egg.png';
  egg.alt = 'egg';
  egg.style.position = 'absolute';
  egg.style.left = x + 'px';
  egg.style.top = startY + 'px';
  egg.style.height = '120px';
  egg.style.width = '';
  egg.style.objectFit = 'contain';
  egg.style.zIndex = 3500;
  egg.style.cursor = 'pointer';
  egg.style.userSelect = 'none';
  document.body.appendChild(egg);
  let y = startY;
  let velocity = 0;
  const gravity = 0.7;
  let landed = false;
  function fall() {
    velocity += gravity;
    y += velocity;
    egg.style.top = y + 'px';
    if (y < window.innerHeight - 120) {
      requestAnimationFrame(fall);
    } else {
      egg.style.top = window.innerHeight - 120 + 'px';
      landed = true;
      // 알이 바닥에 닿으면 10초 후 사라짐 (클릭 안 했을 때만)
      setTimeout(() => {
        if (document.body.contains(egg)) egg.remove();
      }, 10000);
    }
  }
  fall();

  // 알 클릭 시 보상
  egg.addEventListener('click', function onClick() {
    // 보상 금액: 꽃당 수익 x 100
    const reward = flowerIncome * 300;
    const finalReward = reward * feverMultiplier;
    money += finalReward;
    updateUI();
    // 애니메이션 효과
    const rect = egg.getBoundingClientRect();
    const plus = document.createElement('div');
    plus.textContent = `+${finalReward}원!`;
    plus.style.position = 'absolute';
    plus.style.left = `${rect.left + rect.width / 2 - 30 + window.scrollX}px`;
    plus.style.userSelect = 'none';
    plus.style.top = `${rect.top - 20 + window.scrollY}px`;
    plus.style.color = '#00ffcc';
    plus.style.fontWeight = 'bold';
    plus.style.fontSize = '28px';
    plus.style.pointerEvents = 'none';
    plus.style.animation = 'floatUp 0.9s ease-out';
    plus.style.zIndex = 4001;
    document.body.appendChild(plus);
    setTimeout(() => plus.remove(), 900);
    // 알 제거
    egg.remove();
  });
}

// 새 소환을 랜덤한 시간마다 반복
function scheduleBird() {
  const delay = Math.random() * (birdSpawnMax - birdSpawnMin) + birdSpawnMin;
  setTimeout(() => {
    spawnBirdAndEgg();
    scheduleBird();
  }, delay);
}
scheduleBird();

updateUI();


