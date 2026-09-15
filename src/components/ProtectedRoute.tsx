import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, loading, profileLoading } = useAuth();
  const location = useLocation();

  if (loading || (session && profileLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF7F2]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#FF5436] border-t-transparent" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  // All authenticated users are granted access to protected routes immediately
  return <>{children}</>;
};

export default ProtectedRoute;
