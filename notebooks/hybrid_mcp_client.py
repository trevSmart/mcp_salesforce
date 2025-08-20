"""
Client MCP híbrid que combina les millors pràctiques del template oficial
amb la implementació nativa que funciona.

Ús:
    python3 hybrid_mcp_client.py
"""

import asyncio
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Dict, Any, Optional, List


class HybridMCPClient:
    """
    Client MCP híbrid que segueix les millors pràctiques del template oficial
    però utilitza implementació JSON-RPC nativa per evitar problemes de l'SDK.
    """

    def __init__(self, server_path: str = "../index.js"):
        """
        Inicialitzar el client MCP.

        Args:
            server_path: Ruta al servidor MCP (index.js)
        """
        self.server_path = Path(server_path).resolve()
        self.process: Optional[subprocess.Popen] = None
        self.initialized = False
        self.tools = {}
        self.request_id = 0

        # Informació del servidor (com al template oficial)
        self.server_info = {}
        self.protocol_version = None
        self.capabilities = {}

    def _next_request_id(self) -> int:
        """Generar següent ID de petició."""
        self.request_id += 1
        return self.request_id

    async def _send_message(
        self, method: str, params: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Enviar missatge JSON-RPC al servidor."""
        if not self.process:
            raise RuntimeError("Servidor no iniciat")

        message = {"jsonrpc": "2.0", "id": self._next_request_id(), "method": method}

        if params:
            message["params"] = params

        message_str = json.dumps(message) + "\n"

        # Enviar missatge
        self.process.stdin.write(message_str.encode())
        self.process.stdin.flush()

        # Llegir resposta
        response_line = self.process.stdout.readline().decode().strip()

        if not response_line:
            raise RuntimeError("No s'ha rebut resposta del servidor")

        try:
            return json.loads(response_line)
        except json.JSONDecodeError as e:
            raise RuntimeError(f"Resposta JSON invàlida: {response_line}") from e

    async def _send_notification(self, method: str, params: Dict[str, Any] = None):
        """Enviar notificació (sense resposta esperada)."""
        if not self.process:
            raise RuntimeError("Servidor no iniciat")

        message = {"jsonrpc": "2.0", "method": method}

        if params:
            message["params"] = params

        message_str = json.dumps(message) + "\n"

        # Enviar notificació
        self.process.stdin.write(message_str.encode())
        self.process.stdin.flush()

    async def initialize(self) -> bool:
        """
        Inicialitzar la connexió amb el servidor MCP.
        Segueix el patró del template oficial.
        """
        try:
            print(f"🔌 Iniciant servidor MCP: {self.server_path}")

            # Verificar que el servidor existeix
            if not self.server_path.exists():
                raise FileNotFoundError(f"Servidor no trobat: {self.server_path}")

            # Iniciar procés del servidor
            self.process = subprocess.Popen(
                ["node", str(self.server_path)],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=False,  # Usem bytes per evitar problemes d'encoding
                bufsize=0,  # Sense buffer
                env=os.environ.copy(),  # Preservar variables d'entorn
            )

            print("🔄 Inicialitzant connexió MCP...")

            # Enviar initialize request (com al template oficial)
            init_response = await self._send_message(
                "initialize",
                {
                    "protocolVersion": "2025-06-18",
                    "capabilities": {"sampling": {}, "elicitation": {}},
                    "clientInfo": {
                        "name": "Hybrid MCP Python Client",
                        "version": "1.0.0",
                    },
                },
            )

            if "error" in init_response:
                raise RuntimeError(f"Error d'inicialització: {init_response['error']}")

            result = init_response.get("result", {})

            # Emmagatzemar informació del servidor
            self.server_info = result.get("serverInfo", {})
            self.protocol_version = result.get("protocolVersion", "Unknown")
            self.capabilities = result.get("capabilities", {})

            print(
                f"✅ Servidor inicialitzat: {self.server_info.get('name', 'Unknown')} v{self.server_info.get('version', 'Unknown')}"
            )
            print(f"   Protocol version: {self.protocol_version}")

            # Log server capabilities (com al template oficial)
            if self.capabilities:
                print("   Server capabilities:")
                for key, value in self.capabilities.items():
                    print(f"     - {key}: {value}")

            # Enviar notificació initialized (essencial pel protocol MCP)
            print("🔔 Enviant notificació initialized...")
            await self._send_notification("notifications/initialized")
            print("✅ Notificació initialized enviada")

            self.initialized = True
            return True

        except Exception as e:
            print(f"❌ Error inicialitzant: {e}")
            if self.process:
                self.process.terminate()
                self.process = None
            return False

    async def list_tools(self) -> List[Dict[str, Any]]:
        """Llistar eines disponibles (com al template oficial)."""
        if not self.initialized:
            raise RuntimeError("Client no inicialitzat")

        try:
            print("🔧 Llistant eines disponibles...")
            response = await self._send_message("tools/list")

            if "error" in response:
                raise RuntimeError(f"Error llistant eines: {response['error']}")

            tools = response.get("result", {}).get("tools", [])

            print(f"✅ Trobades {len(tools)} eines:")
            for tool in tools:
                tool_name = tool.get("name", "Unknown")
                tool_desc = tool.get("description", "Sense descripció")
                # Mostrar només la primera línia de la descripció
                first_line = (
                    tool_desc.split("\n")[0] if tool_desc else "Sense descripció"
                )
                print(f"  - {tool_name}: {first_line[:80]}...")
                self.tools[tool_name] = tool

            return tools

        except Exception as e:
            print(f"❌ Error llistant eines: {e}")
            return []

    async def call_tool(
        self, tool_name: str, arguments: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Cridar una eina (com al template oficial)."""
        if not self.initialized:
            raise RuntimeError("Client no inicialitzat")

        if tool_name not in self.tools:
            # Intentar llistar eines primer
            await self.list_tools()
            if tool_name not in self.tools:
                raise RuntimeError(f"Eina '{tool_name}' no trobada")

        try:
            print(f"🔄 Cridant eina: {tool_name}")
            if arguments:
                print(f"   Arguments: {json.dumps(arguments, indent=2)}")

            response = await self._send_message(
                "tools/call", {"name": tool_name, "arguments": arguments or {}}
            )

            if "error" in response:
                raise RuntimeError(f"Error en l'eina: {response['error']}")

            result = response.get("result", {})

            if result.get("isError"):
                print(f"❌ Error en l'eina {tool_name}")
                for content in result.get("content", []):
                    if "text" in content:
                        print(f"   {content['text']}")
            else:
                print(f"✅ Eina {tool_name} executada correctament")

            return result

        except Exception as e:
            print(f"❌ Error cridant l'eina {tool_name}: {e}")
            raise

    async def disconnect(self):
        """Desconnectar del servidor (neteja com al template oficial)."""
        try:
            if self.process:
                print("🔌 Desconnectant del servidor...")
                self.process.terminate()
                self.process.wait(timeout=5)
                self.process = None
                print("✅ Desconnectat")
        except Exception as e:
            print(f"⚠️  Error durant desconnexió: {e}")
        finally:
            self.initialized = False
            self.tools = {}
            self.server_info = {}

    async def run_comprehensive_test(self):
        """
        Executar test complet seguint l'estructura del template oficial.
        """
        print("🚀 Client MCP híbrid - Test complet\n")

        try:
            # Inicialitzar connexió
            success = await self.initialize()
            if not success:
                print("❌ No s'ha pogut inicialitzar")
                return False

            # Llistar eines (equivalent a list_tools al template)
            tools = await self.list_tools()
            if not tools:
                print("⚠️  No s'han trobat eines")
                return False

            # Provar eines específiques
            print("\n🧪 Provant eines...")

            # Test 1: getOrgAndUserDetails
            print("\n📊 Test 1: getOrgAndUserDetails")
            try:
                result = await self.call_tool(
                    "getOrgAndUserDetails", {"random_string": "test"}
                )

                if not result.get("isError") and result.get("content"):
                    for content in result.get("content", []):
                        if "text" in content and content["text"]:
                            try:
                                data = json.loads(content["text"])
                                if isinstance(data, dict):
                                    if "orgDetails" in data:
                                        org = data["orgDetails"]
                                        print(
                                            f"   🏢 Organització: {org.get('Name', 'N/A')}"
                                        )
                                        print(
                                            f"   🌐 URL: {org.get('InstanceUrl', 'N/A')}"
                                        )
                                    if "userDetails" in data:
                                        user = data["userDetails"]
                                        print(
                                            f"   👤 Usuari: {user.get('Name', 'N/A')}"
                                        )
                            except:
                                print(f"   📄 Resposta: {content['text'][:100]}...")
                else:
                    print("   ⚠️  Resposta buida o amb error")
            except Exception as e:
                print(f"   ❌ Error: {e}")

            # Test 2: executeSoqlQuery
            print("\n📊 Test 2: executeSoqlQuery")
            try:
                result = await self.call_tool(
                    "executeSoqlQuery",
                    {"query": "SELECT Id, Name FROM Organization LIMIT 1"},
                )

                if not result.get("isError") and result.get("content"):
                    for content in result.get("content", []):
                        if "text" in content and content["text"]:
                            try:
                                data = json.loads(content["text"])
                                if isinstance(data, dict) and "records" in data:
                                    records = data["records"]
                                    print(f"   📊 Registres trobats: {len(records)}")
                                    if records:
                                        org = records[0]
                                        print(
                                            f"   🏢 Nom organització: {org.get('Name', 'N/A')}"
                                        )
                            except:
                                print(
                                    f"   📄 Resposta SOQL: {content['text'][:100]}..."
                                )
                else:
                    print("   ⚠️  Consulta SOQL sense resultats")
            except Exception as e:
                print(f"   ❌ Error SOQL: {e}")

            print("\n✅ Test híbrid completat amb èxit!")
            return True

        except Exception as e:
            print(f"❌ Error en el test: {e}")
            return False

        finally:
            await self.disconnect()


async def main():
    """Punt d'entrada principal (com al template oficial)."""
    client = HybridMCPClient()
    success = await client.run_comprehensive_test()

    if success:
        print("\n🎉 Client MCP híbrid funciona perfectament!")
    else:
        print("\n💥 Hi ha hagut problemes amb el client")


def run_client():
    """Entry point per al script del client."""
    asyncio.run(main())


if __name__ == "__main__":
    run_client()
