export type ConnectionState = 'connected' | 'disconnected' | 'connecting' | 'error';

export interface SiemensPlcConfig {
  id: 'plc1' | 'plc2';
  name: string;
  unitLabel: string;
  roleDescription: string;
  ipAddress: string;
  port: number;
  rack: number;
  slot: number;
  connectionState: ConnectionState;
  lastConnectedAt?: string;
  latencyMs?: number;
  errorMessage?: string;
}

export type SqlAuthMode = 'windows' | 'sql';

export interface SqlServerConfig {
  serverName: string;
  databaseName: string;
  authMode?: SqlAuthMode;
  username: string;
  password: string;
  port?: number;
  connectionState: ConnectionState;
  lastSavedAt?: string;
  lastVerifiedAt?: string;
  errorMessage?: string;
  version?: string;
}

export interface ConfigContextType {
  plc1Config: SiemensPlcConfig;
  plc2Config: SiemensPlcConfig;
  sqlConfig: SqlServerConfig;
  updatePlc1Config: (fields: Partial<SiemensPlcConfig>) => void;
  updatePlc2Config: (fields: Partial<SiemensPlcConfig>) => void;
  togglePlc1Connection: () => Promise<void>;
  togglePlc2Connection: () => Promise<void>;
  updateSqlConfig: (fields: Partial<SqlServerConfig>) => void;
  saveSqlConfig: () => Promise<boolean>;
  testSqlConnection: () => Promise<boolean>;
  isSavingSql: boolean;
}
