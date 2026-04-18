
import { $, el, showToast } from '../components/ui.js';

let switchViewRef = null;

export function initImport(switchViewFn) {
  switchViewRef = switchViewFn;

  // File input change handlers — update label text
  $('importPdfFile').addEventListener('change', (e) => {
    const name = e.target.files[0]?.name || '';
    $('importPdfLabel').textContent = name || 'Arraste ou clique para selecionar o PDF da prova';
    $('importPdfLabel').classList.toggle('has-file', !!name);
  });

  $('importGabaritoFile').addEventListener('change', (e) => {
    const name = e.target.files[0]?.name || '';
    $('importGabaritoLabel').textContent = name || 'Arraste ou clique para selecionar o PDF do gabarito';
    $('importGabaritoLabel').classList.toggle('has-file', !!name);
  });

  // Submit handler
  $('importForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const pdfFile = $('importPdfFile').files[0];
    const gabaritoFile = $('importGabaritoFile').files[0];

    if (!pdfFile) { showToast('Selecione o PDF da prova', 'error'); return; }
    if (!gabaritoFile) { showToast('Selecione o PDF do gabarito', 'error'); return; }

    // Switch to loading state
    $('importIdle').classList.add('hidden');
    $('importLoading').classList.remove('hidden');
    $('importResult').classList.add('hidden');

    try {
      const formData = new FormData();
      formData.append('pdf', pdfFile);
      formData.append('gabarito', gabaritoFile);

      const res = await fetch('/api/import-pdf', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      // Switch to result state
      $('importLoading').classList.add('hidden');
      $('importResult').classList.remove('hidden');

      if (data.success) {
        $('importResultIcon').textContent = '✅';
        $('importResultTitle').textContent = 'Importação Concluída!';
        $('importResultDetails').innerHTML = buildSuccessHTML(data);
        $('importResultCard').classList.remove('error');
        $('importResultCard').classList.add('success');
        showToast(`${data.imported} questões importadas 🎉`);
      } else {
        $('importResultIcon').textContent = '❌';
        $('importResultTitle').textContent = 'Erro na Importação';
        $('importResultDetails').innerHTML = `<p class="import-error-msg">${escHtml(data.error || 'Erro desconhecido')}</p>`;
        $('importResultCard').classList.remove('success');
        $('importResultCard').classList.add('error');
        showToast('Erro na importação', 'error');
      }
    } catch (err) {
      $('importLoading').classList.add('hidden');
      $('importResult').classList.remove('hidden');
      $('importResultIcon').textContent = '❌';
      $('importResultTitle').textContent = 'Erro de Conexão';
      $('importResultDetails').innerHTML = `<p class="import-error-msg">${escHtml(err.message)}</p>`;
      $('importResultCard').classList.remove('success');
      $('importResultCard').classList.add('error');
      showToast('Falha na conexão com o servidor', 'error');
    }
  });

  // "Import another" button
  $('importAnotherBtn').addEventListener('click', () => {
    resetImportView();
  });

  // "Go to questions" button
  $('importGoQuestionsBtn').addEventListener('click', () => {
    if (switchViewRef) switchViewRef('questions');
  });
}

export function initImportView() {
  resetImportView();
}

function resetImportView() {
  $('importForm').reset();
  $('importPdfLabel').textContent = 'Arraste ou clique para selecionar o PDF da prova';
  $('importPdfLabel').classList.remove('has-file');
  $('importGabaritoLabel').textContent = 'Arraste ou clique para selecionar o PDF do gabarito';
  $('importGabaritoLabel').classList.remove('has-file');
  $('importIdle').classList.remove('hidden');
  $('importLoading').classList.add('hidden');
  $('importResult').classList.add('hidden');
}

function escHtml(str = '') {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildSuccessHTML(data) {
  let html = '<div class="import-stats">';
  html += `<div class="import-stat"><span class="import-stat-num">${data.imported}</span><span class="import-stat-lbl">Importadas</span></div>`;
  html += `<div class="import-stat"><span class="import-stat-num">${data.skipped}</span><span class="import-stat-lbl">Puladas</span></div>`;
  html += `<div class="import-stat"><span class="import-stat-num">${data.errors?.length || 0}</span><span class="import-stat-lbl">Erros</span></div>`;
  html += '</div>';

  if (data.year || data.caderno) {
    html += `<p class="import-meta">📅 ${data.year ? `ENEM ${data.year}` : ''} ${data.caderno ? `· ${data.caderno}` : ''}</p>`;
  }

  if (data.errors && data.errors.length > 0) {
    html += '<div class="import-errors-list">';
    html += '<p class="import-errors-title">⚠️ Detalhes dos erros:</p>';
    data.errors.forEach(e => {
      html += `<p class="import-error-item">Questão ${e.question}: ${escHtml(e.error)}</p>`;
    });
    html += '</div>';
  }

  return html;
}
