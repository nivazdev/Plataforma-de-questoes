
import { $ } from './components/ui.js';
import { loadDashboard } from './pages/dashboard.js';
import { loadQuestions } from './pages/questions.js';
import { showQuizSetup } from './pages/quiz.js';
import { initAddForm } from './pages/add.js';
import { initImportView } from './pages/import.js';

export let currentView = 'dashboard';

export function switchView(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  currentView = view;
  $('view-' + view).classList.remove('hidden');
  const navBtn = $('nav-' + view);
  if(navBtn) navBtn.classList.add('active');
  const titles = { dashboard: 'Painel', questions: 'Banco de Questões', quiz: 'Fazer Quiz', add: 'Adicionar Questão', import: 'Importar PDF' };
  $('topbarTitle').textContent = titles[view] || '';
  $('searchWrap').style.display = view === 'questions' ? 'block' : 'none';
  if (view === 'dashboard') loadDashboard();
  if (view === 'questions') loadQuestions();
  if (view === 'quiz')      showQuizSetup();
  if (view === 'add')       initAddForm();
  if (view === 'import')    initImportView();
  if (window.innerWidth <= 768) $('sidebar').classList.remove('open');
}

