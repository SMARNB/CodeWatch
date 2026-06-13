/**
 * API Service Utility
 * 
 * Sets up a global interceptor for all fetch requests to automatically
 * handle 401 Unauthorized responses by clearing the session and redirecting.
 */

export const setupFetchInterceptor = () => {
  const originalFetch = window.fetch;

  window.fetch = async (input, init = {}) => {
    const url = input instanceof Request ? input.url : String(input || '');
    const isApi = url.includes('/api/');
    const isLoginRequest = url.includes('/api/login');
    try {
      // Attach the API token to our backend (/api) calls so the server can authenticate the user.
      // The login request is exempt (there's no token yet).
      const token = localStorage.getItem('authToken');
      if (token && isApi && !isLoginRequest) {
        const headers = new Headers((input instanceof Request ? input.headers : init.headers) || {});
        if (!headers.has('Authorization')) headers.set('Authorization', `Token ${token}`);
        if (input instanceof Request) {
          input = new Request(input, { headers });
        } else {
          init = { ...init, headers };
        }
      }

      const response = await originalFetch(input, init);

      // 401 = missing/expired/revoked token → force re-login (but not on the login request itself,
      // which returns 400/401 for bad credentials and is handled by the login page).
      if (response.status === 401 && !isLoginRequest) {
        window.dispatchEvent(new CustomEvent('sessionExpired', { detail: "Session expired, please log in again" }));
        localStorage.clear();
        window.location.href = '/login';
        throw new Error('Session expired');
      }

      return response;
    } catch (error) {
      throw error;
    }
  };
};
