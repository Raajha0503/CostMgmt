import { useState } from 'react';
import { interestClaimsOperations } from '../lib/firebase-operations';

export const useInterestClaimsFirebase = () => {
  const [interestClaimsData, setInterestClaimsData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load all interest claims
  const loadInterestClaims = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await interestClaimsOperations.getAllInterestClaims();
      setInterestClaimsData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load interest claims data');
    } finally {
      setLoading(false);
    }
  };

  // Load interest claims by data type (subcollection)
  const loadInterestClaimsByType = async (dataType: 'equity' | 'fx') => {
    setLoading(true);
    setError(null);
    try {
      const data = await interestClaimsOperations.getInterestClaimsByType(dataType);
      setInterestClaimsData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to load ${dataType} interest claims data`);
    } finally {
      setLoading(false);
    }
  };

  const createInterestClaim = async (data: any, dataType: 'equity' | 'fx') => {
    setError(null);
    try {
      const id = await interestClaimsOperations.createInterestClaim(data, dataType);
      // Refresh the data after creating
      await loadInterestClaimsByType(dataType);
      return id;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create interest claim');
      throw err;
    }
  };

  const updateInterestClaim = async (id: string, data: any, dataType: 'equity' | 'fx') => {
    setError(null);
    try {
      await interestClaimsOperations.updateInterestClaim(id, data, dataType);
      // Refresh the data after updating
      await loadInterestClaimsByType(dataType);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update interest claim');
      throw err;
    }
  };

  const deleteInterestClaim = async (id: string, dataType: 'equity' | 'fx') => {
    setError(null);
    try {
      await interestClaimsOperations.deleteInterestClaim(id, dataType);
      // Refresh the data after deleting
      await loadInterestClaimsByType(dataType);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete interest claim');
      throw err;
    }
  };

  return {
    interestClaimsData,
    loading,
    error,
    loadInterestClaims,
    loadInterestClaimsByType,
    createInterestClaim,
    updateInterestClaim,
    deleteInterestClaim
  };
}; 