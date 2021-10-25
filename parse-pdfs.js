const fs = require('fs');
const path = require('path');
const csv = require('csv');
const PdfReader = require('pdfreader').PdfReader;
const progress = require('cli-progress');
const { getPdfFilenames } = require('./utils');


const pdfReader = new PdfReader();


function findTreeIdsInString(s) {
    const regExp = /\W+|_/;
    const words = s.split(regExp);
    return words.filter(word => word.match('^[GSLKFAs][0-9]+$'));
}


function getTextFromPdf(filePath) {

    return new Promise((resolve, reject) => {

        const lines = [];

        pdfReader.parseFileItems(filePath, (err, item) => {

            if (err) {
                return reject(err);
            }

            if (!item) {
                return resolve(lines);
            }

            if (item.text) {
                lines.push(item.text);
            }

        });

    });

}


async function getFixedTrees(fixedTreesFilePath) {

    return new Promise((resolve, reject) => {

        const fixedTrees = [];
        fs
            .createReadStream(fixedTreesFilePath)
            .pipe(csv.parse({ fromLine: 2 }))
            .on('data', row => fixedTrees.push(row))
            .on('end', () => resolve(fixedTrees))
            .on('error', reject);

    });

}


async function analyzePdf(pdfFile, fixedTrees, pdfPath) {

    return new Promise(async (resolve, reject) => {

        let treeIds = [];

        // Use fixed entry if there is a match
        const fixedTree = fixedTrees.find(f => f[0] === pdfFile)
        if (fixedTree) {
            treeIds.push(...fixedTree[1].split(';'));
        } else {
            // Examine filename to find tree ids
            treeIds.push(...findTreeIdsInString(pdfFile));

            // Parse document content for tree ids
            const filePath = path.join(pdfPath, pdfFile);
            const text = await getTextFromPdf(filePath)
            treeIds.push(...findTreeIdsInString(text.join(' ')));
            treeIds = [...new Set(treeIds)]; // Removing duplicates
        }

        const reportedDate = pdfFile.slice(0, 10);
        const filesize = fs.statSync(path.join(pdfPath, pdfFile)).size;

        resolve({ treeIds, reportedDate, filesize })

    });

}


async function analyzePdfs(pdfPath, pdfFiles, fixedTrees) {

    console.log(`Scanning ${pdfFiles.length} PDF documents`);

    const result = [];

    const progressBar = new progress.SingleBar({}, progress.Presets.shades_classic);
    progressBar.start(pdfFiles.length, 0);

    // Parse pdf files for tree ids
    for (const pdfFile of pdfFiles) {

        progressBar.increment();

        const pdfInfo = await analyzePdf(pdfFile, fixedTrees, pdfPath);
        result.push({ pdfFile, ...pdfInfo });

    }

    progressBar.stop();

    return result;

}


function saveToFile(treeIds, outputFilepath) {

    const ext = path.extname(outputFilepath).toLowerCase();
    if (ext === '.json') {
        saveToJsonFile(treeIds, outputFilepath);
    } else {
        saveToCsvFile(treeIds, outputFilepath);
    }

}


function saveToJsonFile(treeIds, outputFilepath) {
    fs.writeFileSync(outputFilepath, JSON.stringify(treeIds, null, 2));
    console.log(`Results saved to ${outputFilepath}`);
}


function saveToCsvFile(treeIds, outputFilepath) {
    const entries = treeIds.map(entry => ({
        filename: entry.pdfFile,
        tree_ids: entry.treeIds.join('|'),
        reported_date: entry.reportedDate,
        filesize: entry.filesize
    }));
    csv.stringify(entries, { header: true }, (err, output) => {
        fs.writeFileSync(outputFilepath, output);
        console.log(`Results saved to ${outputFilepath}`);
    });
}


function outputFiletypeIsSupported(outputFilepath) {
    const ext = path.extname(outputFilepath).toLowerCase();
    return ext === '.json' || ext === '.csv';
}


async function parsePdfFiles(args) {

    const { pdfPath, fixedTreesFilepath, outputFilepath } = args;

    if (!outputFiletypeIsSupported(outputFilepath)) {
        console.log('Output file type is not supported.');
        return;
    }

    const pdfFiles = getPdfFilenames(pdfPath);
    const fixedTrees = fixedTreesFilepath ? await getFixedTrees(fixedTreesFilepath) : [];
    const trees = await analyzePdfs(pdfPath, pdfFiles, fixedTrees);
    saveToFile(trees, outputFilepath);

}


module.exports = parsePdfFiles;
