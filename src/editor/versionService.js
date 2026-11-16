import {businessCall} from '../business/api';
export async function publishSnapshot(model,expectedRevision){return businessCall('publishWebsiteSnapshot',{model,expectedRevision});}
export async function websiteVersions(){return businessCall('listWebsiteVersions');}
export async function loadWebsiteDraft(){return businessCall('loadWebsiteDraft');}
export async function loadWebsiteRecord(){return businessCall('loadWebsiteRecord');}
export async function loadPublicationDiagnostic(){return businessCall('publicationDiagnostic');}
export async function saveWebsiteDraft(model,expectedRevision){return businessCall('saveWebsiteDraft',{model,expectedRevision});}
export async function unpublishWebsite(){return businessCall('unpublishWebsite');}
