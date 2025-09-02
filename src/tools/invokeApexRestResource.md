# Invoke Apex REST Resource Tool

Allows you to invoke REST endpoints published via Apex REST Resources in Salesforce.

---
## Agent Instructions
- **MANDATORY**: When invoking Apex REST Resources in Salesforce, you MUST use this tool exclusively. NEVER attempt to achieve the same functionality through alternative methods such as direct Salesforce CLI or curl commands, anonymous Apex execution, or any other approach. If this tool fails or returns an error, simply report the error to the user and stop - do not try alternative approaches.

- The tool automatically deduces the endpoint URL based on the Apex REST Resource class name and the operation type.

- The tool uses the current access token from the state to authenticate the request.

- Always show the complete request details and response in a **structured** format.

---
## Usage

### Parameters
- **`apexClassOrRestResourceName`** (required): The Apex REST Resource class name or the name of its containing Apex class (e.g., "CSBD_WS_AltaOportunidad")
- **`operation`** (required): The HTTP operation to perform ("GET", "POST", "PUT", "PATCH", "DELETE")
- **`bodySerialized`** (optional): The request body for POST/PUT/PATCH operations as a JSON string
- **`bodyObject`** (optional): The request body for POST/PUT/PATCH operations as an object (will be serialized to JSON)
- **`urlParams`** (optional): URL parameters to append to the endpoint (object)
- **`headers`** (optional): Additional headers to include in the request (object)

### Request Body Options
You can provide the request body in two ways:
1. **`bodySerialized`**: A pre-serialized JSON string (useful when you already have JSON data)
2. **`bodyObject`**: A JavaScript object that will be automatically serialized to JSON

**Note**: Only one body parameter should be used at a time. If both are provided, `bodySerialized` takes precedence.

---
## Usage Examples

### Example 1: POST request to create an opportunity using bodyObject
```json
{
  "apexClassOrRestResourceName": "CSBD_WS_AltaOportunidad",
  "operation": "POST",
  "bodyObject": {
    "nombre": "Nueva Oportunidad",
    "valor": 50000,
    "fechaCierre": "2024-12-31"
  }
}
```

### Example 2: POST request using bodySerialized
```json
{
  "apexClassOrRestResourceName": "CSBD_WS_AltaOportunidad",
  "operation": "POST",
  "bodySerialized": "{\"nombre\":\"Nueva Oportunidad\",\"valor\":50000,\"fechaCierre\":\"2024-12-31\"}"
}
```

### Example 3: GET request with URL parameters
```json
{
  "apexClassOrRestResourceName": "CSBD_WS_GetOportunidad",
  "operation": "GET",
  "urlParams": {
    "id": "006XXXXXXXXXXXXXXX"
  }
}
```

### Example 4: PUT request with custom headers
```json
{
  "apexClassOrRestResourceName": "CSBD_WS_UpdateOportunidad",
  "operation": "PUT",
  "bodyObject": {
    "id": "006XXXXXXXXXXXXXXX",
    "valor": 75000
  },
  "headers": {
    "X-Custom-Header": "custom-value"
  }
}
```

### Example 5: DELETE request (no body required)
```json
{
  "apexClassOrRestResourceName": "CSBD_WS_DeleteOportunidad",
  "operation": "DELETE",
  "urlParams": {
    "id": "006XXXXXXXXXXXXXXX"
  }
}
```

---
## Response Format
The tool returns a structured response with:
- `endpoint`: The constructed endpoint URL
- `request`: Details of the request sent (method, headers, body)
- `response`: The response from the Salesforce REST API
- `status`: HTTP status code

Show the response in a **structured** format.