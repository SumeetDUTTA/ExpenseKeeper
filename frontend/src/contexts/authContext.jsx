/* eslint-disable react-refresh/only-export-components */
/* eslint-disable no-unused-vars */
import React, { createContext, useContext, useState, useEffect } from "react";
import toast from "react-hot-toast";

import api from "../lib/api";

const AuthContext = createContext();

function AuthProvider({ children }) {
    const [token, setToken] = useState(localStorage.getItem("token"));
    const [user, setUser] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem("user"));
        } catch (error) {
            return null;
        }
    });
    useEffect(() => {
        if (token) {
            localStorage.setItem("token", token);
        } else {
            localStorage.removeItem("token");
        }
    }, [token]);

    useEffect(() => {
        if (user) {
            localStorage.setItem("user", JSON.stringify(user));
        } else {
            localStorage.removeItem("user");
        }
    }, [user]);

    async function login(credentials) {
        try {
            console.log('🔥 Attempting login with credentials:', credentials);
            const res = await api.post("/api/auth/login", credentials)
            console.log('🔥 Login response:', res);
            if (res.data && res.data.token) {
                setToken(res.data.token);
                setUser(res.data.user);
            } else {
                console.error('🔥 Login failed: No token in response', res);
                toast.error('Login failed: Invalid response from server.');
            }
            return res;
        } catch (error) {
            console.error('🔥 Login error object:', error);
            if (error.response) {
                console.error('🔥 error.response.status', error.response.status);
                console.error('🔥 error.response.data', error.response.data);
                toast.error(`Login failed: ${error.response.data?.message ?? error.message}`);
            } else {
                toast.error(`Login failed: ${error.message}`);
            }
        }
    }

    async function register(payload) {
        try {
            const res = await api.post("/api/auth/register", payload)
            if (res.data && res.data.token) {
                setToken(res.data.token);
                setUser(res.data.user);
            }
            return res;
        } catch (error) {
            console.error('🔥 Register error object:', error);
            if (error.response) {
                console.error('🔥 error.response.status', error.response.status);
                console.error('🔥 error.response.data', error.response.data);
                toast.error(`Register failed: ${error.response.data?.message ?? error.message}`);
            } else {
                toast.error(`Register failed: ${error.message}`);
            }
        }

    }
    
    function logout() {
        setToken(null);
        setUser(null);
        localStorage.removeItem("token");
        localStorage.removeItem("user");
    }
    return (
        <AuthContext.Provider value={{ token, user, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    )
}

function useAuth() {
    return useContext(AuthContext);
}

export { AuthProvider, useAuth };
