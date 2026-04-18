
import { $, el } from './components/ui.js';
import { switchView } from './router.js';
import { initQuestions } from './pages/questions.js';
import { initQuiz } from './pages/quiz.js';
import { initAdd } from './pages/add.js';
import { initImport } from './pages/import.js';

document.addEventListener('DOMContentLoaded', () => {
  // Navigation Init
  document.querySelectorAll('.nav-btn').forEach(b => b.addEventListener('click', () => switchView(b.dataset.view)));
  $('menuToggle').addEventListener('click', () => $('sidebar').classList.toggle('open'));

  $('quickQuiz').addEventListener('click',   () => switchView('quiz'));
  $('quickAdd').addEventListener('click',    () => switchView('add'));
  $('quickBrowse').addEventListener('click', () => switchView('questions'));

  // Init Modules
  initQuestions(switchView);
  initQuiz();
  initAdd(switchView);
  initImport(switchView);

  switchView('dashboard');
});
