const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

export default async (req, res) => {
  const { memberId, memberStackToken } = req.body;

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
      return res.status(404).json({ error: 'Customer not found' });
    }

    console.log('Creating portal session for:', stripeCustomerId);

    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: 'https://aisignalscout.com/dashboard.html'
    });

    return res.json({ url: session.url });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
};