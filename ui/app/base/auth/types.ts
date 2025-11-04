export interface User {
  id: string;
  identifier: string;
  email?: string;
}

export interface AuthContextType {
  login: (
    params: any,
  ) => Promise<{ redirectTo?: string | boolean } | void | any>;
  logout: (params: any) => Promise<void | false | string>;
  loading?: boolean;
  user?: User | null;
  [key: string]: any;
}
