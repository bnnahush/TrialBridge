import React, { createContext, useContext, useState, ReactNode, useCallback } from "react";

export interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info" | "warning";
}

interface AppContextType {
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;
  success: string | null;
  setSuccess: (success: string | null) => void;
  toasts: Toast[];
  addToast: (message: string, type: Toast["type"]) => void;
  removeToast: (id: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorState, setErrorState] = useState<string | null>(null);
  const [successState, setSuccessState] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message: string, type: Toast["type"]) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    
    // Auto remove after 4000ms (4 seconds auto-dismiss)
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  }, [removeToast]);

  const setError = useCallback((err: string | null) => {
    setErrorState(err);
    if (err) {
      addToast(err, "error");
    }
  }, [addToast]);

  const setSuccess = useCallback((succ: string | null) => {
    setSuccessState(succ);
    if (succ) {
      addToast(succ, "success");
    }
  }, [addToast]);

  return (
    <AppContext.Provider
      value={{
        isLoading,
        setIsLoading,
        error: errorState,
        setError,
        success: successState,
        setSuccess,
        toasts,
        addToast,
        removeToast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
};
