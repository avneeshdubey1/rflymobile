const ROLE_HOME = Object.freeze({
  admin: '/admin',
  sales: '/marketing',
  'fleet-manager': '/fleet-manager',
  pilot: '/pilot',
  farmer: '/farmer/dashboard',
  business: '/business/dashboard',
});

export function homeForRole(role) {
  return ROLE_HOME[String(role || '').toLowerCase()] || '/';
}
export function loginForPath(pathname) {
  if (String(pathname || '').startsWith('/farmer/')) return '/farmer/login';
  if (String(pathname || '').startsWith('/business/')) return '/business/login';
  return '/login';
}
