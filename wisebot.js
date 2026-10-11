/* ==========================================================================
   TIMEWISE - WISEBOT AI COACH & POMODORO FOCUS TIMER
   AI conversation engine, focus countdown timer, lo-fi audio integration.
   ========================================================================== */

import { soundEngine } from './audio.js';

const WISEBOT_RESPONSES = {
  default: "That's a great goal! Try breaking it down into 25-minute focus sprints with 5-minute breaks. You've got this! 🚀",
  math: "Math homework is best tackled when your brain is fresh right after a light snack! Start with the hardest problems first. 🧮",
  study: "To retain 80% more of what you study, try teaching the core concepts back to yourself out loud! 📚",
  focus: "Feeling distracted? Put your phone on 'Do Not Disturb' across the room and turn on our Pomodoro Rain Noise synth! 🌧️",
  games: "Want to unlock today's mini-games? Finish your top priority task right now and you'll be halfway there! 🎮",
  tired: "Take a 10-minute walk, drink a glass of cold water 💧, and stretch. Your energy will bounce right back!"
};

export class WiseBot {
  constructor() {
    this.pomoDuration = 25 * 60; // 25 mins
    this.pomoRemaining = 25 * 60;
    this.pomoTimer = null;
    this.pomoRunning = false;
  }

  getResponse(userText) {
    const text = userText.toLowerCase();
    if (text.includes('math') || text.includes('homework')) return WISEBOT_RESPONSES.math;
    if (text.includes('study') || text.includes('exam')) return WISEBOT_RESPONSES.study;
    if (text.includes('focus') || text.includes('distract')) return WISEBOT_RESPONSES.focus;
    if (text.includes('game') || text.includes('unlock')) return WISEBOT_RESPONSES.games;
    if (text.includes('tired') || text.includes('lazy')) return WISEBOT_RESPONSES.tired;
    return WISEBOT_RESPONSES.default;
  }

  startPomodoro(onTick, onComplete) {
    if (this.pomoRunning) return;
    this.pomoRunning = true;

    this.pomoTimer = setInterval(() => {
      this.pomoRemaining--;
      if (onTick) onTick(this.formatTime(this.pomoRemaining));

      if (this.pomoRemaining <= 0) {
        this.pausePomodoro();
        soundEngine.playLevelUp();
        if (onComplete) onComplete();
      }
    }, 1000);
  }

  pausePomodoro() {
    this.pomoRunning = false;
    if (this.pomoTimer) {
      clearInterval(this.pomoTimer);
      this.pomoTimer = null;
    }
  }

  resetPomodoro() {
    this.pausePomodoro();
    this.pomoRemaining = this.pomoDuration;
    return this.formatTime(this.pomoRemaining);
  }

  formatTime(totalSecs) {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    const padM = mins < 10 ? `0${mins}` : mins;
    const padS = secs < 10 ? `0${secs}` : secs;
    return `${padM}:${padS}`;
  }
}
