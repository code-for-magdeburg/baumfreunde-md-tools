#!/usr/bin/env node


const yargs = require('yargs/yargs');
const {hideBin} = require('yargs/helpers');

const parsePdfs = require('./parse-pdfs');
const createGeoJSON = require('./create-geojson');
const extractImages = require('./extract-images');


yargs(hideBin(process.argv))

    .command('parse-pdfs [pdf-path] [-f fixed-trees-filepath] [-o output-filepath]', '', {
        'pdf-path': {
            describe: 'Directory of pdf files to be analyzed',
            default: './'
        },
        'f': {
            alias: 'fixed-trees-filepath',
            describe: 'File name of csv containing predefined tree numbers'
        },
        'o': {
            alias: 'output-filepath',
            describe: 'Name of result csv file',
            default: './parsed_trees.csv'
        }
    }, parsePdfs)

    .command('create-geojson input-filepath [-o output-filepath]', '', {
        'i': {
            alias: 'input-filepath',
            //default: './parsed_trees.csv'
        },
        'o': {
            alias: 'output-filepath',
            describe: 'Name of result csv file',
            default: './trees.geojson'
        }
    }, createGeoJSON)

    .command('extract-images [pdf-path]', '', {
        'pdf-path': {
            describe: 'Directory of pdf files to be analyzed',
            default: './'
        },
        'o': {
            alias: 'output-path',
            describe: 'Name of directory where extracted images will be stored',
            default: './images'
        }
    }, extractImages)

    .wrap(null)
    .alias('h', 'help')
    .demandCommand()
    .argv
