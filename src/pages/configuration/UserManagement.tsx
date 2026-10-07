/* Hallmark · component: UserManagement · genre: modern-minimal · register: industrial-workbench
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: WCAG AA Pass
 */

import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useReports } from '../../context/ReportContext';
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  RotateCcw, 
  Search, 
  Building2, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import { UserRole } from '../../types/auth';

export interface UserRegistryItem {
  userId: string;
  username: string;
  fullName: string;
  role: UserRole;
  securityClearance: string;
  assignedFacility: string;
  status: 'Active' | 'Suspended';
  lastAuditAction: string;
  createdAt: string;
}

const initialUsers: UserRegistryItem[] = [
  {
    userId: 'EMP-6583',
    username: 'admin',
    fullName: 'System Administrator',
    role: 'Admin',
    securityClearance: 'Level 4 · Full Access',
    assignedFacility: 'HCMUT Central Dairy Processing Plant',
    status: 'Active',
    lastAuditAction: 'System Security Master Key Rotation',
    createdAt: '2026-01-15',
  },
  {
    userId: 'EMP-3042',
    username: 'eng_tranduc',
    fullName: 'Trần Đức (Lead Process Architect)',
    role: 'Engineer',
    securityClearance: 'Level 3 · Engineering & Hardware',
    assignedFacility: 'Line 01 Physical S7-1500 & SIMIT Twin',
    status: 'Active',
    lastAuditAction: 'OPC UA Node Hierarchy Verification',
    createdAt: '2026-02-01',
  },
  {
    userId: 'EMP-2088',
    username: 'qa_supervisor_01',
    fullName: 'QA Lead Inspector',
    role: 'Supervisor',
    securityClearance: 'Level 2 · Batch QA Disposition',
    assignedFacility: 'Aseptic Milk Quality Assurance Lab',
    status: 'Active',
    lastAuditAction: 'EBR Lot Release Authorization',
    createdAt: '2026-03-10',
  },
  {
    userId: 'EMP-1024',
    username: 'operator_01',
    fullName: 'Shift 1 Line Operator',
    role: 'Operator',
    securityClearance: 'Level 1 · Line Execution Only',
    assignedFacility: 'Line 01 Mixing & UHT Pasteurizer Cell',
    status: 'Active',
    lastAuditAction: 'Batch WO-2026-001 Dispatched',
    createdAt: '2026-04-05',
  },
];

// RBAC Permission Definitions per Role
const ROLE_PERMISSIONS: Record<UserRole, {
  configureHardware: boolean;
  approveRecipes: boolean;
  dispatchBatches: boolean;
  ackAlarms: boolean;
  clearanceLevel: string;
}> = {
  Admin: {
    configureHardware: true,
    approveRecipes: true,
    dispatchBatches: true,
    ackAlarms: true,
    clearanceLevel: 'Level 4 · Full Access',
  },
  Engineer: {
    configureHardware: true,
    approveRecipes: false,
    dispatchBatches: false,
    ackAlarms: true,
    clearanceLevel: 'Level 3 · Engineering & Hardware',
  },
  Supervisor: {
    configureHardware: false,
    approveRecipes: true,
    dispatchBatches: true,
    ackAlarms: true,
    clearanceLevel: 'Level 2 · Batch QA Disposition',
  },
  Operator: {
    configureHardware: false,
    approveRecipes: false,
    dispatchBatches: true,
    ackAlarms: true,
    clearanceLevel: 'Level 1 · Line Execution Only',
  },
};

export const UserManagement: React.FC = () => {
  const { user } = useAuth();
  const { addAuditLog } = useReports();

  const [users, setUsers] = useState<UserRegistryItem[]>(initialUsers);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    userId: `EMP-${Math.floor(1000 + Math.random() * 9000)}`,
    fullName: '',
    username: '',
    initialPassword: '',
    role: 'Operator' as UserRole,
    assignedFacility: 'Line 01 Mixing & UHT Pasteurizer Cell',
  });

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  // Filtered Users List
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchRole = roleFilter === 'ALL' || u.role === roleFilter;
      const matchSearch = 
        u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.userId.toLowerCase().includes(searchQuery.toLowerCase());
      return matchRole && matchSearch;
    });
  }, [users, roleFilter, searchQuery]);

  // Selected Role's Live Permissions
  const activePermissions = useMemo(() => {
    return ROLE_PERMISSIONS[formData.role];
  }, [formData.role]);

  // Handle Form Submission: Provision New User
  const handleProvisionUser = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.username.trim() || !formData.fullName.trim() || !formData.initialPassword.trim()) {
      showNotification('error', 'Validation Error: Full Name, Username, and Initial Password are mandatory.');
      return;
    }

    if (users.some((u) => u.username.toLowerCase() === formData.username.trim().toLowerCase())) {
      showNotification('error', `Conflict: Username "${formData.username.trim()}" is already registered.`);
      return;
    }

    const newUser: UserRegistryItem = {
      userId: formData.userId.trim(),
      username: formData.username.trim().toLowerCase(),
      fullName: formData.fullName.trim(),
      role: formData.role,
      securityClearance: activePermissions.clearanceLevel,
      assignedFacility: formData.assignedFacility.trim(),
      status: 'Active',
      lastAuditAction: 'Account Initial Provisioning',
      createdAt: new Date().toISOString().slice(0, 10),
    };

    setUsers((prev) => [newUser, ...prev]);

    // Record into FDA 21 CFR Part 11 Audit Trail
    addAuditLog(
      'USER_PROVISION',
      `Provisioned user [${newUser.userId}] (${newUser.username}) with clearance [${newUser.securityClearance}]`,
      user?.username || 'admin',
      user?.role || 'Admin'
    );

    showNotification('success', `User [${newUser.userId}] provisioned successfully with ${newUser.role} credentials.`);

    // Reset Form with new random ID
    setFormData({
      userId: `EMP-${Math.floor(1000 + Math.random() * 9000)}`,
      fullName: '',
      username: '',
      initialPassword: '',
      role: 'Operator',
      assignedFacility: 'Line 01 Mixing & UHT Pasteurizer Cell',
    });
  };

  // Toggle User Active / Suspended State
  const handleToggleStatus = (targetUserId: string) => {
    const targetUser = users.find((u) => u.userId === targetUserId);
    if (!targetUser) return;

    if (targetUser.username === 'admin') {
      showNotification('error', 'Security Policy: Primary Administrator account cannot be suspended.');
      return;
    }

    const newStatus = targetUser.status === 'Active' ? 'Suspended' : 'Active';

    setUsers((prev) =>
      prev.map((u) =>
        u.userId === targetUserId ? { ...u, status: newStatus, lastAuditAction: `Status changed to ${newStatus}` } : u
      )
    );

    addAuditLog(
      'USER_STATUS_CHANGE',
      `User [${targetUser.userId}] (${targetUser.username}) status altered to [${newStatus}]`,
      user?.username || 'admin',
      user?.role || 'Admin'
    );

    showNotification('success', `User [${targetUser.userId}] account set to ${newStatus}.`);
  };

  return (
    <div className="space-y-6 font-mono text-xs select-none">
      {/* Module Overview & Audit Strip */}
      <div className="bg-white border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 bg-slate-900 text-white text-[10px] font-bold">
              FDA 21 CFR PART 11
            </span>
            <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
              SUBPART B · ELECTRONIC SIGNATURES &amp; ROLE-BASED ACCESS CONTROL (RBAC)
            </span>
          </div>
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-tight flex items-center gap-2" style={{ fontStyle: 'normal' }}>
            <Users className="w-4 h-4 text-slate-800" />
            User Master Registry &amp; Security Clearance Matrix
          </h2>
          <p className="text-slate-500 text-[11px] mt-0.5">
            Strict separation of duties according to ISA-95 Level 3 MOM: Configuration, Recipe Approval, Batch Dispatch, and Alarm Acknowledgment.
          </p>
        </div>

        {/* Telemetry Counter Pills */}
        <div className="flex items-center gap-3 font-mono text-xs">
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] px-3 py-1.5 flex items-center gap-2">
            <span className="text-slate-500 uppercase text-[10px]">REGISTERED USERS:</span>
            <span className="font-bold text-slate-900">{users.length}</span>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 px-3 py-1.5 flex items-center gap-2">
            <span className="text-emerald-700 uppercase text-[10px]">ACTIVE ACCOUNTS:</span>
            <span className="font-bold text-emerald-900">{users.filter((u) => u.status === 'Active').length}</span>
          </div>
          <div className="bg-sky-50 border border-sky-200 px-3 py-1.5 flex items-center gap-2">
            <span className="text-sky-700 uppercase text-[10px]">GOVERNANCE:</span>
            <span className="font-bold text-sky-900">21 CFR §11.10</span>
          </div>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div
          role="alert"
          className={`p-3 text-xs font-mono border flex items-center justify-between shadow-xs ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
              : 'bg-rose-50 border-rose-300 text-rose-950'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-[11px] font-bold underline hover:no-underline"
          >
            DISMISS
          </button>
        </div>
      )}

      {/* Two-Column Split: Provisioning Form (Left) vs User Registry Table (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* =======================================================
            LEFT PANEL: User Provisioning Form & RBAC Matrix
           ======================================================= */}
        <div className="lg:col-span-4 bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="px-4 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-slate-800" />
              <span className="font-bold text-slate-900 uppercase tracking-wider text-xs">
                User Provisioning Gateway
              </span>
            </div>
            <span className="text-[10px] bg-white border border-slate-300 px-2 py-0.5 text-slate-600 font-semibold">
              NEW ACCOUNT
            </span>
          </div>

          <form onSubmit={handleProvisionUser} className="p-4 space-y-3.5">
            {/* User ID */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                Employee User ID
              </label>
              <input
                type="text"
                value={formData.userId}
                onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-300 text-slate-900 font-bold focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2 transition-none"
                required
              />
            </div>

            {/* Full Name */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                Full Legal Name
              </label>
              <input
                type="text"
                placeholder="e.g. Tran Minh Tuan"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="w-full h-9 px-3 text-xs bg-white border border-slate-300 text-slate-900 focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2 transition-none"
                required
              />
            </div>

            {/* Username */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                Username (System Login)
              </label>
              <input
                type="text"
                placeholder="e.g. operator_02"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full h-9 px-3 text-xs bg-white border border-slate-300 text-slate-900 focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2 transition-none"
                required
              />
            </div>

            {/* Initial Password */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                Initial Password
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={formData.initialPassword}
                onChange={(e) => setFormData({ ...formData, initialPassword: e.target.value })}
                className="w-full h-9 px-3 text-xs bg-white border border-slate-300 text-slate-900 focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2 transition-none"
                required
              />
            </div>

            {/* Assigned Role */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                Assigned Operational Role
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                className="w-full h-9 px-3 text-xs bg-white border border-slate-300 text-slate-900 font-semibold focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2 transition-none"
              >
                <option value="Operator">Operator (Clearance Level 1 · Line Execution)</option>
                <option value="Supervisor">Supervisor (Clearance Level 2 · QA &amp; Scheduling)</option>
                <option value="Engineer">Engineer (Clearance Level 3 · Automation &amp; Hardware)</option>
                <option value="Admin">Admin (Clearance Level 4 · Full Administration)</option>
              </select>
            </div>

            {/* Assigned Facility */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                Assigned Plant Facility
              </label>
              <input
                type="text"
                value={formData.assignedFacility}
                onChange={(e) => setFormData({ ...formData, assignedFacility: e.target.value })}
                className="w-full h-9 px-3 text-xs bg-white border border-slate-300 text-slate-900 focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2 transition-none"
                required
              />
            </div>

            {/* Interactive Role-Based Access Control (RBAC) Permission Matrix */}
            <div className="pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-sky-700" />
                  <span>RBAC Permission Matrix</span>
                </span>
                <span className="text-[10px] text-sky-800 font-semibold bg-sky-50 px-1.5 py-0.5 border border-sky-200">
                  {formData.role}
                </span>
              </div>

              <div className="bg-[#F8FAFC] border border-[#E2E8F0] p-3 space-y-2 text-[11px]">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={activePermissions.configureHardware}
                    readOnly
                    className="w-3.5 h-3.5 text-slate-900 rounded-xs border-slate-300 pointer-events-none"
                  />
                  <span className={activePermissions.configureHardware ? 'font-semibold text-slate-900' : 'text-slate-400'}>
                    Configure OPC UA &amp; Hardware (Admin, Engineer)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={activePermissions.approveRecipes}
                    readOnly
                    className="w-3.5 h-3.5 text-slate-900 rounded-xs border-slate-300 pointer-events-none"
                  />
                  <span className={activePermissions.approveRecipes ? 'font-semibold text-slate-900' : 'text-slate-400'}>
                    Approve Master Recipes &amp; QA Release (Admin, Supervisor)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={activePermissions.dispatchBatches}
                    readOnly
                    className="w-3.5 h-3.5 text-slate-900 rounded-xs border-slate-300 pointer-events-none"
                  />
                  <span className={activePermissions.dispatchBatches ? 'font-semibold text-slate-900' : 'text-slate-400'}>
                    Dispatch &amp; Execute Batches (Admin, Supervisor, Operator)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={activePermissions.ackAlarms}
                    readOnly
                    className="w-3.5 h-3.5 text-slate-900 rounded-xs border-slate-300 pointer-events-none"
                  />
                  <span className={activePermissions.ackAlarms ? 'font-semibold text-slate-900' : 'text-slate-400'}>
                    Acknowledge Alarms &amp; Reset Interlocks (All Roles)
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex items-center gap-2">
              <button
                type="submit"
                className="flex-1 h-9 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2 active:translate-y-px transition-none"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>PROVISION USER</span>
              </button>

              <button
                type="button"
                onClick={() => setFormData({
                  userId: `EMP-${Math.floor(1000 + Math.random() * 9000)}`,
                  fullName: '',
                  username: '',
                  initialPassword: '',
                  role: 'Operator',
                  assignedFacility: 'Line 01 Mixing & UHT Pasteurizer Cell',
                })}
                className="h-9 px-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold uppercase flex items-center gap-1 active:translate-y-px transition-none"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span>RESET</span>
              </button>
            </div>
          </form>
        </div>

        {/* =======================================================
            RIGHT PANEL: User Master Registry Table
           ======================================================= */}
        <div className="lg:col-span-8 bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="px-4 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-800" />
              <span className="font-bold text-slate-900 uppercase tracking-wider text-xs">
                User Master Registry
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                ({filteredUsers.length} Active Records)
              </span>
            </div>

            {/* Search & Filter Controls */}
            <div className="flex items-center gap-2">
              {/* Role Filter */}
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="h-9 px-2.5 text-xs bg-white border border-slate-300 text-slate-800 font-semibold focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2 transition-none"
              >
                <option value="ALL">All Roles</option>
                <option value="Admin">Admin Only</option>
                <option value="Engineer">Engineer Only</option>
                <option value="Supervisor">Supervisor Only</option>
                <option value="Operator">Operator Only</option>
              </select>

              {/* Search Box */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
                <input
                  type="text"
                  placeholder="Search user, ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 pl-8 pr-3 text-xs bg-white border border-slate-300 text-slate-900 focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2 transition-none"
                />
              </div>
            </div>
          </div>

          {/* User Master Registry Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 text-[10px] uppercase font-mono">
                  <th className="py-2.5 px-3">User ID</th>
                  <th className="py-2.5 px-3">Username &amp; Name</th>
                  <th className="py-2.5 px-3 text-center">Role</th>
                  <th className="py-2.5 px-3">Security Clearance</th>
                  <th className="py-2.5 px-3">Facility</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 font-mono">
                      No registered users matched the query.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((item) => {
                    const isSelf = user?.username === item.username;
                    const isActive = item.status === 'Active';

                    return (
                      <tr key={item.userId} className="hover:bg-slate-50 transition-none">
                        {/* User ID */}
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          {item.userId}
                        </td>

                        {/* Username & Full Name */}
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900">{item.username}</div>
                          <div className="text-[10px] text-slate-500 truncate max-w-[150px]">{item.fullName}</div>
                        </td>

                        {/* Role Badge */}
                        <td className="py-2.5 px-3 text-center">
                          <span className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase border ${
                            item.role === 'Admin'
                              ? 'bg-purple-50 text-purple-900 border-purple-300'
                              : item.role === 'Engineer'
                              ? 'bg-indigo-50 text-indigo-900 border-indigo-300'
                              : item.role === 'Supervisor'
                              ? 'bg-sky-50 text-sky-900 border-sky-300'
                              : 'bg-slate-100 text-slate-800 border-slate-300'
                          }`}>
                            {item.role}
                          </span>
                        </td>

                        {/* Security Clearance */}
                        <td className="py-2.5 px-3 text-slate-800 font-medium text-[11px]">
                          {item.securityClearance}
                        </td>

                        {/* Assigned Facility */}
                        <td className="py-2.5 px-3 text-slate-600 text-[10px] max-w-[150px] truncate" title={item.assignedFacility}>
                          {item.assignedFacility}
                        </td>

                        {/* Status */}
                        <td className="py-2.5 px-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold border ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : 'bg-rose-50 text-rose-800 border-rose-300'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-600' : 'bg-rose-600'}`} />
                            {item.status}
                          </span>
                        </td>

                        {/* Action */}
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            disabled={item.username === 'admin' || isSelf}
                            onClick={() => handleToggleStatus(item.userId)}
                            className={`h-7 px-2.5 text-[10px] uppercase font-mono font-semibold border transition-none active:translate-y-px ${
                              item.username === 'admin' || isSelf
                                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                : isActive
                                ? 'bg-white hover:bg-rose-50 text-rose-700 border-rose-300'
                                : 'bg-white hover:bg-emerald-50 text-emerald-700 border-emerald-300'
                            }`}
                            title={
                              item.username === 'admin' 
                                ? 'Primary admin account protected' 
                                : isSelf 
                                ? 'Cannot modify active session account' 
                                : `Toggle ${item.status}`
                            }
                          >
                            {item.username === 'admin' ? 'LOCKED' : isSelf ? 'ACTIVE (YOU)' : isActive ? 'REVOKE' : 'RESTORE'}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Audit Verification Block */}
          <div className="p-3 bg-[#F8FAFC] border-t border-[#E2E8F0] text-[10px] text-slate-500 space-y-1">
            <div className="flex items-start gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-600 shrink-0 mt-0.5" />
              <p>
                FDA 21 CFR §11.10(d) Enforcement: Limiting system access to authorized individuals. Any modification to security clearance generates an immutable log entry in the User Security Audit Trail.
              </p>
            </div>
            <div className="text-[9px] text-slate-400 uppercase font-mono">
              SECURITY DOMAIN: MES_MILK_PRODUCTION · CRYPTOGRAPHIC SHA-256 SESSION GOVERNANCE
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;
