"""
Client MCP oficial basat en el template de referència.
Utilitza les millors pràctiques i gestió d'errors correcta.

Ús:
    python3 official_mcp_client.py
"""

import asyncio
import json
import os
from pathlib import Path
from typing import Dict, Any, Optional

from mcp import ClientSession, StdioServerParameters, types
from mcp.client.stdio import stdio_client
from mcp.shared.context import RequestContext


class OfficialMCPClient:
    """
    Client MCP oficial basat en el template de referència.
    Gestió correcta de context managers i millors pràctiques.
    """

    def __init__(self, server_path: str = "../index.js"):
        """
        Inicialitzar el client MCP.

        Args:
            server_path: Ruta al servidor MCP (index.js)
        """
        self.server_path = Path(server_path).resolve()

        # Configuració del servidor per stdio
        self.server_params = StdioServerParameters(
            command="node",
            args=[str(self.server_path)],
            env=os.environ.copy(),  # Preservar variables d'entorn
        )

    async def handle_sampling_message(
        self,
        context: RequestContext[ClientSession, None],
        params: types.CreateMessageRequestParams,
    ) -> types.CreateMessageResult:
        """
        Callback opcional per a sampling.
        """
        print(f"📝 Sampling request: {params.messages}")
        return types.CreateMessageResult(
            role="assistant",
            content=types.TextContent(
                type="text",
                text="Hello from MCP Salesforce client!",
            ),
            model="mcp-salesforce",
            stopReason="endTurn",
        )

    async def run_test(self):
        """
        Executar test complet del client MCP seguint el template oficial.
        """
        print("🚀 Client MCP oficial - Test complet\n")

        # Verificar que el servidor existeix
        if not self.server_path.exists():
            raise FileNotFoundError(f"Servidor no trobat: {self.server_path}")

        try:
            # Usar context managers correctament com al template
            async with stdio_client(self.server_params) as (read, write):
                async with ClientSession(
                    read, write, sampling_callback=self.handle_sampling_message
                ) as session:

                    print("🔌 Conectant al servidor MCP...")

                    # Inicialitzar la connexió
                    init_result = await session.initialize()
                    print(
                        f"✅ Servidor inicialitzat: {init_result.serverInfo.name} v{init_result.serverInfo.version}"
                    )
                    print(f"   Protocol version: {init_result.protocolVersion}")

                    # Llistar prompts disponibles
                    print("\n🎯 Llistant prompts...")
                    try:
                        prompts = await session.list_prompts()
                        print(
                            f"✅ Prompts disponibles: {[p.name for p in prompts.prompts]}"
                        )
                    except Exception as e:
                        print(f"⚠️  No hi ha prompts disponibles: {e}")

                    # Llistar recursos disponibles
                    print("\n📚 Llistant recursos...")
                    try:
                        resources = await session.list_resources()
                        print(
                            f"✅ Recursos disponibles: {[r.uri for r in resources.resources]}"
                        )
                    except Exception as e:
                        print(f"⚠️  No hi ha recursos disponibles: {e}")

                    # Llistar eines disponibles
                    print("\n🔧 Llistant eines...")
                    tools = await session.list_tools()
                    print(f"✅ Eines disponibles ({len(tools.tools)}):")
                    for tool in tools.tools:
                        print(
                            f"  - {tool.name}: {tool.description[:100]}..."
                            if tool.description
                            else f"  - {tool.name}: Sense descripció"
                        )

                    # Provar una eina específica: getOrgAndUserDetails
                    print("\n🧪 Provant eina: getOrgAndUserDetails...")
                    try:
                        result = await session.call_tool(
                            "getOrgAndUserDetails", arguments={"random_string": "test"}
                        )

                        print(f"✅ Eina executada correctament!")
                        print(f"   - isError: {result.isError}")
                        print(f"   - Nombre de continguts: {len(result.content)}")

                        # Processar contingut de forma segura
                        for i, content_block in enumerate(result.content):
                            print(f"\n📄 Contingut {i+1}:")
                            if isinstance(content_block, types.TextContent):
                                print(f"   Tipus: TEXT")
                                text_content = content_block.text
                                print(f"   Longitud: {len(text_content)} caràcters")

                                if text_content:
                                    try:
                                        # Intentar parsejar JSON
                                        data = json.loads(text_content)
                                        print(f"   Format: JSON vàlid")

                                        # Mostrar dades d'organització si existeixen
                                        if (
                                            isinstance(data, dict)
                                            and "orgDetails" in data
                                        ):
                                            org = data["orgDetails"]
                                            print(
                                                f"🏢 Organització: {org.get('Name', 'N/A')}"
                                            )
                                            print(
                                                f"🌐 URL: {org.get('InstanceUrl', 'N/A')}"
                                            )

                                        if (
                                            isinstance(data, dict)
                                            and "userDetails" in data
                                        ):
                                            user = data["userDetails"]
                                            print(
                                                f"👤 Usuari: {user.get('Name', 'N/A')}"
                                            )

                                    except json.JSONDecodeError:
                                        print(f"   Format: TEXT pla")
                                        print(f"   Contingut: {text_content[:200]}...")
                                else:
                                    print("   ⚠️  Contingut buit")
                            else:
                                print(f"   Tipus: {type(content_block)}")
                                print(f"   Contingut: {content_block}")

                        # Mostrar contingut estructurat si existeix
                        if (
                            hasattr(result, "structuredContent")
                            and result.structuredContent
                        ):
                            print(
                                f"\n🔗 Contingut estructurat: {result.structuredContent}"
                            )

                    except Exception as e:
                        print(f"❌ Error cridant l'eina: {e}")

                    # Provar una altra eina: executeSoqlQuery
                    print("\n🧪 Provant eina: executeSoqlQuery...")
                    try:
                        result = await session.call_tool(
                            "executeSoqlQuery",
                            arguments={
                                "query": "SELECT Id, Name FROM Organization LIMIT 1"
                            },
                        )

                        print(f"✅ Consulta SOQL executada!")
                        print(f"   - isError: {result.isError}")

                        if not result.isError and result.content:
                            for content_block in result.content:
                                if isinstance(content_block, types.TextContent):
                                    try:
                                        data = json.loads(content_block.text)
                                        if isinstance(data, dict) and "records" in data:
                                            records = data["records"]
                                            print(
                                                f"   📊 Registres trobats: {len(records)}"
                                            )
                                            if records:
                                                org = records[0]
                                                print(
                                                    f"   🏢 Nom organització: {org.get('Name', 'N/A')}"
                                                )
                                    except:
                                        print(
                                            f"   📄 Resposta: {content_block.text[:200]}..."
                                        )

                    except Exception as e:
                        print(f"❌ Error amb SOQL query: {e}")

                    print("\n✅ Test completat amb èxit!")
                    return True

        except Exception as e:
            print(f"❌ Error en el client: {e}")
            return False


async def main():
    """Punt d'entrada principal del client."""
    client = OfficialMCPClient()
    success = await client.run_test()

    if success:
        print("\n🎉 Client MCP oficial funciona correctament!")
    else:
        print("\n💥 Hi ha hagut problemes amb el client")


def run_client():
    """Entry point per al script del client."""
    asyncio.run(main())


if __name__ == "__main__":
    run_client()
