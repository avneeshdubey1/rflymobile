import type { DaasApi } from './contracts';
import { HttpDaasApi } from './httpDaasApi';

export * from './contracts';
export { HttpDaasApi } from './httpDaasApi';

export const daasApi: DaasApi = new HttpDaasApi();
