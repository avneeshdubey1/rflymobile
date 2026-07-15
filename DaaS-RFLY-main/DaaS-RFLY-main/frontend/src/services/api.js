const API = "http://localhost:5000";

export async function getFarmers() {

    const response = await fetch(`${API}/api/forms/sync`);

    return response.json();
}