/* ==========================================================================
   TIMEWISE - MAIN APPLICATION COORDINATOR (APP.JS)
   Integrates UI views, auth, AI scheduler, task completion, gamification, 
   game lock system, 8 mini-games, analytics, calendar, and WiseBot.
   ========================================================================== */

import { soundEngine } from './audio.js';
import { triggerConfetti } from './confetti.js';
import { StorageManager } from './storage.js';
import { AISchedulerEngine } from './ai_scheduler.js';
import { GamificationEngine, SHOP_ITEMS, BADGES_CATALOG } from './gamification.js';
import { AnalyticsRenderer } from './analytics.js';
import { CalendarManager } from './calendar.js';
import { WiseBot } from './wisebot.js';

// Mini Games imports
import { renderSnakeGame } from './games/snake.js';
import { render2048Game } from './games/puzzle2048.js';
import { renderMemoryGame } from './games/memory.js';
import { renderTicTacToeGame } from './games/tictactoe.js';
import { renderColorMatchGame } from './games/colormatch.js';
import { renderWordleGame } from './games/wordle.js';
import { renderReactionGame } from './games/reaction.js';
import { renderMathGame } from './games/math.js';

class TimeWiseApp {
  constructor() {
    this.profile = StorageManager.getProfile();
    this.stats = StorageManager.getStats();
    this.tasks = StorageManager.getTasks();
    this.timeline = StorageManager.getTimeline();
    this.settings = StorageManager.getSettings();

    this.calendarManager = new CalendarManager();
    this.wiseBot = new WiseBot();

    this.activeCategoryFilter = 'ALL';
    this.draggedTaskIndex = null;
    this.nlpPreferences = {};
    this.currentConflictInfo = null;
    this._celebratedToday = false;
    this.activeGameCleanup = null;
  }

  init() {
    this.applyTheme(this.settings.theme);
    soundEngine.enabled = this.settings.sfx;

    this.setupAuth();
    this.setupNavigation();
    this.setupClock();
    this.setupTaskModal();
    this.setupWiseBotModal();
    this.setupSettings();
    this.setupShop();
    this.setupNLPPlanner();
    this.setupConflictModal();

    // Listen for custom event from mini-games
    window.addEventListener('game-completed', (e) => {
      this.stats = StorageManager.getStats();
      this.updateHeaderStats();
      this.renderDashboard();
      this.renderAnalytics();
      this.checkBadgeMilestones();
    });

    if (this.profile.isLoggedIn || this.profile.isGuest) {
      this.showMainApp();
    } else {
      document.getElementById('auth-modal').classList.add('active');
    }

    if (this.settings.nudges) {
      this.startSmartNudges();
    }
  }

  /* -------------------------------------------------------------------------- */
  /* 1. AUTHENTICATION & PROFILE SETUP                                         */
  /* -------------------------------------------------------------------------- */
  setupAuth() {
    const avatarList = ['🦊', '🐉', '🚀', '🦄', '🥷', '🦁', '🦉', '⭐'];
    const avatarContainer = document.getElementById('su-avatar-list');
    let selectedAvatar = avatarList[0];

    avatarContainer.innerHTML = avatarList.map((av, idx) => `
      <div class="avatar-option ${idx === 0 ? 'selected' : ''}" data-avatar="${av}">${av}</div>
    `).join('');

    avatarContainer.querySelectorAll('.avatar-option').forEach(el => {
      el.addEventListener('click', () => {
        avatarContainer.querySelectorAll('.avatar-option').forEach(o => o.classList.remove('selected'));
        el.classList.add('selected');
        selectedAvatar = el.dataset.avatar;
        soundEngine.playClick();
      });
    });

    // Auth Tabs Switch
    document.querySelectorAll('.auth-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        soundEngine.playClick();
        document.querySelectorAll('.auth-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`${btn.dataset.tab}-form`).classList.add('active');
      });
    });

    // Signup Submit
    document.getElementById('signup-form').onsubmit = (e) => {
      e.preventDefault();
      const name = document.getElementById('su-name').value.trim();
      const age = parseInt(document.getElementById('su-age').value);
      const grade = document.getElementById('su-grade').value;

      this.profile = {
        isLoggedIn: true,
        isGuest: false,
        name: name || 'Alex Rivera',
        age: age || 15,
        grade,
        avatar: selectedAvatar
      };

      StorageManager.saveProfile(this.profile);
      soundEngine.playLevelUp();
      triggerConfetti();
      this.showMainApp();
    };

    // Login Submit
    document.getElementById('login-form').onsubmit = (e) => {
      e.preventDefault();
      const name = document.getElementById('li-email').value.trim() || 'Alex Rivera';
      this.profile = { ...this.profile, isLoggedIn: true, isGuest: false, name };
      StorageManager.saveProfile(this.profile);
      soundEngine.playSuccess();
      this.showMainApp();
    };

    // Guest Mode Start
    document.getElementById('start-guest-btn').onclick = () => {
      this.profile = {
        isLoggedIn: false,
        isGuest: true,
        name: 'Guest Teen Explorer',
        age: 15,
        grade: '9th Grade',
        avatar: '🚀'
      };
      StorageManager.saveProfile(this.profile);
      soundEngine.playSuccess();
      this.showMainApp();
    };
  }

  showMainApp() {
    document.getElementById('auth-modal').classList.remove('active');
    document.getElementById('main-layout').classList.remove('hidden');

    this.checkDailyRollover();
    this.checkDailyStreakReset();
    this.updateHeaderStats();
    this.renderDashboard();
    this.renderPlannerTasks();
    this.renderTimeline();
    this.checkGameLockStatus();
    this.renderAnalytics();
    this.calendarManager.renderCalendar('calendar-days-grid', 'cal-month-title');
  }

  checkDailyRollover() {
    const lastActive = localStorage.getItem('timewise_last_active_date');
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;

    if (lastActive && lastActive !== todayKey) {
      // It's a new day! Uncheck tasks.
      this.tasks = this.tasks.map(t => ({ ...t, completed: false }));
      this.timeline = []; // Force fresh AI schedule generation for the new day
      this._celebratedToday = false;

      StorageManager.saveTasks(this.tasks);
      StorageManager.saveTimeline(this.timeline);
      
      this.showToast('🌅 A new day has started! Your tasks have been reset.', 'info');
    }
    
    // Save/update today's date as the last active date
    localStorage.setItem('timewise_last_active_date', todayKey);
  }


  updateHeaderStats() {
    document.getElementById('user-streak-val').textContent = this.stats.streakDays;
    document.getElementById('user-xp-val').textContent = this.stats.xp;
    document.getElementById('user-coins-val').textContent = this.stats.coins;
    document.getElementById('user-level-val').textContent = this.stats.level;
    document.getElementById('header-avatar-emoji').textContent = this.profile.avatar;
    document.getElementById('games-coins-display').textContent = this.stats.coins;
    document.getElementById('shop-coins-display').textContent = this.stats.coins;
  }

  /* -------------------------------------------------------------------------- */
  /* 2. NAVIGATION & TABS                                                       */
  /* -------------------------------------------------------------------------- */
  setupNavigation() {
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        soundEngine.playClick();
        const targetId = tab.dataset.target;

        // If clicking Games Hub while locked
        if (targetId === 'tab-games') {
          const isLocked = this.isGamesSectionLocked();
          if (isLocked) {
            soundEngine.playLockError();
            this.showToast('🔒 Complete today\'s tasks to unlock Games Hub!', 'warning');
          }
        }

        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.app-page').forEach(p => p.classList.remove('active'));

        tab.classList.add('active');
        document.getElementById(targetId).classList.add('active');

        if (targetId === 'tab-analytics') this.renderAnalytics();
        if (targetId === 'tab-calendar') this.calendarManager.renderCalendar('calendar-days-grid', 'cal-month-title');
      });
    });

    // Calendar buttons
    document.getElementById('cal-prev-month').onclick = () => this.calendarManager.prevMonth('calendar-days-grid', 'cal-month-title');
    document.getElementById('cal-next-month').onclick = () => this.calendarManager.nextMonth('calendar-days-grid', 'cal-month-title');
  }

  /* -------------------------------------------------------------------------- */
  /* 3. CLOCK & DASHBOARD HERO                                                  */
  /* -------------------------------------------------------------------------- */
  setupClock() {
    const updateTime = () => {
      const now = new Date();
      const options = { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' };
      document.getElementById('live-date').textContent = now.toLocaleDateString('en-US', options);
      
      let hours = now.getHours();
      const mins = now.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      document.getElementById('live-clock').textContent = `${hours}:${mins} ${ampm}`;

      // Greeting time of day
      const hr = now.getHours();
      let timeGreeting = "Good morning";
      if (hr >= 12 && hr < 17) timeGreeting = "Good afternoon";
      if (hr >= 17) timeGreeting = "Good evening";
      document.getElementById('greeting-heading').textContent = `${timeGreeting}, ${this.profile.name}! 👋`;
    };

    updateTime();
    setInterval(updateTime, 1000);
  }

  renderDashboard() {
    const total = this.tasks.length;
    const completed = this.tasks.filter(t => t.completed).length;
    const pct = total === 0 ? 0 : Math.round((completed / total) * 100);

    // Update Progress Ring
    document.getElementById('dash-progress-pct').textContent = `${pct}%`;
    document.getElementById('dash-tasks-done').textContent = completed;
    document.getElementById('dash-tasks-left').textContent = total - completed;

    const ring = document.getElementById('dash-progress-ring');
    const circumference = 2 * Math.PI * 65; // r=65 -> ~408.4
    const offset = circumference * (1 - pct / 100);
    ring.style.strokeDashoffset = offset;

    // Productivity Score
    const prodScore = Math.min(100, Math.round(pct * 0.7 + (this.stats.streakDays * 5) + 15));
    document.getElementById('dash-prod-score').textContent = prodScore;
    document.getElementById('dash-prod-bar').style.width = `${prodScore}%`;

    // Render Upcoming Task Box
    const upcomingBox = document.getElementById('upcoming-task-box');
    const uncompletedTasks = this.tasks.filter(t => !t.completed);

    if (uncompletedTasks.length > 0) {
      const nextTask = uncompletedTasks[0];
      upcomingBox.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
          <div>
            <div style="font-weight:800; font-size:1.1rem; color:var(--text-main);">${nextTask.title}</div>
            <div style="font-size:0.85rem; color:var(--text-muted); margin-top:4px;">
              ${nextTask.category} • ${nextTask.duration} mins • ${nextTask.preferredTime || 'Anytime'}
            </div>
          </div>
          <button class="btn btn-primary btn-sm dash-complete-btn" data-id="${nextTask.id}">Mark Done ✅</button>
        </div>
      `;

      upcomingBox.querySelector('.dash-complete-btn').onclick = () => this.toggleTaskComplete(nextTask.id);
    } else {
      upcomingBox.innerHTML = `<div class="empty-state">🎉 All today's tasks completed! Your Arcade games are unlocked!</div>`;
    }

    // Dashboard Buttons
    document.getElementById('dash-gen-btn').onclick = () => this.generateAISchedule();
    document.getElementById('dash-add-btn').onclick = () => this.openTaskModal();
    document.getElementById('dash-unlock-goto-btn').onclick = () => {
      document.querySelector('[data-target="tab-games"]').click();
    };
  }

  /* -------------------------------------------------------------------------- */
  /* 4. DAILY PLANNER & TASK MANAGEMENT                                         */
  /* -------------------------------------------------------------------------- */
  renderPlannerTasks() {
    const listEl = document.getElementById('planner-task-list');
    document.getElementById('planner-task-count').textContent = this.tasks.length;

    // Category filters
    document.querySelectorAll('.cat-chip').forEach(chip => {
      chip.onclick = () => {
        soundEngine.playClick();
        document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.activeCategoryFilter = chip.dataset.cat;
        this.renderPlannerTasks();
      };
    });

    const filtered = this.activeCategoryFilter === 'ALL'
      ? this.tasks
      : this.tasks.filter(t => t.category === this.activeCategoryFilter);

    if (filtered.length === 0) {
      listEl.innerHTML = `<div class="empty-state" style="grid-column:1/-1; padding: 24px;">No tasks in bucket yet! Describe your day above or add tasks.</div>`;
      return;
    }

    listEl.innerHTML = filtered.map(t => `
      <div class="task-card ${t.completed ? 'completed' : ''}" style="border-left: 4px solid ${t.color || 'var(--accent-primary)'};">
        <div class="task-card-header">
          <span class="category-tag">${t.category}</span>
          <span class="priority-badge priority-${t.priority}">${t.priority}</span>
        </div>
        <div class="task-card-body">
          <h4 style="text-decoration: ${t.completed ? 'line-through' : 'none'};">${t.title}</h4>
          <div class="task-meta-row">
            <span>⏱️ ${t.duration} mins</span>
            <span>⭐ ${t.difficulty || 'Medium'}</span>
          </div>
          ${t.notes ? `<div class="task-notes-snippet">📝 ${t.notes}</div>` : ''}
        </div>
        <div class="task-card-footer">
          <button class="task-check-btn" data-id="${t.id}">
            ${t.completed ? '✅ Done' : '⭕ Mark Done'}
          </button>
          <div class="card-actions-row">
            <button class="action-icon-btn edit-task-btn" data-id="${t.id}" title="Edit">✏️</button>
            <button class="action-icon-btn del-task-btn" data-id="${t.id}" title="Delete">🗑️</button>
          </div>
        </div>
      </div>
    `).join('');

    // Attach card event listeners
    listEl.querySelectorAll('.task-check-btn').forEach(b => {
      b.onclick = () => this.toggleTaskComplete(b.dataset.id);
    });

    listEl.querySelectorAll('.edit-task-btn').forEach(b => {
      b.onclick = () => this.openTaskModal(b.dataset.id);
    });

    listEl.querySelectorAll('.del-task-btn').forEach(b => {
      b.onclick = () => this.deleteTask(b.dataset.id);
    });

    // Buttons
    document.getElementById('open-add-task-modal').onclick = () => this.openTaskModal();
    document.getElementById('preset-load-btn').onclick = () => this.loadSamplePreset();
    document.getElementById('planner-generate-ai').onclick = () => this.generateAISchedule();
  }

  setupTaskModal() {
    const modal = document.getElementById('task-modal');
    document.getElementById('close-task-modal').onclick = () => modal.classList.remove('active');

    document.getElementById('task-form').onsubmit = (e) => {
      e.preventDefault();
      const editId = document.getElementById('task-edit-id').value;

      const taskData = {
        id: editId || `t-${Date.now()}`,
        title: document.getElementById('task-title').value.trim(),
        category: document.getElementById('task-category').value,
        priority: document.getElementById('task-priority').value,
        duration: parseInt(document.getElementById('task-duration').value) || 30,
        preferredTime: document.getElementById('task-preferred-time').value,
        difficulty: document.getElementById('task-difficulty').value,
        color: document.getElementById('task-color').value,
        notes: document.getElementById('task-notes').value.trim(),
        completed: false
      };

      if (editId) {
        this.tasks = this.tasks.map(t => t.id === editId ? { ...t, ...taskData } : t);
        this.showToast('Task updated successfully! ✨', 'success');
      } else {
        this.tasks.push(taskData);
        this.showToast('New task added to bucket! 🚀', 'success');
      }

      StorageManager.saveTasks(this.tasks);
      soundEngine.playSuccess();
      modal.classList.remove('active');

      this.renderPlannerTasks();
      this.renderDashboard();

      // Recalculate timeline if generated
      if (this.timeline.length > 0) {
        this.generateAISchedule(false);
      }
    };
  }

  openTaskModal(taskId = null) {
    const modal = document.getElementById('task-modal');
    const form = document.getElementById('task-form');
    form.reset();

    if (taskId) {
      const t = this.tasks.find(x => x.id === taskId);
      if (t) {
        document.getElementById('task-modal-title').textContent = '✏️ Edit Task';
        document.getElementById('task-edit-id').value = t.id;
        document.getElementById('task-title').value = t.title;
        document.getElementById('task-category').value = t.category;
        document.getElementById('task-priority').value = t.priority;
        document.getElementById('task-duration').value = t.duration;
        document.getElementById('task-preferred-time').value = t.preferredTime || '16:00';
        document.getElementById('task-difficulty').value = t.difficulty || 'Medium';
        document.getElementById('task-color').value = t.color || '#8b5cf6';
        document.getElementById('task-notes').value = t.notes || '';
      }
    } else {
      document.getElementById('task-modal-title').textContent = '➕ Create New Task';
      document.getElementById('task-edit-id').value = '';
    }

    modal.classList.add('active');
  }

  deleteTask(taskId) {
    if (confirm('Are you sure you want to delete this task?')) {
      this.tasks = this.tasks.filter(t => t.id !== taskId);
      this.timeline = this.timeline.filter(t => t.id !== taskId);
      StorageManager.saveTasks(this.tasks);
      StorageManager.saveTimeline(this.timeline);
      soundEngine.playClick();
      this.renderPlannerTasks();
      this.renderDashboard();
      this.renderTimeline();
      this.checkDayCompletion();
    }
  }

  toggleTaskComplete(taskId) {
    let justCompleted = false;
    this.tasks = this.tasks.map(t => {
      if (t.id === taskId) {
        const nextState = !t.completed;
        if (nextState) justCompleted = true;
        return { ...t, completed: nextState };
      }
      return t;
    });

    this.timeline = this.timeline.map(t => {
      if (t.id === taskId) return { ...t, completed: !t.completed };
      return t;
    });

    StorageManager.saveTasks(this.tasks);
    StorageManager.saveTimeline(this.timeline);

    if (justCompleted) {
      this.completeTask(taskId);
    } else {
      soundEngine.playClick();
    }

    this.renderPlannerTasks();
    this.renderDashboard();
    this.renderTimeline();
    this.checkDayCompletion();
  }

  completeTask(taskId) {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) return;

    const { stats, rewards, leveledUp } = GamificationEngine.awardTaskCompletion(this.stats, task);
    this.stats = stats;
    StorageManager.saveStats(this.stats);

    soundEngine.playSuccess();
    this.showToast(`Task Complete! +${rewards.xp} XP & +${rewards.coins} Coins 🪙`, 'success');

    if (leveledUp) {
      soundEngine.playLevelUp();
      triggerConfetti();
      this.showToast(`🎉 LEVEL UP! You reached Level ${this.stats.level}!`, 'success');
    }

    this.updateHeaderStats();
    this.renderDashboard();
    this.checkGameLockStatus();
    this.checkBadgeMilestones();
  }

  checkDayCompletion() {
    if (this.tasks.length === 0) return;
    const allDone = this.tasks.every(t => t.completed);

    this.saveDayToHistory(allDone);

    if (allDone && !this._celebratedToday) {
      this._celebratedToday = true;

      this.stats.streakDays += 1;
      if (this.stats.streakDays > this.stats.longestStreak) {
        this.stats.longestStreak = this.stats.streakDays;
      }
      StorageManager.saveStats(this.stats);

      soundEngine.playLevelUp();
      triggerConfetti();
      this.showToast('🎉 AMAZING! You completed all tasks for today! Streak leveled up! Games unlocked!', 'success');

      this.updateHeaderStats();
      this.renderDashboard();
      this.checkGameLockStatus();
      this.checkBadgeMilestones();
    }
  }

  saveDayToHistory(completed) {
    const now = new Date();
    const dateKey = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;

    const history = JSON.parse(localStorage.getItem('timewise_daily_history') || '{}');
    history[dateKey] = {
      completed,
      tasks: this.tasks,
      timeline: this.timeline
    };
    localStorage.setItem('timewise_daily_history', JSON.stringify(history));

    this.calendarManager.renderCalendar('calendar-days-grid', 'cal-month-title');
  }

  checkDailyStreakReset() {
    const history = JSON.parse(localStorage.getItem('timewise_daily_history') || '{}');
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;

    if (history[todayKey] && history[todayKey].completed) {
      this._celebratedToday = true;
      return;
    }

    let lastCompletedDate = null;
    const sortedKeys = Object.keys(history).sort();
    for (let i = sortedKeys.length - 1; i >= 0; i--) {
      if (history[sortedKeys[i]].completed) {
        lastCompletedDate = new Date(sortedKeys[i]);
        break;
      }
    }

    if (lastCompletedDate) {
      const todayZero = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const lastZero = new Date(lastCompletedDate.getFullYear(), lastCompletedDate.getMonth(), lastCompletedDate.getDate());
      const diffTime = Math.abs(todayZero - lastZero);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays > 1) {
        this.stats.streakDays = 0;
        StorageManager.saveStats(this.stats);
        this.updateHeaderStats();
        this.showToast("It's okay! Start your daily streak again today. 😊", 'info');
      }
    }
  }

  checkBadgeMilestones() {
    const { stats, newUnlocked } = GamificationEngine.checkBadges(this.stats, this.tasks, this.timeline);
    this.stats = stats;
    StorageManager.saveStats(this.stats);

    if (newUnlocked.length > 0) {
      newUnlocked.forEach(badge => {
        soundEngine.playLevelUp();
        triggerConfetti();
        this.showToast(`🏆 UNLOCKED BADGE: ${badge}! See details in Analytics.`, 'success');
      });
      this.updateHeaderStats();
      this.renderAnalytics();
    }
  }

  /* -------------------------------------------------------------------------- */
  /* 5. AI SCHEDULE GENERATOR & TIMELINE VIEW                                   */
  /* -------------------------------------------------------------------------- */
  setupNLPPlanner() {
    const textInput = document.getElementById('nlp-input-text');
    const parseBtn = document.getElementById('nlp-parse-btn');

    document.querySelectorAll('.suggestion-tag').forEach(tag => {
      tag.onclick = () => {
        soundEngine.playClick();
        textInput.value = tag.dataset.text;
      };
    });

    parseBtn.onclick = () => {
      const text = textInput.value.trim();
      if (!text) {
        this.showToast('Please describe your plans or click a suggestion tag first! ✍️', 'warning');
        return;
      }

      soundEngine.playClick();
      const parsed = AISchedulerEngine.parseNaturalLanguage(text);

      this.tasks = parsed.tasks;
      this.nlpPreferences = parsed.preferences;

      StorageManager.saveTasks(this.tasks);
      this.renderPlannerTasks();
      this.renderDashboard();

      this.executeScheduling(this.tasks, this.nlpPreferences);
    };
  }

  setupConflictModal() {
    const modal = document.getElementById('conflict-modal');
    const closeBtn = document.getElementById('close-conflict-modal');

    closeBtn.onclick = () => {
      soundEngine.playClick();
      modal.classList.remove('active');
    };

    document.querySelectorAll('.conflict-opt-btn').forEach(btn => {
      btn.onclick = () => {
        soundEngine.playClick();
        const strategy = btn.dataset.strategy;
        modal.classList.remove('active');

        if (this.currentConflictInfo) {
          const pref = {
            ...(this.nlpPreferences || {}),
            conflictResolutionStrategy: strategy
          };
          this.executeScheduling(this.currentConflictInfo.tasks, pref);
        }
      };
    });
  }

  executeScheduling(tasks, preferences = {}) {
    const result = AISchedulerEngine.generateSchedule(tasks, preferences);

    if (result.conflict) {
      soundEngine.playLockError();
      this.currentConflictInfo = result;

      const modal = document.getElementById('conflict-modal');
      const msg = document.getElementById('conflict-message');
      
      msg.textContent = result.message;
      
      const optButtons = document.querySelectorAll('.conflict-opt-btn');
      optButtons.forEach(btn => {
        if (result.type === 'fixed_overlap') {
          btn.disabled = true;
          btn.style.opacity = '0.35';
        } else {
          btn.disabled = false;
          btn.style.opacity = '1';
        }
      });

      modal.classList.add('active');
    } else {
      this.timeline = result;
      StorageManager.saveTimeline(this.timeline);

      soundEngine.playLevelUp();
      this.showToast('✨ AI Timeline schedule optimized and structured!', 'success');

      this.renderTimeline();
      this.checkGameLockStatus();
      this.renderAnalytics();

      document.querySelector('[data-target="tab-timeline"]').click();
      this.checkDayCompletion();
    }
  }

  generateAISchedule(userTriggered = true) {
    this.nlpPreferences = {}; // clear NLP options when manually generating
    this.executeScheduling(this.tasks, {});
  }

  renderTimeline() {
    const wrapper = document.getElementById('timeline-cards-wrapper');
    document.getElementById('timeline-count').textContent = this.timeline.length;

    let studyMins = 0;
    let breakMins = 0;

    this.timeline.forEach(t => {
      if (['School', 'Homework', 'Tuition', 'Projects', 'Coding'].includes(t.category)) {
        studyMins += t.duration || 30;
      } else {
        breakMins += t.duration || 15;
      }
    });

    document.getElementById('timeline-study-time').textContent = `${(studyMins / 60).toFixed(1)} hrs`;
    document.getElementById('timeline-break-time').textContent = `${(breakMins / 60).toFixed(1)} hrs`;

    if (this.timeline.length === 0) {
      wrapper.innerHTML = `
        <div class="empty-state" style="padding:40px;">
          No schedule generated yet! Click "Generate AI Schedule" or describe your day in the planner.
        </div>
      `;
      return;
    }

    wrapper.innerHTML = this.timeline.map((item, idx) => `
      <div class="timeline-card ${item.isBreak ? 'break-card' : ''} ${item.completed ? 'completed' : ''}" 
           draggable="true" data-index="${idx}" style="border-left-color: ${item.color || 'var(--accent-primary)'};">
        <div class="tl-time">${item.timeDisplay || '08:00 AM'}</div>
        <div class="tl-icon">${item.icon || '⚡'}</div>
        <div class="tl-body">
          <h4 style="text-decoration: ${item.completed ? 'line-through' : 'none'};">${item.title}</h4>
          <p>${item.category} • ${item.duration} mins ${item.notes ? `• ${item.notes}` : ''}</p>
        </div>
        <div class="tl-actions">
          ${!item.isFixed && !item.isBreak ? `
            <button class="task-check-btn tl-check-btn" data-id="${item.id}">
              ${item.completed ? '✅' : '⭕'}
            </button>
          ` : ''}
        </div>
      </div>
    `).join('');

    // Attach check toggle for timeline
    wrapper.querySelectorAll('.tl-check-btn').forEach(b => {
      b.onclick = () => this.toggleTaskComplete(b.dataset.id);
    });

    // Drag and Drop reordering
    wrapper.querySelectorAll('.timeline-card').forEach(card => {
      card.addEventListener('dragstart', (e) => {
        this.draggedTaskIndex = parseInt(card.dataset.index);
        e.dataTransfer.effectAllowed = 'move';
      });

      card.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      });

      card.addEventListener('drop', (e) => {
        e.preventDefault();
        const targetIndex = parseInt(card.dataset.index);
        if (this.draggedTaskIndex !== null && this.draggedTaskIndex !== targetIndex) {
          const item = this.timeline.splice(this.draggedTaskIndex, 1)[0];
          this.timeline.splice(targetIndex, 0, item);
          
          // Auto recalculate slots
          this.timeline = AISchedulerEngine.recalculateSchedule(this.timeline);
          StorageManager.saveTimeline(this.timeline);
          soundEngine.playClick();
          this.renderTimeline();
          this.checkDayCompletion();
        }
      });
    });

    // Timeline Buttons
    document.getElementById('timeline-recalc-btn').onclick = () => {
      this.timeline = AISchedulerEngine.recalculateSchedule(this.timeline);
      StorageManager.saveTimeline(this.timeline);
      soundEngine.playSuccess();
      this.renderTimeline();
      this.checkDayCompletion();
      this.showToast('Schedule auto-recalculated! 🔄', 'success');
    };

    document.getElementById('timeline-regen-btn').onclick = () => this.generateAISchedule();
  }

  /* -------------------------------------------------------------------------- */
  /* 6. GAME UNLOCK SYSTEM & 8 MINI GAMES                                       */
  /* -------------------------------------------------------------------------- */
  isGamesSectionLocked() {
    if (this.tasks.length === 0) return true;
    const completed = this.tasks.filter(t => t.completed).length;
    return completed < this.tasks.length;
  }

  checkGameLockStatus() {
    const isLocked = this.isGamesSectionLocked();
    const lockOverlay = document.getElementById('games-lock-overlay');
    const gamesContent = document.getElementById('games-content');
    const navIcon = document.getElementById('games-nav-icon');

    const total = this.tasks.length;
    const completed = this.tasks.filter(t => t.completed).length;
    const pct = total === 0 ? 0 : Math.round((completed / total) * 100);

    // Dashboard Banner update
    document.getElementById('dash-lock-fill').style.width = `${pct}%`;
    document.getElementById('lock-bar-fill').style.width = `${pct}%`;
    document.getElementById('lock-pct-text').textContent = `${pct}% (${completed}/${total})`;

    if (isLocked) {
      lockOverlay.classList.remove('hidden');
      gamesContent.classList.add('hidden');
      navIcon.textContent = '🔒';

      document.getElementById('dash-lock-icon').textContent = '🔒';
      document.getElementById('dash-lock-title').textContent = 'Games Section Locked';
      document.getElementById('dash-lock-desc').textContent = 'Complete all scheduled tasks for today to unlock your game rewards!';
    } else {
      lockOverlay.classList.add('hidden');
      gamesContent.classList.remove('hidden');
      navIcon.textContent = '🎮';

      document.getElementById('dash-lock-icon').textContent = '🎉';
      document.getElementById('dash-lock-title').textContent = 'Arcade Unlocked!';
      document.getElementById('dash-lock-desc').textContent = 'Congratulations! You completed all responsibilities today. Enjoy your games!';

      if (pct === 100 && !this._celebratedToday) {
        this.checkDayCompletion();
      }
    }

    document.getElementById('goto-tasks-btn').onclick = () => {
      document.querySelector('[data-target="tab-planner"]').click();
    };

    document.getElementById('dev-bypass-btn').onclick = () => {
      lockOverlay.classList.add('hidden');
      gamesContent.classList.remove('hidden');
      soundEngine.playLevelUp();
      triggerConfetti();
      this.showToast('⚡ Dev Instant Unlock active!', 'info');
    };

    // Attach Play Game Listeners
    document.querySelectorAll('.play-game-btn').forEach(btn => {
      btn.onclick = () => this.launchGameModal(btn.dataset.game);
    });
  }

  launchGameModal(gameKey) {
    if (this.activeGameCleanup) {
      try {
        this.activeGameCleanup();
      } catch (e) {
        console.warn("Active game cleanup error:", e);
      }
      this.activeGameCleanup = null;
    }

    const modal = document.getElementById('game-modal');
    const viewport = document.getElementById('game-viewport');
    const titleEl = document.getElementById('active-game-title');
    soundEngine.playClick();

    modal.classList.add('active');

    const gameNames = {
      snake: '🐍 Classic Snake',
      '2048': '🧩 2048 Puzzle',
      memory: '🎴 Memory Flip',
      tictactoe: '❌⭕ Tic-Tac-Toe AI',
      colormatch: '🎨 Color Reflex',
      wordle: '🔤 Word Master',
      reaction: '⚡ Reaction Speed Test',
      math: '➕ Math Blitz'
    };

    titleEl.textContent = gameNames[gameKey] || '🎮 Mini Game';

    let cleanup = null;
    switch (gameKey) {
      case 'snake': cleanup = renderSnakeGame(viewport); break;
      case '2048': cleanup = render2048Game(viewport); break;
      case 'memory': cleanup = renderMemoryGame(viewport); break;
      case 'tictactoe': cleanup = renderTicTacToeGame(viewport); break;
      case 'colormatch': cleanup = renderColorMatchGame(viewport); break;
      case 'wordle': cleanup = renderWordleGame(viewport); break;
      case 'reaction': cleanup = renderReactionGame(viewport); break;
      case 'math': cleanup = renderMathGame(viewport); break;
    }

    if (typeof cleanup === 'function') {
      this.activeGameCleanup = cleanup;
    }

    document.getElementById('close-game-modal').onclick = () => {
      modal.classList.remove('active');
      viewport.innerHTML = '';
      if (this.activeGameCleanup) {
        try {
          this.activeGameCleanup();
        } catch (e) {
          console.warn("Game close cleanup error:", e);
        }
        this.activeGameCleanup = null;
      }
      this.updateHeaderStats();
    };
  }

  /* -------------------------------------------------------------------------- */
  /* 7. ANALYTICS & REWARDS SHOP                                                */
  /* -------------------------------------------------------------------------- */
  renderAnalytics() {
    let focusMins = 0;
    let breakMins = 0;
    this.tasks.forEach(t => {
      if (['School', 'Homework', 'Tuition', 'Projects', 'Coding'].includes(t.category)) {
        focusMins += t.duration || 30;
      } else {
        breakMins += t.duration || 15;
      }
    });

    AnalyticsRenderer.renderFocusRatioChart('chart-focus-ratio', focusMins || 240, breakMins || 60);
    AnalyticsRenderer.renderWeeklyBarChart('chart-weekly-bar');

    document.getElementById('an-curr-streak').textContent = this.stats.streakDays;
    document.getElementById('an-best-streak').textContent = this.stats.longestStreak || 7;
    
    this.renderAchievements();
  }

  renderAchievements() {
    const grid = document.getElementById('analytics-badges-grid');
    if (!grid) return;

    const unlockedList = this.stats.badges || [];

    grid.innerHTML = BADGES_CATALOG.map(badge => {
      const isUnlocked = unlockedList.includes(badge.name);
      return `
        <div class="badge-item ${isUnlocked ? '' : 'locked'}">
          <span class="badge-status-tag">${isUnlocked ? 'UNLOCKED' : 'LOCKED'}</span>
          <div class="badge-icon-wrap">${badge.icon}</div>
          <div class="badge-name">${badge.name}</div>
          <div class="badge-desc">${badge.desc}</div>
        </div>
      `;
    }).join('');
  }

  setupShop() {
    const grid = document.getElementById('shop-items-grid');
    grid.innerHTML = SHOP_ITEMS.map(item => `
      <div class="shop-card glass-panel">
        <div class="shop-preview">${item.value}</div>
        <h4>${item.name}</h4>
        <p style="font-size:0.8rem; color:var(--text-muted);">${item.desc}</p>
        <div class="shop-price">🪙 ${item.price} Coins</div>
        <button class="btn btn-primary btn-sm buy-item-btn" data-id="${item.id}">Buy Item 🛍️</button>
      </div>
    `).join('');

    grid.querySelectorAll('.buy-item-btn').forEach(btn => {
      btn.onclick = () => {
        const item = SHOP_ITEMS.find(x => x.id === btn.dataset.id);
        if (item) {
          if (this.stats.coins >= item.price) {
            this.stats.coins -= item.price;
            if (item.type === 'avatar') this.profile.avatar = item.value;
            if (item.type === 'theme') this.applyTheme(item.value);

            StorageManager.saveStats(this.stats);
            StorageManager.saveProfile(this.profile);
            soundEngine.playLevelUp();
            triggerConfetti();
            this.updateHeaderStats();
            this.showToast(`Purchased ${item.name}! 🎉`, 'success');
          } else {
            soundEngine.playLockError();
            this.showToast('Need more coins! Complete tasks to earn 🪙', 'warning');
          }
        }
      };
    });
  }

  /* -------------------------------------------------------------------------- */
  /* 8. WISEBOT AI COACH & POMODORO TIMER                                       */
  /* -------------------------------------------------------------------------- */
  setupWiseBotModal() {
    const modal = document.getElementById('wisebot-modal');
    document.getElementById('wisebot-trigger-btn').onclick = () => modal.classList.add('active');
    document.getElementById('close-wisebot-modal').onclick = () => modal.classList.remove('active');

    // WiseBot Tabs
    document.querySelectorAll('.wb-tab-btn').forEach(btn => {
      btn.onclick = () => {
        soundEngine.playClick();
        document.querySelectorAll('.wb-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.wb-tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`wb-tab-${btn.dataset.wbtab}`).classList.add('active');
      };
    });

    // Chat Send
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send-btn');
    const chatBox = document.getElementById('chat-messages-box');

    const handleChat = () => {
      const text = chatInput.value.trim();
      if (!text) return;

      soundEngine.playClick();
      chatBox.innerHTML += `
        <div class="chat-msg user-msg"><div class="msg-bubble">${text}</div></div>
      `;
      chatInput.value = '';
      chatBox.scrollTop = chatBox.scrollHeight;

      setTimeout(() => {
        const reply = this.wiseBot.getResponse(text);
        soundEngine.playSuccess();
        chatBox.innerHTML += `
          <div class="chat-msg bot-msg"><div class="msg-bubble">${reply}</div></div>
        `;
        chatBox.scrollTop = chatBox.scrollHeight;
      }, 500);
    };

    sendBtn.onclick = handleChat;
    chatInput.onkeypress = (e) => { if (e.key === 'Enter') handleChat(); };

    // Pomodoro Timer
    const timerDisplay = document.getElementById('pomo-timer-display');
    document.getElementById('pomo-start-btn').onclick = () => {
      soundEngine.playClick();
      this.wiseBot.startPomodoro(
        (timeStr) => { timerDisplay.textContent = timeStr; },
        () => {
          this.showToast('🔔 Pomodoro Focus Session Complete! Time for a break!', 'success');
        }
      );
    };

    document.getElementById('pomo-pause-btn').onclick = () => {
      soundEngine.playClick();
      this.wiseBot.pausePomodoro();
    };

    document.getElementById('pomo-reset-btn').onclick = () => {
      soundEngine.playClick();
      timerDisplay.textContent = this.wiseBot.resetPomodoro();
    };

    // Ambient sound synth
    document.querySelectorAll('.ambient-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.ambient-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        soundEngine.startAmbient(btn.dataset.sound);
      };
    });
  }

  /* -------------------------------------------------------------------------- */
  /* 9. SETTINGS & THEMING                                                      */
  /* -------------------------------------------------------------------------- */
  setupSettings() {
    const selector = document.getElementById('theme-selector');
    selector.value = this.settings.theme;
    selector.onchange = () => {
      this.settings.theme = selector.value;
      StorageManager.saveSettings(this.settings);
      this.applyTheme(selector.value);
      soundEngine.playClick();
    };

    const sfxToggle = document.getElementById('sfx-toggle');
    sfxToggle.checked = this.settings.sfx;
    sfxToggle.onchange = () => {
      this.settings.sfx = sfxToggle.checked;
      soundEngine.enabled = sfxToggle.checked;
      StorageManager.saveSettings(this.settings);
    };

    document.getElementById('export-data-btn').onclick = () => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(localStorage));
      const anchor = document.createElement('a');
      anchor.setAttribute("href", dataStr);
      anchor.setAttribute("download", "timewise_data_export.json");
      anchor.click();
    };

    document.getElementById('reset-data-btn').onclick = () => {
      if (confirm('Warning: This will clear all tasks, achievements, and stats. Proceed?')) {
        StorageManager.resetAll();
        location.reload();
      }
    };
  }

  applyTheme(themeName) {
    document.documentElement.setAttribute('data-theme', themeName);
  }

  loadSamplePreset() {
    const samples = [
      {
        id: 't-1',
        title: 'Morning School Classes & Assembly',
        category: 'School',
        duration: 360,
        priority: 'High',
        preferredTime: '08:00',
        difficulty: 'Medium',
        color: '#06b6d4',
        notes: 'Math, Science, English & History periods',
        completed: false
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
        completed: false
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

    this.tasks = samples;
    StorageManager.saveTasks(this.tasks);

    this.timeline = [];
    StorageManager.saveTimeline(this.timeline);

    soundEngine.playSuccess();
    this.renderPlannerTasks();
    this.renderDashboard();
    this.renderTimeline();
    this.checkGameLockStatus();
    this.showToast('💡 Sample Teen Schedule loaded! Click Generate AI Schedule to build timeline.', 'info');
  }

  /* -------------------------------------------------------------------------- */
  /* 10. SMART TOAST NOTIFICATIONS                                             */
  /* -------------------------------------------------------------------------- */
  startSmartNudges() {
    const nudges = [
      "Time for Homework 📚",
      "Drink some water 💧",
      "Stretch for a minute 🤸",
      "One task left! You've got this! 🚀",
      "Almost done! Arcade games await! 🎮"
    ];

    setInterval(() => {
      const msg = nudges[Math.floor(Math.random() * nudges.length)];
      this.showToast(msg, 'info');
    }, 45000); // Nudge every 45s
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.innerHTML = `<span>⚡</span><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
}

// Launch Application on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new TimeWiseApp();
  app.init();
});
