# GET Requests with Body Support

## Overview

This implementation adds support for sending GET requests with a body, which is not standard HTTP but is required by some servers. Since the `fetch` API doesn't support body in GET requests, we use `curl` as a fallback for this specific case.

## Implementation Details

### When curl is used

The system automatically detects when a GET request includes a body and switches to using `curl` instead of `fetch`:

```javascript
// Special case: GET requests with body need to use curl instead of fetch
if (requestOptions.method === 'GET' && body) {
    logger.debug(`Using curl for GET request with body to ${endpoint}`);
    return await makeCurlRequest(endpoint, requestOptions);
}
```

### curl Command Construction

The `makeCurlRequest` function builds a curl command with the following features:

- **Silent mode**: `-s` for quiet operation
- **HTTP status code**: `-w "HTTPSTATUS:%{http_code}"` to capture the status
- **Method**: `-X GET` to explicitly set GET method
- **Headers**: All headers from the request are added with `-H`
- **Body**: Request body is added with `-d`

### Response Handling

The curl response is parsed to extract:
1. HTTP status code from the `HTTPSTATUS:` prefix
2. Response body (everything after the status)
3. Error handling for `INVALID_SESSION_ID` and other errors
4. JSON parsing with fallback to text

### Error Handling

The implementation maintains consistency with the existing error handling:
- Detects `INVALID_SESSION_ID` errors for token refresh
- Provides detailed error messages
- Maintains the same retry logic as fetch requests

## Usage

This functionality is transparent to the user. When calling `callSalesforceApi` with a GET request that includes a body:

```javascript
const response = await callSalesforceApi('GET', 'APEX', 'endpoint', {data: 'value'});
```

The system will automatically:
1. Detect the GET + body combination
2. Switch to curl implementation
3. Return the same response format as fetch requests

## Logging

The implementation includes debug logging to track when curl is used:

```
Using curl for GET request with body to https://example.com/endpoint
Executing curl command: curl -s -w "HTTPSTATUS:%{http_code}" -X GET "https://example.com/endpoint" -H "Authorization: Bearer token" -H "Content-Type: application/json" -d '{"data":"value"}'
```

## Compatibility

- **Backward compatible**: Existing GET requests without body continue to use fetch
- **Transparent**: No changes needed in calling code
- **Consistent**: Same response format and error handling as fetch requests
