"""
Test específic per veure què retorna la tool getOrgAndUserDetails
"""

import asyncio
import json
from native_mcp_client import NativeMCPClient


async def test_org_and_user_details():
    """Test per veure el contingut complet de getOrgAndUserDetails."""
    print("🧪 Test de getOrgAndUserDetails - Contingut complet\n")

    client = NativeMCPClient()

    try:
        # Connectar
        print("🔌 Connectant al servidor...")
        success = await client.connect()

        if not success:
            print("❌ No s'ha pogut connectar")
            return False

        # Cridar getOrgAndUserDetails
        print("\n🔧 Cridant getOrgAndUserDetails...")
        result = await client.call_tool(
            "getOrgAndUserDetails", {"random_string": "test"}
        )

        if not result.get("isError"):
            print("✅ Tool executada correctament!")
            print("\n" + "=" * 60)
            print("📊 CONTINGUT COMPLET DE LA RESPOSTA:")
            print("=" * 60)

            # Mostrar la resposta completa
            for i, content in enumerate(result.get("content", [])):
                print(f"\n🔸 Content {i+1}:")

                if "text" in content:
                    text_content = content["text"]
                    print(f"   Tipus: TEXT")
                    print(f"   Longitud: {len(text_content)} caràcters")

                    # Intentar parsejar com JSON
                    try:
                        data = json.loads(text_content)
                        print(f"   Format: JSON vàlid")
                        print(
                            f"   Claus principals: {list(data.keys()) if isinstance(data, dict) else 'No és dict'}"
                        )

                        # Mostrar la estructura JSON formatada
                        print("\n📋 JSON FORMATAT:")
                        print("-" * 40)
                        print(json.dumps(data, indent=2, ensure_ascii=False))
                        print("-" * 40)

                        # Analitzar contingut específic
                        if isinstance(data, dict):
                            print("\n🔍 ANÀLISI DETALLAT:")

                            if "orgDetails" in data:
                                org = data["orgDetails"]
                                print(f"📊 Organització:")
                                print(f"   - Nom: {org.get('Name', 'N/A')}")
                                print(f"   - ID: {org.get('Id', 'N/A')}")
                                print(f"   - URL: {org.get('InstanceUrl', 'N/A')}")
                                print(
                                    f"   - Tipus: {org.get('OrganizationType', 'N/A')}"
                                )
                                print(f"   - Edició: {org.get('Edition', 'N/A')}")
                                print(f"   - País: {org.get('Country', 'N/A')}")
                                print(
                                    f"   - Idioma: {org.get('LanguageLocaleKey', 'N/A')}"
                                )

                                # Mostrar totes les claus disponibles
                                print(f"   - Totes les claus: {list(org.keys())}")

                            if "userDetails" in data:
                                user = data["userDetails"]
                                print(f"\n👤 Usuari:")
                                print(f"   - Nom: {user.get('Name', 'N/A')}")
                                print(f"   - ID: {user.get('Id', 'N/A')}")
                                print(f"   - Username: {user.get('Username', 'N/A')}")
                                print(f"   - Email: {user.get('Email', 'N/A')}")
                                print(
                                    f"   - Perfil: {user.get('Profile', {}).get('Name', 'N/A')}"
                                )
                                print(f"   - Actiu: {user.get('IsActive', 'N/A')}")
                                print(
                                    f"   - Idioma: {user.get('LanguageLocaleKey', 'N/A')}"
                                )

                                # Mostrar totes les claus disponibles
                                print(f"   - Totes les claus: {list(user.keys())}")

                    except json.JSONDecodeError:
                        print(f"   Format: TEXT pla (no JSON)")
                        print(f"   Contingut: {text_content}")

                elif "type" in content:
                    print(f"   Tipus: {content['type']}")
                    print(f"   Contingut: {content}")

                else:
                    print(f"   Tipus: Desconegut")
                    print(f"   Contingut complet: {content}")

            print("\n" + "=" * 60)
            return True
        else:
            print("❌ Error en la tool")
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
    asyncio.run(test_org_and_user_details())
