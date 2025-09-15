import { useState, useEffect } from 'react';
import { commissionManagementOperations } from '../lib/firebase-operations';

export const useCommissionFirebase = () => {
  const [commissions, setCommissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Commission operations
  const loadCommissions = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await commissionManagementOperations.getAllCommissions();
      setCommissions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load commissions');
    } finally {
      setLoading(false);
    }
  };

  // Load commissions by data type (subcollection)
  const loadCommissionsByType = async (dataType: "equity" | "fx") => {
    setLoading(true);
    setError(null);
    try {
      const data = await commissionManagementOperations.getCommissionsByType(dataType);
      setCommissions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to load ${dataType} commissions`);
    } finally {
      setLoading(false);
    }
  };

  const createCommission = async (commissionData: any, dataType: "equity" | "fx" = "equity") => {
    setLoading(true);
    setError(null);
    try {
      const newId = await commissionManagementOperations.createCommission(commissionData, dataType);
      await loadCommissionsByType(dataType);
      return newId;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create commission');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateCommission = async (id: string, commissionData: Partial<any>, dataType: "equity" | "fx" = "equity") => {
    setLoading(true);
    setError(null);
    try {
      await commissionManagementOperations.updateCommission(id, commissionData, dataType);
      await loadCommissionsByType(dataType);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update commission');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteCommission = async (id: string, dataType: "equity" | "fx" = "equity") => {
    setLoading(true);
    setError(null);
    try {
      await commissionManagementOperations.deleteCommission(id, dataType);
      await loadCommissionsByType(dataType);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete commission');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCommissions();
  }, []);

  return {
    commissions,
    loading,
    error,
    loadCommissions,
    loadCommissionsByType,
    createCommission,
    updateCommission,
    deleteCommission,
    clearError: () => setError(null)
  };
}; 