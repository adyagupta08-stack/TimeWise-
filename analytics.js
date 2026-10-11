/* ==========================================================================
   TIMEWISE - ANALYTICS & SVG CHARTS RENDERER
   Focus ratio, weekly bar graphs, productivity stats visualization.
   ========================================================================== */

export class AnalyticsRenderer {
  
  /**
   * Render Focus vs Break Donut SVG Chart
   */
  static renderFocusRatioChart(containerId, focusMins, breakMins) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const total = Math.max(1, focusMins + breakMins);
    const focusPct = Math.round((focusMins / total) * 100);
    const breakPct = 100 - focusPct;

    const circumference = 2 * Math.PI * 45; // r=45 -> ~282.7
    const focusOffset = circumference * (1 - focusPct / 100);

    const svgHTML = `
      <div style="display: flex; align-items: center; justify-content: center; gap: 24px; width: 100%; height: 100%;">
        <div style="position: relative; width: 130px; height: 130px;">
          <svg width="130" height="130" viewBox="0 0 100 100" style="transform: rotate(-90deg);">
            <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(6, 182, 212, 0.3)" stroke-width="10"></circle>
            <circle cx="50" cy="50" r="45" fill="none" stroke="var(--accent-primary)" stroke-width="10"
              stroke-dasharray="${circumference}" stroke-dashoffset="${focusOffset}" stroke-linecap="round" style="transition: stroke-dashoffset 0.8s ease;"></circle>
          </svg>
          <div style="position: absolute; top:0; left:0; width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center;">
            <span style="font-weight:900; font-size:1.4rem;">${focusPct}%</span>
            <span style="font-size:0.7rem; color:var(--text-muted);">Focus</span>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 10px; font-size: 0.85rem;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="width: 12px; height: 12px; border-radius: 3px; background: var(--accent-primary);"></span>
            <span>Focus Time: <strong>${Math.round(focusMins / 60)} hrs</strong> (${focusPct}%)</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="width: 12px; height: 12px; border-radius: 3px; background: var(--accent-secondary);"></span>
            <span>Break Time: <strong>${Math.round(breakMins / 60)} hrs</strong> (${breakPct}%)</span>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = svgHTML;
  }

  /**
   * Render Weekly Productivity Bar Chart SVG
   */
  static renderWeeklyBarChart(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const days = [
      { day: 'Mon', p: 85 },
      { day: 'Tue', p: 92 },
      { day: 'Wed', p: 78 },
      { day: 'Thu', p: 95 },
      { day: 'Fri', p: 88 },
      { day: 'Sat', p: 60 },
      { day: 'Sun', p: 75 }
    ];

    const barsHTML = days.map(item => `
      <div style="display: flex; flex-direction: column; align-items: center; gap: 8px; flex: 1;">
        <span style="font-size: 0.75rem; font-weight: 700; color: var(--accent-gold);">${item.p}%</span>
        <div style="width: 24px; height: 140px; background: rgba(0, 0, 0, 0.3); border-radius: 12px; display: flex; align-items: flex-end; overflow: hidden; padding: 2px;">
          <div style="width: 100%; height: ${item.p}%; background: linear-gradient(180deg, var(--accent-secondary), var(--accent-primary)); border-radius: 10px; transition: height 0.6s ease;"></div>
        </div>
        <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600;">${item.day}</span>
      </div>
    `).join('');

    container.innerHTML = `
      <div style="display: flex; align-items: flex-end; justify-content: space-around; width: 100%; height: 100%; padding-top: 10px;">
        ${barsHTML}
      </div>
    `;
  }
}
