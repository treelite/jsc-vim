jsc-vim
===

JavaScript comment generator for VIM

According to the cursor for generate two kinds comment: single line and multi line comment.

Multi line comment contains `@const`, `@param` or other tokens, which depends on variable declaration or function declaration.

## Installation

Recommend using [Pathogen](https://github.com/tpope/vim-pathogen/) to manage your VIM plugins. By it, you can simply clone `jsc-vim` to your `~/.vim/bundle/`:

```sh
git clone https://github.com/treelite/jsc-vim.git ~/.vim/bundle/jsc-vim
```

And then install node packages(Yes, `jsc-vim` use [esprima](https://github.com/ariya/esprima) to find out which tokens should be contained in the comment).

```sh
cd ~/.vim/bundle/fecs-vim
npm install
```

Done!

## Usage

Use `:JSC` to insert comment and then the cursor will auto locate on the place where you need writing more information.

When the cursor is in multi line comment, you can use `:JSCnext` to locate next position, of course move to previous position is `:JSCprev`.

## Tips

Quick mapping in your `~/.vimrc`:

```vim
nmap <C-i> :JSC<CR>
```
