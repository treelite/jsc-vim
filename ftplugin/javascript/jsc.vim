"
" @file JS comment generator for VIM
" @author treelite(c.xinle@gmail.com)
"

if exists(':JSC')
    finish
endif

" 获取当前脚本的路径
let s:root = expand('<sfile>:p:h')

" 获取光标所在行完整的代码块
function s:getBlock(token)
    let startLine = line('.')
    let endToken = a:token == '{' ? '}' : ']'
    let found = search(a:token, '', startLine)

    if !found
        return []
    endif

    normal %
    return getline(startLine, line('.'))
endfunction

" 添加注释
function s:comment(cursor, code)
    let isSingle = strpart(a:code, 1, 1) == '/'
    let indentNum = indent(a:cursor[1])
    let indentStr = join(repeat([' '], indentNum), '')
    let code = split(a:code, "\n")
    call map(code, 'indentStr.v:val')
    call append(a:cursor[1] - 1, code)

    " Locate cursor
    let lnum = a:cursor[1] + (isSingle ? 0 : 1)
    let col = indentNum + 3
    call cursor(lnum, col)
endfunction

" 调用外部命令生成注释
function s:parse(code)
    let cmd = ['node']
    call add(cmd, s:root.'/jsc.js')
    return system(join(cmd, ' '), a:code)
endfunction

" main
function s:generate()
    let curLine = getline('.')
    let rawCursor = getpos('.')
    let code = []

    if match(curLine, '^\s*function ') == 0
        let code = s:getBlock('{')
    elseif match(curLine, '^\s*var ') == 0
        for token in ['{', '[']
            let code = s:getBlock(token)
            if len(code) > 0
                break
            endif
        endfor
        if len(code) <= 0
            code = [curline]
        endif
    endif

    if len(code) <= 0
        let cmt = '// '
    else
        let cmt = s:parse(join(code, "\n"))
    endif

    call s:comment(rawCursor, cmt)
endfunction

" 命令注册
command JSC call s:generate()
