"""
Client MCP per a Python utilitzant l'SDK oficial.
Permet connectar-se al servidor MCP Salesforce i cridar les eines.
"""

import asyncio
import json
import subprocess
import sys
from pathlib import Path
from typing import Dict, Any, Optional, List

# Importar l'SDK oficial de MCP
try:
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client
    from mcp.types import CallToolResult, Implementation
except ImportError:
    print("❌ Error: L'SDK de MCP no està instal·lat.")
    print("Executa: pip install 'mcp[cli]'")
    sys.exit(1)


class MCPClient:
    """
    Client per a connectar-se al servidor MCP Salesforce.
    Utilitza l'SDK oficial de MCP per a Python.
    """

    def __init__(self, server_path: str = "../index.js", project_root: str = ".."):
        """
        Inicialitzar el client MCP.

        Args:
            server_path: Ruta al servidor MCP (index.js)
            project_root: Directori arrel del projecte
        """
        self.server_path = Path(server_path).resolve()
        self.project_root = Path(project_root).resolve()
        self.server_params = StdioServerParameters(
            command="node", args=[str(self.server_path)]
        )
        self.session: Optional[ClientSession] = None
        self.read = None
        self.write = None
        self.initialized = False
        self.tools: List[Dict[str, Any]] = []

    async def connect(self) -> bool:
        """
        Conectar al servidor MCP.

        Returns:
            True si la connexió és exitosa, False altrament
        """
        try:
            print(f"🔌 Connectant al servidor MCP: {self.server_path}")

            # Verificar que el servidor existeix
            if not self.server_path.exists():
                raise FileNotFoundError(f"Servidor no trobat: {self.server_path}")

            # Conectar al servidor
            self.read, self.write = await stdio_client(self.server_params).__aenter__()

            # Crear la sessió amb client_info (negociació inicial)
            client_info = Implementation(
                name="IBM Salesforce MCP Python Client", version="1.0.0"
            )

            self.session = ClientSession(self.read, self.write, client_info=client_info)
            await self.session.__aenter__()

            # Inicialitzar la connexió (sense arguments)
            print("🔄 Inicialitzant connexió MCP...")
            init_result = await self.session.initialize()

            print(
                f"✅ Servidor inicialitzat: {init_result.serverInfo.name} v{init_result.serverInfo.version}"
            )
            print(f"   Protocol version: {init_result.protocolVersion}")

            # Log server capabilities for debugging
            if init_result.capabilities:
                print("   Server capabilities:")
                for key, value in init_result.capabilities.items():
                    print(f"     - {key}: {value}")

            # Send initialized notification to indicate client is ready
            print("🔔 Enviant notificació initialized...")
            await self.session.send_notification("notifications/initialized", {})
            print("✅ Notificació initialized enviada")

            # Llistar les eines disponibles
            await self.list_tools()

            self.initialized = True
            return True

        except Exception as e:
            print(f"❌ Error connectant al servidor: {e}")
            return False

    async def list_tools(self) -> List[Dict[str, Any]]:
        """
        Llistar les eines disponibles al servidor.

        Returns:
            Llista d'eines disponibles
        """
        if not self.session:
            raise RuntimeError("No hi ha connexió activa")

        try:
            tools_result = await self.session.list_tools()
            self.tools = tools_result.tools

            print(f"🔧 Eines disponibles ({len(self.tools)}):")
            for tool in self.tools:
                print(f"  - {tool.name}: {tool.description or 'Sense descripció'}")

            return self.tools

        except Exception as e:
            print(f"❌ Error llistant eines: {e}")
            return []

    async def call_tool(
        self, tool_name: str, arguments: Dict[str, Any]
    ) -> CallToolResult:
        """
        Cridar una eina del servidor MCP.

        Args:
            tool_name: Nom de l'eina a cridar
            arguments: Arguments per a l'eina

        Returns:
            Resultat de l'eina
        """
        if not self.session:
            raise RuntimeError("No hi ha connexió activa")

        if not self.initialized:
            raise RuntimeError("El servidor no està inicialitzat")

        try:
            print(f"🔄 Cridant eina: {tool_name}")
            print(f"   Arguments: {json.dumps(arguments, indent=2)}")

            result = await self.session.call_tool(tool_name, arguments)

            if result.isError:
                print(f"❌ Error en l'eina {tool_name}:")
                for content in result.content:
                    if hasattr(content, "text"):
                        print(f"   {content.text}")
            else:
                print(f"✅ Eina {tool_name} executada correctament")

            return result

        except Exception as e:
            print(f"❌ Error cridant l'eina {tool_name}: {e}")
            raise

    async def disconnect(self):
        """Desconnectar del servidor MCP."""
        try:
            if self.session:
                await self.session.__aexit__(None, None, None)
                self.session = None

            if self.read and self.write:
                await stdio_client(self.server_params).__aexit__(None, None, None)
                self.read = None
                self.write = None

            self.initialized = False
            print("🔌 Desconnectat del servidor MCP")

        except Exception as e:
            print(f"❌ Error desconnectant: {e}")

    def __enter__(self):
        """Context manager entry."""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        if self.initialized:
            asyncio.run(self.disconnect())


# Funcions d'utilitat per a usar en notebooks
async def create_mcp_client(server_path: str = "../index.js") -> MCPClient:
    """
    Crear i connectar un client MCP.

    Args:
        server_path: Ruta al servidor MCP

    Returns:
        Client MCP connectat
    """
    client = MCPClient(server_path)
    success = await client.connect()

    if not success:
        raise RuntimeError("No s'ha pogut connectar al servidor MCP")

    return client


async def test_connection():
    """Prova bàsica de connexió al servidor MCP."""
    try:
        client = await create_mcp_client()
        print("✅ Connexió MCP establerta correctament")

        # Prova bàsica: obtenir detalls de l'org
        result = await client.call_tool(
            "getOrgAndUserDetails", {"random_string": "test"}
        )
        print("✅ Eina getOrgAndUserDetails executada")

        await client.disconnect()
        return True

    except Exception as e:
        print(f"❌ Error en la prova de connexió: {e}")
        return False


# Exemple d'ús
if __name__ == "__main__":

    async def main():
        client = await create_mcp_client()
        try:
            # Llistar eines
            tools = await client.list_tools()
            print(f"Eines disponibles: {len(tools)}")

            # Prova d'eina
            result = await client.call_tool(
                "getOrgAndUserDetails", {"random_string": "test"}
            )
            print("Resultat:", result)

        finally:
            await client.disconnect()

    asyncio.run(main())
