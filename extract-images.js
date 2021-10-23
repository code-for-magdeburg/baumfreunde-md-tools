
const { getPdfFilenames } = require('./utils');
const path = require('path');
const fs = require('fs');
const pdfjs = require('pdfjs-dist/legacy/build/pdf');
const { createCanvas } = require('canvas');
const progress = require('cli-progress');


const FULL_CHUNK_HEIGHT = 16;


async function createExtractImagePromise(imgData, targetOutputPath, num) {

    const canvas = createCanvas(imgData.width, imgData.height);
    const ctx = canvas.getContext('2d');
    const height = imgData.height;
    const width = imgData.width;
    const partialChunkHeight = height % FULL_CHUNK_HEIGHT;
    const fullChunks = (height - partialChunkHeight) / FULL_CHUNK_HEIGHT;
    const totalChunks = partialChunkHeight === 0 ? fullChunks : fullChunks + 1;

    const chunkImgData = ctx.createImageData(width, FULL_CHUNK_HEIGHT);
    let srcPos = 0;
    let destPos;
    const src = imgData.data;
    const dest = chunkImgData.data;
    let i, j, thisChunkHeight, elemsInThisChunk;

    // There are multiple forms in which the pixel data can be passed, and
    // imgData.kind tells us which one this is.
    if (imgData.kind === 1 /*ImageKind.GRAYSCALE_1BPP*/) {
        // Grayscale, 1 bit per pixel (i.e. black-and-white).
        const srcLength = src.byteLength;
        const dest32 = new Uint32Array(dest.buffer, 0, dest.byteLength >> 2);
        const dest32DataLength = dest32.length;
        const fullSrcDiff = (width + 7) >> 3;
        let white = 0xffffffff;
        let black = false /*IsLittleEndianCached.value*/ ? 0xff000000 : 0x000000ff;

        for (i = 0; i < totalChunks; i++) {
            thisChunkHeight = i < fullChunks ? FULL_CHUNK_HEIGHT : partialChunkHeight;
            destPos = 0;
            for (j = 0; j < thisChunkHeight; j++) {
                const srcDiff = srcLength - srcPos;
                let k = 0;
                const kEnd = srcDiff > fullSrcDiff ? width : srcDiff * 8 - 7;
                const kEndUnrolled = kEnd & ~7;
                let mask = 0;
                let srcByte = 0;
                for (; k < kEndUnrolled; k += 8) {
                    srcByte = src[srcPos++];
                    dest32[destPos++] = srcByte & 128 ? white : black;
                    dest32[destPos++] = srcByte & 64 ? white : black;
                    dest32[destPos++] = srcByte & 32 ? white : black;
                    dest32[destPos++] = srcByte & 16 ? white : black;
                    dest32[destPos++] = srcByte & 8 ? white : black;
                    dest32[destPos++] = srcByte & 4 ? white : black;
                    dest32[destPos++] = srcByte & 2 ? white : black;
                    dest32[destPos++] = srcByte & 1 ? white : black;
                }
                for (; k < kEnd; k++) {
                    if (mask === 0) {
                        srcByte = src[srcPos++];
                        mask = 128;
                    }

                    dest32[destPos++] = srcByte & mask ? white : black;
                    mask >>= 1;
                }
            }
            // We ran out of input. Make all remaining pixels transparent.
            while (destPos < dest32DataLength) {
                dest32[destPos++] = 0;
            }

            ctx.putImageData(chunkImgData, 0, i * FULL_CHUNK_HEIGHT);
        }
    } else if (imgData.kind === 3 /*ImageKind.RGBA_32BPP*/) {
        // RGBA, 32-bits per pixel.
        j = 0;
        elemsInThisChunk = width * FULL_CHUNK_HEIGHT * 4;
        for (i = 0; i < fullChunks; i++) {
            dest.set(src.subarray(srcPos, srcPos + elemsInThisChunk));
            srcPos += elemsInThisChunk;
            ctx.putImageData(chunkImgData, 0, j);
            j += FULL_CHUNK_HEIGHT;
        }
        if (i < totalChunks) {
            elemsInThisChunk = width * partialChunkHeight * 4;
            dest.set(src.subarray(srcPos, srcPos + elemsInThisChunk));
            ctx.putImageData(chunkImgData, 0, j);
        }
    } else if (imgData.kind === 2 /*ImageKind.RGB_24BPP*/) {
        // RGB, 24-bits per pixel.
        thisChunkHeight = FULL_CHUNK_HEIGHT;
        elemsInThisChunk = width * thisChunkHeight;
        for (i = 0; i < totalChunks; i++) {
            if (i >= fullChunks) {
                thisChunkHeight = partialChunkHeight;
                elemsInThisChunk = width * thisChunkHeight;
            }

            destPos = 0;
            for (j = elemsInThisChunk; j--; ) {
                dest[destPos++] = src[srcPos++];
                dest[destPos++] = src[srcPos++];
                dest[destPos++] = src[srcPos++];
                dest[destPos++] = 255;
            }

            ctx.putImageData(chunkImgData, 0, i * FULL_CHUNK_HEIGHT);
        }
    } else {
        return Promise.reject(`bad image kind: ${imgData.kind}`);
    }

    return new Promise((resolve, reject) => {
        const buffer = canvas.toBuffer('image/png');
        const targetFilepath = path.join(targetOutputPath, `${num}.png`);
        fs.writeFile(targetFilepath, buffer, err => {
            if (err) {
                return reject(err);
            }
            resolve({ filename: targetFilepath, width, height, sizeInBytes: buffer.length });
        });
    });

}


async function extractImagesFromPage(page, targetOutputPath) {

    try {
        const ops = await page.getOperatorList();
        const fns = ops.fnArray;
        const args = ops.argsArray;
        const extractImagePromises = args
            .filter((arg, index) => fns[index] === pdfjs.OPS.paintJpegXObject || fns[index] === pdfjs.OPS.paintImageXObject)
            .map((arg, index) => {
                const imgKey = arg[0];
                const imgData = page.objs.get(imgKey);
                return createExtractImagePromise(imgData, targetOutputPath, index + 1);
            });
        return Promise.all(extractImagePromises);

    } catch (e) {
        return Promise.reject(e);
    }

}


async function extractImagesFromDocument(document, targetOutputPath) {
    try {
        const page = await document.getPage(1);
        return extractImagesFromPage(page, targetOutputPath);
    } catch (e) {
        return Promise.reject(e);
    }
}


async function createExtractImagesPromise(pdfPath, pdfFilename, outputBasePath) {

    try {

        const pdfFilepath = path.join(pdfPath, pdfFilename);
        const document = await pdfjs
            .getDocument({ url: pdfFilepath, useSystemFonts: true, useWorkerFetch: true })
            .promise;

        const targetOutputPath = path.join(outputBasePath, pdfFilename);
        fs.mkdirSync(targetOutputPath, { recursive: true });

        const imageFiles = await extractImagesFromDocument(document, targetOutputPath);

        return { pdf: pdfFilename, imageFiles };

    } catch (e) {
        return Promise.reject(e);
    }

}


async function processPdfs(pdfFiles, pdfPath, outputPath) {

    console.log(`Processing ${pdfFiles.length} PDF documents`);

    const result = [];

    const progressBar = new progress.SingleBar({}, progress.Presets.shades_classic);
    progressBar.start(pdfFiles.length, 0);

    for (const pdfFile of pdfFiles) {
        progressBar.increment();
        result.push(await createExtractImagesPromise(pdfPath, pdfFile, outputPath));
    }

    progressBar.stop();

    return result;

}


function saveResultsToFile(processResults, outputPath) {
    const outputFilePath = path.join(outputPath, 'extract-summary.json');
    fs.writeFileSync(outputFilePath, JSON.stringify(processResults, null, 2))
    console.log(`Summary saved to ${outputFilePath}`);
}


async function extractImages(args) {

    const { pdfPath, outputPath } = args;

    const pdfFiles = getPdfFilenames(pdfPath);
    const processResults = await processPdfs(pdfFiles, pdfPath, outputPath);

    const totalImages = processResults.reduce((p, c) => p + c.imageFiles.length, 0);
    console.log(`${processResults.length} PDF documents have been processed. ${totalImages} image files were generated.`);

    saveResultsToFile(processResults, outputPath)

}


module.exports = extractImages;
