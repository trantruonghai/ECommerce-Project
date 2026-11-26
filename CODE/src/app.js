// Minimal app used by the tests. Hải's main server file should mount the same router:
//   app.use('/api/auth', require('./routes/authRoutes'));
const express = require('express');
const authRoutes = require('./routes/authRoutes');

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

const adminRoutes = require('./routes/adminRoutes');
app.use('/api/admin', adminRoutes);

module.exports = app;