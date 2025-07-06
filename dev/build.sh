#!/bin/bash
set -e

# Executa el script de testTools.js i comprova si hi ha algun KO
echo "\033[95mExecutant els tests...\033[0m"
TEST_OUTPUT=$(mktemp)
node dev/testTools.js | tee "$TEST_OUTPUT"
if grep -q 'KO' "$TEST_OUTPUT"; then

  echo "\033[95mS'han detectat errors (KO) als tests. Aturant la build.\033[0m"
  rm -f "$TEST_OUTPUT"
  exit 1
fi
rm -f "$TEST_OUTPUT"

# Obté la versió actual
current_version=$(node -p "require('./package.json').version")
# Extreu major, minor i patch
major=$(echo $current_version | cut -d. -f1)
minor=$(echo $current_version | cut -d. -f2)
patch=$(echo $current_version | cut -d. -f3)
# Incrementa el patch en 1
new_patch=$((patch + 1))
new_version="$major.$minor.$new_patch"

echo "\033[95mATENCIÓ: S'actualitzarà la versió del paquet a $new_version i es publicarà a NPM. Vols continuar? (S/n)\033[0m"
read -r resposta
if [[ ! "$resposta" =~ ^[Ss]$ ]]; then
  echo "\033[95mOperació cancel·lada per l'usuari.\033[0m"
  exit 1
fi

# Guarda còpia de seguretat de package.json i index.js
cp package.json package.json.bak
cp index.js index.js.bak

# Funció per restaurar les versions originals si hi ha error
restore_versions() {
  echo "\033[95mRestauració de la versió original de package.json i index.js...\033[0m"
  mv package.json.bak package.json
  mv index.js.bak index.js
}

# Assegura la restauració en cas d'error o sortida inesperada
trap restore_versions ERR EXIT

# Actualitza la versió al package.json
npm version $new_version --no-git-tag-version > /dev/null 2>&1

# Copia els fitxers excepte els exclosos
echo
echo "\033[95mGenerant la carpeta \\dist amb el codi JS ofuscat...\033[0m"
rm -rf dist
mkdir dist
rsync -a --exclude='node_modules' --exclude='logs' --exclude='*.log' --exclude='.idea' --exclude='.vscode' --exclude='.DS_Store' --exclude='Thumbs.db' --exclude='*.swp' --exclude='*.swo' --exclude='package-lock.json' --exclude='dist' --exclude='.eslintrc.json' --exclude='.gitignore' --exclude='.npmignore' --exclude='.*' --exclude='*.bak' --exclude='*.tmp' --exclude='*.temp' --exclude='rules' --exclude='dev' --exclude='@/deva' ./ ./dist/
find dist -name '*.js' -exec npx terser {} \
  --compress passes=3,unsafe=true,unsafe_arrows=true,unsafe_methods=true,unsafe_proto=true,unsafe_regexp=true,unsafe_undefined=true,drop_console=true,drop_debugger=true \
  --mangle \
  --mangle-props 'regex=/^_/' \
  --toplevel \
  --module \
  --output {} \
  --ascii-only \
\;

# Executa l'script de post-processat
node dev/updateReadmeCursorDeeplink.js > /dev/null 2>&1

# Sincronitza la versió a index.js (new Server(..., { version: ... }) )
sed -i '' "s/\(new Server({name: 'salesforce-mcp', version: '\)[^']*'/\1$new_version'/" index.js

# Publica el paquet a npm
echo
echo "\033[95mPublicant el paquet a NPM...\033[0m"
(cd dist && npm publish --access public > /dev/null 2>&1)

# Si tot ha anat bé, elimina les còpies de seguretat
echo
echo "\033[95mFinalitzant...\033[0m"
rm -f package.json.bak index.js.bak
# Desactiva el trap
trap - ERR EXIT
echo