#!/bin/bash
set -e

# Executa el script de testTools.js i comprova si hi ha algun KO
echo "\033[95mProvant les tools...\033[0m"
echo
TEST_OUTPUT=$(mktemp)
node dev/testTools.js | tee "$TEST_OUTPUT"
if grep -q 'KO' "$TEST_OUTPUT"; then

  echo "\033[95mS'han detectat errors (KO) als tests. Aturant la build.\033[0m"
  rm -f "$TEST_OUTPUT"
  exit 1
fi
rm -f "$TEST_OUTPUT"

# Obté el nom del paquet des de package.json
package_name=$(node -p "require('./package.json').name")
# Obté la versió publicada a NPM (si existeix)
published_version=$(npm view "$package_name" version 2>/dev/null || true)
if [ -n "$published_version" ]; then
  # Actualitza només el camp version de package.json
  tmpfile=$(mktemp)
  jq --arg v "$published_version" '.version = $v' package.json > "$tmpfile" && mv "$tmpfile" package.json
fi

# Obté la versió actual
current_version=$(node -p "require('./package.json').version")
# Extreu major, minor i patch
major=$(echo $current_version | cut -d. -f1)
minor=$(echo $current_version | cut -d. -f2)
patch=$(echo $current_version | cut -d. -f3)
# Incrementa el patch en 1
new_patch=$((patch + 1))
new_version="$major.$minor.$(printf '%02d' $new_patch)"

echo "\033[95mATENCIÓ: S'actualitzarà la versió a la $new_version i es publicarà a NPM (versió actual: $published_version). \033[0m"
echo "\033[95mVols continuar? (S/n)\033[0m"
read -r resposta
if [[ ! "$resposta" =~ ^[Ss]$ ]]; then
  echo
  echo "\033[95mOperació cancel·lada per l'usuari.\033[0m"
  exit 1
fi

# Actualitza package.json amb la versió actualment publicada a NPM
npm view "$package_name" version > /dev/null 2>&1

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
rsync -a --exclude='node_modules' --exclude='logs' --exclude='*.log' --exclude='.idea' --exclude='.vscode' --exclude='.DS_Store' --exclude='Thumbs.db' --exclude='*.swp' --exclude='*.swo' --exclude='package-lock.json' --exclude='dist' --exclude='tmp' --exclude='.eslintrc.json' --exclude='.gitignore' --exclude='.npmignore' --exclude='.*' --exclude='*.bak' --exclude='*.tmp' --exclude='*.temp' --exclude='rules' --exclude='dev' --exclude='@/deva' ./ ./dist/

echo
echo "\033[95mOfuscant el codi JS amb javascript-obfuscator...\033[0m"
find dist -name '*.js' | while read -r file; do
  echo "   $file..."
  ./node_modules/.bin/javascript-obfuscator "$file" \
    --output "$file" \
    --compact true \
    --string-array true \
    --string-array-threshold 0.75 \
    --identifier-names-generator mangled \
    --target node \
    --self-defending true \
    --debug-protection false \
    --unicode-escape-sequence true \
    --rename-globals true \
    >/dev/null 2>&1 || {
      echo "❌ Error ofuscant $file"
      exit 1
    }
done


# find dist -name '*.js' -exec npx terser {} \
#   --compress passes=3,unsafe=true,unsafe_arrows=true,unsafe_methods=true,unsafe_proto=true,unsafe_regexp=true,unsafe_undefined=true,drop_console=true,drop_debugger=true,booleans_as_integers=true,dead_code=true,global_defs='DEBUG=false' \
#   --mangle \
#   --mangle-props regex=/.*/ \
#   --toplevel \
#   --module \
#   --output {} \
#   --ascii-only \
#   --name-cache tmp/terser-name-cache.json \
# \;

# find dist -name '*.js' -exec npx terser {} \
#   --compress passes=3,unsafe=true,unsafe_arrows=true,unsafe_methods=true,unsafe_proto=true,unsafe_regexp=true,unsafe_undefined=true,drop_console=true,drop_debugger=true \
#   --mangle \
#   --mangle-props 'regex=/^_/' \
#   --toplevel \
#   --module \
#   --output {} \
#   --ascii-only \
# \;

# Executa l'script de post-processat
node dev/updateReadmeCursorDeeplink.js > /dev/null 2>&1

# Sincronitza la versió a index.js (new Server(..., { version: ... }) )
sed -i '' "s/\(version: '\)[^']*'/\1$new_version'/" index.js

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