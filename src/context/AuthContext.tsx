/* Hallmark · context: AuthContext · genre: modern-minimal · register: industrial-workbench
 * standards: ISA-95 Level 3 MOM · Security Clearance & Role Matrix
 * contrast: WCAG AA Pass
 */

import React, { createContext, useContext, useState } from 'react';
import { User, UserRole, AuthContextType } from '../types/auth';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Always default to null on app launch: Bypassing login on startup is strictly prohibited
  const [user, setUser] = useState<User | null>(null);

  const login = async (username: string, role: UserRole, customName?: string): Promise<boolean> => {
    // Simulate industrial auth token handshake delay
    await new Promise((resolve) => setTimeout(resolve, 300));

    const trimmedUser = username.trim().toLowerCase();

    // Standardized Employee ID & Display Name mapping
    let empId = 'EMP-6583';
    let displayName = customName;

    if (trimmedUser === 'admin') {
      empId = 'EMP-6583';
      displayName = displayName || 'System Administrator';
    } else if (trimmedUser === 'eng_tranduc' || trimmedUser === 'engineer_lead' || trimmedUser.includes('engineer')) {
      empId = 'EMP-3042';
      displayName = displayName || 'Trần Đức (Lead Process Architect)';
    } else if (trimmedUser === 'qa_supervisor_01' || trimmedUser === 'supervisor_01' || trimmedUser.includes('supervisor')) {
      empId = 'EMP-2088';
      displayName = displayName || 'QA Lead Inspector';
    } else if (trimmedUser === 'operator_01' || trimmedUser.includes('operator')) {
      empId = 'EMP-1024';
      displayName = displayName || 'Shift 1 Line Operator';
    } else {
      switch (role) {
        case 'Admin':
          empId = 'EMP-6583';
          displayName = displayName || 'System Administrator';
          break;
        case 'Engineer':
          empId = 'EMP-3042';
          displayName = displayName || 'Controls & Automation Engineer';
          break;
        case 'Supervisor':
          empId = 'EMP-2088';
          displayName = displayName || 'Shift Production Supervisor';
          break;
        case 'Operator':
          empId = 'EMP-1024';
          displayName = displayName || 'Line 01 Lead Operator';
          break;
      }
    }

    const newUser: User = {
      username: username.trim(),
      name: displayName || 'Authenticated Operator',
      role,
      employeeId: empId,
      lastLogin: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };

    setUser(newUser);
    return true;
  };

  const logout = () => {
    setUser(null);
    try {
      localStorage.removeItem('mes_auth_session');
      sessionStorage.clear();
    } catch {
      // ignore
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        currentUser: user,
        isAuthenticated: !!user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
