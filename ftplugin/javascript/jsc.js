/**
 * @file Javascript comment generator for VIM
 * @author treelite(c.xinle@gmail.com)
 */

var esprima = require('esprima');
var estraverse = require('estraverse');
var SYNTAX = esprima.Syntax;
var etpl = require('etpl');
var path = require('path');
var fs = require('fs');

etpl.config({
    strip: true
});
etpl.compile(fs.readFileSync(path.resolve(__dirname, 'jsc.tpl'), 'utf8'));

/**
 * 变量类型对应关系
 *
 * @const
 * @type {Object}
 */
var EXP_TYPE = {};
EXP_TYPE[SYNTAX.ArrayExpression] = 'Array';
EXP_TYPE[SYNTAX.ObjectExpression] = 'Object';
EXP_TYPE[SYNTAX.FunctionExpression] = 'Function';

/**
 * 判断变量名是否是类名
 * 首字母大写
 *
 * @param {string} name
 * @return {boolean}
 */
function isClassName(name) {
    var charCode = name.charCodeAt(0);
    return charCode >= 65 && charCode <= 90;
}

// 注释生成处理器
var handlers = {};

// 变量声明处理器
handlers.var = function (ast) {
    var res = {};
    var name = ast.declarations[0].id.name;

    // 判断是否是常量
    if (/^[A-Z_]+$/.test(name)) {
        res.isConst = true;
    }

    // 判断变量类型
    var init = ast.declarations[0].init;
    if (!init) {
        res.type = '*'
    }
    else if (init.type === SYNTAX.Literal) {
        res.type = typeof init.value;
    }
    else {
        res.type = EXP_TYPE[init.type] || '*'
    }

    if (res.type === 'Function'
        && !res.isConst
        && isClassName(name)
    ) {
        res.isClass = true;
    }

    return res;
};

// 函数声明处理器
handlers.fn = function (ast) {
    var res = {params: []};

    // 收集参数
    ast.params.forEach(function (item) {
        res.params.push(item.name);
    });

    // 判断是否是class
    var name = ast.id.name;
    res.isClass = isClassName(name);

    // 如果是class就不用找return了
    if (res.isClass) {
        return res;
    }

    // 寻找return
    var body = ast.body;
    estraverse.traverse(body, {
        enter: function (node) {
            if (node.type === SYNTAX.VariableDeclaration
                || node.type === SYNTAX.FunctionExpression
                || node.type === SYNTAX.FunctionDeclaration
            ) {
                return estraverse.VisitorOption.Skip;
            }
            else if (node.type === SYNTAX.ReturnStatement) {
                res.hasReturn = true;
                return estraverse.VisitorOption.Break;
            }
        }
    });

    return res;
};

/**
 * 输出注释
 *
 * @param {string} code
 */
function generate(code) {
    var ast = esprima.parse(code);
    var stat = ast.body[0];

    var type = stat.type === SYNTAX.FunctionDeclaration ? 'fn' : 'var';
    var data = handlers[type](stat);

    var cmt = etpl.render(type, data);
    cmt = cmt.replace(/\n\n+/g, '\n');
    process.stdout.write(cmt);
}

var code = [];

process.stdin.setEncoding('utf8');

process.stdin.on('readable', function () {
    var chunk = process.stdin.read();
    if (chunk) {
        code.push(chunk);
    }
});

process.stdin.on('end', function () {
    generate(code.join(''));
});
