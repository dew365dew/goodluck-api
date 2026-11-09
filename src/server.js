require('dotenv').config();

const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const adminRoutes = require('./routes/admin');
const quizRoutes = require('./routes/quizzes');
const numberRoutes = require('./routes/numbers');
const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'GoodLuck API is running',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/numbers', numberRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(
    `GoodLuck API running on http://localhost:${PORT}`
  );
});