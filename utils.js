const fs = require('fs');


function getPdfFilenames(pdfPath) {

    return fs
        .readdirSync(pdfPath, { withFileTypes: true })
        .filter(dirent => dirent.isFile() && dirent.name.toLowerCase().endsWith('.pdf'))
        .map(dirent => dirent.name);

}


module.exports = {
    getPdfFilenames
};
