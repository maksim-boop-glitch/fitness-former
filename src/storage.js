const KEY = 'ff_sessions';

/**
 * Saves an analysis session to localStorage.
 * @param {{exercise, weight, unit, score, ruleResults}} session
 */
export function saveSession(session) {
  const sessions = loadSessions();
  sessions.unshift({ ...session, date: new Date().toISOString() });
  localStorage.setItem(KEY, JSON.stringify(sessions.slice(0, 50)));
}

/**
 * Loads all saved sessions from localStorage.
 * @returns {Array}
 */
export function loadSessions() {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
}

/**
 * Clears all sessions.
 */
export function clearSessions() {
  localStorage.removeItem(KEY);
}
