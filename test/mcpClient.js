class MockMcpClient {
  constructor() {
    this.tools = [
      {name: 'salesforceMcpUtils', description: 'utils', parameters: {}},
      {name: 'executeAnonymousApex', description: 'execute code', parameters: {}},
      {name: 'describeObject', description: 'describe sObject', parameters: {}},
      {name: 'apexDebugLogs', description: 'debug logs', parameters: {}},
      {name: 'dmlOperation', description: 'dml', parameters: {}},
      {name: 'executeSoqlQuery', description: 'soql', parameters: {}},
      {name: 'runApexTest', description: 'run tests', parameters: {}},
      {name: 'deployMetadata', description: 'deploy', parameters: {}},
      {name: 'getSetupAuditTrail', description: 'audit trail', parameters: {}},
      {name: 'getRecord', description: 'get record', parameters: {}},
      {name: 'getRecentlyViewedRecords', description: 'recent', parameters: {}},
      {name: 'invokeApexRestResource', description: 'invoke apex rest', parameters: {}},
      {name: 'apex-run-script', description: 'prompt', parameters: {}}
    ];
    this.resources = [
      {
        uri: 'mcp://initial/dummy.txt',
        name: 'Initial Resource',
        description: 'Initial resource',
        mimeType: 'text/plain',
        text: 'initial content'
      }
    ];
    this.debugLogs = [{Id: '07L1', logContent: 'log'}];
  }

  async listTools() {
    return this.tools;
  }

  async listResources() {
    return this.resources.map(({text, ...rest}) => rest);
  }

  async readResource(uri) {
    const res = this.resources.find(r => r.uri === uri);
    return {contents: [{uri, text: res ? res.text : ''}]};
  }

  async callTool(name, params = {}) {
    switch (name) {
      case 'salesforceMcpUtils':
        return this.#handleUtils(params);
      case 'apexDebugLogs':
        return this.#handleDebugLogs(params);
      case 'describeObject':
        return this.#handleDescribe(params);
      case 'dmlOperation':
        return {structuredContent: {outcome: 'success'}};
      case 'executeSoqlQuery':
        return this.#handleSoql(params);
      case 'executeAnonymousApex':
        return this.#handleExecuteAnonymous(params);
      case 'runApexTest':
        return this.#handleRunApexTest(params);
      case 'getSetupAuditTrail':
        return this.#handleSetupAuditTrail(params);
      case 'getRecord':
        return this.#handleGetRecord(params);
      case 'getRecentlyViewedRecords':
        return {structuredContent: {records: [{Id: '001'}], totalSize: 1}};
      case 'invokeApexRestResource':
        return this.#handleInvokeApex(params);
      case 'deployMetadata':
        return {structuredContent: {status: 'validated'}};
      case 'createMetadata':
        return this.#handleCreateMetadata(params);
      case 'getApexClassCodeCoverage':
        return this.#handleCodeCoverage(params);
      case 'apex-run-script':
        return {
          messages: [
            {role: 'assistant', content: [{type: 'text', text: 'Generated script'}]}
          ]
        };
      default:
        return {};
    }
  }

  async disconnect() {}

  #handleUtils(params) {
    switch (params.action) {
      case 'getOrgAndUserDetails':
        return {structuredContent: {user: {id: '005'}}};
      case 'getState':
        return {structuredContent: {state: {org: {user: {id: '005'}}}}};
      case 'loadRecordPrefixesResource': {
        const resource = {
          uri: 'mcp://record-prefixes',
          name: 'record prefixes',
          description: 'Record prefixes',
          mimeType: 'application/json',
          text: '{}'
        };
        this.resources.push(resource);
        return {
          content: [{type: 'resource_link', uri: resource.uri}],
          structuredContent: {loaded: true}
        };
      }
      case 'getCurrentDatetime':
        return {
          structuredContent: {
            now: new Date().toISOString(),
            timezone: 'UTC'
          }
        };
      case 'clearCache':
        return {structuredContent: {status: 'success', action: 'clearCache'}};
      case 'reportIssue':
        return {structuredContent: {success: true, issueId: 'ISSUE-1'}};
      default:
        return {};
    }
  }

  #handleDebugLogs(params) {
    const action = params.action;
    if (action === 'status') {
      return {structuredContent: {status: 'off'}};
    }
    if (action === 'on' || action === 'off') {
      return {content: [{type: 'text', text: `${action} ok`}]} ;
    }
    if (action === 'list') {
      return {structuredContent: {logs: this.debugLogs}};
    }
    if (action === 'get') {
      return {structuredContent: {logContent: 'log'}};
    }
    return {};
  }

  #handleDescribe(params) {
    const {sObjectName, includeFields} = params;
    if (sObjectName === 'NonExistentObject__c') {
      return {isError: true, content: [{type: 'text', text: 'Error: object not found'}]};
    }
    const fields = includeFields === false ? [] : [{name: 'Id'}, {name: 'Name'}];
    const sc = {name: sObjectName, fields};
    if (includeFields === false) sc.wasCached = true;
    return {structuredContent: sc};
  }

  #handleSoql(params) {
    const q = params.query?.toLowerCase() || '';
    if (q.includes('bad')) {
      return {isError: true, content: [{type: 'text', text: 'Invalid query'}]};
    }
    if (q.includes('nonexistentaccount') || q.includes('nonexistentapexclass')) {
      return {structuredContent: {records: []}};
    }
    if (q.includes('apexclass')) {
      return {structuredContent: {records: [{Id: '01p', Name: 'TestClass'}]}};
    }
    return {structuredContent: {records: [{Id: '001', Name: 'Acme'}]}};
  }

  #handleRunApexTest(params) {
    if (params.classNames?.length) {
      return {
        structuredContent: {
          result: [
            {className: params.classNames[0], methodName: 'testMethod', status: 'Pass'}
          ]
        }
      };
    }
    if (params.methodNames?.length) {
      return {isError: true, content: [{type: 'text', text: 'Method not found'}]};
    }
    return {};
  }

  #handleSetupAuditTrail(params) {
    return {
      structuredContent: {
        filters: {lastDays: params.lastDays, user: params.user},
        setupAuditTrailFileTotalRecords: 1,
        records: [{Action: 'Login'}]
      }
    };
  }

  #handleGetRecord(params) {
    if (params.sObjectName === 'NonExistentObject__c') {
      return {isError: true, content: [{type: 'text', text: 'error'}]};
    }
    return {structuredContent: {sObject: params.sObjectName, fields: {Id: params.recordId}}};
  }

  #handleInvokeApex(params) {
    return {
      structuredContent: {
        endpoint: `/services/apexrest/${params.apexClassOrRestResourceName}`,
        request: {method: params.operation},
        responseBody: {success: true},
        status: 200
      }
    };
  }

  #handleCodeCoverage(params) {
    return {
      structuredContent: {
        classes: [{className: params.classNames?.[0] || 'Test', percentage: 75}]
      }
    };
  }

  #handleCreateMetadata(params) {
    const sc = {success: true};
    if (params.type === 'apexClass') {
      sc.files = ['classes/' + params.name + '.cls'];
    }
    return {structuredContent: sc};
  }

  #handleExecuteAnonymous(params) {
    return {
      structuredContent: {
        success: true,
        logs: "Hello from MCP tool test"
      }
    };
  }
}

export async function createMcpClient() {
  return new MockMcpClient();
}

export async function disconnectMcpClient(client) {
  await client?.disconnect?.();
}

export async function listTools(client) {
  return client.listTools();
}

