import { showToast } from '../components/ui.js';
import { supabase } from './supabaseClient.js';

const API_BASE_URL = 'http://localhost:3000';

function fromDB(row) {
  return {
    id: row.id,
    question: row.statement,
    comandoQuestao: row.comando_questao || '',
    options: row.options,
    answer: row.correct_answer,
    explanation: row.explanation,
    category: row.subject,
    source: row.sub_area,
    difficulty: row.difficulty,
    imageUrl: row.image_url
  };
}

function toDB(q) {
  return {
    statement: q.question,
    comando_questao: q.comandoQuestao || '',
    options: q.options,
    correct_answer: q.answer,
    explanation: q.explanation || '',
    subject: q.category,
    sub_area: q.source || '',
    difficulty: q.difficulty,
    image_url: q.imageUrl || ''
  };
}

export async function apiFetch(path, options = {}) {
  const isQuestionsList = path.startsWith('/questions?');
  const isQuestionGet = path.match(/^\/questions\/([^?]+)$/) && options.method === undefined;
  const isCategories = path === '/categories';
  const isSources = path === '/sources';
  const isStats = path === '/stats';
  const isQuiz = path.startsWith('/quiz?');
  const isCheck = path === '/quiz/check';
  const isPost = path === '/questions' && options.method === 'POST';
  const isPut = path.match(/^\/questions\/([^?]+)$/) && options.method === 'PUT';
  const isDelete = path.match(/^\/questions\/([^?]+)$/) && options.method === 'DELETE';

  if (isQuestionsList) {
    const params = new URLSearchParams(path.split('?')[1]);
    let query = supabase.from('questions').select('*');
    if (params.get('category')) query = query.eq('subject', params.get('category'));
    if (params.get('difficulty')) query = query.eq('difficulty', params.get('difficulty'));
    if (params.get('source')) query = query.eq('sub_area', params.get('source'));
    
    if (params.get('search')) {
      query = query.or(`statement.ilike.%${params.get('search')}%,subject.ilike.%${params.get('search')}%,sub_area.ilike.%${params.get('search')}%`);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return { total: data.length, questions: data.map(fromDB) };
  }
  
  if (isQuestionGet) {
    const id = path.split('/')[2];
    const { data, error } = await supabase.from('questions').select('*').eq('id', id).single();
    if (error) throw error;
    return fromDB(data);
  }

  if (isCategories) {
    const { data } = await supabase.from('questions').select('subject');
    return [...new Set(data.map(d => d.subject))].sort();
  }

  if (isSources) {
    const { data } = await supabase.from('questions').select('sub_area');
    return [...new Set(data.map(d => d.sub_area).filter(v => v))].sort();
  }

  if (isStats) {
    const { data } = await supabase.from('questions').select('*');
    const byCategory = {};
    const byDifficulty = { 'Fácil': 0, 'Médio': 0, 'Difícil': 0 };
    data.forEach(q => {
      byCategory[q.subject] = (byCategory[q.subject] || 0) + 1;
      if (byDifficulty[q.difficulty] !== undefined) byDifficulty[q.difficulty]++;
    });
    return { total: data.length, byCategory, byDifficulty, bySource: {} };
  }

  if (isQuiz) {
    const params = new URLSearchParams(path.split('?')[1]);
    let query = supabase.from('questions').select('*');
    if (params.get('category')) query = query.eq('subject', params.get('category'));
    if (params.get('difficulty')) query = query.eq('difficulty', params.get('difficulty'));
    if (params.get('source')) query = query.eq('sub_area', params.get('source'));
    const { data } = await query;
    
    let pool = data.map(fromDB);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const count = Number(params.get('count') || 10);
    const selected = pool.slice(0, Math.min(count, pool.length));
    return { total: selected.length, questions: selected };
  }

  if (isCheck) {
    const body = JSON.parse(options.body);
    const { data } = await supabase.from('questions').select('*').eq('id', body.id).single();
    const q = fromDB(data);
    return { correct: q.answer === body.selectedAnswer, correctAnswer: q.answer, explanation: q.explanation };
  }

  if (isPost) {
    const body = JSON.parse(options.body);
    const row = toDB(body);
    const { data, error } = await supabase.from('questions').insert(row).select().single();
    if (error) throw error;
    return fromDB(data);
  }

  if (isPut) {
    const id = path.split('/')[2];
    const body = JSON.parse(options.body);
    const row = toDB(body);
    const { data, error } = await supabase.from('questions').update(row).eq('id', id).select().single();
    if (error) throw error;
    return fromDB(data);
  }

  if (isDelete) {
    const id = path.split('/')[2];
    const { error } = await supabase.from('questions').delete().eq('id', id);
    if (error) throw error;
    return { message: 'Excluído com sucesso' };
  }

  // Se não foi interceptado pelos filtros acima (simulação Supabase),
  // faz a chamada real para o backend na Render
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
  const response = await fetch(url, options);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Erro na API: ${response.status}`);
  }
  
  return response.json();
}

export async function deleteQuestion(id) {
  try { 
    await apiFetch(`/questions/${id}`, { method: 'DELETE' }); 
    showToast('Questão excluída'); 
  } catch (e) { 
    showToast(e.message, 'error'); 
    throw e;
  }
}
