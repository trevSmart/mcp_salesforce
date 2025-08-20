"""
Test específic per provar la tool apexDebugLogs amb action="list"
"""

import asyncio
from native_mcp_client import NativeMCPClient


async def test_apex_debug_logs():
    """Test específic de l'eina apexDebugLogs."""
    print("🧪 Test de l'eina apexDebugLogs\n")

    client = NativeMCPClient()

    try:
        # Connectar
        print("🔌 Connectant al servidor...")
        success = await client.connect()

        if not success:
            print("❌ No s'ha pogut connectar")
            return False

        # Provar apexDebugLogs amb action="list"
        print("\n🔧 Provant apexDebugLogs amb action='list'...")
        result = await client.call_tool("apexDebugLogs", {"action": "list"})

        if not result.get("isError"):
            print("✅ Eina apexDebugLogs executada correctament!")

            # Mostrar el contingut de la resposta
            for content in result.get("content", []):
                if "text" in content:
                    print(f"📊 Resposta rebuda:")
                    print(f"   Longitud: {len(content['text'])} caràcters")

                    # Intentar parsejar JSON si és possible
                    try:
                        import json

                        data = json.loads(content["text"])
                        print(
                            f"   Estructura JSON: {list(data.keys()) if isinstance(data, dict) else type(data)}"
                        )

                        # Mostrar primer fragment del contingut
                        print(f"   Primer fragment: {str(data)[:300]}...")

                    except json.JSONDecodeError:
                        # Si no és JSON, mostrar com a text
                        print(f"   Contingut text: {content['text'][:300]}...")

            return True
        else:
            print("❌ Error en l'eina apexDebugLogs")
            for content in result.get("content", []):
                if "text" in content:
                    print(f"   Error: {content['text']}")
            return False

    except Exception as e:
        print(f"❌ Error en el test: {e}")
        return False

    finally:
        await client.disconnect()


if __name__ == "__main__":
    asyncio.run(test_apex_debug_logs())
