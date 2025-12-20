const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const fs = require('fs').promises;
const path = require('path');

const CUSTOMERS_FILE = path.join(process.cwd(), 'customers.json');

async function loadCustomers() {
  try {
    const data = await fs.readFile(CUSTOMERS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return {};
  }
}

export default async (req, res) => {
  const { memberId } = req.body;

  try {
    // Load customers mapping
    const customers = await loadCustomers();
    const customerData = customers[memberId];
    
    if (!customerData || !customerData.stripeCustomerId) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const customerId = customerData.stripeCustomerId;
    console.log('Creating portal session for:', customerId);

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: 'https://aisignalscout.com/dashboard.html'
    });

    return res.json({ url: session.url });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
};