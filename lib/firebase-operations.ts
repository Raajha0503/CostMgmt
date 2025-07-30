// Firebase database operations
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  serverTimestamp,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase-config';

// Types (same as your existing types)
export interface Trade {
  id: string
  trade_id: string
  order_id?: string
  client_id?: string
  data_source: "equity" | "fx"
  trade_type?: string
  trade_date?: string
  settlement_date?: string
  value_date?: string
  settlement_status?: string
  counterparty?: string
  trading_venue?: string
  confirmation_status?: string
  currency?: string

  // Equity fields
  isin?: string
  symbol?: string
  quantity?: number
  price?: number
  trade_value?: number
  trader_name?: string
  kyc_status?: string
  reference_data_validated?: boolean

  // FX fields
  currency_pair?: string
  buy_sell?: string
  dealt_currency?: string
  base_currency?: string
  term_currency?: string
  notional_amount?: number
  fx_rate?: number

  // Financial fields
  commission?: number
  taxes?: number
  total_cost?: number
  market_impact_cost?: number
  fx_rate_applied?: number
  net_amount?: number

  // Metadata
  created_at: string
  updated_at: string
  uploaded_by?: string
  original_file_name?: string
  raw_data?: any
}

export interface Claim {
  id: string
  claim_id: string
  trade_id: string
  claim_amount: number
  currency: string
  interest_rate?: number
  delay_days?: number
  claim_reason?: string
  claim_type?: string
  status: "pending" | "registered" | "under_investigation" | "approved" | "rejected" | "issued" | "settled" | "closed"
  workflow_stage: "receipt" | "registration" | "investigation" | "approval" | "issuance" | "settlement" | "follow_up"
  priority?: string

  // Dates
  registration_date?: string
  investigation_start_date?: string
  approval_date?: string
  issuance_date?: string
  settlement_date?: string
  closure_date?: string

  // Assignments
  assigned_investigator?: string
  approved_by?: string

  // Metadata
  created_at: string
  updated_at: string
  created_by?: string

  // Relations
  trade?: Trade
}

// Trade Operations
export const tradeOperations = {
  // Get all trades
  async getAllTrades(): Promise<Trade[]> {
    try {
      const querySnapshot = await getDocs(collection(db, 'unified_data'));
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Trade[];
    } catch (error) {
      console.error('Error getting trades:', error);
      throw error;
    }
  },

  // Get trade by ID
  async getTradeById(id: string): Promise<Trade | null> {
    try {
      const docRef = doc(db, 'unified_data', id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Trade;
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error getting trade:', error);
      throw error;
    }
  },

  // Create new trade
  async createTrade(tradeData: Omit<Trade, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'unified_data'), {
        ...tradeData,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating trade:', error);
      throw error;
    }
  },

  // Update trade
  async updateTrade(id: string, tradeData: Partial<Trade>): Promise<void> {
    try {
      const docRef = doc(db, 'unified_data', id);
      await updateDoc(docRef, {
        ...tradeData,
        updated_at: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating trade:', error);
      throw error;
    }
  },

  // Delete trade
  async deleteTrade(id: string): Promise<void> {
    try {
      const docRef = doc(db, 'unified_data', id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting trade:', error);
      throw error;
    }
  },

  // Get trades by data source
  async getTradesByDataSource(_dataSource: "equity" | "fx"): Promise<Trade[]> {
    try {
      const querySnapshot = await getDocs(collection(db, 'unified_data'));
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Trade[];
    } catch (error) {
      console.error('Error getting trades:', error);
      throw error;
    }
  }
};

// Communication Operations (for Internal Messaging System)
export const communicationOperations = {
  // Get all communications
  async getAllCommunications(): Promise<any[]> {
    try {
      const querySnapshot = await getDocs(collection(db, 'communications'));
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting communications:', error);
      throw error;
    }
  },

  // Get communication by ID
  async getCommunicationById(id: string): Promise<any | null> {
    try {
      const docRef = doc(db, 'communications', id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error getting communication:', error);
      throw error;
    }
  },

  // Create new communication
  async createCommunication(communicationData: any): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'communications'), {
        ...communicationData,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating communication:', error);
      throw error;
    }
  },

  // Update communication
  async updateCommunication(id: string, communicationData: any): Promise<void> {
    try {
      const docRef = doc(db, 'communications', id);
      await updateDoc(docRef, {
        ...communicationData,
        updated_at: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating communication:', error);
      throw error;
    }
  },

  // Delete communication
  async deleteCommunication(id: string): Promise<void> {
    try {
      const docRef = doc(db, 'communications', id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting communication:', error);
      throw error;
    }
  }
};

// Claim Operations
export const claimOperations = {
  // Get all claims
  async getAllClaims(): Promise<Claim[]> {
    try {
      const querySnapshot = await getDocs(collection(db, 'claims'));
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Claim[];
    } catch (error) {
      console.error('Error getting claims:', error);
      throw error;
    }
  },

  // Get claim by ID
  async getClaimById(id: string): Promise<Claim | null> {
    try {
      const docRef = doc(db, 'claims', id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Claim;
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error getting claim:', error);
      throw error;
    }
  },

  // Create new claim
  async createClaim(claimData: Omit<Claim, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'claims'), {
        ...claimData,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating claim:', error);
      throw error;
    }
  },

  // Update claim
  async updateClaim(id: string, claimData: Partial<Claim>): Promise<void> {
    try {
      const docRef = doc(db, 'claims', id);
      await updateDoc(docRef, {
        ...claimData,
        updated_at: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating claim:', error);
      throw error;
    }
  },

  // Delete claim
  async deleteClaim(id: string): Promise<void> {
    try {
      const docRef = doc(db, 'claims', id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting claim:', error);
      throw error;
    }
  },

  // Get claims by status
  async getClaimsByStatus(status: Claim['status']): Promise<Claim[]> {
    try {
      const q = query(
        collection(db, 'claims'),
        where('status', '==', status)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Claim[];
    } catch (error) {
      console.error('Error getting claims by status:', error);
      throw error;
    }
  },

  // Get claims by trade ID
  async getClaimsByTradeId(tradeId: string): Promise<Claim[]> {
    try {
      const q = query(
        collection(db, 'claims'),
        where('trade_id', '==', tradeId)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Claim[];
    } catch (error) {
      console.error('Error getting claims by trade ID:', error);
      throw error;
    }
  }
}; 

// Commission Management Operations
export const commissionManagementOperations = {
  // Get all commission management records from all subcollections
  async getAllCommissions(): Promise<any[]> {
    try {
      // Get from equity subcollection
      const equitySnapshot = await getDocs(collection(db, 'commission_management', 'equity', 'records'));
      const equityData = equitySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        subcollection: 'equity'
      }));

      // Get from fx subcollection
      const fxSnapshot = await getDocs(collection(db, 'commission_management', 'fx', 'records'));
      const fxData = fxSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        subcollection: 'fx'
      }));

      return [...equityData, ...fxData];
    } catch (error) {
      console.error('Error getting commission management records:', error);
      throw error;
    }
  },

  // Get commission records by data type (subcollection)
  async getCommissionsByType(dataType: "equity" | "fx"): Promise<any[]> {
    try {
      const querySnapshot = await getDocs(collection(db, 'commission_management', dataType, 'records'));
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        subcollection: dataType
      }));
    } catch (error) {
      console.error(`Error getting ${dataType} commission records:`, error);
      throw error;
    }
  },

  // Create new commission management record in appropriate subcollection
  async createCommission(data: any, dataType: "equity" | "fx" = "equity"): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'commission_management', dataType, 'records'), {
        ...data,
        data_type: dataType,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating commission management record:', error);
      throw error;
    }
  },

  // Update commission management record
  async updateCommission(id: string, data: Partial<any>, dataType: "equity" | "fx" = "equity"): Promise<void> {
    try {
      const docRef = doc(db, 'commission_management', dataType, 'records', id);
      await updateDoc(docRef, {
        ...data,
        updated_at: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating commission management record:', error);
      throw error;
    }
  },

  // Delete commission management record
  async deleteCommission(id: string, dataType: "equity" | "fx" = "equity"): Promise<void> {
    try {
      const docRef = doc(db, 'commission_management', dataType, 'records', id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting commission management record:', error);
      throw error;
    }
  },

  // Legacy method for backward compatibility - creates in equity subcollection
  async createCommissionLegacy(data: any): Promise<string> {
    return this.createCommission(data, "equity");
  },

  // Get all records from main commission_management collection (not subcollections)
  async getCommissionsFromMainCollection(): Promise<any[]> {
    try {
      const querySnapshot = await getDocs(collection(db, 'commission_management'));
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting commission management records from main collection:', error);
      throw error;
    }
  }
}; 

// Agent Billing Operations
export const agentBillingOperations = {
  // Get all agent billing records from all subcollections
  async getAllAgentBilling(): Promise<any[]> {
    try {
      // Get from equity subcollection
      const equitySnapshot = await getDocs(collection(db, 'agent_billing', 'equity', 'records'));
      const equityData = equitySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        subcollection: 'equity'
      }));

      // Get from fx subcollection
      const fxSnapshot = await getDocs(collection(db, 'agent_billing', 'fx', 'records'));
      const fxData = fxSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        subcollection: 'fx'
      }));

      return [...equityData, ...fxData];
    } catch (error) {
      console.error('Error getting all agent billing records:', error);
      throw error;
    }
  },

  // Get agent billing records by type (subcollection)
  async getAgentBillingByType(dataType: 'equity' | 'fx'): Promise<any[]> {
    try {
      const snapshot = await getDocs(collection(db, 'agent_billing', dataType, 'records'));
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        data_type: dataType
      }));
    } catch (error) {
      console.error(`Error getting ${dataType} agent billing records:`, error);
      throw error;
    }
  },

  // Create a new agent billing record in the appropriate subcollection
  async createAgentBilling(data: any, dataType: 'equity' | 'fx'): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'agent_billing', dataType, 'records'), {
        ...data,
        data_type: dataType,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating agent billing record:', error);
      throw error;
    }
  },

  // Update an agent billing record
  async updateAgentBilling(id: string, data: any, dataType: 'equity' | 'fx'): Promise<void> {
    try {
      await updateDoc(doc(db, 'agent_billing', dataType, 'records', id), {
        ...data,
        updated_at: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating agent billing record:', error);
      throw error;
    }
  },

  // Delete an agent billing record
  async deleteAgentBilling(id: string, dataType: 'equity' | 'fx'): Promise<void> {
    try {
      await deleteDoc(doc(db, 'agent_billing', dataType, 'records', id));
    } catch (error) {
      console.error('Error deleting agent billing record:', error);
      throw error;
    }
  }
}; 

// Interest Claims Operations
export const interestClaimsOperations = {
  // Get all interest claims from all subcollections
  async getAllInterestClaims(): Promise<any[]> {
    try {
      // Get from equity subcollection
      const equitySnapshot = await getDocs(collection(db, 'interest_claims', 'equity', 'records'));
      const equityData = equitySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        subcollection: 'equity'
      }));

      // Get from fx subcollection
      const fxSnapshot = await getDocs(collection(db, 'interest_claims', 'fx', 'records'));
      const fxData = fxSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        subcollection: 'fx'
      }));

      return [...equityData, ...fxData];
    } catch (error) {
      console.error('Error getting all interest claims:', error);
      throw error;
    }
  },

  // Get interest claims by type (subcollection)
  async getInterestClaimsByType(dataType: 'equity' | 'fx'): Promise<any[]> {
    try {
      const snapshot = await getDocs(collection(db, 'interest_claims', dataType, 'records'));
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        data_type: dataType
      }));
    } catch (error) {
      console.error(`Error getting ${dataType} interest claims:`, error);
      throw error;
    }
  },

  // Create a new interest claim in the appropriate subcollection
  async createInterestClaim(data: any, dataType: 'equity' | 'fx'): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'interest_claims', dataType, 'records'), {
        ...data,
        data_type: dataType,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating interest claim:', error);
      throw error;
    }
  },

  // Update an interest claim
  async updateInterestClaim(id: string, data: any, dataType: 'equity' | 'fx'): Promise<void> {
    try {
      await updateDoc(doc(db, 'interest_claims', dataType, 'records', id), {
        ...data,
        updated_at: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating interest claim:', error);
      throw error;
    }
  },

  // Delete an interest claim
  async deleteInterestClaim(id: string, dataType: 'equity' | 'fx'): Promise<void> {
    try {
      await deleteDoc(doc(db, 'interest_claims', dataType, 'records', id));
    } catch (error) {
      console.error('Error deleting interest claim:', error);
      throw error;
    }
  },

  // Delete all documents in a subcollection (for bulk overwrite)
  async deleteAllInSubcollection(dataType: 'equity' | 'fx'): Promise<void> {
    const snapshot = await getDocs(collection(db, 'interest_claims', dataType, 'records'));
    const batch = writeBatch(db);
    snapshot.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }
}; 