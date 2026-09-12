const storeKey = 'bloom-checkins-v1';
const state = JSON.parse(localStorage.getItem(storeKey) || '{"entries":[],"consent":false}');
const iconMap = { great: '✦', good: '☀', okay: '●', low: '☁', anxious: '≈', rough: '☂' };
let selectedMood = null;
const $ = (selector) => document.querySelector(selector);

function save() { localStorage.setItem(storeKey, JSON.stringify(state)); }
function dateKey(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
function prettyDate(date) { return new Intl.DateTimeFormat('en-US', { month:'short', day:'numeric' }).format(new Date(date + 'T12:00:00')); }
function showScreen(target) {
  document.querySelectorAll('.screen').forEach(x => x.classList.remove('active'));
  $('#' + target).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(x => x.classList.toggle('active', x.dataset.target === target));
  window.scrollTo(0, 0);
}
function toast(text) { const el = $('#toast'); el.textContent = text; el.classList.add('visible'); setTimeout(() => el.classList.remove('visible'), 2400); }
function todayEntry() { return state.entries.find(x => x.date === dateKey()); }
function setTodayTitle() { $('#todayLabel').textContent = new Intl.DateTimeFormat('en-US', {weekday:'long',month:'long',day:'numeric'}).format(new Date()).toUpperCase(); }

function renderHome() {
  const entry = todayEntry();
  if (!entry) return;
  $('#todayMoodIcon').textContent = iconMap[entry.mood];
  $('#todayMoodLabel').textContent = entry.label;
  $('#todayReflection').textContent = entry.note || 'Every small check-in matters.';
  const dates = new Set(state.entries.map(x => x.date));
  let streak = 0, day = new Date();
  while (dates.has(dateKey(day))) { streak++; day.setDate(day.getDate() - 1); }
  $('#streakCount').textContent = streak || 1;
  renderWeek(); renderPatterns();
}
function renderWeek() {
  const chart = $('#weekChart'); chart.innerHTML = '';
  const formatter = new Intl.DateTimeFormat('en-US',{weekday:'short'});
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const entry = state.entries.find(x => x.date === dateKey(d));
    const col = document.createElement('div'); col.className = 'day-column';
    col.innerHTML = `<span class="mood-dot ${entry ? '' : 'empty'}">${entry ? iconMap[entry.mood] : ''}</span><span>${formatter.format(d).slice(0,1)}</span>`;
    chart.append(col);
  }
}
function renderPatterns() {
  const list = $('#historyList'); list.innerHTML = '';
  [...state.entries].sort((a,b) => b.date.localeCompare(a.date)).slice(0, 10).forEach(entry => {
    const row = document.createElement('div'); row.className='history-item';
    row.innerHTML = `<span class="history-icon">${iconMap[entry.mood]}</span><div><strong>${entry.label}</strong><small>${prettyDate(entry.date)}${entry.note ? ' · Reflection saved' : ''}</small></div>`;
    list.append(row);
  });
  const headline = $('#patternHeadline'), copy = $('#patternCopy');
  if (state.entries.length >= 3) { headline.textContent = 'You have made space for yourself ' + state.entries.length + ' times.'; copy.textContent = 'Keep checking in. Patterns become clearer over time, especially around busy school weeks.'; }
}
function startCheckin(mood) {
  selectedMood = mood;
  $('#selectedMoodIcon').textContent = iconMap[mood.mood]; $('#selectedMoodText').textContent = mood.label;
  const old = todayEntry(); $('#reflectionInput').value = old?.note || ''; $('#characterCount').textContent = $('#reflectionInput').value.length + ' / 280';
  showScreen('reflection');
}
function saveCheckin() {
  if (!selectedMood) return;
  const entries = state.entries.filter(x => x.date !== dateKey());
  entries.push({ date: dateKey(), ...selectedMood, note: $('#reflectionInput').value.trim() }); state.entries = entries; save(); renderHome(); showScreen('home'); toast('Your check-in is saved.');
}
function addMessage(text, type) { const msg=document.createElement('div'); msg.className='message '+type; msg.textContent=text; $('#chatMessages').append(msg); $('#chatMessages').scrollTop=99999; }

document.querySelectorAll('.mood-card').forEach(btn => btn.addEventListener('click', () => startCheckin({ mood:btn.dataset.mood, label:btn.dataset.label, score:+btn.dataset.score })));
document.querySelectorAll('[data-target]').forEach(btn => btn.addEventListener('click', () => showScreen(btn.dataset.target)));
$('#skipButton').addEventListener('click', () => { showScreen('home'); toast('That’s okay. Come back whenever you want.'); });
$('#saveCheckin').addEventListener('click', saveCheckin);
$('#reflectionInput').addEventListener('input', e => $('#characterCount').textContent = e.target.value.length + ' / 280');
$('#editCheckin').addEventListener('click', () => { const e = todayEntry(); if (e) startCheckin(e); else showScreen('checkin'); });
$('#supportButton').addEventListener('click', () => showScreen('support'));
$('#settingsButton').addEventListener('click', () => showScreen('privacy'));
$('#patternsLink').addEventListener('click', () => showScreen('patterns'));
$('#researchConsent').checked = !!state.consent;
$('#researchConsent').addEventListener('change', e => { state.consent=e.target.checked; save(); toast(e.target.checked ? 'Anonymous research sharing is on.' : 'Research sharing is off.'); });
$('#eraseData').addEventListener('click', () => { if (confirm('Erase all saved check-ins and settings from this device?')) { state.entries=[]; state.consent=false; save(); showScreen('checkin'); toast('Your local data was erased.'); } });
$('#chatForm').addEventListener('submit', async e => {
  e.preventDefault();
  const text = $('#chatInput').value.trim();
  if (!text) return;
  addMessage(text, 'user');
  $('#chatInput').value = '';

  // Safety support is shown before sending any urgent message to the model.
  if (/(kill myself|suicide|hurt myself|self harm|want to die|end my life)/i.test(text)) {
    addMessage('I’m really glad you told me. Your safety matters most. Please use “Need support right now?” to contact a local helpline or emergency service, and tell a trusted adult nearby.', 'bot');
    return;
  }

  const typing = document.createElement('div');
  typing.className = 'message bot';
  typing.textContent = 'Bloom is thinking…';
  $('#chatMessages').append(typing);
  $('#chatMessages').scrollTop = 99999;

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Bloom could not reply.');
    typing.textContent = data.reply;
  } catch (error) {
    typing.textContent = 'I’m having trouble connecting right now. Please make sure Ollama and Bloom’s local server are running, then try again.';
  }
});

setTodayTitle();
renderHome();
showScreen(todayEntry() ? 'home' : 'checkin');
