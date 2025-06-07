#!/bin/bash
set -e

# Elimina la carpeta dist si existeix
rm -rf dist

# Crea la carpeta dist
mkdir dist

# Copia els fitxers excepte els exclosos
rsync -av --exclude='node_modules' --exclude='logs' --exclude='*.log' --exclude='.idea' --exclude='.vscode' --exclude='.DS_Store' --exclude='Thumbs.db' --exclude='*.swp' --exclude='*.swo' --exclude='package-lock.json' --exclude='dist' --exclude='.eslintrc.json' --exclude='.gitignore' --exclude='.npmignore' --exclude='package.json' --exclude='.*' --exclude='*.bak' --exclude='*.tmp' --exclude='*.temp' --exclude='rules' --exclude='dev' ./ ./dist/

# Ofusca els fitxers .js a dist
find dist -name '*.js' -exec javascript-obfuscator {} --output {} \;

# Executa l'script de post-processat
node dev/updateReadmeCursorDeeplink.js