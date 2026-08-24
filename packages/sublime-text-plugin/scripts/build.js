import AdmZip from 'adm-zip';

const zip = new AdmZip();

zip.addLocalFolder('src');
zip.addLocalFile('../../assets/TSRX.tmbundle/Syntaxes/tsrx.tmLanguage', 'TSRX.tmLanguage');

zip.writeZip('TSRX.sublime-package');

console.log('Built TSRX.sublime-package');
