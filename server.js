require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = 3000;

// ─── Multer (upload em memória) ───────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Apenas arquivos PDF são aceitos'));
    }
    cb(null, true);
  },
});

// ─── Supabase client (lazy — só inicializa quando necessário) ─────────────────
let _supabase = null;
function getSupabase() {
  if (!_supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_KEY;
    if (!url || !key) throw new Error('SUPABASE_URL e SUPABASE_KEY devem estar definidos no .env');
    _supabase = createClient(url, key);
  }
  return _supabase;
}

/**
 * Limpa o JSON removendo blocos markdown e textos extras.
 */
function cleanJSON(str) {
  str = str.replace(/```json\n?/g, '').replace(/```\n?/g, '');
  const start = str.indexOf('{');
  const end = str.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('JSON não encontrado na resposta');
  return str.slice(start, end + 1);
}

// ─── OpenRouter helper com retry automático ───────────────────────────────────
async function callAnthropic(prompt, systemPrompt = '', maxTokens = 4000) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY não configurada no .env');

  const MAX_RETRIES = 5;
  const BASE_DELAY = 30000; // 30 segundos

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    console.log(`  🌐 Chamada à API OpenRouter (llama-3.3-70b) — tentativa ${attempt}/${MAX_RETRIES}...`);

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.3-70b-instruct:free',
        max_tokens: maxTokens,
        messages: [
          ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
          { role: 'user', content: prompt }
        ]
      })
    });

    if (response.ok) {
      const data = await response.json();
      return data.choices[0].message.content;
    }

    const errText = await response.text();

    // Se for rate limit (429), espera e tenta de novo
    if (response.status === 429 && attempt < MAX_RETRIES) {
      const waitTime = BASE_DELAY * attempt; // 30s, 60s, 90s, 120s
      console.log(`  ⏳ Rate limit atingido. Aguardando ${waitTime / 1000}s antes de tentar novamente...`);
      await new Promise(r => setTimeout(r, waitTime));
      continue;
    }

    // Qualquer outro erro, lança imediatamente
    throw new Error(`Erro na API OpenRouter: ${response.status} - ${errText}`);
  }

  throw new Error('Número máximo de tentativas atingido. Tente novamente mais tarde.');
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Banco de Questões ENEM / Vestibulares ────────────────────────────────────
let questions = [];

// ─── Store de tarefas de importação (em memória) ──────────────────────────────
const importJobs = {};

// ─── Auxiliares ───────────────────────────────────────────────────────────────
const getCategories = () => [...new Set(questions.map(q => q.category))].sort();
const getSources = () => [...new Set(questions.map(q => q.source))].sort((a, b) => {
  const ya = parseInt(a.match(/\d{4}/)?.[0] || '0');
  const yb = parseInt(b.match(/\d{4}/)?.[0] || '0');
  return yb - ya;
});

// ─── Rotas ────────────────────────────────────────────────────────────────────

app.get('/api/questions', (req, res) => {
  const { category, difficulty, source, search } = req.query;
  let result = [...questions];
  if (category && category !== 'all') result = result.filter(q => q.category === category);
  if (difficulty && difficulty !== 'all') result = result.filter(q => q.difficulty === difficulty);
  if (source && source !== 'all') result = result.filter(q => q.source === source);
  if (search) {
    const s = search.toLowerCase();
    result = result.filter(q =>
      q.question.toLowerCase().includes(s) ||
      q.category.toLowerCase().includes(s) ||
      (q.source || '').toLowerCase().includes(s)
    );
  }
  res.json({ total: result.length, questions: result });
});

app.get('/api/questions/:id', (req, res) => {
  const q = questions.find(q => q.id === req.params.id);
  if (!q) return res.status(404).json({ error: 'Questão não encontrada' });
  res.json(q);
});

app.post('/api/questions', (req, res) => {
  const { question, options, answer, category, difficulty, explanation, source, imageUrl } = req.body;
  if (!question || !options || !answer || !category || !difficulty) {
    return res.status(400).json({ error: 'Campos obrigatórios faltando' });
  }
  if (!Array.isArray(options) || options.length < 2) {
    return res.status(400).json({ error: 'São necessárias pelo menos 2 opções' });
  }
  if (!options.includes(answer)) {
    return res.status(400).json({ error: 'A resposta deve ser uma das opções' });
  }
  const newQ = { id: uuidv4(), source: source || '', question, options, answer, category, difficulty, explanation: explanation || '', imageUrl: imageUrl || '' };
  questions.push(newQ);
  res.status(201).json(newQ);
});

app.put('/api/questions/:id', (req, res) => {
  const idx = questions.findIndex(q => q.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Questão não encontrada' });
  const { question, options, answer, category, difficulty, explanation, source, imageUrl } = req.body;
  if (options && !options.includes(answer)) {
    return res.status(400).json({ error: 'A resposta deve ser uma das opções' });
  }
  questions[idx] = { ...questions[idx], question, options, answer, category, difficulty, explanation, source, imageUrl: imageUrl || '' };
  res.json(questions[idx]);
});

app.delete('/api/questions/:id', (req, res) => {
  const idx = questions.findIndex(q => q.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Questão não encontrada' });
  questions.splice(idx, 1);
  res.json({ message: 'Questão excluída' });
});

app.get('/api/categories', (req, res) => res.json(getCategories()));
app.get('/api/sources', (req, res) => res.json(getSources()));

app.get('/api/import-status/:id', (req, res) => {
  const job = importJobs[req.params.id];
  if (!job) return res.status(404).json({ error: 'Tarefa não encontrada' });
  res.json(job);
});

app.get('/api/quiz', (req, res) => {
  const { category, difficulty, source, count = 10 } = req.query;
  let pool = [...questions];
  if (category && category !== 'all') pool = pool.filter(q => q.category === category);
  if (difficulty && difficulty !== 'all') pool = pool.filter(q => q.difficulty === difficulty);
  if (source && source !== 'all') pool = pool.filter(q => q.source === source);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const selected = pool.slice(0, Math.min(Number(count), pool.length));
  const quizQs = selected.map(({ id, question, options, category, difficulty, source, imageUrl }) => ({
    id, question, options, category, difficulty, source, imageUrl
  }));
  res.json({ total: quizQs.length, questions: quizQs });
});

app.post('/api/quiz/check', (req, res) => {
  const { id, selectedAnswer } = req.body;
  const q = questions.find(q => q.id === id);
  if (!q) return res.status(404).json({ error: 'Questão não encontrada' });
  res.json({ correct: q.answer === selectedAnswer, correctAnswer: q.answer, explanation: q.explanation });
});

app.get('/api/stats', (req, res) => {
  const byCategory = {};
  const byDifficulty = { 'Fácil': 0, 'Médio': 0, 'Difícil': 0 };
  const bySource = {};
  questions.forEach(q => {
    byCategory[q.category] = (byCategory[q.category] || 0) + 1;
    if (byDifficulty[q.difficulty] !== undefined) byDifficulty[q.difficulty]++;
    const exam = (q.source || '').split(' ')[0];
    bySource[exam] = (bySource[exam] || 0) + 1;
  });
  res.json({ total: questions.length, byCategory, byDifficulty, bySource });
});

// ─── Importação de PDF ────────────────────────────────────────────────────────

const ENEM_EXTRACTION_SYSTEM_PROMPT = `Você é um especialista em extração de questões do ENEM.

Receberá o texto bruto de uma prova do ENEM. Extraia TODAS as questões e retorne APENAS um JSON válido, sem markdown, sem explicações, sem blocos de código.

IDENTIFICAÇÃO DA PROVA:
- Identifique o ano da prova no texto (ex: "ENEM 2022") e aplique a todas as questões no campo "source" como "ENEM 2022"
- Identifique o caderno (Dia 1 = Linguagens + Humanas, Dia 2 = Matemática + Natureza) e use isso para auxiliar na classificação de subject

ESTRUTURA DE CADA QUESTÃO NO ENEM:
Cada questão do ENEM segue esta ordem:
1. Texto de apoio (excerto, poema, tabela, notícia, dados — pode não existir)
2. Imagem ou gráfico (pode não existir)
3. Comando da questão (a pergunta em si)
4. Alternativas A, B, C, D, E

REGRAS DE EXTRAÇÃO:

statement: Monte o campo seguindo EXATAMENTE esta ordem:
  - Se houver texto de apoio: inclua-o primeiro
  - Se houver imagem/gráfico referenciado no texto: inclua [IMAGEM: descrição do que representa] logo após o texto de apoio e ANTES do comando
  - Por último, inclua o comando da questão
  - Exemplo com imagem: "Em 1930, o Brasil passou por...\\n\\n[IMAGEM: Gráfico mostrando a queda do PIB entre 1929-1932]\\n\\nCom base no texto e no gráfico, assinale..."
  - Exemplo sem imagem: "Leia o trecho a seguir...\\n\\nCom base no texto, assinale..."
  - Exemplo sem apoio: "Assinale a alternativa que apresenta..."

comandoQuestao: APENAS o comando/pergunta final, sem texto de apoio e sem alternativas.

options: Array com o texto completo de cada alternativa, SEM a letra e SEM parênteses.
  - CORRETO: ["A economia cresceu", "O PIB diminuiu", ...]
  - ERRADO: ["A) A economia cresceu", "(A) A economia cresceu", ...]

subject: Classifique como uma de:
  Matemática, Português, Inglês, Espanhol, História, Geografia, Filosofia, Sociologia, Biologia, Química, Física, Interdisciplinar

topic: Tópico específico dentro da matéria (ex: "Funções do 2º grau", "Romantismo", "Guerra Fria")

difficulty: Estime como "Fácil", "Médio" ou "Difícil" com base na complexidade do enunciado e das alternativas

source: "ENEM {ANO}" (ex: "ENEM 2022")

REGRAS GERAIS:
- Mantenha a ordem original das questões
- Não invente conteúdo que não está no texto
- Se o texto de uma questão estiver cortado ou ilegível, inclua o que for possível e adicione "truncated": true
- Nunca misture conteúdo de questões diferentes

Formato de saída:
{
  "year": 2022,
  "caderno": "Dia 1",
  "questions": [
    {
      "number": 1,
      "subject": "História",
      "topic": "República Velha",
      "difficulty": "Médio",
      "source": "ENEM 2022",
      "statement": "Texto de apoio.\\n\\n[IMAGEM: descrição se houver]\\n\\nComando da questão.",
      "comandoQuestao": "Apenas o comando/pergunta final.",
      "options": ["texto A", "texto B", "texto C", "texto D", "texto E"],
      "answer": null,
      "explanation": ""
    }
  ]
}`;

const LETTER_TO_INDEX = { A: 0, B: 1, C: 2, D: 3, E: 4 };

async function batchInsertQuestions(supabase, rows, batchSize = 10) {
  let imported = 0;
  const errors = [];

  const meta = rows.map(({ _originalNumber, ...rest }) => ({ _originalNumber, clean: rest }));

  for (let i = 0; i < meta.length; i += batchSize) {
    const batchMeta = meta.slice(i, i + batchSize);
    const batchClean = batchMeta.map(m => m.clean);
    const batchStart = i + 1;
    const batchEnd = Math.min(i + batchSize, meta.length);
    console.log(`  📦 Inserindo lote ${batchStart}–${batchEnd} de ${meta.length}...`);

    const { data, error } = await supabase.from('questions').insert(batchClean).select();

    if (error) {
      for (let j = 0; j < batchMeta.length; j++) {
        const { _originalNumber, clean } = batchMeta[j];
        const { error: singleErr } = await supabase.from('questions').insert(clean);
        if (singleErr) {
          const qNum = _originalNumber || (i + j + 1);
          console.error(`  ❌ Erro na questão ${qNum}: ${singleErr.message}`);
          errors.push({ question: qNum, error: singleErr.message });
        } else {
          imported++;
        }
      }
    } else {
      imported += batchClean.length;
    }
  }

  return { imported, errors };
}

app.post('/api/import-pdf', upload.fields([
  { name: 'pdf', maxCount: 1 },
  { name: 'gabarito', maxCount: 1 },
]), async (req, res) => {
  req.setTimeout(600000); // 10 minutos (retry pode demorar)
  res.setTimeout(600000);

  const jobId = uuidv4();
  const pdfFile = req.files?.pdf?.[0];
  const gabaritoFile = req.files?.gabarito?.[0];

  if (!pdfFile || !gabaritoFile) {
    return res.status(400).json({ success: false, error: 'Arquivos PDF e Gabarito são obrigatórios' });
  }

  importJobs[jobId] = {
    id: jobId,
    status: 'processing',
    progress: 0,
    startTime: Date.now(),
    success: false
  };

  res.status(202).json({ success: true, jobId, message: 'Processamento iniciado em segundo plano' });

  (async () => {
    const startTime = Date.now();
    try {
      console.log(`\n🚀 [Job ${jobId}] Iniciando processamento background...`);
      console.log('\n📄 ═══════════════════════════════════════════════════════');
      console.log('   IMPORTAÇÃO DE PDF INICIADA');
      console.log('═══════════════════════════════════════════════════════\n');
      console.log(`  📁 Prova:     ${pdfFile.originalname} (${(pdfFile.size / 1024 / 1024).toFixed(2)} MB)`);
      console.log(`  📁 Gabarito:  ${gabaritoFile.originalname} (${(gabaritoFile.size / 1024 / 1024).toFixed(2)} MB)\n`);

      // ── 1. Extrair gabarito ────────────────────────────────────────────────────
      console.log('  📖 Extraindo texto do PDF do gabarito...');
      const gabaritoData = await pdfParse(gabaritoFile.buffer);
      const gabaritoText = gabaritoData.text;

      if (!gabaritoText || gabaritoText.trim().length < 10) {
        throw new Error('PDF do gabarito parece estar vazio ou conter muito pouco texto.');
      }
      console.log(`  ✅ Texto do gabarito extraído: ${gabaritoText.length} caracteres\n`);

      console.log('  🤖 Enviando gabarito para extração...');
      const gabaritoRaw = await callAnthropic(
        `Extraia o gabarito deste PDF e retorne APENAS um JSON no formato:\n{"1":"C","2":"A","3":"B",...}\nonde a chave é o número da questão e o valor é a letra da resposta correta.\nSem markdown, sem explicações, só o JSON.\n\nTexto do gabarito:\n\n${gabaritoText}`,
        '',
        500
      );

      let gabarito;
      try {
        gabarito = JSON.parse(cleanJSON(gabaritoRaw));
      } catch {
        console.error('  ❌ Erro ao parsear gabarito:', gabaritoRaw.substring(0, 300));
        throw new Error('Falha ao extrair gabarito do PDF. O modelo não retornou um JSON válido.');
      }

      if (typeof gabarito !== 'object' || Array.isArray(gabarito) || Object.keys(gabarito).length === 0) {
        throw new Error('Gabarito extraído está vazio ou em formato inválido.');
      }

      console.log(`  ✅ Gabarito extraído: ${Object.keys(gabarito).length} respostas\n`);

      // ── 2. Extrair texto da prova ──────────────────────────────────────────────
      console.log('  📖 Extraindo texto do PDF da prova...');
      const pdfData = await pdfParse(pdfFile.buffer);
      const pdfText = pdfData.text;

      if (!pdfText || pdfText.trim().length < 100) {
        throw new Error('PDF parece estar vazio ou conter muito pouco texto.');
      }

      console.log(`  ✅ Texto extraído: ${pdfText.length} caracteres, ${pdfData.numpages} páginas\n`);

      // ── 3. Dividir em 10 blocos e processar ───────────────────────────────────
      const totalLen = pdfText.length;
      const NUM_CHUNKS = 10;
      const partSize = Math.ceil(totalLen / NUM_CHUNKS);
      const chunks = [];
      for (let i = 0; i < NUM_CHUNKS; i++) {
        chunks.push(pdfText.slice(partSize * i, partSize * (i + 1)));
      }

      console.log(`  📦 Texto dividido em ${chunks.length} blocos de ~${partSize} chars.\n`);

      let allExtractedQuestions = [];
      let year = null;
      let caderno = null;

      for (let i = 0; i < chunks.length; i++) {
        console.log(`  🤖 Processando bloco ${i + 1}/${chunks.length}...`);

        const rawResponse = await callAnthropic(
          `Extraia as questões do seguinte bloco de texto bruto de prova do ENEM (Parte ${i + 1}/${chunks.length}):\n\n${chunks[i]}`,
          ENEM_EXTRACTION_SYSTEM_PROMPT,
          4000
        );

        try {
          const parsedData = JSON.parse(cleanJSON(rawResponse));
          if (parsedData.questions && Array.isArray(parsedData.questions)) {
            allExtractedQuestions = allExtractedQuestions.concat(parsedData.questions);
            if (!year) year = parsedData.year;
            if (!caderno) caderno = parsedData.caderno;
            console.log(`     ✅ Bloco ${i + 1}: ${parsedData.questions.length} questões extraídas.`);
          }
        } catch (parseErr) {
          console.error(`  ❌ Erro ao parsear bloco ${i + 1}:`, parseErr.message);
        }
      }

      if (allExtractedQuestions.length === 0) {
        throw new Error('Não foi possível extrair nenhuma questão da prova.');
      }

      console.log(`\n  📋 Total de questões extraídas: ${allExtractedQuestions.length}`);
      console.log(`  📅 Ano: ${year} | Caderno: ${caderno}\n`);

      // ── 4. Aplicar gabarito ────────────────────────────────────────────────────
      console.log('  🔑 Aplicando gabarito às questões...\n');
      const supabaseRows = [];
      let skipped = 0;

      for (const q of allExtractedQuestions) {
        const num = String(q.number);
        const gabaritoLetter = gabarito[num]?.toUpperCase();
        const idx = LETTER_TO_INDEX[gabaritoLetter];

        let correctAnswer = '';
        if (idx !== undefined && q.options && q.options[idx]) {
          correctAnswer = q.options[idx];
        } else if (gabaritoLetter) {
          console.warn(`  ⚠️  Questão ${num}: letra "${gabaritoLetter}" sem correspondência nas opções`);
        }

        supabaseRows.push({
          statement: q.statement || '',
          comando_questao: q.comandoQuestao || '',
          options: q.options || [],
          correct_answer: correctAnswer,
          explanation: q.explanation || '',
          subject: q.subject || 'Interdisciplinar',
          sub_area: q.source || (year ? `ENEM ${year}` : ''),
          difficulty: q.difficulty || 'Médio',
          image_url: '',
          _originalNumber: Number(num),
        });
      }

      // ── 5. Inserir no Supabase ─────────────────────────────────────────────────
      console.log(`\n  💾 Inserindo ${supabaseRows.length} questões no Supabase...\n`);
      const supabase = getSupabase();
      const { imported, errors } = await batchInsertQuestions(supabase, supabaseRows, 10);

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log('\n═══════════════════════════════════════════════════════');
      console.log(`  ✅ IMPORTAÇÃO CONCLUÍDA em ${elapsed}s`);
      console.log(`     Importadas: ${imported} | Puladas: ${skipped} | Erros: ${errors.length}`);
      console.log('═══════════════════════════════════════════════════════\n');

      importJobs[jobId] = {
        ...importJobs[jobId],
        status: 'completed',
        success: true,
        imported,
        skipped,
        year,
        caderno,
        errors,
        elapsedTime: elapsed
      };
    } catch (err) {
      console.error(`  ❌ [Job ${jobId}] Erro fatal:`, err);
      importJobs[jobId] = {
        ...importJobs[jobId],
        status: 'failed',
        error: err.message || 'Erro interno no servidor'
      };
    }
  })();
});

// ─── Catch-all ────────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n  🎓 Banco ENEM rodando em http://localhost:${PORT}\n`);
});
