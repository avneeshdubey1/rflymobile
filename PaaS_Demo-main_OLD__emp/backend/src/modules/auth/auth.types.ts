export interface AuthTokenPayload {
  userId: string;
  role: string;
  name: string;
  phone: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    name: string;
    phone: string;
    role: string;
  };
}
