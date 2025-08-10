# Metadata API Request

Allows you to retrieve Salesforce metadata using force:source:retrieve.

---
## Agent Instructions
- Pass the metadata type (metadataType) and, if needed, the targetUsername.
- Show the result of the retrieval (success, error, retrieved files).

---
## Usage

### Example 1: Retrieve Apex classes
```json
{
  "metadataType": "ApexClass"
}
```

### Example 2: Retrieve flows from a specific org
```json
{
  "metadataType": "Flow",
  "targetUsername": "devOrgAlias"
}
```