/* ==========================================================================
   TIMEWISE - GAMIFICATION & REWARDS ENGINE
   XP rewards, coin rewards, streaks, badges, leveling, shop items.
   ========================================================================== */

export const BADGES_CATALOG = [
  { id: 'first_day', name: 'First Day', icon: '🏆', desc: 'Complete your first full day!' },
  { id: 'streak_3', name: '3 Day Streak', icon: '🔥', desc: 'Complete 3 days of tasks in a row!' },
  { id: 'streak_7', name: '7 Day Streak', icon: '⭐', desc: 'Complete 7 days of tasks in a row!' },
  { id: 'brain_trainer', name: 'Brain Trainer', icon: '🧠', desc: 'Complete your first mind game!' },
  { id: 'study_star', name: 'Study Star', icon: '📚', desc: 'Complete 5 study or focus tasks!' },
  { id: 'task_master', name: 'Task Master', icon: '🎯', desc: 'Complete 50 tasks in total!' }
];

export const SHOP_ITEMS = [
  { id: 'avatar_dragon', type: 'avatar', value: '🐉', name: 'Cosmic Dragon Avatar', price: 50, desc: 'Fiery dragon avatar icon' },
  { id: 'avatar_rocket', type: 'avatar', value: '🚀', name: 'Starlight Rocket Avatar', price: 60, desc: 'High-speed space rocket' },
  { id: 'avatar_unicorn', type: 'avatar', value: '🦄', name: 'Mystic Unicorn Avatar', price: 75, desc: 'Magical neon unicorn' },
  { id: 'avatar_ninja', type: 'avatar', value: '🥷', name: 'Shadow Ninja Avatar', price: 100, desc: 'Stealth productivity ninja' },
  { id: 'theme_sunset', type: 'theme', value: 'sunset', name: 'Sunset Glow Theme', price: 80, desc: 'Warm pink & orange gradients' },
  { id: 'theme_emerald', type: 'theme', value: 'emerald', name: 'Emerald Fresh Theme', price: 80, desc: 'Refreshing green theme' }
];

export class GamificationEngine {
  
  /**
   * Calculate XP and Coins based on task difficulty and duration
   */
  static getRewardsForTask(task) {
    let baseXP = 20;
    let baseCoins = 10;

    if (task.difficulty === 'Easy') {
      baseXP = 15;
      baseCoins = 5;
    } else if (task.difficulty === 'Medium') {
      baseXP = 30;
      baseCoins = 15;
    } else if (task.difficulty === 'Hard') {
      baseXP = 55;
      baseCoins = 25;
    }

    // Bonus for longer focus tasks
    if (task.duration >= 60) {
      baseXP += 15;
      baseCoins += 10;
    }

    return { xp: baseXP, coins: baseCoins };
  }

  /**
   * Update stats when task completed
   */
  static awardTaskCompletion(stats, task) {
    const rewards = this.getRewardsForTask(task);
    stats.xp = (stats.xp || 0) + rewards.xp;
    stats.coins = (stats.coins || 0) + rewards.coins;
    stats.totalTasksCompleted = (stats.totalTasksCompleted || 0) + 1;
    stats.focusTimeMinutes = (stats.focusTimeMinutes || 0) + (task.duration || 30);

    if (['School', 'Homework', 'Tuition', 'Projects', 'Coding'].includes(task.category)) {
      stats.studyTasksCompleted = (stats.studyTasksCompleted || 0) + 1;
    }

    // Calculate level
    const newLevel = Math.floor(stats.xp / 100) + 1;
    const leveledUp = newLevel > stats.level;
    stats.level = newLevel;

    return { stats, rewards, leveledUp };
  }

  /**
   * Check badge unlock conditions
   */
  static checkBadges(stats, tasks, timeline) {
    const unlocked = [...(stats.badges || [])];
    const newUnlocked = [];

    const tryUnlock = (badgeName) => {
      if (!unlocked.includes(badgeName)) {
        unlocked.push(badgeName);
        newUnlocked.push(badgeName);
      }
    };

    // First Day: streakDays >= 1
    if (stats.streakDays >= 1) {
      tryUnlock('First Day');
    }

    // 3 Day Streak
    if (stats.streakDays >= 3) {
      tryUnlock('3 Day Streak');
    }

    // 7 Day Streak
    if (stats.streakDays >= 7) {
      tryUnlock('7 Day Streak');
    }

    // Brain Trainer
    if ((stats.gamesPlayed || 0) >= 1) {
      tryUnlock('Brain Trainer');
    }

    // Study Star
    if ((stats.studyTasksCompleted || 0) >= 5) {
      tryUnlock('Study Star');
    }

    // Task Master
    if ((stats.totalTasksCompleted || 0) >= 50) {
      tryUnlock('Task Master');
    }

    stats.badges = unlocked;
    return { stats, newUnlocked };
  }
}
