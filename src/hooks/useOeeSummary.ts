/* Hallmark · hook: useOeeSummary · genre: modern-minimal · register: industrial-workbench
 * standard: ANSI/ISA-95 · ISO 22400-2 Key Performance Indicator
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getOeeSummary, OeeSummaryData } from '../services/api';

export interface UseOeeSummaryOptions {
  shiftHours?: number;
  pollIntervalMs?: number;
  enabled?: boolean;
}

export interface UseOeeSummaryReturn {
  summary: OeeSummaryData | null;
  overallOee: number;
  availability: number;
  performance: number;
  quality: number;
  qualityRate: number;
  shiftOutputVolume: number;
  shiftTargetVolume: number;
  activeBatches: number;
  operatingTimeMinutes: number;
  downtimeMinutes: number;
  shiftName: string;
  shiftWindow: string;
  shiftLeader: string;
  isStandby: boolean;
  benchmark: string;
  benchmarkLabel: string;
  badgeColor: string;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useOeeSummary(options: UseOeeSummaryOptions = {}): UseOeeSummaryReturn {
  const { shiftHours = 8, pollIntervalMs = 2500, enabled = true } = options;

  // Default initial state MUST strictly be zeroed: OEE 0.0%, Avail 0.0%, Perf 0.0%, Qual 0.0%, Output 0 L (Target: 5,000 L)
  const [summary, setSummary] = useState<OeeSummaryData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef<boolean>(true);

  const fetchSummary = useCallback(async () => {
    try {
      const data = await getOeeSummary(shiftHours);
      if (isMountedRef.current) {
        setSummary(data);
        setError(null);
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        setError(err?.message || 'Error communicating with OEE calculation engine');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [shiftHours]);

  useEffect(() => {
    isMountedRef.current = true;
    if (!enabled) return;

    fetchSummary();
    const interval = setInterval(fetchSummary, pollIntervalMs);

    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
    };
  }, [fetchSummary, pollIntervalMs, enabled]);

  // Zeroed baseline defaults (Strict ISA-95 Zeroed Standby - No mock numbers)
  const overallOee = Number(summary?.overall_oee ?? summary?.oee ?? summary?.line_oee ?? 0.0);
  const availability = Number(summary?.availability ?? 0.0);
  const performance = Number(summary?.performance ?? 0.0);
  const quality = Number(summary?.quality_rate ?? summary?.quality ?? 0.0);
  const qualityRate = quality;
  const shiftOutputVolume = Number(summary?.shift_output_volume ?? summary?.shift_output_liters ?? 0.0);
  const shiftTargetVolume = Number(summary?.shift_target_volume ?? 5000.0);
  const activeBatches = Number(summary?.active_batches ?? 0);
  const operatingTimeMinutes = Number(summary?.operating_time_minutes ?? 0.0);
  const downtimeMinutes = Number(summary?.downtime_minutes ?? 0.0);
  const shiftName = summary?.shift_name || 'SHIFT 1 (MORNING)';
  const shiftWindow = summary?.shift_window || '06:00 — 14:00';
  const shiftLeader = summary?.shift_leader || 'Trần Đức (Lead Process Architect)';
  const isStandby = overallOee === 0.0 || Boolean(summary?.is_standby);
  const benchmark = summary?.benchmark || 'STANDBY';
  const benchmarkLabel = summary?.benchmark_label || 'Cold Standby (0.0%)';
  const badgeColor = summary?.badge_color || 'slate';

  return {
    summary,
    overallOee,
    availability,
    performance,
    quality,
    qualityRate,
    shiftOutputVolume,
    shiftTargetVolume,
    activeBatches,
    operatingTimeMinutes,
    downtimeMinutes,
    shiftName,
    shiftWindow,
    shiftLeader,
    isStandby,
    benchmark,
    benchmarkLabel,
    badgeColor,
    loading,
    error,
    refetch: fetchSummary,
  };
}

export default useOeeSummary;
