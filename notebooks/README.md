# Jupyter Notebooks per al Projecte MCP Salesforce

Aquest directori conté Jupyter Notebooks que serveixen per a:

## 🎯 **Objectius dels Notebooks**

1. **Testing Interactiu**: Provar les eines MCP de forma interactiva **connectant-se al servidor real**
2. **Documentació Viva**: Exemples executables de com utilitzar cada eina
3. **Desenvolupament**: Experimentar amb codi i prompts
4. **Debugging**: Analitzar problemes de forma interactiva

## 🔌 **Connexió al Servidor MCP**

Els notebooks ara es connecten **directament al servidor MCP Salesforce** utilitzant l'SDK oficial de Python:

- **`mcp_client.py`**: Client Python que gestiona la connexió al servidor
- **Connexió real**: No més mocks - les eines funcionen de veritat
- **Gestió d'errors**: Handling complet d'errors i timeouts
- **Context manager**: Gestiona automàticament la connexió

## 🚀 **Com utilitzar-los**

### **1. Setup inicial:**
```bash
# Executar el script de setup
./notebooks/setup-jupyter.sh

# O manualment:
source venv/bin/activate
pip install -r notebooks/requirements.txt
```

### **2. Iniciar Jupyter:**
```bash
source venv/bin/activate
jupyter notebook
```

### **3. Provar la connexió MCP:**
```bash
cd notebooks
python3 mcp_client.py
```

## 📁 **Estructura**

- **`testing-tools.ipynb`**: Testing interactiu d'eines MCP reals
- **`documentation-examples.ipynb`**: Exemples d'ús de cada eina
- **`development-workflow.ipynb`**: Workflow de desenvolupament interactiu
- **`mcp_client.py`**: Client Python per a connectar-se al servidor MCP
- **`requirements.txt`**: Dependències Python incloent l'SDK oficial de MCP

## 🔧 **Eines MCP Disponibles**

Els notebooks poden accedir a totes les eines del servidor MCP Salesforce:

- **SOQL Queries**: `executeSoqlQuery`
- **DML Operations**: `dmlOperation`
- **Object Description**: `describeObject`
- **Code Coverage**: `getApexClassCodeCoverage`
- **Debug Logs**: `apexDebugLogs`
- **I moltes més...**

## 💡 **Exemple d'ús en un Notebook**

```python
from mcp_client import create_mcp_client

# Crear client i connectar
client = await create_mcp_client()

# Cridar una eina real
result = await client.call_tool('executeSoqlQuery', {
    'query': 'SELECT Id, Name FROM Account LIMIT 5'
})

# Processar resultats reals
print(f"Registres trobats: {len(result.structuredContent)}")

# Desconnectar
await client.disconnect()
```

## 🎉 **Avantatges**

- ✅ **Connexió real** al servidor MCP
- ✅ **No més mocks** - tot funciona de veritat
- ✅ **Gestió d'errors** robusta
- ✅ **Integració nativa** amb Jupyter
- ✅ **Reutilitzable** en altres contexts Python

## 🚨 **Requisits**

- Python 3.8+
- Servidor MCP Salesforce funcionant
- SDK oficial de MCP Python instal·lat
- Entorn virtual configurat

## 🔍 **Troubleshooting**

Si tens problemes de connexió:

1. **Verifica que el servidor MCP està funcionant**
2. **Comprova que l'SDK està instal·lat**: `pip list | grep mcp`
3. **Prova la connexió directa**: `python3 mcp_client.py`
4. **Revisa els logs del servidor MCP**

Els notebooks ara són **eines professionals** per al desenvolupament amb MCP! 🚀
