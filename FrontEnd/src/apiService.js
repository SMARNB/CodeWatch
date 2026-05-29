/**
 * API Service Utility
 * 
 * Sets up a global interceptor for all fetch requests to automatically
 * handle 401 Unauthorized responses by clearing the session and redirecting.
 */

export const setupFetchInterceptor = () => {
  const originalFetch = window.fetch;

  window.fetch = async (...args) => {
    try {
      const response = await originalFetch(...args);
      
      // Handle session expiry
      if (response.status === 401) {
        // We only want to handle this if the user is already logged in, 
        // to avoid infinite loops on the login page itself if login fails with 401.
        // However, standard login typically returns 401 for bad credentials.
        // So we only redirect if it's NOT a login request.
        
        const url = args[0] instanceof Request ? args[0].url : args[0];
        const isLoginRequest = url && (typeof url === 'string') && url.includes('/api/login');
        
        if (!isLoginRequest) {
          alert("Session expired, please log in again");
          localStorage.clear();
          window.location.href = '/login';
          throw new Error('Session expired');
        }
      }
      
      return response;
    } catch (error) {
      throw error;
    }
  };
};
