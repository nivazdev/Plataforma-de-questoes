const fs = require('fs');
const pdf = require('pdf-parse');

let dataBuffer = fs.readFileSync('2022_PV_impresso_D1_CD1.pdf');

pdf(dataBuffer).then(function (data) {
    fs.writeFileSync('2022_extracted.txt', data.text, 'utf-8');
    console.log("Extraction complete!");
}).catch(err => {
    console.error("Error reading PDF: ", err);
});
