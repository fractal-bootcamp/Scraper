import cors from 'cors';
import express from 'express';
import router from './routes'; // Ensure this path is correct

const app = express();

// Middleware setup
app.use(cors());
app.use(express.json()); // To parse JSON bodies
app.use('/api', router); // Prefix all routes with /api

const PORT = 8080;

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});