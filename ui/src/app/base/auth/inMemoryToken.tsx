import { jwtDecode } from "jwt-decode";

const inMemoryJWTManager = () => {
  let inMemoryJWT: string | null = null;

  const getToken = () => inMemoryJWT;

  const setToken = (token: string) => {
    inMemoryJWT = token;
    return true;
  };

  const getDecodedToken = () => {
    if (!inMemoryJWT) return null;
    return jwtDecode(inMemoryJWT);
  };

  const ereaseToken = () => {
    inMemoryJWT = null;
    return true;
  };

  return {
    ereaseToken,
    getToken,
    setToken,
    getDecodedToken,
  };
};

export default inMemoryJWTManager();
