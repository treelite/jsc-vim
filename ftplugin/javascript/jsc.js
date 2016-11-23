/**
 * @file Javascript comment generator for VIM
 * @author treelite(c.xinle@gmail.com)
 */

var esprima = require('esprima');
var estraverse = require('estraverse');
var SYNTAX = esprima.Syntax;
var execSync = require('child_process').execSync;
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
NODE_TYPE[SYNTAX.ExportNamedDeclaration] = 'define';
NODE_TYPE[SYNTAX.ExportDefaultDeclaration] = 'define';

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
    if (!ast) {
        type = '*';
    }
    else if (ast.type === SYNTAX.Literal) {
        type = typeof ast.value;
    }
    else {
        type = EXP_TYPE[ast.type] || '*';
    }

    return type;
}

/**
 * 确定函数的返回值的类型
 *
 * @param {Object} ast AST 节点
 * @return {!string}
 */
function detectReturnType(ast) {
    var type;
    estraverse.traverse(ast.body, {
        enter: function (node) {
            if (node.type === SYNTAX.VariableDeclaration
                || node.type === SYNTAX.FunctionExpression
                || node.type === SYNTAX.FunctionDeclaration
            ) {
                return estraverse.VisitorOption.Skip;
            }
            else if (node.type === SYNTAX.ReturnStatement && node.argument) {
                type = detectVariableType(node.argument);
                return estraverse.VisitorOption.Break;
            }
        }
    });
    return type;
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
    res.type = detectVariableType(ast.declarations[0].init);

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
        isPublic: true,
        target: 'fn',
        params: []
    };

    ast.value.params.forEach(function (item) {
        res.params.push(item.name);
    });

    res.returnType = detectReturnType(ast.value);

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
    // 可能是匿名的 function 定义
    if (ast.id) {
        var name = ast.id.name;
        res.isClass = isClassName(name);
    }

    // 如果是class就不用找return了
    if (res.isClass) {
        return res;
    }

    res.returnType = detectReturnType(ast);

    return res;
};

// export 处理
handlers.define = function (ast) {
    var ast = ast.declaration;
    var type = NODE_TYPE[ast.type];
    if (!type) {
        return;
    }
    var res = handlers[type](ast);
    res.isPublic = true;
    res.target = type;
    return res;
};

/**
 * 获取用户信息
 * 尝试从 git 中获取
 *
 * @param {string} fileName 文件路径
 * @param {string} user 默认的用户名
 * @param {string} email 默认的用户邮箱
 * @return {Object}
 */
function queryUserInfo(fileName, user, email) {
    let options = {
        cwd: path.dirname(fileName),
        encoding: 'utf8'
    };

    return {
        user: execSync('git config --get user.name', options).trim() || user,
        email: execSync('git config --get user.email', options).trim() || email
    };
}

/**
 * 输出注释
 *
 * @param {string} code 代码
 * @param {number} lineNum 光标所在行号
 * @param {string} fileName 文件路径
 * @param {string} author 默认配置的用户名
 * @param {string} email 默认配置的邮箱
 */
function generate(code, lineNum, fileName, author, email) {
    // 文件头注释
    if (lineNum === 1) {
        var info = queryUserInfo(fileName, author, email);
        return process.stdout.write(etpl.render('file', {name: info.user, email: info.email}));
    }

    var options = {loc: true};
    if (/^(import|export)\s/m.test(code)) {
        options.sourceType = 'module';
    }
    var ast = esprima.parse(code, options);

    estraverse.traverse(ast, {
        enter: function (node) {
            if (node.type === SYNTAX.Program) {
                return;
            }
            if (node.loc.start.line === lineNum) {
                var data;
                var type = NODE_TYPE[node.type];
                if (type && (data = handlers[type](node))) {
                    var target = data.target || type;
                    var cmt = etpl.render(target, data);
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
    var author = process.argv[3];
    var email = process.argv[4];
    generate(code.join(''), lineNum, author, email);
});
