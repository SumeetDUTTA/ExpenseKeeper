import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";

import { useAuth } from "../contexts/authContext";

export default function DiscordCallback() {
  const [searchParams] = useSearchParams();
  const nav = useNavigate();
  const { setToken, setUser } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const token = searchParams.get("token");
    const userStr = searchParams.get("user");
    const error = searchParams.get("error");
    const provider = searchParams.get("provider");

    if (error) {
      if (error === 'no_code') {
        toast.error("No authorization code received from Discord.");
      } else if (error === 'missing_data') {
        toast.error("Discord did not provide required information.");
      } else if (error === 'wrong_provider') {
        toast.error(`This email is registered with ${provider}. Please use that to log in.`);
      } else if (error === 'auth_failed') {
        toast.error("Discord authentication failed. Please try again.");
      } else {
        toast.error("Authentication failed.");
      }
      nav("/login");
      return;
    }

    if (!token || !userStr) {
      toast.error("Authentication failed. Missing credentials.");
      nav("/login");
      return;
    }

    try {
      const user = JSON.parse(decodeURIComponent(userStr));
      setToken(token);
      setUser(user);
      toast.success("Logged in with Discord successfully!");
      nav("/dashboard", { replace: true });
    } catch (err) {
      console.error("Failed to parse user data:", err);
      toast.error("Authentication failed. Invalid user data.");
      nav("/login", { replace: true });
    }
  }, [nav, setToken, setUser, searchParams]);

  return (
    <div>
      <p>Logging you in with Discord...</p>
    </div>
  )
}