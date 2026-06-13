import React, { useState } from 'react';
import Button from './Button';
import ConfirmModal from './ConfirmModal';

const CleanDuplicatesButton = () => {
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [resultMessage, setResultMessage] = useState('');

  const handleClean = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dedup-identities/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'admin', threshold: 0.30 })
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setResultMessage(`Merged ${data.clusters_merged} clusters. Removed ${data.people_removed} duplicate profiles and reassigned ${data.logs_reassigned} logs.`);
      } else {
        setResultMessage(data.message || 'Failed to clean duplicates.');
      }
    } catch (err) {
      setResultMessage('Error cleaning duplicates.');
    } finally {
      setLoading(false);
      setResultOpen(true);
    }
  };

  return (
    <>
      <Button 
        onClick={() => setConfirmOpen(true)} 
        disabled={loading} 
        variant="primary"
        style={{ width: '200px', height: '48px', fontSize: '16px', fontFamily: "'Open Sans', sans-serif" }}
      >
        {loading ? 'Cleaning...' : 'Clean Duplicates'}
      </Button>
      
      <ConfirmModal 
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleClean}
        title="Clean Duplicates"
        message="This will scan all people in the database and merge matching faces together. Are you sure you want to proceed?"
      />
      
      <ConfirmModal 
        isOpen={resultOpen}
        onClose={() => {
          setResultOpen(false);
          window.location.reload();
        }}
        onConfirm={() => {
          setResultOpen(false);
          window.location.reload();
        }}
        title="Cleanup Result"
        message={resultMessage}
        hideCancel={true}
        confirmText="OK"
      />
    </>
  );
};

export default CleanDuplicatesButton;
