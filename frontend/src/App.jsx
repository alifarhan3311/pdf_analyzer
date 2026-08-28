import { useState, useEffect } from 'react';
import { UploadCloud, FileText, Download, Edit2, Trash2, Plus, X, Check, FileCheck } from 'lucide-react';
import './index.css';

function App() {
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState('Idle');
  const [file, setFile] = useState(null);
  
  // Data state
  const [transactions, setTransactions] = useState([]);
  const [sourceFile, setSourceFile] = useState(null);
  
  // Edit & Add state
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [isAdding, setIsAdding] = useState(false);
  const [addForm, setAddForm] = useState({ date: '', description: '', debit: '', credit: '', balance: '' });

  const fetchTransactions = async (srcFile) => {
    try {
      const res = await fetch(`http://localhost:5555/api/transactions?sourceFile=${encodeURIComponent(srcFile)}`);
      const data = await res.json();
      setTransactions(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleProcess = async () => {
    if (!file) {
      alert("Please select a PDF file first.");
      return;
    }
    
    setProcessing(true);
    setStatus('Uploading and Initializing AI Pipeline...');
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await fetch('http://localhost:5555/api/process/upload', {
        method: 'POST',
        body: formData
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        setStatus(`Failed to process: ${data.error}`);
        setProcessing(false);
        return;
      }

      if (data.message === 'Job started') {
        const jobId = data.jobId;
        const pollInterval = setInterval(async () => {
          try {
            const statusRes = await fetch(`http://localhost:5555/api/process/status/${jobId}`);
            if (!statusRes.ok) return;
            
            const statusData = await statusRes.json();
            setStatus(statusData.status);
            
            if (statusData.isComplete) {
              clearInterval(pollInterval);
              setProcessing(false);
              if (statusData.error) {
                setStatus(`Failed: ${statusData.error}`);
              } else {
                setStatus('Pipeline finished processing successfully.');
                setSourceFile(statusData.sourceFile);
                setTransactions(statusData.transactions);
              }
            }
          } catch (e) {
            console.error('Polling error:', e);
          }
        }, 1000);
      } else if (data.message === 'Loaded from cache') {
        setStatus('Loaded from cache instantly!');
        setSourceFile(data.sourceFile);
        setTransactions(data.transactions);
        setProcessing(false);
      }
    } catch (err) {
      console.error(err);
      setStatus('Server connection error. Make sure backend is running.');
      setProcessing(false);
    }
  };

  const handleEditClick = (t) => {
    setEditingId(t._id);
    setEditForm({ ...t });
  };

  const handleSaveEdit = async () => {
    try {
      const res = await fetch(`http://localhost:5555/api/transactions/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      });
      if (res.ok) {
        setTransactions(transactions.map(t => t._id === editingId ? { ...t, ...editForm } : t));
        setEditingId(null);
      }
    } catch (err) {
      console.error("Failed to save edit", err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this record?")) return;
    try {
      const res = await fetch(`http://localhost:5555/api/transactions/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setTransactions(transactions.filter(t => t._id !== id));
      }
    } catch (err) {
      console.error("Failed to delete", err);
    }
  };

  const handleAddSubmit = async () => {
    try {
      const newTx = { ...addForm, sourceFile: sourceFile || 'Manual Entry' };
      const res = await fetch('http://localhost:5555/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTx)
      });
      if (res.ok) {
        const added = await res.json();
        setTransactions([...transactions, added]);
        setIsAdding(false);
        setAddForm({ date: '', description: '', debit: '', credit: '', balance: '' });
      }
    } catch (err) {
      console.error("Failed to add record", err);
    }
  };

  const handleExport = async () => {
    try {
      const res = await fetch('http://localhost:5555/api/transactions/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceFile })
      });
      
      if (!res.ok) throw new Error("Export failed");
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Exported_Transactions_${sourceFile || 'All'}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error(err);
      alert("Failed to export Excel file.");
    }
  };

  return (
    <div className="app-container">
      <div className="glass-card main-panel">
        <header className="app-header">
          <div>
            <h1>Bank Statement Analyzer</h1>
            <p className="subtitle">AI-powered OCR extraction to Excel</p>
          </div>
          {transactions.length > 0 && (
            <button className="export-btn" onClick={handleExport}>
              <Download size={18} /> Export Excel
            </button>
          )}
        </header>

        {!transactions.length && (
          <div className="upload-section">
            <div className="upload-box">
              <input 
                type="file" 
                accept="application/pdf"
                onChange={handleFileChange} 
                id="file-upload" 
                className="file-input"
              />
              <label htmlFor="file-upload" className="file-label">
                <UploadCloud size={48} className="upload-icon" />
                <span>{file ? file.name : "Click or drag to upload PDF statement"}</span>
              </label>
            </div>
            
            <button 
              className="pdf-button process-btn" 
              onClick={handleProcess} 
              disabled={processing || !file}
            >
              {processing ? (
                <>
                  <div className="spinner"></div>
                  Processing...
                </>
              ) : (
                <>
                  <FileCheck size={20} />
                  Process PDF
                </>
              )}
            </button>

            {status !== 'Idle' && (
              <div className="status-dashboard">
                <div className={`status-item ${processing ? 'active' : ''}`}>
                  {processing && <div className="spinner" style={{width: 14, height: 14, borderWidth: 2}}></div>}
                  {status}
                </div>
              </div>
            )}
          </div>
        )}

        {transactions.length > 0 && (
          <div className="data-section">
            <div className="table-header">
              <h2>Extracted Records {sourceFile && <span className="source-tag">({sourceFile})</span>}</h2>
              <button className="add-btn" onClick={() => setIsAdding(!isAdding)}>
                <Plus size={16} /> Add Record
              </button>
            </div>

            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Debit</th>
                    <th>Credit</th>
                    <th>Balance</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isAdding && (
                    <tr className="add-row">
                      <td><input value={addForm.date} onChange={e => setAddForm({...addForm, date: e.target.value})} placeholder="DD-MMM" /></td>
                      <td><input value={addForm.description} onChange={e => setAddForm({...addForm, description: e.target.value})} placeholder="Description" /></td>
                      <td><input type="number" value={addForm.debit} onChange={e => setAddForm({...addForm, debit: e.target.value})} placeholder="0.00" /></td>
                      <td><input type="number" value={addForm.credit} onChange={e => setAddForm({...addForm, credit: e.target.value})} placeholder="0.00" /></td>
                      <td><input type="number" value={addForm.balance} onChange={e => setAddForm({...addForm, balance: e.target.value})} placeholder="0.00" /></td>
                      <td className="actions-cell">
                        <button className="action-btn success" onClick={handleAddSubmit}><Check size={16}/></button>
                        <button className="action-btn cancel" onClick={() => setIsAdding(false)}><X size={16}/></button>
                      </td>
                    </tr>
                  )}
                  {transactions.map(t => (
                    <tr key={t._id}>
                      {editingId === t._id ? (
                        <>
                          <td><input value={editForm.date} onChange={e => setEditForm({...editForm, date: e.target.value})} /></td>
                          <td><input value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} /></td>
                          <td><input type="number" value={editForm.debit || ''} onChange={e => setEditForm({...editForm, debit: e.target.value})} /></td>
                          <td><input type="number" value={editForm.credit || ''} onChange={e => setEditForm({...editForm, credit: e.target.value})} /></td>
                          <td><input type="number" value={editForm.balance || ''} onChange={e => setEditForm({...editForm, balance: e.target.value})} /></td>
                          <td className="actions-cell">
                            <button className="action-btn success" onClick={handleSaveEdit}><Check size={16}/></button>
                            <button className="action-btn cancel" onClick={() => setEditingId(null)}><X size={16}/></button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td>{t.date}</td>
                          <td className="description-cell">{t.description}</td>
                          <td>{t.debit ? Number(t.debit).toLocaleString(undefined, {minimumFractionDigits: 2}) : '-'}</td>
                          <td>{t.credit ? Number(t.credit).toLocaleString(undefined, {minimumFractionDigits: 2}) : '-'}</td>
                          <td>{t.balance ? Number(t.balance).toLocaleString(undefined, {minimumFractionDigits: 2}) : '-'}</td>
                          <td className="actions-cell">
                            <button className="action-btn edit" onClick={() => handleEditClick(t)}><Edit2 size={16}/></button>
                            <button className="action-btn delete" onClick={() => handleDelete(t._id)}><Trash2 size={16}/></button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="table-footer">
              <button className="secondary-btn" onClick={() => {
                setTransactions([]);
                setFile(null);
                setSourceFile(null);
                setStatus('Idle');
              }}>
                Upload Another Statement
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
