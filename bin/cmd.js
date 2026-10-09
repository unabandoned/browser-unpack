#!/usr/bin/env node

var parse = require('../');
var { Writable } = require('node:stream');
var fs = require('fs');

var { parseArgs } = require('node:util');
// strict: false keeps the old minimist behaviour of ignoring unknown flags.
var argv = parseArgs({
    args: process.argv.slice(2),
    options: { help: { type: 'boolean', short: 'h' } },
    strict: false,
    allowPositionals: true
}).values;
if (argv.help) {
    return fs.createReadStream(__dirname + '/usage.txt')
        .pipe(process.stdout)
    ;
}

function collect (stream, cb) {
    var chunks = [];
    stream.on('error', cb);
    stream.pipe(new Writable({
        write: function (chunk, enc, next) { chunks.push(Buffer.from(chunk)); next() },
        final: function (done) { cb(null, Buffer.concat(chunks)); done() }
    }));
}

collect(process.stdin, function (err, body) {
    if (err) {
        console.error(err);
        process.exit(1);
    }

    var rows = parse(body);
    if (!rows) {
        console.error("couldn't parse this bundle");
        process.exit(1);
    }

    console.log('[');
    rows.forEach(function (row, index) {
        if (index > 0) console.log(',');
        console.log(JSON.stringify(row));
    });
    console.log(']');
});
