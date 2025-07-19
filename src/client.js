
class Client {

	clientInfo;

	capabilities;

	protocolVersion;

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

	get isVscode() {
		return this.clientInfo?.name?.toLowerCase().includes('visual studio code');
	}

	//El suport del client per les següents característiques no es s'inclou a les capabilities
	//que declara el client. Per tant, les deduim de la resta de informació que ens proporcion.
	supportsCapability(capabilityName) {
		switch (capabilityName) {
			case 'embeddedResources':
				return this.clientInfo.isVscode;

			case 'resourceLinks':
				return false;

			default:
				return capabilityName in this.capabilities;
		}
	}
}

let client = new Client();
export default client;