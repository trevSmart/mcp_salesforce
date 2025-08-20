#!/bin/bash

# Script d'instal·lació per a Jupyter Notebooks del projecte MCP Salesforce
echo "🚀 Configurant Jupyter Notebooks per al projecte MCP Salesforce..."

# Verificar si Python està instal·lat
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 no està instal·lat. Si us plau, instal·la Python 3.8 o superior."
    exit 1
fi

echo "✅ Python 3 trobat: $(python3 --version)"

# Anar al directori arrel del projecte
cd "$(dirname "$0")/.."

# Crear entorn virtual (opcional però recomanat)
if [ ! -d "venv" ]; then
    echo "📦 Creant entorn virtual..."
    python3 -m venv venv
    echo "✅ Entorn virtual creat"
else
    echo "✅ Entorn virtual ja existeix"
fi

# Activar entorn virtual
echo "🔧 Activant entorn virtual..."
source venv/bin/activate

# Actualitzar pip
echo "📥 Actualitzant pip..."
pip install --upgrade pip

# Instal·lar dependències
echo "📚 Instal·lant dependències de Jupyter..."
pip install -r notebooks/requirements.txt

# Verificar instal·lació de l'SDK MCP
echo "🔍 Verificant instal·lació de l'SDK MCP..."
python3 -c "
try:
    import mcp
    print('✅ SDK MCP instal·lat correctament')
    print(f'   Versió: {mcp.__version__ if hasattr(mcp, \"__version__\") else \"Desconeguda\"}')
except ImportError as e:
    print(f'❌ Error: SDK MCP no instal·lat: {e}')
    print('   Executa: pip install \"mcp[cli]\"')
    exit(1)
"

# Verificar altres dependències
echo "🔍 Verificant altres dependències..."
python3 -c "import jupyter, pandas, matplotlib; print('✅ Totes les dependències instal·lades correctament')"

# Crear kernel personalitzat per al projecte
echo "🎯 Creant kernel personalitzat per al projecte..."
python3 -m ipykernel install --user --name=mcp-salesforce --display-name="MCP Salesforce"

# Prova de connexió MCP (opcional)
echo "🧪 Provant connexió MCP..."
if python3 -c "import mcp" 2>/dev/null; then
    echo "✅ SDK MCP disponible per a testing"
    echo "   Per a provar la connexió, executa: python3 notebooks/mcp_client.py"
else
    echo "⚠️  SDK MCP no disponible per a testing"
fi

echo ""
echo "🎉 Configuració completada!"
echo ""
echo "Per a iniciar Jupyter Notebooks:"
echo "  1. Activa l'entorn virtual: source venv/bin/activate"
echo "  2. Inicia Jupyter: jupyter notebook"
echo "  3. Obre un dels notebooks del directori notebooks/"
echo ""
echo "O per a iniciar JupyterLab (interfície més avançada):"
echo "  jupyter lab"
echo ""
echo "Els notebooks estan disponibles a:"
echo "  - testing-tools.ipynb: Testing interactiu d'eines MCP reals"
echo "  - documentation-examples.ipynb: Exemples d'ús de cada eina"
echo "  - development-workflow.ipynb: Workflow de desenvolupament interactiu"
echo ""
echo "Client MCP disponible a:"
echo "  - mcp_client.py: Client Python per a connectar-se al servidor MCP"
echo ""
echo "Nota: L'entorn virtual està al nivell arrel del projecte (../venv/)"
echo ""
echo "Per a provar la connexió MCP:"
echo "  cd notebooks && python3 mcp_client.py"
