// Firebase Storage operations for Excel files
import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject, 
  listAll,
  StorageReference 
} from 'firebase/storage';
import { 
  collection, 
  addDoc, 
  getDocs, 
  getDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  orderBy,
  serverTimestamp 
} from 'firebase/firestore';
import { storage, db } from './firebase-config';

// File metadata interface
export interface FileMetadata {
  id: string;
  fileName: string;
  originalName: string;
  fileSize: number;
  fileType: string;
  storagePath: string;
  downloadURL: string;
  uploadType: 'excel' | 'csv' | 'template';
  dataType: 'equity' | 'fx';
  uploadedBy?: string;
  uploadedAt: string;
  processedAt?: string;
  status: 'uploaded' | 'processing' | 'processed' | 'error';
  recordCount?: number;
  errorMessage?: string;
  metadata?: {
    headers?: string[];
    dataType?: 'equity' | 'fx';
    fieldMapping?: Record<string, string>;
  };
}

// Upload file to Firebase Storage
export const uploadFileToStorage = async (
  file: File, 
  dataType: 'equity' | 'fx',
  uploadType: 'excel' | 'csv' | 'template' = 'excel'
): Promise<FileMetadata> => {
  try {
    // Create a unique filename
    const timestamp = Date.now();
    const uniqueFileName = `${timestamp}_${file.name}`;
    const storagePath = `excel-files/${dataType}/${uniqueFileName}`;
    
    // Create storage reference
    const storageRef = ref(storage, storagePath);
    
    // Upload file
    const snapshot = await uploadBytes(storageRef, file);
    
    // Get download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    // Create file metadata
    const fileMetadata: Omit<FileMetadata, 'id'> = {
      fileName: uniqueFileName,
      originalName: file.name,
      fileSize: file.size,
      fileType: file.type,
      storagePath: storagePath,
      downloadURL: downloadURL,
      uploadType: uploadType,
      dataType: dataType,
      uploadedAt: new Date().toISOString(),
      status: 'uploaded'
    };
    
    // Save metadata to Firestore
    const docRef = await addDoc(collection(db, 'fileUploads'), {
      ...fileMetadata,
      uploadedAt: serverTimestamp()
    });
    
    return {
      id: docRef.id,
      ...fileMetadata
    };
  } catch (error) {
    console.error('Error uploading file to Firebase Storage:', error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }
};

// Get download URL for a file
export const getFileDownloadURL = async (storagePath: string): Promise<string> => {
  try {
    const storageRef = ref(storage, storagePath);
    return await getDownloadURL(storageRef);
  } catch (error) {
    console.error('Error getting download URL:', error);
    throw new Error(`Failed to get download URL: ${error.message}`);
  }
};

// Download file from Firebase Storage
export const downloadFile = async (fileMetadata: FileMetadata): Promise<Blob> => {
  try {
    const response = await fetch(fileMetadata.downloadURL);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.blob();
  } catch (error) {
    console.error('Error downloading file:', error);
    throw new Error(`Failed to download file: ${error.message}`);
  }
};

// Delete file from Firebase Storage and Firestore
export const deleteFile = async (fileMetadata: FileMetadata): Promise<void> => {
  try {
    // Delete from Firebase Storage
    const storageRef = ref(storage, fileMetadata.storagePath);
    await deleteObject(storageRef);
    
    // Delete from Firestore
    const docRef = doc(db, 'fileUploads', fileMetadata.id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting file:', error);
    throw new Error(`Failed to delete file: ${error.message}`);
  }
};

// Get all uploaded files
export const getAllUploadedFiles = async (): Promise<FileMetadata[]> => {
  try {
    const q = query(
      collection(db, 'fileUploads'),
      orderBy('uploadedAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as FileMetadata[];
  } catch (error) {
    console.error('Error getting uploaded files:', error);
    throw new Error(`Failed to get uploaded files: ${error.message}`);
  }
};

// Get files by data type
export const getFilesByDataType = async (dataType: 'equity' | 'fx'): Promise<FileMetadata[]> => {
  try {
    const q = query(
      collection(db, 'fileUploads'),
      where('dataType', '==', dataType),
      orderBy('uploadedAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as FileMetadata[];
  } catch (error) {
    console.error('Error getting files by data type:', error);
    throw new Error(`Failed to get files by data type: ${error.message}`);
  }
};

// Get files by upload type
export const getFilesByUploadType = async (uploadType: 'excel' | 'csv' | 'template'): Promise<FileMetadata[]> => {
  try {
    const q = query(
      collection(db, 'fileUploads'),
      where('uploadType', '==', uploadType),
      orderBy('uploadedAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as FileMetadata[];
  } catch (error) {
    console.error('Error getting files by upload type:', error);
    throw new Error(`Failed to get files by upload type: ${error.message}`);
  }
};

// Update file metadata
export const updateFileMetadata = async (
  fileId: string, 
  updates: Partial<FileMetadata>
): Promise<void> => {
  try {
    const docRef = doc(db, 'fileUploads', fileId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating file metadata:', error);
    throw new Error(`Failed to update file metadata: ${error.message}`);
  }
};

// Get file metadata by ID
export const getFileMetadata = async (fileId: string): Promise<FileMetadata | null> => {
  try {
    const docRef = doc(db, 'fileUploads', fileId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data()
      } as FileMetadata;
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error getting file metadata:', error);
    throw new Error(`Failed to get file metadata: ${error.message}`);
  }
};

// Mark file as processed
export const markFileAsProcessed = async (
  fileId: string, 
  recordCount: number,
  metadata?: {
    headers?: string[];
    dataType?: 'equity' | 'fx';
    fieldMapping?: Record<string, string>;
  }
): Promise<void> => {
  try {
    const docRef = doc(db, 'fileUploads', fileId);
    await updateDoc(docRef, {
      status: 'processed',
      processedAt: serverTimestamp(),
      recordCount: recordCount,
      metadata: metadata
    });
  } catch (error) {
    console.error('Error marking file as processed:', error);
    throw new Error(`Failed to mark file as processed: ${error.message}`);
  }
};

// Mark file as processing
export const markFileAsProcessing = async (fileId: string): Promise<void> => {
  try {
    const docRef = doc(db, 'fileUploads', fileId);
    await updateDoc(docRef, {
      status: 'processing',
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error marking file as processing:', error);
    throw new Error(`Failed to mark file as processing: ${error.message}`);
  }
};

// Mark file as error
export const markFileAsError = async (fileId: string, errorMessage: string): Promise<void> => {
  try {
    const docRef = doc(db, 'fileUploads', fileId);
    await updateDoc(docRef, {
      status: 'error',
      errorMessage: errorMessage,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error marking file as error:', error);
    throw new Error(`Failed to mark file as error: ${error.message}`);
  }
}; 