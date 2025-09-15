import { useState, useEffect } from 'react';
import { agentBillingOperations } from '../lib/firebase-operations';

export const useAgentBillingFirebase = () => {
  const [agentBillingData, setAgentBillingData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Agent billing operations
  const loadAgentBilling = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await agentBillingOperations.getAllAgentBilling();
      setAgentBillingData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agent billing data');
    } finally {
      setLoading(false);
    }
  };

  // Load agent billing data by data type (subcollection)
  const loadAgentBillingByType = async (dataType: 'equity' | 'fx') => {
    setLoading(true);
    setError(null);
    try {
      const data = await agentBillingOperations.getAgentBillingByType(dataType);
      setAgentBillingData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to load ${dataType} agent billing data`);
    } finally {
      setLoading(false);
    }
  };

  const createAgentBilling = async (data: any, dataType: 'equity' | 'fx') => {
    setError(null);
    try {
      const id = await agentBillingOperations.createAgentBilling(data, dataType);
      // Refresh the data after creating
      await loadAgentBillingByType(dataType);
      return id;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create agent billing record');
      throw err;
    }
  };

  const updateAgentBilling = async (id: string, data: any, dataType: 'equity' | 'fx') => {
    setError(null);
    try {
      await agentBillingOperations.updateAgentBilling(id, data, dataType);
      // Refresh the data after updating
      await loadAgentBillingByType(dataType);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update agent billing record');
      throw err;
    }
  };

  const deleteAgentBilling = async (id: string, dataType: 'equity' | 'fx') => {
    setError(null);
    try {
      await agentBillingOperations.deleteAgentBilling(id, dataType);
      // Refresh the data after deleting
      await loadAgentBillingByType(dataType);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete agent billing record');
      throw err;
    }
  };

  return {
    agentBillingData,
    loading,
    error,
    loadAgentBilling,
    loadAgentBillingByType,
    createAgentBilling,
    updateAgentBilling,
    deleteAgentBilling
  };
}; 