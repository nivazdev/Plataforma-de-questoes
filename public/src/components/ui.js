
export const $ = id => document.getElementById(id);

export const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
};

export function showToast(msg, type = 'success') {
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const t = el('div', `toast ${type}`, `${icons[type] || ''} ${msg}`);
  $('toastContainer').appendChild(t);
  setTimeout(() => { t.style.animation = 'slideOut .3s ease forwards'; setTimeout(() => t.remove(), 320); }, 3000);
}

export function escHtml(str = '') {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function debounce(fn, ms) { 
  let t; 
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); }; 
}

export function renderMath(el) {
  if (window.renderMathInElement) {
    window.renderMathInElement(el || document.body, {
      delimiters: [
        {left: '$$', right: '$$', display: true},
        {left: '$', right: '$', display: false}
      ]
    });
  }
}
