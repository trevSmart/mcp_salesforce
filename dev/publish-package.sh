#!/bin/sh
set -e

# Script compatible amb sh (POSIX). Treu dependència de bash.

# Obté el nom del paquet des de package.json
package_name=$(node -p "require('./package.json').name")
# Obté la versió publicada a NPM (si existeix)
published_version=$(npm view "$package_name" version 2>/dev/null || true)

echo "\033[38;2;255;140;0mScript de publicació a NPM de $package_name\033[0m"
echo "\033[38;2;255;140;0mTrevor Smart, 2025\033[0m"
echo

# Gestió de la versió abans dels tests
if [ -n "$published_version" ]; then
  tmpfile=$(mktemp)
  jq --arg v "$published_version" '.version = $v' package.json > "$tmpfile" && mv "$tmpfile" package.json
fi

current_version=$(node -p "require('./package.json').version")
major=$(echo $current_version | cut -d. -f1)
minor=$(echo $current_version | cut -d. -f2)
patch=$(echo $current_version | cut -d. -f3)
new_patch=$((patch + 1))
proposed_version="$major.$minor.$new_patch"

# Mostra instrucció clara i demana la nova versió
echo "\033[38;5;99mVersió $current_version\033[0m\033[36m --> \033[1m$proposed_version\033[22m.\033[0m\033[95m Accepta (↵) o indica'n una altra:\033[0m"

IFS= read -r new_version
if [ -z "$new_version" ]; then
  new_version="$proposed_version"
fi

# Si l'usuari no ha introduït res, utilitza la versió proposada
if [ -z "$new_version" ]; then
  new_version="$proposed_version"
fi

# Valida el format de la versió
echo "$new_version" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$' || {
  echo "\033[91mError: Format de versió invàlid. El format ha de ser 'major.minor.patch' (ex: 1.2.3)\033[0m"
  exit 1
}

# Executa els tests utilitzant el framework de test configurat
echo "\033[95mExecutant tests bàsics de funcionament del servidor...\033[0m"
TEST_OUTPUT=$(mktemp)
npm run test -- --quiet | tee "$TEST_OUTPUT"

# Comprova si els tests han passat correctament
if ! grep -q '🎉 All tests passed!' "$TEST_OUTPUT"; then
  echo "\033[95mS'han detectat errors als tests. Aturant la build.\033[0m"
  rm -f "$TEST_OUTPUT"
  exit 1
fi

echo
echo "\033[95m✅ Tots els tests han passat correctament.\033[0m"
rm -f "$TEST_OUTPUT"

# No facis fallar el script si el paquet encara no existeix a NPM
npm view "$package_name" version > /dev/null 2>&1 || true

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
# En sh no hi ha 'ERR'; es farà restore manual en cas d'error

npm version $new_version --no-git-tag-version > /dev/null 2>&1

echo

# Actualitza deeplinks del README abans de preparar dist
node dev/updateReadmeDeeplinks.js > /dev/null 2>&1 || true

# Clona el codi font a dist (amb exclusions de .npmignore)
echo "\033[95mGenerant pkg amb el codi ofuscat...\033[0m"
rm -rf dist || {
  echo "\033[91m❌ Error eliminant directori dist:\033[0m"
  echo "   Error: $?"
  echo "   Directori actual: $(pwd)"
  echo "   Contingut:"
  ls -la dist/ 2>&1 || echo "   No es pot llistar"
  restore_versions
  exit 1
}

mkdir dist || {
  echo "\033[91m❌ Error creant directori dist:\033[0m"
  echo "   Error: $?"
  echo "   Directori actual: $(pwd)"
  echo "   Permisos del directori pare:"
  ls -ld . 2>&1 || echo "   No es poden veure els permisos"
  restore_versions
  exit 1
}

rsync -a --exclude-from=.npmignore ./ ./dist/ || {
  echo "\033[91m❌ Error copiant fitxers a dist:\033[0m"
  echo "   Error: $?"
  restore_versions
  exit 1
}

# Sortida silenciosa per aquestes línies tret que VERBOSE=1
: "${VERBOSE:=0}"
# Ensure vecho never returns non-zero under set -e
vecho() {
  if [ "${VERBOSE}" = "1" ]; then
    printf "%s\n" "$*"
  fi
  return 0
}
vecho "\033[95mPreparant llista de noms exportats per preservar...\033[0m"

# Construeix una llista de noms exportats (ESM) per reservar-los durant l'ofuscació
reserved_tmp=$(mktemp)
# export function|class|const|let|var NAME
grep -RhoE "export[[:space:]]+(function|class|const|let|var)[[:space:]]+[A-Za-z_][$A-Za-z0-9_]*" dist 2>/dev/null | awk '{print $NF}' >> "$reserved_tmp" || true
# export { a, b as c }
grep -RhoE "export[[:space:]]*\{[^}]+\}" dist 2>/dev/null \
  | sed -E 's/.*\{([^}]*)\}.*/\1/' \
  | tr ',' '\n' \
  | sed -E 's/[[:space:]]+as[[:space:]]+.*$//' \
  | sed -E 's/^\s+|\s+$//g' \
  | grep -E '^[A-Za-z_][$A-Za-z0-9_]*$' >> "$reserved_tmp" || true

# Construeix patró per a --reserved-names (separat per comes)
OBF_RESERVED=$(sort -u "$reserved_tmp" | awk 'BEGIN{ORS=","} {printf "^%s$", $0} END{print ""}' | sed 's/,$//')
rm -f "$reserved_tmp"

if [ -n "$OBF_RESERVED" ]; then
  vecho "   Noms reservats: $(echo "$OBF_RESERVED" | tr ',' ' ')"
else
  vecho "   Cap nom exportat detectat per reservar."
fi

echo "\033[96mOfuscant els fitxers JavaScript (preservant exports ESM)...\033[0m"
find dist -name '*.js' | while read -r file; do
  echo "   $file..."

  # Evita ofuscar scripts amb shebang (ex. CLI), per evitar problemes de processament i preservar la capçalera
  if head -n 1 "$file" | grep -q '^#!'; then
    echo "   (omès - script amb shebang)"
    continue
  fi

  # Continua: ofuscar també ESM però preservant els noms exportats i desactivant self-defending

  OBF_LOG=$(mktemp)
  obf_tmp="${file%.js}.obf.tmp.js"   # IMPORTANT: ha d'acabar en .js per evitar directoris fantasma

  ./node_modules/.bin/javascript-obfuscator "$file" \
    --output "$obf_tmp" \
    --compact true \
    --target node \
    --debug-protection false \
    --unicode-escape-sequence true \
    --identifier-names-generator hexadecimal \
    --rename-globals false \
    --string-array true \
    --self-defending false \
    --string-array-threshold 0.75 \
    ${OBF_RESERVED:+--reserved-names "$OBF_RESERVED"} \
    >"$OBF_LOG" 2>&1 || {
      echo "❌ Error ofuscant $file"
      echo "—— Sortida de l'obfuscador ——"
      sed -n '1,200p' "$OBF_LOG"
      rm -f "$OBF_LOG" "$obf_tmp"
      restore_versions
      exit 1
    }

  # Valida que el codi ofuscat és vàlid abans de substituir
  if ! node --check "$obf_tmp" 2>/dev/null; then
    echo "❌ Error: El codi ofuscat per $file no és vàlid JavaScript"
    echo "—— Contingut del fitxer ofuscat ——"
    head -n 10 "$obf_tmp"
    rm -f "$OBF_LOG" "$obf_tmp"
    restore_versions
    exit 1
  fi

  # Substitueix l’original de forma segura
  if command -v install >/dev/null 2>&1; then
    install -m 0644 "$obf_tmp" "$file"
  else
    cp -f "$obf_tmp" "$file"
  fi
  rm -f "$OBF_LOG" "$obf_tmp"
done

echo

echo "\033[96mCodificant els fitxers Markdown...\033[0m"
# Codifica tots els fitxers .md de totes les carpetes (incloent static)
find dist -name '*.md' | while read -r file; do
  if [ -f "$file" ]; then
    b64file="$file.pam"
    base64 -i "$file" -o "$b64file"
    rm -f "$file"
    echo "   $file"
  fi
done

echo

echo "\033[96mCodificant els fitxers Apex...\033[0m"
# Codifica tots els fitxers .apex de totes les carpetes (incloent static)
find dist -name '*.apex' | while read -r file; do
  if [ -f "$file" ]; then
    b64file="$file.pam"
    base64 -i "$file" -o "$b64file"
    rm -f "$file"
    echo "   $file"
  fi
done

# Neteja arxius que no calin dins el paquet i prepara package.json minimal
rm -f dist/.npmignore
echo
jq '{
  name, version, description, main, type, browser, bin, keywords, author, dependencies, engines
} + { files: ["index.js", "src", "bin", "README.md", "LICENSE"] }' package.json > dist/package.json

echo "\033[95mValidant arrencada del paquet ofuscat (smoke test)...\033[0m"
(
  cd dist
  VALIDATE_LOG=$(mktemp)
  if MCP_PREPUBLISH_VALIDATE=1 node index.js > "$VALIDATE_LOG" 2>&1; then
    if grep -q 'PREPUBLISH_OK' "$VALIDATE_LOG"; then
      echo "\033[92m✅ Validació completada amb èxit.\033[0m"
    else
      echo "\033[91m❌ Validació fallida: no s'ha confirmat l'arrencada.\033[0m"
      sed -n '1,200p' "$VALIDATE_LOG"
      rm -f "$VALIDATE_LOG"
      restore_versions
      exit 1
    fi
  else
    echo "\033[91m❌ Validació fallida: error en executar node index.js\033[0m"
    sed -n '1,200p' "$VALIDATE_LOG"
    rm -f "$VALIDATE_LOG"
    restore_versions
    exit 1
  fi
  rm -f "$VALIDATE_LOG"
)

echo

# Re-executa els tests, ara utilitzant el servidor MCP de la build ofuscada a dist/
echo "\033[95mExecutant tests contra el servidor ofuscat (dist/)...\033[0m"
TEST_DIST_OUTPUT=$(mktemp)
# Indica al runner que arrenqui el servidor des de dist/index.js
MCP_TEST_SERVER_PATH="../dist/index.js" npm run test -- --quiet | tee "$TEST_DIST_OUTPUT"

if ! grep -q '🎉 All tests passed!' "$TEST_DIST_OUTPUT"; then
  echo "\033[91m❌ Els tests contra la build ofuscada han fallat.\033[0m"
  rm -f "$TEST_DIST_OUTPUT"
  restore_versions
  exit 1
fi

rm -f "$TEST_DIST_OUTPUT"
echo
echo "\033[95m✅ Tests amb el paquet ofuscat completats correctament.\033[0m"
echo
echo "\033[95mVols continuar amb la publicació del paquet a NPM? (S/n)\033[0m"
IFS= read -r resposta
case "$resposta" in
  S|s) : ;;
  *)
    echo
    echo "\033[95mPublicació cancel·lada per l'usuari.\033[0m"
    exit 1
    ;;
esac

echo
echo "\033[95mPublicant el paquet a NPM (des de dist/)...\033[0m"
PUBLISH_OUTPUT=$(mktemp)

# Canvia al directori dist i executa npm publish amb redireccions separades (més robust)
cd dist
npm publish --access public > "$PUBLISH_OUTPUT" 2>&1
publish_status=$?
if [ $publish_status -ne 0 ]; then
  echo "\033[91m❌ Error publicant el paquet a NPM:\033[0m"
  cat "$PUBLISH_OUTPUT"
  rm -f "$PUBLISH_OUTPUT"
  cd ..  # Torna al directori original
  restore_versions
  exit 1
fi
cd ..  # Torna al directori original

# Mostra les línies de notice si l'execució ha estat exitosa (sense parèntesis a l'script)
while IFS= read -r line; do
  case "$line" in
    "npm notice name:"*|"npm notice version:"*|"npm notice shasum:"*|"npm notice total files:"*)
      printf "   \033[96mnpm notice\033[0m%s\n" "${line#npm notice}"
      ;;
  esac
done < "$PUBLISH_OUTPUT"
rm -f "$PUBLISH_OUTPUT"

echo

echo "\033[95mFinalitzant...\033[0m"
trap - ERR
rm -f package.json.bak index.js.bak
echo
