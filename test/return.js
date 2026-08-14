var test = require('./tap-adapter');
var unpack = require('../');
var pack = require('browser-pack');
var { Writable } = require('node:stream');
var vm = require('vm');

function collect (stream, cb) {
    var chunks = [];
    stream.pipe(new Writable({
        write: function (chunk, enc, next) { chunks.push(Buffer.from(chunk)); next() },
        final: function (done) { cb(Buffer.concat(chunks)); done() }
    }));
}

var fs = require('fs');
var src = fs.readFileSync(__dirname + '/files/return.js', 'utf8');

test('return', function (t) {
    t.plan(1);
    
    var p = pack({ raw: true });
    collect(p, function (body) {
        var log = function (msg) {
            t.equal(msg, 'whatever');
        };
        var c = { console: { log: log } };
        vm.runInNewContext(body.toString('utf8'), c);
    });

    var rows = unpack(src);
    rows.forEach(function (row) { p.write(row) });
    p.end();
});
