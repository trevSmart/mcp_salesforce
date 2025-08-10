#!/bin/bash
set -e

# Obté el nom del paquet des de package.json
package_name=$(node -p "require('./package.json').name")
# Obté la versió publicada a NPM (si existeix)
published_version=$(npm view "$package_name" version 2>/dev/null || true)

echo "\033[38;2;255;140;0mScript de publicació a NPM de $package_name\033[0m"
echo "\033[38;2;255;140;0mMarc Pla, 2025\033[0m"
echo

# Executa el script de testTools.js i comprova si hi ha algun KO
echo "\033[95mExecutant tests bàsics de funcionament del servidor...\033[0m"
echo
TEST_OUTPUT=$(mktemp)
node dev/testTools.js | tee "$TEST_OUTPUT"
if grep -q 'KO' "$TEST_OUTPUT"; then
  echo "\033[95mS'han detectat errors (KO) als tests. Aturant la build.\033[0m"
  rm -f "$TEST_OUTPUT"
  exit 1
fi
rm -f "$TEST_OUTPUT"

if [ -n "$published_version" ]; then
  tmpfile=$(mktemp)
  jq --arg v "$published_version" '.version = $v' package.json > "$tmpfile" && mv "$tmpfile" package.json
fi

current_version=$(node -p "require('./package.json').version")
major=$(echo $current_version | cut -d. -f1)
minor=$(echo $current_version | cut -d. -f2)
patch=$(echo $current_version | cut -d. -f3)
new_patch=$((patch + 1))
new_version="$major.$minor.$(printf '%02d' $new_patch)"

echo "\033[95mATENCIÓ: S'actualitzarà la versió a la $new_version i es publicarà a NPM (versió actual: $published_version). Vols continuar? (S/n)\033[0m"
read -r resposta
if [[ ! "$resposta" =~ ^[Ss]$ ]]; then
  echo
  echo "\033[95mOperació cancel·lada per l'usuari.\033[0m"
  exit 1
fi

npm view "$package_name" version > /dev/null 2>&1

cp package.json package.json.bak
cp index.js index.js.bak

restore_versions() {
  echo
  echo "\033[95mRestauració de la versió original de package.json i index.js...\033[0m"
  if [ ! -f package.json.bak ] || [ ! -f index.js.bak ]; then
    echo "\033[91mATENCIÓ: No s'ha trobat package.json.bak o index.js.bak per restaurar!\033[0m"
    return 1
  fi
  mv package.json.bak package.json
  mv index.js.bak index.js
}
trap restore_versions ERR

npm version $new_version --no-git-tag-version > /dev/null 2>&1

echo

# Clona el codi font a dist
rm -rf dist
mkdir dist
rsync -a --exclude='node_modules' --exclude='logs' --exclude='*.log' --exclude='.idea' --exclude='.vscode' --exclude='.DS_Store' --exclude='Thumbs.db' --exclude='*.swp' --exclude='*.swo' --exclude='package*.json' --exclude='dist' --exclude='tmp' --exclude='.eslintrc.json' --exclude='.gitignore' --exclude='.npmignore' --exclude='.*' --exclude='*.bak' --exclude='*.tmp' --exclude='*.temp' --exclude='rules' --exclude='dev' --exclude='.src' --exclude='.git' --exclude='@/deva' ./ ./dist/

echo "\033[95mOfuscant els fitxers JavaScript...\033[0m"
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

echo

echo "\033[95mCodificant els fitxers Markdown...\033[0m"
if [ -d "dist/src/tools" ]; then
  find dist/src/tools -name '*.md' | while read -r file; do
    if [ -f "$file" ]; then
      b64file="$file.b64"
      base64 -i "$file" -o "$b64file"
      rm -f "$file"
      echo "   $file"
    fi
  done
fi

node dev/updateReadmeDeeplinks.js > /dev/null 2>&1

sed -i '' "s/\(version: '\)[^']*'/\1$new_version'/" index.js

echo

echo "\033[95mPublicant el paquet a NPM...\033[0m"
PUBLISH_OUTPUT=$(mktemp)
if ! (npm publish --access public) > "$PUBLISH_OUTPUT" 2>&1; then
  echo "\033[91m❌ Error publicant el paquet a NPM:\033[0m"ie
  cat "$PUBLISH_OUTPUT"
  rm -f "$PUBLISH_OUTPUT"
  exit 1
fi

# Mostra les línies de notice si l'execució ha estat exitosa
grep -E 'npm notice (name:|version:|shasum:|total files:)' "$PUBLISH_OUTPUT" | while read -r line; do
  printf "   \033[96mnpm notice\033[0m%s\n" "${line#npm notice}"
done
rm -f "$PUBLISH_OUTPUT"

echo

echo "\033[95mFinalitzant...\033[0m"
trap - ERR
rm -f package.json.bak index.js.bak
echo