import {getOrgAndUserDetails} from '../salesforceServices/getOrgAndUserDetails.js';

export default async function getOrgAndUserDetailsTool() {
	return await getOrgAndUserDetails();
}