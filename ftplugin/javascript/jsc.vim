"
" @file JS comment generator for VIM
" @author treelite(c.xinle@gmail.com)
"

if exists(':JSC')
    finish
endif

" 获取当前脚本的路径
let s:root = expand('<sfile>:p:h')

" 判断当前是否是在多行注释中
function s:isInMultiLineComment()
    let curLine = getline('.')
    return match(curLine, '^\s*/\?\*') == 0
endfunction

" 获取下一行的起始点
function s:nextPos(lnum, col, direction, start, end)
    let res = {}
    let res.lnum = a:lnum + a:direction
    if res.lnum < a:start
        let res.lnum = a:end - 1
    elseif res.lnum > a:end
        let res.lnum = a:start + 1
    endif
    let indentNum = indent(res.lnum)
    let res.col = a:direction > 0 ? indentNum + 1 : 999
    return res
endfunction

" 寻找范围内的输入点
function s:findPos(lnum, col, direction, start, end)
    let np = s:nextPos(a:lnum, a:col, a:direction, a:start, a:end)

    if a:lnum == a:start || a:lnum == a:end
        return s:findPos(np.lnum, np.col, a:direction, a:start, a:end)
    endif

    let indentNum = indent(a:lnum)
    let sd = a:direction > 0 ? '' : 'b'
    let curLine = getline(a:lnum)

    " 特殊处理第一个内容行
    if a:lnum == a:start + 1
        if a:direction * (indentNum + 2 - a:col) > 0
            let res = {}
            let res.lnum = a:lnum
            let res.col = indentNum + 2
            return res
        else
            return s:findPos(np.lnum, np.col, a:direction, a:start, a:end)
        endif
    endif

    " 其它情况下都去寻找一个空格后面的位置
    if match(curLine, '^\s\+\*\s@') == 0
        call cursor(a:lnum, a:col)
        let npos = searchpos('\s[^@*]', 'n'.sd, a:lnum)
        if npos[0] == 0
            return s:findPos(np.lnum, np.col, a:direction, a:start, a:end)
        else
            let res = {}
            let res.lnum = a:lnum
            let res.col = npos[1] + 1
            return res
        endif
    endif

    return s:findPos(np.lnum, np.col, a:direction, a:start, a:end)

endfunction

" 定位下一个注释输入点
function s:locate(direction)
    if !s:isInMultiLineComment()
        return
    endif

    let curPos = getpos('.')
    call cursor(curPos[1], 999)
    let start = search('/\*', 'bn')
    call cursor(curPos[1], 1)
    let end = search('\*/', 'n')

    let newPos = s:findPos(curPos[1], curPos[2] + a:direction, a:direction, start, end)
    call cursor(newPos.lnum, newPos.col)
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
function s:parse(lineNum, code)
    let cmd = ['node']
    call add(cmd, s:root.'/jsc.js')
    call add(cmd, a:lineNum)
    return system(join(cmd, ' '), a:code)
endfunction

" main
function s:generate()
    let code = getline(1, '$')
    let cmt = s:parse(line('.'), join(code, "\n"))
    if strlen(cmt) <= 0
        let cmt = '// '
    endif

    call s:comment(getpos('.'), cmt)
endfunction

" 命令注册
command JSC call s:generate()
command JSCnext call s:locate(1)
command JSCprev call s:locate(-1)

" 按键注册
if !exists('g:jsc_insert_key') || g:jsc_insert_key == ''
    let g:jsc_insert_key = '<C-i>'
endif
if !exists('g:jsc_prev_key') || g:jsc_prev_key == ''
    let g:jsc_prev_key = '<D-K>'
endif
if !exists('g:jsc_next_key') || g:jsc_next_key == ''
    let g:jsc_prev_key = '<D-J>'
endif

exe 'nmap '.g:jsc_insert_key.' :JSC<CR>'
exe 'nmap '.g:jsc_prev_key.' :JSCprev<CR>'
exe 'nmap '.g:jsc_next_key.' :JSCnext<CR>'
