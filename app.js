/* =========================================================
   BLOOM 2.0
   Local-first wellbeing companion
========================================================= */

const STORE_KEY = "bloom-checkins-v3";

const DEFAULT_STATE = {
  entries: [],
  journals: [],
  goals: [],
  conversations: [],
  memory: [],
  sleep: [],
  achievements: [],
  calmSessions: 0,
  focusSessions: 0,

  profile: {
    name: ""
  },

  settings: {
    memoryConsent: false,
    researchConsent: false,
    remindersEnabled: false,
    reminderTime: "20:00",
    theme: "light",
    fontSize: "normal",
    personality: "calm"
  }
};

let state;

try {
  state = JSON.parse(localStorage.getItem(STORE_KEY));
} catch {
  state = null;
}

state = state || structuredClone(DEFAULT_STATE);

state = {
  ...structuredClone(DEFAULT_STATE),
  ...state,

  profile: {
    ...DEFAULT_STATE.profile,
    ...(state.profile || {})
  },

  settings: {
    ...DEFAULT_STATE.settings,
    ...(state.settings || {})
  }
};

let selectedMood = null;
let selectedFactors = [];
let selectedConversationId = null;

let breathingInterval = null;
let breathingRemaining = 60;
let breathingPhase = 0;
let breathingPhaseTime = 0;
let selectedExercise = "classic";

let groundingIndex = 0;

let focusInterval = null;
let focusSeconds = 25 * 60;
let focusRunning = false;

const $ = selector => document.querySelector(selector);

const iconMap = {
  great: "✦",
  good: "☀",
  okay: "●",
  low: "☁",
  anxious: "≈",
  rough: "☂"
};

const moodScores = {
  great: 5,
  good: 4,
  okay: 3,
  low: 2,
  anxious: 2,
  rough: 1
};


/* =========================================================
   STORAGE
========================================================= */

function save() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

function dateKey(date = new Date()) {

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function prettyDate(date) {

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(date + "T12:00:00"));
}

function showScreen(target) {

  const screen = $("#" + target);

  if (!screen) return;

  document.querySelectorAll(".screen")
    .forEach(s => s.classList.remove("active"));

  screen.classList.add("active");

  document.querySelectorAll(".nav-item")
    .forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.target === target
      );
    });

  if (target === "home") renderHome();
  if (target === "chat") renderChat();
  if (target === "journal") renderJournals();
  if (target === "patterns") renderPatterns();
  if (target === "timeline") renderTimeline();
  if (target === "achievements") renderAchievements();
  if (target === "privacy") renderSettings();
  if (target === "goals") renderGoals();

  window.scrollTo(0, 0);
}

function toast(text) {

  const element = $("#toast");

  if (!element) return;

  element.textContent = text;
  element.classList.add("visible");

  setTimeout(() => {
    element.classList.remove("visible");
  }, 2400);
}


/* =========================================================
   PROFILE / THEME
========================================================= */

function applyAppearance() {

  document.body.classList.remove(
    "dark",
    "sage",
    "large",
    "xl"
  );

  if (state.settings.theme === "dark") {
    document.body.classList.add("dark");
  }

  if (state.settings.theme === "sage") {
    document.body.classList.add("sage");
  }

  if (state.settings.fontSize === "large") {
    document.body.classList.add("large");
  }

  if (state.settings.fontSize === "xl") {
    document.body.classList.add("xl");
  }

  document.querySelectorAll(".theme-choice")
    .forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.theme === state.settings.theme
      );
    });

  $("#themeButton").textContent =
    state.settings.theme === "dark" ? "☀" : "☾";
}

function saveProfile() {

  state.profile.name =
    $("#profileName").value.trim();

  save();

  renderHome();

  toast("Profile saved 🌱");
}


/* =========================================================
   CHECK-IN
========================================================= */

function todayEntry() {

  return state.entries.find(
    entry => entry.date === dateKey()
  );
}

function startCheckin(mood) {

  selectedMood = mood;

  selectedFactors = [];

  $("#selectedMoodIcon").textContent =
    iconMap[mood.mood];

  $("#selectedMoodText").textContent =
    mood.label;

  const old = todayEntry();

  $("#reflectionInput").value =
    old?.note || "";

  selectedFactors =
    old?.factors || [];

  document.querySelectorAll("[data-factor]")
    .forEach(button => {
      button.classList.toggle(
        "active",
        selectedFactors.includes(button.dataset.factor)
      );
    });

  $("#characterCount").textContent =
    `${$("#reflectionInput").value.length} / 500`;

  showScreen("reflection");
}

function saveCheckin() {

  if (!selectedMood) return;

  const today = dateKey();

  state.entries =
    state.entries.filter(
      entry => entry.date !== today
    );

  state.entries.push({
    id: Date.now(),
    date: today,
    ...selectedMood,
    note: $("#reflectionInput").value.trim(),
    factors: selectedFactors
  });

  save();

  checkAchievements();

  showScreen("home");

  toast("Your check-in is saved 🌱");
}


/* =========================================================
   HOME
========================================================= */

function setTodayTitle() {

  $("#todayLabel").textContent =
    new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric"
    })
      .format(new Date())
      .toUpperCase();
}

function renderHome() {

  const entry = todayEntry();

  if (state.profile.name) {
    $("#homeName").textContent =
      state.profile.name;
  } else {
    $("#homeName").textContent = "there";
  }

  if (entry) {

    $("#todayMoodIcon").textContent =
      iconMap[entry.mood];

    $("#todayMoodLabel").textContent =
      entry.label;

    $("#todayReflection").textContent =
      entry.note ||
      "Every small check-in matters.";

    $("#editCheckin").textContent =
      "Edit check-in";

  } else {

    $("#todayMoodIcon").textContent = "○";
    $("#todayMoodLabel").textContent = "Not checked in";
    $("#todayReflection").textContent =
      "How are you feeling today?";

    $("#editCheckin").textContent =
      "Check in";
  }

  calculateStreak();
  updateWellbeing();
  renderTimelinePreview();

  const thoughts = [
    "You do not have to have it all figured out today.",
    "Small steps still count.",
    "Rest is part of progress.",
    "You are allowed to take things one moment at a time.",
    "Be gentle with yourself today.",
    "You have made it through difficult days before."
  ];

  $("#nudgeText").textContent =
    thoughts[new Date().getDate() % thoughts.length];
}

function calculateStreak() {

  const dates =
    new Set(
      state.entries.map(entry => entry.date)
    );

  let streak = 0;
  const day = new Date();

  while (dates.has(dateKey(day))) {

    streak++;

    day.setDate(
      day.getDate() - 1
    );
  }

  $("#streakCount").textContent = streak;
}

function updateWellbeing() {

  setProgress(
    "#moodProgress",
    "#moodPercent",
    Math.min(100, state.entries.length * 7)
  );

  setProgress(
    "#journalProgress",
    "#journalPercent",
    Math.min(100, state.journals.length * 10)
  );

  setProgress(
    "#calmProgress",
    "#calmPercent",
    Math.min(100, state.calmSessions * 10)
  );
}

function setProgress(bar, label, value) {

  const progress = $(bar);
  const text = $(label);

  if (!progress || !text) return;

  progress.style.width = value + "%";
  text.textContent = value + "%";
}


/* =========================================================
   JOURNAL
========================================================= */

function saveJournal() {

  const text =
    $("#journalInput").value.trim();

  if (!text) {
    toast("Write something first.");
    return;
  }

  state.journals.unshift({
    id: Date.now(),
    date: dateKey(),
    text
  });

  $("#journalInput").value = "";

  save();

  checkAchievements();
  renderJournals();

  toast("Journal saved privately 📔");
}

function renderJournals() {

  const list = $("#journalHistory");

  if (!list) return;

  list.innerHTML = "";

  const search =
    ($("#journalSearch")?.value || "")
      .toLowerCase();

  const journals =
    state.journals.filter(entry =>
      entry.text.toLowerCase().includes(search)
    );

  if (!journals.length) {

    list.innerHTML =
      `<p class="intro">No journal entries found.</p>`;

    return;
  }

  journals.slice(0, 30).forEach(entry => {

    const item =
      document.createElement("article");

    item.className = "journal-entry";

    item.innerHTML = `
      <small>${prettyDate(entry.date)}</small>
      <p></p>
      <div class="entry-actions">
        <button data-edit>Edit</button>
        <button data-delete>Delete</button>
      </div>
    `;

    item.querySelector("p").textContent =
      entry.text;

    item.querySelector("[data-edit]")
      .onclick = () => {

        $("#journalInput").value =
          entry.text;

        state.journals =
          state.journals.filter(
            item => item.id !== entry.id
          );

        save();
        renderJournals();

        window.scrollTo({
          top: 0,
          behavior: "smooth"
        });
      };

    item.querySelector("[data-delete]")
      .onclick = () => {

        state.journals =
          state.journals.filter(
            item => item.id !== entry.id
          );

        save();
        renderJournals();
        renderHome();

        toast("Journal entry deleted.");
      };

    list.append(item);
  });
}


/* =========================================================
   GOALS
========================================================= */

function addGoal() {

  const text =
    $("#goalInput").value.trim();

  if (!text) {
    toast("Write a goal first.");
    return;
  }

  state.goals.push({
    id: Date.now(),
    text,
    completed: false,
    progress: 0,
    created: dateKey()
  });

  $("#goalInput").value = "";

  save();

  renderGoals();
  checkAchievements();

  toast("New small step added 🎯");
}

function renderGoals() {

  const list = $("#goalList");

  if (!list) return;

  list.innerHTML = "";

  const filter =
    document.querySelector(
      "[data-goal-filter].active"
    )?.dataset.goalFilter || "all";

  let goals = state.goals;

  if (filter === "active") {
    goals =
      goals.filter(goal => !goal.completed);
  }

  if (filter === "completed") {
    goals =
      goals.filter(goal => goal.completed);
  }

  if (!goals.length) {

    list.innerHTML =
      `<p class="intro">No goals here yet.</p>`;

    return;
  }

  goals.forEach(goal => {

    const item =
      document.createElement("div");

    item.className =
      "goal-item" +
      (goal.completed ? " completed" : "");

    item.innerHTML = `
      <div class="goal-main">

        <input
          type="checkbox"
          ${goal.completed ? "checked" : ""}>

        <strong></strong>

        <button class="small-link delete-goal">
          Delete
        </button>

      </div>

      <input
        class="goal-range"
        type="range"
        min="0"
        max="100"
        value="${goal.progress || 0}">

      <div class="goal-progress">
        <span style="width:${goal.progress || 0}%"></span>
      </div>
    `;

    item.querySelector("strong").textContent =
      goal.text;

    item.querySelector("input[type=checkbox]")
      .onchange = event => {

        goal.completed =
          event.target.checked;

        if (goal.completed) {
          goal.progress = 100;
        }

        save();
        renderGoals();
        checkAchievements();
      };

    item.querySelector(".goal-range")
      .oninput = event => {

        goal.progress =
          Number(event.target.value);

        goal.completed =
          goal.progress === 100;

        item.querySelector(
          ".goal-progress span"
        ).style.width =
          goal.progress + "%";

        save();
      };

    item.querySelector(".delete-goal")
      .onclick = () => {

        state.goals =
          state.goals.filter(
            g => g.id !== goal.id
          );

        save();
        renderGoals();
      };

    list.append(item);
  });
}


/* =========================================================
   CHAT MEMORY
========================================================= */

function addMemory(text) {

  if (!state.settings.memoryConsent) {
    return;
  }

  const clean =
    text.trim();

  if (!clean) return;

  if (
    state.memory.some(
      memory => memory.text === clean
    )
  ) {
    return;
  }

  state.memory.unshift({
    id: Date.now(),
    text: clean,
    date: dateKey()
  });

  state.memory =
    state.memory.slice(0, 20);

  save();
  renderSettings();
}

function renderMemory() {

  const list = $("#memoryList");

  if (!list) return;

  list.innerHTML = "";

  if (!state.memory.length) {

    list.innerHTML =
      `<p class="intro">Bloom isn't remembering anything yet.</p>`;

    return;
  }

  state.memory.forEach(memory => {

    const item =
      document.createElement("div");

    item.className = "memory-item";

    item.innerHTML = `
      <p></p>
      <small>${prettyDate(memory.date)}</small>

      <div class="memory-actions">
        <button data-forget>Forget</button>
      </div>
    `;

    item.querySelector("p").textContent =
      memory.text;

    item.querySelector("[data-forget]")
      .onclick = () => {

        state.memory =
          state.memory.filter(
            m => m.id !== memory.id
          );

        save();
        renderMemory();

        toast("Memory forgotten.");
      };

    list.append(item);
  });
}


/* =========================================================
   CONVERSATIONS
========================================================= */

function createConversation() {

  const conversation = {
    id: Date.now(),
    title: "New conversation",
    created: new Date().toISOString(),
    messages: []
  };

  state.conversations.unshift(
    conversation
  );

  selectedConversationId =
    conversation.id;

  save();

  return conversation;
}

function currentConversation() {

  return state.conversations.find(
    conversation =>
      conversation.id === selectedConversationId
  );
}

function renderConversationSelect() {

  const select =
    $("#conversationSelect");

  if (!select) return;

  select.innerHTML =
    `<option value="">New conversation</option>`;

  state.conversations.forEach(conversation => {

    const option =
      document.createElement("option");

    option.value = conversation.id;

    option.textContent =
      conversation.title ||
      "Conversation";

    if (
      conversation.id ===
      selectedConversationId
    ) {
      option.selected = true;
    }

    select.append(option);
  });
}

function renderChat() {

  renderConversationSelect();

  const messages =
    $("#chatMessages");

  messages.innerHTML = "";

  const conversation =
    currentConversation();

  if (!conversation) {

    addMessage(
      "Hi. I'm Bloom. I'm here to listen without judgment. What's on your mind?",
      "bot"
    );

    return;
  }

  if (!conversation.messages.length) {

    addMessage(
      "Hi. I'm Bloom. I'm here to listen without judgment. What's on your mind?",
      "bot"
    );

    return;
  }

  conversation.messages.forEach(message => {

    addMessage(
      message.text,
      message.role === "user"
        ? "user"
        : "bot"
    );
  });
}

function addMessage(text, type) {

  const message =
    document.createElement("div");

  message.className =
    "message " + type;

  message.textContent = text;

  $("#chatMessages").append(message);

  $("#chatMessages").scrollTop =
    $("#chatMessages").scrollHeight;
}

function saveChatMessage(role, text) {

  let conversation =
    currentConversation();

  if (!conversation) {
    conversation = createConversation();
  }

  conversation.messages.push({
    id: Date.now(),
    role,
    text,
    timestamp: new Date().toISOString()
  });

  if (
    conversation.title ===
    "New conversation" &&
    role === "user"
  ) {

    conversation.title =
      text.length > 35
        ? text.slice(0, 35) + "…"
        : text;
  }

  save();
  renderConversationSelect();
}

function safetyDetected(text) {

  return /(kill myself|suicide|hurt myself|self harm|self-harm|want to die|end my life|don't want to live|do not want to live|can't go on|cannot go on|want to disappear|no reason to live)/i
    .test(text);
}

async function sendChat(text) {

  if (!text) return;

  let conversation =
    currentConversation();

  if (!conversation) {
    conversation = createConversation();
  }

  addMessage(text, "user");
  saveChatMessage("user", text);

  $("#chatInput").value = "";

  if (safetyDetected(text)) {

    const safetyMessage =
      "I'm really glad you told me. Your safety matters right now. Please don't stay alone with this feeling. Use Bloom's support option, contact emergency services if you are in immediate danger, and tell a trusted person nearby what is happening.";

    addMessage(safetyMessage, "bot");

    saveChatMessage(
      "assistant",
      safetyMessage
    );

    return;
  }

  const typing =
    document.createElement("div");

  typing.className = "message bot";
  typing.textContent = "Bloom is thinking…";

  $("#chatMessages").append(typing);

  try {

    const response =
      await fetch("/api/chat", {

        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({

          message: text,

          personality:
            state.settings.personality,

          memory:
            state.settings.memoryConsent
              ? state.memory
              : [],

          recentHistory:
            conversation.messages.slice(-12),

          profile:
            state.profile,

          todayMood:
            todayEntry() || null

        })

      });

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ||
        "Bloom could not reply."
      );
    }

    const reply =
      data.reply ||
      "I'm here with you.";

    typing.textContent = reply;

    saveChatMessage(
      "assistant",
      reply
    );

    /*
      Only save likely memory statements when memory
      has explicitly been enabled.
    */

    if (
      state.settings.memoryConsent &&
      /remember|my goal|i like|i prefer|my name is|i'm called|i am called/i
        .test(text)
    ) {

      addMemory(text);
    }

  } catch (error) {

    const errorMessage =
      "I'm having trouble connecting right now. Please make sure Bloom's server is running and try again.";

    typing.textContent =
      errorMessage;

    saveChatMessage(
      "assistant",
      errorMessage
    );
  }
}

function newChat() {

  createConversation();

  renderChat();

  toast("New conversation started.");
}

function clearCurrentChat() {

  const conversation =
    currentConversation();

  if (!conversation) return;

  if (!confirm("Clear this conversation?")) {
    return;
  }

  conversation.messages = [];

  save();
  renderChat();

  toast("Conversation cleared.");
}

function deleteCurrentChat() {

  if (!selectedConversationId) {
    toast("There is no saved conversation.");
    return;
  }

  if (!confirm("Delete this conversation permanently?")) {
    return;
  }

  state.conversations =
    state.conversations.filter(
      conversation =>
        conversation.id !==
        selectedConversationId
    );

  selectedConversationId = null;

  save();
  renderChat();

  toast("Conversation deleted.");
}


/* =========================================================
   VOICE
========================================================= */

function startVoice() {

  const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

  if (!SpeechRecognition) {

    toast(
      "Voice input isn't supported on this device."
    );

    return;
  }

  const recognition =
    new SpeechRecognition();

  recognition.lang = "en-US";
  recognition.interimResults = false;

  recognition.onstart = () =>
    toast("Listening… 🎙️");

  recognition.onresult = event => {

    $("#chatInput").value =
      event.results[0][0].transcript;
  };

  recognition.onerror = () =>
    toast("Voice input stopped.");

  recognition.start();
}


/* =========================================================
   PERSONALITY
========================================================= */

function changePersonality(personality) {

  state.settings.personality =
    personality;

  save();

  document.querySelectorAll(
    ".personality"
  ).forEach(button => {

    button.classList.toggle(
      "active",
      button.dataset.personality ===
      personality
    );

  });

  toast(
    `${personality.charAt(0).toUpperCase() +
      personality.slice(1)} Buddy selected.`
  );
}


/* =========================================================
   BREATHING
========================================================= */

const breathingModes = {

  classic: [
    { text: "Breathe in", duration: 4, className: "breathe-in" },
    { text: "Hold", duration: 2, className: "breathe-in" },
    { text: "Breathe out", duration: 6, className: "breathe-out" }
  ],

  box: [
    { text: "Breathe in", duration: 4, className: "breathe-in" },
    { text: "Hold", duration: 4, className: "breathe-in" },
    { text: "Breathe out", duration: 4, className: "breathe-out" },
    { text: "Hold", duration: 4, className: "breathe-out" }
  ],

  "478": [
    { text: "Breathe in", duration: 4, className: "breathe-in" },
    { text: "Hold", duration: 7, className: "breathe-in" },
    { text: "Breathe out", duration: 8, className: "breathe-out" }
  ]
};

function startBreathing() {

  if (breathingInterval) return;

  breathingRemaining = 60;
  breathingPhase = 0;
  breathingPhaseTime = 0;

  const circle =
    $("#breathingCircle");

  const text =
    $("#breathingText");

  const timer =
    $("#breathingTimer");

  const phases =
    breathingModes[selectedExercise];

  function tick() {

    if (breathingRemaining <= 0) {

      clearInterval(breathingInterval);

      breathingInterval = null;

      text.textContent = "Done 🌱";
      circle.className = "breathing-circle";

      state.calmSessions++;

      save();
      checkAchievements();
      renderHome();

      toast("You completed a calm session.");

      return;
    }

    const current =
      phases[breathingPhase];

    text.textContent =
      current.text;

    circle.className =
      "breathing-circle " +
      current.className;

    breathingPhaseTime++;
    breathingRemaining--;

    timer.textContent =
      `${breathingRemaining} seconds`;

    if (
      breathingPhaseTime >=
      current.duration
    ) {

      breathingPhaseTime = 0;

      breathingPhase =
        (breathingPhase + 1) %
        phases.length;
    }
  }

  tick();

  breathingInterval =
    setInterval(tick, 1000);
}


/* =========================================================
   GROUNDING
========================================================= */

const groundingSteps = [

  {
    number: 5,
    title: "things you can see",
    text: "Look around and name five things you can see."
  },

  {
    number: 4,
    title: "things you can touch",
    text: "Notice four things you can physically touch."
  },

  {
    number: 3,
    title: "things you can hear",
    text: "Listen carefully and identify three sounds."
  },

  {
    number: 2,
    title: "things you can smell",
    text: "Notice two smells around you."
  },

  {
    number: 1,
    title: "thing you can taste",
    text: "Notice one taste in your mouth."
  },

  {
    number: "✓",
    title: "You are here",
    text: "Take one slow breath. You made space for yourself."
  }

];

function renderGrounding() {

  const step =
    groundingSteps[groundingIndex];

  $("#groundingStep").innerHTML = `
    <span>${step.number}</span>
    <h2>${step.title}</h2>
    <p>${step.text}</p>
  `;

  $("#groundingNext").textContent =
    groundingIndex ===
    groundingSteps.length - 1
      ? "Finish"
      : "I've done it →";
}

function nextGrounding() {

  if (
    groundingIndex >=
    groundingSteps.length - 1
  ) {

    groundingIndex = 0;

    showScreen("home");

    toast("You completed grounding 🧘");

    return;
  }

  groundingIndex++;

  renderGrounding();
}


/* =========================================================
   REFRAMER
========================================================= */

function reframeThought() {

  const thought =
    $("#thoughtInput").value.trim();

  if (!thought) {

    toast("Write the thought bothering you.");

    return;
  }

  $("#reframeResult").innerHTML = `
    <span>💭</span>
    <p>
      That thought may be understandable, but it may not tell
      the whole story.
      <br><br>
      <strong>What evidence supports it?</strong>
      <br><br>
      <strong>What evidence might not support it?</strong>
      <br><br>
      <strong>What would you say to a friend who had this thought?</strong>
      <br><br>
      A more balanced thought could be:
      <br><br>
      <em>
      "This situation is difficult, but I don't know the outcome yet.
      I can focus on what I can do next."
      </em>
    </p>
  `;
}


/* =========================================================
   SLEEP
========================================================= */

function saveSleep() {

  const bed =
    $("#sleepBed").value;

  const wake =
    $("#sleepWake").value;

  const quality =
    Number($("#sleepQuality").value);

  if (!bed || !wake) {

    toast("Add your bedtime and wake time.");

    return;
  }

  state.sleep.unshift({
    id: Date.now(),
    date: dateKey(),
    bed,
    wake,
    quality
  });

  state.sleep =
    state.sleep.slice(0, 100);

  save();

  toast("Sleep record saved 🌙");

  checkAchievements();
}

function startSleep() {

  const messages = [
    "Take a slow breath. You don't need to solve tomorrow tonight.",
    "Think of one small thing that went okay today.",
    "Let your shoulders relax.",
    "Tomorrow can wait. For now, rest.",
    "Good night. You've done enough for today. 🌙"
  ];

  let index = 0;

  $("#sleepMessage").textContent =
    messages[index];

  const interval =
    setInterval(() => {

      index++;

      if (index >= messages.length) {

        clearInterval(interval);
        return;
      }

      $("#sleepMessage").textContent =
        messages[index];

    }, 3000);
}


/* =========================================================
   FOCUS TIMER
========================================================= */

function updateFocusDisplay() {

  const minutes =
    Math.floor(focusSeconds / 60);

  const seconds =
    focusSeconds % 60;

  $("#focusTimer").textContent =
    `${String(minutes).padStart(2,"0")}:${String(seconds).padStart(2,"0")}`;
}

function startFocus() {

  if (focusRunning) return;

  focusRunning = true;

  $("#focusStatus").textContent =
    "Focus";

  focusInterval =
    setInterval(() => {

      focusSeconds--;

      updateFocusDisplay();

      if (focusSeconds <= 0) {

        clearInterval(focusInterval);

        focusInterval = null;
        focusRunning = false;

        state.focusSessions++;

        save();
        checkAchievements();

        $("#focusStatus").textContent =
          "Complete 🎉";

        toast("Focus session complete!");

      }

    }, 1000);
}

function resetFocus() {

  clearInterval(focusInterval);

  focusInterval = null;
  focusRunning = false;
  focusSeconds = 25 * 60;

  $("#focusStatus").textContent =
    "Ready";

  updateFocusDisplay();
}


/* =========================================================
   MINI GAMES
========================================================= */

$("#gratitudeGame")?.addEventListener(
  "click",
  () => {

    $("#gameResult").textContent =
      "Think of one person, place or small moment you're grateful for today. 💛";
  }
);

$("#positiveGame")?.addEventListener(
  "click",
  () => {

    const words = [
      "Peace",
      "Courage",
      "Growth",
      "Hope",
      "Kindness",
      "Strength",
      "Patience",
      "Curiosity",
      "Balance",
      "Resilience"
    ];

    const word =
      words[
        Math.floor(
          Math.random() * words.length
        )
      ];

    $("#gameResult").innerHTML =
      `Your word for today is <strong>${word}</strong> 🌱`;
  }
);

$("#breathingGame")?.addEventListener(
  "click",
  () => {

    showScreen("calm");

    setTimeout(
      startBreathing,
      300
    );
  }
);


/* =========================================================
   PROGRESS
========================================================= */

function renderPatterns() {

  const entries =
    [...state.entries]
      .sort((a,b) =>
        b.date.localeCompare(a.date)
      );

  const average =
    entries.length
      ? (
          entries.reduce(
            (sum, entry) =>
              sum + Number(
                entry.score ||
                moodScores[entry.mood] ||
                0
              ),
            0
          ) / entries.length
        ).toFixed(1)
      : "—";

  $("#statMood").textContent =
    entries.length;

  $("#statAverage").textContent =
    average;

  $("#statJournals").textContent =
    state.journals.length;

  $("#statCalm").textContent =
    state.calmSessions;

  renderMoodCalendar();
  renderHistory();

  if (entries.length >= 3) {

    $("#patternHeadline").textContent =
      `You've made space for yourself ${entries.length} times.`;

    const recent =
      entries.slice(0,7);

    const recentAverage =
      recent.reduce(
        (sum,e) =>
          sum + Number(
            e.score ||
            moodScores[e.mood] ||
            0
          ),
        0
      ) / recent.length;

    $("#patternCopy").textContent =
      recentAverage >= 3.7
        ? "Your recent check-ins lean toward the more positive side. Keep noticing what supports you."
        : recentAverage >= 2.7
          ? "Your recent check-ins have been mixed. Small routines may help you notice what makes difficult days easier."
          : "Your recent check-ins have been difficult. Be gentle with yourself and consider reaching out for support.";
  }
}

function renderMoodCalendar() {

  const calendar =
    $("#moodCalendar");

  calendar.innerHTML = "";

  for (let i = 34; i >= 0; i--) {

    const day = new Date();

    day.setDate(
      day.getDate() - i
    );

    const date =
      dateKey(day);

    const entry =
      state.entries.find(
        e => e.date === date
      );

    const cell =
      document.createElement("div");

    cell.className =
      "calendar-day" +
      (entry ? " " + entry.mood : "");

    cell.title =
      `${prettyDate(date)}${entry ? ": " + entry.label : ""}`;

    cell.textContent =
      day.getDate();

    calendar.append(cell);
  }
}

function renderHistory() {

  const list =
    $("#historyList");

  list.innerHTML = "";

  state.entries
    .slice()
    .sort((a,b) =>
      b.date.localeCompare(a.date)
    )
    .slice(0,20)
    .forEach(entry => {

      const row =
        document.createElement("div");

      row.className =
        "history-item";

      row.innerHTML = `
        <span class="history-icon">
          ${iconMap[entry.mood]}
        </span>

        <div>
          <strong></strong>
          <small>
            ${prettyDate(entry.date)}
            ${entry.note ? " · Reflection saved" : ""}
          </small>
        </div>
      `;

      row.querySelector("strong").textContent =
        entry.label;

      list.append(row);
    });
}


/* =========================================================
   TIMELINE
========================================================= */

function buildTimeline() {

  const events = [];

  state.entries.forEach(entry => {

    events.push({
      date: entry.date,
      icon: iconMap[entry.mood],
      title: `Mood: ${entry.label}`,
      text: entry.note || "Daily check-in"
    });
  });

  state.journals.forEach(entry => {

    events.push({
      date: entry.date,
      icon: "📔",
      title: "Journal entry",
      text: entry.text
    });
  });

  state.goals
    .filter(goal => goal.completed)
    .forEach(goal => {

      events.push({
        date: goal.created || dateKey(),
        icon: "🎯",
        title: "Goal completed",
        text: goal.text
      });
    });

  state.sleep.forEach(entry => {

    events.push({
      date: entry.date,
      icon: "🌙",
      title: "Sleep recorded",
      text: `${entry.bed} → ${entry.wake}`
    });
  });

  return events
    .sort((a,b) =>
      b.date.localeCompare(a.date)
    );
}

function renderTimeline() {

  const list =
    $("#timelineList");

  list.innerHTML = "";

  const events =
    buildTimeline();

  if (!events.length) {

    list.innerHTML =
      `<p class="intro">Your Bloom timeline will grow as you use the app.</p>`;

    return;
  }

  events.slice(0,50).forEach(event => {

    const item =
      document.createElement("article");

    item.className =
      "timeline-item";

    item.innerHTML = `
      <div class="timeline-date">
        ${prettyDate(event.date)}
      </div>

      <h3>
        <span class="timeline-icon">${event.icon}</span>
        ${event.title}
      </h3>

      <p></p>
    `;

    item.querySelector("p").textContent =
      event.text;

    list.append(item);
  });
}

function renderTimelinePreview() {

  const list =
    $("#timelinePreview");

  if (!list) return;

  list.innerHTML = "";

  buildTimeline()
    .slice(0,3)
    .forEach(event => {

      const item =
        document.createElement("div");

      item.className =
        "timeline-item";

      item.innerHTML = `
        <small>${prettyDate(event.date)}</small>
        <strong>
          ${event.icon} ${event.title}
        </strong>
      `;

      list.append(item);
    });

  if (!list.children.length) {
    list.innerHTML =
      `<p class="intro">Your Bloom moments will appear here.</p>`;
  }
}


/* =========================================================
   ACHIEVEMENTS
========================================================= */

const achievementDefinitions = [

  {
    id: "first-checkin",
    icon: "🌱",
    title: "First bloom",
    text: "Complete your first check-in.",
    test: () => state.entries.length >= 1
  },

  {
    id: "seven-checkins",
    icon: "🌻",
    title: "Keep blooming",
    text: "Complete 7 check-ins.",
    test: () => state.entries.length >= 7
  },

  {
    id: "journal-five",
    icon: "📔",
    title: "Put it into words",
    text: "Write 5 journal entries.",
    test: () => state.journals.length >= 5
  },

  {
    id: "calm-ten",
    icon: "🌬️",
    title: "Breathe",
    text: "Complete 10 calm sessions.",
    test: () => state.calmSessions >= 10
  },

  {
    id: "goal-one",
    icon: "🎯",
    title: "Small step",
    text: "Complete your first goal.",
    test: () =>
      state.goals.some(goal => goal.completed)
  },

  {
    id: "focus-five",
    icon: "⏱️",
    title: "Focused",
    text: "Complete 5 focus sessions.",
    test: () => state.focusSessions >= 5
  },

  {
    id: "chat-ten",
    icon: "🫂",
    title: "Talk it out",
    text: "Have 10 saved conversations.",
    test: () => state.conversations.length >= 10
  }

];

function checkAchievements() {

  const unlocked =
    new Set(state.achievements);

  achievementDefinitions.forEach(
    achievement => {

      if (
        achievement.test() &&
        !unlocked.has(achievement.id)
      ) {

        state.achievements.push(
          achievement.id
        );

        toast(
          `${achievement.icon} Achievement unlocked: ${achievement.title}`
        );
      }
    }
  );

  save();
}

function renderAchievements() {

  const list =
    $("#achievementList");

  list.innerHTML = "";

  const unlocked =
    new Set(state.achievements);

  achievementDefinitions.forEach(
    achievement => {

      const item =
        document.createElement("article");

      item.className =
        "achievement" +
        (
          unlocked.has(achievement.id)
            ? " unlocked"
            : ""
        );

      item.innerHTML = `
        <span class="achievement-icon">
          ${achievement.icon}
        </span>

        <strong>${achievement.title}</strong>

        <small>${achievement.text}</small>

        ${
          unlocked.has(achievement.id)
            ? "<p>✓ Unlocked</p>"
            : "<p>🔒 Locked</p>"
        }
      `;

      list.append(item);
    }
  );
}


/* =========================================================
   SETTINGS
========================================================= */

function renderSettings() {

  $("#profileName").value =
    state.profile.name || "";

  $("#memoryConsent").checked =
    !!state.settings.memoryConsent;

  $("#researchConsent").checked =
    !!state.settings.researchConsent;

  $("#remindersEnabled").checked =
    !!state.settings.remindersEnabled;

  $("#reminderTime").value =
    state.settings.reminderTime;

  $("#fontSize").value =
    state.settings.fontSize;

  renderMemory();
  applyAppearance();
}


/* =========================================================
   EXPORT / IMPORT
========================================================= */

function exportData() {

  const data =
    JSON.stringify(state, null, 2);

  const blob =
    new Blob(
      [data],
      { type: "application/json" }
    );

  const url =
    URL.createObjectURL(blob);

  const link =
    document.createElement("a");

  link.href = url;

  link.download =
    `bloom-backup-${dateKey()}.json`;

  document.body.appendChild(link);

  link.click();

  link.remove();

  URL.revokeObjectURL(url);

  toast("Your Bloom backup was exported 📦");
}

function importData(file) {

  if (!file) return;

  const reader =
    new FileReader();

  reader.onload = event => {

    try {

      const imported =
        JSON.parse(event.target.result);

      if (
        !imported ||
        typeof imported !== "object"
      ) {
        throw new Error("Invalid file");
      }

      if (
        !confirm(
          "Importing will replace your current Bloom data. Continue?"
        )
      ) {
        return;
      }

      state = {
        ...structuredClone(DEFAULT_STATE),
        ...imported,

        profile: {
          ...DEFAULT_STATE.profile,
          ...(imported.profile || {})
        },

        settings: {
          ...DEFAULT_STATE.settings,
          ...(imported.settings || {})
        }
      };

      save();

      location.reload();

    } catch {

      toast("That backup file isn't valid.");
    }
  };

  reader.readAsText(file);
}


/* =========================================================
   NOTIFICATIONS / REMINDERS
========================================================= */

async function requestNotifications() {

  if (!("Notification" in window)) {

    toast("Notifications aren't supported here.");

    return;
  }

  const permission =
    await Notification.requestPermission();

  if (permission === "granted") {

    toast("Browser notifications enabled 🔔");

  } else {

    toast("Notification permission wasn't granted.");
  }
}

function checkReminder() {

  if (!state.settings.remindersEnabled) {
    return;
  }

  const now =
    new Date();

  const current =
    `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;

  if (
    current ===
    state.settings.reminderTime
  ) {

    const reminderKey =
      `bloom-reminder-${dateKey()}`;

    if (
      localStorage.getItem(reminderKey)
    ) {
      return;
    }

    localStorage.setItem(
      reminderKey,
      "1"
    );

    if (
      "Notification" in window &&
      Notification.permission === "granted"
    ) {

      new Notification(
        "Bloom 🌱",
        {
          body: todayEntry()
            ? "Take a moment to check in with yourself."
            : "How are you feeling today?"
        }
      );

    } else {

      toast("🌱 Time for your Bloom check-in.");
    }
  }
}


/* =========================================================
   EVENT LISTENERS
========================================================= */

document.querySelectorAll(
  "[data-target]"
).forEach(button => {

  button.addEventListener(
    "click",
    () => showScreen(
      button.dataset.target
    )
  );
});


document.querySelectorAll(
  ".mood-card"
).forEach(button => {

  button.addEventListener(
    "click",
    () => {

      startCheckin({

        mood: button.dataset.mood,

        label: button.dataset.label,

        score: Number(
          button.dataset.score
        )

      });
    }
  );
});


document.querySelectorAll(
  "[data-factor]"
).forEach(button => {

  button.addEventListener(
    "click",
    () => {

      const factor =
        button.dataset.factor;

      if (
        selectedFactors.includes(factor)
      ) {

        selectedFactors =
          selectedFactors.filter(
            item => item !== factor
          );

      } else {

        selectedFactors.push(factor);
      }

      button.classList.toggle(
        "active",
        selectedFactors.includes(factor)
      );
    }
  );
});


$("#skipButton").onclick = () => {

  showScreen("home");

  toast(
    "That's okay. Come back whenever you want."
  );
};


$("#saveCheckin").onclick =
  saveCheckin;


$("#reflectionInput").addEventListener(
  "input",
  event => {

    $("#characterCount").textContent =
      `${event.target.value.length} / 500`;
  }
);


$("#editCheckin").onclick = () => {

  const entry =
    todayEntry();

  if (entry) {

    startCheckin(entry);

  } else {

    showScreen("checkin");
  }
};


$("#supportButton").onclick =
  () => showScreen("support");


$("#settingsButton").onclick =
  () => showScreen("privacy");


$("#saveJournal").onclick =
  saveJournal;


$("#clearJournal").onclick =
  () => {

    $("#journalInput").value = "";
  };


$("#journalSearch").addEventListener(
  "input",
  renderJournals
);


$("#addGoal").onclick =
  addGoal;


$("#goalInput").addEventListener(
  "keydown",
  event => {

    if (event.key === "Enter") {

      event.preventDefault();

      addGoal();
    }
  }
);


document.querySelectorAll(
  "[data-goal-filter]"
).forEach(button => {

  button.onclick = () => {

    document.querySelectorAll(
      "[data-goal-filter]"
    ).forEach(
      b => b.classList.remove("active")
    );

    button.classList.add("active");

    renderGoals();
  };
});


$("#startBreathing").onclick =
  startBreathing;


document.querySelectorAll(
  ".exercise"
).forEach(button => {

  button.onclick = () => {

    document.querySelectorAll(
      ".exercise"
    ).forEach(
      b => b.classList.remove("active")
    );

    button.classList.add("active");

    selectedExercise =
      button.dataset.exercise;
  };
});


$("#groundingNext").onclick =
  nextGrounding;


$("#reframeButton").onclick =
  reframeThought;


$("#saveSleep").onclick =
  saveSleep;


$("#sleepStart").onclick =
  startSleep;


$("#focusStart").onclick =
  startFocus;


$("#focusReset").onclick =
  resetFocus;


$("#voiceButton").onclick =
  startVoice;


$("#chatForm").addEventListener(
  "submit",
  event => {

    event.preventDefault();

    sendChat(
      $("#chatInput").value.trim()
    );
  }
);


$("#newChat").onclick =
  newChat;


$("#clearChat").onclick =
  clearCurrentChat;


$("#deleteConversation").onclick =
  deleteCurrentChat;


$("#conversationSelect").onchange =
  event => {

    selectedConversationId =
      event.target.value
        ? Number(event.target.value)
        : null;

    renderChat();
  };


document.querySelectorAll(
  "[data-chat]"
).forEach(button => {

  button.onclick = () =>
    sendChat(
      button.dataset.chat
    );
});


document.querySelectorAll(
  ".personality"
).forEach(button => {

  button.onclick = () =>
    changePersonality(
      button.dataset.personality
    );
});


$("#saveProfile").onclick =
  saveProfile;


$("#memoryConsent").onchange =
  event => {

    state.settings.memoryConsent =
      event.target.checked;

    save();

    toast(
      event.target.checked
        ? "Buddy memory is on 🧠"
        : "Buddy memory is off."
    );

    renderSettings();
  };


$("#clearMemory").onclick = () => {

  if (!state.memory.length) {
    toast("There are no memories.");
    return;
  }

  if (
    !confirm(
      "Forget everything Bloom has remembered?"
    )
  ) {
    return;
  }

  state.memory = [];

  save();

  renderMemory();

  toast("All memories forgotten.");
};


$("#researchConsent").onchange =
  event => {

    state.settings.researchConsent =
      event.target.checked;

    save();

    toast(
      event.target.checked
        ? "Research sharing is on."
        : "Research sharing is off."
    );
  };


$("#remindersEnabled").onchange =
  event => {

    state.settings.remindersEnabled =
      event.target.checked;

    save();

    toast(
      event.target.checked
        ? "Daily reminders are on 🔔"
        : "Reminders are off."
    );
  };


$("#reminderTime").onchange =
  event => {

    state.settings.reminderTime =
      event.target.value;

    save();
  };


$("#requestNotifications").onclick =
  requestNotifications;


$("#fontSize").onchange =
  event => {

    state.settings.fontSize =
      event.target.value;

    save();

    applyAppearance();
  };


document.querySelectorAll(
  ".theme-choice"
).forEach(button => {

  button.onclick = () => {

    state.settings.theme =
      button.dataset.theme;

    save();

    applyAppearance();
  };
});


$("#themeButton").onclick = () => {

  state.settings.theme =
    state.settings.theme === "dark"
      ? "light"
      : "dark";

  save();

  applyAppearance();
};


$("#exportData").onclick =
  exportData;


$("#importData").onchange =
  event => {

    importData(
      event.target.files[0]
    );
  };


$("#eraseData").onclick = () => {

  if (
    !confirm(
      "Erase ALL Bloom data from this device? This cannot be undone."
    )
  ) {
    return;
  }

  localStorage.removeItem(
    STORE_KEY
  );

  location.reload();
};


/* =========================================================
   INITIALIZE
========================================================= */

setTodayTitle();

applyAppearance();

renderGrounding();

renderJournals();

renderGoals();

renderHome();

renderAchievements();

renderSettings();

updateFocusDisplay();

showScreen(
  todayEntry()
    ? "home"
    : "checkin"
);


/* Reminder checker */
setInterval(
  checkReminder,
  30000
);


/* Check achievements on startup */
checkAchievements();