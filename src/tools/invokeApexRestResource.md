# Invoke Apex REST Resource Tool

Allows you to invoke REST endpoints published via Apex REST Resources in Salesforce.

## Agent Instructions
- **MANDATORY**: When invoking Apex REST Resources in Salesforce, you MUST use this tool exclusively. NEVER attempt to achieve the same functionality through alternative methods such as direct Salesforce CLI or curl commands, anonymous Apex execution, or any other approach. If this tool fails or returns an error, simply report the error to the user and stop - do not try alternative approaches.

- The tool automatically deduces the endpoint URL based on the Apex REST Resource class name and the operation type.

- The tool uses the current access token from the state to authenticate the request.

- Always show the complete request details and response in a structured format.

## Usage

### Parameters
- **`apexRestResource`** (required): The Apex REST Resource class name (e.g., "CSBD_WS_AltaOportunidad")
- **`operation`** (required): The HTTP operation to perform ("GET", "POST", "PUT", "PATCH", "DELETE")
- **`body`** (optional): The request body for POST/PUT/PATCH operations (JSON string or object)
- **`urlParams`** (optional): URL parameters to append to the endpoint (object)
- **`headers`** (optional): Additional headers to include in the request (object)

### Example 1: POST request to create an opportunity
```json
{
  "apexRestResource": "CSBD_WS_AltaOportunidad",
  "operation": "POST",
  "body": {
    "nombre": "Nueva Oportunidad",
    "valor": 50000,
    "fechaCierre": "2024-12-31"
  }
}
```

### Example 2: GET request with URL parameters
```json
{
  "apexRestResource": "CSBD_WS_GetOportunidad",
  "operation": "GET",
  "urlParams": {
    "id": "006XXXXXXXXXXXXXXX"
  }
}
```

### Example 3: PUT request with custom headers
```json
{
  "apexRestResource": "CSBD_WS_UpdateOportunidad",
  "operation": "PUT",
  "body": {
    "id": "006XXXXXXXXXXXXXXX",
    "valor": 75000
  },
  "headers": {
    "X-Custom-Header": "custom-value"
  }
}
```

## Response Format
The tool returns a structured response with:
- **`endpoint`**: The constructed endpoint URL
- **`request`**: Details of the request sent (method, headers, body)
- **`response`**: The response from the Salesforce REST API
- **`status`**: HTTP status code
- **`success`**: Boolean indicating if the request was successful

## Error Handling
- Validates that the Apex REST Resource class name is provided
- Validates that a valid HTTP operation is specified
- Handles authentication errors and automatically refreshes tokens if needed
- Provides detailed error messages for debugging

## Notes
- The tool automatically constructs the endpoint URL using the format `/apexrest/{className}`
- The tool uses the current Salesforce session access token for authentication
- All requests are made to the current org's instance URL
