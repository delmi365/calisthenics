/* ============================================================
 *  90天家中徒手健身 · 应用逻辑
 * ============================================================ */
const KEY = 'bw90_state_v1';
const $ = (s, p = document) => p.querySelector(s);
const $$ = (s, p = document) => Array.from(p.querySelectorAll(s));
const DAY_MS = 86400000;

let state = load();
let viewDay = null;      // 计划页查看的某天
let viewWeek = 1;        // 计划页查看的周
let currentPage = 'today';

/* ---------- 存储 ---------- */
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { }
  return { started: false, gender: null, goal: 'fatloss', level: 0, age: 28, height: 170, weight: 65, startDate: null, log: {}, weights: [], tests: {} };
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { } }
function todayStr(d = new Date()) { return d.toISOString().slice(0, 10); }
function dayNumber() {
  if (!state.startDate) return 1;
  const s = new Date(state.startDate + 'T00:00:00');
  const n = Math.floor((Date.now() - s.getTime()) / DAY_MS) + 1;
  return Math.min(Math.max(n, 1), 90);
}

/* ---------- 引导 ---------- */
function initOnboard() {
  $$('.gbtn').forEach(b => b.onclick = () => {
    $$('.gbtn').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    state.gender = b.dataset.gender;
    const btn = $('#obStart');
    btn.disabled = false;
    btn.textContent = '开始 90 天计划 →';
  });
  $$('#obGoal button').forEach(b => b.onclick = () => {
    $$('#obGoal button').forEach(x => x.classList.remove('on'));
    b.classList.add('on'); state.goal = b.dataset.goal;
  });
  $$('#obLevel button').forEach(b => b.onclick = () => {
    $$('#obLevel button').forEach(x => x.classList.remove('on'));
    b.classList.add('on'); state.level = +b.dataset.level;
  });
  $('#obStart').onclick = () => {
    if (!state.gender) return;
    state.age = +$('#obAge').value || 28;
    state.height = +$('#obHeight').value || 170;
    state.weight = +$('#obWeight').value || 65;
    state.startDate = todayStr();
    state.started = true;
    state.weights = [{ d: state.startDate, w: state.weight }];
    save();
    $('#onboard').classList.add('hidden');
    $('#app').classList.remove('hidden');
    boot();
  };
}

/* ---------- 顶栏 ---------- */
function renderTop() {
  const n = viewDay || dayNumber();
  const info = getDayInfo(n);
  $('#tbDayNum').textContent = n;
  $('#tbPhase').textContent = '阶段' + ['一', '二', '三'][info.phaseIndex];
  $('#tbWeek').textContent = '第 ' + info.week + ' 周' + (info.isDeloadWeek ? '（减量周）' : '');
  $('#tbWd').textContent = info.weekday;
  const b = $('#tbBadge');
  b.textContent = state.gender === 'male' ? '♂ 男性' : '♀ 女性';
  b.classList.toggle('female', state.gender === 'female');
}

/* ---------- 工具 ---------- */
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 1800);
}
function genderChip() { return state.gender === 'male' ? 'm' : 'f'; }
function isTimeRep(r) { return /秒|力竭|分钟|次/.test(String(r)); }
function formBlock(fm) {
  if (!fm) return '';
  return `<div class="form-box">
      <div class="form-row"><span class="form-k">起始</span><span>${fm.s}</span></div>
      <div class="form-row"><span class="form-k">过程</span><span>${fm.m}</span></div>
      <div class="form-row"><span class="form-k">呼吸</span><span>${fm.b}</span></div>
      <div class="form-row bad"><span class="form-k">别犯</span><span>${fm.x}</span></div>
    </div>`;
}
function poseKeyOf(name) {
  if (state.anim === false) return null;
  try { return findPose(name); } catch (e) { return null; }
}
function repText(ex, hiit, test) {
  if (test) return ex.reps;
  const unit = hiit ? '轮 × ' : '组 × ';
  return ex.sets + ' ' + unit + ex.reps + (isTimeRep(ex.reps) ? '' : ' 次');
}

/* ============================================================
 *  今日训练
 * ============================================================ */
function renderToday() {
  const n = viewDay || dayNumber();
  const info = getDayInfo(n);
  const d = info.day;
  const g = state.gender;
  const isRest = !!d.rest;
  const done = !!state.log[n]?.done;
  const pct = Math.round(n / 90 * 100);
  try { pruneInstances(); } catch (e) { }

  let html = `
    <div class="card acc">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <h2 class="ctitle">${d.title}</h2>
          <p class="csub">${d.sub}</p>
        </div>
        <span class="chip ${isRest ? 'g' : genderChip()}">${info.weekday}</span>
      </div>
      <div class="chips">
        ${(d.muscles || []).map(m => `<span class="chip ${genderChip()}">${m}</span>`).join('')}
        ${info.isDeloadWeek ? '<span class="chip o">减量周</span>' : ''}
      </div>
      <div style="height:6px;background:#eef1f6;border-radius:6px;overflow:hidden;margin:6px 0 4px;">
        <i style="display:block;height:100%;width:${pct}%;background:var(--accent);border-radius:6px;"></i>
      </div>
      <div style="font-size:11px;color:var(--text3);">90 天进度 ${n}/90（${pct}%）</div>
    </div>`;

  if (isRest) {
    html += `<div class="card ok">
      <h3 class="ctitle">今天休息 —— 肌肉在休息时生长</h3>
      <p class="csub">完全不练 = 掉队；练太狠 = 恢复不足。做"主动恢复"即可。</p>
      ${(d.recovery || []).map((r, i) => `
        <div class="ex ${state.log[n]?.checks?.[i] ? 'done' : ''}" data-check="${i}">
          <div class="ex-check">✓</div>
          <div class="ex-body">
            <div class="ex-name">${r.n}</div>
            <div class="ex-meta">${r.r} · ${r.cue}</div>
          </div>
        </div>`).join('')}
    </div>`;
  } else {
    // 阶段信息
    const setsNow = getSets(info);
    html += `<div class="card phase-card">
      <h3 class="ctitle">${info.phase.name}</h3>
      <p class="csub">${info.phase.range} · ${info.phase.focus}</p>
      <div style="font-size:13px;">${info.phase.desc}</div>
      <div class="chips" style="margin-top:10px;margin-bottom:0;">
        <span class="chip">组数 ${d.test ? '自测 1 组' : (d.hiit ? setsNow + ' 轮' : setsNow + ' 组')}</span>
        <span class="chip">组间休息 ${d.hiit ? info.phase.cardio.rest + ' 秒' : info.phase.rest}</span>
        <span class="chip">强度 ${d.test ? '50%' : (info.isDeloadWeek ? 'RPE 5-6（轻松）' : info.phase.rpe)}</span>
      </div>
    </div>`;

    if (info.isDeloadWeek && !d.test) {
      html += `<div class="card warn"><div style="font-size:13px;">🔋 <b>本周是减量周</b>：组数比平时少 1 组，强度降到 5-6 成。疲劳在第 3-4 周累积到临界点，主动减载能让身体完成"超量恢复"，下周力量反而会涨。不要觉得偷懒——这是计划的一部分。</div></div>`;
    }
    if (state.level === 0 && info.week <= 2) {
      html += `<div class="card warn"><div style="font-size:13px;">🌱 <b>零基础起步提示</b>：每个动作都先看「动作要点 / 难易调节」，做不了就直接用"太难？"的降阶版本。前 2 周宁可每组少做 2-3 个，也要保证姿势不塌腰、不耸肩。</div></div>`;
    }

    if (d.tip) html += `<div class="card warn"><div style="font-size:13px;">💡 ${d.tip}</div></div>`;
    if (d.hiit) {
      const c = info.phase.cardio;
      html += `<div class="card warn">
        <h3 class="ctitle">循环训练法</h3>
        <div style="font-size:13px;">${c.rounds} 轮 × 8 个动作，每个动作 ${c.work} 秒，动作间休息 ${c.rest} 秒，轮间休息 90 秒。<br>
        全程约 ${Math.round(c.rounds * 8 * (c.work + c.rest) / 60)} 分钟。心率维持在最大心率的 70-85%（≈「能说话但不能唱歌」）。</div>
      </div>`;
    }

    // 热身
    html += `<div class="sec-title">🔥 热身（5 分钟，不可省略）</div>
      <div class="card">
        ${WARMUP.map((w, i) => `
          <div class="ex ${state.log[n]?.checks?.['w' + i] ? 'done' : ''}" data-check="w${i}">
            <div class="ex-check">✓</div>
            <div class="ex-body">
              <div class="ex-name" style="font-weight:500;font-size:14px;">${w.n}</div>
              <div class="ex-meta">${w.r} · ${w.cue}</div>
            </div>
          </div>`).join('')}
      </div>`;

    // 主训练
    const list = getExerciseList(n, g);
    html += `<div class="sec-title">💪 主训练（${list.length} 个动作）</div>
      <div class="card">
        <div class="form-tip">标准三原则：下放（离心）控制 2-3 秒 · 顶点不锁死关节 · 姿势变形就结束这组</div>
        ${list.map(ex => `
          <div class="ex ${state.log[n]?.checks?.[ex.idx] ? 'done' : ''}" data-check="${ex.idx}">
            <div class="ex-check">✓</div>
            <div class="ex-body">
              <div class="ex-name">${ex.n}</div>
              <div class="ex-meta">${ex.m}</div>
              <div class="ex-sets">${repText(ex, !!d.hiit, !!d.test)}</div>
              <button class="ex-toggle" data-more="${ex.idx}">${poseKeyOf(ex.n) ? '▶ 演示 + 标准做法' : '▸ 标准做法 + 要点'} / 难易调节 ▾</button>
              <div class="ex-more" id="more${ex.idx}">
                ${poseKeyOf(ex.n) ? `<div class="pose-box" data-pose="${poseKeyOf(ex.n)}"></div>` : ''}
                ${formBlock(findForm(ex.n))}
                <div><b>要点：</b>${ex.cue}</div>
                ${ex.down ? `<div><b>太难？</b>${ex.down}</div>` : ''}
                ${ex.up ? `<div><b>太简单？</b>${ex.up}</div>` : ''}
              </div>
            </div>
          </div>`).join('')}
        ${d.test ? `<div class="card" style="margin:12px 0 0;box-shadow:none;padding:12px;background:#f7f9fc;">
            <div style="font-size:13px;font-weight:600;margin-bottom:8px;">📝 记录本次自测结果</div>
            ${['俯卧撑(次)', '深蹲(次)', '平板(秒)', '单腿臀桥(次/侧)'].map((k, i) => `
              <div class="macro-row"><span class="macro-name" style="width:110px;">${k}</span>
              <input class="testin" data-test="${i}" type="number" inputmode="numeric" placeholder="0"
                value="${(state.tests[n] && state.tests[n][i]) || ''}"
                style="flex:1;background:#fff;border:1px solid var(--line);border-radius:10px;padding:8px;font-size:14px;">
              </div>`).join('')}
          </div>` : ''}
        <button class="btn ghost full" id="btnRest" style="margin-top:14px;">⏱ 组间休息计时器</button>
      </div>`;

    // 放松
    html += `<div class="sec-title">🧘 放松拉伸（5 分钟）</div>
      <div class="card">
        ${COOLDOWN.map((c, i) => `
          <div class="ex ${state.log[n]?.checks?.['c' + i] ? 'done' : ''}" data-check="c${i}">
            <div class="ex-check">✓</div>
            <div class="ex-body">
              <div class="ex-name" style="font-weight:500;font-size:14px;">${c.n}</div>
              <div class="ex-meta">${c.r} · ${c.cue}</div>
            </div>
          </div>`).join('')}
      </div>`;

    // 性别方案说明
    const gn = GENDER_NOTES[g];
    html += `<div class="card">
      <h3 class="ctitle">${gn.label} · 设计逻辑</h3>
      <div class="chips">${gn.tags.map(t => `<span class="chip ${genderChip()}">${t}</span>`).join('')}</div>
      <ul class="tips" style="margin:0;padding-left:18px;">${gn.notes.map(t => `<li style="font-size:12.5px;">${t}</li>`).join('')}</ul>
    </div>`;
  }

  html += `<button class="btn ${done ? 'ghost' : 'green'} big full" id="btnDone">${done ? '✓ 今日已完成（点击取消）' : '完成今日训练'}</button>`;

  if (viewDay && viewDay !== dayNumber()) {
    html = `<div class="card warn" style="display:flex;justify-content:space-between;align-items:center;">
        <div style="font-size:13px;">正在查看 <b>第 ${viewDay} 天</b>，非今天</div>
        <button class="btn line" id="btnBackToday" style="padding:6px 12px;">回到今天</button>
      </div>` + html;
  }
  $('#page-today').innerHTML = html;
  bindToday(n);
}

/* 展开动作详情时按需挂载骨架动画（不展开就不播放，省电） */
function mountDemosIn(scope) {
  $$('.pose-box[data-pose]', scope).forEach(box => {
    if (box.dataset.mounted) return;
    box.dataset.mounted = '1';
    const pose = POSES[box.dataset.pose];
    if (pose && pose.f.length > 1) {
      const hint = document.createElement('div');
      hint.className = 'pose-hint';
      hint.textContent = pose.label + ' · ' + pose.tip + '（点击暂停 / 继续）';
      box.appendChild(hint);
    }
    mountPose(box, box.dataset.pose);
  });
}

function bindToday(n) {
  $$('#page-today .ex[data-check]').forEach(el => {
    el.onclick = (e) => {
      if (e.target.classList.contains('ex-toggle')) return;
      const k = el.dataset.check;
      state.log[n] = state.log[n] || { checks: {} };
      state.log[n].checks = state.log[n].checks || {};
      state.log[n].checks[k] = !state.log[n].checks[k];
      save(); el.classList.toggle('done', !!state.log[n].checks[k]);
      updateDoneBtn(n);
    };
  });
  $$('#page-today .ex-toggle').forEach(b => {
    b.onclick = (e) => {
      e.stopPropagation();
      const box = $('#more' + b.dataset.more);
      box.classList.toggle('open');
      if (box.classList.contains('open')) mountDemosIn(box);
    };
  });
  $$('#page-today .testin').forEach(inp => {
    inp.oninput = () => {
      state.tests[n] = state.tests[n] || {};
      state.tests[n][inp.dataset.test] = inp.value; save();
    };
  });
  const br = $('#btnRest'); if (br) br.onclick = () => openTimer(90);
  $('#btnDone').onclick = () => {
    const cur = !!state.log[n]?.done;
    if (cur) { delete state.log[n]; toast('已取消今日打卡'); }
    else {
      state.log[n] = state.log[n] || { checks: {} };
      state.log[n].done = true; state.log[n].date = todayStr();
      toast('打卡成功！坚持就是胜利 💪');
    }
    save(); renderToday(); renderTop();
  };
  const bt = $('#btnBackToday');
  if (bt) bt.onclick = () => { viewDay = null; switchPage('today'); };
}
function updateDoneBtn(n) {
  const b = $('#btnDone'); if (!b) return;
  const done = !!state.log[n]?.done;
  b.className = 'btn ' + (done ? 'ghost' : 'green') + ' big full';
  b.textContent = done ? '✓ 今日已完成（点击取消）' : '完成今日训练';
}

/* ============================================================
 *  90天计划
 * ============================================================ */
function renderPlan() {
  let html = '';
  PHASES.forEach((p, i) => {
    const cur = getDayInfo(dayNumber()).phaseIndex === i;
    html += `<div class="card phase-card" style="${cur ? 'border-left:4px solid var(--accent);' : 'opacity:.8;'}">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <h3 class="ctitle">${p.name}</h3>
        ${cur ? '<span class="chip m">当前阶段</span>' : ''}
      </div>
      <p class="csub">${p.range} · ${p.focus}</p>
      <div style="font-size:13px;">${p.desc}</div>
      <div class="chips" style="margin:10px 0 0;">
        <span class="chip">${p.sets} 组/动作</span>
        <span class="chip">组歇 ${p.rest}</span>
        <span class="chip">${p.rpe}</span>
        <span class="chip o">HIIT ${p.cardio.rounds} 轮 ${p.cardio.work}/${p.cardio.rest} 秒</span>
      </div>
    </div>`;
  });

  html += `<div class="sec-title">📅 周视图</div>
    <div class="week-nav">${Array.from({ length: 13 }, (_, i) => i + 1).map(w =>
    `<button data-week="${w}" class="${w === viewWeek ? 'on' : ''} ${[4, 8, 12].includes(w) ? 'deload' : ''}">第${w}周${[4, 8, 12].includes(w) ? '·减' : ''}</button>`).join('')}</div>`;

  html += '<div id="weekList">';
  const startD = (viewWeek - 1) * 7 + 1;
  for (let d = startD; d <= Math.min(startD + 6, 90); d++) {
    const info = getDayInfo(d);
    const dd = info.day;
    const isToday = d === dayNumber();
    const isDone = !!state.log[d]?.done;
    const list = dd.rest ? (dd.recovery || []) : getExerciseList(d, state.gender);
    html += `<div class="dayrow ${dd.rest ? 'rest' : ''}" data-day="${d}">
      <div class="dr-wd"><b>${info.weekday}</b><span>D${d}</span></div>
      <div class="dr-main">
        <div class="dr-title">${dd.title}</div>
        <div class="dr-sub">${dd.muscles.slice(0, 4).join(' · ') || dd.sub}</div>
      </div>
      ${isDone ? '<span class="dr-tag done">已完成</span>' : (isToday ? '<span class="dr-tag today">今天</span>' : `<span class="dr-tag">${list.length} 项</span>`)}
    </div>`;
  }
  html += '</div>';

  html += `<div class="sec-title">🏆 90 天后你可以期待什么</div>
    <div class="card">
      <ul class="tips" style="margin:0;padding-left:18px;">
        <li>力量：俯卧撑从基线提升 30-60%，深蹲 1 分钟次数显著提升</li>
        <li>围度：体脂下降 3-6 个百分点（配合饮食），腰围减少 3-8 cm</li>
        <li>形态：体态改善（圆肩驼背减轻）、臀线与肩线显现</li>
        <li>习惯：建立稳定的训练节律，第 91 天起进入"保持期"（每周 3-4 天维持）</li>
      </ul>
      <div style="font-size:12px;color:var(--text3);margin-top:8px;">注：个体差异大，建议每 2 周固定条件拍照 + 量围度，比体重秤更可靠。</div>
    </div>`;

  $('#page-plan').innerHTML = html;
  $$('#page-plan .week-nav button').forEach(b => b.onclick = () => { viewWeek = +b.dataset.week; renderPlan(); });
  $$('#page-plan .dayrow').forEach(r => r.onclick = () => { viewDay = +r.dataset.day; renderTop(); switchPage('today'); });
}

/* ============================================================
 *  饮食
 * ============================================================ */
function renderDiet() {
  const g = state.gender;
  const d = calcDiet(g, state.goal, state.weight, state.height, state.age);
  const goalName = { fatloss: '减脂', muscle: '增肌', recomp: '塑形 / 维持' }[state.goal];
  const kcalAll = d.protein * 4 + d.fat * 9 + d.carb * 4;
  const plan = MEAL_PLANS[g][state.goal === 'recomp' ? 'muscle' : state.goal];

  let html = `
    <div class="card acc">
      <h2 class="ctitle">每日热量目标</h2>
      <p class="csub">${g === 'male' ? '男性' : '女性'} · ${goalName} · ${state.weight}kg / ${state.height}cm / ${state.age}岁</p>
      <div class="kcal-grid">
        <div class="kcal-box"><b>${d.bmr}</b><span>基础代谢 BMR</span></div>
        <div class="kcal-box"><b>${d.tdee}</b><span>每日消耗 TDEE</span></div>
        <div class="kcal-box" style="background:var(--accent-soft);"><b>${d.target}</b><span>目标摄入 kcal</span></div>
      </div>
      <div style="font-size:12px;color:var(--text2);margin-top:10px;">${d.note}</div>
    </div>

    <div class="card">
      <h3 class="ctitle">三大宏量营养素分配</h3>
      <p class="csub">按体重 ${state.weight}kg 计算 · 合计 ≈ ${Math.round(kcalAll)} kcal</p>
      ${[
      ['蛋白质', d.protein, 4, '#2f6bed'],
      ['脂肪', d.fat, 9, '#f08a24'],
      ['碳水', d.carb, 4, '#12a870']
    ].map(([n, v, k, c]) => `
        <div class="macro-row">
          <span class="macro-name">${n}</span>
          <span class="macro-bar"><i style="width:${Math.round(v * k / kcalAll * 100)}%;background:${c};"></i></span>
          <span class="macro-val">${v} g · ${Math.round(v * k / kcalAll * 100)}%</span>
        </div>`).join('')}
      <div style="font-size:12px;color:var(--text2);margin-top:8px;">
        蛋白质供能比 ≈ ${Math.round(d.protein * 4 / kcalAll * 100)}%；
        水 ${d.water} L/天；膳食纤维 ${d.fiber} g/天。
      </div>
    </div>

    <div class="sec-title">🍽 一日餐单示例（${plan.name} ≈ ${plan.kcal} kcal）</div>
    <div class="card">
      ${plan.meals.map(m => `
        <div class="meal">
          <div class="meal-t">${m.t}</div>
          <div><div class="meal-c">${m.c}</div><div class="meal-p">${m.p}</div></div>
        </div>`).join('')}
      <div style="font-size:12px;color:var(--text2);margin-top:10px;">
        你的目标是 <b>${d.target} kcal</b>：每比示例多/少 200 kcal，主食 ±50g（熟重）或食用油 ±10g 即可。
      </div>
    </div>

    <div class="sec-title">🔄 食物交换表（自由搭配，不重样）</div>
    <div class="card">
      ${Object.values(FOOD_EXCHANGE).map(fx => `
        <div class="fx-group">
          <div class="fx-title">${fx.name}</div>
          <div class="fx-items">${fx.items.map(i => `<span class="fx-item">${i.n} <b>${i.q}</b></span>`).join('')}</div>
        </div>`).join('')}
      <div style="font-size:12px;color:var(--text2);">
        算法：蛋白质目标 ${d.protein}g ÷ 7 ≈ <b>${(d.protein / 7).toFixed(1)} 份</b>；
        碳水 ${d.carb}g ÷ 15 ≈ <b>${(d.carb / 15).toFixed(1)} 份</b>；
        脂肪 ${d.fat}g ÷ 5 ≈ <b>${(d.fat / 5).toFixed(1)} 份</b>；蔬菜每餐 ≥1 份。
      </div>
    </div>

    <div class="sec-title">💡 ${g === 'male' ? '男性' : '女性'}饮食要点</div>
    <div class="card ${g === 'male' ? 'acc' : ''}" style="border-left:4px solid ${g === 'male' ? 'var(--male)' : 'var(--female)'};">
      <ul class="tips" style="margin:0;padding-left:18px;">${DIET_TIPS[g].map(t => `<li>${t}</li>`).join('')}</ul>
    </div>

    <div class="sec-title">📆 90 天饮食节奏</div>
    <div class="card">
      <ul class="tips" style="margin:0;padding-left:18px;">
        <li><b>训练日（周一至周六）</b>：按目标热量吃足，碳水保证训练强度</li>
        <li><b>休息日（周日）</b>：主食减少 10-15%，用蛋白质与蔬菜补足饱腹感</li>
        <li><b>每 4 周复评</b>：体重下降 &gt; 体重 1%/周 → 加回 100-150 kcal；2 周无变化 → 再减 100 kcal 或增加日常活动量</li>
        <li><b>测量方式</b>：晨起空腹、如厕后、同一件衣服，取 7 天平均值看趋势</li>
        <li><b>别极端</b>：每日热量不低于 BMR，女性不低于 1200 kcal、男性不低于 1500 kcal</li>
      </ul>
    </div>`;
  $('#page-diet').innerHTML = html;
}

/* ============================================================
 *  进度
 * ============================================================ */
function renderProgress() {
  const n = dayNumber();
  const doneDays = Object.keys(state.log).filter(k => state.log[k].done).map(Number);
  const total = doneDays.length;
  // 连续天数
  let streak = 0;
  for (let i = n; i >= 1; i--) { if (state.log[i]?.done) streak++; else if (i !== n) break; }
  const weekStart = Math.floor((n - 1) / 7) * 7 + 1;
  const weekDone = doneDays.filter(d => d >= weekStart && d <= weekStart + 6).length;

  let html = `
    <div class="card">
      <div class="stat-grid">
        <div class="stat"><b>${total}</b><span>已完成天数</span></div>
        <div class="stat"><b>${streak}</b><span>连续打卡</span></div>
        <div class="stat"><b>${weekDone}/6</b><span>本周训练</span></div>
      </div>
    </div>

    <div class="sec-title">🗓 90 天打卡日历</div>
    <div class="card">
      <div class="cal">${['一', '二', '三', '四', '五', '六', '日'].map(w => `<div class="cal-h">${w}</div>`).join('')}
        ${renderCal(n)}
      </div>
      <div style="display:flex;gap:14px;font-size:11px;color:var(--text3);margin-top:10px;flex-wrap:wrap;">
        <span><i style="display:inline-block;width:10px;height:10px;background:var(--green);border-radius:3px;"></i> 已完成</span>
        <span><i style="display:inline-block;width:10px;height:10px;background:#eceff4;border-radius:3px;"></i> 休息日</span>
        <span><i style="display:inline-block;width:10px;height:10px;background:#fdecec;border-radius:3px;"></i> 未打卡</span>
      </div>
    </div>

    <div class="sec-title">⚖️ 体重曲线</div>
    <div class="card">
      <div class="log-row">
        <input type="number" step="0.1" id="wInput" placeholder="今日体重 (kg)" inputmode="decimal">
        <button class="btn" id="wAdd">记录</button>
      </div>
      <canvas id="weightChart"></canvas>
      <div class="wlist" id="wList"></div>
    </div>

    <div class="sec-title">🏅 阶段自测记录</div>
    <div class="card">
      ${[4, 8, 12].map(w => {
        const day = (w - 1) * 7 + 6;
        const t = state.tests[day];
        return `<div style="font-size:13px;padding:8px 0;border-bottom:1px dashed var(--line);display:flex;justify-content:space-between;">
          <span>第 ${w} 周（第 ${day} 天）</span>
          <span style="color:${t ? 'var(--green)' : 'var(--text3)'};">${t ? `俯卧撑 ${t[0] || '-'} · 深蹲 ${t[1] || '-'} · 平板 ${t[2] || '-'} · 臀桥 ${t[3] || '-'}` : '未记录'}</span>
        </div>`;
      }).join('')}
      <div style="font-size:12px;color:var(--text3);margin-top:8px;">减量周的第 6 天是自测日，在「今日」页填写即可。</div>
    </div>

    <div class="card ok">
      <h3 class="ctitle">如何判断计划有效</h3>
      <ul class="tips" style="margin:0;padding-left:18px;">
        <li>连续 2 周体重/围度无变化 → 检查饮食热量与蛋白质是否达标</li>
        <li>力量持续上升但体重不变 → 正在进行"身体重组"，是好事</li>
        <li>持续疲劳、睡眠差、静息心率升高 → 恢复不足，主动加一次休息</li>
      </ul>
    </div>`;

  $('#page-progress').innerHTML = html;
  $('#wAdd').onclick = () => {
    const v = parseFloat($('#wInput').value);
    if (!v) return toast('请输入体重');
    state.weight = v;
    const t = todayStr();
    const ex = state.weights.findIndex(x => x.d === t);
    if (ex >= 0) state.weights[ex].w = v; else state.weights.push({ d: t, w: v });
    save(); renderProgress(); toast('已记录');
  };
  renderWList(); drawChart();
}

function renderCal(n) {
  let h = '';
  const offset = 0; // 第一天是周一
  for (let i = 0; i < offset; i++) h += '<div></div>';
  for (let d = 1; d <= 90; d++) {
    const info = getDayInfo(d);
    const isRest = !!info.day.rest;
    const done = !!state.log[d]?.done;
    const cls = done ? 'done' : (isRest ? 'rest' : (d < n ? 'miss' : ''));
    h += `<div class="cal-d ${cls} ${d === n ? 'today' : ''}">${info.day.rest ? '' : d}</div>`;
  }
  return h;
}

function renderWList() {
  const el = $('#wList'); if (!el) return;
  const arr = state.weights.slice().slice(-8).reverse();
  el.innerHTML = arr.map((x, i) => {
    const prev = state.weights[state.weights.length - 1 - i - 1];
    const diff = prev ? (x.w - prev.w) : 0;
    const c = diff > 0 ? 'var(--red)' : (diff < 0 ? 'var(--green)' : 'var(--text3)');
    return `<div><span>${x.d}</span><span><b>${x.w}</b> kg <span style="color:${c}">${diff ? (diff > 0 ? '+' : '') + diff.toFixed(1) : ''}</span></span></div>`;
  }).join('') || '<div style="color:var(--text3);">暂无记录</div>';
}

function drawChart() {
  const cv = $('#weightChart'); if (!cv) return;
  const dpr = window.devicePixelRatio || 1;
  const W = cv.clientWidth || 320, H = 180;
  cv.width = W * dpr; cv.height = H * dpr;
  const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);
  const data = state.weights.slice();
  if (data.length < 2) {
    ctx.fillStyle = '#98a1b3'; ctx.font = '13px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('记录 2 次以上体重后显示曲线', W / 2, H / 2);
    return;
  }
  const pad = { l: 36, r: 12, t: 14, b: 22 };
  const vals = data.map(d => d.w);
  let min = Math.min(...vals), max = Math.max(...vals);
  if (max - min < 1) { min -= 1; max += 1; }
  const x = i => pad.l + i * (W - pad.l - pad.r) / (data.length - 1);
  const y = v => pad.t + (max - v) * (H - pad.t - pad.b) / (max - min);
  // 网格
  ctx.strokeStyle = '#eef1f6'; ctx.lineWidth = 1; ctx.font = '10px sans-serif'; ctx.fillStyle = '#98a1b3';
  for (let i = 0; i <= 3; i++) {
    const v = min + (max - min) * i / 3, yy = y(v);
    ctx.beginPath(); ctx.moveTo(pad.l, yy); ctx.lineTo(W - pad.r, yy); ctx.stroke();
    ctx.textAlign = 'right'; ctx.fillText(v.toFixed(1), pad.l - 5, yy + 3);
  }
  // 折线
  ctx.beginPath(); ctx.strokeStyle = '#2f6bed'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
  data.forEach((d, i) => i ? ctx.lineTo(x(i), y(d.w)) : ctx.moveTo(x(i), y(d.w)));
  ctx.stroke();
  // 面积
  ctx.lineTo(x(data.length - 1), H - pad.b); ctx.lineTo(x(0), H - pad.b); ctx.closePath();
  ctx.fillStyle = 'rgba(47,107,237,.10)'; ctx.fill();
  // 点
  data.forEach((d, i) => {
    ctx.beginPath(); ctx.arc(x(i), y(d.w), 3.2, 0, 7); ctx.fillStyle = '#fff'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#2f6bed'; ctx.stroke();
  });
  ctx.fillStyle = '#98a1b3'; ctx.textAlign = 'left';
  ctx.fillText(data[0].d.slice(5), pad.l, H - 6);
  ctx.textAlign = 'right';
  ctx.fillText(data[data.length - 1].d.slice(5), W - pad.r, H - 6);
}

/* ============================================================
 *  设置
 * ============================================================ */
function openSettings() {
  const d = calcDiet(state.gender, state.goal, state.weight, state.height, state.age);
  const sh = document.createElement('div');
  sh.className = 'sheet';
  sh.innerHTML = `<div class="sheet-in">
    <h3>设置</h3>
    <div class="ob-block">
      <label class="ob-label">性别</label>
      <div class="ob-seg" id="stGender">
        <button data-g="male" class="${state.gender === 'male' ? 'on' : ''}">男性</button>
        <button data-g="female" class="${state.gender === 'female' ? 'on' : ''}">女性</button>
      </div>
    </div>
    <div class="ob-block">
      <label class="ob-label">目标</label>
      <div class="ob-seg" id="stGoal">
        <button data-g="fatloss" class="${state.goal === 'fatloss' ? 'on' : ''}">减脂</button>
        <button data-g="muscle" class="${state.goal === 'muscle' ? 'on' : ''}">增肌</button>
        <button data-g="recomp" class="${state.goal === 'recomp' ? 'on' : ''}">塑形</button>
      </div>
    </div>
    <div class="ob-block">
      <label class="ob-label">身体数据</label>
      <div class="ob-row">
        <div class="field"><input type="number" id="stAge" value="${state.age}"><span>岁</span></div>
        <div class="field"><input type="number" id="stHeight" value="${state.height}"><span>cm</span></div>
        <div class="field"><input type="number" id="stWeight" step="0.5" value="${state.weight}"><span>kg</span></div>
      </div>
    </div>
    <div class="ob-block">
      <label class="ob-label">动作演示动画</label>
      <div class="ob-seg" id="stAnim">
        <button data-g="on" class="${state.anim === false ? '' : 'on'}">开启</button>
        <button data-g="off" class="${state.anim === false ? 'on' : ''}">关闭（省电）</button>
      </div>
      <div style="font-size:11px;color:var(--text3);margin-top:6px;">展开动作详情时播放矢量骨架演示。关闭后只显示文字要点。</div>
    </div>
    <div class="ob-block">
      <label class="ob-label">开始日期</label>
      <div class="field"><input type="date" id="stStart" value="${state.startDate}"></div>
      <div style="font-size:11px;color:var(--text3);margin-top:6px;">第 1 天固定为「周一」，改这里可把计划对齐到任意日期。当前目标热量：${d.target} kcal</div>
    </div>
    <button class="btn full big" id="stSave">保存</button>
    <button class="btn ghost full" id="stReset" style="margin-top:10px;color:var(--red);">清空所有数据</button>
    <button class="btn ghost full" id="stClose" style="margin-top:10px;">关闭</button>
  </div>`;
  document.body.appendChild(sh);
  sh.onclick = e => { if (e.target === sh) sh.remove(); };
  $$('#stGender button', sh).forEach(b => b.onclick = () => { $$('#stGender button', sh).forEach(x => x.classList.remove('on')); b.classList.add('on'); });
  $$('#stGoal button', sh).forEach(b => b.onclick = () => { $$('#stGoal button', sh).forEach(x => x.classList.remove('on')); b.classList.add('on'); });
  $$('#stAnim button', sh).forEach(b => b.onclick = () => { $$('#stAnim button', sh).forEach(x => x.classList.remove('on')); b.classList.add('on'); });
  $('#stClose', sh).onclick = () => sh.remove();
  $('#stReset', sh).onclick = () => {
    if (confirm('确定清空所有打卡记录？此操作不可恢复。')) {
      localStorage.removeItem(KEY); location.reload();
    }
  };
  $('#stSave', sh).onclick = () => {
    const gOn = $('#stGender .on', sh), goOn = $('#stGoal .on', sh);
    const aOn = $('#stAnim .on', sh);
    state.anim = aOn ? aOn.dataset.g !== 'off' : state.anim;
    state.gender = gOn ? gOn.dataset.g : state.gender;
    state.goal = goOn ? goOn.dataset.g : state.goal;
    state.age = +$('#stAge', sh).value || state.age;
    state.height = +$('#stHeight', sh).value || state.height;
    state.weight = +$('#stWeight', sh).value || state.weight;
    state.startDate = $('#stStart', sh).value || state.startDate;
    save(); sh.remove(); renderAll(); toast('已保存');
  };
}

/* ============================================================
 *  计时器
 * ============================================================ */
let tmTimer = null, tmLeft = 0, tmTotal = 0;
function openTimer(sec) {
  $('#timer').classList.remove('hidden');
  startTimer(sec);
}
function startTimer(sec) {
  clearInterval(tmTimer);
  tmTotal = sec; tmLeft = sec;
  updateTimer();
  tmTimer = setInterval(() => {
    tmLeft--; updateTimer();
    if (tmLeft <= 0) { clearInterval(tmTimer); beep(); toast('休息结束，开始下一组！'); $('#timer').classList.add('hidden'); }
  }, 1000);
}
function updateTimer() {
  $('#tmNum').textContent = tmLeft;
  const C = 2 * Math.PI * 52;
  $('#tmFg').style.strokeDasharray = C;
  $('#tmFg').style.strokeDashoffset = C * (1 - tmLeft / tmTotal);
}
function beep() {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const o = ac.createOscillator(), g = ac.createGain();
    o.connect(g); g.connect(ac.destination);
    o.frequency.value = 880; o.type = 'sine'; g.gain.value = .2;
    o.start(); setTimeout(() => { o.stop(); ac.close(); }, 600);
  } catch (e) { }
}
function initTimer() {
  $('#tmClose').onclick = () => { clearInterval(tmTimer); $('#timer').classList.add('hidden'); };
  $$('.tm-btns button').forEach(b => b.onclick = () => startTimer(+b.dataset.sec));
}

/* ============================================================
 *  路由
 * ============================================================ */
function switchPage(p) {
  currentPage = p;
  ['today', 'plan', 'diet', 'progress'].forEach(k => $('#page-' + k).classList.toggle('hidden', k !== p));
  $$('.tab').forEach(t => t.classList.toggle('on', t.dataset.page === p));
  window.scrollTo(0, 0);
  if (p === 'today') renderToday();
  if (p === 'plan') renderPlan();
  if (p === 'diet') renderDiet();
  if (p === 'progress') renderProgress();
}
function renderAll() { renderTop(); switchPage(currentPage); }

/* ============================================================
 *  启动
 * ============================================================ */
function boot() {
  viewWeek = getDayInfo(dayNumber()).week;
  initTimer();
  $$('.tab').forEach(t => t.onclick = () => switchPage(t.dataset.page));
  $('#btnSettings').onclick = openSettings;
  window.addEventListener('resize', () => { if (currentPage === 'progress') drawChart(); });
  renderAll();
}

if (state.started && state.gender) {
  $('#onboard').classList.add('hidden');
  $('#app').classList.remove('hidden');
  boot();
} else {
  initOnboard();
}
