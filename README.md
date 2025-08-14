# Price Rule Debugger

A tool for visualizing and testing price rules for accommodation bookings.

## Setup

1. Copy the environment variables template:
   ```bash
   cp .env.example .env
   ```

2. Edit the `.env` file and add your API keys:
   ```bash
   VITE_API_KEY=your_price_rules_api_key_here
   VITE_SALEABILITY_API_KEY=your_saleability_api_key_here
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Start the development servers:
   ```bash
   npm run dev
   ```

This will start both the Vite frontend server (http://localhost:5173) and the Express API server (http://localhost:3001).

## Features

- Upload XML price rule files or fetch rules from API
- Visualize rules on an interactive timeline
- Test bookings against rules
- Check checkout availability for specific dates
- View saleability data from APEX
