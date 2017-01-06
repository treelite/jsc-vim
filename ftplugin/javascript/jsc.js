/**
 * @file Javascript comment generator for VIM
 * @author treelite(c.xinle@gmail.com)
 */

let babylon = require('babylon');
let execSync = require('child_process').execSync;
let etpl = require('etpl');
let path = require('path');
let fs = require('fs');

etpl.config({
    strip: true
});
etpl.compile(fs.readFileSync(path.resolve(__dirname, 'jsc.tpl'), 'utf8'));

const CMD_SKIP = Symbol('CMD_SKIP');
const CMD_BREAK = Symbol('CMD_BREAK');

/**
 * 变量类型对应关系
 *
 * @const
 * @type {Object}
 */
const EXPRESSION_TYPE = {
    ArrayExpression: 'Array',
    ObjectExpression: 'Object',
    FunctionExpression: 'Function',
    ArrowFunctionExpression: 'Function'
};

/**
 * 字符常量
 *
 * @const
 * @type {Object}
 */
const LITERAL_TYPE = {
    StringLiteral: 'string',
    NumericLiteral: 'number',
    BooleanLiteral: 'boolean',
    NullLiteral: 'null',
    RegExpLiteral: 'RegExp'
};

/**
 * 判断变量名是否是类名
 * 首字母大写
 *
 * @param {string} name 变量名
 * @return {boolean}
 */
function isClassName(name) {
    let charCode = name.charCodeAt(0);
    return charCode >= 65 && charCode <= 90;
}

/**
 * 判断变量类型
 *
 * @param {Object} node AST 节点
 * @return {string}
 */
function detectVariableType(node) {
    let type;
    if (node.type.indexOf('Literal') >= 0) {
        type = LITERAL_TYPE[node.type];
    }
    else {
        type = EXPRESSION_TYPE[node.type];
    }

    return type || '*';
}

/**
 * 确定函数的返回值的类型
 *
 * @param {Object} ast AST 节点
 * @return {!string}
 */
function detectReturnType(ast) {
    let type;
    traverse(ast.body, node => {
        if (node.type === 'VariableDeclaration'
            || node.type === 'FunctionExpression'
            || node.type === 'FunctionDeclaration'
        ) {
            return CMD_SKIP;
        }
        else if (node.type === 'ReturnStatement' && node.argument) {
            type = detectVariableType(node.argument);
            return CMD_BREAK;
        }
    });
    return type;
}

// 注释生成处理器
const handlers = {

    /**
     * 变量声明
     *
     * @param {Object} ast AST node
     * @return {Object}
     */
    VariableDeclaration(ast) {
        let res = {target: 'let'};
        let name = ast.declarations[0].id.name;

        // 判断是否是常量
        if (ast.kind === 'const' || /^[A-Z_]+$/.test(name)) {
            res.isConst = true;
        }

        // 判断变量类型
        if (ast.declarations[0].init) {
            res.type = detectVariableType(ast.declarations[0].init);
        }

        if (res.type === 'Function'
            && !res.isConst
            && isClassName(name)
        ) {
            res.isClass = true;
        }

        return res;
    },

    /**
     * 函数声明
     *
     * @param {Object} ast AST node
     * @return {Object}
     */
    FunctionDeclaration(ast) {
        let res = {target: 'fn', params: []};

        // 收集参数
        ast.params.forEach(function (item) {
            res.params.push(item.name);
        });

        // 判断是否是class
        // 可能是匿名的 function 定义
        if (ast.id) {
            let name = ast.id.name;
            res.isClass = isClassName(name);
        }

        // 如果是class就不用找return了
        if (res.isClass) {
            return res;
        }

        res.returnType = detectReturnType(ast.body);

        return res;
    },

    /**
     * 类声明
     *
     * @param {Object} ast AST node
     * @return {Object}
     */
    ClassDeclaration(ast) {
        let res = {target: 'cls'};

        // 确定基类
        if (ast.superClass) {
            res.superClass = ast.superClass.name;
        }

        if (ast.decorators && ast.decorators.length) {
            res.line = ast.decorators[0].loc.start.line;
        }

        return res;
    },

    /**
     * 对象方法
     *
     * @param {Object} ast AST node
     * @return {Object}
     */
    ObjectMethod(ast) {
        let res = {
            target: 'fn',
            params: []
        };

        ast.params.forEach(function (item) {
            res.params.push(item.name);
        });

        res.returnType = detectReturnType(ast.body);

        return res;
    },

    /**
     * 类方法
     *
     * @param {Object} ast AST node
     * @return {Object}
     */
    ClassMethod(ast) {
        let res = {
            isConstructor: ast.kind === 'constructor',
            isPublic: true,
            target: 'fn',
            params: []
        };

        ast.params.forEach(function (item) {
            res.params.push(item.name);
        });

        if (ast.decorators && ast.decorators.length) {
            res.line = ast.decorators[0].loc.start.line;
        }

        res.returnType = detectReturnType(ast.body);

        return res;
    },

    /**
     * 具名导出
     *
     * @param {Object} ast AST node
     * @param {Array.<Object>} parent AST nodes
     * @return {Object}
     */
    ExportNamedDeclaration(ast, parent) {
        parent.unshift(ast.declaration);
        let res = redirect(parent);
        if (res) {
            res.isPublic = true;
        }
        return res;
    },

    /**
     * 装饰器
     *
     * @param {Object} ast AST node
     * @param {Array.<Object>} parent AST nodes
     * @return {Object}
     */
    Decorator(ast, parent) {
        return redirect(parent);
    }

};

handlers.ExportDefaultDeclaration = handlers.ExportNamedDeclaration;

/**
 * 转移注释信息
 *
 * @param {Array.<Object>} nodes 父级 AST
 * @return {Object}
 */
function redirect(nodes) {
    if (!nodes) {
        return;
    }

    let data;
    let node = nodes.shift();
    let handler = handlers[node.type];

    if (handler) {
        data = handler(node, nodes);
    }

    return data;
}

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
 * 遍历 AST
 *
 * @param {Array.<Object>} nodes AST nodes
 * @param {Function} fn 处理函数
 */
function traverse(nodes, fn) {
    if (!Array.isArray(nodes)) {
        nodes = [nodes];
    }
    else if (!nodes.length) {
        return;
    }

    let i;
    let node;
    let children = [];

    for (i = 0; i < nodes.length; i++) {
        node = nodes[i];
        let cmd = fn(node);
        if (cmd === CMD_BREAK) {
            break;
        }
        if (cmd !== CMD_SKIP) {
            children = append(children, node, 'body');
            children = append(children, node, 'consequent');
            children = append(children, node, 'alternate');
        }
    }

    if (i >= nodes.length) {
        traverse(children, fn);
    }
}

/**
 * 追加节点
 *
 * @param {Array} list nodes
 * @param {Object} node AST node
 * @param {string} property 属性名称
 * @return {Array}
 */
function append(list, node, property) {
    let value = node[property];
    if (Array.isArray(value)) {
        list = list.concat(value);
    }
    else if (value) {
        list.push(value);
    }
    return list;
}

/**
 * 定位 AST
 *
 * @param {Object} node AST
 * @param {number} line 行号
 * @param {Array} parent 父级节点
 * @return {Object} AST node
 */
function locate(node, line, parent = []) {
    if (!node) {
        return;
    }
    else if (node.type === 'File') {
        return locate(node.program, line);
    }

    if (node.loc.start.line === line && node.type !== 'Program') {
        parent.unshift(node);
        return parent;
    }

    let children = [];
    children = append(children, node, 'body');
    children = append(children, node, 'decorators');
    children = append(children, node, 'consequent');
    children = append(children, node, 'alternate');
    if (node.type === 'VariableDeclaration') {
        for (let dec of node.declarations) {
            // Add properties for ObjectExpression
            children = append(children, dec.init || {}, 'properties');
        }
    }
    parent.unshift(node);

    let res;
    for (let child of children) {
        res = locate(child, line, parent);
        if (res) {
            break;
        }
    }

    if (!res) {
        parent.shift();
    }

    return res;
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
        let info = queryUserInfo(fileName, author, email);
        return process.stdout.write(
            lineNum + '\n' + etpl.render('file', {name: info.user, email: info.email})
        );
    }

    let options = {sourceType: 'script', plugins: ['decorators']};
    if (/^(import|export)\s/m.test(code)) {
        options.sourceType = 'module';
    }
    let ast = babylon.parse(code, options);
    let nodes = locate(ast, lineNum);

    let data = redirect(nodes);
    if (data) {
        let line = data.line || lineNum;
        let cmt = etpl.render(data.target, data);
        cmt = cmt.replace(/\n\n+/g, '\n');
        process.stdout.write(line + '\n' + cmt);
    }
}

let code = [];

process.stdin.setEncoding('utf8');

process.stdin.on('readable', function () {
    let chunk = process.stdin.read();
    if (chunk) {
        code.push(chunk);
    }
});

process.stdin.on('end', function () {
    let lineNum = parseInt(process.argv[2], 10);
    let fileName = process.argv[3];
    let author = process.argv[4];
    let email = process.argv[5];
    generate(code.join(''), lineNum, fileName, author, email);
});
