/* ==========================================================================
   TIMEWISE - AI SCHEDULE GENERATOR & NATURAL LANGUAGE PARSER
   Generates optimized conflict-free daily timetables from structured tasks or
   natural language instructions, supporting prioritizations, break scheduling,
   and dynamic meal slots.
   ========================================================================== */

const CATEGORY_ICONS = {
  School: '🏫',
  Homework: '📚',
  Tuition: '✍️',
  Projects: '🧪',
  Sports: '⚽',
  Exercise: '🏃',
  Reading: '📖',
  Coding: '💻',
  Music: '🎵',
  Dance: '💃',
  'Family Time': '👨‍👩‍👧',
  Sleep: '😴',
  Meals: '🍽️',
  Relax: '🛋️',
  Gaming: '🎮',
  Break: '☕',
  Custom: '✨'
};

export class AISchedulerEngine {
  
  /**
   * Helper to convert "HH:MM" 24h format to minutes from midnight
   */
  static timeToMins(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    const h = parseInt(parts[0]) || 0;
    const m = parseInt(parts[1]) || 0;
    return h * 60 + m;
  }

  /**
   * Helper to convert minutes from midnight to 12-hour AM/PM string
   */
  static minsTo12HourStr(totalMins) {
    let normalized = totalMins % (24 * 60);
    if (normalized < 0) normalized += 24 * 60;
    let hours = Math.floor(normalized / 60);
    const mins = Math.floor(normalized % 60);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    if (hours === 0) hours = 12;
    const padMins = mins < 10 ? `0${mins}` : mins;
    const padHours = hours < 10 ? `0${hours}` : hours;
    return `${padHours}:${padMins} ${ampm}`;
  }

  /**
   * Natural Language Parser Engine
   * Interprets casual sentences to generate tasks and scheduling constraints.
   */
  static parseNaturalLanguage(text) {
    const tasks = [];
    const preferences = {
      wakeTime: '07:00',
      sleepTime: '22:30',
      availableHours: null,
      priorities: []
    };

    // 1. Parse wake up time: e.g. "woke up at 8 AM", "wake up at 7:30"
    const wakeRegex = /(?:wake\s*up|woke\s*up|start\s*day|wake)\s*(?:at|by|around)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i;
    const wakeMatch = text.match(wakeRegex);
    if (wakeMatch) {
      let h = parseInt(wakeMatch[1]);
      let m = parseInt(wakeMatch[2] || '0');
      let ampm = wakeMatch[3] ? wakeMatch[3].toLowerCase() : '';
      if (ampm === 'pm' && h < 12) h += 12;
      if (ampm === 'am' && h === 12) h = 0;
      preferences.wakeTime = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    }

    // 2. Parse sleep time: e.g. "sleep by 10:30 PM", "sleep at 11", "bedtime at 10 PM"
    const sleepRegex = /(?:sleep|bedtime|go\s*to\s*sleep|wind\s*down)\s*(?:at|by|around)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i;
    const sleepMatch = text.match(sleepRegex);
    if (sleepMatch) {
      let h = parseInt(sleepMatch[1]);
      let m = parseInt(sleepMatch[2] || '0');
      let ampm = sleepMatch[3] ? sleepMatch[3].toLowerCase() : '';
      if (ampm === 'pm' && h < 12) h += 12;
      if (ampm === 'am' && h === 12) h = 0;
      if (!ampm && h < 12 && h >= 8) h += 12; // Smart PM assume for 8-11
      preferences.sleepTime = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    }

    // 3. Parse available hours: e.g. "only have 4 hours available", "available for 5 hours"
    const availRegex = /(?:have|available\s*for)\s*(\d+(?:\.\d+)?)\s*hours?\b/i;
    const availMatch = text.match(availRegex);
    if (availMatch && text.includes('available')) {
      preferences.availableHours = parseFloat(availMatch[1]);
    }

    // 4. Parse priorities: e.g. "prioritize science", "maths is important"
    const priorityKeywords = ['science', 'math', 'maths', 'exam', 'test', 'football', 'coding', 'homework', 'projects', 'revision', 'reading', 'music', 'dance'];
    priorityKeywords.forEach(keyword => {
      const reg = new RegExp(`(?:prioritize|important|focus\\s*on|prep\\s*for)\\s*${keyword}|${keyword}\\s+(?:is\\s+important|is\\s+priority)`, 'i');
      if (reg.test(text)) {
        preferences.priorities.push(keyword.toLowerCase());
      }
    });

    // Clean text and split clauses by commas, semicolons or "and"
    const clauses = text.split(/[,.;]|\band\b/i);
    clauses.forEach(clause => {
      clause = clause.trim();
      if (!clause || clause.length < 4) return;

      // Skip clauses that only describe wake/sleep/available preferences
      if (clause.match(/wake\s*up/i) || clause.match(/sleep/i) || clause.match(/available/i)) return;

      // Check if it's a fixed commitment: "X from Y to Z"
      // E.g. "school from 8 to 3", "football practice from 5 PM to 6:30 PM", "maths from 4:30 to 6"
      const fixedRegex = /([a-zA-Z\s\-]{3,30})\s+(?:from|at|between)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:to|and|-)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i;
      const fixedMatch = clause.match(fixedRegex);
      if (fixedMatch) {
        const title = fixedMatch[1].trim();
        let sh = parseInt(fixedMatch[2]);
        let sm = parseInt(fixedMatch[3] || '0');
        let sampm = fixedMatch[4] ? fixedMatch[4].toLowerCase() : '';

        let eh = parseInt(fixedMatch[5]);
        let em = parseInt(fixedMatch[6] || '0');
        let eampm = fixedMatch[7] ? fixedMatch[7].toLowerCase() : '';

        // Smart AM/PM resolution
        if (sampm === 'pm' && sh < 12) sh += 12;
        if (sampm === 'am' && sh === 12) sh = 0;
        if (eampm === 'pm' && eh < 12) eh += 12;
        if (eampm === 'am' && eh === 12) eh = 0;

        // If no AM/PM specified, guess logically:
        if (!sampm && !eampm) {
          if (sh >= 7 && sh <= 12 && eh < 7) {
            // E.g. "8 to 3" -> 8 AM to 3 PM
            eh += 12;
          } else if (sh < 7 && eh < 7) {
            // E.g. "5 to 6" -> 5 PM to 6 PM
            sh += 12;
            eh += 12;
          }
        }

        const startStr = `${sh.toString().padStart(2, '0')}:${sm.toString().padStart(2, '0')}`;
        const endStr = `${eh.toString().padStart(2, '0')}:${em.toString().padStart(2, '0')}`;
        const duration = (eh * 60 + em) - (sh * 60 + sm);

        if (duration > 0) {
          const category = guessCategory(title);
          tasks.push({
            id: `nlp-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            title: capitalizeFirstLetter(title),
            category,
            duration,
            priority: checkPriority(title, preferences.priorities),
            isFixed: true,
            startTime: startStr,
            endTime: endStr,
            preferredTime: startStr,
            completed: false,
            color: getCategoryColor(category)
          });
        }
        return;
      }

      // Check if it's a flexible task: "X for Y duration" or "Y duration of X"
      // E.g. "2 hours of homework", "45 minutes of maths revision", "study maths for 1 hour"
      const durRegex = /(?:need|want|have|for)?\s*(\d+(?:\.\d+)?)\s*(hour|hr|minute|min)s?\s*(?:of)?\s*([a-zA-Z\s\-]{3,30})/i;
      const durMatch = clause.match(durRegex);
      if (durMatch) {
        const value = parseFloat(durMatch[1]);
        const unit = durMatch[2].toLowerCase();
        const title = durMatch[3].trim();
        const duration = (unit.startsWith('hour') || unit.startsWith('hr')) ? Math.round(value * 60) : Math.round(value);
        const category = guessCategory(title);

        tasks.push({
          id: `nlp-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          title: capitalizeFirstLetter(title),
          category,
          duration,
          priority: checkPriority(title, preferences.priorities),
          isFixed: false,
          completed: false,
          color: getCategoryColor(category)
        });
        return;
      }

      // Reverse pattern: "study maths for 1 hour"
      const revDurRegex = /([a-zA-Z\s\-]{3,30})\s+for\s+(\d+(?:\.\d+)?)\s*(hour|hr|minute|min)s?/i;
      const revDurMatch = clause.match(revDurRegex);
      if (revDurMatch) {
        const title = revDurMatch[1].trim();
        const value = parseFloat(revDurMatch[2]);
        const unit = revDurMatch[3].toLowerCase();
        const duration = (unit.startsWith('hour') || unit.startsWith('hr')) ? Math.round(value * 60) : Math.round(value);
        const category = guessCategory(title);

        tasks.push({
          id: `nlp-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          title: capitalizeFirstLetter(title),
          category,
          duration,
          priority: checkPriority(title, preferences.priorities),
          isFixed: false,
          completed: false,
          color: getCategoryColor(category)
        });
        return;
      }

      // Simple keyword extract fallback
      const cleanClause = clause.replace(/\b(i|want|need|have|to|a|an|the|some|for|and|tomorrow|today)\b/gi, '').trim();
      if (cleanClause.length > 3) {
        const category = guessCategory(cleanClause);
        tasks.push({
          id: `nlp-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          title: capitalizeFirstLetter(cleanClause),
          category,
          duration: 45, // default
          priority: checkPriority(cleanClause, preferences.priorities),
          isFixed: false,
          completed: false,
          color: getCategoryColor(category)
        });
      }
    });

    return { tasks, preferences };
  }

  /**
   * Generate an optimized conflict-free daily timetable
   */
  static generateSchedule(tasks, preferences = {}) {
    const wakeTime = preferences.wakeTime || '07:00';
    const sleepTime = preferences.sleepTime || '22:30';
    const studyBreaks = preferences.studyBreaks !== false;
    const strategy = preferences.conflictResolutionStrategy || null;

    let wakeMin = this.timeToMins(wakeTime);
    let sleepMin = this.timeToMins(sleepTime);

    if (sleepMin < wakeMin) {
      sleepMin += 24 * 60; // Next day wind-down rollover
    }

    // Segregate tasks
    let fixedTasks = tasks.filter(t => t.isFixed || (t.startTime && t.endTime)).map(t => {
      const startMin = this.timeToMins(t.startTime);
      let endMin = this.timeToMins(t.endTime);
      if (endMin < startMin) endMin += 24 * 60;
      return {
        ...t,
        startMin,
        endMin,
        duration: endMin - startMin
      };
    });

    let flexibleTasks = tasks.filter(t => !(t.isFixed || (t.startTime && t.endTime))).map(t => ({
      ...t,
      duration: parseInt(t.duration) || 30
    }));

    // Detect overlap conflicts on fixed commitments
    fixedTasks.sort((a, b) => a.startMin - b.startMin);
    for (let i = 0; i < fixedTasks.length - 1; i++) {
      if (fixedTasks[i].endMin > fixedTasks[i + 1].startMin) {
        return {
          conflict: true,
          type: 'fixed_overlap',
          message: `🚫 Conflicts: "${fixedTasks[i].title}" overlaps with "${fixedTasks[i+1].title}". Please reschedule one of them!`,
          tasks
        };
      }
    }

    // Default meal durations
    let breakfastDur = 30;
    let lunchDur = 45;
    let dinnerDur = 45;

    // Check available hour limits
    if (preferences.availableHours) {
      const maxAvailableMins = preferences.availableHours * 60;
      const flexTotal = flexibleTasks.reduce((sum, t) => sum + t.duration, 0);
      if (flexTotal > maxAvailableMins && !strategy) {
        return {
          conflict: true,
          type: 'overscheduled',
          excessMins: flexTotal - maxAvailableMins,
          message: `Available slots fit ${preferences.availableHours} hours, but flexible tasks request ${(flexTotal/60).toFixed(1)} hours.`,
          tasks
        };
      }
    }

    // Calculate total required minutes
    let totalFixedDur = fixedTasks.reduce((sum, t) => sum + t.duration, 0);
    let totalFlexDur = flexibleTasks.reduce((sum, t) => sum + t.duration, 0);
    let totalMealsDur = breakfastDur + lunchDur + dinnerDur;

    // Calculate study sessions for break estimation
    let studyDur = flexibleTasks.filter(t => ['School', 'Homework', 'Tuition', 'Projects', 'Coding'].includes(t.category)).reduce((sum, t) => sum + t.duration, 0);
    let estBreaksDur = studyBreaks ? Math.floor(studyDur / 50) * 15 : 0;

    let totalRequired = totalFixedDur + totalFlexDur + totalMealsDur + estBreaksDur;
    let totalAvailable = sleepMin - wakeMin;

    // Trigger strategy adjustments if overscheduled
    if (totalRequired > totalAvailable) {
      if (!strategy) {
        return {
          conflict: true,
          type: 'overscheduled',
          excessMins: totalRequired - totalAvailable,
          message: `Your schedule has ${Math.round(totalRequired / 60)} hours of plans, but you only have ${Math.round(totalAvailable / 60)} hours of active day.`,
          tasks
        };
      }

      if (strategy === 'reduce_breaks') {
        breakfastDur = 15;
        lunchDur = 20;
        dinnerDur = 20;
        estBreaksDur = 0; // disable flexible breaks
        totalMealsDur = 15 + 20 + 20;
      } else if (strategy === 'priority_only') {
        const pWeight = { Urgent: 4, High: 3, Medium: 2, Low: 1 };
        flexibleTasks = flexibleTasks.filter(t => (pWeight[t.priority] || 1) >= 3);
        totalFlexDur = flexibleTasks.reduce((sum, t) => sum + t.duration, 0);
        studyDur = flexibleTasks.filter(t => ['School', 'Homework', 'Tuition', 'Projects', 'Coding'].includes(t.category)).reduce((sum, t) => sum + t.duration, 0);
        estBreaksDur = studyBreaks ? Math.floor(studyDur / 50) * 15 : 0;
      } else if (strategy === 'scale') {
        const targetFlexAvailable = totalAvailable - totalFixedDur - totalMealsDur - estBreaksDur;
        const ratio = targetFlexAvailable / (totalFlexDur || 1);
        if (ratio > 0.3) {
          flexibleTasks = flexibleTasks.map(t => ({
            ...t,
            duration: Math.max(15, Math.round(t.duration * ratio))
          }));
          totalFlexDur = flexibleTasks.reduce((sum, t) => sum + t.duration, 0);
        } else {
          // Drop low/medium priority if scaling ratio is too extreme
          flexibleTasks = flexibleTasks.filter(t => t.priority === 'High' || t.priority === 'Urgent');
          totalFlexDur = flexibleTasks.reduce((sum, t) => sum + t.duration, 0);
        }
      }
    }

    // Build timeline events list
    const timeline = [];

    // Breakfast anchor placement (always at wakeMin)
    timeline.push({
      id: 'fixed-bfast',
      title: 'Healthy Breakfast 🥣',
      category: 'Meals',
      icon: '🥣',
      startMin: wakeMin,
      endMin: wakeMin + breakfastDur,
      timeDisplay: `${this.minsTo12HourStr(wakeMin)} - ${this.minsTo12HourStr(wakeMin + breakfastDur)}`,
      duration: breakfastDur,
      isFixed: true,
      completed: true,
      color: '#fb923c'
    });

    // Load Fixed commitments
    fixedTasks.forEach(t => {
      timeline.push({
        ...t,
        icon: CATEGORY_ICONS[t.category] || '⚡',
        timeDisplay: `${this.minsTo12HourStr(t.startMin)} - ${this.minsTo12HourStr(t.endMin)}`
      });
    });

    // Dynamic Lunch placement (scans around 1:00 PM)
    let lunchPlaced = false;
    let targetLunch = 13 * 60; // 13:00

    for (let offset = 0; offset < 240; offset += 15) {
      for (let sign of [1, -1]) {
        const start = targetLunch + sign * offset;
        const end = start + lunchDur;
        if (start >= wakeMin + 60 && end <= sleepMin - 60) {
          const overlaps = timeline.some(item => (start < item.endMin && end > item.startMin));
          if (!overlaps) {
            timeline.push({
              id: 'fixed-lunch',
              title: 'Lunch Break & Relax 🍱',
              category: 'Meals',
              icon: '🍱',
              startMin: start,
              endMin: end,
              timeDisplay: `${this.minsTo12HourStr(start)} - ${this.minsTo12HourStr(end)}`,
              duration: lunchDur,
              isFixed: true,
              completed: false,
              color: '#fb923c'
            });
            lunchPlaced = true;
            break;
          }
        }
      }
      if (lunchPlaced) break;
    }

    if (!lunchPlaced) {
      const start = wakeMin + 300;
      timeline.push({
        id: 'fixed-lunch',
        title: 'Lunch Break & Relax 🍱',
        category: 'Meals',
        icon: '🍱',
        startMin: start,
        endMin: start + lunchDur,
        timeDisplay: `${this.minsTo12HourStr(start)} - ${this.minsTo12HourStr(start + lunchDur)}`,
        duration: lunchDur,
        isFixed: true,
        completed: false,
        color: '#fb923c'
      });
    }

    // Dynamic Dinner placement (scans around 7:30 PM)
    let dinnerPlaced = false;
    let targetDinner = 19.5 * 60; // 19:30

    for (let offset = 0; offset < 240; offset += 15) {
      for (let sign of [1, -1]) {
        const start = targetDinner + sign * offset;
        const end = start + dinnerDur;
        if (start >= targetLunch + 120 && end <= sleepMin - 30) {
          const overlaps = timeline.some(item => (start < item.endMin && end > item.startMin));
          if (!overlaps) {
            timeline.push({
              id: 'fixed-dinner',
              title: 'Family Dinner 🍕',
              category: 'Meals',
              icon: '🍕',
              startMin: start,
              endMin: end,
              timeDisplay: `${this.minsTo12HourStr(start)} - ${this.minsTo12HourStr(end)}`,
              duration: dinnerDur,
              isFixed: true,
              completed: false,
              color: '#fb923c'
            });
            dinnerPlaced = true;
            break;
          }
        }
      }
      if (dinnerPlaced) break;
    }

    if (!dinnerPlaced) {
      const start = sleepMin - 90;
      timeline.push({
        id: 'fixed-dinner',
        title: 'Family Dinner 🍕',
        category: 'Meals',
        icon: '🍕',
        startMin: start,
        endMin: start + dinnerDur,
        timeDisplay: `${this.minsTo12HourStr(start)} - ${this.minsTo12HourStr(start + dinnerDur)}`,
        duration: dinnerDur,
        isFixed: true,
        completed: false,
        color: '#fb923c'
      });
    }

    // Sort flexible tasks by priority
    const pWeight = { Urgent: 4, High: 3, Medium: 2, Low: 1 };
    flexibleTasks.sort((a, b) => {
      const pDiff = (pWeight[b.priority] || 1) - (pWeight[a.priority] || 1);
      if (pDiff !== 0) return pDiff;
      if (a.preferredTime && b.preferredTime) {
        return this.timeToMins(a.preferredTime) - this.timeToMins(b.preferredTime);
      }
      return 0;
    });

    let accumStudy = 0;

    flexibleTasks.forEach(task => {
      let placed = false;

      // Try preferred time
      if (task.preferredTime) {
        const start = this.timeToMins(task.preferredTime);
        const end = start + task.duration;
        if (start >= wakeMin && end <= sleepMin) {
          const overlaps = timeline.some(item => (start < item.endMin && end > item.startMin));
          if (!overlaps) {
            task.startMin = start;
            task.endMin = end;
            task.icon = CATEGORY_ICONS[task.category] || '⚡';
            task.timeDisplay = `${this.minsTo12HourStr(start)} - ${this.minsTo12HourStr(end)}`;
            timeline.push(task);
            placed = true;

            if (['School', 'Homework', 'Tuition', 'Projects', 'Coding'].includes(task.category)) {
              accumStudy += task.duration;
            } else {
              accumStudy = 0;
            }
          }
        }
      }

      // Earliest gap fit
      if (!placed) {
        timeline.sort((a, b) => a.startMin - b.startMin);
        let lastEnd = wakeMin;

        for (let i = 0; i < timeline.length; i++) {
          const currentStart = timeline[i].startMin;
          const gap = currentStart - lastEnd;

          // Check if break needed before planning this task
          if (studyBreaks && accumStudy >= 50 && ['School', 'Homework', 'Tuition', 'Projects', 'Coding'].includes(task.category)) {
            const breakStart = lastEnd;
            const breakEnd = lastEnd + 15;
            if (currentStart - breakStart >= 15 + task.duration) {
              timeline.push({
                id: `break-${breakStart}`,
                title: '15-Min Brain Break ☕',
                category: 'Break',
                icon: '☕',
                startMin: breakStart,
                endMin: breakEnd,
                timeDisplay: `${this.minsTo12HourStr(breakStart)} - ${this.minsTo12HourStr(breakEnd)}`,
                duration: 15,
                isBreak: true,
                completed: false,
                color: '#fcd34d'
              });
              
              task.startMin = breakEnd;
              task.endMin = breakEnd + task.duration;
              task.icon = CATEGORY_ICONS[task.category] || '⚡';
              task.timeDisplay = `${this.minsTo12HourStr(task.startMin)} - ${this.minsTo12HourStr(task.endMin)}`;
              timeline.push(task);
              placed = true;
              accumStudy = task.duration;
              break;
            }
          }

          if (gap >= task.duration) {
            task.startMin = lastEnd;
            task.endMin = lastEnd + task.duration;
            task.icon = CATEGORY_ICONS[task.category] || '⚡';
            task.timeDisplay = `${this.minsTo12HourStr(task.startMin)} - ${this.minsTo12HourStr(task.endMin)}`;
            timeline.push(task);
            placed = true;

            if (['School', 'Homework', 'Tuition', 'Projects', 'Coding'].includes(task.category)) {
              accumStudy += task.duration;
            } else {
              accumStudy = 0;
            }
            break;
          }
          lastEnd = timeline[i].endMin;
        }

        // Fit after last event
        if (!placed) {
          const gap = sleepMin - lastEnd;
          if (gap >= task.duration) {
            task.startMin = lastEnd;
            task.endMin = lastEnd + task.duration;
            task.icon = CATEGORY_ICONS[task.category] || '⚡';
            task.timeDisplay = `${this.minsTo12HourStr(task.startMin)} - ${this.minsTo12HourStr(task.endMin)}`;
            timeline.push(task);
            placed = true;
          }
        }
      }

      // Overflow push
      if (!placed) {
        timeline.sort((a, b) => a.startMin - b.startMin);
        const last = timeline[timeline.length - 1];
        const start = last ? last.endMin : wakeMin;
        const end = start + task.duration;
        task.startMin = start;
        task.endMin = end;
        task.icon = CATEGORY_ICONS[task.category] || '⚡';
        task.timeDisplay = `${this.minsTo12HourStr(start)} - ${this.minsTo12HourStr(end)}`;
        timeline.push(task);
      }
    });

    // Add Wake Up & sleep anchors
    timeline.push({
      id: 'fixed-wake',
      title: 'Wake Up & Refresh 🌅',
      category: 'Relax',
      icon: '🌅',
      startMin: wakeMin - 30,
      endMin: wakeMin,
      timeDisplay: `${this.minsTo12HourStr(wakeMin - 30)} - ${this.minsTo12HourStr(wakeMin)}`,
      duration: 30,
      isFixed: true,
      completed: true,
      color: '#6b7280'
    });

    timeline.push({
      id: 'fixed-sleep',
      title: 'Night Sleep & Recovery 😴',
      category: 'Sleep',
      icon: '😴',
      startMin: sleepMin,
      endMin: sleepMin + 480, // 8 hrs
      timeDisplay: `${this.minsTo12HourStr(sleepMin)} - ${this.minsTo12HourStr(sleepMin + 480)}`,
      duration: 480,
      isFixed: true,
      completed: false,
      color: '#6b7280'
    });

    timeline.sort((a, b) => a.startMin - b.startMin);
    return timeline;
  }

  /**
   * Recalculate schedule timings when tasks are edited or reordered
   */
  static recalculateSchedule(timelineItems) {
    if (timelineItems.length === 0) return [];
    
    // Find where wakeUp is, start from there, or default 7:00 AM
    const wakeItem = timelineItems.find(item => item.id === 'fixed-wake');
    let currentMin = wakeItem ? wakeItem.endMin : 7 * 60;

    return timelineItems.map((item) => {
      if (item.id === 'fixed-wake') {
        return item; // Keep wake up fixed
      }
      
      const duration = item.duration || 30;
      const start = currentMin;
      const end = currentMin + duration;
      currentMin = end;

      return {
        ...item,
        startMin: start,
        endMin: end,
        timeDisplay: `${this.minsTo12HourStr(start)} - ${this.minsTo12HourStr(end)}`
      };
    });
  }
}

function guessCategory(title) {
  const t = title.toLowerCase();
  if (t.includes('school') || t.includes('class') || t.includes('lecture')) return 'School';
  if (t.includes('homework') || t.includes('revision') || t.includes('study') || t.includes('exam') || t.includes('test') || t.includes('math') || t.includes('science') || t.includes('physics') || t.includes('chemistry') || t.includes('biology') || t.includes('history') || t.includes('geography')) return 'Homework';
  if (t.includes('football') || t.includes('soccer') || t.includes('basketball') || t.includes('tennis') || t.includes('cricket') || t.includes('sports') || t.includes('practice') || t.includes('gym') || t.includes('workout') || t.includes('exercise') || t.includes('run')) return 'Sports';
  if (t.includes('code') || t.includes('coding') || t.includes('python') || t.includes('java') || t.includes('programming') || t.includes('html')) return 'Coding';
  if (t.includes('game') || t.includes('gaming') || t.includes('xbox') || t.includes('ps5') || t.includes('playstation') || t.includes('minecraft') || t.includes('fortnite')) return 'Gaming';
  if (t.includes('read') || t.includes('novel') || t.includes('book') || t.includes('library')) return 'Reading';
  if (t.includes('music') || t.includes('piano') || t.includes('guitar') || t.includes('violin') || t.includes('sing') || t.includes('dance') || t.includes('ballet')) return 'Music';
  if (t.includes('family') || t.includes('parent') || t.includes('mom') || t.includes('dad') || t.includes('sibling') || t.includes('brother') || t.includes('sister')) return 'Family Time';
  if (t.includes('eat') || t.includes('dinner') || t.includes('lunch') || t.includes('breakfast') || t.includes('meal') || t.includes('snack')) return 'Meals';
  if (t.includes('relax') || t.includes('free time') || t.includes('tv') || t.includes('netflix') || t.includes('youtube') || t.includes('chill')) return 'Relax';
  return 'Custom';
}

function checkPriority(title, prioritiesList) {
  const t = title.toLowerCase();
  for (const keyword of prioritiesList) {
    if (t.includes(keyword) || keyword.includes(t)) return 'High';
  }
  if (t.includes('important') || t.includes('urgent') || t.includes('must') || t.includes('test') || t.includes('exam')) return 'Urgent';
  return 'Medium';
}

function getCategoryColor(category) {
  const colors = {
    School: '#06b6d4',
    Homework: '#a855f7',
    Tuition: '#6366f1',
    Projects: '#ec4899',
    Sports: '#f59e0b',
    Exercise: '#10b981',
    Reading: '#14b8a6',
    Coding: '#3b82f6',
    Music: '#f43f5e',
    Dance: '#ec4899',
    'Family Time': '#84cc16',
    Meals: '#fb923c',
    Relax: '#6b7280',
    Gaming: '#f472b6',
    Break: '#fcd34d',
    Custom: '#8b5cf6'
  };
  return colors[category] || '#8b5cf6';
}

function capitalizeFirstLetter(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}
