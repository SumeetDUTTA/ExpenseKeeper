import axios from "axios";

const BASE = import.meta.env.VITE_API_TARGET || "http://localhost:5000"

const api = axios.create({
    baseURL: BASE,
    withCredentials: true,
    headers: {
    "Content-Type": "application/json",
  },
    timeout: 30000,
});

api.interceptors.request.use((config) => {
    try {
        const token = localStorage.getItem("token");
        if (token) {
            config.headers = config.headers || {};
            config.headers.Authorization = `Bearer ${token}`;
        }
    } catch (error) {
        console.error("Error attaching token to request:", error);
    }
    return config;
})

export default api;
