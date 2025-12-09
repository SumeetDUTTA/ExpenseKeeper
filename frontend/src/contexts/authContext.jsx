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
            const res = await api.post("/api/auth/login", credentials);
            if (res.data && res.data.token && res.data.user) {
                setToken(res.data.token);
                setUser(res.data.user);
                toast.success("Logged in successfully!");
            } else {
                toast.error("Login failed: Invalid response from server.");
            }
            return res;
        } catch (error) {
            if (error.response) {
                const errorMessage = error.response.data?.message || error.message;
                toast.error(`Login failed: ${errorMessage}`);
            } else {
                toast.error(`Login failed: ${error.message}`);
            }
            throw error;
        }
    }

    async function register(payload) {
        try {
            const res = await api.post("/api/auth/register", payload);
            if (res.data && res.data.token && res.data.user) {
                setToken(res.data.token);
                setUser(res.data.user);
                toast.success("Account created successfully!");
            } else {
                toast.error("Registration failed: Invalid response from server.");
            }
            return res;
        } catch (error) {
            if (error.response) {
                const errorMessage = error.response.data?.message || error.message;
                toast.error(`Registration failed: ${errorMessage}`);
            } else {
                toast.error(`Registration failed: ${error.message}`);
            }
            throw error;
        }
    }

    async function loginWithGoogle(idToken) {
        try {
            const res = await api.post("/api/auth/google", { idToken });
            if (res.data?.token) {
                setToken(res.data.token);
                setUser(res.data.user);
                toast.success("Logged in with Google successfully!");
                return res;
            } else {
                throw new Error("No token in Google login response");
            }
        } catch (error) {
            const errorMsg = error.response?.data?.message || error.message;
            toast.error(`Google Login failed: ${errorMsg}`);
        }
    }

    async function loginWithDiscord(code) {
        try {
            const res = await api.post("/api/auth/discord", { code });
            console.log("Discord login response:", res.data);
            if (res.data?.token && res.data?.user) {
                setToken(res.data.token);
                setUser(res.data.user);
                toast.success("Logged in with Discord successfully!");
                return res;
            } else {
                console.error("Invalid Discord login response:", res.data);
                throw new Error("No token or user in Discord login response");
            }
        } catch (error) {
            const errorMsg = error.response?.data?.message || error.message;
            toast.error(`Discord Login failed: ${errorMsg}`);
        }
    }

    async function updateProfile(updates) {
        try {
            const res = await api.patch("/api/user/profile", updates);
            if (res.data?.user) {
                setUser(res.data.user);
                toast.success("Profile updated successfully!");
            }
            return res;
        } catch (error) {
            const msg = error.response?.data?.message || error.message;
            toast.error(`Profile update failed: ${msg}`);
            throw error;
        }
    }

    function logout() {
        setToken(null);
        setUser(null);
        localStorage.removeItem("token");
        localStorage.removeItem("user");
    }
    return (
        <AuthContext.Provider value={{
            token, user, login, register, updateProfile, loginWithGoogle, loginWithDiscord, logout, setToken, setUser
        }}>
            {children}
        </AuthContext.Provider>
    )
}

function useAuth() {
    return useContext(AuthContext);
}

export { AuthProvider, useAuth };
