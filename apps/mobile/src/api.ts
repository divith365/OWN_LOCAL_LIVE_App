import { OwnlocalApiClient } from '@ownlocal/api-client';

// Points to live Cloudflare Worker by default (can be overridden via environment)
export const API_BASE_URL = 'https://ownlocal-live-api.mahati-mamatha.workers.dev';

export const apiClient = new OwnlocalApiClient({
  baseUrl: API_BASE_URL,
});
