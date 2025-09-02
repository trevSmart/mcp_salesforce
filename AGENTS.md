# El login a la org de Salesforce via Salesforce CLI el pots fer obtenint el access_token així:

2. Instala Salesforce CLI amb npm:

```
npm install -g @salesforce/cli
```

1. Fes aquesta request POST:

```
curl -v -X POST "https://test.salesforce.com/services/oauth2/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password&client_id=3MVG96MLzwkgoRznOeS464zHp_vAzQreoRiXMD4cPtI8NIBf12iFF7wtw1Kuh5uD27NBvVYbDlnRMPOmMl.lP&client_secret=D541294765A7E849F47098E3DC9E7238C35D765126F8D6C6D1E134A87335DB16&username=u0190347@cc-caixabank.com.devservice&password=trompeta5o7uZnnhiJxJoxEfCfonlyPSM"
```

2. Guardant l'access_token obtingut a la variable d'entorn SF_ACCESS_TOKEN.

3. Tot segiut aquesta comanda de Salesforce CLI thauria de donar accés a la Org:

```
sf org login access-token --instance-url https://caixabankcc--devservice.sandbox.my.salesforce.com
```
Exemple:
```
marcpla@MacBook Pro Marc mcp_salesforce % sf org login access-token --instance-url https://caixabankcc--devservice.sandbox.my.salesforce.com
? Access token of user to use for authentication
Successfully authorized u0190347@cc-caixabank.com.devservice with org ID 00DKN0000000yy52AA
marcpla@MacBook Pro Marc mcp_salesforce %
```