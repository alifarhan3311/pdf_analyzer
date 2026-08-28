const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Get all transactions, optionally filter by sourceFile
router.get('/', async (req, res) => {
  try {
    const filter = req.query.sourceFile ? { sourceFile: req.query.sourceFile } : {};
    const transactions = await Transaction.find(filter).sort({ createdAt: -1 });
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add a new transaction
router.post('/', async (req, res) => {
  try {
    const transaction = new Transaction(req.body);
    await transaction.save();
    res.status(201).json(transaction);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update a transaction
router.put('/:id', async (req, res) => {
  try {
    const transaction = await Transaction.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!transaction) return res.status(404).json({ error: 'Not found' });
    res.json(transaction);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete a transaction
router.delete('/:id', async (req, res) => {
  try {
    const transaction = await Transaction.findByIdAndDelete(req.params.id);
    if (!transaction) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export to Excel using exact template
router.post('/export', async (req, res) => {
  try {
    const { sourceFile } = req.body;
    const filter = sourceFile ? { sourceFile } : {};
    const transactions = await Transaction.find(filter).sort({ createdAt: 1 });
    
    if (transactions.length === 0) {
      return res.status(404).json({ error: 'No transactions found to export.' });
    }

    const pythonExecutable = path.resolve(__dirname, '../../venv/Scripts/python.exe');
    const scriptPath = path.resolve(__dirname, '../../ai_pipeline/src/export_excel.py');
    const templatePath = path.resolve(__dirname, '../../01 MasterFile Bookkeeping - 05-Aug-2025 (2).xlsx');
    
    const outputPath = path.join(os.tmpdir(), `Export_${Date.now()}.xlsx`);

    const pythonProcess = spawn(pythonExecutable, [scriptPath, templatePath, outputPath]);

    // Send JSON data to python script via stdin
    pythonProcess.stdin.write(JSON.stringify(transactions));
    pythonProcess.stdin.end();

    let output = '';
    let errorOutput = '';

    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code === 0 && output.includes('SUCCESS')) {
        res.download(outputPath, 'Exported_Transactions.xlsx', (err) => {
          if (err) console.error("Download error:", err);
          // Optional: Clean up temp file
          // fs.unlinkSync(outputPath);
        });
      } else {
        console.error('Python Script Error:', errorOutput);
        res.status(500).json({ error: 'Failed to generate Excel file.' });
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
