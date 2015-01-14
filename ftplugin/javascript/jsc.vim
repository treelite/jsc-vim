"
" @file JS comment generator for VIM
" @author treelite(c.xinle@gmail.com)
"

if exists(':JSC')
    finish
endif

" 获取当前脚本的路径
let s:root = expand('<sfile>:p:h')

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

function s:comment(cursor, code)
    let indentNum = indent(a:cursor[1])
    let indentStr = join(repeat([' '], indentNum), '')
    let code = split(a:code, "\n")
    call map(code, 'indentStr.v:val')
    call append(a:cursor[1] - 1, code)
    " TODO
    " Fix cursor position
endfunction

function s:parse(code)
    let cmd = ['node']
    call add(cmd, s:root.'/jsc.js')
    return system(join(cmd, ' '), a:code)
endfunction

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
        call s:comment(rawCursor, '// ')
    else
        let cmt = s:parse(join(code, "\n"))
        call s:comment(rawCursor, cmt)
    endif

endfunction

command JSC call s:generate()
