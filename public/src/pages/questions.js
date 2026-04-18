
import { apiFetch, deleteQuestion } from '../services/api.js';
import { $, el, escHtml, showToast, debounce, renderMath } from '../components/ui.js';
import { populateSelects } from './shared.js';

export let deleteTargetId = null;
let switchViewRef = null;

export function initQuestions(switchViewFn) {
  switchViewRef = switchViewFn;
  
  $('confirmDeleteBtn').addEventListener('click', async () => {
    if (!deleteTargetId) return;
    await deleteQuestion(deleteTargetId);
    deleteTargetId = null;
    $('confirmModal').classList.add('hidden');
    loadQuestions();
  });
  
  $('cancelDeleteBtn').addEventListener('click', () => {
    deleteTargetId = null;
    $('confirmModal').classList.add('hidden');
  });

  $('filterCategory').addEventListener('change', loadQuestions);
  $('filterDifficulty').addEventListener('change', loadQuestions);
  $('filterSource').addEventListener('change', loadQuestions);
  $('globalSearch').addEventListener('input', debounce(loadQuestions, 350));
  
  $('questionsList').addEventListener('click', e => {
    const editBtn = e.target.closest('[data-edit]');
    const delBtn  = e.target.closest('[data-del]');
    if (editBtn) openEditForm(editBtn.dataset.edit);
    if (delBtn)  askConfirmDelete(delBtn.dataset.del);
  });
}

function askConfirmDelete(id) { 
  deleteTargetId = id; 
  $('confirmModal').classList.remove('hidden'); 
}

export async function openEditForm(id) {
  if(switchViewRef) switchViewRef('add');
  $('formTitle').textContent     = 'Editar Questão';
  $('formSubtitle').textContent  = 'Atualize os detalhes abaixo';
  $('formSubmitBtn').textContent = '💾 Atualizar Questão';
  $('editId').value = id;
  try {
    const q = await apiFetch(`/questions/${id}`);
    $('fQuestion').value    = q.question;
    if ($('fComandoQuestao')) $('fComandoQuestao').value = q.comandoQuestao || '';
    $('fCategory').value    = q.category;
    $('fDifficulty').value  = q.difficulty;
    $('fExplanation').value = q.explanation || '';
    if ($('fSource'))    $('fSource').value    = q.source    || '';
    if ($('fImageUrl'))  $('fImageUrl').value  = q.imageUrl  || '';
    const editor = $('optionsEditor');
    editor.innerHTML = '';
    q.options.forEach((opt, i) => {
      const row = el('div', 'option-row');
      row.id = `optRow${i}`;
      row.innerHTML = `
        <input type="radio" name="correctOption" id="opt-radio-${i}" value="${i}" class="opt-radio" ${opt === q.answer ? 'checked' : ''} />
        <input type="text" id="opt-text-${i}" class="form-input opt-text" value="${escHtml(opt)}" />
        <button type="button" class="opt-del-btn" onclick="removeOption(${i})" aria-label="Remover">✕</button>`;
      editor.appendChild(row);
    });
  } catch (e) { showToast('Não foi possível carregar a questão', 'error'); }
}

export async function loadQuestions() {
  const cat    = $('filterCategory').value  || 'all';
  const diff   = $('filterDifficulty').value || 'all';
  const source = $('filterSource').value     || 'all';
  const search = $('globalSearch').value     || '';
  const params = new URLSearchParams();
  if (cat !== 'all')    params.set('category', cat);
  if (diff !== 'all')   params.set('difficulty', diff);
  if (source !== 'all') params.set('source', source);
  if (search)           params.set('search', search);
  $('questionsList').innerHTML = '<div class="loader">Carregando…</div>';
  try {
    const data = await apiFetch(`/questions?${params}`);
    $('resultCount').textContent = `${data.total} questão${data.total !== 1 ? 'ões' : ''}`;
    renderQuestions(data.questions);
    await populateSelects();
  } catch (e) { showToast('Não foi possível carregar as questões', 'error'); }
}

function renderQuestions(qs) {
  const list = $('questionsList');
  list.innerHTML = '';
  if (!qs.length) {
    list.innerHTML = '<div class="empty-state"><div class="empty-icon">🔍</div><p>Nenhuma questão encontrada.</p></div>';
    return;
  }
  qs.forEach(q => {
    const item = el('div', 'q-item');
    item.innerHTML = `
      ${q.imageUrl ? `<img class="q-item-thumb" src="${escHtml(q.imageUrl)}" alt="imagem" onerror="this.style.display='none'" />` : ''}
      <div class="q-item-body">
        <div class="q-item-question">${escHtml(q.question)}</div>
        ${q.comandoQuestao ? `<div class="q-item-command">${escHtml(q.comandoQuestao)}</div>` : ''}
        <div class="q-item-meta">
          ${q.source ? `<span class="badge badge-source">${escHtml(q.source)}</span>` : ''}
          <span class="badge">${escHtml(q.category)}</span>
          <span class="badge badge-diff ${q.difficulty}">${q.difficulty}</span>
        </div>
      </div>
      <div class="q-item-actions">
        <button class="btn btn-icon" title="Editar" data-edit="${q.id}">✏️</button>
        <button class="btn btn-icon" title="Excluir" data-del="${q.id}">🗑️</button>
      </div>`;
    list.appendChild(item);
  });
  renderMath(list);
}
