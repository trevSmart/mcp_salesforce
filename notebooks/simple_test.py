"""
Test simple del client MCP per a verificar la connexió.
"""

import asyncio
from mcp_client import MCPClient


async def simple_test():
    """Test simple de connexió sense problemes de shutdown."""
    print("🧪 Test simple de connexió MCP")

    try:
        # Crear client
        client = MCPClient("../index.js")

        # Connectar
        success = await client.connect()

        if success:
            print("✅ Test completat amb èxit!")

            # Provar una eina simple
            print("\n🔧 Provant eina getOrgAndUserDetails...")
            result = await client.call_tool(
                "getOrgAndUserDetails", {"random_string": "test"}
            )

            if not result.isError:
                print("✅ Eina executada correctament!")
                for content in result.content:
                    if hasattr(content, "text"):
                        data = content.text
                        print(f"📊 Resposta: {data[:200]}...")
            else:
                print("❌ Error en l'eina")
        else:
            print("❌ No s'ha pogut connectar")

    except Exception as e:
        print(f"❌ Error en el test: {e}")

    finally:
        try:
            if "client" in locals() and client.session:
                await client.disconnect()
        except:
            pass  # Ignorar errors de desconnexió


if __name__ == "__main__":
    asyncio.run(simple_test())
