import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Import route handlers
import { priceRulesHandler } from './server/routes/priceRules.js';
import { saleabilityHandler } from './server/routes/saleability.js';
import { checkoutHandler } from './server/routes/checkout.js';
import { checkoutHandler } from './server/routes/checkout.js';

// Load environment variables
dotenv.config();

// Allow self-signed certificates in development
if (process.env.NODE_ENV !== 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Price Rule Debugger API server is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API Routes
app.get('/api/pdp/:propertyCode', checkoutHandler);
app.get('/api/saleability/:propertyCode', saleabilityHandler);
// API Routes
app.get('/api/price-rules/*', priceRulesHandler);
app.get('/api/saleability/:propertyCode', saleabilityHandler);
app.get('/api/pdp/:propertyCode', checkoutHandler);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Not found',
    message: `Route ${req.originalUrl} not found`,
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Price Rule Debugger API server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});
