const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

export default async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(400).json({ error: 'POST only' });
  }

  const { memberId, memberStackToken } = req.body;
  
  if (!memberId) {
    return res.status(400).json({ isActive: false });
  }

  try {
    // Fetch Stripe ID from MemberStack
    let stripeCustomerId = null;
    
    try {
      const memberRes = await fetch(`https://api.memberstack.io/v1/members/${memberId}`, {
        headers: { 'Authorization': `Bearer ${memberStackToken}` }
      });
      
      if (memberRes.ok) {
        const memberData = await memberRes.json();
        stripeCustomerId = memberData.customFields?.stripeCustomerId;
      }
    } catch (e) {
      console.log('Could not fetch from MemberStack:', e.message);
    }
    
    if (!stripeCustomerId) {
      console.log('No Stripe customer found for memberId:', memberId);
      return res.json({ isActive: false });
    }

    console.log('Checking subscription for Stripe customer:', stripeCustomerId);
    
    const subscriptions = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: 'active'
    });

    const isActive = subscriptions.data && subscriptions.data.length > 0;
    console.log('Is active subscription:', isActive);
    return res.json({ isActive });
    
  } catch (error) {
    console.error('Stripe error:', error.message);
    return res.json({ isActive: false });
  }
};