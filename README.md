
### Parse PDF documents

- Scans filename for tree ids
- Scans PDF text content for tree ids
- Gets the size of PDF files
- Gets the reported date from filename 
- Stores results in CSV file

Run using the following command
```
node ./index.js parse-pdfs [pdf-path] [-f fixed-trees-filepath] [-o output-filepath]
```
- `pdf-path` points to the directory containing tree documentation PDF files (default: ./)
- `fixed-trees-filepath` is a CSV file that contains a list of trees with predefined tree ids
- `output-filepath` is the name of the resulting CSV file (default: ./parsed_trees.csv)

### Create GeoJSON file

Run using the following command
```
node ./index.js create-geojson input-filepath [-o output-filepath]
```
- `input-filepath` is a CSV file containing all available tree information (e.g. produced by the parse-pdfs command)
- `output-filepath` is the name of the resulting GeoJSON file (default: ./trees.geojson)
