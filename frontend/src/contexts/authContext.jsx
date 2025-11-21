/* eslint-disable react-refresh/only-export-components */
/* eslint-disable no-unused-vars */
import React, {createContext, useContext, useState, useEffect} from "react";
import api from "../lib/api";

const AuthContext = createContext();

function AuthProvider({children}){
    const [token, setToken] = useState(localStorage.getItem("token"));
    const [user, setUser] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem("user"));
        } catch (error) {
            return null;
        }
    });
    useEffect(() => {
        if(token){
            localStorage.setItem("token", token);
        } else {
            localStorage.removeItem("token");
        }
    }, [token]);

    useEffect(() => {
        if(user){
            localStorage.setItem("user", JSON.stringify(user));
        } else {
            localStorage.removeItem("user");
        }
    }, [user]);

    async function login(credentials) {
        const res = await api.post("/api/auth/login", credentials)
        if(res.data && res.data.token){
            setToken(res.data.token);
            setUser(res.data.user);
        }
        return res;
    }

    async function register(payload) {
        const res = await api.post("/api/auth/register", payload)
        if (res.data && res.data.token){
            setToken(res.data.token);
            setUser(res.data.user);
        }
        return res;
    }
    function logout(){
        setToken(null);
        setUser(null);
        localStorage.removeItem("token");
        localStorage.removeItem("user");
    }
    return (
        <AuthContext.Provider value={{token, user, login, register, logout}}>
            {children}
        </AuthContext.Provider>
    )
}

function useAuth(){
    return useContext(AuthContext);
}

export {AuthProvider, useAuth};
