import { API_URL as API } from '../config';

export async function getFarmers() {

    const response = await fetch(`${API}/api/forms/sync`);

    return response.json();
}
