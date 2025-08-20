"""
Client MCP simplificat per a evitar problemes de shutdown.
Versió mínima per a testing en notebooks.
"""

import asyncio
import json
from pathlib import Path
from typing import Dict, Any, Optional

try:
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client
    from mcp.types import Implementation
except ImportError:
    print("❌ Error: L'SDK de MCP no està instal·lat.")
    print("Executa: pip install 'mcp[cli]'")
    exit(1)


class SimpleMCPClient:
    """
    Client MCP simplificat que evita problemes de shutdown.
    """

    def __init__(self, server_path: str = "../index.js"):
        self.server_path = Path(server_path).resolve()
        self.session = None
        self.tools = []

    async def connect_and_test(self):
        """
        Connecta, prova una eina i retorna el resultat.
        No fa cleanup explícit per evitar errors.
        """
        try:
            print(f"🔌 Connectant al servidor: {self.server_path}")

            # Paràmetres del servidor
            server_params = StdioServerParameters(
                command="node", args=[str(self.server_path)]
            )

            # Connectar
            read, write = await stdio_client(server_params).__aenter__()

            # Crear sessió amb client info
            client_info = Implementation(
                name="Simple MCP Python Client", version="1.0.0"
            )

            self.session = ClientSession(read, write, client_info=client_info)
            await self.session.__aenter__()

            print("🔄 Inicialitzant...")
            init_result = await self.session.initialize()

            print(f"✅ Connectat: {init_result.serverInfo.name}")

            # Enviar notificació initialized
            await self.session.send_notification("notifications/initialized", {})
            print("✅ Notificació enviada")

            # Llistar eines
            tools_result = await self.session.list_tools()
            self.tools = tools_result.tools
            print(f"🔧 {len(self.tools)} eines disponibles")

            # Provar una eina
            print("\n🧪 Provant getOrgAndUserDetails...")
            result = await self.session.call_tool(
                "getOrgAndUserDetails", {"random_string": "test"}
            )

            if not result.isError:
                print("✅ Eina executada correctament!")
                for content in result.content:
                    if hasattr(content, "text"):
                        data = content.text
                        print(f"📊 Dades rebudes: {len(data)} caràcters")
                        # Mostrar primer fragment
                        try:
                            parsed = json.loads(data)
                            if "orgDetails" in parsed:
                                org = parsed["orgDetails"]
                                print(f"🏢 Org: {org.get('Name', 'N/A')}")
                                print(f"🌐 URL: {org.get('InstanceUrl', 'N/A')}")
                        except:
                            print(f"📄 Text: {data[:100]}...")

                return True
            else:
                print("❌ Error en l'eina")
                return False

        except Exception as e:
            print(f"❌ Error: {e}")
            return False

        # NO fem cleanup explícit - deixem que el sistema ho netegi


async def test_mcp_connection():
    """Test ràpid de connexió MCP."""
    print("🚀 Test de connexió MCP simplificat\n")

    client = SimpleMCPClient()
    success = await client.connect_and_test()

    print(f"\n{'✅ Test exitós!' if success else '❌ Test fallit'}")
    return success


if __name__ == "__main__":
    asyncio.run(test_mcp_connection())
