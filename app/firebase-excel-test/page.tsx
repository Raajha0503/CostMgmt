"use client"

import FirebaseExcelUpload from '../../components/firebase-excel-upload';

export default function FirebaseExcelTestPage() {
  const handleDataLoaded = (data: any[], rawData: any[], dataType: "equity" | "fx") => {
    console.log(`Data loaded: ${data.length} records of type ${dataType}`);
    console.log('Processed data:', data);
    console.log('Raw data:', rawData);
  };

  return <FirebaseExcelUpload onDataLoaded={handleDataLoaded} />;
} 