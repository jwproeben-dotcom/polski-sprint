(() => {
  const STORAGE_KEY = "polski-sprint-state-v1";
  const MILESTONES = [5, 10, 20];
  const DAILY_GOAL = 10;
  const FEEDBACK_DELAY_MS = 2200;
  const MAX_RECENT_RESULTS = 180;
  const STAGE_LABELS = ["A1", "A2", "B1", "B2"];
  const READINESS_THRESHOLDS = [0.50, 0.54, 0.57, 0.60];
  const MIN_COVERAGE_THRESHOLDS = [0.28, 0.26, 0.22, 0.20];
  const COARSE_CEFR_MAP = {
    "A1": "A1",
    "A1/A2": "A1",
    "A2": "A2",
    "A2/B1": "A2",
    "B1": "B1",
    "B1/B2": "B1",
    "B2": "B2"
  };
  const CEFR_DIFFICULTY_MAP = {
    "A1": 0.85,
    "A1/A2": 1.15,
    "A2": 1.45,
    "A2/B1": 1.75,
    "B1": 2.05,
    "B1/B2": 2.35,
    "B2": 2.85
  };

  const APP_DATA = window.APP_DATA || {};
  const LEVELS = APP_DATA.levels || [];
  const THEMES = APP_DATA.themes || [];
  const VOCABULARY = APP_DATA.vocabulary || [];
  const WORD_MAP = new Map(VOCABULARY.map((word) => [word.id, word]));
  const WORDS_BY_STAGE = STAGE_LABELS.reduce((accumulator, stageLabel) => {
    accumulator[stageLabel] = VOCABULARY.filter((word) => getCoarseCefrLabel(word.cefr) === stageLabel);
    return accumulator;
  }, {});
  const LEVELS_BY_STAGE = STAGE_LABELS.reduce((accumulator, stageLabel) => {
    accumulator[stageLabel] = LEVELS.filter((level) => getCoarseCefrLabel(level.cefr) === stageLabel);
    return accumulator;
  }, {});

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
    cefrCurrentLabel: document.getElementById("cefrCurrentLabel"),
    cefrScoreValue: document.getElementById("cefrScoreValue"),
    cefrTrendText: document.getElementById("cefrTrendText"),
    cefrMeterFill: document.getElementById("cefrMeterFill"),
    cefrDescription: document.getElementById("cefrDescription"),
    levelMetricAccuracy: document.getElementById("levelMetricAccuracy"),
    levelMetricConsistency: document.getElementById("levelMetricConsistency"),
    levelMetricDifficulty: document.getElementById("levelMetricDifficulty"),
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
      modeProgress: {},
      wordStats: {},
      recentResults: []
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

    Object.entries(modeProgressSource).forEach(([sessionKey, value]) => {
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

    const wordStatsSource = source.wordStats && typeof source.wordStats === "object" ? source.wordStats : {};
    Object.entries(wordStatsSource).forEach(([wordId, value]) => {
      const numericId = Number(wordId);
      if (!WORD_MAP.has(numericId)) {
        return;
      }
      safe.wordStats[numericId] = sanitizeWordStatEntry(value);
    });

    const recentResultsSource = Array.isArray(source.recentResults) ? source.recentResults : [];
    safe.recentResults = recentResultsSource
      .map(sanitizeRecentResultEntry)
      .filter(Boolean)
      .slice(0, MAX_RECENT_RESULTS);

    return safe;
  }

  function sanitizeWordStatEntry(value) {
    const entry = value && typeof value === "object" ? value : {};
    return {
      seen: Number.isFinite(Number(entry.seen)) ? Math.max(0, Number(entry.seen)) : 0,
      correct: Number.isFinite(Number(entry.correct)) ? Math.max(0, Number(entry.correct)) : 0,
      wrong: Number.isFinite(Number(entry.wrong)) ? Math.max(0, Number(entry.wrong)) : 0,
      currentStreak: Number.isFinite(Number(entry.currentStreak)) ? Math.max(0, Number(entry.currentStreak)) : 0,
      bestStreak: Number.isFinite(Number(entry.bestStreak)) ? Math.max(0, Number(entry.bestStreak)) : 0,
      lastSeenAt: Number.isFinite(Number(entry.lastSeenAt)) ? Number(entry.lastSeenAt) : null,
      lastCorrectAt: Number.isFinite(Number(entry.lastCorrectAt)) ? Number(entry.lastCorrectAt) : null,
      lastResult: entry.lastResult === "correct" || entry.lastResult === "wrong" ? entry.lastResult : null
    };
  }

  function sanitizeRecentResultEntry(value) {
    const entry = value && typeof value === "object" ? value : {};
    const wordId = Number(entry.id);
    if (!WORD_MAP.has(wordId)) {
      return null;
    }

    return {
      id: wordId,
      correct: Boolean(entry.correct),
      timestamp: Number.isFinite(Number(entry.timestamp)) ? Number(entry.timestamp) : Date.now(),
      responseMs: Number.isFinite(Number(entry.responseMs)) ? clamp(Number(entry.responseMs), 0, 90000) : null,
      answerLength: Number.isFinite(Number(entry.answerLength)) ? Math.max(1, Number(entry.answerLength)) : null,
      cefr: typeof entry.cefr === "string" && entry.cefr ? entry.cefr : (WORD_MAP.get(wordId) ? WORD_MAP.get(wordId).cefr : "A1")
    };
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function getCoarseCefrLabel(tag) {
    return COARSE_CEFR_MAP[tag] || "A1";
  }

  function getDifficultyValue(tag) {
    return CEFR_DIFFICULTY_MAP[tag] || CEFR_DIFFICULTY_MAP.A1;
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

  function stampQuestionShown() {
    if (session) {
      session.questionShownAt = Date.now();
    }
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

  function getWordStatsEntry(wordId) {
    if (!state.wordStats[wordId]) {
      state.wordStats[wordId] = {
        seen: 0,
        correct: 0,
        wrong: 0,
        currentStreak: 0,
        bestStreak: 0,
        lastSeenAt: null,
        lastCorrectAt: null,
        lastResult: null
      };
    }
    return state.wordStats[wordId];
  }

  function calculateSmoothedAccuracy(correct, attempts, prior = 0.5, weight = 4) {
    return (correct + prior * weight) / Math.max(1, attempts + weight);
  }

  function computeWordMastery(entry) {
    const attempts = (entry.correct || 0) + (entry.wrong || 0);
    if (!attempts) {
      return 0;
    }

    const accuracy = (entry.correct || 0) / attempts;
    const reliability = clamp(attempts / 4, 0, 1);
    const lastResultFactor = entry.lastResult === "correct" ? 1 : 0.7;
    const streakFactor = clamp((entry.bestStreak || 0) / 3, 0, 1);

    return clamp(reliability * (accuracy * 0.62 + lastResultFactor * 0.23 + streakFactor * 0.15), 0, 1);
  }

  function recordPerformance(word, isCorrect, responseMs) {
    const now = Date.now();
    const entry = getWordStatsEntry(word.id);
    entry.seen += 1;
    entry.lastSeenAt = now;
    entry.lastResult = isCorrect ? "correct" : "wrong";

    if (isCorrect) {
      entry.correct += 1;
      entry.currentStreak += 1;
      entry.bestStreak = Math.max(entry.bestStreak, entry.currentStreak);
      entry.lastCorrectAt = now;
      state.totalCorrectEver += 1;
    } else {
      entry.wrong += 1;
      entry.currentStreak = 0;
      state.totalWrongEver += 1;
    }

    const shortestAnswerLength = Math.max(
      1,
      ...word.answers.map((answer) => normalizeText(answer).replace(/\s/g, "").length).filter((value) => value > 0)
    );

    state.recentResults.unshift({
      id: word.id,
      correct: isCorrect,
      timestamp: now,
      responseMs: Number.isFinite(responseMs) ? clamp(Math.round(responseMs), 0, 90000) : null,
      answerLength: shortestAnswerLength,
      cefr: word.cefr || "A1"
    });
    state.recentResults = state.recentResults.slice(0, MAX_RECENT_RESULTS);
  }

  function getStageAttemptDetails(stageLabel) {
    const stageWords = WORDS_BY_STAGE[stageLabel] || [];
    const stageLevels = LEVELS_BY_STAGE[stageLabel] || [];
    const masteredSet = new Set(state.masteredWordIds);
    const legacyMasteredCount = stageWords.filter((word) => masteredSet.has(word.id)).length;
    const wordEntries = stageWords
      .map((word) => ({ word, stats: state.wordStats[word.id] || null }))
      .filter((entry) => entry.stats && entry.stats.seen > 0);

    const attempts = wordEntries.reduce((sum, entry) => sum + entry.stats.correct + entry.stats.wrong, 0);
    const correct = wordEntries.reduce((sum, entry) => sum + entry.stats.correct, 0);
    const rawDistinctAttempted = wordEntries.length;
    const rawDistinctCorrect = wordEntries.filter((entry) => entry.stats.correct > 0).length;
    const distinctAttempted = Math.max(rawDistinctAttempted, Math.round(legacyMasteredCount * 0.7));
    const distinctCorrect = Math.max(rawDistinctCorrect, Math.round(legacyMasteredCount * 0.85));
    const stableWords = wordEntries.filter((entry) => {
      const localAttempts = entry.stats.correct + entry.stats.wrong;
      if (localAttempts < 2) {
        return false;
      }
      return (entry.stats.correct / localAttempts) >= 0.68 && entry.stats.lastResult === "correct";
    }).length;
    const averageMastery = wordEntries.length
      ? wordEntries.reduce((sum, entry) => sum + computeWordMastery(entry.stats), 0) / wordEntries.length
      : clamp((legacyMasteredCount / Math.max(10, Math.round(stageWords.length * 0.1))) * 0.55, 0, 0.55);

    const recentResults = state.recentResults.filter((result) => getCoarseCefrLabel(result.cefr) === stageLabel).slice(0, 24);
    const recentCorrect = recentResults.filter((result) => result.correct).length;
    const smoothedAccuracy = calculateSmoothedAccuracy(correct, attempts, 0.52, 6);
    const recentAccuracy = recentResults.length
      ? calculateSmoothedAccuracy(recentCorrect, recentResults.length, 0.52, 4)
      : smoothedAccuracy;

    const coverageTarget = Math.max(12, Math.min(stageWords.length, Math.round(stageWords.length * 0.12)));
    const stableTarget = Math.max(7, Math.round(coverageTarget * 0.55));
    const correctTarget = Math.max(9, Math.round(coverageTarget * 0.75));
    const completedLevels = stageLevels.filter((level) => state.completedLevels.includes(level.level)).length;

    const timingSamples = recentResults.filter((result) => result.correct && Number.isFinite(result.responseMs) && Number.isFinite(result.answerLength));
    const averageMsPerChar = timingSamples.length
      ? timingSamples.reduce((sum, result) => sum + (result.responseMs / Math.max(4, result.answerLength)), 0) / timingSamples.length
      : null;

    const accuracyScore = clamp((smoothedAccuracy - 0.50) / 0.34, 0, 1);
    const recentScore = clamp((recentAccuracy - 0.52) / 0.30, 0, 1);
    const coverageScore = clamp(distinctAttempted / coverageTarget, 0, 1);
    const stableScore = clamp(stableWords / stableTarget, 0, 1);
    const breadthScore = clamp(distinctCorrect / correctTarget, 0, 1);
    const completionScore = stageLevels.length ? clamp(completedLevels / stageLevels.length, 0, 1) : 0;
    const speedScore = averageMsPerChar == null ? 0.55 : clamp((1100 - averageMsPerChar) / 650, 0, 1);

    const confidence = clamp(
      accuracyScore * 0.30 +
      recentScore * 0.22 +
      coverageScore * 0.17 +
      averageMastery * 0.14 +
      stableScore * 0.09 +
      breadthScore * 0.05 +
      completionScore * 0.03 +
      speedScore * 0.03 -
      Math.max(0, 0.18 - coverageScore) * 0.12,
      0,
      1
    );

    return {
      stageLabel,
      attempts,
      correct,
      recentResults,
      smoothedAccuracy,
      recentAccuracy,
      distinctAttempted,
      distinctCorrect,
      stableWords,
      averageMastery,
      coverageScore,
      stableScore,
      breadthScore,
      completionScore,
      speedScore,
      confidence
    };
  }

  function getLevelEstimate() {
    const totalAttempts = state.totalCorrectEver + state.totalWrongEver;
    const stageDetails = STAGE_LABELS.map((stageLabel) => getStageAttemptDetails(stageLabel));

    let estimatedStageIndex = 0;
    let canAdvance = true;
    stageDetails.forEach((detail, index) => {
      if (!canAdvance) {
        return;
      }
      const isReady = detail.confidence >= READINESS_THRESHOLDS[index]
        && detail.coverageScore >= MIN_COVERAGE_THRESHOLDS[index];
      if (isReady) {
        estimatedStageIndex = index;
      } else {
        canAdvance = false;
      }
    });

    const fillPercentage = clamp(
      5 +
      18 * stageDetails[0].confidence +
      25 * stageDetails[1].confidence * Math.pow(stageDetails[0].confidence, 1.18) +
      25 * stageDetails[2].confidence * Math.pow(Math.min(stageDetails[0].confidence, stageDetails[1].confidence), 1.22) +
      27 * stageDetails[3].confidence * Math.pow(Math.min(stageDetails[1].confidence, stageDetails[2].confidence), 1.26),
      5,
      100
    );

    const currentLabel = STAGE_LABELS[estimatedStageIndex];
    const nextLabel = estimatedStageIndex < STAGE_LABELS.length - 1 ? STAGE_LABELS[estimatedStageIndex + 1] : null;
    const nextDetail = nextLabel ? stageDetails[estimatedStageIndex + 1] : null;

    const recentGlobalResults = state.recentResults.slice(0, 40);
    const recentGlobalAccuracy = recentGlobalResults.length
      ? recentGlobalResults.filter((result) => result.correct).length / recentGlobalResults.length
      : (totalAttempts ? state.totalCorrectEver / totalAttempts : 0);
    const smoothedGlobalAccuracy = calculateSmoothedAccuracy(state.totalCorrectEver, totalAttempts, 0.52, 8);
    const accuracyMetric = Math.round(clamp(smoothedGlobalAccuracy * 0.65 + recentGlobalAccuracy * 0.35, 0, 1) * 100);

    const currentDailyStreak = getCurrentStreak();
    const consistencyMetric = Math.round(
      clamp((state.bestComboEver / 20) * 0.72 + (currentDailyStreak / 7) * 0.28, 0, 1) * 100
    );

    const recentCorrects = state.recentResults.filter((result) => result.correct).slice(0, 40);
    const difficultyMetric = recentCorrects.length
      ? Math.round(
        clamp(
          (recentCorrects.reduce((sum, result) => sum + getDifficultyValue(result.cefr), 0) / recentCorrects.length - 0.85) / 2,
          0,
          1
        ) * 100
      )
      : Math.round(clamp(fillPercentage / 100 * 0.65, 0, 1) * 100);

    let trendText = "Erste Schätzung";
    let description = "Die Schätzung kombiniert Trefferquote, aktuelle Form, Wortbreite, Wiederholungsstabilität und Schwierigkeit.";

    if (totalAttempts < 8) {
      trendText = "Erste Schätzung – mit mehr Antworten wird sie deutlich genauer.";
      description = "Sobald du mehr Wörter beantwortest, reagiert der Balken feiner auf deine tatsächliche Leistung.";
    } else if (!nextLabel) {
      trendText = stageDetails[3].confidence >= 0.72
        ? "Stabile B2-Tendenz – sehr stark."
        : "B2 erreicht – jetzt weiter absichern.";
      description = "Du triffst schon viele schwierige Wörter. Halte jetzt vor allem Konstanz und Wiederholungsstabilität hoch.";
    } else if (nextDetail) {
      if (nextDetail.coverageScore < 0.45) {
        trendText = `Tendenz Richtung ${nextLabel}.`;
        description = `Für ${nextLabel} helfen dir vor allem mehr unterschiedliche ${nextLabel}-Wörter und mehr Breite in diesem Bereich.`;
      } else if (nextDetail.recentAccuracy < 0.68) {
        trendText = `${currentLabel} stabil – ${nextLabel} baut sich auf.`;
        description = `Für ${nextLabel} zählt jetzt vor allem eine bessere aktuelle Trefferquote auf schwierigeren Wörtern.`;
      } else {
        trendText = `Gute Tendenz Richtung ${nextLabel}.`;
        description = `Du bist nah an ${nextLabel}. Noch ein paar stabile Wiederholungen und saubere Serien auf diesem Niveau.`;
      }
    }

    return {
      currentLabel,
      fillPercentage,
      scoreLabel: `${Math.round(fillPercentage)}%`,
      trendText,
      description,
      accuracyMetric,
      consistencyMetric,
      difficultyMetric
    };
  }

  function renderLevelEstimator() {
    const estimate = getLevelEstimate();
    dom.cefrCurrentLabel.textContent = estimate.currentLabel;
    dom.cefrScoreValue.textContent = estimate.scoreLabel;
    dom.cefrTrendText.textContent = estimate.trendText;
    dom.cefrMeterFill.style.width = `${estimate.fillPercentage}%`;
    dom.cefrDescription.textContent = estimate.description;
    dom.levelMetricAccuracy.textContent = `${estimate.accuracyMetric}%`;
    dom.levelMetricConsistency.textContent = `${estimate.consistencyMetric}%`;
    dom.levelMetricDifficulty.textContent = `${estimate.difficultyMetric}%`;
  }

  function renderDashboard() {
    renderTopStats();
    renderLevelEstimator();
  }

  function renderMenu() {
    renderDashboard();
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
    const badges = MILESTONES.map((milestone, index) => ({
      unlocked: state.bestComboEver >= milestone,
      icon: index === 0 ? "⭐" : index === 1 ? "⭐⭐" : "⭐⭐⭐",
      title: `${milestone}er-Serie`,
      text: `${milestone} richtige Antworten am Stück`
    }));

    badges.push({
      unlocked: todayCount >= DAILY_GOAL,
      icon: "🏆",
      title: "Tagespokal",
      text: "10 richtige Antworten an einem Tag"
    });

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
      awaitingNext: false,
      pendingCompletion: false,
      nextExcludeId: null,
      questionShownAt: null
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
    } else {
      stampQuestionShown();
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
    const badges = MILESTONES.map((milestone, index) => {
      const unlocked = session.bestCombo >= milestone || state.bestComboEver >= milestone;
      return {
        unlocked,
        icon: index === 0 ? "⭐" : index === 1 ? "⭐⭐" : "⭐⭐⭐",
        title: `${milestone}er-Serie`,
        text: `${milestone} richtige Antworten in Folge`
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
    stampQuestionShown();
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

    const responseMs = Number.isFinite(session.questionShownAt) ? Date.now() - session.questionShownAt : null;
    const isCorrect = word.answers.some((answer) => normalizeText(answer) === normalizedInput);

    if (isCorrect) {
      onCorrectAnswer(word, responseMs);
    } else {
      onWrongAnswer(word, responseMs);
    }
  }

  function onCorrectAnswer(word, responseMs) {
    session.correct += 1;
    session.combo += 1;
    session.bestCombo = Math.max(session.bestCombo, session.combo);
    state.bestComboEver = Math.max(state.bestComboEver, session.bestCombo);

    recordPerformance(word, true, responseMs);

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

  function onWrongAnswer(word, responseMs) {
    session.wrong += 1;
    session.combo = 0;

    recordPerformance(word, false, responseMs);

    const answers = word.answers.map((answer) => escapeHtml(answer)).join(" · ");
    showFeedback(false, `Nicht ganz. Richtig ist: <strong>${answers}</strong>`);
    prepareAdvance(word.id, false);
    syncModeProgressWithSession();
    saveState();
    renderDashboard();
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
