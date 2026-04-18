const fs = require('fs');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

const loadingTask = pdfjsLib.getDocument('2022_PV_impresso_D1_CD1.pdf');
loadingTask.promise.then(function (doc) {
  const numPages = doc.numPages;
  let lastPromise = Promise.resolve('');

  const loadPage = function (pageNum) {
    return doc.getPage(pageNum).then(function (page) {
      return page.getTextContent().then(function (content) {
        let strings = content.items.map(function (item) { return item.str; });
        return strings.join(' ') + '\n';
      });
    });
  };

  for (let i = 1; i <= Math.min(numPages, 45); i++) {
    lastPromise = lastPromise.then(function (prevText) {
      return loadPage(i).then(function (text) {
        return prevText + text;
      });
    });
  }

  return lastPromise.then(function (text) {
    fs.writeFileSync('2022_extracted.txt', text, 'utf-8');
    console.log('SUCCESS');
  });
}).catch(function (err) {
  console.error('Error: ' + err);
});
