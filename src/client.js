import semver from 'semver';

class Client {
	clientInfo;

	capabilities;

	protocolVersion;

	roots = {};

	constructor() {
		this.clientInfo = {name: 'unknown'};
		this.capabilities = {};
		this.protocolVersion = '';
	}

	initialize(params = {}) {
		this.clientInfo = params?.clientInfo || {name: 'unknown'};
		this.capabilities = params?.capabilities || {};
		this.protocolVersion = params?.protocolVersion || '';
	}

	get isVsCode() {
		return this.clientInfo?.name?.toLowerCase().includes('visual studio code');
	}

	// Client support for the following features is not included in the capabilities
	// declared by the client. Therefore, we deduce them from other information provided.
	supportsCapability(capabilityName) {
		switch (capabilityName) {
			case 'resources':
			case 'embeddedResources':
			case 'logging':
				return Boolean(this.capabilities?.logging) || this.isVsCode || this.clientInfo.name === 'IBM Salesforce MCP Test Client';

			case 'resource_links':
				return this.isVsCode && semver.gte(this.clientInfo.version, '1.103.0');

			default:
				return Boolean(this.capabilities?.[capabilityName]);
		}
	}
}

const client = new Client();
export default client;
