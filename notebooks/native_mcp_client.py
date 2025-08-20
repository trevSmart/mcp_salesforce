"""
Client MCP natiu que implementa el protocol directament.
Basat en la lògica del testClient.js però en Python.
"""

import asyncio
import json
import subprocess
import sys
from pathlib import Path
from typing import Dict, Any, Optional, List


class NativeMCPClient:
    """
    Client MCP natiu que parla JSON-RPC directament amb el servidor.
    Evita els problemes de l'SDK oficial.
    """

    def __init__(self, server_path: str = "../index.js"):
        self.server_path = Path(server_path).resolve()
        self.process: Optional[subprocess.Popen] = None
        self.initialized = False
        self.tools = {}
        self.request_id = 0

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

    async def connect(self) -> bool:
        """Connectar al servidor MCP."""
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
            )

            print("🔄 Inicialitzant connexió MCP...")

            # Enviar initialize request
            init_response = await self._send_message(
                "initialize",
                {
                    "protocolVersion": "2025-06-18",
                    "capabilities": {"sampling": {}, "elicitation": {}},
                    "clientInfo": {
                        "name": "Native MCP Python Client",
                        "version": "1.0.0",
                    },
                },
            )

            if "error" in init_response:
                raise RuntimeError(f"Error d'inicialització: {init_response['error']}")

            result = init_response.get("result", {})
            server_info = result.get("serverInfo", {})

            print(
                f"✅ Servidor inicialitzat: {server_info.get('name', 'Unknown')} v{server_info.get('version', 'Unknown')}"
            )
            print(f"   Protocol version: {result.get('protocolVersion', 'Unknown')}")

            # Enviar notificació initialized
            print("🔔 Enviant notificació initialized...")
            await self._send_notification("notifications/initialized")
            print("✅ Notificació initialized enviada")

            self.initialized = True
            return True

        except Exception as e:
            print(f"❌ Error connectant al servidor: {e}")
            if self.process:
                self.process.terminate()
                self.process = None
            return False

    async def list_tools(self) -> List[Dict[str, Any]]:
        """Llistar eines disponibles."""
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
                print(f"  - {tool_name}: {tool_desc}")
                self.tools[tool_name] = tool

            return tools

        except Exception as e:
            print(f"❌ Error llistant eines: {e}")
            return []

    async def call_tool(
        self, tool_name: str, arguments: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Cridar una eina."""
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
        """Desconnectar del servidor."""
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


# Funcions d'utilitat
async def test_native_connection():
    """Test de connexió amb el client natiu."""
    print("🚀 Test de connexió MCP natiu\n")

    client = NativeMCPClient()

    try:
        # Connectar
        success = await client.connect()

        if not success:
            print("❌ No s'ha pogut connectar")
            return False

        # Llistar eines
        tools = await client.list_tools()

        if not tools:
            print("⚠️  No s'han trobat eines")
            return False

        # Provar eina
        print("\n🧪 Provant getOrgAndUserDetails...")
        result = await client.call_tool(
            "getOrgAndUserDetails", {"random_string": "test"}
        )

        if not result.get("isError"):
            print("✅ Test exitós!")

            # Mostrar informació de l'org
            for content in result.get("content", []):
                if "text" in content:
                    try:
                        data = json.loads(content["text"])
                        if "orgDetails" in data:
                            org = data["orgDetails"]
                            print(f"🏢 Organització: {org.get('Name', 'N/A')}")
                            print(f"🌐 URL: {org.get('InstanceUrl', 'N/A')}")
                            print(
                                f"👤 Usuari: {data.get('userDetails', {}).get('Name', 'N/A')}"
                            )
                    except:
                        print(f"📄 Resposta: {content['text'][:200]}...")

            return True
        else:
            print("❌ Error en l'eina")
            return False

    except Exception as e:
        print(f"❌ Error en el test: {e}")
        return False

    finally:
        await client.disconnect()


if __name__ == "__main__":
    asyncio.run(test_native_connection())
