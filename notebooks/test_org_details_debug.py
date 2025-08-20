"""
Test de debug per veure EXACTAMENT què retorna getOrgAndUserDetails
"""

import asyncio
import json
from native_mcp_client import NativeMCPClient


async def debug_org_details():
    """Debug detallat de getOrgAndUserDetails."""
    print("🐛 Debug de getOrgAndUserDetails\n")

    client = NativeMCPClient()

    try:
        # Connectar
        success = await client.connect()
        if not success:
            return False

        # Cridar getOrgAndUserDetails
        print("🔧 Cridant getOrgAndUserDetails...")
        result = await client.call_tool(
            "getOrgAndUserDetails", {"random_string": "test"}
        )

        print(f"\n🔍 RESPOSTA RAW COMPLETA:")
        print(f"{'='*60}")
        print(json.dumps(result, indent=2, ensure_ascii=False))
        print(f"{'='*60}")

        # Analitzar cada part
        print(f"\n📋 ANÀLISI DETALLAT:")
        print(f"- isError: {result.get('isError')}")
        print(f"- Claus disponibles: {list(result.keys())}")

        content_list = result.get("content", [])
        print(f"- Nombre d'elements content: {len(content_list)}")

        if content_list:
            for i, content in enumerate(content_list):
                print(f"\n  📄 Content {i+1}:")
                print(f"    - Tipus: {type(content)}")
                print(
                    f"    - Claus: {list(content.keys()) if isinstance(content, dict) else 'No dict'}"
                )

                if isinstance(content, dict):
                    for key, value in content.items():
                        print(f"    - {key}: {type(value)} - {len(str(value))} chars")
                        if key == "text" and value:
                            print(f"      Contingut text: {value[:200]}...")
        else:
            print("  ⚠️  Content està buit!")

        return True

    except Exception as e:
        print(f"❌ Error: {e}")
        return False

    finally:
        await client.disconnect()


if __name__ == "__main__":
    asyncio.run(debug_org_details())
