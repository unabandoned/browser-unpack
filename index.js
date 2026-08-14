var acorn = require('acorn');

// defined(): the first argument that is not undefined. Previously the `defined`
// package; inlined here to drop a runtime dependency.
function defined () {
    for (var i = 0; i < arguments.length; i++) {
        if (arguments[i] !== undefined) return arguments[i];
    }
}

function parse (src, opts) {
    if (!opts) opts = {};
    var acornOpts = {
        // Defaults acorn-node used to supply out of the box. acorn 8 with
        // ecmaVersion 'latest' natively parses everything acorn-node's bundled
        // plugins added (bigint, class fields, static class features, numeric
        // separators, import.meta, `export * as ns from`), so no plugins are
        // needed — we call acorn directly. Note browser-unpack passes
        // `range: true`; acorn's option is `ranges`, mapped below so node
        // .start/.end ranges are still produced.
        ecmaVersion: 'latest',
        allowHashBang: true,
        allowReturnOutsideFunction: true,
        ranges: defined(opts.ranges, opts.range),
        locations: defined(opts.locations, opts.loc),
        allowReserved: defined(opts.allowReserved, true),
        allowImportExportEverywhere: defined(opts.allowImportExportEverywhere, false)
    };

    if (opts.ecmaVersion != null) acornOpts.ecmaVersion = opts.ecmaVersion;
    if (opts.sourceType != null) acornOpts.sourceType = opts.sourceType;
    if (opts.allowHashBang != null) acornOpts.allowHashBang = opts.allowHashBang;
    if (opts.allowReturnOutsideFunction != null) acornOpts.allowReturnOutsideFunction = opts.allowReturnOutsideFunction;

    return acorn.parse(src, acornOpts);
}

module.exports = function (src) {
    // If src is a Buffer, esprima will just stringify it, so we beat them to
    // the punch. This avoids the problem where we're using esprima's range
    // indexes -- which are meant for a UTF-16 string -- in a buffer that
    // contains UTF-8 encoded text.
    if (typeof src !== 'string') {
        src = String(src);
    }

    var ast = parse(src, { range: true });

    ast.body = ast.body.filter(function(node) {
        return node.type !== 'EmptyStatement';
    });

    if (ast.body.length !== 1) return;
    if (ast.body[0].type !== 'ExpressionStatement') return;
    if (ast.body[0].expression.type === 'UnaryExpression') {
        var body = ast.body[0].expression.argument;
    } else if (ast.body[0].expression.type === 'AssignmentExpression') {
        var body = ast.body[0].expression.right;
    } else {
        var body = ast.body[0].expression;
    }

    if (body.type !== 'CallExpression') return;

    var args = body.arguments;
    if (args.length === 1) args = extractStandalone(args) || args;
    if (args.length !== 3) return;
    
    if (args[0].type !== 'ObjectExpression') return;
    if (args[1].type !== 'ObjectExpression') return;
    if (args[2].type !== 'ArrayExpression') return;
    
    var files = args[0].properties;
    var cache = args[1];
    var entries = args[2].elements.map(function (e) {
        return e.value
    });
    
    return files.map(function (file) {
        var body = file.value.elements[0].body.body;
        var start, end;
        if (body.length === 0) {
            start = body.start || 0;
            end = body.end || 0;
        }
        else {
            start = body[0].start;
            end = body[body.length-1].end;
        }
        
        var depProps = file.value.elements[1].properties;
        var deps = depProps.reduce(function (acc, dep) {
            var key = dep.key.type === 'Literal' 
                ? dep.key.value 
                : dep.key.name;
            acc[key] = dep.value.value;
            return acc;
        }, {});
        var row = {
            id: file.key.type === 'Literal'
                ? file.key.value
                : file.key.name,
            source: src.slice(start, end),
            deps: deps
        };
        if (entries.indexOf(row.id) >= 0) row.entry = true;
        return row;
    });
};

function extractStandalone (args) {
    if (args[0].type !== 'FunctionExpression') return;
    if (args[0].body.length < 2) return;
    if (args[0].body.body.length < 2) return;

    args = args[0].body.body[1].argument;
    if (args.type !== 'CallExpression') return;
    if (args.callee.type !== 'CallExpression') return;

    return args.callee.arguments;
};
