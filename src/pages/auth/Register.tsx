import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

export default function Register() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ref = searchParams.get("ref");

  useEffect(() => {
    // Redirect to auth page, preserving referral code
    const redirectUrl = ref ? `/auth?ref=${ref}` : "/auth";
    navigate(redirectUrl, { replace: true });
  }, [navigate, ref]);

  return null;
}
