require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch(err => console.error('MongoDB connection error:', err));

// Routes
const processRoutes = require('./controllers/processController');
const transactionRoutes = require('./controllers/transactionController');
app.use('/api/process', processRoutes);
app.use('/api/transactions', transactionRoutes);

// Serve static frontend files
const path = require('path');
app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.use((req, res, next) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

const PORT = process.env.PORT || 5555;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
