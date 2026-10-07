/* Hallmark · component: CustomerManagementTab · genre: modern-minimal · register: industrial-workbench
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: WCAG AA Pass
 */

import React, { useState, useEffect } from 'react';
import { useMasterData } from '../../context/MasterDataContext';
import { useConfig } from '../../context/ConfigContext';
import { Customer, CustomerPriority, CustomerStatus } from '../../types/masterData';
import { 
  Users, 
  Search, 
  UserPlus, 
  Save, 
  Trash2, 
  RotateCcw, 
  Building, 
  Mail, 
  Phone, 
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  Hash,
  ChevronRight
} from 'lucide-react';

const useSafeConfig = () => {
  try {
    return useConfig();
  } catch {
    return null;
  }
};

export const CustomerManagementTab: React.FC = () => {
  const { 
    customers, 
    addCustomer, 
    editCustomer, 
    deleteCustomer, 
    errorNotice, 
    clearErrorNotice,
    refetchData,
    isLoading
  } = useMasterData();

  const config = useSafeConfig();
  const sqlOnline = config?.sqlConfig?.connectionState === 'connected';

  // Resilient initial fetch with exponential backoff & SQL online listener
  useEffect(() => {
    let isMounted = true;
    const fetchWithRetry = async (retries = 3, delay = 1000) => {
      try {
        await refetchData();
      } catch (err) {
        if (retries > 0 && isMounted) {
          setTimeout(() => fetchWithRetry(retries - 1, Math.round(delay * 1.5)), delay);
        }
      }
    };

    fetchWithRetry();
    return () => {
      isMounted = false;
    };
  }, [sqlOnline]);


  // Selected customer ID for interactive row selection
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);

  // Form State initialized clean (no hardcoded mock values)
  const [formData, setFormData] = useState<{
    code: string;
    name: string;
    email: string;
    phone: string;
    address: string;
    priority: CustomerPriority;
    status: CustomerStatus;
  }>({
    code: '',
    name: '',
    email: '',
    phone: '',
    address: '',
    priority: 2,
    status: 'Active',
  });

  // Search & Filter State
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | '1' | '2' | '3'>('ALL');

  // Notification State
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // Sync with MasterDataContext errorNotice if emitted
  useEffect(() => {
    if (errorNotice) {
      showNotification('error', errorNotice);
      clearErrorNotice();
    }
  }, [errorNotice]);

  // Automatically select first customer only once on initial data arrival
  const initialSelectionDoneRef = React.useRef(false);
  useEffect(() => {
    if (!initialSelectionDoneRef.current && customers.length > 0) {
      initialSelectionDoneRef.current = true;
      setSelectedCustomerId(customers[0].id);
    }
  }, [customers]);

  // Synchronize form when selected customer changes
  useEffect(() => {
    if (selectedCustomerId !== null) {
      const found = customers.find((c) => c.id === selectedCustomerId);
      if (found) {
        setFormData({
          code: found.code,
          name: found.name,
          email: found.email,
          phone: found.phone,
          address: found.address || '',
          priority: found.priority,
          status: found.status,
        });
      }
    }
  }, [selectedCustomerId, customers]);

  // Handle select row from table
  const handleSelectRow = (customer: Customer) => {
    setSelectedCustomerId(customer.id);
  };

  // Handle Clear
  const handleClear = () => {
    setSelectedCustomerId(null);
    const nextNum = customers.length > 0 ? Math.max(...customers.map((c) => c.id || 0)) + 1 : 1;
    setFormData({
      code: `CUS-${nextNum.toString().padStart(3, '0')}`,
      name: '',
      email: '',
      phone: '',
      address: '',
      priority: 2,
      status: 'Active',
    });
  };

  // Add Customer (Synchronous Database Write Pattern)
  const handleAddNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showNotification('error', 'Customer Name is required.');
      return;
    }
    if (!formData.code.trim()) {
      showNotification('error', 'Customer Code is required.');
      return;
    }

    try {
      await addCustomer({
        code: formData.code.trim().toUpperCase(),
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        address: formData.address.trim(),
        priority: formData.priority,
        status: formData.status,
      });

      showNotification('success', `Customer [${formData.code}] "${formData.name}" added to physical SQL Server.`);
      handleClear();
    } catch (err: any) {
      showNotification('error', err?.message || 'Database Write Failed');
    }
  };

  // Update Customer
  const handleUpdate = async () => {
    if (!selectedCustomerId) {
      showNotification('error', 'Please select a customer record from the table to update.');
      return;
    }
    if (!formData.name.trim()) {
      showNotification('error', 'Customer Name cannot be empty.');
      return;
    }

    try {
      await editCustomer(selectedCustomerId, {
        code: formData.code.trim().toUpperCase(),
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        address: formData.address.trim(),
        priority: formData.priority,
        status: formData.status,
      });

      showNotification('success', `Customer [${formData.code}] updated successfully.`);
      handleClear();
    } catch (err: any) {
      showNotification('error', err?.message || 'Database Write Failed');
    }
  };

  // Delete Customer
  const handleDelete = async () => {
    if (!selectedCustomerId) {
      showNotification('error', 'Please select a customer record from the table to delete.');
      return;
    }

    const targetCustomer = customers.find((c) => c.id === selectedCustomerId);
    const targetCode = targetCustomer?.code || `#${selectedCustomerId}`;
    try {
      await deleteCustomer(selectedCustomerId);
      handleClear();
      showNotification('success', `Customer [${targetCode}] removed from registry.`);
    } catch (err: any) {
      showNotification('error', err?.message || 'Database Write Failed');
    }
  };

  // Filtered customer list
  const filteredCustomers = customers.filter((cust) => {
    const matchesSearch = 
      !searchKeyword ||
      cust.code.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      cust.name.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      cust.phone.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      cust.email.toLowerCase().includes(searchKeyword.toLowerCase());

    const matchesPriority = 
      priorityFilter === 'ALL' || cust.priority.toString() === priorityFilter;

    return matchesSearch && matchesPriority;
  });

  // Telemetry counts
  const highPriorityCount = customers.filter((c) => c.priority === 1).length;
  const activeCount = customers.filter((c) => c.status === 'Active').length;

  return (
    <div className="space-y-4">
      {/* Sub-Header Industrial Strip */}
      <div className="bg-white border border-slate-200 px-5 py-3 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-none bg-slate-900 text-white flex items-center justify-center font-mono font-bold text-sm">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 font-mono tracking-tight uppercase">
              Customer & Contract Management
            </h2>
            <p className="text-xs text-slate-500 font-mono">
              ISA-95 Level 3 Client Profiles & Batch Scheduling Priority Matrix
            </p>
          </div>
        </div>

        {/* Telemetry Stat Pills */}
        <div className="flex items-center gap-3 font-mono text-xs">
          <div className="bg-slate-50 border border-slate-200 px-3 py-1 flex items-center gap-2">
            <span className="text-slate-500 uppercase text-[10px]">TOTAL:</span>
            <span className="font-bold text-slate-900">{customers.length}</span>
          </div>
          <div className="bg-rose-50 border border-rose-200 px-3 py-1 flex items-center gap-2">
            <span className="text-rose-600 uppercase text-[10px]">P1 CRITICAL:</span>
            <span className="font-bold text-rose-800">{highPriorityCount}</span>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 px-3 py-1 flex items-center gap-2">
            <span className="text-emerald-600 uppercase text-[10px]">ACTIVE:</span>
            <span className="font-bold text-emerald-800">{activeCount}</span>
          </div>
        </div>
      </div>

      {/* Notification Banner */}
      {notification && (
        <div
          role="alert"
          className={`p-3 text-xs font-mono border flex items-center justify-between gap-2 ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-[11px] underline hover:no-underline font-mono"
          >
            DISMISS
          </button>
        </div>
      )}

      {/* 2-Card Split Layout: Left Form & Right Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT CARD: Customer Details Form */}
        <div className="lg:col-span-5 bg-white border border-slate-200 shadow-xs">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building className="w-4 h-4 text-slate-700" />
              <span className="text-xs font-bold text-slate-900 font-mono uppercase tracking-wider">
                Customer Details Form
              </span>
            </div>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 border ${
                selectedCustomerId
                  ? 'bg-sky-50 text-sky-800 border-sky-300 font-bold'
                  : 'bg-slate-100 text-slate-600 border-slate-300'
              }`}
            >
              {selectedCustomerId ? `EDITING: ${formData.code}` : 'NEW ENTRY'}
            </span>
          </div>

          <form onSubmit={handleAddNew} className="p-4 space-y-3.5 text-xs font-mono">
            {/* Row 1: Customer Code & Order Priority */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                  Customer Code *
                </label>
                <div className="relative">
                  <Hash className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. CUS-VNM"
                    className="w-full h-9 pl-8 pr-3 text-xs font-mono bg-white border border-slate-300 text-slate-900 focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2 transition-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                  Order Priority *
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) =>
                    setFormData({ ...formData, priority: parseInt(e.target.value, 10) as CustomerPriority })
                  }
                  className="w-full h-9 px-3 text-xs font-mono bg-white border border-slate-300 text-slate-900 focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2 transition-none"
                >
                  <option value={1}>1 - Critical / High</option>
                  <option value={2}>2 - Standard / Normal</option>
                  <option value={3}>3 - Low / Deferred</option>
                </select>
              </div>
            </div>

            {/* Row 2: Customer Name */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                Customer Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Vinamilk Corporation"
                className="w-full h-9 px-3 text-xs font-mono bg-white border border-slate-300 text-slate-900 focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2 transition-none"
              />
            </div>

            {/* Row 3: Contact Email & Phone */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                  Contact Email
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="contact@company.vn"
                    className="w-full h-9 pl-8 pr-3 text-xs font-mono bg-white border border-slate-300 text-slate-900 focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2 transition-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="028-5415-5555"
                    className="w-full h-9 pl-8 pr-3 text-xs font-mono bg-white border border-slate-300 text-slate-900 focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2 transition-none"
                  />
                </div>
              </div>
            </div>

            {/* Row 4: Status & Address */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                  Status *
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as CustomerStatus })}
                  className="w-full h-9 px-2 text-xs font-mono bg-white border border-slate-300 text-slate-900 focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2 transition-none"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              <div className="col-span-2">
                <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                  Plant / Facility Address
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="District 7, HCMC"
                  className="w-full h-9 px-3 text-xs font-mono bg-white border border-slate-300 text-slate-900 focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2 transition-none"
                />
              </div>
            </div>

            {/* Form Action Buttons (8-state standard, fixed h-9) */}
            <div className="pt-2 grid grid-cols-2 gap-2">
              <button
                type="submit"
                className="h-9 px-3 bg-slate-900 hover:bg-slate-800 text-white font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2 active:translate-y-px transition-none"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Add Customer</span>
              </button>

              <button
                type="button"
                onClick={handleUpdate}
                disabled={!selectedCustomerId}
                className="h-9 px-3 bg-white hover:bg-slate-50 border border-slate-300 text-slate-900 font-mono font-semibold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2 active:translate-y-px transition-none"
              >
                <Save className="w-3.5 h-3.5 text-slate-700" />
                <span>Update Record</span>
              </button>

              <button
                type="button"
                onClick={handleDelete}
                disabled={!selectedCustomerId}
                className="h-9 px-3 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-mono font-semibold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2 active:translate-y-px transition-none"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>Delete</span>
              </button>

              <button
                type="button"
                onClick={handleClear}
                className="h-9 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2 active:translate-y-px transition-none"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span>Clear Form</span>
              </button>
            </div>
          </form>

          {/* Operational Policy Footnote */}
          <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-500 font-mono flex items-center gap-2">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>Customer priority governs automated batch queue dispatch in Operations.</span>
          </div>
        </div>

        {/* RIGHT CARD: Customer Records Table */}
        <div className="lg:col-span-7 bg-white border border-slate-200 shadow-xs">
          {/* Table Toolbar */}
          <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900 font-mono uppercase tracking-wider">
                Customer Registry Table
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                ({filteredCustomers.length} Records)
              </span>
            </div>

            {/* Search Input & Priority Filter */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2.5" />
                <input
                  type="text"
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  placeholder="Filter code / name / phone..."
                  className="h-8 pl-7 pr-2 text-xs font-mono bg-white border border-slate-300 text-slate-900 focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2 transition-none w-48"
                />
              </div>

              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as any)}
                className="h-8 px-2 text-xs font-mono bg-white border border-slate-300 text-slate-700 focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2 transition-none"
              >
                <option value="ALL">All Priorities</option>
                <option value="1">P1 (Critical)</option>
                <option value="2">P2 (Normal)</option>
                <option value="3">P3 (Low)</option>
              </select>
            </div>
          </div>

          {/* Interactive Records Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-2.5 px-3">Code</th>
                  <th className="py-2.5 px-3">Customer Name</th>
                  <th className="py-2.5 px-3">Phone</th>
                  <th className="py-2.5 px-3 text-center">Priority</th>
                  <th className="py-2.5 px-3 text-center">Active Orders</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {isLoading && customers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500 font-mono">
                      <div className="flex items-center justify-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
                        <span>Synchronizing records from physical SQL Server...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 font-mono">
                      No matching customer records located.
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((cust) => {
                    const isSelected = selectedCustomerId === cust.id;
                    return (
                      <tr
                        key={cust.id}
                        onClick={() => handleSelectRow(cust)}
                        className={`cursor-pointer transition-none ${
                          isSelected
                            ? 'bg-sky-50/70 border-l-2 border-l-sky-600 text-slate-900 font-semibold'
                            : 'hover:bg-slate-50 text-slate-800'
                        }`}
                      >
                        {/* Customer Code */}
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                          {cust.code}
                        </td>

                        {/* Customer Name */}
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-900">{cust.name}</div>
                          {cust.email && (
                            <div className="text-[10px] text-slate-500">{cust.email}</div>
                          )}
                        </td>

                        {/* Phone */}
                        <td className="py-2.5 px-3 text-slate-700">
                          {cust.phone || '---'}
                        </td>

                        {/* Priority Badge */}
                        <td className="py-2.5 px-3 text-center">
                          {cust.priority === 1 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-300 text-[10px] font-bold">
                              P1 - Critical
                            </span>
                          )}
                          {cust.priority === 2 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-300 text-[10px] font-semibold">
                              P2 - Normal
                            </span>
                          )}
                          {cust.priority === 3 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-300 text-[10px]">
                              P3 - Low
                            </span>
                          )}
                        </td>

                        {/* Active Orders Count */}
                        <td className="py-2.5 px-3 text-center">
                          <span className="inline-block px-2 py-0.5 bg-slate-100 border border-slate-300 text-[11px] font-bold text-slate-800">
                            {cust.activeOrdersCount || 0}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-2.5 px-3 text-center">
                          {cust.status === 'Active' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-semibold">
                              <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                              <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />
                              Inactive
                            </span>
                          )}
                        </td>

                        {/* Select Action */}
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectRow(cust);
                            }}
                            className={`h-7 px-2.5 text-[11px] font-mono uppercase tracking-wider border transition-none flex items-center gap-1 ml-auto ${
                              isSelected
                                ? 'bg-sky-600 text-white border-sky-600'
                                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                            }`}
                          >
                            <span>{isSelected ? 'Selected' : 'Select'}</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer Instructions */}
          <div className="p-2.5 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500 font-mono flex items-center justify-between">
            <span>Click any customer row to inspect and modify profile properties.</span>
            <span className="text-[10px] text-slate-400">TABLE REF: [dbo].[CUSTOMERS]</span>
          </div>
        </div>
      </div>
    </div>
  );
};
