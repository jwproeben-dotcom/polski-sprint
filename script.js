(() => {
  const STORAGE_KEY = "polski-sprint-state-v1";
  const MILESTONES = [5, 10, 20];
  const DAILY_GOAL = 10;
  const FEEDBACK_DELAY_MS = 2200;
  const APP_DATA = window.APP_DATA || {};
  const LEVELS = APP_DATA.levels || [];
  const THEMES = APP_DATA.themes || [];
  const VOCABULARY = APP_DATA.vocabulary || [];
  const WORD_MAP = new Map(VOCABULARY.map((word) => [word.id, word]));

  const dom = {
    menuView: document.getElementById("menuView"),
    trainerView: document.getElementById("trainerView"),
    levelGrid: document.getElementById("levelGrid"),
    themeGrid: document.getElementById("themeGrid"),
    achievementShelf: document.getElementById("achievementShelf"),
    streakValue: document.getElementById("streakValue"),
    streakSub: document.getElementById("streakSub"),
    todayValue: document.getElementById("todayValue"),
    todaySub: document.getElementById("todaySub"),
    bestComboValue: document.getElementById("bestComboValue"),
    masteredLevelsValue: document.getElementById("masteredLevelsValue"),
    resetProgressBtn: document.getElementById("resetProgressBtn"),
    backToMenuBtn: document.getElementById("backToMenuBtn"),
    restartCurrentModeBtn: document.getElementById("restartCurrentModeBtn"),
    sessionModeTitle: document.getElementById("sessionModeTitle"),
    sessionRemainingMini: document.getElementById("sessionRemainingMini"),
    sessionComboMini: document.getElementById("sessionComboMini"),
    sessionLevelPill: document.getElementById("sessionLevelPill"),
    sessionCountPill: document.getElementById("sessionCountPill"),
    questionCard: document.getElementById("questionCard"),
    germanWord: document.getElementById("germanWord"),
    answerForm: document.getElementById("answerForm"),
    answerInput: document.getElementById("answerInput"),
    submitBtn: document.getElementById("submitBtn"),
    feedbackBox: document.getElementById("feedbackBox"),
    sessionCorrectValue: document.getElementById("sessionCorrectValue"),
    sessionWrongValue: document.getElementById("sessionWrongValue"),
    sessionComboValue: document.getElementById("sessionComboValue"),
    sessionBestComboValue: document.getElementById("sessionBestComboValue"),
    sessionAchievementShelf: document.getElementById("sessionAchievementShelf"),
    dailyGoalText: document.getElementById("dailyGoalText"),
    dailyGoalFill: document.getElementById("dailyGoalFill"),
    dailyGoalSub: document.getElementById("dailyGoalSub"),
    completionModal: document.getElementById("completionModal"),
    completionTitle: document.getElementById("completionTitle"),
    completionText: document.getElementById("completionText"),
    completionBadges: document.getElementById("completionBadges"),
    restartModeBtn: document.getElementById("restartModeBtn"),
    closeModalBtn: document.getElementById("closeModalBtn")
  };

  let state = loadState();
  let session = null;
  let advanceTimer = null;

  function createDefaultState() {
    return {
      masteredWordIds: [],
      completedLevels: [],
      bestComboEver: 0,
      totalCorrectEver: 0,
      totalWrongEver: 0,
      dailyProgress: {},
      modeProgress: {}
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return createDefaultState();
      }
      const parsed = JSON.parse(raw);
      return sanitizeState(parsed);
    } catch (error) {
      console.warn("Konnte den Speicherstand nicht laden.", error);
      return createDefaultState();
    }
  }

  function sanitizeState(candidate) {
    const safe = createDefaultState();
    const source = candidate && typeof candidate === "object" ? candidate : {};

    safe.masteredWordIds = Array.isArray(source.masteredWordIds)
      ? [...new Set(source.masteredWordIds.map(Number).filter((id) => WORD_MAP.has(id)))]
      : [];
    safe.completedLevels = Array.isArray(source.completedLevels)
      ? [...new Set(source.completedLevels.map(Number).filter((level) => LEVELS.some((entry) => entry.level === level)))]
      : [];
    safe.bestComboEver = Number.isFinite(Number(source.bestComboEver)) ? Math.max(0, Number(source.bestComboEver)) : 0;
    safe.totalCorrectEver = Number.isFinite(Number(source.totalCorrectEver)) ? Math.max(0, Number(source.totalCorrectEver)) : 0;
    safe.totalWrongEver = Number.isFinite(Number(source.totalWrongEver)) ? Math.max(0, Number(source.totalWrongEver)) : 0;

    const dailyProgress = source.dailyProgress && typeof source.dailyProgress === "object" ? source.dailyProgress : {};
    Object.entries(dailyProgress).forEach(([dateKey, value]) => {
      const correctWordIds = value && Array.isArray(value.correctWordIds)
        ? [...new Set(value.correctWordIds.map(Number).filter((id) => WORD_MAP.has(id)))]
        : [];
      safe.dailyProgress[dateKey] = { correctWordIds };
    });

    const modeProgressSource = source.modeProgress && typeof source.modeProgress === "object"
      ? source.modeProgress
      : (source.savedSessions && typeof source.savedSessions === "object" ? source.savedSessions : {});

    const modeProgress = modeProgressSource;
    Object.entries(modeProgress).forEach(([sessionKey, value]) => {
      const entry = value && typeof value === "object" ? value : {};
      const remainingIds = Array.isArray(entry.remainingIds)
        ? [...new Set(entry.remainingIds.map(Number).filter((id) => WORD_MAP.has(id)))]
        : [];
      const currentWordId = Number.isFinite(Number(entry.currentWordId)) && remainingIds.includes(Number(entry.currentWordId))
        ? Number(entry.currentWordId)
        : null;

      safe.modeProgress[sessionKey] = {
        remainingIds,
        currentWordId,
        correct: Number.isFinite(Number(entry.correct)) ? Math.max(0, Number(entry.correct)) : 0,
        wrong: Number.isFinite(Number(entry.wrong)) ? Math.max(0, Number(entry.wrong)) : 0,
        combo: Number.isFinite(Number(entry.combo)) ? Math.max(0, Number(entry.combo)) : 0,
        bestCombo: Number.isFinite(Number(entry.bestCombo)) ? Math.max(0, Number(entry.bestCombo)) : 0
      };
    });

    return safe;
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function getWordsByLevel(levelNumber) {
    return VOCABULARY.filter((word) => word.level === levelNumber);
  }

  function getWordsByTheme(themeId) {
    return VOCABULARY.filter((word) => Array.isArray(word.themes) && word.themes.includes(themeId));
  }

  function getScopeWords(modeType, modeId) {
    return modeType === "level" ? getWordsByLevel(Number(modeId)) : getWordsByTheme(modeId);
  }

  function getSessionKey(modeType, modeId) {
    return `${modeType}:${modeId}`;
  }

  function getSavedModeProgress(modeType, modeId) {
    return state.modeProgress[getSessionKey(modeType, modeId)] || null;
  }

  function clearSavedModeProgress(modeType, modeId) {
    delete state.modeProgress[getSessionKey(modeType, modeId)];
  }

  function getNextWordIdFromPool(remainingIds, excludeId = null) {
    if (!Array.isArray(remainingIds) || !remainingIds.length) {
      return null;
    }

    const pool = remainingIds.filter((id) => remainingIds.length === 1 || id !== excludeId);
    const effectivePool = pool.length ? pool : remainingIds;
    return effectivePool[Math.floor(Math.random() * effectivePool.length)];
  }

  function buildSessionSnapshot() {
    if (!session) {
      return null;
    }

    const remainingIds = [...session.remainingIds];
    let currentWordId = session.currentWordId;

    if (session.awaitingNext) {
      if (session.pendingCompletion || !remainingIds.length) {
        currentWordId = null;
      } else {
        currentWordId = getNextWordIdFromPool(remainingIds, session.nextExcludeId);
      }
    }

    if (!remainingIds.includes(currentWordId)) {
      currentWordId = getNextWordIdFromPool(remainingIds);
    }

    return {
      remainingIds,
      currentWordId,
      correct: session.correct,
      wrong: session.wrong,
      combo: session.combo,
      bestCombo: session.bestCombo
    };
  }

  function syncModeProgressWithSession() {
    if (!session) {
      return;
    }

    const key = getSessionKey(session.modeType, session.modeId);

    if (!session.remainingIds.length || session.pendingCompletion) {
      delete state.modeProgress[key];
      return;
    }

    const snapshot = buildSessionSnapshot();
    if (!snapshot || !snapshot.remainingIds.length) {
      delete state.modeProgress[key];
      return;
    }

    state.modeProgress[key] = snapshot;
  }

  function focusAnswerInput(options = {}) {
    const { immediate = false } = options;

    if (!session) {
      return;
    }

    const applyFocus = () => {
      if (!session || !dom.trainerView.classList.contains("view-active")) {
        return;
      }

      try {
        dom.answerInput.focus({ preventScroll: true });
      } catch (error) {
        dom.answerInput.focus();
      }

      const currentValue = dom.answerInput.value;
      if (typeof dom.answerInput.setSelectionRange === "function") {
        dom.answerInput.setSelectionRange(currentValue.length, currentValue.length);
      }
    };

    if (immediate) {
      applyFocus();
    }

    window.requestAnimationFrame(applyFocus);
  }

  function getTodayKey() {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Berlin",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date());
  }

  function getDailyEntry(dateKey = getTodayKey()) {
    if (!state.dailyProgress[dateKey]) {
      state.dailyProgress[dateKey] = { correctWordIds: [] };
    }
    if (!Array.isArray(state.dailyProgress[dateKey].correctWordIds)) {
      state.dailyProgress[dateKey].correctWordIds = [];
    }
    return state.dailyProgress[dateKey];
  }

  function getTodayCount() {
    return getDailyEntry().correctWordIds.length;
  }

  function getCompletedLevelsCount() {
    return state.completedLevels.length;
  }

  function countMasteredWords(words) {
    const masteredSet = new Set(state.masteredWordIds);
    return words.reduce((count, word) => count + (masteredSet.has(word.id) ? 1 : 0), 0);
  }

  function getCurrentStreak() {
    let streak = 0;
    const cursor = new Date();
    for (;;) {
      const dateKey = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Berlin",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).format(cursor);
      const entry = state.dailyProgress[dateKey];
      if (!entry || !Array.isArray(entry.correctWordIds) || entry.correctWordIds.length < DAILY_GOAL) {
        break;
      }
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  function normalizeText(input) {
    const map = {
      "ą": "a",
      "ć": "c",
      "ę": "e",
      "ł": "l",
      "ń": "n",
      "ó": "o",
      "ś": "s",
      "ź": "z",
      "ż": "z"
    };

    return String(input || "")
      .toLowerCase()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[ąćęłńóśźż]/g, (char) => map[char] || char)
      .replace(/[’'".,!?;:()]/g, "")
      .replace(/-/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderMenu() {
    renderTopStats();
    renderAchievementShelf();
    renderLevelGrid();
    renderThemeGrid();
  }

  function renderTopStats() {
    const todayCount = getTodayCount();
    const remaining = Math.max(0, DAILY_GOAL - todayCount);

    dom.streakValue.textContent = String(getCurrentStreak());
    dom.streakSub.textContent = todayCount >= DAILY_GOAL
      ? `Heute ${todayCount}/${DAILY_GOAL} · Tagesziel erreicht`
      : `Heute ${todayCount}/${DAILY_GOAL}`;

    dom.todayValue.textContent = String(todayCount);
    dom.todaySub.textContent = todayCount >= DAILY_GOAL
      ? "🏆 Tagespokal heute geholt"
      : `Noch ${remaining} bis zum Pokal`;

    dom.bestComboValue.textContent = String(state.bestComboEver);
    dom.masteredLevelsValue.textContent = `${getCompletedLevelsCount()}/10`;
  }

  function renderAchievementShelf() {
    const todayCount = getTodayCount();
    const badges = [
      {
        unlocked: state.bestComboEver >= 5,
        icon: "⭐",
        title: "5er-Serie",
        text: "5 richtige Antworten am Stück"
      },
      {
        unlocked: state.bestComboEver >= 10,
        icon: "⭐⭐",
        title: "10er-Serie",
        text: "10 richtige Antworten am Stück"
      },
      {
        unlocked: state.bestComboEver >= 20,
        icon: "⭐⭐⭐",
        title: "20er-Serie",
        text: "20 richtige Antworten am Stück"
      },
      {
        unlocked: todayCount >= DAILY_GOAL,
        icon: "🏆",
        title: "Tagespokal",
        text: "10 richtige Antworten an einem Tag"
      }
    ];

    dom.achievementShelf.innerHTML = badges.map((badge) => `
      <article class="achievement-badge ${badge.unlocked ? "unlocked" : ""}">
        <div class="card-kicker">${badge.icon}</div>
        <strong>${badge.title}</strong>
        <span>${badge.unlocked ? "Freigeschaltet" : "Noch gesperrt"} · ${badge.text}</span>
      </article>
    `).join("");
  }

  function renderLevelGrid() {
    dom.levelGrid.innerHTML = LEVELS.map((level) => {
      const words = getWordsByLevel(level.level);
      const masteredCount = countMasteredWords(words);
      const progressPercent = Math.round((masteredCount / words.length) * 100);
      const isCompleted = state.completedLevels.includes(level.level);
      const savedRound = getSavedModeProgress("level", level.level);
      const hasSavedRound = Boolean(savedRound && savedRound.remainingIds.length && savedRound.remainingIds.length < words.length);
      const roundSolvedCount = hasSavedRound ? words.length - savedRound.remainingIds.length : 0;

      return `
        <button class="mode-card ${isCompleted ? "is-mastered" : ""}" type="button" data-mode="level" data-id="${level.level}">
          <div class="card-topline">
            <div>
              <div class="card-kicker">${level.title}</div>
              <h3 class="card-title">${level.name}</h3>
            </div>
            <div class="tag ${isCompleted ? "success" : ""}">${isCompleted ? "Gemeistert" : hasSavedRound ? "Fortsetzen" : "100 Wörter"}</div>
          </div>
          <p class="card-description">${level.description}</p>
          <div class="progress-meta">
            <span>${masteredCount} / ${words.length} jemals richtig</span>
            <span>${progressPercent}%</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width: ${progressPercent}%"></div>
          </div>
          <div class="card-footer">
            <span class="tag">${level.cefr}</span>
            <span class="tag">${isCompleted ? "Komplett geschafft" : hasSavedRound ? `${roundSolvedCount}/${words.length} in Runde erledigt` : "Zum Starten klicken"}</span>
          </div>
        </button>
      `;
    }).join("");
  }

  function renderThemeGrid() {
    dom.themeGrid.innerHTML = THEMES.map((theme) => {
      const words = getWordsByTheme(theme.id);
      const masteredCount = countMasteredWords(words);
      const progressPercent = Math.round((masteredCount / words.length) * 100);
      const savedRound = getSavedModeProgress("theme", theme.id);
      const hasSavedRound = Boolean(savedRound && savedRound.remainingIds.length && savedRound.remainingIds.length < words.length);
      const roundSolvedCount = hasSavedRound ? words.length - savedRound.remainingIds.length : 0;

      return `
        <button class="mode-card" type="button" data-mode="theme" data-id="${theme.id}">
          <div class="card-topline">
            <div>
              <div class="card-kicker">${theme.icon} Thema</div>
              <h3 class="card-title">${theme.title}</h3>
            </div>
            <div class="card-icon">${theme.icon}</div>
          </div>
          <p class="card-description">${theme.description}</p>
          <div class="progress-meta">
            <span>${masteredCount} / ${words.length} jemals richtig</span>
            <span>${progressPercent}%</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width: ${progressPercent}%"></div>
          </div>
          <div class="card-footer">
            <span class="tag">${words.length} Wörter</span>
            <span class="tag">${hasSavedRound ? `${roundSolvedCount}/${words.length} in Runde erledigt` : "Zum Starten klicken"}</span>
          </div>
        </button>
      `;
    }).join("");
  }

  function switchView(viewName) {
    dom.menuView.classList.toggle("view-active", viewName === "menu");
    dom.trainerView.classList.toggle("view-active", viewName === "trainer");
  }

  function getModeLabel(modeType, modeId) {
    if (modeType === "level") {
      const level = LEVELS.find((entry) => entry.level === Number(modeId));
      return level ? `${level.title} · ${level.name}` : "Level";
    }
    const theme = THEMES.find((entry) => entry.id === modeId);
    return theme ? `${theme.icon} ${theme.title}` : "Thema";
  }

  function startSession(modeType, modeId) {
    const words = getScopeWords(modeType, modeId);
    if (!words.length) {
      return;
    }

    clearAdvanceTimer();
    hideFeedback();
    hideCompletionModal();

    const scopeIds = new Set(words.map((word) => word.id));
    const savedProgress = getSavedModeProgress(modeType, modeId);
    const freshSession = {
      modeType,
      modeId,
      words,
      remainingIds: words.map((word) => word.id),
      currentWordId: null,
      correct: 0,
      wrong: 0,
      combo: 0,
      bestCombo: 0,
      unlockedMilestones: [],
      awaitingNext: false,
      pendingCompletion: false,
      nextExcludeId: null
    };

    if (savedProgress) {
      const remainingIds = savedProgress.remainingIds.filter((id) => scopeIds.has(id));
      const solvedSomeWords = remainingIds.length > 0 && remainingIds.length < words.length;

      if (solvedSomeWords) {
        session = {
          ...freshSession,
          remainingIds,
          currentWordId: remainingIds.includes(savedProgress.currentWordId) ? savedProgress.currentWordId : null,
          correct: Math.max(0, Number(savedProgress.correct) || 0),
          wrong: Math.max(0, Number(savedProgress.wrong) || 0),
          combo: Math.max(0, Number(savedProgress.combo) || 0),
          bestCombo: Math.max(0, Number(savedProgress.bestCombo) || 0, Number(savedProgress.combo) || 0)
        };
      } else {
        clearSavedModeProgress(modeType, modeId);
        session = freshSession;
        saveState();
      }
    } else {
      session = freshSession;
    }

    if (!session.currentWordId || !session.remainingIds.includes(session.currentWordId)) {
      pickNextWord();
    }

    syncModeProgressWithSession();
    saveState();

    switchView("trainer");
    renderSession();
    focusAnswerInput({ immediate: true });
  }

  function renderSession() {
    if (!session) {
      return;
    }

    const modeLabel = getModeLabel(session.modeType, session.modeId);
    const remaining = session.remainingIds.length;
    const currentWord = WORD_MAP.get(session.currentWordId);

    dom.sessionModeTitle.textContent = modeLabel;
    dom.sessionLevelPill.textContent = modeLabel;
    dom.sessionCountPill.textContent = `Noch ${remaining}`;
    dom.sessionRemainingMini.textContent = String(remaining);
    dom.sessionComboMini.textContent = String(session.combo);
    dom.germanWord.textContent = currentWord ? currentWord.german : "Bereit?";
    dom.sessionCorrectValue.textContent = String(session.correct);
    dom.sessionWrongValue.textContent = String(session.wrong);
    dom.sessionComboValue.textContent = String(session.combo);
    dom.sessionBestComboValue.textContent = String(session.bestCombo);
    dom.restartCurrentModeBtn.textContent = session.modeType === "level" ? "Level neu starten" : "Thema neu starten";

    renderSessionAchievements();
    renderDailyGoalBox();
    setInputState(session.awaitingNext);
  }

  function renderSessionAchievements() {
    if (!session) {
      return;
    }

    const todayCount = getTodayCount();
    const badges = [
      { milestone: 5, icon: "⭐", title: "5er-Serie" },
      { milestone: 10, icon: "⭐⭐", title: "10er-Serie" },
      { milestone: 20, icon: "⭐⭐⭐", title: "20er-Serie" }
    ].map((badge) => {
      const unlocked = session.bestCombo >= badge.milestone || state.bestComboEver >= badge.milestone;
      return {
        unlocked,
        icon: badge.icon,
        title: badge.title,
        text: `${badge.milestone} richtige Antworten in Folge`
      };
    });

    badges.push({
      unlocked: todayCount >= DAILY_GOAL,
      icon: "🏆",
      title: "Tagespokal",
      text: "10 richtige Antworten heute"
    });

    dom.sessionAchievementShelf.innerHTML = badges.map((badge) => `
      <article class="achievement-badge ${badge.unlocked ? "unlocked" : ""}">
        <div class="card-kicker">${badge.icon}</div>
        <strong>${badge.title}</strong>
        <span>${badge.unlocked ? "Aktiv" : "Noch offen"} · ${badge.text}</span>
      </article>
    `).join("");
  }

  function renderDailyGoalBox() {
    const todayCount = getTodayCount();
    const percentage = Math.min(100, Math.round((todayCount / DAILY_GOAL) * 100));
    const remaining = Math.max(0, DAILY_GOAL - todayCount);

    dom.dailyGoalText.textContent = `${todayCount} / ${DAILY_GOAL}`;
    dom.dailyGoalFill.style.width = `${percentage}%`;
    dom.dailyGoalSub.textContent = todayCount >= DAILY_GOAL
      ? "Stark – der Tagespokal ist freigeschaltet."
      : `Noch ${remaining} richtige Antworten bis zum Tagespokal.`;
  }

  function setInputState(waiting) {
    dom.answerInput.disabled = false;
    dom.answerInput.classList.toggle("is-locked", waiting);
    dom.answerInput.setAttribute("aria-disabled", waiting ? "true" : "false");
    dom.answerInput.setAttribute("aria-busy", waiting ? "true" : "false");
    dom.submitBtn.textContent = waiting ? (session && session.pendingCompletion ? "Abschließen" : "Weiter") : "Prüfen";

    if (waiting) {
      focusAnswerInput({ immediate: true });
    } else {
      focusAnswerInput();
    }
  }

  function pickNextWord(excludeId = null) {
    if (!session || !session.remainingIds.length) {
      return;
    }

    const nextId = getNextWordIdFromPool(session.remainingIds, excludeId);
    session.currentWordId = nextId;
  }

  function handleAnswerSubmit(event) {
    event.preventDefault();

    if (!session) {
      return;
    }

    if (session.awaitingNext) {
      advanceAfterFeedback();
      return;
    }

    const word = WORD_MAP.get(session.currentWordId);
    const rawInput = dom.answerInput.value;
    const normalizedInput = normalizeText(rawInput);

    if (!normalizedInput) {
      dom.answerInput.focus();
      return;
    }

    const isCorrect = word.answers.some((answer) => normalizeText(answer) === normalizedInput);

    if (isCorrect) {
      onCorrectAnswer(word);
    } else {
      onWrongAnswer(word);
    }
  }

  function onCorrectAnswer(word) {
    session.correct += 1;
    session.combo += 1;
    session.bestCombo = Math.max(session.bestCombo, session.combo);
    state.bestComboEver = Math.max(state.bestComboEver, session.bestCombo);
    state.totalCorrectEver += 1;

    if (!state.masteredWordIds.includes(word.id)) {
      state.masteredWordIds.push(word.id);
    }

    const todayEntry = getDailyEntry();
    if (!todayEntry.correctWordIds.includes(word.id)) {
      todayEntry.correctWordIds.push(word.id);
    }

    session.remainingIds = session.remainingIds.filter((id) => id !== word.id);
    const shouldComplete = session.remainingIds.length === 0;

    if (shouldComplete && session.modeType === "level" && !state.completedLevels.includes(Number(session.modeId))) {
      state.completedLevels.push(Number(session.modeId));
    }

    const answerPreview = escapeHtml(word.polish);
    showFeedback(true, `Richtig! <strong>${answerPreview}</strong>`);
    prepareAdvance(word.id, shouldComplete);
    syncModeProgressWithSession();
    saveState();
    renderMenu();
    renderSession();
  }

  function onWrongAnswer(word) {
    session.wrong += 1;
    session.combo = 0;
    state.totalWrongEver += 1;

    const answers = word.answers.map((answer) => escapeHtml(answer)).join(" · ");
    showFeedback(false, `Nicht ganz. Richtig ist: <strong>${answers}</strong>`);
    prepareAdvance(word.id, false);
    syncModeProgressWithSession();
    saveState();
    renderSession();
  }

  function showFeedback(correct, htmlContent) {
    dom.questionCard.classList.toggle("is-correct", correct);
    dom.questionCard.classList.toggle("is-wrong", !correct);
    dom.feedbackBox.classList.remove("hidden", "correct", "wrong");
    dom.feedbackBox.classList.add(correct ? "correct" : "wrong");
    dom.feedbackBox.innerHTML = htmlContent;
  }

  function hideFeedback() {
    dom.questionCard.classList.remove("is-correct", "is-wrong");
    dom.feedbackBox.classList.add("hidden");
    dom.feedbackBox.classList.remove("correct", "wrong");
    dom.feedbackBox.textContent = "";
  }

  function prepareAdvance(excludeId, shouldComplete) {
    session.awaitingNext = true;
    session.nextExcludeId = excludeId;
    session.pendingCompletion = shouldComplete;
    setInputState(true);
    clearAdvanceTimer();
    advanceTimer = window.setTimeout(() => {
      advanceAfterFeedback();
    }, FEEDBACK_DELAY_MS);
  }

  function clearAdvanceTimer() {
    if (advanceTimer) {
      window.clearTimeout(advanceTimer);
      advanceTimer = null;
    }
  }

  function advanceAfterFeedback() {
    if (!session || !session.awaitingNext) {
      return;
    }

    clearAdvanceTimer();

    if (session.pendingCompletion) {
      completeSession();
      return;
    }

    session.awaitingNext = false;
    session.pendingCompletion = false;
    hideFeedback();
    dom.answerInput.value = "";
    pickNextWord(session.nextExcludeId);
    syncModeProgressWithSession();
    saveState();
    setInputState(false);
    renderSession();
    focusAnswerInput();
  }

  function completeSession() {
    clearAdvanceTimer();

    if (session.modeType === "level" && !state.completedLevels.includes(Number(session.modeId))) {
      state.completedLevels.push(Number(session.modeId));
    }

    clearSavedModeProgress(session.modeType, session.modeId);
    saveState();
    renderMenu();

    const todayCount = getTodayCount();
    const badgeHtml = buildCompletionBadges(todayCount);
    const levelText = session.modeType === "level"
      ? `Du hast ${getModeLabel(session.modeType, session.modeId)} abgeschlossen.`
      : `Du hast das Thema ${getModeLabel(session.modeType, session.modeId)} für diese Runde komplett geleert.`;

    dom.completionTitle.textContent = session.modeType === "level"
      ? `${getModeLabel(session.modeType, session.modeId)} gemeistert`
      : `${getModeLabel(session.modeType, session.modeId)} abgeschlossen`;

    dom.completionText.textContent = `${levelText} Richtig: ${session.correct}, falsch: ${session.wrong}, bester Lauf: ${session.bestCombo}.`;
    dom.completionBadges.innerHTML = badgeHtml;
    dom.completionModal.classList.remove("hidden");
    dom.completionModal.setAttribute("aria-hidden", "false");
    switchView("trainer");

    session.awaitingNext = false;
    session.pendingCompletion = false;
    setInputState(false);
  }

  function buildCompletionBadges(todayCount) {
    const unlocked = [
      { condition: session.bestCombo >= 5, icon: "⭐", title: "5er-Serie" },
      { condition: session.bestCombo >= 10, icon: "⭐⭐", title: "10er-Serie" },
      { condition: session.bestCombo >= 20, icon: "⭐⭐⭐", title: "20er-Serie" },
      { condition: todayCount >= DAILY_GOAL, icon: "🏆", title: "Tagespokal" }
    ].filter((entry) => entry.condition);

    if (!unlocked.length) {
      return `<article class="achievement-badge"><div class="card-kicker">✨</div><strong>Runde abgeschlossen</strong><span>Beim nächsten Mal warten weitere Sterne auf dich.</span></article>`;
    }

    return unlocked.map((entry) => `
      <article class="achievement-badge unlocked">
        <div class="card-kicker">${entry.icon}</div>
        <strong>${entry.title}</strong>
        <span>In dieser Runde freigeschaltet</span>
      </article>
    `).join("");
  }

  function hideCompletionModal() {
    dom.completionModal.classList.add("hidden");
    dom.completionModal.setAttribute("aria-hidden", "true");
  }

  function returnToMenu() {
    if (session) {
      syncModeProgressWithSession();
      saveState();
    }

    clearAdvanceTimer();
    hideFeedback();
    hideCompletionModal();
    session = null;
    switchView("menu");
    renderMenu();
  }

  function resetProgress() {
    const okay = window.confirm("Möchtest du wirklich alle Fortschritte, Streaks und Level-Meisterungen löschen?");
    if (!okay) {
      return;
    }

    localStorage.removeItem(STORAGE_KEY);
    state = createDefaultState();
    session = null;
    clearAdvanceTimer();
    hideFeedback();
    hideCompletionModal();
    switchView("menu");
    renderMenu();
  }

  function bindEvents() {
    dom.levelGrid.addEventListener("click", (event) => {
      const card = event.target.closest("[data-mode='level']");
      if (!card) {
        return;
      }
      startSession("level", Number(card.dataset.id));
    });

    dom.themeGrid.addEventListener("click", (event) => {
      const card = event.target.closest("[data-mode='theme']");
      if (!card) {
        return;
      }
      startSession("theme", card.dataset.id);
    });

    dom.answerForm.addEventListener("submit", handleAnswerSubmit);

    const keepKeyboardOpen = (event) => {
      event.preventDefault();
      focusAnswerInput({ immediate: true });
    };

    dom.submitBtn.addEventListener("pointerdown", keepKeyboardOpen);
    dom.submitBtn.addEventListener("mousedown", keepKeyboardOpen);

    dom.answerInput.addEventListener("beforeinput", (event) => {
      if (session && session.awaitingNext) {
        event.preventDefault();
      }
    });

    dom.answerInput.addEventListener("keydown", (event) => {
      if (!session || !session.awaitingNext) {
        return;
      }

      if (["Enter", "Tab", "Escape"].includes(event.key)) {
        return;
      }

      event.preventDefault();
    });

    dom.answerInput.addEventListener("paste", (event) => {
      if (session && session.awaitingNext) {
        event.preventDefault();
      }
    });

    dom.resetProgressBtn.addEventListener("click", resetProgress);
    dom.backToMenuBtn.addEventListener("click", returnToMenu);
    dom.restartCurrentModeBtn.addEventListener("click", () => {
      if (!session) {
        return;
      }

      clearSavedModeProgress(session.modeType, session.modeId);
      saveState();
      startSession(session.modeType, session.modeId);
    });

    dom.restartModeBtn.addEventListener("click", () => {
      if (!session) {
        returnToMenu();
        return;
      }
      const modeType = session.modeType;
      const modeId = session.modeId;
      clearSavedModeProgress(modeType, modeId);
      saveState();
      startSession(modeType, modeId);
    });

    dom.closeModalBtn.addEventListener("click", returnToMenu);

    dom.completionModal.addEventListener("click", (event) => {
      if (event.target === dom.completionModal) {
        returnToMenu();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !dom.completionModal.classList.contains("hidden")) {
        returnToMenu();
      }
    });
  }

  bindEvents();
  renderMenu();
})();
