// Custom hook for Firebase Storage operations
import { useState, useEffect } from 'react';
import { 
  uploadFileToStorage, 
  downloadFile, 
  deleteFile, 
  getAllUploadedFiles, 
  getFilesByDataType,
  getFilesByUploadType,
  updateFileMetadata,
  markFileAsProcessed,
  markFileAsProcessing,
  markFileAsError,
  type FileMetadata 
} from '../lib/firebase-storage';

export const useFirebaseStorage = () => {
  const [uploadedFiles, setUploadedFiles] = useState<FileMetadata[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  // Load all uploaded files
  const loadUploadedFiles = async () => {
    setLoading(true);
    setError(null);
    try {
      const files = await getAllUploadedFiles();
      setUploadedFiles(files);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load uploaded files');
    } finally {
      setLoading(false);
    }
  };

  // Upload file to Firebase Storage
  const uploadFile = async (
    file: File, 
    dataType: 'equity' | 'fx',
    uploadType: 'excel' | 'csv' | 'template' = 'excel'
  ): Promise<FileMetadata> => {
    setLoading(true);
    setError(null);
    setUploadProgress(0);
    
    try {
      // Simulate upload progress (Firebase doesn't provide progress callbacks by default)
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 100);

      const fileMetadata = await uploadFileToStorage(file, dataType, uploadType);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      // Reload files to include the new upload
      await loadUploadedFiles();
      
      return fileMetadata;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload file');
      throw err;
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  // Download file from Firebase Storage
  const downloadFileFromStorage = async (fileMetadata: FileMetadata): Promise<Blob> => {
    setLoading(true);
    setError(null);
    try {
      const blob = await downloadFile(fileMetadata);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileMetadata.originalName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      return blob;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download file');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Delete file from Firebase Storage
  const deleteFileFromStorage = async (fileMetadata: FileMetadata): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      await deleteFile(fileMetadata);
      
      // Reload files to remove the deleted file
      await loadUploadedFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete file');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Get files by data type
  const loadFilesByDataType = async (dataType: 'equity' | 'fx'): Promise<FileMetadata[]> => {
    setLoading(true);
    setError(null);
    try {
      const files = await getFilesByDataType(dataType);
      setUploadedFiles(files);
      return files;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files by data type');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Get files by upload type
  const loadFilesByUploadType = async (uploadType: 'excel' | 'csv' | 'template'): Promise<FileMetadata[]> => {
    setLoading(true);
    setError(null);
    try {
      const files = await getFilesByUploadType(uploadType);
      setUploadedFiles(files);
      return files;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files by upload type');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Update file metadata
  const updateFile = async (fileId: string, updates: Partial<FileMetadata>): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      await updateFileMetadata(fileId, updates);
      
      // Reload files to get updated data
      await loadUploadedFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update file metadata');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Mark file as processed
  const markFileProcessed = async (
    fileId: string, 
    recordCount: number,
    metadata?: {
      headers?: string[];
      dataType?: 'equity' | 'fx';
      fieldMapping?: Record<string, string>;
    }
  ): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      await markFileAsProcessed(fileId, recordCount, metadata);
      
      // Reload files to get updated status
      await loadUploadedFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark file as processed');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Mark file as processing
  const markFileProcessing = async (fileId: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      await markFileAsProcessing(fileId);
      
      // Reload files to get updated status
      await loadUploadedFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark file as processing');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Mark file as error
  const markFileError = async (fileId: string, errorMessage: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      await markFileAsError(fileId, errorMessage);
      
      // Reload files to get updated status
      await loadUploadedFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark file as error');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Load initial data
  useEffect(() => {
    loadUploadedFiles();
  }, []);

  return {
    // State
    uploadedFiles,
    loading,
    error,
    uploadProgress,
    
    // Operations
    uploadFile,
    downloadFile: downloadFileFromStorage,
    deleteFile: deleteFileFromStorage,
    loadUploadedFiles,
    loadFilesByDataType,
    loadFilesByUploadType,
    updateFile,
    markFileProcessed,
    markFileProcessing,
    markFileError,
    
    // Utility
    clearError: () => setError(null)
  };
}; 