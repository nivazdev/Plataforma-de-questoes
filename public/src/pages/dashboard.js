
import { apiFetch } from '../services/api.js';
import { $, el, showToast } from '../components/ui.js';

export async function loadDashboard() {
  try {
    const stats = await apiFetch('/stats');
    $('statTotalNum').textContent = stats.total;
    $('statEasy').textContent    = stats.byDifficulty['Fácil']   || 0;
    $('statMedium').textContent  = stats.byDifficulty['Médio']   || 0;
    $('statHard').textContent    = stats.byDifficulty['Difícil'] || 0;

    const bars = $('categoryBars');
    bars.innerHTML = '';
    const entries = Object.entries(stats.byCategory).sort((a, b) => b[1] - a[1]);
    const max = entries[0]?.[1] || 1;
    entries.forEach(([cat, count]) => {
      const pct = Math.round((count / max) * 100);
      const row = el('div', 'cat-bar-row', `
        <div class="cat-bar-label"><span>${cat}</span><strong>${count}</strong></div>
        <div class="cat-bar-track"><div class="cat-bar-fill" style="width:0%" data-pct="${pct}%"></div></div>`);
      bars.appendChild(row);
    });
    requestAnimationFrame(() => document.querySelectorAll('.cat-bar-fill').forEach(b => { b.style.width = b.dataset.pct; }));
  } catch (e) { showToast('Não foi possível carregar as estatísticas', 'error'); }
}
