const fs = require('fs');
const csv = require('csv');
const GeoJSON = require('geojson');
const progress = require('cli-progress');


async function loadTreeRegistry(filepath) {

    return new Promise((resolve, reject) => {

        const registry = [];
        fs
            .createReadStream(filepath)
            .pipe(csv.parse({ cast: true, columns: true }))
            .on('data', row => registry.push(row))
            .on('end', () => resolve(registry))
            .on('error', reject);

    });

}


async function loadTrees(inputFilepath, treeRegistry) {

    console.log(`Loading and preparing tree information`);

    return new Promise((resolve, reject) => {

        const rows = [];

        fs
            .createReadStream(inputFilepath)
            .pipe(csv.parse({ cast: true, columns: true }))
            //.on('data', row => trees.push(...createTreesFromCsvRow(row, treeRegistry)))
            .on('data', row => rows.push(row))
            .on('end', () => {

                const trees = [];
                const progressBar = new progress.SingleBar({}, progress.Presets.shades_classic);
                progressBar.start(rows.length, 0);

                for (const row of rows) {
                    progressBar.increment();
                    trees.push(...createTreesFromCsvRow(row, treeRegistry));
                }


                resolve(trees);

                progressBar.stop();

            })
            .on('error', reject);

    });

}


function createTreesFromCsvRow(row, treeRegistry) {

    const treeIds = row.tree_ids.split('|');
    return treeIds
        .map(treeId => {

            const tree = treeRegistry.find(t => t.Baumnr === treeId)
            if (!tree) {
                return false;
            }

            const genus = tree.Gattung.indexOf(',') > -1 ? tree.Gattung.split(',')[0].trim() : tree.Gattung;
            const common = tree.Gattung.indexOf(',') > -1 ? tree.Gattung.split(',')[1].trim() : '';
            return {
                name: treeId + ' - ' + common,
                lat: tree ? tree.Latitude : null,
                lng: tree ? tree.Longitude : null,
                reportedDate: row.reported_date,
                filename: row.filename,
                filesize: row.filesize,
                ref: treeId,
                genus,
                common,
                height: tree.Baumhoehe,
                crown: tree.Kronendurchmesser,
                dbh: tree.Stammumfang,
                address: tree.Gebiet
            };

        })
        .filter(tree => !!tree);

}


function saveAsGeoJson(trees, outputFilepath) {
    const geoJson = GeoJSON.parse(trees, { Point: ['lat', 'lng'] });
    fs.writeFileSync(outputFilepath, JSON.stringify(geoJson));
}


async function createGeoJson(args) {

    const { inputFilepath, outputFilepath } = args;

    const treeRegistry = await loadTreeRegistry('./data/Baumkataster 2019.csv');
    const trees = await loadTrees(inputFilepath, treeRegistry);
    saveAsGeoJson(trees, outputFilepath);
    console.log(`Results saved to ${outputFilepath}`);

}


module.exports = createGeoJson;
