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
EXP_TYPE[SYNTAX.ArrowFunctionExpression] = 'Function';

/**
 * 节点类型对应关系
 *
 * @const
 * @type {Object}
 */
var NODE_TYPE = {};
NODE_TYPE[SYNTAX.VariableDeclaration] = 'var';
NODE_TYPE[SYNTAX.FunctionDeclaration] = 'fn';
NODE_TYPE[SYNTAX.ClassDeclaration] = 'cls';
NODE_TYPE[SYNTAX.MethodDefinition] = 'method';

/**
 * 判断变量名是否是类名
 * 首字母大写
 *
 * @param {string} name 变量名
 * @return {boolean}
 */
function isClassName(name) {
    var charCode = name.charCodeAt(0);
    return charCode >= 65 && charCode <= 90;
}

/**
 * 判断变量类型
 *
 * @param {Object} ast AST 节点
 * @return {string}
 */
function detectVariableType(ast) {
    var type;
    var init = ast.declarations[0].init;
    if (!init) {
        type = '*';
    }
    else if (init.type === SYNTAX.Literal) {
        type = typeof init.value;
    }
    else {
        type = EXP_TYPE[init.type] || '*';
    }

    return type;
}

/**
 * 寻找函数的返回值
 *
 * @param {Object} ast AST 节点
 * @return {boolean}
 */
function detectReturnValue(ast) {
    var res = false;
    estraverse.traverse(ast.body, {
        enter: function (node) {
            if (node.type === SYNTAX.VariableDeclaration
                || node.type === SYNTAX.FunctionExpression
                || node.type === SYNTAX.FunctionDeclaration
            ) {
                return estraverse.VisitorOption.Skip;
            }
            else if (node.type === SYNTAX.ReturnStatement && node.argument) {
                res = true;
                return estraverse.VisitorOption.Break;
            }
        }
    });
    return res;
}

// 注释生成处理器
var handlers = {};

// 变量声明处理器
handlers.var = function (ast) {
    var res = {};
    var name = ast.declarations[0].id.name;

    // 判断是否是常量
    if (ast.kind === 'const' || /^[A-Z_]+$/.test(name)) {
        res.isConst = true;
    }

    // 判断变量类型
    res.type = detectVariableType(ast);

    if (res.type === 'Function'
        && !res.isConst
        && isClassName(name)
    ) {
        res.isClass = true;
    }

    return res;
};

// 类处理
handlers.cls = function (ast) {
    var res = {};

    // 确定基类
    if (ast.superClass) {
        res.superClass = ast.superClass.name;
    }

    return res;
};

// 方法声明处理
handlers.method = function (ast) {
    var res = {
        isConstructor: ast.kind === 'constructor',
        params: []
    };

    ast.value.params.forEach(function (item) {
        res.params.push(item.name);
    });

    res.hasReturn = detectReturnValue(ast.value);

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

    res.hasReturn = detectReturnValue(ast);

    return res;
};

/**
 * 输出注释
 *
 * @param {string} code 代码
 * @param {number} lineNum 光标所在行号
 */
function generate(code, lineNum) {
    var ast = esprima.parse(code, {loc: true});

    estraverse.traverse(ast, {
        enter: function (node) {
            if (node.type === SYNTAX.Program) {
                return;
            }
            if (node.loc.start.line === lineNum) {
                var type = NODE_TYPE[node.type];
                if (type) {
                    var data = handlers[type](node);
                    var cmt = etpl.render(type, data);
                    cmt = cmt.replace(/\n\n+/g, '\n');
                    process.stdout.write(cmt);
                }
                return estraverse.VisitorOption.Break;
            }
        }
    });
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
    var lineNum = parseInt(process.argv[2], 10);
    generate(code.join(''), lineNum);
});
