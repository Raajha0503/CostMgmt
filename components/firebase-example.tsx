"use client"

import React, { useState } from 'react';
import { useFirebase } from '../hooks/use-firebase';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';

export default function FirebaseExample() {
  const { 
    trades, 
    claims, 
    loading, 
    error, 
    createTrade, 
    createClaim, 
    updateTrade, 
    deleteTrade,
    clearError 
  } = useFirebase();

  const [newTrade, setNewTrade] = useState({
    trade_id: '',
    data_source: 'equity' as const,
    symbol: '',
    quantity: 0,
    price: 0
  });

  const [newClaim, setNewClaim] = useState({
    claim_id: '',
    trade_id: '',
    claim_amount: 0,
    currency: 'USD',
    status: 'pending' as const
  });

  const handleCreateTrade = async () => {
    try {
      await createTrade(newTrade);
      setNewTrade({
        trade_id: '',
        data_source: 'equity',
        symbol: '',
        quantity: 0,
        price: 0
      });
    } catch (error) {
      console.error('Failed to create trade:', error);
    }
  };

  const handleCreateClaim = async () => {
    try {
      await createClaim(newClaim);
      setNewClaim({
        claim_id: '',
        trade_id: '',
        claim_amount: 0,
        currency: 'USD',
        status: 'pending'
      });
    } catch (error) {
      console.error('Failed to create claim:', error);
    }
  };

  const handleDeleteTrade = async (id: string) => {
    if (confirm('Are you sure you want to delete this trade?')) {
      try {
        await deleteTrade(id);
      } catch (error) {
        console.error('Failed to delete trade:', error);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Firebase Database Example</h1>
      
      {error && (
        <Alert className="bg-red-50 border-red-200">
          <AlertDescription className="text-red-800">
            {error}
            <Button 
              variant="outline" 
              size="sm" 
              className="ml-2"
              onClick={clearError}
            >
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Create Trade Form */}
      <Card>
        <CardHeader>
          <CardTitle>Create New Trade</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              placeholder="Trade ID"
              value={newTrade.trade_id}
              onChange={(e) => setNewTrade({...newTrade, trade_id: e.target.value})}
            />
            <Input
              placeholder="Symbol (e.g., AAPL)"
              value={newTrade.symbol}
              onChange={(e) => setNewTrade({...newTrade, symbol: e.target.value})}
            />
            <Input
              type="number"
              placeholder="Quantity"
              value={newTrade.quantity}
              onChange={(e) => setNewTrade({...newTrade, quantity: Number(e.target.value)})}
            />
            <Input
              type="number"
              step="0.01"
              placeholder="Price"
              value={newTrade.price}
              onChange={(e) => setNewTrade({...newTrade, price: Number(e.target.value)})}
            />
          </div>
          <Button onClick={handleCreateTrade} disabled={!newTrade.trade_id || !newTrade.symbol}>
            Create Trade
          </Button>
        </CardContent>
      </Card>

      {/* Create Claim Form */}
      <Card>
        <CardHeader>
          <CardTitle>Create New Claim</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              placeholder="Claim ID"
              value={newClaim.claim_id}
              onChange={(e) => setNewClaim({...newClaim, claim_id: e.target.value})}
            />
            <Input
              placeholder="Trade ID"
              value={newClaim.trade_id}
              onChange={(e) => setNewClaim({...newClaim, trade_id: e.target.value})}
            />
            <Input
              type="number"
              step="0.01"
              placeholder="Claim Amount"
              value={newClaim.claim_amount}
              onChange={(e) => setNewClaim({...newClaim, claim_amount: Number(e.target.value)})}
            />
            <Input
              placeholder="Currency"
              value={newClaim.currency}
              onChange={(e) => setNewClaim({...newClaim, currency: e.target.value})}
            />
          </div>
          <Button onClick={handleCreateClaim} disabled={!newClaim.claim_id || !newClaim.trade_id}>
            Create Claim
          </Button>
        </CardContent>
      </Card>

      {/* Trades List */}
      <Card>
        <CardHeader>
          <CardTitle>Trades ({trades.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {trades.length === 0 ? (
            <p className="text-gray-500">No trades found. Create your first trade above!</p>
          ) : (
            <div className="space-y-2">
              {trades.map((trade) => (
                <div key={trade.id} className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <div className="font-medium">{trade.trade_id}</div>
                    <div className="text-sm text-gray-600">
                      {trade.symbol} - {trade.quantity} @ ${trade.price}
                    </div>
                    <Badge variant="outline">{trade.data_source}</Badge>
                  </div>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={() => handleDeleteTrade(trade.id)}
                  >
                    Delete
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Claims List */}
      <Card>
        <CardHeader>
          <CardTitle>Claims ({claims.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {claims.length === 0 ? (
            <p className="text-gray-500">No claims found. Create your first claim above!</p>
          ) : (
            <div className="space-y-2">
              {claims.map((claim) => (
                <div key={claim.id} className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <div className="font-medium">{claim.claim_id}</div>
                    <div className="text-sm text-gray-600">
                      Trade: {claim.trade_id} - ${claim.claim_amount} {claim.currency}
                    </div>
                    <Badge variant="outline">{claim.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 