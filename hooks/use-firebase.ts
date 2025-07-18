// Custom hook for Firebase operations
import { useState, useEffect } from 'react';
import { tradeOperations, claimOperations, Trade, Claim } from '../lib/firebase-operations';

export const useFirebase = () => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Trade operations
  const loadTrades = async () => {
    setLoading(true);
    setError(null);
    try {
      const tradesData = await tradeOperations.getAllTrades();
      setTrades(tradesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trades');
    } finally {
      setLoading(false);
    }
  };

  const createTrade = async (tradeData: Omit<Trade, 'id' | 'created_at' | 'updated_at'>) => {
    setLoading(true);
    setError(null);
    try {
      const newTradeId = await tradeOperations.createTrade(tradeData);
      await loadTrades(); // Reload trades to get the new one
      return newTradeId;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create trade');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateTrade = async (id: string, tradeData: Partial<Trade>) => {
    setLoading(true);
    setError(null);
    try {
      await tradeOperations.updateTrade(id, tradeData);
      await loadTrades(); // Reload trades to get updated data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update trade');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteTrade = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      await tradeOperations.deleteTrade(id);
      await loadTrades(); // Reload trades to remove the deleted one
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete trade');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getTradesByDataSource = async (dataSource: "equity" | "fx") => {
    setLoading(true);
    setError(null);
    try {
      const tradesData = await tradeOperations.getTradesByDataSource(dataSource);
      setTrades(tradesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trades by data source');
    } finally {
      setLoading(false);
    }
  };

  // Claim operations
  const loadClaims = async () => {
    setLoading(true);
    setError(null);
    try {
      const claimsData = await claimOperations.getAllClaims();
      setClaims(claimsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load claims');
    } finally {
      setLoading(false);
    }
  };

  const createClaim = async (claimData: Omit<Claim, 'id' | 'created_at' | 'updated_at'>) => {
    setLoading(true);
    setError(null);
    try {
      const newClaimId = await claimOperations.createClaim(claimData);
      await loadClaims(); // Reload claims to get the new one
      return newClaimId;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create claim');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateClaim = async (id: string, claimData: Partial<Claim>) => {
    setLoading(true);
    setError(null);
    try {
      await claimOperations.updateClaim(id, claimData);
      await loadClaims(); // Reload claims to get updated data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update claim');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteClaim = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      await claimOperations.deleteClaim(id);
      await loadClaims(); // Reload claims to remove the deleted one
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete claim');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getClaimsByStatus = async (status: Claim['status']) => {
    setLoading(true);
    setError(null);
    try {
      const claimsData = await claimOperations.getClaimsByStatus(status);
      setClaims(claimsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load claims by status');
    } finally {
      setLoading(false);
    }
  };

  const getClaimsByTradeId = async (tradeId: string) => {
    setLoading(true);
    setError(null);
    try {
      const claimsData = await claimOperations.getClaimsByTradeId(tradeId);
      setClaims(claimsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load claims by trade ID');
    } finally {
      setLoading(false);
    }
  };

  // Load initial data
  useEffect(() => {
    loadTrades();
    loadClaims();
  }, []);

  return {
    // State
    trades,
    claims,
    loading,
    error,
    
    // Trade operations
    loadTrades,
    createTrade,
    updateTrade,
    deleteTrade,
    getTradesByDataSource,
    
    // Claim operations
    loadClaims,
    createClaim,
    updateClaim,
    deleteClaim,
    getClaimsByStatus,
    getClaimsByTradeId,
    
    // Utility
    clearError: () => setError(null)
  };
}; 