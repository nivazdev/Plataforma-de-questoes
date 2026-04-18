
import { apiFetch } from '../services/api.js';
import { $ } from '../components/ui.js';

export async function populateSelects() {
  const [cats, sources] = await Promise.all([apiFetch('/categories'), apiFetch('/sources')]);

  [$('filterCategory'), $('quizCategory')].forEach(sel => {
    if(!sel) return;
    const cur = sel.value;
    sel.innerHTML = `<option value="all">${sel.id === 'quizCategory' ? 'Todas as Disciplinas' : 'Todas as Categorias'}</option>`;
    cats.forEach(c => { const o = document.createElement('option'); o.value = c; o.textContent = c; if (c === cur) o.selected = true; sel.appendChild(o); });
  });

  [$('filterSource'), $('quizSource')].forEach(sel => {
    if(!sel) return;
    const cur = sel.value;
    sel.innerHTML = `<option value="all">Todas as Provas</option>`;
    sources.forEach(s => { const o = document.createElement('option'); o.value = s; o.textContent = s; if (s === cur) o.selected = true; sel.appendChild(o); });
  });

  const dl = $('categoryList');
  if (dl) {
    dl.innerHTML = '';
    cats.forEach(c => { const o = document.createElement('option'); o.value = c; dl.appendChild(o); });
  }
}
