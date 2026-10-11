/* ==========================================================================
   TIMEWISE - MONTHLY CALENDAR ENGINE (UPGRADED)
   Monthly schedule viewer, history inspection, and day copying from localStorage.
   ========================================================================== */

export class CalendarManager {
  constructor() {
    this.currentDate = new Date(); // Dynamic today date
  }

  renderCalendar(gridId, monthTitleId) {
    const grid = document.getElementById(gridId);
    const title = document.getElementById(monthTitleId);
    if (!grid || !title) return;

    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();

    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    title.textContent = `${monthNames[month]} ${year}`;

    grid.innerHTML = '';

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const todayDate = new Date();
    const isCurrentMonth = todayDate.getFullYear() === year && todayDate.getMonth() === month;

    // Blank cells before month start
    for (let i = 0; i < firstDay; i++) {
      const emptyCell = document.createElement('div');
      emptyCell.className = 'cal-day-cell empty';
      emptyCell.style.opacity = '0.2';
      grid.appendChild(emptyCell);
    }

    // Read history from localStorage
    const history = JSON.parse(localStorage.getItem('timewise_daily_history') || '{}');

    // Month days
    for (let day = 1; day <= daysInMonth; day++) {
      const cell = document.createElement('div');
      cell.className = 'cal-day-cell';
      
      if (isCurrentMonth && day === todayDate.getDate()) {
        cell.classList.add('today');
      }

      // Format date key: YYYY-MM-DD
      const dateKey = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      const dayRecord = history[dateKey];

      if (dayRecord) {
        if (dayRecord.completed) {
          cell.classList.add('has-streak');
          cell.innerHTML = `
            <span style="font-weight: 800; font-size: 0.9rem;">${day}</span>
            <span style="font-size: 0.68rem; color: var(--accent-green); font-weight: 800;">⭐ 100%</span>
          `;
        } else {
          cell.innerHTML = `
            <span style="font-weight: 800; font-size: 0.9rem;">${day}</span>
            <span style="font-size: 0.68rem; color: var(--accent-pink); font-weight: 800;">Incomplete</span>
          `;
        }
      } else {
        cell.innerHTML = `
          <span style="font-weight: 800; font-size: 0.9rem;">${day}</span>
        `;
      }

      cell.addEventListener('click', () => {
        if (dayRecord) {
          const taskSummary = dayRecord.tasks.map(t => `${t.completed ? '✅' : '❌'} ${t.title}`).join('\n');
          alert(`📅 Day Details: ${monthNames[month]} ${day}, ${year}\nStatus: ${dayRecord.completed ? '100% Completed! 🏆' : 'Incomplete'}\n\nTasks:\n${taskSummary}`);
        } else {
          alert(`📅 Date: ${monthNames[month]} ${day}, ${year}\nNo schedule recorded for this day. Start planning today!`);
        }
      });

      grid.appendChild(cell);
    }
  }

  prevMonth(gridId, monthTitleId) {
    this.currentDate.setMonth(this.currentDate.getMonth() - 1);
    this.renderCalendar(gridId, monthTitleId);
  }

  nextMonth(gridId, monthTitleId) {
    this.currentDate.setMonth(this.currentDate.getMonth() + 1);
    this.renderCalendar(gridId, monthTitleId);
  }
}
