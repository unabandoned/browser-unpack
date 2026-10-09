var test = require('node:test');
var assert = require('node:assert');
var { spawnSync } = require('node:child_process');
var fs = require('fs');
var path = require('path');

var cmd = path.join(__dirname, '..', 'bin', 'cmd.js');
var usage = fs.readFileSync(path.join(__dirname, '..', 'bin', 'usage.txt'), 'utf8');

function run (args, input) {
    return spawnSync(process.execPath, [cmd].concat(args), { input: input, encoding: 'utf8' });
}

test('cli: unpacks a bundle from stdin into JSON rows', function () {
    var src = fs.readFileSync(path.join(__dirname, 'files', 'bundle.js'), 'utf8');
    var res = run([], src);
    assert.equal(res.status, 0, res.stderr);
    var rows = JSON.parse(res.stdout);
    assert.deepEqual(rows, require('../')(src));
    assert.ok(rows.length > 0);
});

test('cli: --help and -h print usage', function () {
    ['--help', '-h'].forEach(function (flag) {
        var res = run([flag], '');
        assert.equal(res.status, 0, res.stderr);
        assert.equal(res.stdout, usage);
    });
});

test('cli: unknown flags are ignored, as with minimist', function () {
    var src = fs.readFileSync(path.join(__dirname, 'files', 'bundle.js'), 'utf8');
    var res = run(['--whatever'], src);
    assert.equal(res.status, 0, res.stderr);
    assert.deepEqual(JSON.parse(res.stdout), require('../')(src));
});

test('cli: non-bundle input fails with a message', function () {
    var res = run([], 'var x = 1;');
    assert.equal(res.status, 1);
    assert.match(res.stderr, /couldn't parse this bundle/);
});
