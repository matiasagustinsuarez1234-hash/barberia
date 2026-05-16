import { createContext, useContext, useEffect, useState } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('jwt_token') || '');
  const [userType, setUserType] = useState(localStorage.getItem('user_type') || '');
  const [role, setRole] = useState(localStorage.getItem('user_role') || '');
  const [shopName, setShopName] = useState(localStorage.getItem('shop_name') || '');

  useEffect(() => {
    if (token) localStorage.setItem('jwt_token', token);
    else localStorage.removeItem('jwt_token');
  }, [token]);

  useEffect(() => {
    if (userType) localStorage.setItem('user_type', userType);
    else localStorage.removeItem('user_type');
  }, [userType]);

  useEffect(() => {
    if (role) localStorage.setItem('user_role', role);
    else localStorage.removeItem('user_role');
  }, [role]);

  useEffect(() => {
    if (shopName) localStorage.setItem('shop_name', shopName);
    else localStorage.removeItem('shop_name');
  }, [shopName]);

  const logout = () => {
    setToken('');
    setUserType('');
    setRole('');
    setShopName('');
  };

  return (
    <AuthContext.Provider value={{ token, setToken, userType, setUserType, role, setRole, shopName, setShopName, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
