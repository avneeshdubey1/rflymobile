import { apiFetch } from './apiClient';

export async function getFarmers() {

    const response = await apiFetch('/api/forms/sync');

    return response.json();
}
