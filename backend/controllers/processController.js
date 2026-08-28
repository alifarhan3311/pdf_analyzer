const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const crypto = require('crypto');
const Transaction = require('../models/Transaction');

const uploadDir = path.resolve(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_'));
  }
});
const upload = multer({ storage: storage });

// In-memory store for active jobs
const activeJobs = {};

router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const filePath = req.file.path;
  const originalName = req.file.originalname;
  const jobId = crypto.randomUUID();

  // Initialize job
  activeJobs[jobId] = {
    status: 'Initializing...',
    isComplete: false,
    error: null,
    sourceFile: originalName,
    transactions: []
  };

  res.status(202).json({ message: 'Job started', jobId, sourceFile: originalName });

  try {
    const fileBuffer = fs.readFileSync(filePath);
    const fileHash = crypto.createHash('md5').update(fileBuffer).digest('hex');
    const existingTransactions = await Transaction.find({ fileHash }).sort({ createdAt: -1 });

    if (existingTransactions.length > 0) {
      activeJobs[jobId].status = 'Loaded from cache.';
      activeJobs[jobId].transactions = existingTransactions;
      activeJobs[jobId].isComplete = true;
      return;
    }

    const pythonExecutable = path.resolve(__dirname, '../../venv/Scripts/python.exe');
    const scriptPath = path.resolve(__dirname, '../../ai_pipeline/src/pipeline.py');
    const args = [scriptPath, '--file', filePath, '--json-out'];

    const pythonProcess = spawn(pythonExecutable, args);
    let outputData = '';

    pythonProcess.stdout.on('data', (data) => {
      const text = data.toString();
      outputData += text;
      // Extract latest progress line if available (ignore JSON blocks)
      const lines = text.split('\n');
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();
        if (line && !line.startsWith('---') && !line.startsWith('[') && !line.startsWith('{')) {
          activeJobs[jobId].status = line; // e.g. "Processing file.pdf..." or "OCR on page 1..."
          break;
        }
      }
    });

    pythonProcess.stderr.on('data', (data) => {
      const text = data.toString();
      console.error(`Python stderr: ${text}`);
      // Only set error status if it seems like a real crash, else it might just be a warning
      if (text.toLowerCase().includes('traceback') || text.toLowerCase().includes('error')) {
        activeJobs[jobId].status = 'Warning: ' + text.trim().split('\n').pop(); 
      }
    });

    pythonProcess.on('close', async (code) => {
      if (code !== 0) {
        activeJobs[jobId].error = 'Exit code ' + code + ' | ' + errorData;
        activeJobs[jobId].isComplete = true;
        return;
      }

      try {
        const jsonStart = outputData.indexOf('---JSON_START---');
        const jsonEnd = outputData.indexOf('---JSON_END---');
        
        if (jsonStart !== -1 && jsonEnd !== -1) {
          const jsonStr = outputData.substring(jsonStart + 16, jsonEnd).trim();
          const transactions = JSON.parse(jsonStr);
          
          const savedTransactions = [];
          for (let t of transactions) {
            t.sourceFile = originalName;
            t.fileHash = fileHash;
            const newTx = new Transaction(t);
            await newTx.save();
            savedTransactions.push(newTx);
          }
          
          activeJobs[jobId].transactions = savedTransactions;
          activeJobs[jobId].status = 'Processing complete';
          activeJobs[jobId].isComplete = true;
        } else {
          activeJobs[jobId].error = 'Failed to extract JSON from pipeline output.';
          activeJobs[jobId].isComplete = true;
        }
      } catch (err) {
        console.error(err);
        activeJobs[jobId].error = 'Error parsing pipeline output: ' + err.message;
        activeJobs[jobId].isComplete = true;
      }
    });
  } catch (err) {
    console.error(err);
    activeJobs[jobId].error = 'Server error during file processing';
    activeJobs[jobId].isComplete = true;
  }
});

// Endpoint to poll job status
router.get('/status/:jobId', (req, res) => {
  const job = activeJobs[req.params.jobId];
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  res.json(job);
  
  // Cleanup memory after sending completion state
  if (job.isComplete) {
    setTimeout(() => {
        delete activeJobs[req.params.jobId];
    }, 10000); // keep for 10s just in case frontend retries
  }
});

module.exports = router;
