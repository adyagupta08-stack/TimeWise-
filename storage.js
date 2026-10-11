/* ==========================================================================
   TIMEWISE - LOCAL STORAGE & SEED DATA MANAGER
   Handles state persistence, teen profile, stats, tasks, and initial sample data.
   ========================================================================== */

const STORAGE_KEYS = {
  USER_PROFILE: 'timewise_user_profile',
  TASKS: 'timewise_tasks',
  TIMELINE: 'timewise_timeline',
  STATS: 'timewise_stats',
  HIGH_SCORES: 'timewise_high_scores',
  SETTINGS: 'timewise_settings',
  UNLOCKED_SHOP: 'timewise_unlocked_shop'
};

const DEFAULT_PROFILE = {
  isLoggedIn: false,
  isGuest: false,
  name: 'Alex Rivera',
  age: 15,
  grade: '9th Grade (Freshman)',
  avatar: '🦊'
};

const DEFAULT_STATS = {
  xp: 450,
  level: 4,
  coins: 120,
  streakDays: 3,
  longestStreak: 7,
  totalTasksCompleted: 14,
  focusTimeMinutes: 320,
  breakTimeMinutes: 85,
  badges: ['Homework Hero', 'Early Bird', 'Time Master']
};

const DEFAULT_HIGH_SCORES = {
  snake: 45,
  2048: 1024,
  memory: '0:42',
  tictactoe: 5,
  colormatch: 14,
  wordle: 4,
  reaction: 245,
  math: 18
};

const DEFAULT_SETTINGS = {
  theme: 'cyber',
  sfx: true,
  nudges: true
};

const SAMPLE_TEEN_TASKS = [
  {
    id: 't-1',
    title: 'Morning School Classes & Assembly',
    category: 'School',
    duration: 360, // 6 hrs
    priority: 'High',
    preferredTime: '08:00',
    difficulty: 'Medium',
    color: '#06b6d4',
    notes: 'Math, Science, English & History periods',
    completed: true
  },
  {
    id: 't-2',
    title: 'Math Algebra Chapter 4 Homework',
    category: 'Homework',
    duration: 50,
    priority: 'Urgent',
    preferredTime: '15:30',
    difficulty: 'Hard',
    color: '#a855f7',
    notes: 'Complete problem sets 1 to 20 on page 84',
    completed: true
  },
  {
    id: 't-3',
    title: 'Physics Project Lab Report',
    category: 'Projects',
    duration: 45,
    priority: 'High',
    preferredTime: '16:30',
    difficulty: 'Hard',
    color: '#ec4899',
    notes: 'Draft conclusion & draw circuit diagram',
    completed: false
  },
  {
    id: 't-4',
    title: 'Basketball Practice / Sports',
    category: 'Sports',
    duration: 60,
    priority: 'Medium',
    preferredTime: '18:00',
    difficulty: 'Medium',
    color: '#f59e0b',
    notes: 'Dribbling drills & team match at community park',
    completed: false
  },
  {
    id: 't-5',
    title: 'Python Coding Practice',
    category: 'Coding',
    duration: 40,
    priority: 'Medium',
    preferredTime: '19:30',
    difficulty: 'Medium',
    color: '#3b82f6',
    notes: 'Build small guessing game loop',
    completed: false
  },
  {
    id: 't-6',
    title: 'Read Novel (Percy Jackson)',
    category: 'Reading',
    duration: 30,
    priority: 'Low',
    preferredTime: '21:00',
    difficulty: 'Easy',
    color: '#10b981',
    notes: 'Read chapters 5 and 6 before bed',
    completed: false
  }
];

export class StorageManager {
  static getProfile() {
    const data = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);
    return data ? JSON.parse(data) : { ...DEFAULT_PROFILE };
  }

  static saveProfile(profile) {
    localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
  }

  static getTasks() {
    const data = localStorage.getItem(STORAGE_KEYS.TASKS);
    if (!data) {
      this.saveTasks(SAMPLE_TEEN_TASKS);
      return SAMPLE_TEEN_TASKS;
    }
    return JSON.parse(data);
  }

  static saveTasks(tasks) {
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
  }

  static getTimeline() {
    const data = localStorage.getItem(STORAGE_KEYS.TIMELINE);
    return data ? JSON.parse(data) : [];
  }

  static saveTimeline(timeline) {
    localStorage.setItem(STORAGE_KEYS.TIMELINE, JSON.stringify(timeline));
  }

  static getStats() {
    const data = localStorage.getItem(STORAGE_KEYS.STATS);
    return data ? JSON.parse(data) : { ...DEFAULT_STATS };
  }

  static saveStats(stats) {
    localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(stats));
  }

  static getHighScores() {
    const data = localStorage.getItem(STORAGE_KEYS.HIGH_SCORES);
    return data ? JSON.parse(data) : { ...DEFAULT_HIGH_SCORES };
  }

  static saveHighScore(game, score) {
    const scores = this.getHighScores();
    scores[game] = score;
    localStorage.setItem(STORAGE_KEYS.HIGH_SCORES, JSON.stringify(scores));
  }

  static getSettings() {
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    return data ? JSON.parse(data) : { ...DEFAULT_SETTINGS };
  }

  static saveSettings(settings) {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  }

  static resetAll() {
    localStorage.clear();
  }
}
