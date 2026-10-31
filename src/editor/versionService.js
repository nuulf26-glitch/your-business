import {businessCall} from '../business/api';
export async function publishSnapshot(model){return (await businessCall('publishWebsiteSnapshot',{model})).slug;}
export async function websiteVersions(){return businessCall('listWebsiteVersions');}
export async function loadWebsiteDraft(){return businessCall('loadWebsiteDraft');}
export async function loadWebsiteRecord(){return businessCall('loadWebsiteRecord');}
export async function saveWebsiteDraft(model){return businessCall('saveWebsiteDraft',{model});}
export async function unpublishWebsite(){return businessCall('unpublishWebsite');}
