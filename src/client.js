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

	//El suport del client per les següents característiques no es s'inclou a les capabilities
	//que declara el client. Per tant, les deduim de la resta de informació que ens proporcion.
	supportsCapability(capabilityName) {
		switch (capabilityName) {
			case 'resources':
				return this.isVsCode;

			case 'embeddedResources':
				return this.isVsCode;

			case 'resourceLinks':
				return this.isVsCode && semver.gte(this.clientInfo.version, '1.103.0');

			default:
				return Boolean(this.capabilities?.[capabilityName]);
		}
	}
}

let client = new Client();
export default client;