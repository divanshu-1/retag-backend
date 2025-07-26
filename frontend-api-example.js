// Example of how to update your frontend API calls

// ✅ CORRECT - Use environment variable
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

// Example API calls
const apiCalls = {
  // Authentication
  login: async (credentials) => {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(credentials)
    });
    return response.json();
  },

  // Google OAuth
  googleAuth: () => {
    window.location.href = `${API_URL}/auth/google`;
  },

  // Get products
  getProducts: async () => {
    const response = await fetch(`${API_URL}/sell/products`, {
      credentials: 'include'
    });
    return response.json();
  },

  // Upload product
  uploadProduct: async (formData) => {
    const response = await fetch(`${API_URL}/sell/upload`, {
      method: 'POST',
      credentials: 'include',
      body: formData // FormData for file uploads
    });
    return response.json();
  },

  // Create order
  createOrder: async (orderData) => {
    const response = await fetch(`${API_URL}/payments/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(orderData)
    });
    return response.json();
  },

  // Verify payment
  verifyPayment: async (paymentData) => {
    const response = await fetch(`${API_URL}/payments/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(paymentData)
    });
    return response.json();
  }
};

// ❌ WRONG - Don't hardcode URLs
// const response = await fetch('http://localhost:8080/api/products');
// const response = await fetch('https://hardcoded-url.com/api/products');

export default apiCalls;
