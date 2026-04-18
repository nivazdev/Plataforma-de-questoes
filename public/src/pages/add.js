
import { apiFetch } from '../services/api.js';
import { $, el, showToast } from '../components/ui.js';
import { populateSelects } from './shared.js';

let switchViewRef = null;

export function initAdd(switchViewFn) {
  switchViewRef = switchViewFn;

  window.removeOption = function(index) {
    if ($('optionsEditor').querySelectorAll('.option-row').length <= 2) { showToast('Mínimo de 2 opções', 'info'); return; }
    $(`optRow${index}`)?.remove();
  };

  $('addOptionBtn').addEventListener('click', () => {
    const rows = $('optionsEditor').querySelectorAll('.option-row');
    const idx  = Date.now();
    const row  = el('div', 'option-row');
    row.id = `optRow${idx}`;
    row.innerHTML = `
      <input type="radio" name="correctOption" id="opt-radio-${idx}" value="${idx}" class="opt-radio" />
      <input type="text" id="opt-text-${idx}" class="form-input opt-text" placeholder="Opção ${rows.length + 1}" />
      <button type="button" class="opt-del-btn" onclick="removeOption(${idx})" aria-label="Remover">✕</button>`;
    $('optionsEditor').appendChild(row);
  });

  $('formCancelBtn').addEventListener('click', () => {
    if(switchViewRef) switchViewRef('questions');
  });

  $('questionForm').addEventListener('submit', async e => {
    e.preventDefault();
    $('formError').classList.add('hidden');
    const question       = $('fQuestion').value.trim();
    const comandoQuestao = $('fComandoQuestao')?.value.trim() || '';
    const category       = $('fCategory').value.trim();
    const difficulty = $('fDifficulty').value;
    const source     = $('fSource')?.value.trim() || '';
    const optRows    = $('optionsEditor').querySelectorAll('.option-row');
    const options    = [];
    optRows.forEach(row => { const txt = row.querySelector('.opt-text')?.value.trim(); if (txt) options.push(txt); });
    const selectedRadio = $('optionsEditor').querySelector('.opt-radio:checked');
    let answer = '';
    if (selectedRadio) { answer = $(`optRow${selectedRadio.value}`)?.querySelector('.opt-text')?.value.trim() || ''; }
    
    if (!question || !category || !difficulty || options.length < 2 || !answer || !comandoQuestao) {
      const errEl = $('formError');
      errEl.textContent = !answer ? 'Selecione a resposta correta clicando no botão de rádio.' : 'Preencha todos os campos obrigatórios (Texto de Apoio, Comando, Categoria, etc).';
      errEl.classList.remove('hidden'); return;
    }
    
    const payload = { question, comandoQuestao, category, difficulty, source, options, answer,
      explanation: $('fExplanation').value.trim(),
      imageUrl: $('fImageUrl')?.value.trim() || ''
    };
    
    try {
      const editId = $('editId').value;
      if (editId) { 
        await apiFetch(`/questions/${editId}`, { method: 'PUT', body: JSON.stringify(payload) }); 
        showToast('Questão atualizada ✨'); 
      } else { 
        await apiFetch('/questions', { method: 'POST', body: JSON.stringify(payload) }); 
        showToast('Questão adicionada 🎉'); 
      }
      if(switchViewRef) switchViewRef('questions');
    } catch (e) { 
      const errEl = $('formError'); errEl.textContent = e.message; errEl.classList.remove('hidden'); 
    }
  });
}

function addOptionRow(index, placeholder = '') {
  const row = el('div', 'option-row');
  row.id = `optRow${index}`;
  row.innerHTML = `
    <input type="radio" name="correctOption" id="opt-radio-${index}" value="${index}" class="opt-radio" />
    <input type="text" id="opt-text-${index}" class="form-input opt-text" placeholder="${placeholder || 'Opção ' + (index+1)}" />
    <button type="button" class="opt-del-btn" onclick="removeOption(${index})" aria-label="Remover">✕</button>`;
  $('optionsEditor').appendChild(row);
}

export function resetOptionsEditor() {
  $('optionsEditor').innerHTML = '';
  ['A','B','C','D'].forEach((l, i) => addOptionRow(i, `Opção ${l}`));
}

export function initAddForm() {
  $('editId').value = '';
  $('formTitle').textContent     = 'Adicionar Nova Questão';
  $('formSubtitle').textContent  = 'Preencha os detalhes abaixo';
  $('formSubmitBtn').textContent = '💾 Salvar Questão';
  $('questionForm').reset();
  resetOptionsEditor();
  $('formError').classList.add('hidden');
  populateSelects();
}

