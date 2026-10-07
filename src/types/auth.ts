export type UserRole = 'Admin' | 'Engineer' | 'Operator' | 'Supervisor';

export interface User {
  username: string;
  name: string;
  role: UserRole;
  employeeId?: string;
  lastLogin?: string;
}

export interface AuthContextType {
  user: User | null;
  currentUser: User | null;
  isAuthenticated: boolean;
  login: (username: string, role: UserRole, customName?: string) => Promise<boolean>;
  logout: () => void;
}
