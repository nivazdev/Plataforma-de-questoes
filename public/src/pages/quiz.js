
import { apiFetch } from '../services/api.js';
import { $, el, escHtml, showToast, renderMath } from '../components/ui.js';
import { populateSelects } from './shared.js';

let quizQuestions = [];
let quizIndex     = 0;
let quizCorrect   = 0;
let quizWrong     = 0;
let quizAnswered  = false;

export function initQuiz() {
  $('startQuizBtn').addEventListener('click', startQuiz);
  $('nextBtn').addEventListener('click', () => { 
    quizIndex++; 
    quizIndex >= quizQuestions.length ? showResults() : renderCurrentQuestion(); 
  });
  $('retryQuizBtn').addEventListener('click', startQuiz);
  $('newQuizBtn').addEventListener('click', showQuizSetup);
}

export function showQuizSetup() {
  $('quizSetup').classList.remove('hidden');
  $('quizActive').classList.add('hidden');
  $('quizResults').classList.add('hidden');
  populateSelects();
}

async function startQuiz() {
  const cat    = $('quizCategory').value;
  const diff   = $('quizDifficulty').value;
  const source = $('quizSource').value;
  const count  = $('quizCount').value;
  const params = new URLSearchParams({ count });
  if (cat    !== 'all') params.set('category', cat);
  if (diff   !== 'all') params.set('difficulty', diff);
  if (source !== 'all') params.set('source', source);
  try {
    const data = await apiFetch(`/quiz?${params}`);
    if (!data.questions.length) { showToast('Nenhuma questão encontrada para esses filtros', 'info'); return; }
    quizQuestions = data.questions; quizIndex = 0; quizCorrect = 0; quizWrong = 0;
    $('quizSetup').classList.add('hidden');
    $('quizActive').classList.remove('hidden');
    $('quizResults').classList.add('hidden');
    renderCurrentQuestion();
  } catch (e) { showToast(e.message, 'error'); }
}

function renderCurrentQuestion() {
  const q = quizQuestions[quizIndex];
  quizAnswered = false;
  const pct = (quizIndex / quizQuestions.length) * 100;
  $('quizProgressText').textContent = `Questão ${quizIndex + 1} de ${quizQuestions.length}`;
  $('quizProgressFill').style.width = pct + '%';
  $('liveScore').textContent = quizCorrect;
  $('qCategory').textContent    = q.category;
  $('qDifficulty').className    = `badge badge-diff ${q.difficulty}`;
  $('qDifficulty').textContent  = q.difficulty;
  $('quizQuestion').textContent = q.question;

  let imgEl = $('quizQuestionImage');
  if (!imgEl) {
    imgEl = document.createElement('img');
    imgEl.id = 'quizQuestionImage';
    imgEl.className = 'question-image';
    imgEl.alt = 'Imagem da questão';
    imgEl.onerror = () => { imgEl.style.display = 'none'; };
    $('quizQuestion').insertAdjacentElement('afterend', imgEl);
  }
  if (q.imageUrl) {
    imgEl.src = q.imageUrl;
    imgEl.style.display = 'block';
  } else {
    imgEl.style.display = 'none';
  }

  // Handle Question Command (Comando da Questão)
  let cmdEl = $('quizQuestionCommand');
  if (!cmdEl) {
    cmdEl = el('div', 'question-command', '');
    cmdEl.id = 'quizQuestionCommand';
    imgEl.insertAdjacentElement('afterend', cmdEl);
  }
  cmdEl.textContent = q.comandoQuestao || '';
  cmdEl.style.display = q.comandoQuestao ? 'block' : 'none';

  let sourceBadge = $('qSourceBadge');
  if (!sourceBadge) {
    sourceBadge = el('span', 'badge badge-source', '');
    sourceBadge.id = 'qSourceBadge';
    $('qCategory').parentElement.prepend(sourceBadge);
  }
  sourceBadge.textContent = q.source || '';
  sourceBadge.style.display = q.source ? '' : 'none';

  const letters = ['A','B','C','D','E','F'];
  const opts = $('quizOptions');
  opts.innerHTML = '';
  q.options.forEach((opt, i) => {
    const btn = el('button', 'quiz-option', `<span class="opt-letter">${letters[i]}</span> ${escHtml(opt)}`);
    btn.dataset.value = opt;
    btn.addEventListener('click', () => selectAnswer(opt, q.id));
    opts.appendChild(btn);
  });
  const fb = $('quizFeedback');
  fb.className = 'quiz-feedback hidden'; fb.textContent = '';
  $('nextBtn').style.display = 'none';
  renderMath($('quizCard'));
}

async function selectAnswer(selected, questionId) {
  if (quizAnswered) return;
  quizAnswered = true;
  const opts = document.querySelectorAll('.quiz-option');
  opts.forEach(o => o.setAttribute('disabled', ''));
  try {
    const result = await apiFetch('/quiz/check', { method: 'POST', body: JSON.stringify({ id: questionId, selectedAnswer: selected }) });
    opts.forEach(o => {
      if (o.dataset.value === selected) o.classList.add(result.correct ? 'correct' : 'wrong');
      if (!result.correct && o.dataset.value === result.correctAnswer) o.classList.add('correct');
    });
    const fb = $('quizFeedback');
    fb.classList.remove('hidden');
    if (result.correct) {
      quizCorrect++; $('liveScore').textContent = quizCorrect;
      fb.className = 'quiz-feedback correct';
      fb.innerHTML = `✅ <strong>Correto!</strong>${result.explanation ? ' ' + escHtml(result.explanation) : ''}`;
    } else {
      quizWrong++;
      fb.className = 'quiz-feedback wrong';
      fb.innerHTML = `❌ <strong>Incorreto.</strong> Resposta correta: <em>${escHtml(result.correctAnswer)}</em>${result.explanation ? '<br>' + escHtml(result.explanation) : ''}`;
    }
    
    $('nextBtn').style.display = 'inline-flex';
    $('nextBtn').textContent = (quizIndex + 1 >= quizQuestions.length) ? 'Ver Resultados 🏆' : 'Próxima Questão →';
    
    renderMath(fb);
  } catch (e) { showToast(e.message, 'error'); }
}

function showResults() {
  $('quizActive').classList.add('hidden');
  $('quizResults').classList.remove('hidden');
  const total = quizQuestions.length;
  const pct   = Math.round((quizCorrect / total) * 100);
  $('resultsScore').textContent = `${quizCorrect}/${total}`;
  $('resultsPct').textContent   = `${pct}% de acertos`;
  $('resultsEmoji').textContent = pct === 100 ? '🏆' : pct >= 80 ? '🎉' : pct >= 60 ? '👍' : pct >= 40 ? '📚' : '💪';
  const titleMap = [[100,'Pontuação Perfeita! Incrível! 🌟'],[80,'Ótimo trabalho!'],[60,'Bom esforço! Continue praticando.'],[40,'Continue aprendendo!'],[0,'Não desista! Revise e tente novamente!']];
  $('resultsTitle').textContent = titleMap.find(([t]) => pct >= t)?.[1] || 'Continue tentando!';
  $('resultsBreakdown').innerHTML = `<span class="rb-correct">✅ ${quizCorrect} corretas</span><span class="rb-wrong">❌ ${quizWrong} erradas</span>`;
  $('resultsBarFill').style.width = '0%';
  setTimeout(() => { $('resultsBarFill').style.width = pct + '%'; }, 100);
}
